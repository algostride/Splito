from rest_framework import generics, views, status
from rest_framework.response import Response
from .models import Settlement
from .serializers import SettlementSerializer
from .services import compute_balances

class SettlementListCreateView(generics.ListCreateAPIView):
    serializer_class = SettlementSerializer

    def get_queryset(self):
        queryset = Settlement.objects.filter(group__memberships__user=self.request.user)
        group_id = self.request.query_params.get('group', None)
        if group_id is not None:
            queryset = queryset.filter(group_id=group_id)
        return queryset

class BalanceView(views.APIView):
    def get(self, request):
        group_id = request.query_params.get('group')
        if not group_id:
            return Response({'error': 'group query parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        balances = compute_balances(group_id)
        return Response({'balances': balances})
