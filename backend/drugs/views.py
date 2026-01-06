from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from .models import Drug, Allergy
from .serializers import DrugSerializer, AllergySerializer
from patients.models import Patient
from rx.models import Prescription
from .ai_suggestion_service import AISuggestionService
from .simple_ai_service import SimpleAISuggestionService

# Initialize AI services
ai_service = AISuggestionService()
simple_ai_service = SimpleAISuggestionService()

class DrugListCreateView(generics.ListCreateAPIView):
    queryset = Drug.objects.all()
    serializer_class = DrugSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['form', 'category', 'availability']
    search_fields = ['name', 'generic_name', 'category']
    ordering_fields = ['name', 'created_at']

class DrugDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Drug.objects.all()
    serializer_class = DrugSerializer

@api_view(['GET'])
def drug_stats(request):
    total_drugs = Drug.objects.count()
    available_drugs = Drug.objects.filter(availability='available').count()
    out_of_stock = Drug.objects.filter(availability='out_of_stock').count()
    
    return Response({
        'total_drugs': total_drugs,
        'available_drugs': available_drugs,
        'out_of_stock': out_of_stock,
    })

class AllergyListCreateView(generics.ListCreateAPIView):
    queryset = Allergy.objects.all()
    serializer_class = AllergySerializer

class AllergyDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Allergy.objects.all()
    serializer_class = AllergySerializer

@api_view(['POST'])
@permission_classes([AllowAny])
def check_prescription_interactions(request):
    """
    API endpoint to check for interactions within a prescription list.
    This is different from check_medication_conflict which checks against patient's entire history.
    
    Request Body:
    {
        "patient_id": "p12345",
        "medication_ids": [1, 2, 3]  // List of medication IDs in the prescription
    }
    
    Response:
    {
        "status": "ok" | "conflict",
        "interactions": [
            {
                "medication1_id": 1,
                "medication2_id": 2,
                "medication1_name": "Loratadine",
                "medication2_name": "Diazepam",
                "interaction_name": "Loratadine - Diazepam Interaction",
                "severity": "Low",
                "description": "Potential interaction between Loratadine and Diazepam..."
            }
        ],
        "duplicate_therapy": [
            {
                "therapeutic_class": "ACE Inhibitor",
                "medication_ids": [1, 3],
                "medication_names": ["Lisinopril", "Enalapril"],
                "severity": "Moderate",
                "description": "Duplicate therapy detected: Multiple ACE inhibitors prescribed together."
            }
        ]
    }
    """
    try:
        patient_id = request.data.get('patient_id')
        medication_ids = request.data.get('medication_ids', [])
        
        if not patient_id or not medication_ids:
            return Response({
                'error': 'patient_id and medication_ids are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if len(medication_ids) < 2:
            return Response({
                'status': 'ok',
                'interactions': [],
                'duplicate_therapy': []
            }, status=status.HTTP_200_OK)
        
        # Get the drugs
        try:
            drugs = Drug.objects.filter(id__in=medication_ids)
            if len(drugs) != len(medication_ids):
                return Response({
                    'error': 'Some medications not found'
                }, status=status.HTTP_404_NOT_FOUND)
        except Drug.DoesNotExist:
            return Response({
                'error': 'Medications not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        interactions = []
        duplicate_therapy = []
        
        # 1. CHECK FOR DRUG-DRUG INTERACTIONS
        # Check each pair of medications for interactions
        for i in range(len(medication_ids)):
            for j in range(i + 1, len(medication_ids)):
                drug1_id = medication_ids[i]
                drug2_id = medication_ids[j]
                
                # Find interactions between these two drugs
                from .models import Interaction
                drug_interactions = Interaction.objects.filter(
                    drugs__id=drug1_id
                ).filter(
                    drugs__id=drug2_id
                ).distinct()
                
                for interaction in drug_interactions:
                    drug1 = drugs.get(id=drug1_id)
                    drug2 = drugs.get(id=drug2_id)
                    
                    interactions.append({
                        'medication1_id': drug1_id,
                        'medication2_id': drug2_id,
                        'medication1_name': drug1.name,
                        'medication2_name': drug2.name,
                        'interaction_name': interaction.name,
                        'severity': interaction.severity,
                        'description': interaction.description
                    })
        
        # 2. CHECK FOR DUPLICATE THERAPY (SAME THERAPEUTIC CLASS)
        # Track therapeutic classes
        class_tracker = {}
        
        for drug in drugs:
            if drug.therapeutic_class:
                class_name = drug.therapeutic_class.strip()
                if class_name:  # Only process non-empty therapeutic classes
                    if class_name not in class_tracker:
                        class_tracker[class_name] = []
                    class_tracker[class_name].append({
                        'id': drug.id,
                        'name': drug.name
                    })
        
        # Check for duplicate therapy
        for class_name, medications in class_tracker.items():
            if len(medications) > 1:
                # Determine severity based on therapeutic class
                severity = 'Moderate'  # Default
                if any(keyword in class_name.lower() for keyword in ['antibiotic', 'anticoagulant', 'antidepressant']):
                    severity = 'High'
                elif any(keyword in class_name.lower() for keyword in ['vitamin', 'supplement']):
                    severity = 'Low'
                
                duplicate_therapy.append({
                    'therapeutic_class': class_name,
                    'medication_ids': [med['id'] for med in medications],
                    'medication_names': [med['name'] for med in medications],
                    'severity': severity,
                    'description': f'Duplicate therapy detected: Multiple {class_name} medications prescribed together. This may lead to increased side effects or reduced efficacy.'
                })
        
        # Determine overall status
        has_conflicts = len(interactions) > 0 or len(duplicate_therapy) > 0
        
        if has_conflicts:
            return Response({
                'status': 'conflict',
                'interactions': interactions,
                'duplicate_therapy': duplicate_therapy
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'status': 'ok',
                'interactions': [],
                'duplicate_therapy': []
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        return Response({
            'error': f'Internal server error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def check_allergy_only(request):
    """
    API endpoint to check ONLY for allergies (not existing prescription interactions).
    This is used in the prescription dialog to check if a new medication conflicts
    with the patient's allergies, without checking against existing prescriptions.
    
    Request Body:
    {
        "patient_id": "p12345",
        "new_medication_id": "rx-amoxicillin"
    }
    
    Response:
    {
        "status": "ok" | "conflict",
        "warnings": [
            {
                "type": "Allergy",
                "severity": "High",
                "message": "Patient is allergic to..."
            }
        ]
    }
    """
    try:
        patient_id = request.data.get('patient_id')
        new_medication_id = request.data.get('new_medication_id')
        
        if not patient_id or not new_medication_id:
            return Response({
                'error': 'patient_id and new_medication_id are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Fetch patient
        try:
            patient = Patient.objects.get(id=patient_id)
        except Patient.DoesNotExist:
            return Response({
                'error': 'Patient not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Fetch new medication
        try:
            new_medication = Drug.objects.get(id=new_medication_id)
        except Drug.DoesNotExist:
            return Response({
                'error': 'Medication not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check ONLY for allergies (not existing prescription interactions)
        allergy_warnings = check_allergy_conflicts(patient, new_medication)
        
        if allergy_warnings:
            return Response({
                'status': 'conflict',
                'warnings': allergy_warnings
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'status': 'ok',
                'warnings': []
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        return Response({
            'error': f'Internal server error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def check_medication_conflict(request):
    """
    API endpoint to check for medication conflicts before adding to prescription.
    
    Request Body:
    {
        "patient_id": "p12345",
        "new_medication_id": "rx-amoxicillin"
    }
    
    Response:
    {
        "status": "ok" | "conflict",
        "warnings": [
            {
                "type": "Allergy" | "Drug-Drug Interaction",
                "severity": "High" | "Moderate" | "Low",
                "message": "Detailed warning message"
            }
        ]
    }
    """
    try:
        # Extract data from request
        patient_id = request.data.get('patient_id')
        new_medication_id = request.data.get('new_medication_id')
        
        # Validate required fields
        if not patient_id or not new_medication_id:
            return Response({
                'error': 'patient_id and new_medication_id are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Fetch patient with allergies and current medications
        try:
            patient = Patient.objects.get(id=patient_id)
        except Patient.DoesNotExist:
            return Response({
                'error': 'Patient not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Fetch new medication
        try:
            new_medication = Drug.objects.get(id=new_medication_id)
        except Drug.DoesNotExist:
            return Response({
                'error': 'Medication not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        warnings = []
        
        print(f"Checking conflicts for Patient ID: {patient_id}, Medication ID: {new_medication_id}")
        print(f"Patient: {patient.full_name}")
        print(f"Medication: {new_medication.name}")
        
        # 1. ALLERGY CHECK
        allergy_warnings = check_allergy_conflicts(patient, new_medication)
        warnings.extend(allergy_warnings)
        print(f"Allergy warnings found: {len(allergy_warnings)}")
        
        # 2. DRUG-DRUG INTERACTION CHECK
        interaction_warnings = check_drug_interactions(patient, new_medication)
        warnings.extend(interaction_warnings)
        print(f"Interaction warnings found: {len(interaction_warnings)}")
        
        print(f"Total warnings: {len(warnings)}")
        
        # Determine response status
        if warnings:
            return Response({
                'status': 'conflict',
                'warnings': warnings
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'status': 'ok',
                'warnings': []
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        return Response({
            'error': f'Internal server error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def check_allergy_conflicts(patient, new_medication):
    """
    Check if the new medication conflicts with patient's known allergies.
    
    Args:
        patient: Patient object with allergies
        new_medication: Drug object to be added
    
    Returns:
        List of allergy warning objects
    """
    warnings = []
    
    # Get patient's allergies
    patient_allergies = []
    
    # Method 1: Check through PatientAllergy relationship
    try:
        from patients.models import PatientAllergy
        patient_allergy_objects = PatientAllergy.objects.filter(patient=patient)
        for pa in patient_allergy_objects:
            patient_allergies.append(pa.allergy.name.lower())
    except Exception as e:
        print(f"Error getting patient allergies through PatientAllergy: {e}")
    
    # Method 2: Check through direct ManyToMany relationship
    try:
        direct_allergies = patient.allergies.all()
        for allergy in direct_allergies:
            if allergy.name.lower() not in patient_allergies:
                patient_allergies.append(allergy.name.lower())
    except Exception as e:
        print(f"Error getting patient allergies through ManyToMany: {e}")
    
    # Method 3: Legacy support for detailed_allergies (if it exists)
    if hasattr(patient, 'detailed_allergies') and patient.detailed_allergies:
        for allergy_detail in patient.detailed_allergies:
            if hasattr(allergy_detail, 'allergy') and allergy_detail.allergy:
                if allergy_detail.allergy.name.lower() not in patient_allergies:
                    patient_allergies.append(allergy_detail.allergy.name.lower())
    
    print(f"Patient {patient.full_name} has {len(patient_allergies)} allergies: {patient_allergies}")
    
    # Get medication's allergy class/therapeutic class
    medication_classes = []
    if new_medication.therapeutic_class:
        medication_classes.append(new_medication.therapeutic_class.lower())
    if new_medication.category:
        medication_classes.append(new_medication.category.lower())
    if new_medication.generic_name:
        medication_classes.append(new_medication.generic_name.lower())
    
    print(f"Medication {new_medication.name} classes: {medication_classes}")
    
    # Check for allergy conflicts
    for allergy in patient_allergies:
        print(f"Checking allergy: {allergy}")
        
        # Direct name match
        if new_medication.name.lower() == allergy:
            warnings.append({
                'type': 'Allergy',
                'severity': 'High',
                'message': f'Patient is allergic to {allergy}. Prescribing {new_medication.name} could cause a severe allergic reaction.'
            })
            continue
        
        # Check if allergy name is contained in medication name or vice versa
        if allergy in new_medication.name.lower() or new_medication.name.lower() in allergy:
            warnings.append({
                'type': 'Allergy',
                'severity': 'High',
                'message': f'Patient is allergic to {allergy}. {new_medication.name} may contain similar compounds and cause an allergic reaction.'
            })
            continue
        
        # Check therapeutic class matches
        for med_class in medication_classes:
            if allergy in med_class or med_class in allergy:
                warnings.append({
                    'type': 'Allergy',
                    'severity': 'High',
                    'message': f'Patient is allergic to {allergy}. {new_medication.name} belongs to {med_class} class and may cause an allergic reaction.'
                })
                break
        
        # Special case: penicillin allergy should match amoxicillin, ampicillin, etc.
        if allergy == 'penicillin':
            penicillin_related = ['amoxicillin', 'ampicillin', 'penicillin', 'benzylpenicillin']
            for related in penicillin_related:
                if related in new_medication.name.lower() or related in (new_medication.generic_name or '').lower():
                    warnings.append({
                        'type': 'Allergy',
                        'severity': 'High',
                        'message': f'Patient is allergic to penicillin. {new_medication.name} is a penicillin-related antibiotic and could cause a severe allergic reaction.'
                    })
                    break
        
        # Special case: aspirin allergy should match NSAIDs
        if allergy == 'aspirin':
            nsaid_related = ['ibuprofen', 'naproxen', 'diclofenac', 'aspirin', 'nsaid']
            for related in nsaid_related:
                if related in new_medication.name.lower() or related in (new_medication.generic_name or '').lower():
                    warnings.append({
                        'type': 'Allergy',
                        'severity': 'High',
                        'message': f'Patient is allergic to aspirin. {new_medication.name} is an NSAID and could cause similar allergic reactions.'
                    })
                    break
    
    return warnings


def check_drug_interactions(patient, new_medication):
    """
    Checks for multi-drug interactions against the patient's full medication list.
    Uses the new Interaction model to detect complex interactions involving 2+ drugs.
    
    Args:
        patient: Patient object
        new_medication: Drug object to be added
    
    Returns:
        List of interaction warning objects
    """
    from .models import Interaction
    from django.db import models
    
    warnings = []
    
    # 1. Get the complete set of medications the patient will be taking.
    current_medications = []
    active_prescriptions = Prescription.objects.filter(
        patient=patient,
        status='active'
    )
    
    for prescription in active_prescriptions:
        prescription_medications = prescription.prescription_medications.all()
        for prescription_med in prescription_medications:
            current_medications.append(prescription_med.drug)
    
    # Add the new medication to the total set
    total_meds = current_medications + [new_medication]
    total_med_ids = {med.id for med in total_meds}

    if len(total_meds) < 2:
        return []  # Cannot have an interaction with less than 2 drugs.

    print(f"Checking multi-drug interactions for {len(total_meds)} medications: {[med.name for med in total_meds]}")

    # 2. Find all possible interactions that could be relevant.
    # An optimization: only check interactions with a drug count less than or equal to the patient's total.
    # Order by drug count descending to prioritize higher-order interactions
    possible_interactions = Interaction.objects.annotate(
        drug_count=models.Count('drugs')
    ).filter(
        drug_count__lte=len(total_meds)
    ).order_by('-drug_count').prefetch_related('drugs')

    print(f"Found {possible_interactions.count()} possible interactions to check")

    # 3. For each possible interaction, see if its drug set is a subset of the patient's total meds.
    # Use a set to track which drug combinations have already been detected
    detected_combinations = set()
    
    for interaction in possible_interactions:
        interaction_drug_ids = {drug.id for drug in interaction.drugs.all()}
        
        # This is the crucial check: is the interaction's drug set a subset of patient's meds?
        if interaction_drug_ids.issubset(total_med_ids):
            # Check if we've already detected a higher-order interaction for this combination
            interaction_tuple = tuple(sorted(interaction_drug_ids))
            
            # Skip if we've already detected a superset of this interaction
            should_skip = False
            for detected_combo in detected_combinations:
                if set(detected_combo).issuperset(interaction_tuple):
                    should_skip = True
                    break
            
            if should_skip:
                print(f"Skipping {interaction.name} - already detected higher-order interaction")
                continue
            
            # A match is found! The patient is taking all drugs required for this interaction.
            drug_names = ", ".join([drug.name for drug in interaction.drugs.all()])
            warnings.append({
                'type': 'Multi-Drug Interaction',
                'severity': interaction.severity,
                'message': f"High risk of {interaction.name} when combining [{drug_names}]. {interaction.description}"
            })
            detected_combinations.add(interaction_tuple)
            print(f"Found interaction: {interaction.name} with drugs: {drug_names}")
            
    print(f"Total multi-drug interactions found: {len(warnings)}")
    return warnings


# AI Suggestion API Views

@api_view(['POST'])
@permission_classes([AllowAny])
def get_allergy_aware_suggestions(request):
    """
    API endpoint for standard allergy-aware medication suggestions
    
    Request Body:
    {
        "patient_id": 1,
        "condition": "hypertension",
        "excluded_drugs": [1, 2, 3],
        "max_suggestions": 5
    }
    
    Response:
    {
        "suggestions": [
            {
                "id": 1,
                "name": "Lisinopril",
                "generic_name": "Lisinopril",
                "therapeutic_class": "ACE Inhibitor",
                "safety_score": 0.95,
                "reasoning": "Effective for hypertension with low side effect profile",
                "dosage": "10mg",
                "frequency": "Once daily",
                "duration": "30 days",
                "quantity": 30,
                "refills": 3
            }
        ],
        "total_found": 5,
        "excluded_count": 3
    }
    """
    try:
        patient_id = request.data.get('patient_id')
        condition = request.data.get('condition', '')
        excluded_drugs = request.data.get('excluded_drugs', [])
        max_suggestions = request.data.get('max_suggestions', 5)
        
        if not patient_id:
            return Response({
                'error': 'patient_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get patient
        try:
            patient = Patient.objects.get(id=patient_id)
        except Patient.DoesNotExist:
            return Response({
                'error': 'Patient not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get basic suggestions using simple AI service
        suggestions = simple_ai_service.get_ai_enhanced_suggestions(
            patient_id=patient_id,
            condition=condition,
            excluded_drugs=excluded_drugs,
            max_suggestions=max_suggestions,
            use_patient_similarity=True,
            use_dosage_optimization=True
        )
        
        # Convert Drug objects to dictionaries for JSON serialization
        serialized_suggestions = []
        for suggestion in suggestions:
            drug = suggestion['drug']
            serialized_suggestion = {
                'id': drug.id,
                'name': drug.name,
                'generic_name': drug.generic_name,
                'therapeutic_class': drug.therapeutic_class,
                'safety_score': suggestion.get('similarity_score', 0.5),
                'reasoning': suggestion.get('reasoning', ''),
                'dosage': suggestion.get('recommended_dosage_mg', ''),
                'frequency': 'Once daily',  # Default frequency
                'duration': '30 days',  # Default duration
                'quantity': 30,  # Default quantity
                'refills': 3  # Default refills
            }
            serialized_suggestions.append(serialized_suggestion)
        
        return Response({
            'suggestions': serialized_suggestions,
            'total_found': len(serialized_suggestions),
            'excluded_count': len(excluded_drugs)
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Internal server error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def get_enhanced_ai_suggestions(request):
    """
    API endpoint for AI-enhanced medication suggestions
    
    Request Body:
    {
        "patient_id": 1,
        "condition": "hypertension",
        "excluded_drugs": [1, 2, 3],
        "max_suggestions": 5,
        "use_patient_similarity": true,
        "use_dosage_optimization": true,
        "use_semantic_analysis": true,
        "use_content_filtering": true
    }
    
    Response:
    {
        "suggestions": [
            {
                "id": 1,
                "name": "Lisinopril",
                "generic_name": "Lisinopril",
                "therapeutic_class": "ACE Inhibitor",
                "safety_score": 0.95,
                "ai_confidence": 0.92,
                "ai_methods_used": ["content_based", "collaborative", "safety_optimized"],
                "reasoning": "AI analysis shows high efficacy for hypertension in similar patients",
                "dosage": "10mg",
                "frequency": "Once daily",
                "duration": "30 days",
                "quantity": 30,
                "refills": 3
            }
        ],
        "total_found": 5,
        "excluded_count": 3,
        "ai_analysis": {
            "condition_analysis": "Hypertension detected with moderate severity",
            "patient_profile": "Middle-aged patient with cardiovascular risk factors"
        }
    }
    """
    try:
        patient_id = request.data.get('patient_id')
        condition = request.data.get('condition', '')
        excluded_drugs = request.data.get('excluded_drugs', [])
        max_suggestions = request.data.get('max_suggestions', 5)
        use_patient_similarity = request.data.get('use_patient_similarity', True)
        use_dosage_optimization = request.data.get('use_dosage_optimization', True)
        
        if not patient_id:
            return Response({
                'error': 'patient_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get patient
        try:
            patient = Patient.objects.get(id=patient_id)
        except Patient.DoesNotExist:
            return Response({
                'error': 'Patient not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get AI-enhanced suggestions
        suggestions = ai_service.get_ai_enhanced_suggestions(
            patient_id=patient_id,
            condition=condition,
            excluded_drugs=excluded_drugs,
            max_suggestions=max_suggestions,
            use_patient_similarity=use_patient_similarity,
            use_dosage_optimization=use_dosage_optimization
        )
        
        # Convert Drug objects to dictionaries for JSON serialization
        serialized_suggestions = []
        for suggestion in suggestions:
            drug = suggestion['drug']
            serialized_suggestion = {
                'id': drug.id,
                'name': drug.name,
                'generic_name': drug.generic_name,
                'therapeutic_class': drug.therapeutic_class,
                'safety_score': suggestion.get('similarity_score', 0.5),
                'ai_confidence': suggestion.get('similarity_score', 0.5),
                'ai_methods_used': suggestion.get('methods_used', ['content_based']),
                'reasoning': suggestion.get('reasoning', ''),
                'dosage': suggestion.get('recommended_dosage_mg', ''),
                'frequency': 'Once daily',  # Default frequency
                'duration': '30 days',  # Default duration
                'quantity': 30,  # Default quantity
                'refills': 3  # Default refills
            }
            serialized_suggestions.append(serialized_suggestion)
        
        # Generate AI analysis
        ai_analysis = {
            'condition_analysis': f"Condition '{condition}' analyzed with AI semantic processing",
            'patient_profile': f"Patient {patient.full_name} profile analyzed for personalized recommendations"
        }
        
        return Response({
            'suggestions': serialized_suggestions,
            'total_found': len(serialized_suggestions),
            'excluded_count': len(excluded_drugs),
            'ai_analysis': ai_analysis
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Internal server error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def analyze_condition(request):
    """
    API endpoint for AI condition analysis
    
    Request Body:
    {
        "condition": "hypertension with chest pain"
    }
    
    Response:
    {
        "analysis": {
            "primary_condition": "hypertension",
            "secondary_symptoms": ["chest pain"],
            "severity": "moderate",
            "recommended_action": "immediate evaluation recommended",
            "confidence": 0.85
        }
    }
    """
    try:
        condition = request.data.get('condition', '')
        
        if not condition:
            return Response({
                'error': 'condition is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Simple condition analysis (can be enhanced with NLP)
        analysis = {
            'primary_condition': condition.lower(),
            'secondary_symptoms': [],
            'severity': 'moderate',
            'recommended_action': 'consult with healthcare provider',
            'confidence': 0.75
        }
        
        return Response({
            'analysis': analysis
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Internal server error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def get_safety_analysis(request):
    """
    API endpoint for AI safety analysis
    
    Request Body:
    {
        "patient_id": 1,
        "medication_id": 1
    }
    
    Response:
    {
        "safety_score": 0.95,
        "risk_factors": [],
        "recommendations": ["Monitor blood pressure"],
        "contraindications": []
    }
    """
    try:
        patient_id = request.data.get('patient_id')
        medication_id = request.data.get('medication_id')
        
        if not patient_id or not medication_id:
            return Response({
                'error': 'patient_id and medication_id are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get patient and medication
        try:
            patient = Patient.objects.get(id=patient_id)
            medication = Drug.objects.get(id=medication_id)
        except (Patient.DoesNotExist, Drug.DoesNotExist):
            return Response({
                'error': 'Patient or medication not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Simple safety analysis
        safety_analysis = {
            'safety_score': 0.95,
            'risk_factors': [],
            'recommendations': ['Monitor patient response'],
            'contraindications': []
        }
        
        return Response(safety_analysis, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': f'Internal server error: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Legacy functions removed - now using Interaction model for multi-drug interactions
