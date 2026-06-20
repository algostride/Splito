from rest_framework.test import APITestCase
from rest_framework import status
from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from decimal import Decimal
import importlib
from apps.groups.models import Group, Membership
from apps.bills.models import Bill, Item, ItemAssignment
from apps.settlements.models import Settlement

User = get_user_model()

backfill = importlib.import_module(
    'apps.bills.migrations.0004_bill_bill_type_and_split_fields'
).backfill_split_fields


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

    def test_list_is_ordered_newest_first(self):
        """Bills must come back reverse-chronologically, not in insertion order.

        Without an explicit order_by, Postgres returns physical order, which
        only looks correct while every bill shares a timestamp. Backdated or
        edited bills then land in positions that contradict the dates rendered
        beside them, so the ordering is pinned here.
        """
        from datetime import timedelta
        from django.utils import timezone

        now = timezone.now()
        titles = ['oldest', 'newest', 'middle']
        for offset, title in zip((30, 0, 14), titles):
            bill = Bill.objects.create(
                group=self.group,
                title=title,
                total_amount=Decimal('10.00'),
                currency='INR',
                bill_type='simple',
                created_by=self.user1,
                paid_by=self.user1,
            )
            # auto_now_add ignores the value passed to create(), so backdate
            # after the fact.
            Bill.objects.filter(pk=bill.pk).update(created_at=now - timedelta(days=offset))

        response = self.client.get(f'/api/v1/bills/?group={self.group.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [b['title'] for b in response.data],
            ['newest', 'middle', 'oldest'],
            'bills must be listed newest first',
        )

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

    def _percent_payload(self, percents, total='1000.00'):
        return {
            'group': str(self.group.id),
            'title': 'Precision Split',
            'total_amount': total,
            'currency': 'INR',
            'bill_type': 'compound',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': 'Item',
                    'amount': total,
                    'split_mode': 'percent',
                    'assignments': [
                        {'user_id': str(user.id), 'split_value': str(pct)}
                        for user, pct in zip([self.user1, self.user2, self.user3], percents)
                    ],
                }
            ],
        }

    def test_percent_split_value_derives_money(self):
        response = self.client.post(
            '/api/v1/bills/', self._percent_payload(['33.333', '33.333', '33.334']), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        assignments = response.data['items'][0]['assignments']
        amounts = sorted(float(a['share_amount']) for a in assignments)
        self.assertEqual(amounts, [333.33, 333.33, 333.34])
        self.assertEqual(response.data['items'][0]['split_mode'], 'percent')
        self.assertEqual(response.data['bill_type'], 'compound')
        for assignment in assignments:
            self.assertIsNotNone(assignment['split_value'])

    def test_percent_split_survives_a_re_save(self):
        """The regression: editing a bill must not redistribute the split."""
        created = self.client.post(
            '/api/v1/bills/', self._percent_payload(['33.333', '33.333', '33.334']), format='json'
        )
        bill_id = created.data['id']
        before = sorted(float(a['share_amount']) for a in created.data['items'][0]['assignments'])

        payload = self._percent_payload(['33.333', '33.333', '33.334'])
        payload['title'] = 'Renamed'
        response = self.client.put(f'/api/v1/bills/{bill_id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        after = sorted(float(a['share_amount']) for a in response.data['items'][0]['assignments'])
        self.assertEqual(before, after)

    def test_percent_split_summing_to_100_absorbs_the_remainder(self):
        """Weights that cover 100% exactly must conserve the money.

        Each member's paise is derived independently, so a 1000.00 item split
        33.334/33.333/33.333 needs the leftover paise handed to a member with
        the largest fractional remainder instead of summing to 999.99.
        """
        response = self.client.post(
            '/api/v1/bills/', self._percent_payload(['33.334', '33.333', '33.333']), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        amounts = [Decimal(a['share_amount']) for a in response.data['items'][0]['assignments']]
        self.assertEqual(sum(amounts), Decimal('1000.00'))
        self.assertEqual(sorted(amounts), [Decimal('333.33'), Decimal('333.33'), Decimal('333.34')])

    def test_three_way_split_of_ten_sums_exactly(self):
        """The classic failure: 10.00 split three ways must still total 10.00."""
        payload = {
            'group': str(self.group.id),
            'title': 'Dinner',
            'total_amount': '10.00',
            'currency': 'INR',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': 'Dinner',
                    'amount': '10.00',
                    'split_mode': 'shares',
                    'assignments': [
                        {'user_id': str(self.user1.id), 'split_value': '1'},
                        {'user_id': str(self.user2.id), 'split_value': '1'},
                        {'user_id': str(self.user3.id), 'split_value': '1'},
                    ],
                }
            ],
        }
        response = self.client.post('/api/v1/bills/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        amounts = [Decimal(a['share_amount']) for a in response.data['items'][0]['assignments']]
        self.assertEqual(sum(amounts), Decimal('10.00'))
        self.assertEqual(sorted(amounts), [Decimal('3.33'), Decimal('3.33'), Decimal('3.34')])

    def test_negative_split_value_is_rejected(self):
        response = self.client.post(
            '/api/v1/bills/', self._percent_payload(['150', '-50', '0']), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_shares_split_value_derives_money(self):
        payload = {
            'group': str(self.group.id),
            'title': 'Shares Split',
            'total_amount': '600.00',
            'currency': 'INR',
            'bill_type': 'simple',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': 'Shares Split',
                    'amount': '600.00',
                    'split_mode': 'shares',
                    'assignments': [
                        {'user_id': str(self.user1.id), 'split_value': '3'},
                        {'user_id': str(self.user2.id), 'split_value': '2'},
                        {'user_id': str(self.user3.id), 'split_value': '1'},
                    ],
                }
            ],
        }
        response = self.client.post('/api/v1/bills/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        assignments = response.data['items'][0]['assignments']
        self.assertEqual(response.data['bill_type'], 'simple')
        self.assertEqual(
            sorted(float(a['share_amount']) for a in assignments), [100.0, 200.0, 300.0]
        )

    def test_split_fields_survive_a_round_trip_read(self):
        created = self.client.post(
            '/api/v1/bills/', self._percent_payload(['50', '50'], total='100.00'), format='json'
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        fetched = self.client.get(f"/api/v1/bills/{created.data['id']}/")
        self.assertEqual(fetched.status_code, status.HTTP_200_OK)
        self.assertEqual(fetched.data['bill_type'], 'compound')
        self.assertEqual(fetched.data['items'][0]['split_mode'], 'percent')
        self.assertEqual(
            sorted(float(a['split_value']) for a in fetched.data['items'][0]['assignments']),
            [50.0, 50.0],
        )

    def test_backfill_recovers_type_and_percent_split(self):
        """Existing rows must not have their money split altered by migration."""
        simple = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Dinner', total_amount='100.00', currency='INR', bill_type='compound',
        )
        simple_item = Item.objects.create(bill=simple, name='Dinner', amount='100.00', split_mode='shares')
        ItemAssignment.objects.create(item=simple_item, user=self.user1, share_amount='60.00', split_value=None)
        ItemAssignment.objects.create(item=simple_item, user=self.user2, share_amount='40.00', split_value=None)

        compound = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Party', total_amount='1000.00', currency='INR', bill_type='simple',
        )
        compound_item = Item.objects.create(bill=compound, name='Food', amount='1000.00', split_mode='shares')
        for user, share in [(self.user1, '333.33'), (self.user2, '333.33'), (self.user3, '333.34')]:
            ItemAssignment.objects.create(item=compound_item, user=user, share_amount=share, split_value=None)

        backfill(django_apps, None)

        simple.refresh_from_db()
        compound.refresh_from_db()
        simple_item.refresh_from_db()
        compound_item.refresh_from_db()
        self.assertEqual(simple.bill_type, 'simple')
        self.assertEqual(compound.bill_type, 'compound')
        self.assertEqual(simple_item.split_mode, 'percent')
        self.assertEqual(compound_item.split_mode, 'percent')

        recovered = {
            (str(a.item_id), str(a.user_id)): a.split_value
            for a in ItemAssignment.objects.filter(item__in=[simple_item, compound_item])
        }
        self.assertEqual(recovered[(str(simple_item.id), str(self.user1.id))], Decimal('60.000000'))
        self.assertEqual(recovered[(str(simple_item.id), str(self.user2.id))], Decimal('40.000000'))
        self.assertEqual(recovered[(str(compound_item.id), str(self.user3.id))], Decimal('33.334000'))
        # The money itself is untouched, and the derived percents still sum right.
        self.assertEqual(
            sum(Decimal(a.share_amount) for a in compound_item.assignments.all()),
            Decimal('1000.00'),
        )

    def _make_bill(self, creator, title='Bill', total='100.00', items=True):
        bill = Bill.objects.create(
            group=self.group, created_by=creator, paid_by=creator,
            title=title, total_amount=total, currency='INR', bill_type='compound',
        )
        if items:
            item = Item.objects.create(bill=bill, name=title, amount=total)
            ItemAssignment.objects.create(
                item=item, user=creator, share_amount=total, split_value=Decimal('100.000000')
            )
        return bill

    def test_non_member_cannot_create_a_settlement_in_a_group(self):
        outsider = User.objects.create_user(
            email='mallory@example.com', name='Mallory', password='pass12345'
        )
        self.client.force_authenticate(user=outsider)
        response = self.client.post('/api/v1/settlements/', {
            'group': str(self.group.id),
            'payer': str(self.user2.id),
            'payee': str(self.user1.id),
            'amount': '500.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Settlement.objects.count(), 0)

    def test_non_member_cannot_read_a_bill(self):
        outsider = User.objects.create_user(
            email='mallory@example.com', name='Mallory', password='pass12345'
        )
        bill = self._make_bill(self.user1)
        self.client.force_authenticate(user=outsider)
        self.assertEqual(self.client.get(f'/api/v1/bills/{bill.id}/').status_code, status.HTTP_404_NOT_FOUND)

    def test_member_cannot_delete_another_members_bill(self):
        bill = self._make_bill(self.user1)
        self.client.force_authenticate(user=self.user2)
        response = self.client.delete(f'/api/v1/bills/{bill.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Bill.objects.filter(id=bill.id).exists())

    def test_creator_can_delete_their_own_bill(self):
        bill = self._make_bill(self.user1)
        self.client.force_authenticate(user=self.user1)
        self.assertEqual(self.client.delete(f'/api/v1/bills/{bill.id}/').status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Bill.objects.filter(id=bill.id).exists())

    def test_patch_items_only_cannot_assign_a_non_member(self):
        outsider = User.objects.create_user(
            email='mallory@example.com', name='Mallory', password='pass12345'
        )
        bill = self._make_bill(self.user1)
        self.client.force_authenticate(user=self.user1)
        response = self.client.patch(f'/api/v1/bills/{bill.id}/', {
            'items': [{
                'name': 'Item',
                'amount': '100.00',
                'assignments': [{'user_id': str(outsider.id), 'split_value': '100'}],
            }],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_items_only_cannot_break_the_sum(self):
        bill = self._make_bill(self.user1)
        self.client.force_authenticate(user=self.user1)
        response = self.client.patch(f'/api/v1/bills/{bill.id}/', {
            'items': [{
                'name': 'Item',
                'amount': '100.00',
                'assignments': [
                    {'user_id': str(self.user1.id), 'share_amount': '70.00'},
                    {'user_id': str(self.user2.id), 'share_amount': '20.00'},
                ],
            }],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_cannot_move_a_bill_to_another_group(self):
        other = Group.objects.create(name='Other', created_by=self.user2)
        bill = self._make_bill(self.user1)
        self.client.force_authenticate(user=self.user1)
        response = self.client.patch(f'/api/v1/bills/{bill.id}/', {'group': str(other.id)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        bill.refresh_from_db()
        self.assertEqual(bill.group_id, self.group.id)

    def test_patch_paid_by_to_a_non_member_is_rejected(self):
        outsider = User.objects.create_user(
            email='mallory@example.com', name='Mallory', password='pass12345'
        )
        bill = self._make_bill(self.user1)
        self.client.force_authenticate(user=self.user1)
        response = self.client.patch(f'/api/v1/bills/{bill.id}/', {'paid_by': str(outsider.id)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_malformed_group_query_param_is_a_400(self):
        self.client.force_authenticate(user=self.user1)
        self.assertEqual(
            self.client.get('/api/v1/bills/?group=not-a-uuid').status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.get('/api/v1/settlements/?group=not-a-uuid').status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_under_specified_percent_split_is_rejected(self):
        """60/30 leaves a rupee unaccounted for; it must not be rescaled."""
        response = self.client.post(
            '/api/v1/bills/', self._percent_payload(['60', '30', '0'], total='100.00'), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_over_specified_percent_split_is_rejected(self):
        response = self.client.post(
            '/api/v1/bills/', self._percent_payload(['60', '50', '0'], total='100.00'), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_even_percent_split_from_the_split_evenly_button_saves(self):
        """What evenPercents() produces for 3 people must be accepted."""
        response = self.client.post(
            '/api/v1/bills/', self._percent_payload(['33.33', '33.33', '33.34']), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        amounts = [Decimal(a['share_amount']) for a in response.data['items'][0]['assignments']]
        self.assertEqual(sum(amounts), Decimal('1000.00'))

    def test_even_shares_split_on_a_rupee_total_saves(self):
        payload = {
            'group': str(self.group.id),
            'title': 'Odd Total',
            'total_amount': '7.00',
            'currency': 'INR',
            'paid_by': str(self.user1.id),
            'items': [{
                'name': 'Odd Total',
                'amount': '7.00',
                'split_mode': 'shares',
                'assignments': [
                    {'user_id': str(u.id), 'split_value': '1'}
                    for u in (self.user1, self.user2, self.user3)
                ],
            }],
        }
        response = self.client.post('/api/v1/bills/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        amounts = sorted(Decimal(a['share_amount']) for a in response.data['items'][0]['assignments'])
        self.assertEqual(sum(amounts), Decimal('7.00'))
        self.assertEqual(amounts, [Decimal('2.33'), Decimal('2.33'), Decimal('2.34')])

    def test_update_cannot_change_a_bills_type(self):
        """Editing picks the form from the stored type, so it must not move."""
        bill = Bill.objects.create(
            group=self.group, created_by=self.user1, paid_by=self.user1,
            title='Compound', total_amount=Decimal('150.00'), currency='INR', bill_type='compound',
        )
        for name, amount in (('Food', '100.00'), ('Tax', '50.00')):
            item = Item.objects.create(bill=bill, name=name, amount=Decimal(amount))
            ItemAssignment.objects.create(
                item=item, user=self.user1, share_amount=Decimal(amount), split_value=Decimal('100.000000')
            )

        payload = {
            'group': str(self.group.id),
            'title': 'Compound',
            'total_amount': '150.00',
            'currency': 'INR',
            'bill_type': 'simple',
            'paid_by': str(self.user1.id),
            'items': [
                {
                    'name': name,
                    'amount': amount,
                    'split_mode': 'percent',
                    'assignments': [
                        {'user_id': str(self.user1.id), 'share_amount': amount, 'split_value': '100'}
                    ],
                }
                for name, amount in (('Food', '100.00'), ('Tax', '50.00'))
            ],
        }
        response = self.client.put(f'/api/v1/bills/{bill.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bill.refresh_from_db()
        self.assertEqual(bill.bill_type, 'compound')
        self.assertEqual(bill.items.count(), 2)
