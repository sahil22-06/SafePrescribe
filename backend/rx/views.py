from rest_framework import generics, filters
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Prescription
from .serializers import PrescriptionSerializer
from patients.models import Patient
from drugs.models import Drug, Allergy
from rest_framework import status

class PrescriptionListCreateView(generics.ListCreateAPIView):
    serializer_class = PrescriptionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'patient']
    search_fields = ['patient__first_name', 'patient__last_name']
    ordering_fields = ['prescribed_date', 'created_at']
    
    def get_queryset(self):
        # Doctors and admins can see all prescriptions
        # Other roles can only see their own prescriptions
        user = self.request.user
        if hasattr(user, 'role') and user.role in ['doctor', 'admin']:
            return Prescription.objects.all()
        return Prescription.objects.filter(prescriber=user)

    def perform_create(self, serializer):
        patient_id = self.request.data.get('patient')
        medications = self.request.data.get('medications', [])
        conflict_warning = None
        conflict_names_set = set()
        if patient_id and medications:
            try:
                patient = Patient.objects.get(pk=patient_id)
                patient_allergies = set(patient.allergies.values_list('id', flat=True))
                for med in medications:
                    drug_id = med.get('drug')
                    if not drug_id:
                        continue
                    try:
                        drug = Drug.objects.get(pk=drug_id)
                        drug_conflicts = set(drug.allergy_conflicts.values_list('id', flat=True))
                        conflicts = patient_allergies & drug_conflicts
                        if conflicts:
                            conflict_names = Allergy.objects.filter(id__in=conflicts).values_list('name', flat=True)
                            conflict_names_set.update(conflict_names)
                    except Drug.DoesNotExist:
                        continue
                if conflict_names_set:
                    conflict_warning = f"Warning: Patient is allergic to: {', '.join(conflict_names_set)}. One or more drugs may cause an allergic reaction."
            except Patient.DoesNotExist:
                pass
        instance = serializer.save(prescriber=self.request.user)
        if conflict_warning:
            self.conflict_warning = conflict_warning
        else:
            self.conflict_warning = None

    def create(self, request, *args, **kwargs):
        # Debug: Log the incoming request data
        print(f"Prescription creation request data: {request.data}")
        print(f"Reason field in request: {request.data.get('reason')}")
        
        response = super().create(request, *args, **kwargs)
        if hasattr(self, 'conflict_warning') and self.conflict_warning:
            response.data['allergy_warning'] = self.conflict_warning
        return response

class PrescriptionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PrescriptionSerializer
    
    def get_queryset(self):
        # Doctors and admins can see all prescriptions
        # Other roles can only see their own prescriptions
        user = self.request.user
        if hasattr(user, 'role') and user.role in ['doctor', 'admin']:
            return Prescription.objects.all()
        return Prescription.objects.filter(prescriber=user)

@api_view(['GET'])
def prescription_stats(request):
    # Doctors and admins see stats for all prescriptions
    # Other roles see stats only for their own prescriptions
    user = request.user
    if hasattr(user, 'role') and user.role in ['doctor', 'admin']:
        user_prescriptions = Prescription.objects.all()
    else:
        user_prescriptions = Prescription.objects.filter(prescriber=user)
    
    active_prescriptions = user_prescriptions.filter(status='active').count()
    expired_prescriptions = user_prescriptions.filter(status='expired').count()
    completed_prescriptions = user_prescriptions.filter(status='completed').count()
    cancelled_prescriptions = user_prescriptions.filter(status='cancelled').count()
    # If you have a 'pending' status, include it; otherwise, set to 0
    pending_prescriptions = user_prescriptions.filter(status='pending').count() if 'pending' in dict(Prescription.STATUS_CHOICES) else 0
    total_prescriptions = user_prescriptions.count()

    return Response({
        'total_prescriptions': total_prescriptions,
        'active_prescriptions': active_prescriptions,
        'expired_prescriptions': expired_prescriptions,
        'completed_prescriptions': completed_prescriptions,
        'cancelled_prescriptions': cancelled_prescriptions,
        'pending_prescriptions': pending_prescriptions,
    })
