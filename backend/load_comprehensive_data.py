"""
Script to load comprehensive medicinal data from the complete CSV file
"""

import os
import sys
import django
import pandas as pd

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from drugs.models import Drug, Allergy

def load_comprehensive_drugs():
    """Load drugs with comprehensive fields from the complete CSV"""
    try:
        print("[INFO] Loading comprehensive drugs data...")
        
        # Load from the comprehensive CSV file
        csv_file = '../safeprescribe_meds/safeprescribe_medications_complete.csv'
        if not os.path.exists(csv_file):
            print(f"[ERROR] CSV file not found: {csv_file}")
            return
        
        # Read CSV file
        df = pd.read_csv(csv_file)
        print(f"[INFO] Found {len(df)} drugs in comprehensive CSV file")
        
        created_count = 0
        updated_count = 0
        
        for index, row in df.iterrows():
            try:
                # Check if drug already exists
                existing_drug = Drug.objects.filter(
                    name=row.get('name', ''),
                    strength=row.get('strength', '')
                ).first()
                
                if existing_drug:
                    # Update existing drug with comprehensive data
                    existing_drug.generic_name = row.get('generic_name', '')
                    existing_drug.form = row.get('form', 'tablet')
                    existing_drug.category = row.get('category', '')
                    existing_drug.manufacturer = row.get('manufacturer', '')
                    existing_drug.dosage_instructions = row.get('dosage_instructions', '')
                    existing_drug.side_effects = row.get('side_effects', '')
                    existing_drug.contraindications = row.get('contraindications', '')
                    existing_drug.interactions = row.get('interactions', '')
                    existing_drug.therapeutic_class = row.get('therapeutic_class', '')
                    existing_drug.availability = row.get('availability', 'available')
                    existing_drug.price = float(row.get('price', 0)) if pd.notna(row.get('price', 0)) else 0
                    
                    # Set safety flags based on pregnancy category and breastfeeding
                    pregnancy_category = row.get('pregnancy_category', '')
                    breastfeeding_safe = row.get('breastfeeding_safe', False)
                    if isinstance(breastfeeding_safe, str):
                        breastfeeding_safe = breastfeeding_safe.lower() == 'true'
                    
                    existing_drug.pregnancy_safe = pregnancy_category in ['A', 'B']
                    existing_drug.breastfeeding_safe = breastfeeding_safe
                    existing_drug.pediatric_safe = True  # Default to safe unless contraindicated
                    existing_drug.geriatric_safe = True  # Default to safe unless contraindicated
                    
                    existing_drug.save()
                    updated_count += 1
                    
                else:
                    # Create new drug with comprehensive data
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
                        therapeutic_class=row.get('therapeutic_class', ''),
                        availability=row.get('availability', 'available'),
                        price=float(row.get('price', 0)) if pd.notna(row.get('price', 0)) else 0
                    )
                    
                    # Set safety flags
                    pregnancy_category = row.get('pregnancy_category', '')
                    breastfeeding_safe = row.get('breastfeeding_safe', False)
                    if isinstance(breastfeeding_safe, str):
                        breastfeeding_safe = breastfeeding_safe.lower() == 'true'
                    
                    drug.pregnancy_safe = pregnancy_category in ['A', 'B']
                    drug.breastfeeding_safe = breastfeeding_safe
                    drug.pediatric_safe = True
                    drug.geriatric_safe = True
                    drug.save()
                    
                    created_count += 1
                
                if (created_count + updated_count) % 10 == 0:
                    print(f"[PROGRESS] Processed {created_count + updated_count} drugs...")
                    
            except Exception as e:
                print(f"[ERROR] Failed to process drug {row.get('name', 'Unknown')}: {e}")
                continue
        
        print(f"[SUCCESS] Successfully processed {created_count + updated_count} drugs:")
        print(f"  - Created: {created_count}")
        print(f"  - Updated: {updated_count}")
        return created_count + updated_count
        
    except Exception as e:
        print(f"[ERROR] Failed to load comprehensive drugs: {e}")
        return 0

def main():
    """Main function to load comprehensive data"""
    print("[INFO] Starting comprehensive data loading process...")
    
    # Load comprehensive data
    drugs_processed = load_comprehensive_drugs()
    
    # Summary
    print(f"\n[SUMMARY] Comprehensive data loading complete:")
    print(f"  - Drugs processed: {drugs_processed}")
    
    # Final database counts
    total_drugs = Drug.objects.count()
    total_allergies = Allergy.objects.count()
    
    print(f"\n[FINAL] Database now contains:")
    print(f"  - Total drugs: {total_drugs}")
    print(f"  - Total allergies: {total_allergies}")

if __name__ == "__main__":
    main()
