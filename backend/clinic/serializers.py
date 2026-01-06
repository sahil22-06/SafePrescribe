from rest_framework import serializers
from .models import Appointment, Queue, ClinicSettings
from patients.models import Patient
from django.conf import settings
from django.utils import timezone


class AppointmentSerializer(serializers.ModelSerializer):
    """Serializer for Appointment model"""
    
    # Related field serializers
    patient_name = serializers.CharField(source='patient.get_full_name', read_only=True)
    patient_id = serializers.IntegerField(source='patient.id', read_only=True)
    doctor_name = serializers.CharField(source='doctor.get_full_name', read_only=True)
    doctor_id = serializers.IntegerField(source='doctor.id', read_only=True)
    
    # Computed fields
    is_emergency = serializers.BooleanField(read_only=True)
    is_waiting = serializers.BooleanField(read_only=True)
    estimated_wait_time = serializers.IntegerField(read_only=True)
    status_color = serializers.CharField(source='get_status_display_color', read_only=True)
    priority_color = serializers.CharField(source='get_priority_display_color', read_only=True)
    
    # Formatted time fields
    scheduled_time_formatted = serializers.SerializerMethodField()
    created_at_formatted = serializers.SerializerMethodField()
    
    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'patient_id', 'patient_name',
            'doctor', 'doctor_id', 'doctor_name',
            'appointment_type', 'scheduled_time', 'scheduled_time_formatted',
            'estimated_duration', 'reason', 'diagnosis', 'notes',
            'status', 'priority', 'queue_position',
            'actual_start_time', 'actual_end_time',
            'is_emergency', 'is_waiting', 'estimated_wait_time',
            'status_color', 'priority_color',
            'created_at', 'created_at_formatted', 'updated_at'
        ]
        read_only_fields = [
            'id', 'patient_name', 'patient_id', 'doctor_name', 'doctor_id',
            'is_emergency', 'is_waiting', 'estimated_wait_time',
            'status_color', 'priority_color', 'scheduled_time_formatted',
            'created_at_formatted', 'created_at', 'updated_at'
        ]
    
    def get_scheduled_time_formatted(self, obj):
        """Format scheduled time for display"""
        return obj.scheduled_time.strftime('%Y-%m-%d %H:%M')
    
    def get_created_at_formatted(self, obj):
        """Format created time for display"""
        return obj.created_at.strftime('%Y-%m-%d %H:%M')
    
    def validate_scheduled_time(self, value):
        """Validate scheduled time - Allow past times for flexibility"""
        # Remove strict future validation to allow doctors to start consultations early
        # or handle appointments that were scheduled in the past
        return value
    
    def validate(self, data):
        """Validate appointment data"""
        # Check if doctor is available at scheduled time
        scheduled_time = data.get('scheduled_time')
        doctor = data.get('doctor')
        appointment_id = self.instance.id if self.instance else None
        
        if scheduled_time and doctor:
            # Check for overlapping appointments
            overlapping = Appointment.objects.filter(
                doctor=doctor,
                scheduled_time__lte=scheduled_time,
                actual_end_time__gte=scheduled_time,
                status__in=['scheduled', 'waiting', 'in_progress']
            ).exclude(id=appointment_id)
            
            if overlapping.exists():
                raise serializers.ValidationError(
                    "Doctor has another appointment at this time"
                )
        
        return data


class QueueSerializer(serializers.ModelSerializer):
    """Serializer for Queue model"""
    
    # Related field serializers
    appointment = AppointmentSerializer(read_only=True)
    appointment_id = serializers.IntegerField(write_only=True)
    doctor_name = serializers.CharField(source='doctor.get_full_name', read_only=True)
    
    # Computed fields
    patient_name = serializers.CharField(source='appointment.patient.get_full_name', read_only=True)
    reason = serializers.CharField(source='appointment.reason', read_only=True)
    appointment_type = serializers.CharField(source='appointment.appointment_type', read_only=True)
    priority = serializers.IntegerField(source='appointment.priority', read_only=True)
    is_emergency = serializers.BooleanField(source='appointment.is_emergency', read_only=True)
    
    class Meta:
        model = Queue
        fields = [
            'id', 'appointment', 'appointment_id', 'doctor', 'doctor_name',
            'position', 'estimated_wait_time', 'called_at',
            'patient_name', 'reason', 'appointment_type', 'priority', 'is_emergency',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'appointment', 'doctor_name', 'patient_name', 'reason',
            'appointment_type', 'priority', 'is_emergency', 'created_at', 'updated_at'
        ]


class ClinicSettingsSerializer(serializers.ModelSerializer):
    """Serializer for ClinicSettings model"""
    
    class Meta:
        model = ClinicSettings
        fields = [
            'id', 'clinic_name', 'clinic_address', 'clinic_phone', 'clinic_email',
            'default_consultation_duration', 'max_queue_size', 'emergency_bump_enabled',
            'send_sms_notifications', 'send_email_notifications', 'notification_advance_time',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AppointmentCreateSerializer(serializers.ModelSerializer):
    """Simplified serializer for creating appointments"""
    
    class Meta:
        model = Appointment
        fields = [
            'patient', 'doctor', 'appointment_type', 'scheduled_time',
            'reason', 'priority', 'estimated_duration'
        ]
    
    def validate_scheduled_time(self, value):
        """Validate scheduled time - Allow past times for flexibility"""
        # Remove strict future validation to allow doctors to start consultations early
        # or handle appointments that were scheduled in the past
        return value


class QueueUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating queue positions"""
    
    class Meta:
        model = Queue
        fields = ['position', 'estimated_wait_time']
    
    def validate_position(self, value):
        """Validate position is not negative"""
        if value < 0:
            raise serializers.ValidationError("Position must be non-negative")
        return value


class AppointmentStatusUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating appointment status"""
    
    class Meta:
        model = Appointment
        fields = ['status', 'diagnosis', 'notes', 'actual_start_time', 'actual_end_time']
    
    def validate_status(self, value):
        """Validate status transition - Allow flexible transitions for real-world clinic workflow"""
        if self.instance:
            current_status = self.instance.status
            valid_transitions = {
                'scheduled': ['waiting', 'in_progress', 'cancelled'],  # Allow direct start from scheduled
                'waiting': ['in_progress', 'cancelled', 'no_show'],
                'in_progress': ['completed', 'cancelled'],
                'completed': [],  # Terminal state
                'cancelled': [],  # Terminal state
                'no_show': [],    # Terminal state
            }
            
            # Allow any transition if doctor is taking action (real-world flexibility)
            # Only restrict terminal states from being changed
            if current_status in ['completed', 'cancelled', 'no_show'] and value != current_status:
                raise serializers.ValidationError(
                    f"Cannot change status from terminal state {current_status} to {value}"
                )
        
        return value
