"""
Simple script to load medicinal data into the database
"""

import os
import sys
import django
import pandas as pd

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from drugs.models import Drug, Allergy

def load_simple_drugs():
    """Load drugs with basic fields only"""
    try:
        print("[INFO] Loading drugs with basic fields...")
        
        # Check if drugs already exist
        existing_count = Drug.objects.count()
        if existing_count > 0:
            print(f"[WARNING] Database already has {existing_count} drugs. Skipping to avoid duplicates.")
            return
        
        # Load from the simpler CSV file
        csv_file = '../data/sample_medications.csv'
        if not os.path.exists(csv_file):
            print(f"[ERROR] CSV file not found: {csv_file}")
            return
        
        # Read CSV file
        df = pd.read_csv(csv_file)
        print(f"[INFO] Found {len(df)} drugs in CSV file")
        
        created_count = 0
        for index, row in df.iterrows():
            try:
                # Create drug object with basic fields only
                drug = Drug.objects.create(
                    name=row.get('name', ''),
                    generic_name=row.get('generic_name', ''),
                    strength=row.get('strength', ''),
                    form=row.get('form', 'tablet'),
                    category=row.get('category', ''),
                    manufacturer=row.get('manufacturer', ''),
                    dosage_instructions=row.get('dosage_instructions', ''),
                    side_effects=row.get('side_effects', ''),
                    contraindications=row.get('contraindications', ''),
                    interactions=row.get('interactions', ''),
                    availability='available',
                    price=float(row.get('price', 0)) if pd.notna(row.get('price', 0)) else 0
                )
                
                created_count += 1
                if created_count % 5 == 0:
                    print(f"[PROGRESS] Loaded {created_count} drugs...")
                    
            except Exception as e:
                print(f"[ERROR] Failed to create drug {row.get('name', 'Unknown')}: {e}")
                continue
        
        print(f"[SUCCESS] Successfully loaded {created_count} drugs into database")
        return created_count
        
    except Exception as e:
        print(f"[ERROR] Failed to load drugs: {e}")
        return 0

def load_simple_allergies():
    """Load basic allergies"""
    try:
        print("[INFO] Loading basic allergies...")
        
        # Check if allergies already exist
        existing_count = Allergy.objects.count()
        if existing_count > 0:
            print(f"[WARNING] Database already has {existing_count} allergies. Skipping to avoid duplicates.")
            return
        
        # Common allergies to create
        common_allergies = [
            {'name': 'Penicillin', 'description': 'Allergic reaction to penicillin antibiotics'},
            {'name': 'Sulfa', 'description': 'Allergic reaction to sulfonamide antibiotics'},
            {'name': 'Aspirin', 'description': 'Allergic reaction to aspirin and NSAIDs'},
            {'name': 'Ibuprofen', 'description': 'Allergic reaction to ibuprofen and NSAIDs'},
            {'name': 'Latex', 'description': 'Allergic reaction to latex products'},
            {'name': 'Shellfish', 'description': 'Allergic reaction to shellfish'},
            {'name': 'Nuts', 'description': 'Allergic reaction to tree nuts'},
            {'name': 'Eggs', 'description': 'Allergic reaction to eggs'},
            {'name': 'Milk', 'description': 'Allergic reaction to dairy products'},
            {'name': 'Soy', 'description': 'Allergic reaction to soy products'}
        ]
        
        created_count = 0
        for allergy_data in common_allergies:
            try:
                allergy = Allergy.objects.create(
                    name=allergy_data['name'],
                    description=allergy_data['description']
                )
                created_count += 1
            except Exception as e:
                print(f"[ERROR] Failed to create allergy {allergy_data['name']}: {e}")
                continue
        
        print(f"[SUCCESS] Successfully loaded {created_count} allergies into database")
        return created_count
        
    except Exception as e:
        print(f"[ERROR] Failed to load allergies: {e}")
        return 0

def main():
    """Main function to load data"""
    print("[INFO] Starting simple data loading process...")
    
    # Load data
    drugs_loaded = load_simple_drugs()
    allergies_loaded = load_simple_allergies()
    
    # Summary
    print(f"\n[SUMMARY] Data loading complete:")
    print(f"  - Drugs loaded: {drugs_loaded}")
    print(f"  - Allergies loaded: {allergies_loaded}")
    
    # Final database counts
    total_drugs = Drug.objects.count()
    total_allergies = Allergy.objects.count()
    
    print(f"\n[FINAL] Database now contains:")
    print(f"  - Total drugs: {total_drugs}")
    print(f"  - Total allergies: {total_allergies}")

if __name__ == "__main__":
    main()







