from django.contrib import admin
from .models import Bill, Item, ItemAssignment

admin.site.register(Bill)
admin.site.register(Item)
admin.site.register(ItemAssignment)
