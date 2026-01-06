from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PatientListCreateView, PatientDetailView, patient_stats,
    AppointmentViewSet, ClinicQueueViewSet, ConsultationViewSet,
    clinic_stats, doctor_queue, start_consultation, end_consultation
)

# Create router for ViewSets
router = DefaultRouter()
router.register(r'appointments', AppointmentViewSet)
router.register(r'queues', ClinicQueueViewSet)
router.register(r'consultations', ConsultationViewSet)

urlpatterns = [
    # Patient URLs
    path('patients/', PatientListCreateView.as_view(), name='patient-list'),
    path('patients/<int:pk>/', PatientDetailView.as_view(), name='patient-detail'),
    path('patients/stats/', patient_stats, name='patient-stats'),
    
    # Clinic Management URLs
    path('clinic/stats/', clinic_stats, name='clinic-stats'),
    path('queues/doctor/<int:doctor_id>/', doctor_queue, name='doctor-queue'),
    path('consultations/start/', start_consultation, name='start-consultation'),
    path('consultations/end/', end_consultation, name='end-consultation'),
    
    # Include router URLs
    path('', include(router.urls)),
] 