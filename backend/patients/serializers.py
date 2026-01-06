from rest_framework import serializers
from django.conf import settings
from django.contrib.auth import get_user_model
from .models import Patient, PatientAllergy, Appointment, ClinicQueue, Consultation
from drugs.serializers import AllergySerializer
from users.serializers import UserSerializer

User = get_user_model()

class PatientAllergySerializer(serializers.ModelSerializer):
    allergy = AllergySerializer(read_only=True)
    allergy_id = serializers.PrimaryKeyRelatedField(queryset=PatientAllergy._meta.get_field('allergy').related_model.objects.all(), source='allergy', write_only=True)

    class Meta:
        model = PatientAllergy
        fields = ['id', 'allergy', 'allergy_id', 'reaction', 'date_noted', 'severity']

class PatientSerializer(serializers.ModelSerializer):
    age = serializers.ReadOnlyField()
    full_name = serializers.ReadOnlyField()
    bmi = serializers.ReadOnlyField()
    bmi_category = serializers.ReadOnlyField()
    detailed_allergies = PatientAllergySerializer(source='patient_allergies', many=True, required=False)
    
    class Meta:
        model = Patient
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def create(self, validated_data):
        allergies_data = validated_data.pop('patient_allergies', [])
        patient = Patient.objects.create(**validated_data)
        for allergy_data in allergies_data:
            PatientAllergy.objects.create(patient=patient, **allergy_data)
        return patient

    def update(self, instance, validated_data):
        allergies_data = validated_data.pop('patient_allergies', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if allergies_data is not None:
            instance.patient_allergies.all().delete()
            for allergy_data in allergies_data:
                PatientAllergy.objects.create(patient=instance, **allergy_data)
        return instance 


# Clinic Management Serializers
class AppointmentSerializer(serializers.ModelSerializer):
    patient_details = PatientSerializer(source='patient', read_only=True)
    doctor_details = UserSerializer(source='doctor', read_only=True)
    
    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'doctor', 'patient_details', 'doctor_details',
            'appointment_type', 'scheduled_time', 'actual_start_time', 'actual_end_time',
            'status', 'reason', 'priority', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'actual_start_time', 'actual_end_time']
    
    def validate_scheduled_time(self, value):
        """Validate scheduled time format"""
        if isinstance(value, str):
            try:
                from django.utils.dateparse import parse_datetime
                parsed_value = parse_datetime(value)
                if parsed_value is None:
                    raise serializers.ValidationError("Invalid datetime format")
                return parsed_value
            except Exception as e:
                raise serializers.ValidationError(f"Invalid datetime format: {str(e)}")
        return value


class ClinicQueueSerializer(serializers.ModelSerializer):
    appointment = AppointmentSerializer(read_only=True)
    doctor = UserSerializer(read_only=True)
    
    class Meta:
        model = ClinicQueue
        fields = [
            'id', 'appointment', 'doctor',
            'queue_position', 'checked_in_at', 'status',
            'estimated_wait_time_minutes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'checked_in_at']


class ConsultationSerializer(serializers.ModelSerializer):
    appointment_details = AppointmentSerializer(source='appointment', read_only=True)
    doctor_details = UserSerializer(source='doctor', read_only=True)
    appointment_id = serializers.PrimaryKeyRelatedField(queryset=Appointment.objects.all(), source='appointment', write_only=True)
    doctor_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='doctor', write_only=True)
    duration_minutes = serializers.ReadOnlyField()
    
    class Meta:
        model = Consultation
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Rename fields to match frontend expectations
        data['appointment'] = data.pop('appointment_details')
        data['doctor'] = data.pop('doctor_details')
        return data


# Specialized serializers for specific API responses
class DoctorQueueSerializer(serializers.Serializer):
    doctor = UserSerializer(read_only=True)
    current_patient = ClinicQueueSerializer(read_only=True)
    queue = ClinicQueueSerializer(many=True, read_only=True)
    queue_stats = serializers.DictField(read_only=True)


class ClinicStatsSerializer(serializers.Serializer):
    appointment_stats = serializers.DictField(read_only=True)
    queue_stats = serializers.DictField(read_only=True)
    doctor_stats = serializers.DictField(read_only=True)
    clinic_stats = serializers.DictField(read_only=True)