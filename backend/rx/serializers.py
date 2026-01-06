from rest_framework import serializers
from .models import Prescription, PrescriptionMedication
from patients.serializers import PatientSerializer
from drugs.serializers import DrugSerializer
from users.serializers import UserSerializer

class PrescriptionMedicationSerializer(serializers.ModelSerializer):
    drug_details = DrugSerializer(source='drug', read_only=True)
    drug = serializers.PrimaryKeyRelatedField(queryset=PrescriptionMedication._meta.get_field('drug').related_model.objects.all())
    class Meta:
        model = PrescriptionMedication
        fields = ['id', 'drug', 'drug_details', 'dosage', 'frequency', 'duration', 'quantity', 'refills']

class PrescriptionSerializer(serializers.ModelSerializer):
    patient_details = PatientSerializer(source='patient', read_only=True)
    prescriber_details = UserSerializer(source='prescriber', read_only=True)
    is_expired = serializers.ReadOnlyField()
    medications = PrescriptionMedicationSerializer(source='prescription_medications', many=True, required=False)
    
    class Meta:
        model = Prescription
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'prescriber']

    def create(self, validated_data):
        # Debug: Log the validated data
        print(f"PrescriptionSerializer create - validated_data: {validated_data}")
        print(f"Reason in validated_data: {validated_data.get('reason')}")
        print(f"All keys in validated_data: {list(validated_data.keys())}")
        
        meds_data = validated_data.pop('prescription_medications', [])
        print(f"After popping prescription_medications, validated_data: {validated_data}")
        
        prescription = Prescription.objects.create(**validated_data)
        
        # Debug: Log the created prescription
        print(f"Created prescription ID: {prescription.id}, Reason: {prescription.reason}")
        print(f"Prescription fields: {[field.name for field in prescription._meta.fields]}")
        
        # Create prescription medications
        for med in meds_data:
            PrescriptionMedication.objects.create(prescription=prescription, **med)
        
        return prescription

    def update(self, instance, validated_data):
        meds_data = validated_data.pop('medications', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if meds_data is not None:
            instance.prescription_medications.all().delete()
            for med in meds_data:
                PrescriptionMedication.objects.create(prescription=instance, **med)
        return instance 