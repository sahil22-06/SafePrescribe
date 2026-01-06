from django.db import models
from django.conf import settings
from patients.models import Patient
from django.utils import timezone
from datetime import datetime, timedelta


class Appointment(models.Model):
    """Model for managing clinic appointments"""
    
    APPOINTMENT_TYPES = [
        ('normal', 'Normal Consultation'),
        ('emergency', 'Emergency'),
        ('follow_up', 'Follow-up'),
        ('checkup', 'Routine Checkup'),
    ]
    
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('waiting', 'Waiting'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ]
    
    PRIORITY_LEVELS = [
        (1, 'Emergency'),
        (2, 'High Priority'),
        (3, 'Normal'),
        (4, 'Low Priority'),
    ]
    
    # Basic Information
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='appointments')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='appointments')
    
    # Appointment Details
    appointment_type = models.CharField(max_length=20, choices=APPOINTMENT_TYPES, default='normal')
    scheduled_time = models.DateTimeField()
    estimated_duration = models.IntegerField(default=30, help_text="Duration in minutes")
    
    # Medical Information
    reason = models.TextField(help_text="Reason for visit/symptoms")
    diagnosis = models.TextField(blank=True, null=True, help_text="Doctor's diagnosis")
    notes = models.TextField(blank=True, null=True, help_text="Additional notes")
    
    # Status and Priority
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    priority = models.IntegerField(choices=PRIORITY_LEVELS, default=3)
    
    # Queue Management
    queue_position = models.IntegerField(default=0, help_text="Position in doctor's queue")
    actual_start_time = models.DateTimeField(blank=True, null=True)
    actual_end_time = models.DateTimeField(blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_appointments')
    
    class Meta:
        ordering = ['priority', 'scheduled_time']
        indexes = [
            models.Index(fields=['doctor', 'status']),
            models.Index(fields=['scheduled_time']),
            models.Index(fields=['priority', 'status']),
        ]
    
    def __str__(self):
        return f"{self.patient.get_full_name()} - {self.get_appointment_type_display()} ({self.scheduled_time.strftime('%Y-%m-%d %H:%M')})"
    
    @property
    def is_emergency(self):
        return self.appointment_type == 'emergency' or self.priority == 1
    
    @property
    def is_waiting(self):
        return self.status in ['waiting', 'in_progress']
    
    @property
    def estimated_wait_time(self):
        """Calculate estimated wait time based on queue position and average consultation time"""
        if self.status != 'waiting':
            return 0
        
        # Simple calculation: position * average consultation time
        return self.queue_position * 20  # 20 minutes average per patient
    
    def get_status_display_color(self):
        """Get color for status display"""
        colors = {
            'scheduled': 'blue',
            'waiting': 'orange',
            'in_progress': 'green',
            'completed': 'gray',
            'cancelled': 'red',
            'no_show': 'red',
        }
        return colors.get(self.status, 'gray')
    
    def get_priority_display_color(self):
        """Get color for priority display"""
        colors = {
            1: 'red',    # Emergency
            2: 'orange', # High Priority
            3: 'blue',   # Normal
            4: 'gray',   # Low Priority
        }
        return colors.get(self.priority, 'gray')


class Queue(models.Model):
    """Model for managing doctor's queue"""
    
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name='queue_entry')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='queue_entries')
    
    # Queue Management
    position = models.IntegerField(default=0)
    estimated_wait_time = models.IntegerField(default=0, help_text="Estimated wait time in minutes")
    called_at = models.DateTimeField(blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['position']
        unique_together = ['doctor', 'position']
    
    def __str__(self):
        return f"Queue {self.position}: {self.appointment.patient.get_full_name()}"
    
    def move_to_next_position(self):
        """Move this queue entry to the next position"""
        self.position += 1
        self.save()
    
    def remove_from_queue(self):
        """Remove this entry from queue and adjust positions"""
        # Get all entries with higher positions
        higher_entries = Queue.objects.filter(
            doctor=self.doctor,
            position__gt=self.position
        )
        
        # Decrease their positions by 1
        for entry in higher_entries:
            entry.position -= 1
            entry.save()
        
        # Delete this entry
        self.delete()


class ClinicSettings(models.Model):
    """Model for clinic-wide settings"""
    
    # Clinic Information
    clinic_name = models.CharField(max_length=200, default="SafePrescribe Clinic")
    clinic_address = models.TextField(blank=True)
    clinic_phone = models.CharField(max_length=20, blank=True)
    clinic_email = models.EmailField(blank=True)
    
    # Queue Settings
    default_consultation_duration = models.IntegerField(default=30, help_text="Default consultation duration in minutes")
    max_queue_size = models.IntegerField(default=50, help_text="Maximum number of patients in queue")
    emergency_bump_enabled = models.BooleanField(default=True, help_text="Allow emergency patients to bump queue")
    
    # Notification Settings
    send_sms_notifications = models.BooleanField(default=False)
    send_email_notifications = models.BooleanField(default=True)
    notification_advance_time = models.IntegerField(default=15, help_text="Minutes before appointment to send notification")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Clinic Settings"
        verbose_name_plural = "Clinic Settings"
    
    def __str__(self):
        return f"Settings for {self.clinic_name}"
    
    @classmethod
    def get_settings(cls):
        """Get or create clinic settings"""
        settings, created = cls.objects.get_or_create(pk=1)
        return settings
