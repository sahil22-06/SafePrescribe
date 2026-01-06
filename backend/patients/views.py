from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import datetime, timedelta
from django.db.models import Count, Q
from .models import Patient, Appointment, ClinicQueue, Consultation
from .serializers import (
    PatientSerializer, AppointmentSerializer, ClinicQueueSerializer, 
    ConsultationSerializer, DoctorQueueSerializer, ClinicStatsSerializer
)
from users.serializers import UserSerializer

User = get_user_model()

class PatientListCreateView(generics.ListCreateAPIView):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['gender']
    search_fields = ['first_name', 'last_name', 'email', 'phone']
    ordering_fields = ['created_at', 'first_name', 'last_name']

class PatientDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    
    def update(self, request, *args, **kwargs):
        # Allow partial updates for allergy management
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

@api_view(['GET'])
def patient_stats(request):
    total_patients = Patient.objects.count()
    male_patients = Patient.objects.filter(gender='M').count()
    female_patients = Patient.objects.filter(gender='F').count()
    
    return Response({
        'total_patients': total_patients,
        'male_patients': male_patients,
        'female_patients': female_patients,
    })


# Clinic Management Views
class AppointmentViewSet(ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'appointment_type', 'doctor', 'patient']
    search_fields = ['patient__first_name', 'patient__last_name', 'reason']
    ordering_fields = ['scheduled_time', 'created_at']
    ordering = ['scheduled_time']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by date if provided
        date = self.request.query_params.get('date', None)
        if date:
            try:
                date_obj = datetime.strptime(date, '%Y-%m-%d').date()
                queryset = queryset.filter(scheduled_time__date=date_obj)
            except ValueError:
                pass
        return queryset
    
    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        """Check in a patient for their appointment"""
        appointment = self.get_object()
        
        if appointment.status != 'scheduled':
            return Response(
                {'error': 'Appointment is not in scheduled status'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update appointment status
        appointment.status = 'checked_in'
        appointment.save()
        
        # Add to doctor's queue
        doctor = appointment.doctor
        next_position = ClinicQueue.objects.filter(doctor=doctor).count() + 1
        
        queue_entry = ClinicQueue.objects.create(
            appointment=appointment,
            doctor=doctor,
            queue_position=next_position,
            status='waiting'
        )
        
        serializer = self.get_serializer(appointment)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel an appointment"""
        appointment = self.get_object()
        appointment.status = 'cancelled'
        appointment.save()
        
        # Remove from queue if exists
        try:
            queue_entry = appointment.queue_entry
            queue_entry.delete()
            # Reorder remaining queue positions
            self._reorder_queue_positions(appointment.doctor)
        except ClinicQueue.DoesNotExist:
            pass
        
        serializer = self.get_serializer(appointment)
        return Response(serializer.data)
    
    def _reorder_queue_positions(self, doctor):
        """Reorder queue positions after removal"""
        queue_entries = ClinicQueue.objects.filter(doctor=doctor).order_by('queue_position')
        for i, entry in enumerate(queue_entries, 1):
            entry.queue_position = i
            entry.save()


class ClinicQueueViewSet(ModelViewSet):
    queryset = ClinicQueue.objects.all()
    serializer_class = ClinicQueueSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['doctor', 'status']
    ordering_fields = ['queue_position', 'checked_in_at']
    ordering = ['queue_position']


class ConsultationViewSet(ModelViewSet):
    queryset = Consultation.objects.all()
    serializer_class = ConsultationSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['doctor', 'outcome']
    ordering_fields = ['started_at', 'ended_at']
    ordering = ['-started_at']


@api_view(['GET'])
def clinic_stats(request):
    """Get clinic dashboard statistics"""
    today = timezone.now().date()
    
    # Appointment statistics
    appointments_today = Appointment.objects.filter(scheduled_time__date=today)
    appointment_stats = {
        'total_today': appointments_today.count(),
        'completed_today': appointments_today.filter(status='completed').count(),
        'ongoing_today': appointments_today.filter(status='in_progress').count(),
        'emergency_today': appointments_today.filter(appointment_type='emergency').count(),
        'cancelled_today': appointments_today.filter(status='cancelled').count(),
        'no_show_today': appointments_today.filter(status='no_show').count(),
    }
    
    # Queue statistics
    waiting_patients = ClinicQueue.objects.filter(status='waiting')
    queue_stats = {
        'total_waiting': waiting_patients.count(),
        'average_wait_time_minutes': 25,  # This could be calculated from actual data
        'longest_wait_time_minutes': 45,  # This could be calculated from actual data
    }
    
    # Doctor statistics
    doctors = User.objects.filter(role='doctor')
    doctors_in_consultation = Consultation.objects.filter(
        ended_at__isnull=True, 
        started_at__isnull=False
    ).values_list('doctor', flat=True).distinct().count()
    
    doctor_stats = {
        'active_doctors': doctors.count(),
        'doctors_in_consultation': doctors_in_consultation,
        'doctors_available': doctors.count() - doctors_in_consultation,
    }
    
    # Clinic statistics
    patients_today = Patient.objects.filter(
        appointments__scheduled_time__date=today
    ).distinct()
    
    clinic_stats = {
        'total_patients_today': patients_today.count(),
        'new_patients_today': Patient.objects.filter(created_at__date=today).count(),
        'returning_patients_today': patients_today.count() - Patient.objects.filter(created_at__date=today).count(),
    }
    
    stats_data = {
        'appointment_stats': appointment_stats,
        'queue_stats': queue_stats,
        'doctor_stats': doctor_stats,
        'clinic_stats': clinic_stats,
    }
    
    serializer = ClinicStatsSerializer(stats_data)
    return Response(serializer.data)


@api_view(['GET'])
def doctor_queue(request, doctor_id):
    """Get doctor's current patient and waiting queue"""
    
    try:
        doctor = User.objects.get(id=doctor_id, role='doctor')
    except User.DoesNotExist:
        return Response(
            {'error': 'Doctor not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Get current patient (in consultation)
    current_patient = None
    try:
        current_queue_entry = ClinicQueue.objects.filter(
            doctor=doctor, 
            status='in_consultation'
        ).first()
        if current_queue_entry:
            current_patient = ClinicQueueSerializer(current_queue_entry).data
    except ClinicQueue.DoesNotExist:
        pass
    
    # Get waiting queue
    waiting_queue = ClinicQueue.objects.filter(
        doctor=doctor, 
        status='waiting'
    ).order_by('queue_position')
    
    queue_data = []
    for entry in waiting_queue:
        # Calculate wait time
        wait_time = timezone.now() - entry.checked_in_at
        wait_time_minutes = int(wait_time.total_seconds() / 60)
        
        entry_data = ClinicQueueSerializer(entry).data
        entry_data['wait_time_minutes'] = wait_time_minutes
        queue_data.append(entry_data)
    
    # Queue statistics
    queue_stats = {
        'total_waiting': len(queue_data),
        'average_wait_time': sum(entry['wait_time_minutes'] for entry in queue_data) / len(queue_data) if queue_data else 0,
        'estimated_next_available': None,  # Could be calculated based on current consultation
    }
    
    response_data = {
        'doctor': UserSerializer(doctor).data,
        'current_patient': current_patient,
        'queue': queue_data,
        'queue_stats': queue_stats,
    }
    
    return Response(response_data)


@api_view(['POST'])
def start_consultation(request):
    """Start a consultation for a patient"""
    appointment_id = request.data.get('appointment_id')
    doctor_id = request.data.get('doctor_id')
    
    if not appointment_id or not doctor_id:
        return Response(
            {'error': 'appointment_id and doctor_id are required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        appointment = Appointment.objects.get(id=appointment_id)
        doctor = User.objects.get(id=doctor_id, role='doctor')
    except (Appointment.DoesNotExist, User.DoesNotExist):
        return Response(
            {'error': 'Appointment or doctor not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Update appointment status
    appointment.status = 'in_progress'
    appointment.actual_start_time = timezone.now()
    appointment.save()
    
    # Update queue entry
    try:
        queue_entry = appointment.queue_entry
        queue_entry.status = 'in_consultation'
        queue_entry.save()
    except ClinicQueue.DoesNotExist:
        pass
    
    # Create consultation record
    consultation = Consultation.objects.create(
        appointment=appointment,
        doctor=doctor,
        started_at=timezone.now()
    )
    
    serializer = ConsultationSerializer(consultation)
    return Response(serializer.data)


@api_view(['POST'])
def end_consultation(request):
    """End a consultation"""
    consultation_id = request.data.get('consultation_id')
    notes = request.data.get('notes', '')
    outcome = request.data.get('outcome', 'completed')
    
    if not consultation_id:
        return Response(
            {'error': 'consultation_id is required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        consultation = Consultation.objects.get(id=consultation_id)
    except Consultation.DoesNotExist:
        return Response(
            {'error': 'Consultation not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Update consultation
    consultation.ended_at = timezone.now()
    consultation.notes = notes
    consultation.outcome = outcome
    consultation.save()
    
    # Update appointment
    appointment = consultation.appointment
    appointment.status = 'completed'
    appointment.actual_end_time = timezone.now()
    appointment.save()
    
    # Remove from queue
    try:
        queue_entry = appointment.queue_entry
        queue_entry.delete()
        # Reorder remaining queue positions
        AppointmentViewSet()._reorder_queue_positions(consultation.doctor)
    except ClinicQueue.DoesNotExist:
        pass
    
    serializer = ConsultationSerializer(consultation)
    return Response(serializer.data)
