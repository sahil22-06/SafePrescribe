from django.contrib import admin
from .models import Appointment, Queue, ClinicSettings


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'patient', 'doctor', 'appointment_type', 'scheduled_time',
        'status', 'priority', 'queue_position', 'created_at'
    ]
    list_filter = [
        'appointment_type', 'status', 'priority', 'scheduled_time',
        'created_at', 'doctor'
    ]
    search_fields = [
        'patient__first_name', 'patient__last_name', 'doctor__first_name',
        'doctor__last_name', 'reason', 'diagnosis'
    ]
    ordering = ['-scheduled_time']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('patient', 'doctor', 'appointment_type', 'scheduled_time')
        }),
        ('Medical Information', {
            'fields': ('reason', 'diagnosis', 'notes')
        }),
        ('Status & Priority', {
            'fields': ('status', 'priority', 'queue_position')
        }),
        ('Timing', {
            'fields': ('estimated_duration', 'actual_start_time', 'actual_end_time')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Queue)
class QueueAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'appointment', 'doctor', 'position', 'estimated_wait_time',
        'called_at', 'created_at'
    ]
    list_filter = ['doctor', 'created_at', 'called_at']
    search_fields = [
        'appointment__patient__first_name', 'appointment__patient__last_name',
        'doctor__first_name', 'doctor__last_name'
    ]
    ordering = ['doctor', 'position']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ClinicSettings)
class ClinicSettingsAdmin(admin.ModelAdmin):
    list_display = [
        'clinic_name', 'clinic_phone', 'clinic_email',
        'default_consultation_duration', 'max_queue_size'
    ]
    fieldsets = (
        ('Clinic Information', {
            'fields': ('clinic_name', 'clinic_address', 'clinic_phone', 'clinic_email')
        }),
        ('Queue Settings', {
            'fields': ('default_consultation_duration', 'max_queue_size', 'emergency_bump_enabled')
        }),
        ('Notification Settings', {
            'fields': ('send_sms_notifications', 'send_email_notifications', 'notification_advance_time')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ['created_at', 'updated_at']
    
    def has_add_permission(self, request):
        # Only allow one settings instance
        return not ClinicSettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # Don't allow deletion of settings
        return False
