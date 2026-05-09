from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.groups.models import Group, Membership
from apps.bills.models import Bill, Item, ItemAssignment

User = get_user_model()


class BillTests(APITestCase):
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

    def test_create_bill_simple(self):
        payload = {
            'group': str(self.group.id),
            'title': 'Dinner',
            'total_amount': '100.00',
            'currency': 'INR',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': 'Dinner',
                    'amount': '100.00',
                    'assignments': [
                        {'user_id': str(self.user1.id), 'share_amount': '50.00'},
                        {'user_id': str(self.user2.id), 'share_amount': '50.00'},
                    ],
                }
            ],
        }
        response = self.client.post('/api/v1/bills/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'Dinner')
        self.assertEqual(len(response.data['items']), 1)
        self.assertEqual(len(response.data['items'][0]['assignments']), 2)

    def test_create_bill_compound(self):
        payload = {
            'group': str(self.group.id),
            'title': 'Party',
            'total_amount': '300.00',
            'currency': 'INR',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': 'Food',
                    'amount': '200.00',
                    'assignments': [
                        {'user_id': str(self.user1.id), 'share_amount': '100.00'},
                        {'user_id': str(self.user2.id), 'share_amount': '100.00'},
                    ],
                },
                {
                    'name': 'Drinks',
                    'amount': '100.00',
                    'assignments': [
                        {'user_id': str(self.user1.id), 'share_amount': '33.34'},
                        {'user_id': str(self.user2.id), 'share_amount': '33.33'},
                        {'user_id': str(self.user3.id), 'share_amount': '33.33'},
                    ],
                },
            ],
        }
        response = self.client.post('/api/v1/bills/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['items']), 2)

    def test_bill_total_mismatch(self):
        payload = {
            'group': str(self.group.id),
            'title': 'Mismatch',
            'total_amount': '200.00',
            'currency': 'INR',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': 'Item',
                    'amount': '100.00',
                    'assignments': [
                        {'user_id': str(self.user1.id), 'share_amount': '100.00'},
                    ],
                }
            ],
        }
        response = self.client.post('/api/v1/bills/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bill_shares_mismatch(self):
        payload = {
            'group': str(self.group.id),
            'title': 'Mismatch',
            'total_amount': '100.00',
            'currency': 'INR',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': 'Item',
                    'amount': '100.00',
                    'assignments': [
                        {'user_id': str(self.user1.id), 'share_amount': '60.00'},
                        {'user_id': str(self.user2.id), 'share_amount': '30.00'},
                    ],
                }
            ],
        }
        response = self.client.post('/api/v1/bills/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bill_non_member_assignment(self):
        outsider = User.objects.create_user(
            email='outsider@example.com', name='Outsider', password='pass12345'
        )
        payload = {
            'group': str(self.group.id),
            'title': 'Bad Assignment',
            'total_amount': '100.00',
            'currency': 'INR',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': 'Item',
                    'amount': '100.00',
                    'assignments': [
                        {'user_id': str(outsider.id), 'share_amount': '100.00'},
                    ],
                }
            ],
        }
        response = self.client.post('/api/v1/bills/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_bills_filtered(self):
        Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Group Bill', total_amount='50.00', currency='INR'
        )
        other_group = Group.objects.create(name='Other', created_by=self.user2)
        Bill.objects.create(
            group=other_group, created_by=self.user2, paid_by=self.user2,
            title='Other Bill', total_amount='75.00', currency='INR'
        )

        response = self.client.get(f'/api/v1/bills/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Group Bill')

    def test_update_bill(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Old Title', total_amount='100.00', currency='INR'
        )
        Item.objects.create(bill=bill, name='Old Item', amount='100.00')

        payload = {
            'group': str(self.group.id),
            'title': 'New Title',
            'total_amount': '150.00',
            'currency': 'INR',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': 'New Item',
                    'amount': '150.00',
                    'assignments': [
                        {'user_id': str(self.user1.id), 'share_amount': '75.00'},
                        {'user_id': str(self.user2.id), 'share_amount': '75.00'},
                    ],
                }
            ],
        }
        response = self.client.put(
            f'/api/v1/bills/{bill.id}/', payload, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'New Title')
        self.assertEqual(len(response.data['items']), 1)
        self.assertEqual(response.data['items'][0]['name'], 'New Item')

    def test_create_bill_uneven_split(self):
        payload = {
            'group': str(self.group.id),
            'title': 'Uneven Split',
            'total_amount': '100.00',
            'currency': 'INR',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': 'Item',
                    'amount': '100.00',
                    'assignments': [
                        {'user_id': str(self.user1.id), 'share_amount': '60.00'},
                        {'user_id': str(self.user2.id), 'share_amount': '40.00'},
                    ],
                }
            ],
        }
        response = self.client.post('/api/v1/bills/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        assignments = response.data['items'][0]['assignments']
        alice_share = next(a for a in assignments if a['user_id'] == str(self.user1.id))
        bob_share = next(a for a in assignments if a['user_id'] == str(self.user2.id))
        self.assertEqual(float(alice_share['share_amount']), 60.0)
        self.assertEqual(float(bob_share['share_amount']), 40.0)

    def test_create_bill_share_based(self):
        payload = {
            'group': str(self.group.id),
            'title': 'Share Based',
            'total_amount': '300.00',
            'currency': 'INR',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': 'Item',
                    'amount': '300.00',
                    'assignments': [
                        {'user_id': str(self.user1.id), 'share_amount': '200.00'},
                        {'user_id': str(self.user2.id), 'share_amount': '100.00'},
                    ],
                }
            ],
        }
        response = self.client.post('/api/v1/bills/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        assignments = response.data['items'][0]['assignments']
        alice_share = next(a for a in assignments if a['user_id'] == str(self.user1.id))
        bob_share = next(a for a in assignments if a['user_id'] == str(self.user2.id))
        self.assertEqual(float(alice_share['share_amount']), 200.0)
        self.assertEqual(float(bob_share['share_amount']), 100.0)

    def test_create_bill_single_payer(self):
        payload = {
            'group': str(self.group.id),
            'title': 'Solo Bill',
            'total_amount': '100.00',
            'currency': 'INR',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': 'Item',
                    'amount': '100.00',
                    'assignments': [
                        {'user_id': str(self.user1.id), 'share_amount': '100.00'},
                    ],
                }
            ],
        }
        response = self.client.post('/api/v1/bills/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['items'][0]['assignments']), 1)

    def test_delete_bill(self):
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='To Delete', total_amount='50.00', currency='INR'
        )
        response = self.client.delete(f'/api/v1/bills/{bill.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Bill.objects.filter(id=bill.id).exists())
