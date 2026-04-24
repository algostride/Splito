from rest_framework import generics, views, status
from rest_framework.response import Response
from apps.groups.models import Membership
from .models import Settlement
from .serializers import SettlementSerializer
from .services import compute_balances, compute_user_debts

class SettlementListCreateView(generics.ListCreateAPIView):
    serializer_class = SettlementSerializer

    def get_queryset(self):
        queryset = Settlement.objects.filter(group__memberships__user=self.request.user)
        group_id = self.request.query_params.get('group', None)
        if group_id is not None:
            queryset = queryset.filter(group_id=group_id)
        return queryset.order_by('-settled_at').distinct()

class SettlementDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = SettlementSerializer

    def get_queryset(self):
        return Settlement.objects.filter(group__memberships__user=self.request.user).distinct()

class BalanceView(views.APIView):
    def get(self, request):
        group_id = request.query_params.get('group')
        if not group_id:
            return Response({'error': 'group query parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

        if not Membership.objects.filter(group_id=group_id, user=request.user).exists():
            return Response({'error': 'Not a member of this group'}, status=status.HTTP_403_FORBIDDEN)

        balances = compute_balances(group_id)
        return Response(balances)


class UserDebtsView(views.APIView):
    def get(self, request):
        group_id = request.query_params.get('group')
        if not group_id:
            return Response({'error': 'group query parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

        if not Membership.objects.filter(group_id=group_id, user=request.user).exists():
            return Response({'error': 'Not a member of this group'}, status=status.HTTP_403_FORBIDDEN)

        debts = compute_user_debts(group_id)
        return Response(debts)
