from rest_framework import generics, views, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from uuid import UUID
from apps.groups.models import Membership
from apps.bills.views import filter_by_group_param
from .models import Settlement
from .serializers import SettlementSerializer
from .services import compute_balances, compute_user_debts

class SettlementListCreateView(generics.ListCreateAPIView):
    serializer_class = SettlementSerializer

    def get_queryset(self):
        queryset = Settlement.objects.filter(group__memberships__user=self.request.user)
        queryset = filter_by_group_param(queryset, self.request)
        return queryset.order_by('-settled_at').distinct()

class SettlementDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = SettlementSerializer

    def get_queryset(self):
        return Settlement.objects.filter(
            group__memberships__user=self.request.user
        ).select_related('group', 'payer', 'payee').distinct()

    def perform_destroy(self, instance):
        is_owner = (
            instance.payer_id == self.request.user.id
            or instance.group.created_by_id == self.request.user.id
        )
        if not is_owner:
            raise PermissionDenied("Only the payer or the group owner can delete a settlement.")
        instance.delete()


def _parse_group_id(request):
    group_id = request.query_params.get('group')
    if not group_id:
        return None, Response({'error': 'group query parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        UUID(str(group_id))
    except (ValueError, AttributeError, TypeError):
        return None, Response({'error': 'group must be a valid id'}, status=status.HTTP_400_BAD_REQUEST)
    if not Membership.objects.filter(group_id=group_id, user=request.user).exists():
        return None, Response({'error': 'Not a member of this group'}, status=status.HTTP_403_FORBIDDEN)
    return group_id, None


class BalanceView(views.APIView):
    def get(self, request):
        group_id, error = _parse_group_id(request)
        if error:
            return error
        return Response(compute_balances(group_id))


class UserDebtsView(views.APIView):
    def get(self, request):
        group_id, error = _parse_group_id(request)
        if error:
            return error
        return Response(compute_user_debts(group_id))
