from django.db import models
from django.conf import settings
from drugs.models import Allergy

class PatientAllergy(models.Model):
    patient = models.ForeignKey('Patient', on_delete=models.CASCADE, related_name='patient_allergies')
    allergy = models.ForeignKey(Allergy, on_delete=models.CASCADE, related_name='patient_allergies')
    reaction = models.CharField(max_length=255, blank=True, null=True)
    date_noted = models.DateField(blank=True, null=True)
    severity = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        unique_together = ('patient', 'allergy')

    def __str__(self):
        return f"{self.patient.full_name} - {self.allergy.name} ({self.reaction or 'No reaction specified'})"

class Patient(models.Model):
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]
    
    BLOOD_GROUP_CHOICES = [
        ('A+', 'A+'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B-', 'B-'),
        ('AB+', 'AB+'),
        ('AB-', 'AB-'),
        ('O+', 'O+'),
        ('O-', 'O-'),
    ]
    
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField()
    emergency_contact = models.CharField(max_length=15, blank=True, null=True)
    medical_history = models.TextField(blank=True, null=True)
    blood_group = models.CharField(max_length=3, choices=BLOOD_GROUP_CHOICES, blank=True, null=True)
    height = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True, help_text="Height in centimeters")
    weight = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True, help_text="Weight in kilograms")
    allergies = models.ManyToManyField(Allergy, through=PatientAllergy, blank=True, related_name='patients')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['-created_at']
    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    @property
    def age(self):
        from datetime import date
        today = date.today()
        return today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))
    
    @property
    def bmi(self):
        """Calculate BMI (Body Mass Index) if height and weight are available"""
        if self.height and self.weight:
            # Convert height from cm to meters
            height_m = float(self.height) / 100
            weight_kg = float(self.weight)
            bmi_value = weight_kg / (height_m ** 2)
            return round(bmi_value, 1)
        return None
    
    @property
    def bmi_category(self):
        """Get BMI category based on calculated BMI"""
        bmi_value = self.bmi
        if bmi_value is None:
            return None
        
        if bmi_value < 18.5:
            return "Underweight"
        elif bmi_value < 25:
            return "Normal weight"
        elif bmi_value < 30:
            return "Overweight"
        else:
            return "Obese"


# Clinic Management Models
class Appointment(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('checked_in', 'Checked In'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ]
    
    APPOINTMENT_TYPE_CHOICES = [
        ('normal', 'Normal'),
        ('emergency', 'Emergency'),
        ('follow_up', 'Follow-up'),
        ('consultation', 'Consultation'),
    ]
    
    PRIORITY_CHOICES = [
        (1, 'Emergency'),
        (2, 'High'),
        (3, 'Normal'),
        (4, 'Low'),
    ]
    
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='appointments')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='appointments')
    appointment_type = models.CharField(max_length=20, choices=APPOINTMENT_TYPE_CHOICES, default='normal')
    scheduled_time = models.DateTimeField()
    actual_start_time = models.DateTimeField(blank=True, null=True)
    actual_end_time = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    reason = models.TextField()
    priority = models.IntegerField(choices=PRIORITY_CHOICES, default=3)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['scheduled_time']
    
    def __str__(self):
        return f"{self.patient.full_name} - {self.doctor.get_full_name()} ({self.scheduled_time.strftime('%Y-%m-%d %H:%M')})"


class ClinicQueue(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'Waiting'),
        ('in_consultation', 'In Consultation'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name='queue_entry')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='queue_patients')
    queue_position = models.PositiveIntegerField()
    checked_in_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting')
    estimated_wait_time_minutes = models.PositiveIntegerField(default=30)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['queue_position']
        unique_together = ['doctor', 'queue_position']
    
    def __str__(self):
        return f"{self.appointment.patient.full_name} - Position {self.queue_position}"


class Consultation(models.Model):
    OUTCOME_CHOICES = [
        ('completed', 'Completed'),
        ('follow_up_required', 'Follow-up Required'),
        ('referred', 'Referred'),
        ('cancelled', 'Cancelled'),
    ]
    
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name='consultation')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='consultations')
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    diagnosis = models.TextField(blank=True, null=True)
    treatment_plan = models.TextField(blank=True, null=True)
    outcome = models.CharField(max_length=20, choices=OUTCOME_CHOICES, blank=True, null=True)
    prescription_required = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-started_at']
    
    def __str__(self):
        return f"{self.appointment.patient.full_name} - {self.doctor.get_full_name()} ({self.started_at.strftime('%Y-%m-%d %H:%M')})"
    
    @property
    def duration_minutes(self):
        if self.ended_at and self.started_at:
            return int((self.ended_at - self.started_at).total_seconds() / 60)
        return None
