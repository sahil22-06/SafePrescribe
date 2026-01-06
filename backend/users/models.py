from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = [
        ('doctor', 'Doctor'),
        ('receptionist', 'Receptionist'),
        ('pharmacist', 'Pharmacist'),
        ('nurse', 'Nurse'),
        ('admin', 'Administrator'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='doctor')
    license_number = models.CharField(max_length=50, blank=True, null=True)
    phone = models.CharField(max_length=15, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"
