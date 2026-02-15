from django.urls import path
from .views import BillListCreateView, BillDetailView

urlpatterns = [
    path('', BillListCreateView.as_view(), name='bill-list-create'),
    path('<uuid:pk>/', BillDetailView.as_view(), name='bill-detail'),
]
