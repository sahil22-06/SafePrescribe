from django.urls import path
from .views import (
    AppointmentListCreateView, AppointmentDetailView, QueueListView, QueueUpdateView,
    add_to_queue, remove_from_queue, update_appointment_status, clinic_dashboard_stats,
    doctor_queue, clinic_settings
)

urlpatterns = [
    # Appointments
    path('appointments/', AppointmentListCreateView.as_view(), name='appointment-list'),
    path('appointments/<int:pk>/', AppointmentDetailView.as_view(), name='appointment-detail'),
    path('appointments/<int:appointment_id>/status/', update_appointment_status, name='appointment-status'),
    
    # Queue Management
    path('queue/', QueueListView.as_view(), name='queue-list'),
    path('queue/<int:pk>/', QueueUpdateView.as_view(), name='queue-detail'),
    path('queue/add/', add_to_queue, name='add-to-queue'),
    path('queue/remove/', remove_from_queue, name='remove-from-queue'),
    path('queue/doctor/<int:doctor_id>/', doctor_queue, name='doctor-queue'),
    
    # Dashboard and Statistics
    path('dashboard/stats/', clinic_dashboard_stats, name='clinic-dashboard-stats'),
    
    # Settings
    path('settings/', clinic_settings, name='clinic-settings'),
]
