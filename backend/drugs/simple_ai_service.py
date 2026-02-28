"""
Simplified AI-Powered Medication Suggestion Service
Provides basic machine learning-based drug recommendations without heavy dependencies
"""

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from textblob import TextBlob
import re
from typing import List, Dict, Tuple, Optional
from django.db.models import Q
from .models import Drug, Allergy, Interaction
from patients.models import Patient, PatientAllergy
from rx.models import Prescription, PrescriptionMedication
import logging

logger = logging.getLogger(__name__)

class SimpleAISuggestionService:
    def __init__(self):
        self.vectorizer = None
        self.scaler = StandardScaler()
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize basic AI models"""
        try:
            # Initialize TF-IDF vectorizer for drug descriptions
            self.vectorizer = TfidfVectorizer(
                max_features=1000,
                stop_words='english',
                ngram_range=(1, 2)
            )
            logger.info("Simple AI service initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing simple AI models: {e}")
            self.vectorizer = None
    
    def get_ai_enhanced_suggestions(
        self, 
        patient_id: int, 
        condition: str, 
        excluded_drugs: List[int] = None,
        max_suggestions: int = 5,
        use_patient_similarity: bool = True,
        use_dosage_optimization: bool = True
    ) -> List[Dict]:
        """
        Get AI-enhanced medication suggestions using simplified ML approaches
        """
        try:
            patient = Patient.objects.get(id=patient_id)
            excluded_drugs = excluded_drugs or []
            
            # Get base suggestions using multiple approaches
            suggestions = []
            
            # 1. Content-based filtering using drug descriptions
            content_suggestions = self._content_based_filtering(
                condition, patient, excluded_drugs, max_suggestions
            )
            
            # 2. Collaborative filtering based on similar patients
            if use_patient_similarity:
                collaborative_suggestions = self._collaborative_filtering(
                    patient, condition, excluded_drugs, max_suggestions
                )
            else:
                collaborative_suggestions = []
            
            # 3. Safety-optimized suggestions
            safety_suggestions = self._safety_optimized_filtering(
                patient, condition, excluded_drugs, max_suggestions
            )
            
            # Combine and rank suggestions using ensemble approach
            all_suggestions = self._ensemble_ranking(
                content_suggestions,
                collaborative_suggestions, 
                safety_suggestions,
                max_suggestions
            )
            
            # Apply dosage optimization if requested
            if use_dosage_optimization:
                all_suggestions = self._optimize_dosages(all_suggestions, patient, condition)
            
            return all_suggestions[:max_suggestions]
            
        except Exception as e:
            logger.error(f"Error in simple AI suggestion service: {e}")
            return []
    
    def _content_based_filtering(
        self, 
        condition: str, 
        patient: Patient, 
        excluded_drugs: List[int],
        max_suggestions: int
    ) -> List[Dict]:
        """Content-based filtering using drug descriptions and therapeutic classes"""
        try:
            # Get all available drugs
            drugs = Drug.objects.filter(availability='available').exclude(
                id__in=excluded_drugs
            ).exclude(
                allergy_conflicts__in=patient.patient_allergies.values_list('allergy', flat=True)
            )
            
            if not drugs.exists() or not self.vectorizer:
                return []
            
            # Create drug descriptions for TF-IDF
            drug_descriptions = []
            drug_data = []
            
            for drug in drugs:
                description = f"{drug.name} {drug.generic_name} {drug.category} {drug.therapeutic_class or ''} {drug.dosage_instructions or ''}"
                drug_descriptions.append(description)
                drug_data.append(drug)
            
            # Vectorize drug descriptions
            drug_vectors = self.vectorizer.fit_transform(drug_descriptions)
            condition_vector = self.vectorizer.transform([condition])
            
            # Calculate similarities
            similarities = cosine_similarity(condition_vector, drug_vectors).flatten()
            
            # Get top suggestions
            top_indices = np.argsort(similarities)[::-1][:max_suggestions]
            
            suggestions = []
            for idx in top_indices:
                if similarities[idx] > 0.1:  # Minimum similarity threshold
                    drug = drug_data[idx]
                    suggestions.append({
                        'drug': drug,
                        'similarity_score': float(similarities[idx]),
                        'method': 'content_based',
                        'reasoning': f"Similar to condition based on drug description"
                    })
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error in content-based filtering: {e}")
            return []
    
    def _collaborative_filtering(
        self, 
        patient: Patient, 
        condition: str, 
        excluded_drugs: List[int],
        max_suggestions: int
    ) -> List[Dict]:
        """Collaborative filtering based on similar patients' prescriptions"""
        try:
            # Find patients with similar characteristics
            similar_patients = self._find_similar_patients(patient)
            
            if not similar_patients:
                return []
            
            # Get drugs prescribed to similar patients for similar conditions
            similar_patient_ids = [p.id for p in similar_patients]
            
            prescriptions = Prescription.objects.filter(
                patient_id__in=similar_patient_ids,
                status__in=['active', 'completed']
            ).select_related('patient').prefetch_related('prescription_medications__drug')
            
            # Count drug frequency for similar patients
            drug_frequency = {}
            for prescription in prescriptions:
                for medication in prescription.prescription_medications.all():
                    drug_id = medication.drug.id
                    if drug_id not in excluded_drugs:
                        drug_frequency[drug_id] = drug_frequency.get(drug_id, 0) + 1
            
            # Get top drugs and create suggestions
            top_drugs = sorted(drug_frequency.items(), key=lambda x: x[1], reverse=True)[:max_suggestions]
            
            suggestions = []
            for drug_id, frequency in top_drugs:
                try:
                    drug = Drug.objects.get(id=drug_id, availability='available')
                    # Check allergy conflicts
                    if not drug.allergy_conflicts.filter(id__in=patient.patient_allergies.values_list('allergy', flat=True)).exists():
                        suggestions.append({
                            'drug': drug,
                            'similarity_score': frequency / len(similar_patients),
                            'method': 'collaborative',
                            'reasoning': f"Prescribed to {frequency} similar patients"
                        })
                except Drug.DoesNotExist:
                    continue
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error in collaborative filtering: {e}")
            return []
    
    def _safety_optimized_filtering(
        self, 
        patient: Patient, 
        condition: str, 
        excluded_drugs: List[int],
        max_suggestions: int
    ) -> List[Dict]:
        """Safety-optimized filtering with advanced risk assessment"""
        try:
            # Get all available drugs
            drugs = Drug.objects.filter(availability='available').exclude(
                id__in=excluded_drugs
            ).exclude(
                allergy_conflicts__in=patient.patient_allergies.values_list('allergy', flat=True)
            )
            
            suggestions = []
            for drug in drugs:
                safety_score, reasoning = self._calculate_advanced_safety_score(drug, patient, condition)
                
                if safety_score > 0.5:  # Minimum safety threshold
                    suggestions.append({
                        'drug': drug,
                        'similarity_score': safety_score,
                        'method': 'safety_optimized',
                        'reasoning': reasoning
                    })
            
            # Sort by safety score
            suggestions.sort(key=lambda x: x['similarity_score'], reverse=True)
            return suggestions[:max_suggestions]
            
        except Exception as e:
            logger.error(f"Error in safety-optimized filtering: {e}")
            return []
    
    def _calculate_advanced_safety_score(self, drug: Drug, patient: Patient, condition: str) -> Tuple[float, str]:
        """Calculate advanced safety score using multiple factors"""
        base_score = 0.5
        reasoning_parts = []
        
        # Age-based adjustments
        if patient.age:
            if patient.age < 18:
                if drug.pediatric_dose_mg_kg:
                    base_score += 0.2
                    reasoning_parts.append("OK: Pediatric dosing available")
                else:
                    base_score -= 0.1
                    reasoning_parts.append("WARNING: No pediatric dosing guidelines")
            elif patient.age > 65:
                if 'geriatric' in (drug.contraindications or '').lower():
                    base_score -= 0.2
                    reasoning_parts.append("WARNING: Geriatric contraindications")
                else:
                    base_score += 0.1
                    reasoning_parts.append("OK: Suitable for elderly")
        
        # Gender-based considerations
        if patient.gender == 'F' and 'pregnant' in (drug.contraindications or '').lower():
            base_score -= 0.3
            reasoning_parts.append("WARNING: Pregnancy contraindications")
        
        # Medical history considerations
        if patient.medical_history:
            history_lower = patient.medical_history.lower()
            contraindications_lower = (drug.contraindications or '').lower()
            
            # Check for contraindicated conditions
            contraindicated_conditions = ['liver', 'kidney', 'heart', 'diabetes', 'hypertension']
            for condition in contraindicated_conditions:
                if condition in history_lower and condition in contraindications_lower:
                    base_score -= 0.2
                    reasoning_parts.append(f"⚠️ Contraindicated for {condition}")
        
        # Drug interaction risk
        current_medications = self._get_patient_current_medications(patient)
        interaction_risk = self._assess_interaction_risk(drug, current_medications)
        base_score -= interaction_risk * 0.3
        if interaction_risk > 0.5:
            reasoning_parts.append("⚠️ High drug interaction risk")
        elif interaction_risk < 0.2:
            reasoning_parts.append("✅ Low drug interaction risk")
        
        # Side effect profile
        if drug.side_effects:
            side_effects_lower = drug.side_effects.lower()
            severe_side_effects = ['severe', 'serious', 'life-threatening', 'fatal']
            if any(se in side_effects_lower for se in severe_side_effects):
                base_score -= 0.15
                reasoning_parts.append("⚠️ Severe side effects possible")
        
        # Ensure score is between 0 and 1
        base_score = max(0.0, min(1.0, base_score))
        
        return base_score, "; ".join(reasoning_parts)
    
    def _find_similar_patients(self, patient: Patient, limit: int = 10) -> List[Patient]:
        """Find patients with similar characteristics using clustering"""
        try:
            # Get all patients with similar demographics
            similar_patients = Patient.objects.filter(
                gender=patient.gender
            ).exclude(id=patient.id)
            
            if not similar_patients.exists():
                return []
            
            # Create patient feature vectors
            patient_features = []
            patient_list = []
            
            for p in similar_patients:
                features = [
                    p.age or 0,
                    1 if p.gender == 'M' else 0,
                    len(p.patient_allergies.all()),
                    len(self._get_patient_current_medications(p)),
                    1 if p.medical_history else 0
                ]
                patient_features.append(features)
                patient_list.append(p)
            
            if len(patient_features) < 2:
                return patient_list[:limit]
            
            # Cluster patients
            patient_features = np.array(patient_features)
            patient_features = self.scaler.fit_transform(patient_features)
            
            # Find patient's cluster
            current_features = np.array([[
                patient.age or 0,
                1 if patient.gender == 'M' else 0,
                len(patient.patient_allergies.all()),
                len(self._get_patient_current_medications(patient)),
                1 if patient.medical_history else 0
            ]])
            current_features = self.scaler.transform(current_features)
            
            # Use K-means to find similar patients
            n_clusters = min(3, len(patient_features))
            kmeans = KMeans(n_clusters=n_clusters, random_state=42)
            clusters = kmeans.fit_predict(patient_features)
            current_cluster = kmeans.predict(current_features)[0]
            
            # Return patients from the same cluster
            similar_patient_indices = [i for i, cluster in enumerate(clusters) if cluster == current_cluster]
            return [patient_list[i] for i in similar_patient_indices[:limit]]
            
        except Exception as e:
            logger.error(f"Error finding similar patients: {e}")
            return []
    
    def _get_patient_current_medications(self, patient: Patient) -> List[Drug]:
        """Get patient's current active medications"""
        try:
            active_prescriptions = Prescription.objects.filter(
                patient=patient,
                status='active'
            ).prefetch_related('prescription_medications__drug')
            
            medications = []
            for prescription in active_prescriptions:
                for medication in prescription.prescription_medications.all():
                    medications.append(medication.drug)
            
            return medications
        except Exception as e:
            logger.error(f"Error getting current medications: {e}")
            return []
    
    def _assess_interaction_risk(self, drug: Drug, current_medications: List[Drug]) -> float:
        """Assess drug interaction risk on a scale of 0-1"""
        if not current_medications:
            return 0.0
        
        try:
            # Check for known interactions using the new Interaction model
            interactions = Interaction.objects.filter(
                drugs__in=[drug] + current_medications
            ).distinct()
            
            if not interactions.exists():
                return 0.0
            
            # Calculate risk based on severity
            severity_weights = {
                'minor': 0.2,
                'moderate': 0.5,
                'major': 0.8,
                'contraindicated': 1.0
            }
            
            max_risk = 0.0
            for interaction in interactions:
                risk = severity_weights.get(interaction.severity, 0.5)
                max_risk = max(max_risk, risk)
            
            return max_risk
            
        except Exception as e:
            logger.error(f"Error assessing interaction risk: {e}")
            return 0.5  # Default to moderate risk if error
    
    def _ensemble_ranking(
        self, 
        content_suggestions: List[Dict],
        collaborative_suggestions: List[Dict], 
        safety_suggestions: List[Dict],
        max_suggestions: int
    ) -> List[Dict]:
        """Combine and rank suggestions using ensemble approach"""
        try:
            # Create drug ID to suggestion mapping
            drug_suggestions = {}
            
            # Weight different methods
            method_weights = {
                'content_based': 0.4,
                'collaborative': 0.3,
                'safety_optimized': 0.3
            }
            
            # Combine all suggestions
            all_suggestions = content_suggestions + collaborative_suggestions + safety_suggestions
            
            for suggestion in all_suggestions:
                drug_id = suggestion['drug'].id
                if drug_id not in drug_suggestions:
                    drug_suggestions[drug_id] = {
                        'drug': suggestion['drug'],
                        'scores': {},
                        'reasoning': [],
                        'methods': []
                    }
                
                method = suggestion['method']
                weight = method_weights.get(method, 0.1)
                weighted_score = suggestion['similarity_score'] * weight
                
                drug_suggestions[drug_id]['scores'][method] = weighted_score
                drug_suggestions[drug_id]['reasoning'].append(suggestion['reasoning'])
                drug_suggestions[drug_id]['methods'].append(method)
            
            # Calculate final ensemble scores
            final_suggestions = []
            for drug_id, data in drug_suggestions.items():
                # Calculate weighted average
                total_score = sum(data['scores'].values())
                method_count = len(data['scores'])
                
                # Bonus for multiple methods agreeing
                diversity_bonus = min(0.1, method_count * 0.02)
                final_score = total_score + diversity_bonus
                
                # Combine reasoning
                combined_reasoning = " | ".join(set(data['reasoning']))
                
                final_suggestions.append({
                    'drug': data['drug'],
                    'similarity_score': final_score,
                    'method': 'ensemble',
                    'reasoning': combined_reasoning,
                    'methods_used': data['methods']
                })
            
            # Sort by final score
            final_suggestions.sort(key=lambda x: x['similarity_score'], reverse=True)
            return final_suggestions[:max_suggestions]
            
        except Exception as e:
            logger.error(f"Error in ensemble ranking: {e}")
            return []
    
    def _optimize_dosages(self, suggestions: List[Dict], patient: Patient, condition: str) -> List[Dict]:
        """Optimize dosages based on patient characteristics and condition"""
        try:
            for suggestion in suggestions:
                drug = suggestion['drug']
                
                # Calculate optimal dosage
                if hasattr(drug, 'calculate_dosage_for_patient'):
                    try:
                        optimal_dosage = drug.calculate_dosage_for_patient(patient, condition)
                        suggestion['recommended_dosage_mg'] = optimal_dosage
                        suggestion['dosage_reasoning'] = f"Optimized for patient age {patient.age}, weight, and condition"
                    except Exception as e:
                        logger.error(f"Error calculating dosage for {drug.name}: {e}")
                        suggestion['recommended_dosage_mg'] = None
                        suggestion['dosage_reasoning'] = "Standard dosing recommended"
                else:
                    suggestion['recommended_dosage_mg'] = None
                    suggestion['dosage_reasoning'] = "Standard dosing recommended"
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error optimizing dosages: {e}")
            return suggestions
    
    def get_condition_analysis(self, condition: str) -> Dict:
        """Analyze condition using basic NLP to extract symptoms and severity"""
        try:
            # Use TextBlob for sentiment analysis (severity indication)
            blob = TextBlob(condition)
            sentiment = blob.sentiment.polarity
            
            # Map sentiment to severity
            if sentiment < -0.3:
                severity = 'severe'
            elif sentiment < 0.1:
                severity = 'moderate'
            else:
                severity = 'mild'
            
            # Extract symptoms using keyword matching
            symptom_keywords = {
                'pain': ['pain', 'ache', 'sore', 'tender'],
                'fever': ['fever', 'temperature', 'hot', 'burning'],
                'nausea': ['nausea', 'sick', 'vomit', 'queasy'],
                'fatigue': ['tired', 'exhausted', 'weak', 'fatigue'],
                'headache': ['headache', 'head pain', 'migraine'],
                'cough': ['cough', 'coughing', 'hack'],
                'shortness of breath': ['breath', 'breathing', 'wheeze', 'asthma']
            }
            
            symptoms = []
            condition_lower = condition.lower()
            for symptom, keywords in symptom_keywords.items():
                if any(keyword in condition_lower for keyword in keywords):
                    symptoms.append(symptom)
            
            # Determine category
            categories = {
                'cardiovascular': ['heart', 'blood pressure', 'chest', 'cardiac'],
                'respiratory': ['breath', 'lung', 'cough', 'asthma', 'respiratory'],
                'neurological': ['headache', 'migraine', 'seizure', 'neurological'],
                'gastrointestinal': ['stomach', 'nausea', 'vomit', 'digestive', 'gut'],
                'musculoskeletal': ['pain', 'joint', 'muscle', 'bone', 'back'],
                'infectious': ['infection', 'fever', 'viral', 'bacterial']
            }
            
            category = 'general'
            for cat, keywords in categories.items():
                if any(keyword in condition_lower for keyword in keywords):
                    category = cat
                    break
            
            return {
                'symptoms': symptoms,
                'severity': severity,
                'category': category,
                'sentiment_score': sentiment
            }
            
        except Exception as e:
            logger.error(f"Error analyzing condition: {e}")
            return {'symptoms': [], 'severity': 'unknown', 'category': 'general'}
