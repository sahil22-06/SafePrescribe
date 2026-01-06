#!/usr/bin/env python
import os
import sys
import django

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from rx.models import Prescription

def check_prescription_25():
    print("Checking Prescription 25...")
    
    try:
        prescription = Prescription.objects.get(id=25)
        print(f"Found Prescription ID: {prescription.id}")
        print(f"Reason field: '{prescription.reason}'")
        print(f"Reason type: {type(prescription.reason)}")
        
        # Check if reason is in the database
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT reason FROM rx_prescription WHERE id = 25")
            result = cursor.fetchone()
            print(f"Direct DB query result: {result}")
            
    except Prescription.DoesNotExist:
        print("Prescription ID 25 not found")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_prescription_25()
