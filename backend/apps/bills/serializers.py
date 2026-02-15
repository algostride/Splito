from rest_framework import serializers
from django.db import transaction
from .models import Bill, Item, ItemAssignment
from apps.accounts.serializers import UserSerializer

class ItemAssignmentSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField()

    class Meta:
        model = ItemAssignment
        fields = ['id', 'user_id', 'share_amount']

class ItemSerializer(serializers.ModelSerializer):
    assignments = ItemAssignmentSerializer(many=True)

    class Meta:
        model = Item
        fields = ['id', 'name', 'amount', 'assignments']

class BillSerializer(serializers.ModelSerializer):
    items = ItemSerializer(many=True)

    class Meta:
        model = Bill
        fields = ['id', 'group', 'title', 'total_amount', 'currency', 'created_by', 'created_at', 'items']
        read_only_fields = ['id', 'created_by', 'created_at']

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        user = self.context['request'].user
        bill = Bill.objects.create(created_by=user, **validated_data)
        
        for item_data in items_data:
            assignments_data = item_data.pop('assignments')
            item = Item.objects.create(bill=bill, **item_data)
            
            for assignment_data in assignments_data:
                ItemAssignment.objects.create(item=item, **assignment_data)
        
        return bill
