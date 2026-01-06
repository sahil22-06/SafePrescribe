from rest_framework import generics, status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count, Avg, Max
from django.utils import timezone
from datetime import datetime, timedelta
import logging

from .models import Appointment, Queue, ClinicSettings
from .serializers import (
    AppointmentSerializer, QueueSerializer, ClinicSettingsSerializer,
    AppointmentCreateSerializer, QueueUpdateSerializer, AppointmentStatusUpdateSerializer
)
from patients.models import Patient
from django.conf import settings

logger = logging.getLogger(__name__)


class AppointmentListCreateView(generics.ListCreateAPIView):
    """List and create appointments"""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['doctor', 'status', 'appointment_type', 'priority']
    search_fields = ['patient__first_name', 'patient__last_name', 'reason']
    ordering_fields = ['scheduled_time', 'priority', 'created_at']
    ordering = ['priority', 'scheduled_time']
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AppointmentCreateSerializer
        return AppointmentSerializer
    
    def get_queryset(self):
        """Filter appointments based on user role and permissions"""
        queryset = Appointment.objects.select_related('patient', 'doctor').all()
        
        # Filter by doctor if specified in query params
        doctor_id = self.request.query_params.get('doctor')
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        # If user is a doctor and no specific doctor filter, show only their appointments
        elif hasattr(self.request.user, 'role') and self.request.user.role == 'doctor':
            queryset = queryset.filter(doctor=self.request.user)
        
        return queryset
    
    def perform_create(self, serializer):
        """Set created_by when creating appointment and add to queue"""
        appointment = serializer.save(created_by=self.request.user)
        
        # Automatically add appointment to doctor's queue
        try:
            # Check if already in queue
            if not Queue.objects.filter(appointment=appointment).exists():
                # Get next position in queue
                last_position = Queue.objects.filter(doctor=appointment.doctor).aggregate(
                    max_pos=Max('position')
                )['max_pos'] or 0
                
                # Create queue entry
                Queue.objects.create(
                    appointment=appointment,
                    doctor=appointment.doctor,
                    position=last_position + 1,
                    estimated_wait_time=last_position * 20  # 20 minutes per patient
                )
                logger.info(f"Appointment {appointment.id} automatically added to queue for doctor {appointment.doctor.id}")
        except Exception as e:
            logger.error(f"Failed to add appointment {appointment.id} to queue: {str(e)}")
            # Don't fail the appointment creation if queue addition fails


class AppointmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete appointment"""
    permission_classes = [IsAuthenticated]
    serializer_class = AppointmentSerializer
    
    def get_queryset(self):
        return Appointment.objects.select_related('patient', 'doctor').all()


class QueueListView(generics.ListAPIView):
    """List queue for a specific doctor"""
    permission_classes = [IsAuthenticated]
    serializer_class = QueueSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['doctor']
    
    def get_queryset(self):
        """Get queue entries for the current doctor"""
        doctor_id = self.request.query_params.get('doctor')
        if doctor_id:
            return Queue.objects.filter(
                doctor_id=doctor_id,
                appointment__status__in=['waiting', 'in_progress']
            ).select_related('appointment__patient', 'doctor').order_by('position')
        
        # Default to current user if they're a doctor
        if hasattr(self.request.user, 'role') and self.request.user.role == 'doctor':
            return Queue.objects.filter(
                doctor=self.request.user,
                appointment__status__in=['waiting', 'in_progress']
            ).select_related('appointment__patient', 'doctor').order_by('position')
        
        return Queue.objects.none()


class QueueUpdateView(generics.UpdateAPIView):
    """Update queue positions"""
    permission_classes = [IsAuthenticated]
    serializer_class = QueueUpdateSerializer
    
    def get_queryset(self):
        return Queue.objects.all()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_to_queue(request):
    """Add an appointment to the doctor's queue"""
    try:
        appointment_id = request.data.get('appointment_id')
        doctor_id = request.data.get('doctor_id')
        
        if not appointment_id:
            return Response({'error': 'appointment_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        appointment = Appointment.objects.get(id=appointment_id)
        
        # Use provided doctor_id or default to appointment's doctor
        from django.apps import apps
        User = apps.get_model('users', 'User')
        doctor = User.objects.get(id=doctor_id) if doctor_id else appointment.doctor
        
        # Check if already in queue
        if Queue.objects.filter(appointment=appointment).exists():
            return Response({'error': 'Appointment already in queue'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get next position in queue
        last_position = Queue.objects.filter(doctor=doctor).aggregate(
            max_pos=Max('position')
        )['max_pos'] or 0
        
        # Create queue entry
        queue_entry = Queue.objects.create(
            appointment=appointment,
            doctor=doctor,
            position=last_position + 1,
            estimated_wait_time=last_position * 20  # 20 minutes per patient
        )
        
        # Update appointment status
        appointment.status = 'waiting'
        appointment.queue_position = queue_entry.position
        appointment.save()
        
        serializer = QueueSerializer(queue_entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Appointment.DoesNotExist:
        return Response({'error': 'Appointment not found'}, status=status.HTTP_404_NOT_FOUND)
    except User.DoesNotExist:
        return Response({'error': 'Doctor not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error adding to queue: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_from_queue(request):
    """Remove an appointment from the queue"""
    try:
        queue_id = request.data.get('queue_id')
        appointment_id = request.data.get('appointment_id')
        
        if queue_id:
            queue_entry = Queue.objects.get(id=queue_id)
        elif appointment_id:
            queue_entry = Queue.objects.get(appointment_id=appointment_id)
        else:
            return Response({'error': 'queue_id or appointment_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Remove from queue and adjust positions
        queue_entry.remove_from_queue()
        
        # Update appointment status
        appointment = queue_entry.appointment
        appointment.status = 'completed'
        appointment.save()
        
        return Response({'message': 'Removed from queue successfully'}, status=status.HTTP_200_OK)
        
    except Queue.DoesNotExist:
        return Response({'error': 'Queue entry not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error removing from queue: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_appointment_status(request, appointment_id):
    """Update appointment status"""
    try:
        appointment = Appointment.objects.get(id=appointment_id)
        serializer = AppointmentStatusUpdateSerializer(appointment, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            
            # If status changed to in_progress, update actual_start_time
            if serializer.validated_data.get('status') == 'in_progress' and not appointment.actual_start_time:
                appointment.actual_start_time = timezone.now()
                appointment.save()
            
            # If status changed to completed, update actual_end_time
            elif serializer.validated_data.get('status') == 'completed' and not appointment.actual_end_time:
                appointment.actual_end_time = timezone.now()
                appointment.save()
            
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    except Appointment.DoesNotExist:
        return Response({'error': 'Appointment not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error updating appointment status: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def clinic_dashboard_stats(request):
    """Get clinic dashboard statistics"""
    try:
        today = timezone.now().date()
        
        # Today's appointments
        today_appointments = Appointment.objects.filter(scheduled_time__date=today)
        
        # Queue statistics
        queue_stats = {
            'total_waiting': Queue.objects.filter(
                appointment__status='waiting'
            ).count(),
            'total_in_progress': Queue.objects.filter(
                appointment__status='in_progress'
            ).count(),
            'average_wait_time': 0,  # Default to 0 if no queue entries
        }
        
        # Calculate average wait time if there are queue entries
        queue_entries = Queue.objects.all()
        if queue_entries.exists():
            avg_wait = queue_entries.aggregate(avg_wait=Avg('estimated_wait_time'))['avg_wait']
            queue_stats['average_wait_time'] = round(avg_wait or 0, 1)
        
        # Appointment statistics
        appointment_stats = {
            'total_today': today_appointments.count(),
            'completed_today': today_appointments.filter(status='completed').count(),
            'waiting_today': today_appointments.filter(status='waiting').count(),
            'in_progress_today': today_appointments.filter(status='in_progress').count(),
            'emergency_today': today_appointments.filter(priority=1).count(),
        }
        
        # Doctor workload - handle case where no doctors have appointments today
        doctor_workload = []
        try:
            from django.apps import apps
            User = apps.get_model('users', 'User')
            doctors = User.objects.filter(appointments__scheduled_time__date=today).distinct()
            for doctor in doctors:
                doctor_appointments = today_appointments.filter(doctor=doctor)
                doctor_workload.append({
                    'doctor_id': doctor.id,
                    'doctor_name': doctor.get_full_name(),
                    'total_appointments': doctor_appointments.count(),
                    'completed': doctor_appointments.filter(status='completed').count(),
                    'waiting': doctor_appointments.filter(status='waiting').count(),
                    'in_progress': doctor_appointments.filter(status='in_progress').count(),
                })
        except Exception as e:
            logger.warning(f"Could not fetch doctor workload: {e}")
            # Provide empty doctor workload if there's an error
            doctor_workload = []
        
        return Response({
            'queue_stats': queue_stats,
            'appointment_stats': appointment_stats,
            'doctor_workload': doctor_workload,
            'date': today.isoformat(),
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting clinic dashboard stats: {e}")
        import traceback
        traceback.print_exc()
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def doctor_queue(request, doctor_id):
    """Get doctor's current queue"""
    try:
        queue_entries = Queue.objects.filter(
            doctor_id=doctor_id,
            appointment__status__in=['waiting', 'in_progress']
        ).select_related('appointment__patient', 'doctor').order_by('position')
        
        serializer = QueueSerializer(queue_entries, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting doctor queue: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def clinic_settings(request):
    """Get or update clinic settings"""
    try:
        settings = ClinicSettings.get_settings()
        
        if request.method == 'GET':
            serializer = ClinicSettingsSerializer(settings)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        elif request.method == 'PUT':
            serializer = ClinicSettingsSerializer(settings, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error with clinic settings: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
