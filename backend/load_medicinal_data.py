"""
Load medicinal data from CSV files into the database
"""

import os
import sys
import django
import pandas as pd
from pathlib import Path

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from drugs.models import Drug, Allergy
from patients.models import Patient
import logging

logger = logging.getLogger(__name__)

def load_drugs_from_csv(csv_file_path):
    """Load drugs from CSV file into database"""
    try:
        print(f"[INFO] Loading drugs from: {csv_file_path}")
        
        # Read CSV file
        df = pd.read_csv(csv_file_path)
        print(f"[INFO] Found {len(df)} drugs in CSV file")
        
        # Check if drugs already exist
        existing_count = Drug.objects.count()
        if existing_count > 0:
            print(f"[WARNING] Database already has {existing_count} drugs. Skipping to avoid duplicates.")
            return
        
        # Load drugs
        created_count = 0
        for index, row in df.iterrows():
            try:
                # Create drug object
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
                    availability=row.get('availability', 'available'),
                    price=float(row.get('price', 0)) if pd.notna(row.get('price', 0)) else 0
                )
                
                created_count += 1
                if created_count % 10 == 0:
                    print(f"[PROGRESS] Loaded {created_count} drugs...")
                    
            except Exception as e:
                print(f"[ERROR] Failed to create drug {row.get('name', 'Unknown')}: {e}")
                continue
        
        print(f"[SUCCESS] Successfully loaded {created_count} drugs into database")
        return created_count
        
    except Exception as e:
        print(f"[ERROR] Failed to load drugs from CSV: {e}")
        return 0

def load_allergies_from_csv(csv_file_path):
    """Load allergies from CSV file into database"""
    try:
        print(f"[INFO] Loading allergies from: {csv_file_path}")
        
        # Read CSV file
        df = pd.read_csv(csv_file_path)
        print(f"[INFO] Found {len(df)} entries in CSV file")
        
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
            {'name': 'Soy', 'description': 'Allergic reaction to soy products'},
            {'name': 'Wheat', 'description': 'Allergic reaction to wheat and gluten'},
            {'name': 'Fish', 'description': 'Allergic reaction to fish'},
            {'name': 'Peanuts', 'description': 'Allergic reaction to peanuts'},
            {'name': 'Dust Mites', 'description': 'Allergic reaction to dust mites'},
            {'name': 'Pollen', 'description': 'Allergic reaction to pollen'},
            {'name': 'Mold', 'description': 'Allergic reaction to mold spores'},
            {'name': 'Animal Dander', 'description': 'Allergic reaction to animal dander'},
            {'name': 'Insect Stings', 'description': 'Allergic reaction to insect stings'},
            {'name': 'Medication', 'description': 'General medication allergy'},
            {'name': 'Contrast Dye', 'description': 'Allergic reaction to contrast dye used in medical imaging'}
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

def create_drug_allergy_conflicts():
    """Create drug-allergy conflict relationships"""
    try:
        print(f"[INFO] Creating drug-allergy conflicts...")
        
        # Get all drugs and allergies
        drugs = Drug.objects.all()
        allergies = Allergy.objects.all()
        
        if not drugs.exists() or not allergies.exists():
            print(f"[WARNING] No drugs or allergies found. Skipping conflict creation.")
            return
        
        conflict_count = 0
        
        # Create conflicts based on drug names and allergy names
        for drug in drugs:
            drug_name_lower = drug.name.lower()
            drug_generic_lower = drug.generic_name.lower() if drug.generic_name else ""
            
            for allergy in allergies:
                allergy_name_lower = allergy.name.lower()
                
                # Check for conflicts
                is_conflict = False
                
                # Direct name matches
                if allergy_name_lower in drug_name_lower or allergy_name_lower in drug_generic_lower:
                    is_conflict = True
                
                # Specific drug-allergy conflicts
                if allergy.name == 'Penicillin' and ('penicillin' in drug_name_lower or 'amoxicillin' in drug_name_lower or 'ampicillin' in drug_name_lower):
                    is_conflict = True
                elif allergy.name == 'Sulfa' and ('sulfa' in drug_name_lower or 'sulfonamide' in drug_name_lower):
                    is_conflict = True
                elif allergy.name == 'Aspirin' and ('aspirin' in drug_name_lower or 'salicylate' in drug_name_lower):
                    is_conflict = True
                elif allergy.name == 'Ibuprofen' and ('ibuprofen' in drug_name_lower or 'nsaid' in drug_name_lower):
                    is_conflict = True
                
                if is_conflict:
                    try:
                        drug.allergy_conflicts.add(allergy)
                        conflict_count += 1
                    except Exception as e:
                        print(f"[ERROR] Failed to create conflict between {drug.name} and {allergy.name}: {e}")
                        continue
        
        print(f"[SUCCESS] Created {conflict_count} drug-allergy conflicts")
        return conflict_count
        
    except Exception as e:
        print(f"[ERROR] Failed to create drug-allergy conflicts: {e}")
        return 0

def main():
    """Main function to load all medicinal data"""
    print("[INFO] Starting medicinal data loading process...")
    
    # Find CSV files
    csv_files = []
    for root, dirs, files in os.walk('..'):
        for file in files:
            if file.endswith('.csv') and ('med' in file.lower() or 'drug' in file.lower()):
                csv_files.append(os.path.join(root, file))
    
    if not csv_files:
        print("[ERROR] No medicinal CSV files found!")
        return
    
    print(f"[INFO] Found {len(csv_files)} CSV files:")
    for csv_file in csv_files:
        print(f"  - {csv_file}")
    
    # Load drugs from the most comprehensive CSV file
    main_csv = None
    for csv_file in csv_files:
        if 'complete' in csv_file.lower():
            main_csv = csv_file
            break
    
    if not main_csv:
        main_csv = csv_files[0]  # Use first CSV file
    
    print(f"[INFO] Using main CSV file: {main_csv}")
    
    # Load data
    drugs_loaded = load_drugs_from_csv(main_csv)
    allergies_loaded = load_allergies_from_csv(main_csv)
    conflicts_created = create_drug_allergy_conflicts()
    
    # Summary
    print(f"\n[SUMMARY] Data loading complete:")
    print(f"  - Drugs loaded: {drugs_loaded}")
    print(f"  - Allergies loaded: {allergies_loaded}")
    print(f"  - Conflicts created: {conflicts_created}")
    
    # Final database counts
    total_drugs = Drug.objects.count()
    total_allergies = Allergy.objects.count()
    
    print(f"\n[FINAL] Database now contains:")
    print(f"  - Total drugs: {total_drugs}")
    print(f"  - Total allergies: {total_allergies}")

if __name__ == "__main__":
    main()
