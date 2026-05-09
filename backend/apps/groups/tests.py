from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
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
