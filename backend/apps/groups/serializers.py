from rest_framework import serializers
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
    created_by = UserBasicSerializer(read_only=True)

    class Meta:
        model = Group
        fields = ['id', 'name', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']

    def create(self, validated_data):
        # The user creating the group is set in views.py
        user = self.context['request'].user
        group = Group.objects.create(created_by=user, **validated_data)
        # Create membership for the creator
        Membership.objects.create(user=user, group=group)
        return group
