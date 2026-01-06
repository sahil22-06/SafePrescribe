from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Avg, Q, Sum
from django.utils import timezone
from datetime import datetime, timedelta
from patients.models import Patient, PatientAllergy
from drugs.models import Drug, Allergy, DrugInteraction
from rx.models import Prescription, PrescriptionMedication, MedicationAdherence, PatientMedicationHistory
from analytics.models import PrescriptionAnalytics, AllergyPatternAnalysis, SafetyScoreAnalytics, UsageStatistics, DrugInteractionAnalytics


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def prescription_trends_dashboard(request):
    """Get comprehensive prescription trends and analytics"""
    try:
        # Date range (last 30 days by default)
        days = int(request.GET.get('days', 30))
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        
        # Get prescriptions in date range
        prescriptions = Prescription.objects.filter(
            prescribed_date__range=[start_date, end_date],
            prescriber=request.user
        )
        
        # Basic prescription stats
        total_prescriptions = prescriptions.count()
        active_prescriptions = prescriptions.filter(status='active').count()
        completed_prescriptions = prescriptions.filter(status='completed').count()
        cancelled_prescriptions = prescriptions.filter(status='cancelled').count()
        expired_prescriptions = prescriptions.filter(status='expired').count()
        
        # Drug category breakdown
        category_stats = {}
        for prescription in prescriptions:
            for med in prescription.prescription_medications.all():
                category = med.drug.category
                category_stats[category] = category_stats.get(category, 0) + 1
        
        # Safety metrics
        allergy_warnings = 0
        interaction_warnings = 0
        duplicate_therapy_warnings = 0
        
        for prescription in prescriptions:
            patient = prescription.patient
            patient_allergies = set(patient.allergies.values_list('id', flat=True))
            
            for med in prescription.prescription_medications.all():
                drug = med.drug
                # Check allergy conflicts
                if drug.allergy_conflicts.filter(id__in=patient_allergies).exists():
                    allergy_warnings += 1
                
                # Check drug interactions
                other_meds = prescription.prescription_medications.exclude(id=med.id)
                for other_med in other_meds:
                    if DrugInteraction.objects.filter(
                        Q(drug1=drug, drug2=other_med.drug) | Q(drug1=other_med.drug, drug2=drug)
                    ).exists():
                        interaction_warnings += 1
        
        # Adherence metrics
        adherence_records = MedicationAdherence.objects.filter(
            patient__doctor=request.user,
            date__range=[start_date, end_date]
        )
        average_adherence = adherence_records.aggregate(avg=Avg('taken'))['avg'] or 0
        low_adherence_patients = Patient.objects.filter(
            doctor=request.user,
            adherence_score__lt=0.7
        ).count()
        
        # Daily trends
        daily_stats = []
        for i in range(days):
            date = end_date - timedelta(days=i)
            daily_prescriptions = prescriptions.filter(prescribed_date=date).count()
            daily_stats.append({
                'date': date.strftime('%Y-%m-%d'),
                'prescriptions': daily_prescriptions
            })
        
        return Response({
            'date_range': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'days': days
            },
            'prescription_stats': {
                'total': total_prescriptions,
                'active': active_prescriptions,
                'completed': completed_prescriptions,
                'cancelled': cancelled_prescriptions,
                'expired': expired_prescriptions
            },
            'category_breakdown': category_stats,
            'safety_metrics': {
                'allergy_warnings': allergy_warnings,
                'interaction_warnings': interaction_warnings,
                'duplicate_therapy_warnings': duplicate_therapy_warnings
            },
            'adherence_metrics': {
                'average_adherence_score': round(average_adherence * 100, 2),
                'low_adherence_patients_count': low_adherence_patients
            },
            'daily_trends': daily_stats
        })
        
    except Exception as e:
        return Response({
            'error': f'Error generating prescription trends: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def allergy_pattern_analysis(request):
    """Analyze allergy patterns across patient population"""
    try:
        patients = Patient.objects.filter(doctor=request.user)
        total_patients = patients.count()
        
        # Get all allergies and their frequency
        allergy_stats = {}
        for patient in patients:
            for allergy in patient.allergies.all():
                if allergy.name not in allergy_stats:
                    allergy_stats[allergy.name] = {
                        'count': 0,
                        'patients': [],
                        'age_groups': {'pediatric': 0, 'adult': 0, 'geriatric': 0},
                        'gender_distribution': {'M': 0, 'F': 0, 'O': 0},
                        'severity_distribution': {'mild': 0, 'moderate': 0, 'severe': 0}
                    }
                
                allergy_stats[allergy.name]['count'] += 1
                allergy_stats[allergy.name]['patients'].append(patient.id)
                
                # Age group analysis
                if patient.age < 18:
                    allergy_stats[allergy.name]['age_groups']['pediatric'] += 1
                elif patient.age < 65:
                    allergy_stats[allergy.name]['age_groups']['adult'] += 1
                else:
                    allergy_stats[allergy.name]['age_groups']['geriatric'] += 1
                
                # Gender distribution
                allergy_stats[allergy.name]['gender_distribution'][patient.gender] += 1
                
                # Severity analysis (from PatientAllergy)
                patient_allergy = PatientAllergy.objects.get(patient=patient, allergy=allergy)
                severity = patient_allergy.severity or 'moderate'
                allergy_stats[allergy.name]['severity_distribution'][severity] += 1
        
        # Find common drug conflicts for each allergy
        for allergy_name, stats in allergy_stats.items():
            allergy = Allergy.objects.get(name=allergy_name)
            conflicting_drugs = Drug.objects.filter(allergy_conflicts=allergy)
            stats['common_drug_conflicts'] = list(conflicting_drugs.values_list('name', flat=True)[:5])
            stats['percentage_of_population'] = round((stats['count'] / total_patients) * 100, 2)
            
            # Find most common age group
            age_groups = stats['age_groups']
            stats['most_common_age_group'] = max(age_groups, key=age_groups.get)
        
        # Sort by frequency
        sorted_allergies = sorted(allergy_stats.items(), key=lambda x: x[1]['count'], reverse=True)
        
        return Response({
            'total_patients': total_patients,
            'allergies_analyzed': len(allergy_stats),
            'allergy_patterns': dict(sorted_allergies),
            'summary': {
                'most_common_allergy': sorted_allergies[0][0] if sorted_allergies else None,
                'total_allergies_recorded': sum(stats['count'] for stats in allergy_stats.values()),
                'average_allergies_per_patient': round(sum(stats['count'] for stats in allergy_stats.values()) / total_patients, 2) if total_patients > 0 else 0
            }
        })
        
    except Exception as e:
        return Response({
            'error': f'Error analyzing allergy patterns: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def safety_score_analytics(request):
    """Analyze safety scores and trends"""
    try:
        # Date range
        days = int(request.GET.get('days', 30))
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        
        prescriptions = Prescription.objects.filter(
            prescribed_date__range=[start_date, end_date],
            prescriber=request.user
        )
        
        safety_scores = []
        safety_by_category = {}
        
        for prescription in prescriptions:
            patient = prescription.patient
            patient_allergies = set(patient.allergies.values_list('id', flat=True))
            
            for med in prescription.prescription_medications.all():
                drug = med.drug
                safety_score = 1.0
                
                # Check allergy conflicts
                if drug.allergy_conflicts.filter(id__in=patient_allergies).exists():
                    safety_score = 0.0
                
                # Check contraindications
                if drug.contraindications:
                    safety_score *= 0.9
                
                # Check pregnancy/breastfeeding
                if patient.pregnancy_status and drug.pregnancy_category in ['D', 'X']:
                    safety_score = 0.0
                elif patient.breastfeeding and not drug.breastfeeding_safe:
                    safety_score *= 0.8
                
                # Check age-specific issues
                if patient.age < 12 and not drug.pediatric_dose_mg_kg:
                    safety_score *= 0.9
                elif patient.age > 65:
                    safety_score *= 0.95
                
                # Check organ function
                if patient.kidney_function and 'impairment' in patient.kidney_function.lower():
                    safety_score *= 0.9
                if patient.liver_function and 'impairment' in patient.liver_function.lower():
                    safety_score *= 0.9
                
                safety_scores.append(safety_score)
                
                # Category breakdown
                category = drug.category
                if category not in safety_by_category:
                    safety_by_category[category] = []
                safety_by_category[category].append(safety_score)
        
        if not safety_scores:
            return Response({
                'message': 'No prescriptions found in the specified date range'
            })
        
        # Calculate statistics
        avg_safety_score = sum(safety_scores) / len(safety_scores)
        high_safety = len([s for s in safety_scores if s >= 0.8])
        medium_safety = len([s for s in safety_scores if 0.6 <= s < 0.8])
        low_safety = len([s for s in safety_scores if s < 0.6])
        contraindicated = len([s for s in safety_scores if s == 0])
        
        # Category averages
        category_averages = {}
        for category, scores in safety_by_category.items():
            category_averages[category] = round(sum(scores) / len(scores), 3)
        
        # Top safety issues
        top_issues = []
        if contraindicated > 0:
            top_issues.append(f"{contraindicated} contraindicated prescriptions")
        if low_safety > 0:
            top_issues.append(f"{low_safety} low safety prescriptions")
        
        return Response({
            'date_range': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'days': days
            },
            'overall_stats': {
                'average_safety_score': round(avg_safety_score, 3),
                'high_safety_prescriptions': high_safety,
                'medium_safety_prescriptions': medium_safety,
                'low_safety_prescriptions': low_safety,
                'contraindicated_prescriptions': contraindicated,
                'total_prescriptions_analyzed': len(safety_scores)
            },
            'safety_by_category': category_averages,
            'top_safety_issues': top_issues
        })
        
    except Exception as e:
        return Response({
            'error': f'Error analyzing safety scores: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def usage_statistics(request):
    """Get detailed medication usage statistics"""
    try:
        # Date range
        days = int(request.GET.get('days', 30))
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        
        # Get all medications prescribed in date range
        prescription_meds = PrescriptionMedication.objects.filter(
            prescription__prescribed_date__range=[start_date, end_date],
            prescription__prescriber=request.user
        )
        
        drug_stats = {}
        
        for med in prescription_meds:
            drug = med.drug
            if drug.name not in drug_stats:
                drug_stats[drug.name] = {
                    'drug_id': drug.id,
                    'category': drug.category,
                    'therapeutic_class': drug.therapeutic_class,
                    'prescriptions_count': 0,
                    'total_quantity': 0,
                    'total_dosages': [],
                    'durations': [],
                    'pediatric_usage': 0,
                    'adult_usage': 0,
                    'geriatric_usage': 0,
                    'allergy_conflicts': 0,
                    'interaction_warnings': 0,
                    'safety_scores': [],
                    'adherence_scores': []
                }
            
            stats = drug_stats[drug.name]
            stats['prescriptions_count'] += 1
            stats['total_quantity'] += med.quantity
            
            # Dosage analysis
            try:
                dosage = float(med.dosage.replace('mg', '').replace('mcg', ''))
                stats['total_dosages'].append(dosage)
            except:
                pass
            
            # Duration analysis
            try:
                duration = med.duration.lower()
                if 'day' in duration:
                    days_match = duration.split('day')[0].strip()
                    if days_match.isdigit():
                        stats['durations'].append(int(days_match))
            except:
                pass
            
            # Age group analysis
            patient = med.prescription.patient
            if patient.age < 18:
                stats['pediatric_usage'] += 1
            elif patient.age < 65:
                stats['adult_usage'] += 1
            else:
                stats['geriatric_usage'] += 1
            
            # Safety analysis
            patient_allergies = set(patient.allergies.values_list('id', flat=True))
            if drug.allergy_conflicts.filter(id__in=patient_allergies).exists():
                stats['allergy_conflicts'] += 1
            
            # Check interactions with other meds in same prescription
            other_meds = med.prescription.prescription_medications.exclude(id=med.id)
            for other_med in other_meds:
                if DrugInteraction.objects.filter(
                    Q(drug1=drug, drug2=other_med.drug) | Q(drug1=other_med.drug, drug2=drug)
                ).exists():
                    stats['interaction_warnings'] += 1
            
            # Calculate safety score
            safety_score = 1.0
            if drug.allergy_conflicts.filter(id__in=patient_allergies).exists():
                safety_score = 0.0
            elif drug.contraindications:
                safety_score *= 0.9
            stats['safety_scores'].append(safety_score)
            
            # Adherence analysis
            adherence_records = MedicationAdherence.objects.filter(
                prescription_medication=med
            )
            if adherence_records.exists():
                avg_adherence = adherence_records.aggregate(avg=Avg('taken'))['avg'] or 0
                stats['adherence_scores'].append(avg_adherence)
        
        # Calculate averages and summaries
        for drug_name, stats in drug_stats.items():
            # Average dosage
            if stats['total_dosages']:
                stats['average_dosage'] = round(sum(stats['total_dosages']) / len(stats['total_dosages']), 2)
            else:
                stats['average_dosage'] = 0
            
            # Average duration
            if stats['durations']:
                stats['average_duration_days'] = round(sum(stats['durations']) / len(stats['durations']), 2)
            else:
                stats['average_duration_days'] = 0
            
            # Average safety score
            if stats['safety_scores']:
                stats['average_safety_score'] = round(sum(stats['safety_scores']) / len(stats['safety_scores']), 3)
            else:
                stats['average_safety_score'] = 0
            
            # Average adherence score
            if stats['adherence_scores']:
                stats['average_adherence_score'] = round(sum(stats['adherence_scores']) / len(stats['adherence_scores']), 3)
            else:
                stats['average_adherence_score'] = 0
            
            # Remove lists to reduce response size
            del stats['total_dosages']
            del stats['durations']
            del stats['safety_scores']
            del stats['adherence_scores']
        
        # Sort by prescription count
        sorted_stats = sorted(drug_stats.items(), key=lambda x: x[1]['prescriptions_count'], reverse=True)
        
        return Response({
            'date_range': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'days': days
            },
            'summary': {
                'total_drugs_analyzed': len(drug_stats),
                'total_prescriptions': sum(stats['prescriptions_count'] for stats in drug_stats.values()),
                'most_prescribed_drug': sorted_stats[0][0] if sorted_stats else None
            },
            'usage_statistics': dict(sorted_stats)
        })
        
    except Exception as e:
        return Response({
            'error': f'Error generating usage statistics: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def drug_interaction_analytics(request):
    """Analyze drug interaction patterns"""
    try:
        # Date range
        days = int(request.GET.get('days', 30))
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        
        prescriptions = Prescription.objects.filter(
            prescribed_date__range=[start_date, end_date],
            prescriber=request.user
        )
        
        interaction_patterns = {}
        
        for prescription in prescriptions:
            meds = list(prescription.prescription_medications.all())
            
            # Check all pairs of medications
            for i in range(len(meds)):
                for j in range(i + 1, len(meds)):
                    drug1, drug2 = meds[i].drug, meds[j].drug
                    
                    # Ensure consistent ordering
                    if drug1.id > drug2.id:
                        drug1, drug2 = drug2, drug1
                    
                    key = f"{drug1.name} + {drug2.name}"
                    
                    if key not in interaction_patterns:
                        interaction_patterns[key] = {
                            'drug1_id': drug1.id,
                            'drug1_name': drug1.name,
                            'drug2_id': drug2.id,
                            'drug2_name': drug2.name,
                            'co_prescription_count': 0,
                            'interaction_warnings_count': 0,
                            'severity_distribution': {'minor': 0, 'moderate': 0, 'major': 0, 'contraindicated': 0},
                            'affected_patients': set(),
                            'patient_ages': [],
                            'dose_adjustments': 0,
                            'therapy_changes': 0
                        }
                    
                    pattern = interaction_patterns[key]
                    pattern['co_prescription_count'] += 1
                    pattern['affected_patients'].add(prescription.patient.id)
                    pattern['patient_ages'].append(prescription.patient.age)
                    
                    # Check for interactions
                    interactions = DrugInteraction.objects.filter(
                        Q(drug1=drug1, drug2=drug2) | Q(drug1=drug2, drug2=drug1)
                    )
                    
                    if interactions.exists():
                        pattern['interaction_warnings_count'] += 1
                        for interaction in interactions:
                            pattern['severity_distribution'][interaction.severity] += 1
        
        # Convert sets to counts and calculate averages
        for key, pattern in interaction_patterns.items():
            pattern['affected_patients_count'] = len(pattern['affected_patients'])
            pattern['average_patient_age'] = round(sum(pattern['patient_ages']) / len(pattern['patient_ages']), 1)
            del pattern['affected_patients']
            del pattern['patient_ages']
        
        # Sort by co-prescription count
        sorted_patterns = sorted(interaction_patterns.items(), key=lambda x: x[1]['co_prescription_count'], reverse=True)
        
        return Response({
            'date_range': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'days': days
            },
            'summary': {
                'total_drug_combinations': len(interaction_patterns),
                'combinations_with_interactions': len([p for p in interaction_patterns.values() if p['interaction_warnings_count'] > 0]),
                'most_common_combination': sorted_patterns[0][0] if sorted_patterns else None
            },
            'interaction_patterns': dict(sorted_patterns)
        })
        
    except Exception as e:
        return Response({
            'error': f'Error analyzing drug interactions: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
