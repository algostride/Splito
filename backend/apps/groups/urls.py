from django.urls import path
from .views import GroupListCreateView, GroupDetailView, GroupMembersView, InviteMemberView, AcceptInviteView

urlpatterns = [
    path('', GroupListCreateView.as_view(), name='group-list-create'),
    path('<uuid:pk>/', GroupDetailView.as_view(), name='group-detail'),
    path('<uuid:pk>/members/', GroupMembersView.as_view(), name='group-members'),
    path('<uuid:pk>/invite/', InviteMemberView.as_view(), name='group-invite'),
    path('accept-invite/<str:token>/', AcceptInviteView.as_view(), name='group-accept-invite'),
]
