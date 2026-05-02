from rest_framework import serializers
from decimal import Decimal
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
        fields = ['id', 'user_id', 'user', 'share_amount']

class ItemSerializer(serializers.ModelSerializer):
    assignments = ItemAssignmentSerializer(many=True)

    class Meta:
        model = Item
        fields = ['id', 'name', 'amount', 'assignments']

class BillSerializer(serializers.ModelSerializer):
    items = ItemSerializer(many=True)
    created_by = UserSerializer(read_only=True)
    paid_by = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    paid_by_detail = UserSerializer(source='paid_by', read_only=True)

    class Meta:
        model = Bill
        fields = ['id', 'group', 'title', 'total_amount', 'currency', 'created_by', 'paid_by', 'paid_by_detail', 'created_at', 'items']
        read_only_fields = ['id', 'created_by', 'created_at']

    def validate(self, data):
        items_data = data.get('items', self.initial_data.get('items', []))
        total_amount = data.get('total_amount', self.initial_data.get('total_amount'))

        if items_data and total_amount is not None:
            total_amount = Decimal(str(total_amount))
            items_total = Decimal('0.00')

            for item_data in items_data:
                item_amount = Decimal(str(item_data['amount']))
                assignments = item_data.get('assignments', [])
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

        group = data.get('group')
        if group and items_data:
            from apps.groups.models import Membership
            user = self.context['request'].user
            if not Membership.objects.filter(group=group, user=user).exists():
                raise serializers.ValidationError("You are not a member of this group.")

            member_ids = set(Membership.objects.filter(group=group).values_list('user_id', flat=True))
            paid_by = data.get('paid_by')
            if paid_by and paid_by.id not in member_ids:
                raise serializers.ValidationError("paid_by user is not a member of this group.")

            for item_data in items_data:
                for assignment in item_data.get('assignments', []):
                    if assignment.get('user_id') not in member_ids:
                        raise serializers.ValidationError(
                            f"User {assignment.get('user_id')} is not a member of this group."
                        )

        return data

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        user = self.context['request'].user
        paid_by = validated_data.pop('paid_by', None) or user
        bill = Bill.objects.create(created_by=user, paid_by=paid_by, **validated_data)

        for item_data in items_data:
            assignments_data = item_data.pop('assignments')
            item = Item.objects.create(bill=bill, **item_data)

            for assignment_data in assignments_data:
                ItemAssignment.objects.create(item=item, **assignment_data)

        return bill

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)

        paid_by = validated_data.pop('paid_by', None)
        if paid_by is not None:
            validated_data['paid_by'] = paid_by

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                assignments_data = item_data.pop('assignments')
                item = Item.objects.create(bill=instance, **item_data)
                for assignment_data in assignments_data:
                    ItemAssignment.objects.create(item=item, **assignment_data)

        return instance
