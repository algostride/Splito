from rest_framework import serializers
from decimal import Decimal
from .models import Settlement
from apps.groups.models import Membership

class SettlementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Settlement
        fields = ['id', 'group', 'payer', 'payee', 'amount', 'settled_at']
        read_only_fields = ['id', 'settled_at']

    def validate(self, data):
        payer = data.get('payer')
        payee = data.get('payee')
        group = data.get('group')
        amount = data.get('amount')

        if payer == payee:
            raise serializers.ValidationError("Payer and payee must be different.")

        if amount is not None and amount <= Decimal('0'):
            raise serializers.ValidationError("Amount must be positive.")

        if group:
            request = self.context.get('request')
            user = getattr(request, 'user', None)
            if user is not None and not user.is_authenticated:
                raise serializers.ValidationError("You must be logged in.")
            if not Membership.objects.filter(group=group, user=user).exists():
                raise serializers.ValidationError("You are not a member of this group.")
            if not Membership.objects.filter(group=group, user=payer).exists():
                raise serializers.ValidationError("Payer is not a member of this group.")
            if not Membership.objects.filter(group=group, user=payee).exists():
                raise serializers.ValidationError("Payee is not a member of this group.")

        return data
