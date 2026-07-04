import secrets
from decimal import Decimal
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.db.models import DecimalField
from django.shortcuts import get_object_or_404
from django.utils import timezone
from apps.bills.models import Bill
from apps.settlements.services import compute_user_nets
from .models import Group, Membership, GroupInvite
from .serializers import GroupSerializer, MembershipSerializer, GroupInviteSerializer

def annotated_groups_for(user):
    """The groups a user belongs to, with the dashboard columns annotated.

    `id__in=<queryset>` is used rather than `memberships__user=user` on purpose.
    Filtering through the reverse relation adds a join, and annotating
    `Count('memberships')` on that same join would count only the rows that
    survived the filter, so every group would report a member count of 1. As a
    subquery there is no join to interfere with.

    `total_spend` is a correlated subquery so it is summed in the database
    rather than by looping bills in Python.
    """
    my_groups = Membership.objects.filter(user=user).values('group_id')
    return (
        Group.objects.filter(id__in=my_groups)
        .select_related('created_by')
        .annotate(
            member_count=Count('memberships', distinct=True),
            total_spend=Coalesce(
                Subquery(
                    Bill.objects.filter(group=OuterRef('pk'))
                    .values('group')
                    .annotate(total=Sum('total_amount'))
                    .values('total')
                ),
                Value(Decimal('0.00')),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
        )
        .order_by('created_at')
    )

class GroupListCreateView(generics.ListCreateAPIView):
    serializer_class = GroupSerializer

    def get_queryset(self):
        return annotated_groups_for(self.request.user)

    def list(self, request, *args, **kwargs):
        # One batched pass for the signed-in user's net in every group, rather
        # than a query per group. Skipped on create, which is why the base
        # list() is still what does the responding.
        self._user_nets = compute_user_nets(
            list(self.get_queryset().values_list('id', flat=True)), request.user.id
        )
        return super().list(request, *args, **kwargs)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['user_nets'] = getattr(self, '_user_nets', None)
        return context

class GroupDetailView(generics.RetrieveAPIView):
    serializer_class = GroupSerializer

    def get_queryset(self):
        return annotated_groups_for(self.request.user)

    def retrieve(self, request, *args, **kwargs):
        self._user_nets = compute_user_nets([kwargs['pk']], request.user.id)
        return super().retrieve(request, *args, **kwargs)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['user_nets'] = getattr(self, '_user_nets', None)
        return context

class GroupMembersView(generics.ListAPIView):
    serializer_class = MembershipSerializer

    def get_queryset(self):
        group_id = self.kwargs['pk']
        # Ensure user is part of the group
        if Group.objects.filter(id=group_id, memberships__user=self.request.user).exists():
            return Membership.objects.filter(group_id=group_id)
        return Membership.objects.none()

class InviteMemberView(APIView):
    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk, memberships__user=request.user)
        serializer = GroupInviteSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            token = secrets.token_urlsafe(32)
            GroupInvite.objects.create(
                group=group,
                invited_by=request.user,
                email=email,
                token=token
            )
            return Response({'token': token}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AcceptInviteView(APIView):
    def post(self, request, token):
        try:
            invite = GroupInvite.objects.get(token=token, accepted_at__isnull=True)
        except GroupInvite.DoesNotExist:
            return Response({'error': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.email != invite.email:
            return Response({'error': 'This invite is not for your email'}, status=status.HTTP_403_FORBIDDEN)

        if Membership.objects.filter(group=invite.group, user=request.user).exists():
            return Response({'error': 'Already a member'}, status=status.HTTP_400_BAD_REQUEST)

        Membership.objects.create(group=invite.group, user=request.user)
        invite.accepted_at = timezone.now()
        invite.save()

        return Response({'message': 'Successfully joined the group'}, status=status.HTTP_200_OK)
