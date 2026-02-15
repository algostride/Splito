from rest_framework import generics
from .models import Bill
from .serializers import BillSerializer

class BillListCreateView(generics.ListCreateAPIView):
    serializer_class = BillSerializer

    def get_queryset(self):
        queryset = Bill.objects.filter(group__memberships__user=self.request.user).distinct()
        group_id = self.request.query_params.get('group', None)
        if group_id is not None:
            queryset = queryset.filter(group_id=group_id)
        return queryset

class BillDetailView(generics.RetrieveAPIView):
    serializer_class = BillSerializer

    def get_queryset(self):
        return Bill.objects.filter(group__memberships__user=self.request.user).distinct()
