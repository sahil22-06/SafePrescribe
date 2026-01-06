from django.urls import path
from .views import PrescriptionListCreateView, PrescriptionDetailView, prescription_stats

urlpatterns = [
    path('prescriptions/', PrescriptionListCreateView.as_view(), name='prescription-list'),
    path('prescriptions/<int:pk>/', PrescriptionDetailView.as_view(), name='prescription-detail'),
    path('prescriptions/stats/', prescription_stats, name='prescription-stats'),
] 