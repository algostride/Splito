from decimal import Decimal
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from apps.bills.models import Bill, Item, ItemAssignment
from apps.settlements.models import Settlement
from apps.groups.models import Group, Membership, GroupInvite

User = get_user_model()


class GroupTests(APITestCase):
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
        self.client.force_authenticate(user=self.user1)

    def test_create_group(self):
        response = self.client.post(
            '/api/v1/groups/', {'name': 'Test Group'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Test Group')
        group_id = response.data['id']
        self.assertTrue(
            Membership.objects.filter(group_id=group_id, user=self.user1).exists()
        )

    def test_list_groups_only_own(self):
        group = Group.objects.create(name='My Group', created_by=self.user1)
        Membership.objects.create(user=self.user1, group=group)
        other_group = Group.objects.create(name='Other Group', created_by=self.user2)
        Membership.objects.create(user=self.user2, group=other_group)

        response = self.client.get('/api/v1/groups/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], str(group.id))

    def test_group_members(self):
        group = Group.objects.create(name='Test Group', created_by=self.user1)
        Membership.objects.create(user=self.user1, group=group)
        Membership.objects.create(user=self.user2, group=group)

        response = self.client.get(f'/api/v1/groups/{group.id}/members/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        member_emails = {m['user']['email'] for m in response.data}
        self.assertIn('alice@example.com', member_emails)
        self.assertIn('bob@example.com', member_emails)

    def test_invite_member(self):
        group = Group.objects.create(name='Test Group', created_by=self.user1)
        Membership.objects.create(user=self.user1, group=group)

        response = self.client.post(
            f'/api/v1/groups/{group.id}/invite/',
            {'email': 'bob@example.com'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', response.data)
        self.assertTrue(
            GroupInvite.objects.filter(
                group=group, email='bob@example.com'
            ).exists()
        )

    def test_accept_invite_success(self):
        group = Group.objects.create(name='Test Group', created_by=self.user1)
        Membership.objects.create(user=self.user1, group=group)
        invite = GroupInvite.objects.create(
            group=group, invited_by=self.user1, email='bob@example.com', token='test-token'
        )

        self.client.force_authenticate(user=self.user2)
        response = self.client.post(f'/api/v1/groups/accept-invite/test-token/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            Membership.objects.filter(group=group, user=self.user2).exists()
        )
        invite.refresh_from_db()
        self.assertIsNotNone(invite.accepted_at)

    def test_accept_invite_wrong_email(self):
        group = Group.objects.create(name='Test Group', created_by=self.user1)
        Membership.objects.create(user=self.user1, group=group)
        GroupInvite.objects.create(
            group=group, invited_by=self.user1, email='bob@example.com', token='test-token'
        )

        self.client.force_authenticate(user=self.user3)
        response = self.client.post(f'/api/v1/groups/accept-invite/test-token/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            Membership.objects.filter(group=group, user=self.user3).exists()
        )


class GroupSummaryFieldsTests(APITestCase):
    """The dashboard columns: member_count, total_spend, your_net."""

    def setUp(self):
        self.alice = User.objects.create_user(
            email='alice@example.com', name='Alice', password='pass12345'
        )
        self.bob = User.objects.create_user(
            email='bob@example.com', name='Bob', password='pass12345'
        )
        self.client.force_authenticate(user=self.alice)

        self.group = Group.objects.create(name='Flat 302', created_by=self.alice)
        Membership.objects.create(group=self.group, user=self.alice)
        Membership.objects.create(group=self.group, user=self.bob)

        # Bob pays 100; Alice's share of 50 means Alice owes Bob 50.00.
        bill = Bill.objects.create(
            group=self.group, created_by=self.alice, paid_by=self.bob,
            title='Dinner', total_amount=Decimal('100.00'), currency='INR',
        )
        item = Item.objects.create(bill=bill, name='Dinner', amount=Decimal('100.00'))
        ItemAssignment.objects.create(item=item, user=self.alice, share_amount=Decimal('50.00'))
        ItemAssignment.objects.create(item=item, user=self.bob, share_amount=Decimal('50.00'))

    def test_list_includes_summary_fields(self):
        response = self.client.get('/api/v1/groups/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data[0]
        self.assertEqual(row['member_count'], 2)
        self.assertEqual(row['total_spend'], '100.00')
        # Alice owes Bob half the bill.
        self.assertEqual(row['your_net'], '-50.00')

    def test_your_net_is_from_the_requesting_users_point_of_view(self):
        self.client.force_authenticate(user=self.bob)
        row = self.client.get('/api/v1/groups/').data[0]
        self.assertEqual(row['your_net'], '50.00')

    def test_member_count_is_not_clamped_to_the_requesting_user(self):
        # A group with four members reports four, not one. Counting through the
        # same join used to filter on would report 1 for every group.
        carol = User.objects.create_user(
            email='carol@example.com', name='Carol', password='pass12345'
        )
        dave = User.objects.create_user(
            email='dave@example.com', name='Dave', password='pass12345'
        )
        Membership.objects.create(group=self.group, user=carol)
        Membership.objects.create(group=self.group, user=dave)
        self.assertEqual(
            self.client.get('/api/v1/groups/').data[0]['member_count'], 4
        )

    def test_group_with_no_bills_reports_zeroes(self):
        empty = Group.objects.create(name='Empty', created_by=self.alice)
        Membership.objects.create(group=empty, user=self.alice)
        row = next(
            r for r in self.client.get('/api/v1/groups/').data if r['id'] == str(empty.id)
        )
        self.assertEqual(row['total_spend'], '0.00')
        self.assertEqual(row['your_net'], '0.00')
        self.assertEqual(row['member_count'], 1)

    def test_your_net_accounts_for_settlements(self):
        Settlement.objects.create(
            group=self.group, payer=self.bob, payee=self.alice, amount=Decimal('20.00')
        )
        row = self.client.get('/api/v1/groups/').data[0]
        # 20.00 of the 50.00 debt settled, so 30.00 remains.
        self.assertEqual(row['your_net'], '-30.00')

    def test_detail_includes_summary_fields(self):
        response = self.client.get(f'/api/v1/groups/{self.group.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['member_count'], 2)
        self.assertEqual(response.data['total_spend'], '100.00')
        self.assertEqual(response.data['your_net'], '-50.00')

    def test_list_query_count_does_not_grow_with_group_count(self):
        # The point of compute_user_nets is that the batched loader issues a
        # fixed number of queries, so the dashboard does not degrade into one
        # query per group. One group vs four must cost the same. Both cases
        # need the same number of bills, otherwise this would be measuring the
        # per-bill query rather than the per-group one.
        with CaptureQueriesContext(connection) as one:
            self.client.get('/api/v1/groups/')
        one_count = len(one.captured_queries)

        for i in range(3):
            extra = Group.objects.create(name=f'Extra {i}', created_by=self.alice)
            Membership.objects.create(group=extra, user=self.alice)
            Membership.objects.create(group=extra, user=self.bob)
            bill = Bill.objects.create(
                group=extra, created_by=self.alice, paid_by=self.bob,
                title=f'Lunch {i}', total_amount=Decimal('40.00'), currency='INR',
            )
            item = Item.objects.create(bill=bill, name='Lunch', amount=Decimal('40.00'))
            ItemAssignment.objects.create(
                item=item, user=self.alice, share_amount=Decimal('20.00')
            )
            ItemAssignment.objects.create(
                item=item, user=self.bob, share_amount=Decimal('20.00')
            )

        with CaptureQueriesContext(connection) as four:
            response = self.client.get('/api/v1/groups/')
        four_count = len(four.captured_queries)

        self.assertEqual(len(response.data), 4)
        self.assertEqual(
            one_count, four_count,
            f'query count grew with group count: 1 group = {one_count}, 4 groups = {four_count}',
        )
