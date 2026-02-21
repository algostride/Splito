from rest_framework import serializers
from .models import Settlement

class SettlementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Settlement
        fields = ['id', 'group', 'payer', 'payee', 'amount', 'settled_at']
        read_only_fields = ['id', 'settled_at']
