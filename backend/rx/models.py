from django.db import models
from django.conf import settings
from patients.models import Patient
from drugs.models import Drug

# Create your models here.

class Prescription(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    ]
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='prescriptions')
    prescriber = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='prescriptions_written')
    reason = models.TextField(blank=True, null=True, help_text="Reason for the prescription")
    instructions = models.TextField(blank=True, null=True)
    prescribed_date = models.DateField()
    expiry_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    medications = models.ManyToManyField(Drug, through='PrescriptionMedication', related_name='prescriptions_in')

    class Meta:
        ordering = ['-prescribed_date']

    def __str__(self):
        return f"{self.patient.full_name} - {self.status}"

    @property
    def is_expired(self):
        from datetime import date
        return date.today() > self.expiry_date

class PrescriptionMedication(models.Model):
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name='prescription_medications')
    drug = models.ForeignKey(Drug, on_delete=models.CASCADE)
    dosage = models.CharField(max_length=100)
    frequency = models.CharField(max_length=100)
    duration = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField()
    refills = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.drug.name} for {self.prescription.patient.full_name}"
