from rest_framework import serializers
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.contrib.auth import get_user_model
from .models import Bill, Item, ItemAssignment
from apps.accounts.serializers import UserSerializer

User = get_user_model()

class UserBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name']

class ItemAssignmentSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField()
    user = UserBasicSerializer(read_only=True)

    class Meta:
        model = ItemAssignment
        fields = ['id', 'user_id', 'user', 'share_amount', 'split_value']
        read_only_fields = ['id']
        extra_kwargs = {
            'share_amount': {'required': False},
            'split_value': {'required': False, 'allow_null': True},
        }

class ItemSerializer(serializers.ModelSerializer):
    assignments = ItemAssignmentSerializer(many=True)

    class Meta:
        model = Item
        fields = ['id', 'name', 'amount', 'split_mode', 'assignments']
        read_only_fields = ['id']
        extra_kwargs = {'split_mode': {'required': False}}

class BillSerializer(serializers.ModelSerializer):
    items = ItemSerializer(many=True)
    created_by = UserSerializer(read_only=True)
    paid_by = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    paid_by_detail = UserSerializer(source='paid_by', read_only=True)

    class Meta:
        model = Bill
        fields = ['id', 'group', 'title', 'total_amount', 'currency', 'bill_type', 'created_by', 'paid_by', 'paid_by_detail', 'created_at', 'items']
        read_only_fields = ['id', 'created_by', 'created_at']
        extra_kwargs = {'bill_type': {'required': False}}

    def _allocate(self, amount, weights, basis=None):
        """Split `amount` across `weights` in whole paise, exactly.

        Flooring each share independently and rounding the total would let a
        3-way split of 10.00 become 3.33 x 3 = 9.99, which the sum check then
        rejects. Flooring and handing the leftover paise to the largest
        fractional remainders keeps the allocation exact by construction.

        `basis` is the denominator: the sum of the weights in shares mode
        (3/2/1 is relative), or 100 in percent mode (60/30 means 60% and 30% of
        the item, and stays short rather than being rescaled to 66.7/33.3).

        Only a real rounding residual is handed out. A larger shortfall means
        the weights do not cover the item and is left in place, so the caller's
        sum check reports the split as invalid.
        """
        total = basis if basis is not None else sum(weights)
        if total <= 0:
            return None

        amount_paise = int((amount * 100).to_integral_value(rounding=ROUND_HALF_UP))
        exact = [(w * amount_paise) / total for w in weights]
        base = [int(v // 1) for v in exact]
        leftover = amount_paise - sum(base)

        if 0 < leftover < len(weights):
            order = sorted(range(len(weights)), key=lambda i: exact[i] - base[i], reverse=True)
            for k in range(leftover):
                base[order[k]] += 1

        return [Decimal(p) / Decimal(100) for p in base]

    def _resolve_shares(self, item_data):
        """Turn per-member split_value into money, falling back to share_amount.

        Returns a list of assignment dicts carrying a resolved share_amount.
        Clients that only know the monetary split (older clients, the test
        suite) keep working untouched.
        """
        split_mode = item_data.get('split_mode') or Item.SPLIT_MODE_SHARES
        assignments = item_data.get('assignments', [])
        raw = [a.get('split_value') for a in assignments]

        shares = None
        if assignments and not any(v is None for v in raw):
            if any(Decimal(str(v)) < 0 for v in raw):
                raise serializers.ValidationError(
                    f"Item '{item_data.get('name', '')}' has a negative split value."
                )
            amount = Decimal(str(item_data['amount']))
            weights = [Decimal(str(v)) for v in raw]
            if split_mode == Item.SPLIT_MODE_PERCENT:
                shares = self._allocate(amount, weights, basis=Decimal('100'))
            else:
                shares = self._allocate(amount, weights)

        if shares is None:
            for assignment in assignments:
                if assignment.get('share_amount') is None:
                    raise serializers.ValidationError(
                        f"Item '{item_data.get('name', '')}' needs a share_amount or a split_value per member."
                    )
            return assignments

        resolved = []
        for assignment, share in zip(assignments, shares):
            entry = dict(assignment)
            entry['share_amount'] = share.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            resolved.append(entry)
        return resolved

    def validate(self, data):
        """Guard each field against the data actually present.

        Keying these checks off `group and items_data` together meant a PATCH
        carrying only `items` skipped all of them, letting a share be assigned
        to a non-member and leaving shares that don't sum to the item amount.
        """
        from apps.groups.models import Membership

        request = self.context.get('request')
        user = getattr(request, 'user', None)
        items_data = data.get('items', None)
        if items_data is None and self.instance is None:
            items_data = self.initial_data.get('items', [])

        group = data.get('group') or getattr(self.instance, 'group', None)

        if group is not None and user is not None and user.is_authenticated:
            if not Membership.objects.filter(group=group, user=user).exists():
                raise serializers.ValidationError("You are not a member of this group.")
        elif group is not None:
            raise serializers.ValidationError("You must be logged in to modify a bill.")

        if group is not None:
            member_ids = set(Membership.objects.filter(group=group).values_list('user_id', flat=True))

            paid_by = data.get('paid_by')
            if paid_by is not None and paid_by.id not in member_ids:
                raise serializers.ValidationError("paid_by user is not a member of this group.")

            if items_data is not None:
                for item_data in items_data:
                    for assignment in item_data.get('assignments', []):
                        if assignment.get('user_id') not in member_ids:
                            raise serializers.ValidationError(
                                f"User {assignment.get('user_id')} is not a member of this group."
                            )

        if items_data:
            total_amount = data.get('total_amount')
            if total_amount is None and self.instance is not None:
                total_amount = self.instance.total_amount

            if total_amount is not None:
                total_amount = Decimal(str(total_amount))
                items_total = Decimal('0.00')

                for item_data in items_data:
                    item_amount = Decimal(str(item_data['amount']))
                    assignments = self._resolve_shares(item_data)
                    shares_total = sum(Decimal(str(a['share_amount'])) for a in assignments)

                    if shares_total != item_amount:
                        raise serializers.ValidationError(
                            f"Item '{item_data.get('name', '')}' shares ({shares_total}) don't sum to item amount ({item_amount})."
                        )
                    items_total += item_amount

                if items_total != total_amount:
                    raise serializers.ValidationError(
                        f"Sum of item amounts ({items_total}) doesn't match total bill amount ({total_amount})."
                    )

        return data

    def _write_items(self, bill, items_data):
        for item_data in items_data:
            assignments_data = self._resolve_shares(item_data)
            fields = {key: value for key, value in item_data.items() if key != 'assignments'}
            item = Item.objects.create(bill=bill, **fields)

            for assignment_data in assignments_data:
                ItemAssignment.objects.create(item=item, **assignment_data)

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        user = self.context['request'].user
        paid_by = validated_data.pop('paid_by', None) or user
        bill = Bill.objects.create(created_by=user, paid_by=paid_by, **validated_data)
        self._write_items(bill, items_data)
        return bill

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)

        # A bill's type is fixed at creation. The edit form is chosen from the
        # stored value, so accepting a change here could only mislabel the bill
        # -- and flipping a multi-item bill to 'simple' would have the next
        # edit truncate it to items[0].
        validated_data.pop('bill_type', None)

        paid_by = validated_data.pop('paid_by', None)
        if paid_by is not None:
            validated_data['paid_by'] = paid_by

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            self._write_items(instance, items_data)

        return instance
