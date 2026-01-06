#!/usr/bin/env python
import os
import sys
import django

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import User

def create_test_user():
    try:
        # Check if test user already exists
        user = User.objects.filter(username='doctor@test.com').first()
        if user:
            print(f"Test user already exists: {user.username}")
            return
        
        # Create test user
        user = User.objects.create_user(
            username='doctor@test.com',
            email='doctor@test.com',
            password='testpass123',
            first_name='Dr. John',
            last_name='Smith',
            role='doctor',
            license_number='MD123456'
        )
        print(f"Test user created successfully: {user.username}")
        print("Login credentials:")
        print("Email: doctor@test.com")
        print("Password: testpass123")
        
    except Exception as e:
        print(f"Error creating test user: {e}")

if __name__ == '__main__':
    create_test_user() 