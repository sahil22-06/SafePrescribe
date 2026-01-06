#!/usr/bin/env python
"""
Create test data for medication conflict checking.
Run this script to set up test patients, medications, and allergies.
"""

import os
import sys
import django

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import User
from patients.models import Patient
from drugs.models import Drug, Allergy
from rx.models import Prescription, PrescriptionMedication

def create_test_data():
    """Create test data for conflict checking."""
    print("Creating test data for medication conflict checking...")
    
    # Create a test user
    user, created = User.objects.get_or_create(
        username='testuser',
        defaults={'email': 'test@example.com', 'first_name': 'Test', 'last_name': 'User'}
    )
    if created:
        user.set_password('testpass123')
        user.save()
        print("Created test user")
    else:
        print("Test user already exists")
    
    # Create a test patient with allergies
    patient, created = Patient.objects.get_or_create(
        first_name='John',
        last_name='Doe',
        defaults={
            'email': 'john.doe@example.com',
            'phone': '123-456-7890',
            'date_of_birth': '1990-01-01',
            'gender': 'M',
            'address': '123 Test St',
            'emergency_contact': '098-765-4321'
        }
    )
    if created:
        print("Created test patient")
    else:
        print("Test patient already exists")
    
    # Create test drugs
    drugs_data = [
        {
            'name': 'Warfarin',
            'generic_name': 'warfarin',
            'therapeutic_class': 'anticoagulant',
            'category': 'prescription',
            'form': 'tablet',
            'availability': 'available'
        },
        {
            'name': 'Aspirin',
            'generic_name': 'acetylsalicylic acid',
            'therapeutic_class': 'nsaid',
            'category': 'prescription',
            'form': 'tablet',
            'availability': 'available'
        },
        {
            'name': 'Amoxicillin',
            'generic_name': 'amoxicillin',
            'therapeutic_class': 'penicillin',
            'category': 'prescription',
            'form': 'capsule',
            'availability': 'available'
        },
        {
            'name': 'Ibuprofen',
            'generic_name': 'ibuprofen',
            'therapeutic_class': 'nsaid',
            'category': 'prescription',
            'form': 'tablet',
            'availability': 'available'
        }
    ]
    
    created_drugs = []
    for drug_data in drugs_data:
        drug = Drug.objects.filter(name=drug_data['name']).first()
        if not drug:
            drug = Drug.objects.create(**drug_data)
            print(f"Created drug: {drug.name}")
        else:
            print(f"Drug already exists: {drug.name}")
        created_drugs.append(drug)
    
    # Create test allergies
    allergies_data = [
        {
            'name': 'penicillin',
            'description': 'Allergic reaction to penicillin antibiotics'
        },
        {
            'name': 'aspirin',
            'description': 'Allergic reaction to aspirin and NSAIDs'
        }
    ]
    
    created_allergies = []
    for allergy_data in allergies_data:
        allergy = Allergy.objects.filter(name=allergy_data['name']).first()
        if not allergy:
            allergy = Allergy.objects.create(**allergy_data)
            print(f"Created allergy: {allergy.name}")
        else:
            print(f"Allergy already exists: {allergy.name}")
        created_allergies.append(allergy)
    
    # Create a prescription with warfarin for the patient
    prescription, created = Prescription.objects.get_or_create(
        patient=patient,
        prescriber=user,
        defaults={
            'prescribed_date': '2024-01-01',
            'expiry_date': '2024-12-31',
            'status': 'active',
            'instructions': 'Take as directed'
        }
    )
    
    if created:
        print("Created test prescription")
    else:
        print("Test prescription already exists")
    
    # Add warfarin to prescription
    warfarin = created_drugs[0]  # Warfarin
    prescription_med, created = PrescriptionMedication.objects.get_or_create(
        prescription=prescription,
        drug=warfarin,
        defaults={
            'dosage': '5mg',
            'frequency': 'Once daily',
            'duration': '30 days',
            'quantity': 30,
            'refills': 2
        }
    )
    
    if created:
        print(f"Added {warfarin.name} to prescription")
    else:
        print(f"{warfarin.name} already in prescription")
    
    print("\nTest Data Summary:")
    print(f"- Patient: {patient.first_name} {patient.last_name} (ID: {patient.id})")
    print(f"- Current Medication: {warfarin.name} (ID: {warfarin.id})")
    print(f"- Available Drugs:")
    for drug in created_drugs:
        print(f"  - {drug.name} (ID: {drug.id})")
    print(f"- Available Allergies:")
    for allergy in created_allergies:
        print(f"  - {allergy.name} (ID: {allergy.id})")
    
    print("\nTest Cases:")
    print("1. Try adding Aspirin (ID: 2) - should conflict with Warfarin")
    print("2. Try adding Amoxicillin (ID: 3) - should conflict with penicillin allergy")
    print("3. Try adding Ibuprofen (ID: 4) - should conflict with Warfarin")
    
    return patient, created_drugs, created_allergies

if __name__ == '__main__':
    create_test_data()
