from rest_framework import generics
from rest_framework.exceptions import PermissionDenied, ValidationError
from uuid import UUID
from .models import Bill, Item, ItemAssignment
from .serializers import BillSerializer


def filter_by_group_param(queryset, request):
    """Apply an optional ?group=<uuid> filter without 500ing on junk input.

    Filtering by group_id alone would defer UUID validation to query
    evaluation and surface a 500, so the value is checked up front.
    """
    group_id = request.query_params.get('group')
    if group_id is None:
        return queryset
    try:
        UUID(str(group_id))
    except (ValueError, AttributeError, TypeError):
        raise ValidationError({'group': 'Must be a valid group id.'})
    return queryset.filter(group_id=group_id)


class BillListCreateView(generics.ListCreateAPIView):
    serializer_class = BillSerializer

    def get_queryset(self):
        # Newest first, explicitly. Neither Bill nor the view had any ordering,
        # so the list came back in whatever order Postgres chose -- usually
        # physical/insertion order. That is invisible while every bill shares
        # one timestamp, but any backdated or edited bill then appears in a
        # position that contradicts the date shown next to it. The Bills tab
        # is read as a reverse-chronological history, so order it as one.
        queryset = Bill.objects.filter(
            group__memberships__user=self.request.user
        ).select_related('created_by', 'paid_by', 'group').prefetch_related(
            'items__assignments__user'
        ).order_by('-created_at').distinct()
        return filter_by_group_param(queryset, self.request)


class BillDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BillSerializer

    def get_queryset(self):
        return Bill.objects.filter(
            group__memberships__user=self.request.user
        ).select_related('created_by', 'paid_by', 'group').prefetch_related(
            'items__assignments__user'
        ).distinct()

    def _is_owner(self, bill):
        return bill.created_by_id == self.request.user.id or bill.group.created_by_id == self.request.user.id

    def perform_destroy(self, instance):
        if not self._is_owner(instance):
            raise PermissionDenied("Only the bill's creator or the group owner can delete it.")
        instance.delete()
