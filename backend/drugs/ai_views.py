"""
AI Suggestion API Views
Provides endpoints for AI-powered medication suggestions
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from .models import Drug, Allergy
from patients.models import Patient, PatientAllergy
from .ai_service import AISuggestionService
import logging

logger = logging.getLogger(__name__)

# Initialize AI service
ai_service = AISuggestionService()

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_enhanced_suggestions(request):
    """
    Get AI-enhanced medication suggestions
    """
    try:
        data = request.data
        
        # Validate required fields
        patient_id = data.get('patient_id')
        condition = data.get('condition', '')
        
        if not patient_id:
            return Response({
                'error': 'patient_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not condition:
            return Response({
                'error': 'condition is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get optional parameters
        excluded_drugs = data.get('excluded_drugs', [])
        max_suggestions = data.get('max_suggestions', 5)
        use_patient_similarity = data.get('use_patient_similarity', True)
        use_dosage_optimization = data.get('use_dosage_optimization', True)
        
        # Validate patient exists
        try:
            patient = Patient.objects.get(id=patient_id)
        except Patient.DoesNotExist:
            return Response({
                'error': 'Patient not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get AI suggestions
        suggestions = ai_service.get_ai_enhanced_suggestions(
            patient_id=patient_id,
            condition=condition,
            excluded_drugs=excluded_drugs,
            max_suggestions=max_suggestions,
            use_patient_similarity=use_patient_similarity,
            use_dosage_optimization=use_dosage_optimization
        )
        
        # Format response
        formatted_suggestions = []
        for suggestion in suggestions:
            drug = suggestion['drug']
            formatted_suggestions.append({
                'id': drug.id,
                'name': drug.name,
                'description': drug.description or '',
                'therapeutic_class': drug.therapeutic_class or '',
                'indications': drug.indications or '',
                'similarity_score': suggestion.get('similarity_score', 0),
                'safety_score': suggestion.get('safety_score', 0),
                'confidence': suggestion.get('confidence', 0),
                'reason': suggestion.get('reason', ''),
                'method': suggestion.get('method', ''),
                'recommended_dosage': suggestion.get('recommended_dosage', 'As prescribed by doctor'),
                'dosage_notes': suggestion.get('dosage_notes', ''),
                'is_safe': suggestion.get('safety_score', 0) > 0.5,
                'allergy_conflicts': list(drug.allergy_conflicts.values_list('name', flat=True)),
                'pregnancy_safe': drug.pregnancy_safe,
                'breastfeeding_safe': drug.breastfeeding_safe,
                'pediatric_safe': drug.pediatric_safe,
                'geriatric_safe': drug.geriatric_safe
            })
        
        return Response({
            'suggestions': formatted_suggestions,
            'total': len(formatted_suggestions),
            'patient_id': patient_id,
            'condition': condition,
            'ai_model_status': 'active' if ai_service._model_initialized else 'fallback'
        })
        
    except Exception as e:
        logger.error(f"Error in enhanced suggestions: {e}")
        return Response({
            'error': f'An error occurred while generating suggestions: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_basic_suggestions(request):
    """
    Get basic medication suggestions (fallback)
    """
    try:
        data = request.data
        
        # Validate required fields
        patient_id = data.get('patient_id')
        condition = data.get('condition', '')
        
        if not patient_id:
            return Response({
                'error': 'patient_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not condition:
            return Response({
                'error': 'condition is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get optional parameters
        excluded_drugs = data.get('excluded_drugs', [])
        max_suggestions = data.get('max_suggestions', 5)
        
        # Validate patient exists
        try:
            patient = Patient.objects.get(id=patient_id)
        except Patient.DoesNotExist:
            return Response({
                'error': 'Patient not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get basic suggestions using keyword matching
        suggestions = ai_service._keyword_based_filtering(
            condition, patient, excluded_drugs, max_suggestions
        )
        
        # Format response
        formatted_suggestions = []
        for suggestion in suggestions:
            drug = suggestion['drug']
            formatted_suggestions.append({
                'id': drug.id,
                'name': drug.name,
                'description': drug.description or '',
                'therapeutic_class': drug.therapeutic_class or '',
                'indications': drug.indications or '',
                'similarity_score': suggestion.get('similarity_score', 0),
                'safety_score': suggestion.get('safety_score', 0),
                'reason': suggestion.get('reason', ''),
                'method': 'basic_keyword',
                'is_safe': suggestion.get('safety_score', 0) > 0.5,
                'allergy_conflicts': list(drug.allergy_conflicts.values_list('name', flat=True))
            })
        
        return Response({
            'suggestions': formatted_suggestions,
            'total': len(formatted_suggestions),
            'patient_id': patient_id,
            'condition': condition,
            'ai_model_status': 'basic_fallback'
        })
        
    except Exception as e:
        logger.error(f"Error in basic suggestions: {e}")
        return Response({
            'error': f'An error occurred while generating suggestions: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_safety_analysis(request):
    """
    Get safety analysis for a specific drug and patient
    """
    try:
        data = request.data
        
        # Validate required fields
        patient_id = data.get('patient_id')
        drug_id = data.get('drug_id')
        
        if not patient_id or not drug_id:
            return Response({
                'error': 'patient_id and drug_id are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate patient and drug exist
        try:
            patient = Patient.objects.get(id=patient_id)
            drug = Drug.objects.get(id=drug_id)
        except (Patient.DoesNotExist, Drug.DoesNotExist):
            return Response({
                'error': 'Patient or drug not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Calculate safety score
        safety_score = ai_service._calculate_safety_score(drug, patient)
        
        # Check for allergy conflicts
        patient_allergies = set(patient.allergies.values_list('id', flat=True))
        drug_allergy_conflicts = set(drug.allergy_conflicts.values_list('id', flat=True))
        allergy_conflicts = patient_allergies & drug_allergy_conflicts
        
        # Get conflict details
        conflict_details = []
        if allergy_conflicts:
            conflict_allergies = Allergy.objects.filter(id__in=allergy_conflicts)
            conflict_details = [{'id': a.id, 'name': a.name} for a in conflict_allergies]
        
        # Generate safety recommendations
        recommendations = []
        warnings = []
        
        if allergy_conflicts:
            warnings.append(f"Patient is allergic to: {', '.join([a['name'] for a in conflict_details])}")
            recommendations.append("DO NOT PRESCRIBE - Allergy conflict detected")
        
        if hasattr(patient, 'pregnancy_status') and patient.pregnancy_status and not drug.pregnancy_safe:
            warnings.append("Patient is pregnant and drug may not be safe during pregnancy")
            recommendations.append("Consider alternative medications or consult obstetrician")
        
        if hasattr(patient, 'breastfeeding') and patient.breastfeeding and not drug.breastfeeding_safe:
            warnings.append("Patient is breastfeeding and drug may not be safe during breastfeeding")
            recommendations.append("Consider alternative medications or consult pediatrician")
        
        if hasattr(patient, 'age') and patient.age:
            if patient.age < 18 and not drug.pediatric_safe:
                warnings.append("Patient is under 18 and drug may not be safe for pediatric use")
                recommendations.append("Consider pediatric alternatives or consult pediatrician")
            elif patient.age > 65 and not drug.geriatric_safe:
                warnings.append("Patient is over 65 and drug may not be safe for geriatric use")
                recommendations.append("Consider geriatric dosing or alternatives")
        
        if safety_score < 0.5:
            warnings.append("Low safety score detected")
            recommendations.append("Review patient profile and consider alternatives")
        
        return Response({
            'safety_score': safety_score,
            'is_safe': safety_score > 0.5 and not allergy_conflicts,
            'allergy_conflicts': conflict_details,
            'warnings': warnings,
            'recommendations': recommendations,
            'drug_info': {
                'id': drug.id,
                'name': drug.name,
                'pregnancy_safe': drug.pregnancy_safe,
                'breastfeeding_safe': drug.breastfeeding_safe,
                'pediatric_safe': drug.pediatric_safe,
                'geriatric_safe': drug.geriatric_safe
            },
            'patient_info': {
                'id': patient.id,
                'age': getattr(patient, 'age', None),
                'pregnancy_status': getattr(patient, 'pregnancy_status', False),
                'breastfeeding': getattr(patient, 'breastfeeding', False),
                'allergies': list(patient.allergies.values_list('name', flat=True))
            }
        })
        
    except Exception as e:
        logger.error(f"Error in safety analysis: {e}")
        return Response({
            'error': f'An error occurred while analyzing safety: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
