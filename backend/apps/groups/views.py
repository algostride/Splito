from rest_framework import generics
from .models import Group, Membership
from .serializers import GroupSerializer, MembershipSerializer

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
