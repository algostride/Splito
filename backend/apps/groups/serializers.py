from rest_framework import serializers
from decimal import Decimal
from django.db.models import Sum
from django.contrib.auth import get_user_model
from .models import Group, Membership, GroupInvite

User = get_user_model()

class UserBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name']
        read_only_fields = ['id', 'email', 'name']

class MembershipSerializer(serializers.ModelSerializer):
    user = UserBasicSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ['id', 'user', 'joined_at']
        read_only_fields = ['id', 'user', 'joined_at']

class GroupSerializer(serializers.ModelSerializer):
    """Group summary for the dashboard.

    `member_count` and `total_spend` are read off queryset annotations, which
    the view always applies. The fallbacks exist so the serializer still works
    on an unannotated queryset, and they cost one query each only in that case.

    `your_net` is the signed-in user's net position in the group, as a string
    like "120.00" so it matches what the balances endpoints already return. It
    cannot be a database annotation: it is derived from the pairwise debt
    matrix, so it comes in through the serializer context instead, batched
    across every group in the response rather than computed per group.
    """
    created_by = UserBasicSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()
    total_spend = serializers.SerializerMethodField()
    your_net = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            'id', 'name', 'created_by', 'created_at',
            'member_count', 'total_spend', 'your_net',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_member_count(self, obj):
        value = getattr(obj, 'member_count', None)
        return obj.memberships.count() if value is None else value

    def get_total_spend(self, obj):
        value = getattr(obj, 'total_spend', None)
        if value is None:
            # Unannotated queryset: one query, and only if the view did not
            # annotate. Both group views do.
            value = obj.bills.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        return f"{value:.2f}"

    def get_your_net(self, obj):
        nets = self.context.get('user_nets')
        if nets is None:
            return '0.00'
        return nets.get(obj.id, '0.00')

    def create(self, validated_data):
        # The user creating the group is set in views.py
        user = self.context['request'].user
        group = Group.objects.create(created_by=user, **validated_data)
        # Create membership for the creator
        Membership.objects.create(user=user, group=group)
        return group

class GroupInviteSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupInvite
        fields = ['email']
