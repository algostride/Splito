from django.urls import path
from .views import SettlementListCreateView, BalanceView

urlpatterns = [
    path('', SettlementListCreateView.as_view(), name='settlement-list-create'),
    path('balances/', BalanceView.as_view(), name='balances'),
]
