from django.urls import path
from .views import SettlementListCreateView, SettlementDetailView, BalanceView, UserDebtsView

urlpatterns = [
    path('', SettlementListCreateView.as_view(), name='settlement-list-create'),
    path('<uuid:pk>/', SettlementDetailView.as_view(), name='settlement-detail'),
    path('balances/', BalanceView.as_view(), name='balances'),
    path('debts/', UserDebtsView.as_view(), name='user-debts'),
]
