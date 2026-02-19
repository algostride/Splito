from decimal import Decimal
from apps.groups.models import Membership
from apps.bills.models import Bill, ItemAssignment
from .models import Settlement

def compute_balances(group_id):
    balances = {}
    memberships = Membership.objects.filter(group_id=group_id).select_related('user')
    for m in memberships:
        balances[m.user.id] = {
            'user_id': m.user.id,
            'name': m.user.name,
            'net': Decimal('0.00')
        }
    
    bills = Bill.objects.filter(group_id=group_id)
    for bill in bills:
        if bill.created_by_id in balances:
            balances[bill.created_by_id]['net'] += bill.total_amount
            
    assignments = ItemAssignment.objects.filter(item__bill__group_id=group_id)
    for assignment in assignments:
        if assignment.user_id in balances:
            balances[assignment.user_id]['net'] -= assignment.share_amount
            
    settlements = Settlement.objects.filter(group_id=group_id)
    for settlement in settlements:
        if settlement.payer_id in balances:
            balances[settlement.payer_id]['net'] += settlement.amount
        if settlement.payee_id in balances:
            balances[settlement.payee_id]['net'] -= settlement.amount
            
    for user_id, bal in balances.items():
         bal['net'] = f"{bal['net']:.2f}"
         
    return list(balances.values())
