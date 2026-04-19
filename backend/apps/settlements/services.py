from decimal import Decimal
from django.db import models
from apps.groups.models import Membership
from apps.bills.models import Bill, Item, ItemAssignment
from .models import Settlement

def compute_balances(group_id):
    balances = {}
    memberships = Membership.objects.filter(group_id=group_id).select_related('user')
    for m in memberships:
        balances[m.user.id] = {
            'user_id': m.user.id,
            'name': m.user.name,
            'net': Decimal('0.00')
        }

    bill_total_shares = {}
    item_aggregates = Item.objects.filter(
        bill__group_id=group_id
    ).values('bill_id').annotate(
        total=models.Sum('assignments__share_amount')
    )
    for agg in item_aggregates:
        bill_total_shares[agg['bill_id']] = agg['total'] or Decimal('0.00')

    bills = Bill.objects.filter(group_id=group_id)
    for bill in bills:
        payer_id = bill.paid_by_id or bill.created_by_id
        if payer_id in balances:
            balances[payer_id]['net'] += bill_total_shares.get(bill.id, Decimal('0.00'))

    assignments = ItemAssignment.objects.filter(item__bill__group_id=group_id)
    for assignment in assignments:
        if assignment.user_id in balances:
            balances[assignment.user_id]['net'] -= assignment.share_amount

    settlements = Settlement.objects.filter(group_id=group_id)
    for settlement in settlements:
        if settlement.payer_id in balances:
            balances[settlement.payer_id]['net'] += settlement.amount
        if settlement.payee_id in balances:
            balances[settlement.payee_id]['net'] -= settlement.amount

    for user_id, bal in balances.items():
         bal['net_balance'] = f"{bal['net']:.2f}"
         bal['user_name'] = bal.pop('name')

    return list(balances.values())


def compute_user_debts(group_id):
    memberships = Membership.objects.filter(group_id=group_id).select_related('user')
    members = {m.user.id: m.user for m in memberships}

    pairwise = {uid: {oid: Decimal('0.00') for oid in members} for uid in members}

    assignments_by_bill = {}
    for assignment in ItemAssignment.objects.filter(item__bill__group_id=group_id).select_related('item'):
        bill_id = assignment.item.bill_id
        if bill_id not in assignments_by_bill:
            assignments_by_bill[bill_id] = []
        assignments_by_bill[bill_id].append(assignment)

    bills = Bill.objects.filter(group_id=group_id)
    for bill in bills:
        payer_id = bill.paid_by_id or bill.created_by_id
        if payer_id not in members:
            continue
        for assignment in assignments_by_bill.get(bill.id, []):
            if assignment.user_id != payer_id and assignment.user_id in members:
                pairwise[assignment.user_id][payer_id] += assignment.share_amount

    settlements = Settlement.objects.filter(group_id=group_id)
    for settlement in settlements:
        pid = settlement.payer_id
        eid = settlement.payee_id
        if pid not in members or eid not in members:
            continue
        remaining = settlement.amount
        if pairwise[pid][eid] > 0:
            reduction = min(remaining, pairwise[pid][eid])
            pairwise[pid][eid] -= reduction
            remaining -= reduction
        if remaining > 0 and pairwise[eid][pid] > 0:
            reduction = min(remaining, pairwise[eid][pid])
            pairwise[eid][pid] -= reduction

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

        net = Decimal('0.00')
        for other_id in members:
            if other_id != user_id:
                net += pairwise[other_id][user_id] - pairwise[user_id][other_id]

        result.append({
            'user_id': str(user_id),
            'user_name': user.name or user.email,
            'net_balance': f"{net:.2f}",
            'owes': owes,
            'gets_from': gets_from
        })

    return result
