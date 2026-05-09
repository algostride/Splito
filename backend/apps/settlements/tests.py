from decimal import Decimal
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
