from rest_framework.test import APITestCase
from rest_framework import status
from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from decimal import Decimal
import importlib
from apps.groups.models import Group, Membership
from apps.bills.models import Bill, Item, ItemAssignment

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
