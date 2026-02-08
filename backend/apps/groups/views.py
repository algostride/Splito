import secrets
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Group, Membership, GroupInvite
from .serializers import GroupSerializer, MembershipSerializer, GroupInviteSerializer

class GroupListCreateView(generics.ListCreateAPIView):
    serializer_class = GroupSerializer

    def get_queryset(self):
        # Users can only see groups they are a member of
        return Group.objects.filter(memberships__user=self.request.user).distinct()

class GroupDetailView(generics.RetrieveAPIView):
    serializer_class = GroupSerializer

    def get_queryset(self):
        return Group.objects.filter(memberships__user=self.request.user).distinct()

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
