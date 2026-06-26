from rest_framework import generics, views, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from uuid import UUID
from apps.groups.models import Group, Membership
from apps.bills.views import filter_by_group_param
from .models import Settlement
from .serializers import SettlementSerializer
from .services import (
    ZERO,
    compute_balances,
    compute_friend_positions,
    compute_user_debts,
)

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


class FriendsListView(views.APIView):
    """Everyone who shares a group with the requester.

    Friendship here is derived, not stored: co-membership is the entire
    definition. There is no Friend model, so there is nothing to add, accept or
    revoke, and leaving a group quietly stops you being friends with the people
    in it. That is the trade for having no list that can go stale.

    The positions come from the same pairwise matrix as `/balances/` and
    `/debts/`, so a total here always agrees with the figure on that group's
    page. Seven queries regardless of how many friends or bills are involved.
    """

    def get(self, request):
        user = request.user
        my_group_ids = list(
            Membership.objects.filter(user=user).values_list('group_id', flat=True)
        )
        if not my_group_ids:
            return Response([])

        group_names = dict(
            Group.objects.filter(id__in=my_group_ids).values_list('id', 'name')
        )

        # One query for every co-membership, with the user loaded. Someone in
        # three of my groups appears once, with all three recorded.
        shared = {}
        for membership in (
            Membership.objects.filter(group_id__in=my_group_ids)
            .exclude(user=user)
            .select_related('user')
        ):
            entry = shared.setdefault(
                membership.user_id, {'user': membership.user, 'group_ids': []}
            )
            entry['group_ids'].append(membership.group_id)

        positions = compute_friend_positions(my_group_ids, user.id)

        friends = []
        for friend_id, info in shared.items():
            position = positions.get(friend_id, {'total': ZERO, 'per_group': {}})
            friends.append({
                'user_id': str(friend_id),
                'name': info['user'].name,
                'email': info['user'].email,
                'shared_groups': sorted(
                    (
                        {'id': str(gid), 'name': group_names.get(gid, '')}
                        for gid in info['group_ids']
                    ),
                    key=lambda row: row['name'].lower(),
                ),
                # Counts every group you share, not only the ones with a
                # balance. The mock counted the latter, so a friend you shared
                # three groups with but owed nothing in two read as "1 group in
                # common", which is not what the label claims.
                'shared_group_count': len(info['group_ids']),
                'total': f"{position['total']:.2f}",
                'per_group': sorted(
                    (
                        {
                            'group_id': str(gid),
                            'group_name': group_names.get(gid, ''),
                            'net': f"{net:.2f}",
                        }
                        for gid, net in position['per_group'].items()
                    ),
                    key=lambda row: row['group_name'].lower(),
                ),
            })

        friends.sort(key=lambda friend: (friend['name'] or '').lower())
        return Response(friends)
