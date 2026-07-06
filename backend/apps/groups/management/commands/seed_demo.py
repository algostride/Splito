"""Fill the database with demo data so the whole UI can be looked at.

Design notes, because both choices here are deliberate:

1. Everything relational is created through the real API, using
   ``APIClient.force_authenticate``, not by calling ``.objects.create()``.
   The bill endpoints are strict -- ``paid_by`` and every assignment must be a
   group member, item amounts must sum to the bill total, and share amounts
   must sum to the item amount. More importantly, ``_resolve_shares`` and
   ``_allocate`` do exact paise-conserving allocation. Re-implementing that
   maths in a seeder is how you end up with a Balances tab that looks
   plausible but does not reconcile, which is worse than no data at all: it
   reads as a UI bug when the cause is the seed. Driving the API makes every
   row correct by construction and keeps this file free of money arithmetic.

2. The structure is fixed, only the dates and payers vary with ``--seed``.
   Pure randomness would make screenshots unreproducible and would sometimes
   leave a screen empty, which defeats the point of seeding for a visual
   review. So the shape below is curated to hit every screen and every empty
   state, and the seed only jitters dates and picks payers.

Usage:
    python manage.py seed_demo
    python manage.py seed_demo --seed 42
    python manage.py seed_demo --no-backup

This DESTROYS all existing data. A dump is written first unless --no-backup
is passed.
"""

import os
import random
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from rest_framework.test import APIClient

from apps.bills.models import Bill, Item, ItemAssignment
from apps.groups.models import Group, GroupInvite, Membership
from apps.settlements.models import Settlement
from apps.settlements.services import compute_pairwise_debts

User = get_user_model()

DEFAULT_PASSWORD = 'Splito#2026'
FRONTEND = 'http://localhost:5173'


def client_for(user=None):
    """An API client whose requests the dev ALLOWED_HOSTS will accept.

    DRF's test client defaults to the 'testserver' host, which the project's
    ALLOWED_HOSTS ('localhost' by default) rejects. DisallowedHost is raised by
    middleware before any view runs, so every call would come back as a bare
    HttpResponse with no .data. Setting SERVER_NAME is narrower than widening
    ALLOWED_HOSTS in settings, which would be a real change to the app's
    security posture just to make a dev tool work.
    """
    client = APIClient(SERVER_NAME='localhost')
    if user is not None:
        client.force_authenticate(user=user)
    return client


def body_of(response):
    """The error payload, whether it came from a view or from middleware."""
    data = getattr(response, 'data', None)
    return data if data is not None else response.content[:400]


def plural(count, noun):
    return f'{count} {noun}' if count == 1 else f'{count} {noun}s'

# (name, email). Index 0 is the user you sign in as. Index 6 is deliberately
# left out of every group you belong to, so the Friends page can be checked
# against the co-membership definition rather than a friend list.
USERS = [
    ('Aarav Sharma', 'aarav@demo.splito.test'),
    ('Priya Nair', 'priya@demo.splito.test'),
    ('Rohan Mehta', 'rohan@demo.splito.test'),
    ('Sneha Iyer', 'sneha@demo.splito.test'),
    ('Vikram Reddy', 'vikram@demo.splito.test'),
    ('Ananya Krishnan', 'ananya@demo.splito.test'),
    ('Dev Patel', 'dev@demo.splito.test'),
]

# An item is (name, amount, split_mode, [(user_index, split_value), ...]).
# With split_mode 'shares' the values are relative weights; with 'percent' they
# are percentages of the item that must add up to 100. Either way the backend
# converts them to money, so the numbers below are never added up by hand.
def S(name, amount, weights):
    return (name, amount, 'shares', weights)


def P(name, amount, percents):
    return (name, amount, 'percent', percents)


# Each group: (name, owner_index, member_indexes, [bill, ...])
# A bill is (title, payer_index_or_None, days_ago, [item, ...]).
# payer None means "let the seed pick a payer", which is the only bit of
# randomness that touches the data shape.
BILLS = [
    (
        'Flat 302, Indiranagar', 0, [0, 1, 2, 3],
        [
            ('Big Basket', 0, 2, [S('Big Basket', '2480.00', [(0, 1), (1, 1), (2, 1), (3, 1)])]),
            ('Electricity Bill — September', 1, 5,
             [S('Electricity Bill — September', '3150.00', [(0, 1), (1, 1), (2, 1)])]),
            ('Groceries', 2, 9, [
                S('Milk & Eggs', '320.00', [(0, 1), (1, 1), (2, 1), (3, 1)]),
                S('Bread', '180.00', [(0, 1), (3, 1)]),
                P('Coffee Beans', '1240.00', [(0, 50), (2, 50)]),
            ]),
            ('Internet — 3 Months', 0, 12,
             [S('Jio Fiber — 3 Months', '2699.00', [(0, 1), (1, 1), (2, 1), (3, 1)])]),
            ('Water Tanker', 3, 20,
             [S('Water Tanker', '450.00', [(0, 1), (2, 1), (3, 1)])]),
            ('Household Chores', 1, 30, [
                P('Cleaning Supplies', '899.00', [(0, 60), (1, 40)]),
                P('Broom & Mop', '640.00', [(0, 25), (1, 25), (2, 25), (3, 25)]),
            ]),
            # A 3-way split of 100.00: 33.34/33.33/33.33. Put in specifically so
            # the paise handover in _allocate is visible in the data.
            ('Snacks & Drinks', 0, 45,
             [S('Snacks & Drinks', '100.00', [(0, 1), (2, 1), (3, 1)])]),
            # Fractional shares and a fractional percent, both of which the UI
            # mishandled until recently: a 6dp split_value rendered as
            # "1.000000" in the edit form, and splitWeights parsed shares with
            # parseInt, so a share below 1 was dropped and its owner was handed
            # the whole bill. Four and a half loaves against half a loaf is
            # also the clearest illustration of why shares are relative -- it is
            # the same 90/10 as 9 and 1, but nobody counts loaves in nines.
            ('Bakery — 5 loaves', 0, 6, [S('Bakery', '250.00', [(0, 4.5), (1, 0.5)])]),
            # A percent that is not a round number, so the form shows 2dp rather
            # than the six the column stores.
            ('Household Split', 3, 8, [P('Household Split', '1337.00',
                                          [(3, 14.516129), (0, 7.258064), (1, 78.225807)])]),
        ],
    ),
    (
        'Coorg Trip', 0, [0, 1, 2],
        [
            ('Villa Booking', 0, 15, [
                S('Villa — 2 Nights', '8400.00', [(0, 1), (1, 1), (2, 1)]),
                S('Cleaning Fee', '1200.00', [(0, 1), (1, 1), (2, 1)]),
            ]),
            ('Trip Supplies', 1, 14, [
                P('Groceries', '1560.00', [(1, 50), (2, 50)]),
                P('Fuel', '2400.00', [(0, 50), (2, 50)]),
            ]),
            # Excludes user 0 from every item, so this is the only bill in the
            # whole seed set the signed-in user is "not involved" in. The Bills
            # tab shows owed / owe / not involved per bill, and without this the
            # third state could not be looked at or screenshotted.
            ('Souvenirs', 1, 13, [S('Souvenirs', '780.00', [(1, 1), (2, 1)])]),
        ],
    ),
    (
        # Settled in full, so the Balances tab shows its "all square" state
        # while the Settlements tab still has a row.
        'Weekend Trip', 0, [0, 5],
        [
            ('Train Tickets', 0, 60, [S('Train Tickets', '1840.00', [(0, 1), (5, 1)])]),
        ],
    ),
    (
        # Eight bills to make the table and the mobile card list scroll.
        'Office Lunch Club', 4, [4, 0, 1, 2, 3],
        [
            ('Team Lunch — Tuesday', 4, 1,
             [S('Team Lunch — Tuesday', '640.00', [(0, 1), (1, 1), (2, 1), (3, 1), (4, 1)])]),
            ('Chai & Snacks', 0, 2,
             [S('Chai & Snacks', '180.00', [(0, 1), (1, 1), (2, 1), (3, 1), (4, 1)])]),
            ('Pizza Friday', 1, 3, [
                S('Garlic Bread', '320.00', [(1, 1), (4, 1)]),
                S('Two Pizzas', '1480.00', [(0, 1), (1, 1), (2, 1), (3, 1), (4, 1)]),
            ]),
            ('Filter Coffee', 2, 5,
             [S('Filter Coffee', '95.00', [(0, 1), (1, 1), (2, 1), (3, 1), (4, 1)])]),
            ('Team Dinner', 3, 8,
             [P('Team Dinner', '4200.00', [(0, 20), (1, 20), (2, 20), (3, 20), (4, 20)])]),
            ('Cab to Office', 4, 10, [S('Cab to Office', '340.00', [(0, 1), (4, 1)])]),
            ('Samosa Run', 0, 12,
             [S('Samosa Run', '120.00', [(0, 1), (1, 1), (2, 1), (3, 1), (4, 1)])]),
            # 1100.00 across 3 people: 366.67/366.67/366.66. Another paise case.
            ('Cake for Shubha', 1, 15,
             [S('Cake for Shubha', '1100.00', [(0, 1), (1, 1), (3, 1)])]),
        ],
    ),
    (
        # Long on purpose: checks truncation and wrapping in the group header,
        # the tab bar and the friends cards.
        'A Deliberately Long Group Name Used To Check Header Truncation And Wrapping Behaviour In The UI',
        0, [0, 1, 3],
        [
            ('Dinner Reservation', 0, 3,
             [S('Dinner Reservation', '2240.00', [(0, 1), (1, 1), (3, 1)])]),
        ],
    ),
    (
        # No bills, and you are the only member: the empty states.
        'Solo Budget', 0, [0], [],
    ),
]

# Settlements to create once the bills exist. Each is (group, other_user_index,
# fraction_of_outstanding_debt), always between you and that other person so the
# Settlements tab shows rows you are part of.
#
# A fraction rather than an amount, so a settlement always sits inside a real
# debt instead of being clamped by the backend. The direction is not specified
# and does not need to be: whoever actually owes gets settled up. Working that
# out by hand across these bills is easy to get wrong, and a settlement in the
# wrong direction is silently clamped into a no-op.
SETTLEMENTS = [
    ('Coorg Trip', 1, Decimal('0.40')),
    ('Weekend Trip', 5, Decimal('1.00')),
    ('Office Lunch Club', 1, Decimal('0.50')),
]


class Command(BaseCommand):
    help = 'Wipe all data and reseed the database with demo data for visual review.'

    def add_arguments(self, parser):
        parser.add_argument('--seed', type=int, default=7,
                            help='Seed for date jitter and payer choice (default: 7).')
        parser.add_argument('--password', default=DEFAULT_PASSWORD,
                            help=f'Password for every demo user (default: {DEFAULT_PASSWORD}).')
        parser.add_argument('--no-backup', action='store_true',
                            help='Skip the dumpdata backup. Only use this if you '
                                 'really do not want a copy of the current data.')

    def handle(self, *args, **options):
        rng = random.Random(options['seed'])
        password = options['password']

        if len(password) < 8:
            raise CommandError('Password must be at least 8 characters.')

        counts = self._backup(skip=options['no_backup'])
        self._wipe()
        created = self._seed(rng, password)

        self.stdout.write('')
        self._report(created, password)
        self.stdout.write('')
        if not self._self_check():
            raise CommandError(
                'Seed data failed its own reconciliation check. The database is '
                'left in place so it can be inspected, but do not treat it as '
                'trustworthy demo data.'
            )

    # ------------------------------------------------------------------ backup

    def _backup(self, skip):
        """dumpdata before touching anything, and print how to restore it."""
        counts = {
            'users': User.objects.count(),
            'groups': Group.objects.count(),
            'bills': Bill.objects.count(),
            'settlements': Settlement.objects.count(),
            'invites': GroupInvite.objects.count(),
        }
        self.stdout.write(self.style.WARNING(
            'About to delete all data: '
            + ', '.join(f'{n} {k}' for k, n in counts.items())
        ))

        if skip or counts['users'] == 0:
            if skip and counts['users']:
                self.stdout.write(self.style.WARNING('Skipping backup (--no-backup).'))
            return counts

        stamp = timezone.now().strftime('%Y%m%d-%H%M%S')
        target = f'seed-backups/demo-{stamp}.json'
        # dumpdata's `output` writes with plain open(), so it will not create
        # the directory. Getting this wrong aborts before the wipe, which is
        # the right order for something this destructive.
        os.makedirs('seed-backups', exist_ok=True)
        call_command('dumpdata', 'accounts', 'groups', 'bills', 'settlements',
                     output=target, indent=2)
        self.stdout.write(self.style.SUCCESS(f'Backup written to backend/{target}'))
        self.stdout.write(f'  restore with: python manage.py loaddata {target}')
        return counts

    # -------------------------------------------------------------------- wipe

    @transaction.atomic
    def _wipe(self):
        """Delete in dependency order rather than trusting CASCADE.

        Doing it explicitly means the counts printed before the wipe are the
        counts actually removed, which is the only thing that makes a
        destructive command reviewable.
        """
        GroupInvite.objects.all().delete()
        Settlement.objects.all().delete()
        Bill.objects.all().delete()          # cascades to items and assignments
        Membership.objects.all().delete()
        Group.objects.all().delete()
        User.objects.all().delete()

    # -------------------------------------------------------------------- seed

    def _seed(self, rng, password):
        users = self._create_users(password)
        groups = {}
        for name, owner, members, _ in BILLS:
            groups[name] = self._create_group(name, owner, members, users, rng)

        bill_count = 0
        for name, owner, members, bills in BILLS:
            group = groups[name]
            for title, payer, days_ago, items in bills:
                self._create_bill(group, title, payer, days_ago, items, members, users, rng)
                bill_count += 1

        settlement_count = self._create_settlements(groups, users)
        pending_token = self._create_pending_invite(groups['Flat 302, Indiranagar'], users[6])

        return {
            'users': users,
            'groups': groups,
            'bills': bill_count,
            'settlements': settlement_count,
            'pending_token': pending_token,
        }

    def _create_users(self, password):
        """Register through the API rather than create_user().

        This is not about speed. It means the demo accounts are exactly the
        shape the app's own registration accepts, so there is no surprise where
        a seeded account behaves differently from one made through the UI.
        """
        client = client_for()
        users = []
        for name, email in USERS:
            response = client.post('/api/v1/accounts/register/', {
                'email': email, 'name': name, 'password': password,
            }, format='json')
            if response.status_code != 201:
                raise CommandError(
                    f'Register failed for {email}: {response.status_code} {body_of(response)}'
                )
            users.append(User.objects.get(email=email))
        return users

    def _create_group(self, name, owner, members, users, rng):
        creator = users[owner]
        client = client_for(creator)

        response = client.post('/api/v1/groups/', {'name': name}, format='json')
        if response.status_code != 201:
            raise CommandError(f'Could not create group {name!r}: {body_of(response)}')
        group = Group.objects.get(pk=response.data['id'])

        # No need to add the creator's own membership: GroupSerializer.create()
        # already does it. Adding it again here violates the unique constraint
        # on (user, group).

        for index in members:
            if index == owner:
                continue
            invitee = users[index]
            invite = client.post(f'/api/v1/groups/{group.id}/invite/',
                                 {'email': invitee.email}, format='json')
            if invite.status_code != 201:
                raise CommandError(f'Could not invite {invitee.email} to {name!r}: {body_of(invite)}')

            member_client = client_for(invitee)
            accept = member_client.post(
                f'/api/v1/groups/accept-invite/{invite.data["token"]}/', {}, format='json'
            )
            if accept.status_code != 200:
                raise CommandError(f'{invitee.email} could not accept: {body_of(accept)}')

        # Spread join dates out so the Members tab has an order to show.
        now = timezone.now()
        for offset, index in enumerate(sorted(members)):
            Membership.objects.filter(group=group, user=users[index]).update(
                joined_at=now - timedelta(days=rng.randint(20, 400) + offset)
            )
        Group.objects.filter(pk=group.pk).update(
            created_at=now - timedelta(days=rng.randint(30, 500))
        )
        return group

    def _create_bill(self, group, title, payer, days_ago, items, members, users, rng):
        if payer is None:
            payer = rng.choice(members)

        client = client_for(users[payer])

        payload_items = []
        for name, amount, mode, weights in items:
            payload_items.append({
                'name': name,
                'amount': amount,
                'split_mode': mode,
                'assignments': [
                    {'user_id': str(users[i].id), 'split_value': value}
                    for i, value in weights
                ],
            })

        total = sum(Decimal(amount) for _, amount, _, _ in items)
        response = client.post('/api/v1/bills/', {
            'group': str(group.id),
            'title': title,
            'total_amount': f'{total:.2f}',
            'currency': 'INR',
            'bill_type': 'simple' if len(items) == 1 else 'compound',
            'paid_by': str(users[payer].id),
            'items': payload_items,
        }, format='json')

        if response.status_code != 201:
            raise CommandError(f'Could not create bill {title!r} in {group.name!r}: {body_of(response)}')

        # created_at is auto_now_add, so the value above is ignored. Backdate
        # with .update() rather than trying to pass it in.
        bill = Bill.objects.get(pk=response.data['id'])
        jitter = rng.randint(0, 2)
        Bill.objects.filter(pk=bill.pk).update(
            created_at=timezone.now() - timedelta(days=days_ago + jitter)
        )
        return bill

    def _create_settlements(self, groups, users):
        """Settle a fraction of a real debt, in whichever direction it runs."""
        you = users[0]
        count = 0
        for group_name, other_index, fraction in SETTLEMENTS:
            group = groups[group_name]
            other = users[other_index]

            members, pairwise = compute_pairwise_debts(group.id)
            if pairwise[you.id][other.id] > 0:
                payer, payee, debt = you, other, pairwise[you.id][other.id]
            elif pairwise[other.id][you.id] > 0:
                payer, payee, debt = other, you, pairwise[other.id][you.id]
            else:
                raise CommandError(
                    f'Settlement setup is wrong: {you.email} and {other.email} '
                    f'owe each other nothing in {group_name!r}.'
                )

            amount = (debt * fraction).quantize(Decimal('0.01'))
            client = client_for(payer)
            response = client.post('/api/v1/settlements/', {
                'group': str(group.id),
                'payer': str(payer.id),
                'payee': str(payee.id),
                'amount': f'{amount:.2f}',
            }, format='json')
            if response.status_code != 201:
                raise CommandError(f'Could not settle up in {group_name!r}: {body_of(response)}')

            # Backdate to sit between the bills it is paying off, so the
            # Settlements tab is not just a row dated seconds after the bills.
            oldest = min(
                Bill.objects.filter(group=group).values_list('created_at', flat=True)
            )
            midpoint = oldest + (timezone.now() - oldest) / 2
            Settlement.objects.filter(pk=response.data['id']).update(settled_at=midpoint)
            count += 1
        return count

    def _create_pending_invite(self, group, invitee):
        """One unaccepted invite, so the AcceptInvite screen is reachable.

        Left pending on purpose: accepting it would add Dev to a group you are
        in, which is the exact case the Friends definition has to exclude.
        """
        client = client_for(group.created_by)
        response = client.post(f'/api/v1/groups/{group.id}/invite/',
                               {'email': invitee.email}, format='json')
        if response.status_code != 201:
            raise CommandError(f'Could not create the pending invite: {body_of(response)}')
        return response.data['token']

    # ----------------------------------------------------------------- report

    def _report(self, created, password):
        you = created['users'][0]
        groups = created['groups']

        self.stdout.write(self.style.SUCCESS('=' * 66))
        self.stdout.write(self.style.SUCCESS('Demo data ready.'))
        self.stdout.write(self.style.SUCCESS('=' * 66))
        self.stdout.write('')
        self.stdout.write(f'  {plural(len(USERS), "user")}, {plural(len(groups), "group")}, '
                          f'{plural(created["bills"], "bill")}, '
                          f'{plural(created["settlements"], "settlement")}')
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Sign in as'))
        self.stdout.write(f'  {you.email}')
        self.stdout.write(f'  {password}')
        self.stdout.write('')
        self.stdout.write('  Everyone else uses the same password. Index 6 is in no')
        self.stdout.write('  group with you, so Friends correctly does not list them.')
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Groups'))
        for name, group in groups.items():
            members = group.memberships.count()
            bills = Bill.objects.filter(group=group).count()
            note = ''
            members_list, pairwise = compute_pairwise_debts(group.id)
            nets = {
                m: sum(
                    (pairwise[o][m] - pairwise[m][o]) for o in members_list if o != m
                )
                for m in members_list
            }
            yours = nets.get(you.id, Decimal('0'))
            if bills == 0:
                note = '  <- no bills, empty states'
            elif all(v == 0 for v in nets.values()):
                note = '  <- settled up, "all square" state'
            else:
                sign = 'you owe ' if yours > 0 else ('you are owed ' if yours < 0 else 'you are even ')
                note = f'  <- {sign}{abs(yours):.2f}'
            self.stdout.write(f'  {FRONTEND}/groups/{group.id}')
            self.stdout.write(f'    {name[:60]}{"..." if len(name) > 60 else ""}')
            self.stdout.write(f'    {plural(members, "member")}, {plural(bills, "bill")}{note}')
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Other screens'))
        self.stdout.write(f'  {FRONTEND}/                dashboard')
        self.stdout.write(f'  {FRONTEND}/friends         5 co-members, not 6')
        self.stdout.write(f'  {FRONTEND}/accept-invite/{created["pending_token"]}')
        self.stdout.write(f'    pending invite for {USERS[6][1]}, not yet accepted')
        self.stdout.write('')

    # -------------------------------------------------------------- self-check

    def _self_check(self):
        """Reconcile the seed against itself before calling it usable.

        Without this, bad seed data is indistinguishable from a UI bug: the
        balances tab would just quietly show numbers that do not add up. These
        are the invariants that make the data meaningful.
        """
        failures = []

        for group in Group.objects.all():
            members = set(group.memberships.values_list('user_id', flat=True))

            # 1. No assignment to a non-member. The API already refuses these, so
            #    a failure here would mean something bypassed the API.
            for item in Item.objects.filter(bill__group=group):
                for assignment in item.assignments.all():
                    if assignment.user_id not in members:
                        failures.append(
                            f'{group.name}: {assignment.user.email} is assigned to '
                            f'"{item.name}" but is not a member'
                        )

            # 2. Item amounts sum to the bill total, and share amounts sum to
            #    the item amount. Exact, to the paisa.
            for bill in Bill.objects.filter(group=group):
                item_total = sum(
                    (i.amount for i in bill.items.all()), Decimal('0.00')
                )
                if item_total != bill.total_amount:
                    failures.append(
                        f'{group.name}/{bill.title}: items total {item_total} '
                        f'but bill total is {bill.total_amount}'
                    )
                for item in bill.items.all():
                    share_total = sum(
                        (a.share_amount for a in item.assignments.all()), Decimal('0.00')
                    )
                    if share_total != item.amount:
                        failures.append(
                            f'{group.name}/{bill.title}/{item.name}: shares total '
                            f'{share_total} but item is {item.amount}'
                        )

            # 3. Net positions sum to zero. Money neither appears nor vanishes.
            members_list, pairwise = compute_pairwise_debts(group.id)
            total_net = sum(
                sum(
                    (pairwise[o][m] - pairwise[m][o])
                    for o in members_list if o != m
                )
                for m in members_list
            )
            if total_net != 0:
                failures.append(f'{group.name}: net positions sum to {total_net}, not 0')

        # 4. Every assignment on every bill belongs to that bill's group.
        for bill in Bill.objects.all():
            member_ids = set(bill.group.memberships.values_list('user_id', flat=True))
            for item in bill.items.all():
                for assignment in item.assignments.all():
                    if assignment.user_id not in member_ids:
                        failures.append(
                            f'{bill.title}: assignment for a non-member of {bill.group.name}'
                        )

        # 5. The dashboard's own your_net agrees with the balances maths. This
        #    is the one that would catch a dashboard bug, not a seed bug.
        you = User.objects.filter(email=USERS[0][1]).first()
        if you:
            dashboard_net = Decimal('0.00')
            for group in Group.objects.filter(memberships__user=you).distinct():
                members_list, pairwise = compute_pairwise_debts(group.id)
                dashboard_net += sum(
                    (pairwise[o][you.id] - pairwise[you.id][o])
                    for o in members_list if o != you.id
                )
            expected = sum(
                Decimal(f'{v["your_net"]}')
                for v in self._dashboard_rows(you)
            )
            if dashboard_net != expected:
                failures.append(
                    f'your_net mismatch: balances maths says {dashboard_net:.2f}, '
                    f'dashboard rows say {expected:.2f}'
                )

        if failures:
            self.stdout.write(self.style.ERROR('Reconciliation FAILED:'))
            for failure in failures:
                self.stdout.write(self.style.ERROR(f'  - {failure}'))
            return False

        self.stdout.write(self.style.SUCCESS(
            'Reconciliation passed: item totals, share totals, membership and '
            'zero-sum balances all tie out, and your_net agrees across '
            'endpoints.'
        ))
        return True

    def _dashboard_rows(self, user):
        """The dashboard's group payloads, read back through the real view."""
        client = client_for(user)
        response = client.get('/api/v1/groups/')
        if response.status_code != 200:
            raise CommandError(f'Could not read the dashboard back: {body_of(response)}')
        return response.data
