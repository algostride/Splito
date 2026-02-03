from django.urls import path
from .views import GroupListCreateView, GroupDetailView, GroupMembersView

urlpatterns = [
    path('', GroupListCreateView.as_view(), name='group-list-create'),
    path('<uuid:pk>/', GroupDetailView.as_view(), name='group-detail'),
    path('<uuid:pk>/members/', GroupMembersView.as_view(), name='group-members'),
]
