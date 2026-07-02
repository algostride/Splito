import json
from decimal import Decimal
from pathlib import Path
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.groups.models import Group, Membership
from apps.bills.models import Bill, Item, ItemAssignment
from apps.settlements.models import Settlement

User = get_user_model()


class SettlementTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            email='alice@example.com', name='Alice', password='pass12345'
        )
        self.user2 = User.objects.create_user(
            email='bob@example.com', name='Bob', password='pass12345'
        )
        self.group = Group.objects.create(name='Test Group', created_by=self.user1)
        Membership.objects.create(user=self.user1, group=self.group)
        Membership.objects.create(user=self.user2, group=self.group)
        self.client.force_authenticate(user=self.user1)

    def test_create_settlement(self):
        response = self.client.post(
            '/api/v1/settlements/',
            {
                'group': str(self.group.id),
                'payer': str(self.user1.id),
                'payee': str(self.user2.id),
                'amount': '50.00',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(response.data['amount']), Decimal('50.00'))

    def test_settlement_payer_eq_payee(self):
        response = self.client.post(
            '/api/v1/settlements/',
            {
                'group': str(self.group.id),
                'payer': str(self.user1.id),
                'payee': str(self.user1.id),
                'amount': '50.00',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_settlement_non_member(self):
        outsider = User.objects.create_user(
            email='outsider@example.com', name='Outsider', password='pass12345'
        )
        response = self.client.post(
            '/api/v1/settlements/',
            {
                'group': str(self.group.id),
                'payer': str(self.user1.id),
                'payee': str(outsider.id),
                'amount': '50.00',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_settlement(self):
        settlement = Settlement.objects.create(
            group=self.group, payer=self.user1, payee=self.user2,
            amount=Decimal('50.00')
        )
        response = self.client.delete(f'/api/v1/settlements/{settlement.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Settlement.objects.filter(id=settlement.id).exists())


class BalanceTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            email='alice@example.com', name='Alice', password='pass12345'
        )
        self.user2 = User.objects.create_user(
            email='bob@example.com', name='Bob', password='pass12345'
        )
        self.user3 = User.objects.create_user(
            email='charlie@example.com', name='Charlie', password='pass12345'
        )
        self.group = Group.objects.create(name='Test Group', created_by=self.user1)
        Membership.objects.create(user=self.user1, group=self.group)
        Membership.objects.create(user=self.user2, group=self.group)
        Membership.objects.create(user=self.user3, group=self.group)
        self.client.force_authenticate(user=self.user1)

    def test_balance_two_users_split_evenly(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Dinner', total_amount=Decimal('100.00'), currency='INR'
        )
        item = Item.objects.create(bill=bill, name='Dinner', amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item, user=self.user1, share_amount=Decimal('50.00'))
        ItemAssignment.objects.create(item=item, user=self.user2, share_amount=Decimal('50.00'))

        response = self.client.get(f'/api/v1/settlements/balances/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        balances = {str(b['user_id']): Decimal(b['net_balance']) for b in response.data}
        self.assertEqual(balances[str(self.user1.id)], Decimal('50.00'))
        self.assertEqual(balances[str(self.user2.id)], Decimal('-50.00'))

    def test_balance_three_users_multiple_bills(self):
        bill1 = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Bill 1', total_amount=Decimal('300.00'), currency='INR'
        )
        item1 = Item.objects.create(bill=bill1, name='Item1', amount=Decimal('300.00'))
        ItemAssignment.objects.create(item=item1, user=self.user1, share_amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item1, user=self.user2, share_amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item1, user=self.user3, share_amount=Decimal('100.00'))

        bill2 = Bill.objects.create(
            group=self.group, created_by=self.user2, paid_by=self.user2,
            title='Bill 2', total_amount=Decimal('150.00'), currency='INR'
        )
        item2 = Item.objects.create(bill=bill2, name='Item2', amount=Decimal('150.00'))
        ItemAssignment.objects.create(item=item2, user=self.user1, share_amount=Decimal('75.00'))
        ItemAssignment.objects.create(item=item2, user=self.user2, share_amount=Decimal('0.00'))
        ItemAssignment.objects.create(item=item2, user=self.user3, share_amount=Decimal('75.00'))

        response = self.client.get(f'/api/v1/settlements/balances/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        balances = {str(b['user_id']): Decimal(b['net_balance']) for b in response.data}
        self.assertEqual(balances[str(self.user1.id)], Decimal('125.00'))
        self.assertEqual(balances[str(self.user2.id)], Decimal('50.00'))
        self.assertEqual(balances[str(self.user3.id)], Decimal('-175.00'))

    def test_balance_after_full_settlement(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Dinner', total_amount=Decimal('100.00'), currency='INR'
        )
        item = Item.objects.create(bill=bill, name='Dinner', amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item, user=self.user1, share_amount=Decimal('50.00'))
        ItemAssignment.objects.create(item=item, user=self.user2, share_amount=Decimal('50.00'))

        Settlement.objects.create(
            group=self.group, payer=self.user2, payee=self.user1,
            amount=Decimal('50.00')
        )

        response = self.client.get(f'/api/v1/settlements/balances/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        balances = {str(b['user_id']): Decimal(b['net_balance']) for b in response.data}
        self.assertEqual(balances[str(self.user1.id)], Decimal('0.00'))
        self.assertEqual(balances[str(self.user2.id)], Decimal('0.00'))

    def test_balance_uneven_split(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Uneven Bill', total_amount=Decimal('100.00'), currency='INR'
        )
        item = Item.objects.create(bill=bill, name='Item', amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item, user=self.user1, share_amount=Decimal('60.00'))
        ItemAssignment.objects.create(item=item, user=self.user2, share_amount=Decimal('40.00'))

        response = self.client.get(f'/api/v1/settlements/balances/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        balances = {str(b['user_id']): Decimal(b['net_balance']) for b in response.data}
        self.assertEqual(balances[str(self.user1.id)], Decimal('40.00'))
        self.assertEqual(balances[str(self.user2.id)], Decimal('-40.00'))

    def test_balance_share_based_split(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Share Bill', total_amount=Decimal('300.00'), currency='INR'
        )
        item = Item.objects.create(bill=bill, name='Item', amount=Decimal('300.00'))
        ItemAssignment.objects.create(item=item, user=self.user1, share_amount=Decimal('200.00'))
        ItemAssignment.objects.create(item=item, user=self.user2, share_amount=Decimal('100.00'))

        response = self.client.get(f'/api/v1/settlements/balances/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        balances = {str(b['user_id']): Decimal(b['net_balance']) for b in response.data}
        self.assertEqual(balances[str(self.user1.id)], Decimal('100.00'))
        self.assertEqual(balances[str(self.user2.id)], Decimal('-100.00'))


class DebtTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            email='alice@example.com', name='Alice', password='pass12345'
        )
        self.user2 = User.objects.create_user(
            email='bob@example.com', name='Bob', password='pass12345'
        )
        self.user3 = User.objects.create_user(
            email='charlie@example.com', name='Charlie', password='pass12345'
        )
        self.group = Group.objects.create(name='Test Group', created_by=self.user1)
        Membership.objects.create(user=self.user1, group=self.group)
        Membership.objects.create(user=self.user2, group=self.group)
        Membership.objects.create(user=self.user3, group=self.group)
        self.client.force_authenticate(user=self.user1)

    def test_debts_two_users(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Dinner', total_amount=Decimal('100.00'), currency='INR'
        )
        item = Item.objects.create(bill=bill, name='Dinner', amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item, user=self.user1, share_amount=Decimal('50.00'))
        ItemAssignment.objects.create(item=item, user=self.user2, share_amount=Decimal('50.00'))

        response = self.client.get(f'/api/v1/settlements/debts/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        debts = {d['user_id']: d for d in response.data}
        alice = debts[str(self.user1.id)]
        bob = debts[str(self.user2.id)]

        self.assertEqual(Decimal(alice['net_balance']), Decimal('50.00'))
        self.assertEqual(Decimal(bob['net_balance']), Decimal('-50.00'))
        self.assertEqual(len(alice['gets_from']), 1)
        self.assertEqual(alice['gets_from'][0]['user_id'], str(self.user2.id))
        self.assertEqual(Decimal(alice['gets_from'][0]['amount']), Decimal('50.00'))

    def test_debts_three_users_circular(self):
        bill1 = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Bill 1', total_amount=Decimal('300.00'), currency='INR'
        )
        item1 = Item.objects.create(bill=bill1, name='Item1', amount=Decimal('300.00'))
        ItemAssignment.objects.create(item=item1, user=self.user1, share_amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item1, user=self.user2, share_amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item1, user=self.user3, share_amount=Decimal('100.00'))

        bill2 = Bill.objects.create(
            group=self.group, created_by=self.user2, paid_by=self.user2,
            title='Bill 2', total_amount=Decimal('300.00'), currency='INR'
        )
        item2 = Item.objects.create(bill=bill2, name='Item2', amount=Decimal('300.00'))
        ItemAssignment.objects.create(item=item2, user=self.user1, share_amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item2, user=self.user2, share_amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item2, user=self.user3, share_amount=Decimal('100.00'))

        bill3 = Bill.objects.create(
            group=self.group, created_by=self.user3, paid_by=self.user3,
            title='Bill 3', total_amount=Decimal('300.00'), currency='INR'
        )
        item3 = Item.objects.create(bill=bill3, name='Item3', amount=Decimal('300.00'))
        ItemAssignment.objects.create(item=item3, user=self.user1, share_amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item3, user=self.user2, share_amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item3, user=self.user3, share_amount=Decimal('100.00'))

        response = self.client.get(f'/api/v1/settlements/debts/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        for user_data in response.data:
            self.assertEqual(Decimal(user_data['net_balance']), Decimal('0.00'))
            self.assertEqual(len(user_data['owes']), 0)
            self.assertEqual(len(user_data['gets_from']), 0)

    def test_debts_after_partial_settlement(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Dinner', total_amount=Decimal('100.00'), currency='INR'
        )
        item = Item.objects.create(bill=bill, name='Dinner', amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item, user=self.user1, share_amount=Decimal('50.00'))
        ItemAssignment.objects.create(item=item, user=self.user2, share_amount=Decimal('50.00'))

        Settlement.objects.create(
            group=self.group, payer=self.user2, payee=self.user1,
            amount=Decimal('25.00')
        )

        response = self.client.get(f'/api/v1/settlements/debts/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        debts = {d['user_id']: d for d in response.data}
        bob = debts[str(self.user2.id)]
        self.assertEqual(Decimal(bob['net_balance']), Decimal('-25.00'))
        self.assertEqual(len(bob['owes']), 1)
        self.assertEqual(Decimal(bob['owes'][0]['amount']), Decimal('25.00'))

    def test_debts_uneven_split(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Uneven Bill', total_amount=Decimal('100.00'), currency='INR'
        )
        item = Item.objects.create(bill=bill, name='Item', amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item, user=self.user1, share_amount=Decimal('60.00'))
        ItemAssignment.objects.create(item=item, user=self.user2, share_amount=Decimal('40.00'))

        response = self.client.get(f'/api/v1/settlements/debts/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        debts = {d['user_id']: d for d in response.data}
        alice = debts[str(self.user1.id)]
        bob = debts[str(self.user2.id)]

        self.assertEqual(Decimal(alice['net_balance']), Decimal('40.00'))
        self.assertEqual(Decimal(bob['net_balance']), Decimal('-40.00'))
        self.assertEqual(len(alice['gets_from']), 1)
        self.assertEqual(alice['gets_from'][0]['user_id'], str(self.user2.id))
        self.assertEqual(Decimal(alice['gets_from'][0]['amount']), Decimal('40.00'))
        self.assertEqual(len(bob['owes']), 1)
        self.assertEqual(Decimal(bob['owes'][0]['amount']), Decimal('40.00'))

    def test_debts_payer_not_assigned(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Solo Bill', total_amount=Decimal('100.00'), currency='INR'
        )
        item = Item.objects.create(bill=bill, name='Item', amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item, user=self.user2, share_amount=Decimal('100.00'))

        response = self.client.get(f'/api/v1/settlements/debts/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        debts = {d['user_id']: d for d in response.data}
        alice = debts[str(self.user1.id)]
        bob = debts[str(self.user2.id)]

        self.assertEqual(Decimal(alice['net_balance']), Decimal('100.00'))
        self.assertEqual(Decimal(bob['net_balance']), Decimal('-100.00'))
        self.assertEqual(len(alice['gets_from']), 1)
        self.assertEqual(alice['gets_from'][0]['user_id'], str(self.user2.id))
        self.assertEqual(Decimal(alice['gets_from'][0]['amount']), Decimal('100.00'))
        self.assertEqual(len(bob['owes']), 1)
        self.assertEqual(Decimal(bob['owes'][0]['amount']), Decimal('100.00'))

    def test_balances_always_net_to_zero(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Dinner', total_amount=Decimal('1000.00'), currency='INR'
        )
        item = Item.objects.create(bill=bill, name='Dinner', amount=Decimal('1000.00'))
        ItemAssignment.objects.create(item=item, user=self.user2, share_amount=Decimal('333.33'))
        ItemAssignment.objects.create(item=item, user=self.user3, share_amount=Decimal('333.33'))
        ItemAssignment.objects.create(item=item, user=self.user1, share_amount=Decimal('333.34'))

        response = self.client.get(f'/api/v1/settlements/balances/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        total = sum(Decimal(b['net_balance']) for b in response.data)
        self.assertEqual(total, Decimal('0.00'))

    def test_deleting_a_settled_bill_stops_the_phantom_debt(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Dinner', total_amount=Decimal('100.00'), currency='INR'
        )
        item = Item.objects.create(bill=bill, name='Dinner', amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item, user=self.user1, share_amount=Decimal('50.00'))
        ItemAssignment.objects.create(item=item, user=self.user2, share_amount=Decimal('50.00'))

        Settlement.objects.create(
            group=self.group, payer=self.user2, payee=self.user1, amount=Decimal('50.00')
        )
        before = self.client.get(f'/api/v1/settlements/balances/?group={self.group.id}')
        self.assertEqual(sum(Decimal(b['net_balance']) for b in before.data), Decimal('0.00'))

        bill.delete()

        after = self.client.get(f'/api/v1/settlements/balances/?group={self.group.id}')
        self.assertEqual(sum(Decimal(b['net_balance']) for b in after.data), Decimal('0.00'))
        for entry in after.data:
            self.assertEqual(Decimal(entry['net_balance']), Decimal('0.00'))

    def test_over_settling_is_clamped_and_cannot_create_credit(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Dinner', total_amount=Decimal('100.00'), currency='INR'
        )
        item = Item.objects.create(bill=bill, name='Dinner', amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item, user=self.user1, share_amount=Decimal('50.00'))
        ItemAssignment.objects.create(item=item, user=self.user2, share_amount=Decimal('50.00'))

        Settlement.objects.create(
            group=self.group, payer=self.user2, payee=self.user1, amount=Decimal('999.00')
        )

        balances = self.client.get(f'/api/v1/settlements/balances/?group={self.group.id}').data
        debts = self.client.get(f'/api/v1/settlements/debts/?group={self.group.id}').data
        by_id = {d['user_id']: d for d in debts}
        self.assertEqual(
            Decimal(by_id[str(self.user1.id)]['net_balance']),
            Decimal(next(b['net_balance'] for b in balances if b['user_id'] == str(self.user1.id))),
        )
        for entry in balances:
            self.assertEqual(Decimal(entry['net_balance']), Decimal('0.00'))
        for entry in debts:
            self.assertEqual(entry['owes'], [])
            self.assertEqual(entry['gets_from'], [])


class FriendsTests(APITestCase):
    """Friendship is derived from co-membership: no Friend model, no list."""

    URL = '/api/v1/settlements/friends/'

    def setUp(self):
        self.alice = User.objects.create_user(
            email='alice@example.com', name='Alice', password='pass12345'
        )
        self.bob = User.objects.create_user(
            email='bob@example.com', name='Bob', password='pass12345'
        )
        self.cara = User.objects.create_user(
            email='cara@example.com', name='Cara', password='pass12345'
        )
        self.client.force_authenticate(user=self.alice)

    def add(self, group_name, *users):
        group = Group.objects.create(name=group_name, created_by=self.alice)
        for user in users:
            Membership.objects.create(user=user, group=group)
        return group

    def bill(self, group, payer, amount, shares):
        """A bill where each member owes `amount / len(shares)` to the payer."""
        bill = Bill.objects.create(
            group=group, created_by=self.alice, paid_by=payer, title='Shared',
            total_amount=amount, currency='INR',
        )
        item = Item.objects.create(bill=bill, name='Shared', amount=amount)
        per = amount / len(shares)
        for user in shares:
            ItemAssignment.objects.create(item=item, user=user, share_amount=per)
        return bill

    def test_co_membership_is_the_whole_definition(self):
        self.add('Flat 302', self.alice, self.bob)
        self.add('Weekend', self.alice, self.cara)
        names = [f['name'] for f in self.client.get(self.URL).data]
        self.assertEqual(sorted(names), ['Bob', 'Cara'])

    def test_you_are_not_your_own_friend(self):
        self.add('Solo', self.alice)
        self.assertEqual(self.client.get(self.URL).data, [])

    def test_user_with_no_groups_gets_an_empty_list(self):
        self.assertEqual(self.client.get(self.URL).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(self.URL).data, [])

    def test_shares_a_group_in_three_places_appears_once(self):
        self.add('Flat 302', self.alice, self.bob)
        self.add('Weekend', self.alice, self.bob)
        self.add('Ski', self.alice, self.bob)
        data = self.client.get(self.URL).data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['shared_group_count'], 3)
        self.assertEqual(len(data[0]['shared_groups']), 3)

    def test_shared_group_count_includes_groups_with_no_balance(self):
        # The mock counted only the groups with a non-zero figure, so a friend
        # you shared three groups with but owed nothing in two read as
        # "1 group in common". The label says groups in common, so it counts
        # all of them, while per_group stays short.
        flat = self.add('Flat 302', self.alice, self.bob)
        self.add('Weekend', self.alice, self.bob)
        self.bill(flat, self.bob, Decimal('90.00'), [self.alice, self.bob])
        data = self.client.get(self.URL).data[0]
        self.assertEqual(data['shared_group_count'], 2)
        self.assertEqual(len(data['per_group']), 1)

    def test_total_is_the_sum_of_the_per_group_figures(self):
        flat = self.add('Flat 302', self.alice, self.bob)
        trip = self.add('Trip', self.alice, self.bob)
        self.bill(flat, self.bob, Decimal('90.00'), [self.alice, self.bob])
        self.bill(trip, self.alice, Decimal('40.00'), [self.alice, self.bob])
        data = self.client.get(self.URL).data[0]
        summed = sum(Decimal(row['net']) for row in data['per_group'])
        self.assertEqual(Decimal(data['total']), summed)
        # Bob paid 45 of the flat bill (so Alice owes him 45), then Alice paid
        # 20 of the trip (so Bob owes her 20). Net: Alice is 25 behind.
        self.assertEqual(data['total'], '-25.00')

    def test_per_group_figures_sum_to_my_net_for_that_group(self):
        # A friend's figure is *my* position with them, not their net, so it
        # cannot be compared to a row of /balances/ directly. The invariant that
        # does hold: my group net is exactly the sum of my positions with
        # everyone else in it. This catches a sign or scope error in the
        # aggregation that a two-member fixture would hide.
        flat = self.add('Flat 302', self.alice, self.bob, self.cara)
        trip = self.add('Trip', self.alice, self.bob, self.cara)
        self.bill(flat, self.cara, Decimal('90.00'), [self.alice, self.bob, self.cara])
        self.bill(trip, self.alice, Decimal('60.00'), [self.alice, self.bob, self.cara])

        balances = self.client.get(
            f'/api/v1/settlements/balances/?group={flat.id}'
        ).data
        alice_net = next(
            Decimal(row['net_balance']) for row in balances if row['user_name'] == 'Alice'
        )
        summed = sum(
            Decimal(row['net'])
            for friend in self.client.get(self.URL).data
            for row in friend['per_group']
            if row['group_id'] == str(flat.id)
        )
        self.assertEqual(summed, alice_net)

    def test_settling_in_full_zeroes_the_position(self):
        flat = self.add('Flat 302', self.alice, self.bob)
        self.bill(flat, self.bob, Decimal('90.00'), [self.alice, self.bob])
        self.assertEqual(self.client.get(self.URL).data[0]['total'], '-45.00')
        # Alice owes Bob, so Alice is the payer here.
        Settlement.objects.create(
            group=flat, payer=self.alice, payee=self.bob, amount=Decimal('45.00')
        )
        data = self.client.get(self.URL).data[0]
        self.assertEqual(data['total'], '0.00')
        self.assertEqual(data['per_group'], [])
        # Still a friend: the relationship is the shared group, not the debt.
        self.assertEqual(data['shared_group_count'], 1)

    def test_email_is_included(self):
        self.add('Flat 302', self.alice, self.bob)
        self.assertEqual(self.client.get(self.URL).data[0]['email'], 'bob@example.com')

    def test_sorted_by_name(self):
        self.add('Flat 302', self.alice, self.cara, self.bob)
        names = [f['name'] for f in self.client.get(self.URL).data]
        self.assertEqual(names, sorted(names, key=str.lower))

    def test_a_non_member_never_leaks_a_group(self):
        # Carol is in a group Alice is not. Her name must not appear at all,
        # and no group she belongs to may be named in the response.
        self.add('Flat 302', self.alice, self.bob)
        self.add('Secret', self.bob, self.cara)
        raw = str(self.client.get(self.URL).data)
        self.assertNotIn('Cara', raw)
        self.assertNotIn('Secret', raw)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        self.assertIn(
            self.client.get(self.URL).status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )


class ApiShapeContractTests(APITestCase):
    """Keeps the E2E fixtures from becoming fiction.

    The Playwright suite stubs the API from frontend/e2e/fixtures/data.js. A
    stub cannot notice that the backend changed shape, so this asserts the real
    DRF responses against api-shapes.json at the repo root — the same file the
    fixtures are built from. Rename a serializer field and this fails.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        path = Path(__file__).resolve().parents[3] / 'api-shapes.json'
        if not path.exists():
            raise AssertionError(f'contract file missing: {path}')
        cls.shapes = json.loads(path.read_text())['shapes']

    def assertShape(self, payload, shape_name):
        expected = set(self.shapes[shape_name])
        actual = set(payload)
        self.assertEqual(
            actual, expected,
            f'{shape_name} drifted from api-shapes.json. '
            f'missing: {sorted(expected - actual)}  unexpected: {sorted(actual - expected)}',
        )

    def setUp(self):
        self.alice = User.objects.create_user(
            email='alice@example.com', name='Alice', password='pass12345'
        )
        self.bob = User.objects.create_user(
            email='bob@example.com', name='Bob', password='pass12345'
        )
        self.group = Group.objects.create(name='Flat 302', created_by=self.alice)
        Membership.objects.create(user=self.alice, group=self.group)
        Membership.objects.create(user=self.bob, group=self.group)
        self.client.force_authenticate(user=self.alice)

        bill = Bill.objects.create(
            group=self.group, created_by=self.alice, paid_by=self.bob, title='Groceries',
            total_amount=Decimal('90.00'), currency='INR',
        )
        item = Item.objects.create(bill=bill, name='Groceries', amount=Decimal('90.00'))
        for user in (self.alice, self.bob):
            ItemAssignment.objects.create(item=item, user=user, share_amount=Decimal('45.00'))

    def test_groups_list(self):
        rows = self.client.get('/api/v1/groups/').data
        self.assertShape(rows[0], 'groups_list_item')

    def test_group_detail(self):
        rows = self.client.get(f'/api/v1/groups/{self.group.id}/').data
        self.assertShape(rows, 'group_detail')

    def test_group_members(self):
        rows = self.client.get(f'/api/v1/groups/{self.group.id}/members/').data
        self.assertShape(rows[0], 'membership_item')
        self.assertShape(rows[0]['user'], 'user_basic')

    def test_bills_list(self):
        rows = self.client.get(f'/api/v1/bills/?group={self.group.id}').data
        self.assertShape(rows[0], 'bill_item')
        self.assertShape(rows[0]['items'][0], 'bill_detail_item')
        self.assertShape(rows[0]['items'][0]['assignments'][0], 'item_assignments_item')
        self.assertShape(rows[0]['paid_by_detail'], 'user_full')
        self.assertShape(rows[0]['created_by'], 'user_full')

    def test_debts(self):
        rows = self.client.get(
            f'/api/v1/settlements/debts/?group={self.group.id}'
        ).data
        self.assertShape(rows[0], 'user_debts_item')
        self.assertShape(rows[0]['owes'][0], 'user_debts_leg')

    def test_settlements_list(self):
        Settlement.objects.create(
            group=self.group, payer=self.bob, payee=self.alice, amount=Decimal('10.00')
        )
        rows = self.client.get(f'/api/v1/settlements/?group={self.group.id}').data
        self.assertShape(rows[0], 'settlement_item')

    def test_friends(self):
        rows = self.client.get('/api/v1/settlements/friends/').data
        self.assertShape(rows[0], 'friend_item')
        self.assertShape(rows[0]['shared_groups'][0], 'friend_shared_group')

    def test_every_declared_shape_is_covered_by_this_class(self):
        # A shape nobody asserts against is a shape that can drift unnoticed.
        self.assertEqual(
            set(self.shapes) - {'bill_detail_item'},
            {
                'groups_list_item', 'group_detail', 'user_basic', 'membership_item',
                'bill_item', 'item_assignments_item', 'user_debts_item',
                'settlement_item', 'friend_item', 'friend_shared_group',
                'friend_per_group', 'user_debts_leg', 'user_full',
            },
            'a new shape was added to api-shapes.json without a test asserting it',
        )
