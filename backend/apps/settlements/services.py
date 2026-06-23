from decimal import Decimal
from collections import defaultdict
from uuid import UUID
from django.db import models
from apps.groups.models import Membership
from apps.bills.models import Bill, Item, ItemAssignment
from .models import Settlement

ZERO = Decimal('0.00')


def _group_key(value):
    """Normalise a group id to a UUID so dict lookups are consistent.

    The settlement views pass the raw `?group=` query parameter through, which
    is a string, while the ORM hands back real UUID objects. Keying the batch
    dict on whatever the caller happened to pass made the two disagree.
    """
    return value if isinstance(value, UUID) else UUID(str(value))


def load_debt_inputs(group_ids):
    """Fetch everything the pairwise matrix needs, for many groups at once.

    Batched deliberately. `compute_pairwise_debts` used to query assignments
    once per bill, which is fine for a single group but would make the group
    *list* endpoint issue one query per bill across every group the user is in.
    This is four queries regardless of how many groups are asked for.

    Returns {group_id: {'members', 'bills', 'assignments', 'settlements'}}
    where `bills` maps bill_id -> (group_id, payer_id) and `assignments` maps
    bill_id -> [(user_id, share_amount)].
    """
    group_ids = [_group_key(gid) for gid in group_ids]
    inputs = {
        group_id: {
            'members': {},
            'bills': {},
            'assignments': defaultdict(list),
            'settlements': [],
        }
        for group_id in group_ids
    }
    if not group_ids:
        return inputs

    for m in Membership.objects.filter(group_id__in=group_ids).select_related('user'):
        inputs[m.group_id]['members'][m.user_id] = m.user

    bills = Bill.objects.filter(group_id__in=group_ids).only(
        'id', 'group_id', 'paid_by_id', 'created_by_id'
    )
    for bill in bills:
        # A bill with no explicit payer is attributed to whoever created it.
        payer_id = bill.paid_by_id or bill.created_by_id
        inputs[bill.group_id]['bills'][bill.id] = (bill.group_id, payer_id)

    # One query for every assignment in every group, instead of one per bill.
    for bill_id, user_id, share_amount in ItemAssignment.objects.filter(
        item__bill_id__in=[bid for data in inputs.values() for bid in data['bills']]
    ).values_list('item__bill_id', 'user_id', 'share_amount'):
        for data in inputs.values():
            if bill_id in data['bills']:
                data['assignments'][bill_id].append((user_id, share_amount))
                break

    for settlement in Settlement.objects.filter(group_id__in=group_ids).only(
        'group_id', 'payer_id', 'payee_id', 'amount'
    ):
        inputs[settlement.group_id]['settlements'].append(
            (settlement.payer_id, settlement.payee_id, settlement.amount)
        )

    return inputs


def _build_pairwise(members, bills, assignments, settlements):
    """The pure matrix maths, from already-loaded rows. No queries."""
    pairwise = {uid: {oid: ZERO for oid in members} for uid in members}

    # Each assignment is a debt from that member to the bill's payer.
    # Non-member assignments are skipped rather than filtered in SQL, which is
    # what the per-bill query used to do.
    for bill_id, (_group_id, payer_id) in bills.items():
        if payer_id not in members:
            continue
        for user_id, share_amount in assignments.get(bill_id, ()):
            if user_id not in members or user_id == payer_id:
                continue
            pairwise[user_id][payer_id] += share_amount

    # Settlements pay debts down. Excess is intentionally clamped and
    # discarded: a settlement can never create credit nobody owes.
    for pid, eid, amount in settlements:
        if pid not in members or eid not in members:
            continue
        remaining = amount
        for a, b in ((pid, eid), (eid, pid)):
            if remaining <= 0:
                break
            if pairwise[a][b] > 0:
                reduction = min(remaining, pairwise[a][b])
                pairwise[a][b] -= reduction
                remaining -= reduction

    return pairwise


def compute_pairwise_debts(group_id):
    """Build the group's outstanding pairwise debts, after settlements.

    This is the single source of truth for anything derived from group
    balances. Deriving `compute_balances` and `compute_user_debts` from the
    same matrix is what makes them agree, keeps every net balance summing to
    zero, and means a settlement can only ever reduce a debt that the
    surviving bills actually justify -- so deleting an already-settled bill
    stops the phantom debt instead of leaving it behind.
    """
    data = load_debt_inputs([group_id])[_group_key(group_id)]
    return data['members'], _build_pairwise(
        data['members'], data['bills'], data['assignments'], data['settlements']
    )


def compute_user_nets(group_ids, user_id):
    """One user's net balance per group, as {group_id: '123.45'}.

    Same maths as `compute_user_debts`, but returns only the row for `user_id`
    and does it for every group in a fixed number of queries. This is what
    lets the group list show a per-group balance for the signed-in user
    without falling into a query per group.
    """
    inputs = load_debt_inputs(group_ids)
    result = {}

    for group_id, data in inputs.items():
        members = data['members']
        if user_id not in members:
            result[group_id] = '0.00'
            continue
        pairwise = _build_pairwise(
            members, data['bills'], data['assignments'], data['settlements']
        )
        net = sum(
            (pairwise[other_id][user_id] - pairwise[user_id][other_id])
            for other_id in members
            if other_id != user_id
        )
        result[group_id] = f"{net:.2f}"

    return result


def compute_balances(group_id):
    """Net balance per member. Sums to exactly zero by construction."""
    members, pairwise = compute_pairwise_debts(group_id)

    balances = []
    for user_id, user in members.items():
        net = sum(
            (pairwise[other_id][user_id] - pairwise[user_id][other_id])
            for other_id in members
            if other_id != user_id
        )
        balances.append({
            'user_id': str(user_id),
            'user_name': user.name or user.email,
            'net_balance': f"{net:.2f}",
        })

    return balances


def compute_user_debts(group_id):
    members, pairwise = compute_pairwise_debts(group_id)

    result = []
    for user_id, user in members.items():
        owes = []
        gets_from = []

        for other_id, other in members.items():
            if user_id == other_id:
                continue
            net_pair = pairwise[user_id][other_id] - pairwise[other_id][user_id]
            if net_pair > 0:
                owes.append({
                    'user_id': str(other_id),
                    'user_name': other.name or other.email,
                    'amount': f"{net_pair:.2f}"
                })
            elif net_pair < 0:
                gets_from.append({
                    'user_id': str(other_id),
                    'user_name': other.name or other.email,
                    'amount': f"{abs(net_pair):.2f}"
                })

        net = sum(
            (pairwise[other_id][user_id] - pairwise[user_id][other_id])
            for other_id in members
            if other_id != user_id
        )

        result.append({
            'user_id': str(user_id),
            'user_name': user.name or user.email,
            'net_balance': f"{net:.2f}",
            'owes': owes,
            'gets_from': gets_from
        })

    return result
