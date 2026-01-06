import csv
import os
from decimal import Decimal, InvalidOperation
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from drugs.models import Drug, Allergy, DrugInteraction


class Command(BaseCommand):
    help = 'Import medications from CSV file'

    def add_arguments(self, parser):
        parser.add_argument(
            'csv_file',
            type=str,
            help='Path to the CSV file containing medication data'
        )
        parser.add_argument(
            '--update',
            action='store_true',
            help='Update existing medications instead of skipping them',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear all existing medications before importing',
        )
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Confirm destructive actions (e.g. --clear) without prompting',
        )

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        
        if not os.path.exists(csv_file):
            raise CommandError(f'CSV file "{csv_file}" does not exist.')

        if options['clear']:
            proceed = False
            if options.get('yes'):
                proceed = True
            else:
                confirm = input('This will delete ALL existing medications. Type "yes" to confirm: ')
                proceed = confirm.lower() == 'yes'
            if proceed:
                Drug.objects.all().delete()
                self.stdout.write(
                    self.style.WARNING('All existing medications have been deleted.')
                )

        try:
            with open(csv_file, 'r', encoding='utf-8') as file:
                # Try to detect delimiter
                sample = file.read(1024)
                file.seek(0)
                sniffer = csv.Sniffer()
                delimiter = sniffer.sniff(sample).delimiter
                
                reader = csv.DictReader(file, delimiter=delimiter)
                
                # Validate required columns
                required_columns = [
                    'name', 'generic_name', 'strength', 'form', 'category',
                    'manufacturer', 'dosage_instructions', 'availability'
                ]
                
                missing_columns = [col for col in required_columns if col not in reader.fieldnames]
                if missing_columns:
                    raise CommandError(f'Missing required columns: {", ".join(missing_columns)}')
                
                created_count = 0
                updated_count = 0
                skipped_count = 0
                error_count = 0
                
                def parse_decimal(value):
                    if value is None:
                        return None
                    value = str(value).strip()
                    if value == '':
                        return None
                    try:
                        return Decimal(value)
                    except (InvalidOperation, ValueError):
                        return None

                def parse_bool(value):
                    if value is None:
                        return None
                    value = str(value).strip().lower()
                    if value in ['true', '1', 'yes', 'y']:
                        return True
                    if value in ['false', '0', 'no', 'n']:
                        return False
                    return None

                # Known allergy keyword mapping to normalized Allergy names
                allergy_keyword_map = {
                    'penicillin': 'Penicillin',
                    'amoxicillin': 'Amoxicillin',
                    'ampicillin': 'Ampicillin',
                    'macrolide': 'Macrolides',
                    'azithromycin': 'Azithromycin',
                    'quinolone': 'Quinolones',
                    'ciprofloxacin': 'Ciprofloxacin',
                    'sulfa': 'Sulfonamides',
                    'sulfonamide': 'Sulfonamides',
                    'nsaid': 'NSAID',
                    'ibuprofen': 'Ibuprofen',
                    'aspirin': 'Aspirin',
                    'acetaminophen': 'Acetaminophen',
                    'paracetamol': 'Acetaminophen',
                    'statin': 'Statins',
                    'lisinopril': 'Lisinopril',
                    'ace inhibitor': 'ACE Inhibitors',
                    'beta blocker': 'Beta Blockers',
                    'calcium channel blocker': 'Calcium Channel Blockers',
                }

                with transaction.atomic():
                    for row_num, row in enumerate(reader, start=2):  # Start at 2 because row 1 is headers
                        try:
                            # Clean and validate data
                            name = row['name'].strip()
                            if not name:
                                self.stdout.write(
                                    self.style.ERROR(f'Row {row_num}: Name is required')
                                )
                                error_count += 1
                                continue
                            
                            # Validate form choice
                            form = row.get('form', '').strip().lower()
                            valid_forms = ['tablet', 'capsule', 'liquid', 'injection', 'cream', 'ointment', 'inhaler', 'drops']
                            if form not in valid_forms:
                                self.stdout.write(
                                    self.style.ERROR(f'Row {row_num}: Invalid form "{form}". Must be one of: {", ".join(valid_forms)}')
                                )
                                error_count += 1
                                continue
                            
                            # Validate availability choice
                            availability = row.get('availability', 'available').strip().lower()
                            valid_availability = ['available', 'out_of_stock', 'discontinued']
                            if availability not in valid_availability:
                                availability = 'available'  # Default to available
                            
                            # Prepare drug data
                            drug_data = {
                                'name': name,
                                'generic_name': row.get('generic_name', name).strip(),
                                'strength': row.get('strength', '').strip(),
                                'form': form,
                                'category': row.get('category', '').strip(),
                                'manufacturer': row.get('manufacturer', '').strip(),
                                'dosage_instructions': row.get('dosage_instructions', '').strip(),
                                'side_effects': row.get('side_effects', '').strip(),
                                'contraindications': row.get('contraindications', '').strip(),
                                'interactions': row.get('interactions', '').strip(),
                                'availability': availability,
                                'therapeutic_class': row.get('therapeutic_class', '').strip(),
                            }
                            
                            # Numeric/boolean optional fields
                            drug_data['price'] = parse_decimal(row.get('price'))
                            drug_data['min_dose_mg'] = parse_decimal(row.get('min_dose_mg'))
                            drug_data['max_dose_mg'] = parse_decimal(row.get('max_dose_mg'))
                            drug_data['pediatric_dose_mg_kg'] = parse_decimal(row.get('pediatric_dose_mg_kg'))
                            # Multipliers default to 1.00 in model; only set if present
                            geriatric = parse_decimal(row.get('geriatric_dose_multiplier'))
                            if geriatric is not None:
                                drug_data['geriatric_dose_multiplier'] = geriatric
                            kidney_mult = parse_decimal(row.get('kidney_impairment_multiplier'))
                            if kidney_mult is not None:
                                drug_data['kidney_impairment_multiplier'] = kidney_mult
                            liver_mult = parse_decimal(row.get('liver_impairment_multiplier'))
                            if liver_mult is not None:
                                drug_data['liver_impairment_multiplier'] = liver_mult
                            preg_cat = row.get('pregnancy_category')
                            drug_data['pregnancy_category'] = preg_cat.strip() if isinstance(preg_cat, str) and preg_cat.strip() else None
                            breastfeeding_safe = parse_bool(row.get('breastfeeding_safe'))
                            if breastfeeding_safe is not None:
                                drug_data['breastfeeding_safe'] = breastfeeding_safe
                            
                            # Check if drug already exists
                            existing_drug = Drug.objects.filter(
                                name=name,
                                strength=drug_data['strength'],
                                form=form
                            ).first()
                            
                            if existing_drug:
                                if options['update']:
                                    # Update existing drug
                                    for key, value in drug_data.items():
                                        setattr(existing_drug, key, value)
                                    existing_drug.save()
                                    updated_count += 1
                                    self.stdout.write(f'Updated: {name} {drug_data["strength"]} {form}')
                                    drug = existing_drug
                                else:
                                    skipped_count += 1
                                    self.stdout.write(f'Skipped: {name} {drug_data["strength"]} {form} (already exists)')
                                    drug = None
                            else:
                                # Create new drug
                                drug = Drug.objects.create(**drug_data)
                                created_count += 1
                                self.stdout.write(
                                    self.style.SUCCESS(f'Created: {name} {drug_data["strength"]} {form}')
                                )
                            
                            # If we have a drug instance (created/updated), handle M2M and derived data
                            if drug:
                                # Ensure an allergy with the same name exists and is linked
                                auto_allergy, _ = Allergy.objects.get_or_create(
                                    name=drug.name,
                                    defaults={'description': f'Auto-created allergy for {drug.name}'}
                                )
                                if auto_allergy not in drug.allergy_conflicts.all():
                                    drug.allergy_conflicts.add(auto_allergy)

                                # Handle explicit allergy_conflicts column if present
                                if 'allergy_conflicts' in reader.fieldnames:
                                    raw_conflicts = row.get('allergy_conflicts') or ''
                                    conflict_names = [c.strip() for c in raw_conflicts.split(',') if c and c.strip()]
                                    if conflict_names:
                                        allergy_objs = []
                                        for allergy_name in conflict_names:
                                            allergy_obj, _ = Allergy.objects.get_or_create(
                                                name=allergy_name,
                                                defaults={'description': f'Imported from CSV for {drug.name}'}
                                            )
                                            allergy_objs.append(allergy_obj)
                                        drug.allergy_conflicts.add(*allergy_objs)

                                # Derive allergy conflicts from contraindications text if present
                                contraindications_text = (row.get('contraindications') or '').lower()
                                derived_allergies = []
                                if contraindications_text:
                                    for keyword, allergy_name in allergy_keyword_map.items():
                                        if keyword in contraindications_text:
                                            allergy_obj, _ = Allergy.objects.get_or_create(
                                                name=allergy_name,
                                                defaults={'description': f'Derived from contraindications for {drug.name}'}
                                            )
                                            derived_allergies.append(allergy_obj)
                                if derived_allergies:
                                    drug.allergy_conflicts.add(*derived_allergies)

                                # Auto-create drug interactions for same therapeutic_class (duplicate therapy warning)
                                if drug.therapeutic_class:
                                    same_class_drugs = Drug.objects.filter(therapeutic_class=drug.therapeutic_class).exclude(id=drug.id)
                                    for other in same_class_drugs:
                                        d1, d2 = (drug, other) if (drug.id < other.id) else (other, drug)
                                        DrugInteraction.objects.get_or_create(
                                            drug1=d1,
                                            drug2=d2,
                                            defaults={
                                                'severity': 'moderate',
                                                'description': f'Both drugs are {drug.therapeutic_class}s. Duplicate therapy may increase risk of side effects.',
                                                'recommended_action': 'Review necessity of duplicate therapy.'
                                            }
                                        )
                        
                        except Exception as e:
                            error_count += 1
                            self.stdout.write(
                                self.style.ERROR(f'Row {row_num}: Error processing {row.get("name", "Unknown")}: {str(e)}')
                            )
                
                # Summary
                self.stdout.write('\n' + '='*50)
                self.stdout.write(self.style.SUCCESS(f'Import completed!'))
                self.stdout.write(f'Created: {created_count} medications')
                self.stdout.write(f'Updated: {updated_count} medications')
                self.stdout.write(f'Skipped: {skipped_count} medications')
                if error_count > 0:
                    self.stdout.write(self.style.ERROR(f'Errors: {error_count} rows'))
                self.stdout.write('='*50)
                
        except Exception as e:
            raise CommandError(f'Error reading CSV file: {str(e)}')

