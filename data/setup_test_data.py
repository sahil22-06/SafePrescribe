#!/usr/bin/env python
"""
Quick Setup Script for SafePrescribe Testing
Run this script to create test data for all advanced features
"""

import os
import sys
import django
from datetime import date, timedelta

# Add the backend directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import User
from patients.models import Patient, Allergy, PatientAllergy
from drugs.models import Drug, DrugInteraction
from rx.models import Prescription, PrescriptionMedication, MedicationAdherence
from django.utils import timezone

def create_test_data():
    print("🚀 Setting up SafePrescribe test data...")
    
    # Create test doctor
    doctor, created = User.objects.get_or_create(
        username='testdoctor',
        defaults={
            'email': 'doctor@test.com',
            'first_name': 'Dr. John',
            'last_name': 'Smith',
            'role': 'doctor'
        }
    )
    if created:
        doctor.set_password('testpass123')
        doctor.save()
        print("✅ Created test doctor: testdoctor / testpass123")
    else:
        print("✅ Test doctor already exists")
    
    # Create test allergies
    allergies = []
    allergy_names = ['Penicillin', 'Sulfa', 'NSAID', 'Latex', 'Aspirin']
    for name in allergy_names:
        allergy, created = Allergy.objects.get_or_create(name=name)
        allergies.append(allergy)
        if created:
            print(f"✅ Created allergy: {name}")
    
    # Create test patients with different characteristics
    patients_data = [
        {
            'first_name': 'Emma',
            'last_name': 'Johnson',
            'date_of_birth': date(2015, 6, 15),
            'gender': 'F',
            'phone': '555-0101',
            'email': 'emma@test.com',
            'address': '123 Child St',
            'weight_kg': 25.5,
            'height_cm': 120.0,
            'blood_type': 'A+',
            'kidney_function': 'Normal',
            'liver_function': 'Normal',
            'pregnancy_status': False,
            'breastfeeding': False,
            'adherence_score': 0.95,
            'description': 'Pediatric patient'
        },
        {
            'first_name': 'Michael',
            'last_name': 'Brown',
            'date_of_birth': date(1985, 3, 22),
            'gender': 'M',
            'phone': '555-0102',
            'email': 'michael@test.com',
            'address': '456 Adult Ave',
            'weight_kg': 75.0,
            'height_cm': 175.0,
            'blood_type': 'O+',
            'kidney_function': 'Normal',
            'liver_function': 'Normal',
            'pregnancy_status': False,
            'breastfeeding': False,
            'adherence_score': 0.85,
            'description': 'Adult patient with allergies',
            'allergies': ['Penicillin', 'NSAID']
        },
        {
            'first_name': 'Sarah',
            'last_name': 'Wilson',
            'date_of_birth': date(1940, 12, 8),
            'gender': 'F',
            'phone': '555-0103',
            'email': 'sarah@test.com',
            'address': '789 Elder Rd',
            'weight_kg': 65.0,
            'height_cm': 160.0,
            'blood_type': 'B+',
            'kidney_function': 'Mild impairment',
            'liver_function': 'Normal',
            'pregnancy_status': False,
            'breastfeeding': False,
            'adherence_score': 0.70,
            'description': 'Geriatric patient with kidney impairment',
            'allergies': ['Sulfa']
        },
        {
            'first_name': 'Jennifer',
            'last_name': 'Davis',
            'date_of_birth': date(1990, 8, 14),
            'gender': 'F',
            'phone': '555-0104',
            'email': 'jennifer@test.com',
            'address': '321 Pregnancy Ln',
            'weight_kg': 68.0,
            'height_cm': 165.0,
            'blood_type': 'AB+',
            'kidney_function': 'Normal',
            'liver_function': 'Normal',
            'pregnancy_status': True,
            'breastfeeding': False,
            'adherence_score': 0.90,
            'description': 'Pregnant patient'
        }
    ]
    
    patients = []
    for data in patients_data:
        allergies_list = data.pop('allergies', [])
        description = data.pop('description', '')
        
        patient, created = Patient.objects.get_or_create(
            doctor=doctor,
            first_name=data['first_name'],
            last_name=data['last_name'],
            defaults=data
        )
        patients.append(patient)
        
        if created:
            print(f"✅ Created {description}: {patient.first_name} {patient.last_name}")
            
            # Add allergies
            for allergy_name in allergies_list:
                allergy = Allergy.objects.get(name=allergy_name)
                PatientAllergy.objects.create(
                    patient=patient,
                    allergy=allergy,
                    severity='moderate'
                )
                print(f"   - Added allergy: {allergy_name}")
        else:
            print(f"✅ {description} already exists: {patient.first_name} {patient.last_name}")
    
    # Create sample prescriptions for testing analytics
    print("\n📊 Creating sample prescriptions for analytics testing...")
    
    # Get some drugs for prescriptions
    drugs = list(Drug.objects.all()[:10])  # Get first 10 drugs
    
    if len(drugs) >= 5:
        # Create prescriptions for different patients
        prescription_data = [
            {
                'patient': patients[0],  # Emma (pediatric)
                'reason': 'Headache and fever',
                'medications': [drugs[0], drugs[1]],  # First two drugs
                'days_ago': 5
            },
            {
                'patient': patients[1],  # Michael (adult with allergies)
                'reason': 'Bacterial infection',
                'medications': [drugs[2], drugs[3]],  # Next two drugs
                'days_ago': 3
            },
            {
                'patient': patients[2],  # Sarah (geriatric)
                'reason': 'Hypertension management',
                'medications': [drugs[4]],  # One drug
                'days_ago': 1
            },
            {
                'patient': patients[3],  # Jennifer (pregnant)
                'reason': 'Anxiety and stress',
                'medications': [drugs[5]],  # One drug
                'days_ago': 0
            }
        ]
        
        for data in prescription_data:
            prescribed_date = timezone.now().date() - timedelta(days=data['days_ago'])
            expiry_date = prescribed_date + timedelta(days=30)
            
            prescription = Prescription.objects.create(
                patient=data['patient'],
                prescriber=doctor,
                reason=data['reason'],
                prescribed_date=prescribed_date,
                expiry_date=expiry_date,
                status='active'
            )
            
            print(f"✅ Created prescription for {data['patient'].first_name}: {data['reason']}")
            
            # Add medications to prescription
            for i, drug in enumerate(data['medications']):
                PrescriptionMedication.objects.create(
                    prescription=prescription,
                    drug=drug,
                    dosage=f"{500 + i*50}mg",
                    frequency="twice daily",
                    duration="7 days",
                    quantity=14,
                    refills=1,
                    reason=f"Treatment for {data['reason']}"
                )
                print(f"   - Added medication: {drug.name}")
            
            # Create some adherence records
            for i in range(3):
                adherence_date = prescribed_date + timedelta(days=i+1)
                MedicationAdherence.objects.create(
                    prescription_medication=prescription.prescription_medications.first(),
                    patient=data['patient'],
                    date=adherence_date,
                    taken=True,
                    notes="Patient took medication as prescribed",
                    recorded_by=doctor
                )
    
    print("\n🎉 Test data setup complete!")
    print("\n📋 Test Credentials:")
    print("   Username: testdoctor")
    print("   Password: testpass123")
    print("\n🧪 Test Patients:")
    for i, patient in enumerate(patients, 1):
        print(f"   {i}. {patient.first_name} {patient.last_name} ({patient.date_of_birth.year})")
    
    print("\n🚀 Next Steps:")
    print("   1. Start frontend: cd frontend && npm start")
    print("   2. Login with testdoctor / testpass123")
    print("   3. Create prescriptions and test smart suggestions")
    print("   4. Check analytics dashboard")
    print("   5. Follow the complete testing guide in test_flow_guide.md")

if __name__ == "__main__":
    create_test_data()
