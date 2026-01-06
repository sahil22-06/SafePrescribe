"""
Script to verify the medicinal data in the database
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from drugs.models import Drug, Allergy

def verify_data():
    """Verify the medicinal data in the database"""
    print("[INFO] Verifying medicinal data in database...")
    
    # Count drugs and allergies
    total_drugs = Drug.objects.count()
    total_allergies = Allergy.objects.count()
    
    print(f"[COUNT] Total drugs: {total_drugs}")
    print(f"[COUNT] Total allergies: {total_allergies}")
    
    if total_drugs > 0:
        # Check drugs with therapeutic class
        drugs_with_class = Drug.objects.exclude(therapeutic_class__isnull=True).exclude(therapeutic_class='').count()
        print(f"[COUNT] Drugs with therapeutic class: {drugs_with_class}")
        
        # Check safety flags
        pregnancy_safe = Drug.objects.filter(pregnancy_safe=True).count()
        breastfeeding_safe = Drug.objects.filter(breastfeeding_safe=True).count()
        pediatric_safe = Drug.objects.filter(pediatric_safe=True).count()
        geriatric_safe = Drug.objects.filter(geriatric_safe=True).count()
        
        print(f"[SAFETY] Pregnancy safe: {pregnancy_safe}")
        print(f"[SAFETY] Breastfeeding safe: {breastfeeding_safe}")
        print(f"[SAFETY] Pediatric safe: {pediatric_safe}")
        print(f"[SAFETY] Geriatric safe: {geriatric_safe}")
        
        # Show categories
        categories = Drug.objects.values_list('category', flat=True).distinct()
        print(f"\n[CATEGORIES] Found {len(categories)} drug categories:")
        for category in list(categories)[:10]:  # Show first 10
            if category:
                print(f"  - {category}")
        
        # Show sample drugs with details
        print(f"\n[SAMPLE] Sample drugs with details:")
        sample_drugs = Drug.objects.all()[:5]
        for drug in sample_drugs:
            print(f"  - {drug.name} ({drug.strength})")
            print(f"    Category: {drug.category}")
            print(f"    Therapeutic Class: {drug.therapeutic_class or 'N/A'}")
            print(f"    Pregnancy Safe: {drug.pregnancy_safe}")
            print(f"    Breastfeeding Safe: {drug.breastfeeding_safe}")
            print(f"    Price: ${drug.price}")
            print()
    
    if total_allergies > 0:
        print(f"[ALLERGIES] Sample allergies:")
        sample_allergies = Allergy.objects.all()[:5]
        for allergy in sample_allergies:
            print(f"  - {allergy.name}: {allergy.description}")
    
    print(f"\n[SUMMARY] Database verification complete!")
    print(f"  - Drugs: {total_drugs}")
    print(f"  - Allergies: {total_allergies}")

if __name__ == "__main__":
    verify_data()
