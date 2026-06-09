import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator

class Bill(models.Model):
    BILL_TYPE_SIMPLE = 'simple'
    BILL_TYPE_COMPOUND = 'compound'
    BILL_TYPE_CHOICES = [
        (BILL_TYPE_SIMPLE, 'Simple'),
        (BILL_TYPE_COMPOUND, 'Compound'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey('groups.Group', on_delete=models.CASCADE, related_name='bills', db_index=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_bills')
    paid_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='paid_bills', null=True, blank=True)
    title = models.CharField(max_length=255)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    currency = models.CharField(max_length=10)
    bill_type = models.CharField(max_length=10, choices=BILL_TYPE_CHOICES, default=BILL_TYPE_COMPOUND)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class Item(models.Model):
    SPLIT_MODE_SHARES = 'shares'
    SPLIT_MODE_PERCENT = 'percent'
    SPLIT_MODE_CHOICES = [
        (SPLIT_MODE_SHARES, 'Shares'),
        (SPLIT_MODE_PERCENT, 'Percent'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    split_mode = models.CharField(max_length=10, choices=SPLIT_MODE_CHOICES, default=SPLIT_MODE_SHARES)

    def __str__(self):
        return self.name

class ItemAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='assignments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='item_assignments', db_index=True)
    share_amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    split_value = models.DecimalField(max_digits=14, decimal_places=6, null=True, blank=True)

    class Meta:
        unique_together = ('item', 'user')

    def __str__(self):
        return f"{self.user} - {self.item}"
