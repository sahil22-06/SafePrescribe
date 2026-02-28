"""
AI-Powered Medication Suggestion Service
Provides advanced machine learning-based drug recommendations
"""

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import nltk
from textblob import TextBlob
import re
from typing import List, Dict, Tuple, Optional
from django.db.models import Q
from .models import Drug, Allergy, Interaction
from patients.models import Patient, PatientAllergy
from rx.models import Prescription, PrescriptionMedication
import logging

# Optional AI dependencies
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logging.warning("sentence-transformers not available. Some AI features will be disabled.")

try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False
    logging.warning("spacy not available. Some NLP features will be disabled.")

logger = logging.getLogger(__name__)

class AISuggestionService:
    def __init__(self):
        self.condition_model = None
        self.drug_embeddings = None
        self.patient_embeddings = None
        self.vectorizer = None
        self.scaler = StandardScaler()
        self._model_initialized = False
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize AI models and embeddings"""
        try:
            # Initialize sentence transformer for semantic similarity (if available)
            if SENTENCE_TRANSFORMERS_AVAILABLE:
                try:
                    # Use a more robust loading approach with device specification
                    import torch
                    device = 'cpu'  # Force CPU to avoid GPU issues
                    self.condition_model = SentenceTransformer('all-MiniLM-L6-v2', device=device)
                    logger.info("Sentence transformer model loaded successfully")
                except Exception as e:
                    logger.warning(f"Could not load sentence transformer: {e}")
                    logger.info("Falling back to enhanced keyword matching")
                    self.condition_model = None
            else:
                self.condition_model = None
            
            # Initialize TF-IDF vectorizer for drug descriptions
            self.vectorizer = TfidfVectorizer(
                max_features=1000,
                stop_words='english',
                ngram_range=(1, 2)
            )
            
            # Download required NLTK data
            try:
                nltk.data.find('tokenizers/punkt')
            except LookupError:
                nltk.download('punkt')
                
        except Exception as e:
            logger.error(f"Error initializing AI models: {e}")
            self.condition_model = None
            self.vectorizer = None
        
        self._model_initialized = True

    def _is_semantic_model_available(self) -> bool:
        """Check if semantic similarity model is available and working"""
        return (self.condition_model is not None and 
                hasattr(self.condition_model, 'encode') and
                self._model_initialized)

    def _expand_condition_terms(self, condition: str) -> str:
        """Expand condition with synonyms and related medical terms"""
        condition_lower = condition.lower()
        
        # Medical term mappings
        term_mappings = {
            'headache': 'headache pain head ache migraine tension analgesic',
            'pain': 'pain ache sore hurt discomfort analgesic painkiller',
            'fever': 'fever temperature pyrexia hot antipyretic',
            'infection': 'infection bacterial viral microbial antibiotic',
            'hypertension': 'hypertension high blood pressure bp antihypertensive',
            'diabetes': 'diabetes diabetic sugar glucose antidiabetic',
            'anxiety': 'anxiety anxious stress nervous anxiolytic',
            'depression': 'depression depressed mood sad antidepressant',
            'nausea': 'nausea nauseous sick vomiting antiemetic',
            'dizziness': 'dizziness dizzy vertigo antivertigo',
            'fatigue': 'fatigue tired exhaustion weak stimulant',
            'inflammation': 'inflammation inflammatory swelling anti-inflammatory',
            'cough': 'cough coughing throat respiratory antitussive',
            'cold': 'cold flu influenza respiratory decongestant',
            'allergy': 'allergy allergic reaction hypersensitivity antihistamine'
        }
        
        expanded_terms = [condition]
        
        # Add related terms
        for key, terms in term_mappings.items():
            if key in condition_lower:
                expanded_terms.extend(terms.split())
        
        # Add common medical suffixes
        if any(word in condition_lower for word in ['ache', 'pain', 'itis', 'osis']):
            expanded_terms.extend(['analgesic', 'painkiller', 'anti-inflammatory'])
        
        return ' '.join(expanded_terms)

    def _keyword_based_filtering(self, condition_expanded: str, drug_data: list, max_suggestions: int) -> List[Dict]:
        """Fallback keyword-based filtering when TF-IDF fails"""
        try:
            condition_words = set(condition_expanded.lower().split())
            suggestions = []
            
            for drug in drug_data:
                # Create drug text for matching
                drug_text = f"{drug.name} {drug.generic_name} {drug.category} {drug.therapeutic_class or ''} {drug.dosage_instructions or ''}".lower()
                drug_words = set(drug_text.split())
                
                # Calculate keyword overlap
                overlap = len(condition_words.intersection(drug_words))
                if overlap > 0:
                    # Calculate a simple score based on overlap
                    score = overlap / len(condition_words)
                    suggestions.append({
                        'drug': drug,
                        'similarity_score': score,
                        'method': 'keyword_matching',
                        'reasoning': f"Keyword match with {overlap} common terms"
                    })
            
            # Sort by score and return top suggestions
            suggestions.sort(key=lambda x: x['similarity_score'], reverse=True)
            return suggestions[:max_suggestions]
            
        except Exception as e:
            logger.error(f"Error in keyword-based filtering: {e}")
            return []
    
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
        Get AI-enhanced medication suggestions with multiple ML approaches
        """
        try:
            logger.info(f"🚀 STARTING AI-ENHANCED SUGGESTIONS for Patient {patient_id}, Condition: '{condition}'")
            patient = Patient.objects.get(id=patient_id)
            excluded_drugs = excluded_drugs or []
            
            # Get base suggestions using multiple AI approaches
            suggestions = []
            
            # 1. Content-based filtering using drug descriptions
            logger.info("📊 Running Content-Based Filtering...")
            content_suggestions = self._content_based_filtering(
                condition, patient, excluded_drugs, max_suggestions
            )
            logger.info(f"📊 Content-based found {len(content_suggestions)} suggestions")
            
            # 2. Collaborative filtering based on similar patients
            if use_patient_similarity:
                logger.info("👥 Running Collaborative Filtering...")
                collaborative_suggestions = self._collaborative_filtering(
                    patient, condition, excluded_drugs, max_suggestions
                )
                logger.info(f"👥 Collaborative found {len(collaborative_suggestions)} suggestions")
            else:
                collaborative_suggestions = []
            
            # 3. Semantic similarity using condition embeddings
            logger.info("🧠 Running Semantic Similarity...")
            semantic_suggestions = self._semantic_similarity_filtering(
                condition, patient, excluded_drugs, max_suggestions
            )
            logger.info(f"🧠 Semantic found {len(semantic_suggestions)} suggestions")
            
            # 4. Safety-optimized suggestions
            logger.info("🛡️ Running Safety-Optimized Filtering...")
            safety_suggestions = self._safety_optimized_filtering(
                patient, condition, excluded_drugs, max_suggestions
            )
            logger.info(f"🛡️ Safety-optimized found {len(safety_suggestions)} suggestions")
            
            # Combine and rank suggestions using ensemble approach
            logger.info("🎯 Running Ensemble Ranking...")
            all_suggestions = self._ensemble_ranking(
                content_suggestions,
                collaborative_suggestions, 
                semantic_suggestions,
                safety_suggestions,
                max_suggestions,
                doctor_input=condition,
                patient=patient
            )
            logger.info(f"🎯 Ensemble ranking produced {len(all_suggestions)} suggestions")
            
            # Apply dosage optimization if requested
            if use_dosage_optimization:
                logger.info("💊 Applying Dosage Optimization...")
                all_suggestions = self._optimize_dosages(all_suggestions, patient, condition)
            
            # If no suggestions found, try a simple fallback
            if not all_suggestions:
                logger.warning("⚠️ NO SUGGESTIONS FOUND - Using fallback method")
                all_suggestions = self._fallback_suggestions(patient, condition, excluded_drugs, max_suggestions)
                logger.info(f"⚠️ Fallback produced {len(all_suggestions)} suggestions")
            
            final_suggestions = all_suggestions[:max_suggestions]
            logger.info(f"✅ FINAL RESULT: Returning {len(final_suggestions)} AI-enhanced suggestions")
            
            # Log the methods used in the final suggestions
            methods_used = set()
            for suggestion in final_suggestions:
                if 'method' in suggestion:
                    methods_used.add(suggestion['method'])
            logger.info(f"🔧 METHODS USED: {', '.join(methods_used) if methods_used else 'Unknown'}")
            
            return final_suggestions
            
        except Exception as e:
            logger.error(f"Error in AI suggestion service: {e}")
            return []

    def _fallback_suggestions(self, patient: Patient, condition: str, excluded_drugs: List[int], max_suggestions: int) -> List[Dict]:
        """Fallback method to return basic suggestions when AI methods fail"""
        try:
            # Get basic available drugs
            drugs = Drug.objects.filter(availability='available').exclude(
                id__in=excluded_drugs
            ).exclude(
                allergy_conflicts__in=patient.patient_allergies.values_list('allergy', flat=True)
            )[:max_suggestions]
            
            suggestions = []
            for drug in drugs:
                suggestions.append({
                    'drug': drug,
                    'similarity_score': 0.1,  # Low but non-zero score
                    'method': 'fallback',
                    'reasoning': f"Basic suggestion for {condition} - safe for patient allergies"
                })
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error in fallback suggestions: {e}")
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
            
            if not drugs.exists():
                return []
            
            # Create drug descriptions for TF-IDF with expanded terms
            drug_descriptions = []
            drug_data = []
            
            # Expand condition with synonyms and related terms
            condition_expanded = self._expand_condition_terms(condition)
            
            for drug in drugs:
                # Create weighted text that heavily emphasizes the category field
                drug_category = drug.category.replace('-', ' ').replace('_', ' ')  # Normalize category
                
                # Repeat category multiple times to give it maximum weight in TF-IDF analysis
                weighted_text = f"{drug_category} {drug_category} {drug_category} {drug_category} {drug.name} {drug.generic_name} {drug.therapeutic_class or ''} {drug.dosage_instructions or ''} {drug.side_effects or ''}"
                
                drug_descriptions.append(weighted_text)
                drug_data.append(drug)
            
            # Vectorize drug descriptions
            # Vectorize drug descriptions
            if self.vectorizer is None:
                self.vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
                
            drug_vectors = self.vectorizer.fit_transform(drug_descriptions)
            condition_vector = self.vectorizer.transform([condition_expanded])
            
            # Calculate similarities
            similarities = cosine_similarity(condition_vector, drug_vectors).flatten()
            
            # Get top suggestions
            top_indices = np.argsort(similarities)[::-1][:max_suggestions]
            
            suggestions = []
            for idx in top_indices:
                if similarities[idx] > 0.01:  # Lower similarity threshold
                    drug = drug_data[idx]
                    # Add condition-specific reasoning
                    reasoning = self._get_condition_specific_reasoning(condition, drug)
                    suggestions.append({
                        'drug': drug,
                        'similarity_score': float(similarities[idx]),
                        'method': 'content_based',
                        'reasoning': reasoning
                    })
            
            # If no suggestions found with TF-IDF, try keyword matching
            if not suggestions:
                suggestions = self._keyword_based_filtering(condition_expanded, drug_data, max_suggestions)
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error in content-based filtering: {e}")
        
        return []
    
    def _get_condition_specific_reasoning(self, condition: str, drug: Drug) -> str:
        """Generate condition-specific reasoning for drug suggestions"""
        condition_lower = condition.lower()
        drug_name = drug.name.lower()
        therapeutic_class = (drug.therapeutic_class or '').lower()
        category = drug.category.lower()
        
        # Condition-specific reasoning
        if 'headache' in condition_lower or 'migraine' in condition_lower:
            if 'analgesic' in therapeutic_class or 'acetaminophen' in drug_name or 'ibuprofen' in drug_name:
                return f"Recommended for headache relief - {therapeutic_class or category}"
            elif 'pain' in therapeutic_class:
                return f"Pain management medication suitable for headaches"
        
        elif 'fever' in condition_lower:
            if 'antipyretic' in therapeutic_class or 'acetaminophen' in drug_name or 'ibuprofen' in drug_name:
                return f"Fever reducer - {therapeutic_class or category}"
            elif 'analgesic' in therapeutic_class:
                return f"Analgesic with antipyretic properties for fever"
        
        elif 'pain' in condition_lower:
            if 'analgesic' in therapeutic_class or 'pain' in therapeutic_class:
                return f"Pain relief medication - {therapeutic_class or category}"
            elif 'acetaminophen' in drug_name or 'ibuprofen' in drug_name or 'morphine' in drug_name:
                return f"Effective pain management drug"
        
        elif 'diabetes' in condition_lower:
            if 'antidiabetic' in therapeutic_class or 'metformin' in drug_name or 'insulin' in drug_name:
                return f"Diabetes management medication - {therapeutic_class or category}"
            elif 'glucose' in therapeutic_class:
                return f"Glucose control medication for diabetes"
        
        elif 'hypertension' in condition_lower or 'blood pressure' in condition_lower:
            if 'antihypertensive' in therapeutic_class or 'amlodipine' in drug_name or 'lisinopril' in drug_name:
                return f"Blood pressure medication - {therapeutic_class or category}"
            elif 'cardiovascular' in therapeutic_class:
                return f"Cardiovascular medication for hypertension"
        
        elif 'anxiety' in condition_lower:
            if 'anxiolytic' in therapeutic_class or 'alprazolam' in drug_name or 'lorazepam' in drug_name:
                return f"Anxiety medication - {therapeutic_class or category}"
            elif 'anxiety' in therapeutic_class:
                return f"Anti-anxiety medication"
        
        elif 'depression' in condition_lower:
            if 'antidepressant' in therapeutic_class or 'fluoxetine' in drug_name or 'sertraline' in drug_name:
                return f"Antidepressant medication - {therapeutic_class or category}"
            elif 'ssri' in therapeutic_class:
                return f"SSRI antidepressant for depression"
        
        elif 'asthma' in condition_lower or 'breathing' in condition_lower:
            if 'bronchodilator' in therapeutic_class or 'albuterol' in drug_name:
                return f"Respiratory medication for asthma - {therapeutic_class or category}"
            elif 'respiratory' in therapeutic_class:
                return f"Respiratory medication for breathing issues"
        
        elif 'allergy' in condition_lower:
            if 'antihistamine' in therapeutic_class or 'diphenhydramine' in drug_name or 'loratadine' in drug_name:
                return f"Allergy medication - {therapeutic_class or category}"
            elif 'allergic' in therapeutic_class:
                return f"Anti-allergy medication"
        
        elif 'infection' in condition_lower:
            if 'antibiotic' in therapeutic_class or 'amoxicillin' in drug_name or 'penicillin' in drug_name:
                return f"Antibiotic for infection - {therapeutic_class or category}"
            elif 'antimicrobial' in therapeutic_class:
                return f"Antimicrobial medication for infection"
        
        # Default reasoning
        return f"Content-based match for {condition} - {therapeutic_class or category}"
    
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
            ).select_related('patient').prefetch_related('medications')
            
            # Count drug frequency for similar patients
            drug_frequency = {}
            for prescription in prescriptions:
                for medication in prescription.medications.all():
                    drug_id = medication.id
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
    
    def _semantic_similarity_filtering(
        self, 
        condition: str, 
        patient: Patient, 
        excluded_drugs: List[int],
        max_suggestions: int
    ) -> List[Dict]:
        """Semantic similarity using sentence transformers or fallback to enhanced keyword matching"""
        try:
            # If sentence transformers not available, use enhanced keyword matching
            if not self._is_semantic_model_available():
                logger.info("🤖 SEMANTIC MODEL NOT AVAILABLE - Using enhanced keyword matching fallback")
                return self._enhanced_keyword_semantic_filtering(condition, patient, excluded_drugs, max_suggestions)
            
            logger.info(f"🧠 USING SEMANTIC SIMILARITY MODEL for condition: '{condition}'")
            
            # Get drugs with therapeutic classes
            drugs = Drug.objects.filter(
                availability='available',
                therapeutic_class__isnull=False
            ).exclude(id__in=excluded_drugs).exclude(
                allergy_conflicts__in=patient.patient_allergies.values_list('allergy', flat=True)
            )
            
            if not drugs.exists():
                return []
            
            # Create condition-disease mappings for semantic matching
            condition_mappings = {
                'headache': ['migraine', 'tension headache', 'cluster headache', 'pain relief', 'analgesic'],
                'fever': ['pyrexia', 'hyperthermia', 'antipyretic', 'temperature', 'fever reducer'],
                'pain': ['analgesia', 'pain management', 'chronic pain', 'acute pain', 'analgesic', 'painkiller'],
                'infection': ['bacterial infection', 'viral infection', 'antimicrobial', 'antibiotic', 'antiviral'],
                'hypertension': ['high blood pressure', 'cardiovascular', 'antihypertensive', 'blood pressure'],
                'diabetes': ['diabetic', 'blood sugar', 'glucose', 'insulin', 'antidiabetic'],
                'anxiety': ['anxiolytic', 'panic disorder', 'stress', 'mental health', 'anxiety'],
                'depression': ['antidepressant', 'mood disorder', 'mental health', 'SSRI', 'depression'],
                'asthma': ['respiratory', 'bronchodilator', 'breathing', 'lung', 'asthma'],
                'allergy': ['antihistamine', 'allergic reaction', 'hypersensitivity', 'allergy'],
                'nausea': ['nausea', 'vomiting', 'antiemetic', 'stomach'],
                'cough': ['cough', 'coughing', 'antitussive', 'respiratory'],
                'inflammation': ['inflammation', 'anti-inflammatory', 'swelling', 'inflammatory']
            }
            
            # Expand condition with related terms
            expanded_condition = condition.lower()
            for key, terms in condition_mappings.items():
                if key in condition.lower():
                    expanded_condition += " " + " ".join(terms)
            
            # Calculate semantic similarities
            condition_embedding = self.condition_model.encode([expanded_condition])
            drug_embeddings = []
            drug_list = []
            
            for drug in drugs:
                # Create weighted text that heavily emphasizes the category field for semantic analysis
                drug_category = drug.category.replace('-', ' ').replace('_', ' ')  # Normalize category
                
                # Repeat category multiple times to give it maximum weight in semantic analysis
                weighted_drug_text = f"{drug_category} {drug_category} {drug_category} {drug.name} {drug.generic_name} {drug.therapeutic_class} {drug.dosage_instructions or ''}"
                
                drug_embeddings.append(weighted_drug_text)
                drug_list.append(drug)
            
            if drug_embeddings:
                drug_embeddings = self.condition_model.encode(drug_embeddings)
                similarities = cosine_similarity(condition_embedding, drug_embeddings).flatten()
                
                # Get top suggestions
                top_indices = np.argsort(similarities)[::-1][:max_suggestions]
                
                suggestions = []
                for idx in top_indices:
                    if similarities[idx] > 0.2:  # Lower threshold for semantic similarity
                        suggestions.append({
                            'drug': drug_list[idx],
                            'similarity_score': float(similarities[idx]),
                            'method': 'semantic',
                            'reasoning': f"Semantically similar to condition: {condition}"
                        })
                
                return suggestions
            
        except Exception as e:
            logger.error(f"Error in semantic similarity filtering: {e}")
            # Fallback to enhanced keyword matching
            return self._enhanced_keyword_semantic_filtering(condition, patient, excluded_drugs, max_suggestions)
        
        return []
    
    def _enhanced_keyword_semantic_filtering(
        self, 
        condition: str, 
        patient: Patient, 
        excluded_drugs: List[int],
        max_suggestions: int
    ) -> List[Dict]:
        """Enhanced keyword-based semantic filtering when sentence transformers unavailable"""
        try:
            # Get all available drugs
            drugs = Drug.objects.filter(availability='available').exclude(
                id__in=excluded_drugs
            ).exclude(
                allergy_conflicts__in=patient.patient_allergies.values_list('allergy', flat=True)
            )
            
            if not drugs.exists():
                return []
            
            # Enhanced condition-disease mappings with more specific terms
            condition_mappings = {
                'headache': ['migraine', 'tension', 'cluster', 'pain', 'analgesic', 'acetaminophen', 'ibuprofen', 'aspirin'],
                'fever': ['fever', 'temperature', 'pyrexia', 'antipyretic', 'acetaminophen', 'ibuprofen'],
                'pain': ['pain', 'ache', 'analgesic', 'acetaminophen', 'ibuprofen', 'morphine', 'tramadol'],
                'infection': ['infection', 'bacterial', 'viral', 'antibiotic', 'antimicrobial', 'amoxicillin', 'penicillin'],
                'hypertension': ['hypertension', 'blood pressure', 'cardiovascular', 'antihypertensive', 'amlodipine', 'lisinopril'],
                'diabetes': ['diabetes', 'diabetic', 'glucose', 'insulin', 'metformin', 'antidiabetic'],
                'anxiety': ['anxiety', 'anxiolytic', 'stress', 'alprazolam', 'lorazepam', 'diazepam'],
                'depression': ['depression', 'antidepressant', 'mood', 'fluoxetine', 'sertraline', 'citalopram'],
                'asthma': ['asthma', 'respiratory', 'bronchodilator', 'albuterol', 'inhaler', 'breathing'],
                'allergy': ['allergy', 'antihistamine', 'allergic', 'diphenhydramine', 'loratadine', 'cetirizine'],
                'nausea': ['nausea', 'vomiting', 'antiemetic', 'ondansetron', 'metoclopramide'],
                'cough': ['cough', 'antitussive', 'dextromethorphan', 'codeine', 'respiratory'],
                'inflammation': ['inflammation', 'anti-inflammatory', 'ibuprofen', 'naproxen', 'corticosteroid']
            }
            
            # Expand condition with related terms
            expanded_condition = condition.lower()
            for key, terms in condition_mappings.items():
                if key in condition.lower():
                    expanded_condition += " " + " ".join(terms)
            
            suggestions = []
            condition_words = set(expanded_condition.split())
            
            for drug in drugs:
                # Create weighted drug text that heavily emphasizes the category field
                drug_category = drug.category.replace('-', ' ').replace('_', ' ')  # Normalize category
                
                # Repeat category multiple times to give it maximum weight in keyword matching
                weighted_drug_text = f"{drug_category} {drug_category} {drug_category} {drug_category} {drug.name} {drug.generic_name} {drug.therapeutic_class or ''} {drug.dosage_instructions or ''}".lower()
                drug_words = set(weighted_drug_text.split())
                
                # Calculate enhanced similarity
                word_overlap = len(condition_words.intersection(drug_words))
                if word_overlap > 0:
                    # Calculate similarity score based on overlap and word importance
                    base_score = word_overlap / len(condition_words)
                    
                    # MASSIVE boost score for category matches (most important)
                    if any(word in drug.category.lower() for word in condition_words):
                        base_score *= 3.0  # Triple the score for category matches
                    
                    # Boost score for exact matches in drug names
                    if any(word in drug.name.lower() for word in condition_words):
                        base_score *= 1.5
                    
                    # Boost score for therapeutic class matches
                    if drug.therapeutic_class and any(word in drug.therapeutic_class.lower() for word in condition_words):
                        base_score *= 1.3
                    
                    suggestions.append({
                        'drug': drug,
                        'similarity_score': min(1.0, base_score),
                        'method': 'semantic_keyword',
                        'reasoning': f"Enhanced keyword match for condition: {condition}"
                    })
            
            # Sort by score and return top suggestions
            suggestions.sort(key=lambda x: x['similarity_score'], reverse=True)
            return suggestions[:max_suggestions]
            
        except Exception as e:
            logger.error(f"Error in enhanced keyword semantic filtering: {e}")
        return []
    
    def _safety_optimized_filtering(
        self, 
        patient: Patient, 
        condition: str, 
        excluded_drugs: List[int],
        max_suggestions: int
    ) -> List[Dict]:
        """Safety-optimized filtering with advanced risk assessment and condition relevance"""
        try:
            # Get all available drugs
            drugs = Drug.objects.filter(availability='available').exclude(
                id__in=excluded_drugs
            ).exclude(
                allergy_conflicts__in=patient.patient_allergies.values_list('allergy', flat=True)
            )
            
            suggestions = []
            for drug in drugs:
                safety_score, reasoning_list = self._calculate_advanced_safety_score(drug, patient, condition)
                
                # Apply condition relevance boost to safety score
                condition_relevance = self._calculate_condition_relevance(drug, condition)
                adjusted_score = safety_score * condition_relevance
                
                if adjusted_score > 0.3:  # Lower threshold but with condition relevance
                    # Add condition relevance to reasoning
                    if condition_relevance > 1.0:
                        reasoning_list.append(f"🎯 Highly relevant for {condition}")
                    elif condition_relevance < 0.8:
                        reasoning_list.append(f"⚠️ Less relevant for {condition}")
                    
                    suggestions.append({
                        'drug': drug,
                        'similarity_score': adjusted_score,
                        'method': 'safety_optimized',
                        'reasoning': "; ".join(reasoning_list)
                    })
            
            # Sort by adjusted safety score
            suggestions.sort(key=lambda x: x['similarity_score'], reverse=True)
            return suggestions[:max_suggestions]
            
        except Exception as e:
            logger.error(f"Error in safety-optimized filtering: {e}")
        
        return []
    
    def _calculate_condition_relevance(self, drug: Drug, condition: str) -> float:
        """Calculate how relevant a drug is to the specific condition"""
        condition_lower = condition.lower()
        drug_name = drug.name.lower()
        therapeutic_class = (drug.therapeutic_class or '').lower()
        category = drug.category.lower()
        
        # Condition-specific relevance scoring
        relevance_score = 1.0  # Base relevance
        
        # High relevance conditions
        if 'headache' in condition_lower or 'migraine' in condition_lower:
            if 'analgesic' in therapeutic_class or 'acetaminophen' in drug_name or 'ibuprofen' in drug_name or 'aspirin' in drug_name:
                relevance_score = 1.5
            elif 'pain' in therapeutic_class:
                relevance_score = 1.2
        
        elif 'fever' in condition_lower:
            if 'antipyretic' in therapeutic_class or 'acetaminophen' in drug_name or 'ibuprofen' in drug_name:
                relevance_score = 1.5
            elif 'analgesic' in therapeutic_class:
                relevance_score = 1.2
        
        elif 'pain' in condition_lower:
            if 'analgesic' in therapeutic_class or 'acetaminophen' in drug_name or 'ibuprofen' in drug_name or 'morphine' in drug_name or 'tramadol' in drug_name:
                relevance_score = 1.5
            elif 'pain' in therapeutic_class:
                relevance_score = 1.2
        
        elif 'diabetes' in condition_lower:
            if 'antidiabetic' in therapeutic_class or 'metformin' in drug_name or 'insulin' in drug_name or 'glipizide' in drug_name:
                relevance_score = 1.5
            elif 'glucose' in therapeutic_class:
                relevance_score = 1.2
        
        elif 'hypertension' in condition_lower or 'blood pressure' in condition_lower:
            if 'antihypertensive' in therapeutic_class or 'amlodipine' in drug_name or 'lisinopril' in drug_name or 'losartan' in drug_name:
                relevance_score = 1.5
            elif 'cardiovascular' in therapeutic_class:
                relevance_score = 1.2
        
        elif 'anxiety' in condition_lower:
            if 'anxiolytic' in therapeutic_class or 'alprazolam' in drug_name or 'lorazepam' in drug_name or 'diazepam' in drug_name:
                relevance_score = 1.5
            elif 'anxiety' in therapeutic_class:
                relevance_score = 1.2
        
        elif 'depression' in condition_lower:
            if 'antidepressant' in therapeutic_class or 'fluoxetine' in drug_name or 'sertraline' in drug_name or 'citalopram' in drug_name:
                relevance_score = 1.5
            elif 'ssri' in therapeutic_class:
                relevance_score = 1.2
        
        elif 'asthma' in condition_lower or 'breathing' in condition_lower:
            if 'bronchodilator' in therapeutic_class or 'albuterol' in drug_name or 'formoterol' in drug_name:
                relevance_score = 1.5
            elif 'respiratory' in therapeutic_class:
                relevance_score = 1.2
        
        elif 'allergy' in condition_lower:
            if 'antihistamine' in therapeutic_class or 'diphenhydramine' in drug_name or 'loratadine' in drug_name or 'cetirizine' in drug_name:
                relevance_score = 1.5
            elif 'allergic' in therapeutic_class:
                relevance_score = 1.2
        
        elif 'infection' in condition_lower:
            if 'antibiotic' in therapeutic_class or 'amoxicillin' in drug_name or 'penicillin' in drug_name or 'clarithromycin' in drug_name:
                relevance_score = 1.5
            elif 'antimicrobial' in therapeutic_class:
                relevance_score = 1.2
        
        # Penalty for completely irrelevant drugs
        elif any(irrelevant in therapeutic_class for irrelevant in ['antihypertensive', 'antidiabetic', 'anxiolytic', 'antidepressant', 'bronchodilator', 'antihistamine', 'antibiotic']):
            relevance_score = 0.7
        
        return relevance_score
    
    def _get_expected_category_for_condition(self, condition: str) -> str:
        """Get the expected drug category for a given medical condition"""
        condition_lower = condition.lower()
        
        # Map conditions to expected drug categories
        condition_to_category = {
            'headache': 'analgesic',
            'migraine': 'analgesic',
            'pain': 'analgesic',
            'fever': 'antipyretic',
            'diabetes': 'antidiabetic',
            'diabetic': 'antidiabetic',
            'hypertension': 'antihypertensive',
            'blood pressure': 'antihypertensive',
            'anxiety': 'antianxiety',  # Fixed to match actual database category
            'depression': 'antidepressant',
            'asthma': 'bronchodilator',
            'breathing': 'bronchodilator',
            'allergy': 'antihistamine',
            'allergic': 'antihistamine',
            'infection': 'antibiotic',
            'bacterial': 'antibiotic',
            'viral': 'antiviral',
            'inflammation': 'anti-inflammatory',
            'cough': 'antitussive',
            'nausea': 'antiemetic',
            'vomiting': 'antiemetic'
        }
        
        # Find the best matching condition
        for condition_key, expected_category in condition_to_category.items():
            if condition_key in condition_lower:
                return expected_category
        
        # Default to general if no specific match
        return 'general'
    
    def _calculate_advanced_safety_score(self, drug: Drug, patient: Patient, condition: str) -> Tuple[float, List[str]]:
        """
        Calculate advanced safety score using multiplicative penalty system
        Returns score and detailed reasoning array
        """
        base_score = 1.0  # Start with perfect score
        reasoning_parts = []
        
        # CONTEXT-AWARE CATEGORY CHECK - Most critical safety check
        expected_category = self._get_expected_category_for_condition(condition)
        drug_category = drug.category.lower().replace('-', ' ').replace('_', ' ')
        
        if expected_category != 'general':
            # Check if drug category matches expected therapeutic class
            if expected_category in drug_category:
                base_score *= 1.2  # 20% bonus for correct therapeutic class
                reasoning_parts.append(f"OK: Correct therapeutic class for {condition}")
            else:
                # Apply significant penalty for wrong therapeutic class
                base_score *= 0.3  # 70% penalty - this is a major safety issue
                reasoning_parts.append(f"🚨 WARNING: Not in primary therapeutic class for {condition} (expected: {expected_category}, got: {drug_category})")
        
        # Age-based adjustments (multiplicative)
        if patient.date_of_birth:
            from datetime import date
            today = date.today()
            age = today.year - patient.date_of_birth.year - ((today.month, today.day) < (patient.date_of_birth.month, patient.date_of_birth.day))
            
            if age < 18:
                if drug.pediatric_dose_mg_kg:
                    base_score *= 1.1  # 10% bonus
                    reasoning_parts.append("✅ Pediatric dosing available")
                else:
                    base_score *= 0.7  # 30% penalty
                    reasoning_parts.append("⚠️ No pediatric dosing guidelines")
            elif age > 65:
                if 'geriatric' in (drug.contraindications or '').lower():
                    base_score *= 0.4  # 60% penalty for major contraindication
                    reasoning_parts.append("🚨 Geriatric contraindications - HIGH RISK")
                else:
                    base_score *= 1.05  # 5% bonus
                    reasoning_parts.append("✅ Suitable for elderly")
        
        # Gender-based considerations (multiplicative)
        if patient.gender == 'F' and 'pregnant' in (drug.contraindications or '').lower():
            base_score *= 0.2  # 80% penalty for pregnancy contraindication
            reasoning_parts.append("🚨 Pregnancy contraindications - HIGH RISK")
        
        # Medical history considerations (multiplicative)
        if patient.medical_history:
            history_lower = patient.medical_history.lower()
            contraindications_lower = (drug.contraindications or '').lower()
            
            # Check for contraindicated conditions with severity-based penalties
            contraindicated_conditions = {
                'liver': 0.3,  # 70% penalty
                'kidney': 0.4,  # 60% penalty
                'heart': 0.5,  # 50% penalty
                'diabetes': 0.7,  # 30% penalty
                'hypertension': 0.8  # 20% penalty
            }
            
            for condition, penalty in contraindicated_conditions.items():
                if condition in history_lower and condition in contraindications_lower:
                    base_score *= penalty
                    if penalty <= 0.4:
                        reasoning_parts.append(f"🚨 Contraindicated for {condition} - HIGH RISK")
                    else:
                        reasoning_parts.append(f"⚠️ Contraindicated for {condition}")
        
        # Drug interaction risk (multiplicative)
        current_medications = self._get_patient_current_medications(patient)
        interaction_risk = self._assess_interaction_risk(drug, current_medications)
        
        if interaction_risk > 0.8:
            base_score *= 0.2  # 80% penalty for major interactions
            reasoning_parts.append("🚨 Major drug interactions - HIGH RISK")
        elif interaction_risk > 0.5:
            base_score *= 0.5  # 50% penalty for moderate interactions
            reasoning_parts.append("⚠️ Moderate drug interactions")
        elif interaction_risk > 0.2:
            base_score *= 0.8  # 20% penalty for minor interactions
            reasoning_parts.append("⚠️ Minor drug interactions")
        else:
            base_score *= 1.1  # 10% bonus for no interactions
            reasoning_parts.append("✅ No significant drug interactions")
        
        # Side effect profile (multiplicative)
        if drug.side_effects:
            side_effects_lower = drug.side_effects.lower()
            severe_side_effects = ['severe', 'serious', 'life-threatening', 'fatal']
            moderate_side_effects = ['moderate', 'significant', 'common']
            
            if any(se in side_effects_lower for se in severe_side_effects):
                base_score *= 0.3  # 70% penalty for severe side effects
                reasoning_parts.append("🚨 Severe side effects possible - HIGH RISK")
            elif any(se in side_effects_lower for se in moderate_side_effects):
                base_score *= 0.7  # 30% penalty for moderate side effects
                reasoning_parts.append("⚠️ Moderate side effects possible")
            else:
                base_score *= 1.05  # 5% bonus for mild side effects
                reasoning_parts.append("✅ Mild side effect profile")
        
        # Allergy conflicts (multiplicative)
        patient_allergies = patient.patient_allergies.values_list('allergy__name', flat=True)
        if drug.allergy_conflicts.exists():
            conflicting_allergies = drug.allergy_conflicts.filter(
                name__in=patient_allergies
            ).values_list('name', flat=True)
            
            if conflicting_allergies:
                base_score *= 0.1  # 90% penalty for allergy conflicts
                reasoning_parts.append(f"🚨 ALLERGY CONFLICT: {', '.join(conflicting_allergies)} - CONTRAINDICATED")
            else:
                base_score *= 0.9  # 10% penalty for potential cross-reactivity
                reasoning_parts.append("⚠️ Potential cross-reactivity with known allergies")
        else:
            base_score *= 1.05  # 5% bonus for no allergy conflicts
            reasoning_parts.append("✅ No known allergy conflicts")
        
        # Ensure score is between 0 and 1
        final_score = max(0.0, min(1.0, base_score))
        
        # Add overall safety assessment
        if final_score >= 0.8:
            reasoning_parts.append("✅ Overall: SAFE for this patient")
        elif final_score >= 0.5:
            reasoning_parts.append("⚠️ Overall: MODERATE risk - monitor closely")
        elif final_score >= 0.2:
            reasoning_parts.append("⚠️ Overall: HIGH risk - consider alternatives")
        else:
            reasoning_parts.append("🚨 Overall: CONTRAINDICATED - do not prescribe")
        
        return final_score, reasoning_parts
    
    def _find_similar_patients(self, patient: Patient, limit: int = 10) -> List[Patient]:
        """Find patients with similar characteristics using clustering"""
        try:
            # Get all patients with similar demographics
            similar_patients = Patient.objects.filter(
                # Note: age filtering removed as Patient model doesn't have age field
                gender=patient.gender
            ).exclude(id=patient.id)
            
            if not similar_patients.exists():
                return []
            
            # Create patient feature vectors
            patient_features = []
            patient_list = []
            
            for p in similar_patients:
                features = [
                    # Age calculation removed as Patient model doesn't have age field
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
                # Age calculation removed as Patient model doesn't have age field
                1 if patient.gender == 'M' else 0,
                len(patient.patient_allergies.all()),
                len(self._get_patient_current_medications(patient)),
                1 if patient.medical_history else 0
            ]])
            current_features = self.scaler.transform(current_features)
            
            # Use K-means to find similar patients
            n_clusters = min(3, len(patient_features))
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init='auto')
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
            ).prefetch_related('medications')
            
            medications = []
            for prescription in active_prescriptions:
                for medication in prescription.medications.all():
                    medications.append(medication)
            
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
    
    def _calculate_dynamic_weights(self, doctor_input: str, patient: Patient) -> Dict[str, float]:
        """
        Calculate dynamic weights based on context of doctor input and patient profile
        """
        try:
            # REBALANCED weights to prioritize clinical relevance over popularity
            weights = {
                'content_based': 0.35,    # Increased - analyzes condition vs drug descriptions
                'collaborative': 0.10,    # DRAMATICALLY reduced - was causing same results
                'semantic': 0.35,         # Increased - understands medical context
                'safety_optimized': 0.20  # Slightly reduced - still important for safety
            }
            
            # Analyze doctor input complexity
            input_words = len(doctor_input.split())
            input_complexity = input_words / 20.0  # Normalize to 0-1 scale
            
            # If doctor input is detailed (>15 words), boost content and semantic methods
            if input_words > 15:
                boost_factor = min(0.15, input_complexity * 0.1)
                weights['content_based'] += boost_factor
                weights['semantic'] += boost_factor
                logger.info(f"Detailed input detected ({input_words} words), boosting content/semantic methods")
            
            # Analyze patient complexity
            patient_complexity = 0
            complexity_factors = []
            
            # Count chronic conditions
            if patient.medical_history:
                chronic_conditions = ['diabetes', 'hypertension', 'heart', 'kidney', 'liver', 'asthma', 'copd']
                condition_count = sum(1 for condition in chronic_conditions if condition in patient.medical_history.lower())
                patient_complexity += condition_count * 0.1
                if condition_count > 0:
                    complexity_factors.append(f"{condition_count} chronic conditions")
            
            # Count current medications
            current_meds = self._get_patient_current_medications(patient)
            med_count = len(current_meds)
            patient_complexity += min(0.3, med_count * 0.05)
            if med_count > 0:
                complexity_factors.append(f"{med_count} current medications")
            
            # Count allergies
            allergy_count = len(patient.patient_allergies.all())
            patient_complexity += min(0.2, allergy_count * 0.1)
            if allergy_count > 0:
                complexity_factors.append(f"{allergy_count} known allergies")
            
            # If patient has complex history, boost safety and collaborative methods
            if patient_complexity > 0.3:
                boost_factor = min(0.15, patient_complexity * 0.2)  # Reduced boost
                weights['safety_optimized'] += boost_factor
                # Only boost collaborative if we have enough similar patients
                if len(self._find_similar_patients(patient)) > 3:
                    weights['collaborative'] += boost_factor
                logger.info(f"Complex patient profile detected: {', '.join(complexity_factors)}, boosting safety methods")
            
            # Normalize weights to sum to 1.0
            total_weight = sum(weights.values())
            weights = {k: v/total_weight for k, v in weights.items()}
            
            logger.info(f"Dynamic weights calculated: {weights}")
            return weights
            
        except Exception as e:
            logger.error(f"Error calculating dynamic weights: {e}")
            # Return rebalanced default weights if error
            return {
                'content_based': 0.35,
                'collaborative': 0.10,
                'semantic': 0.35,
                'safety_optimized': 0.20
            }
    
    def _ensemble_ranking(
        self, 
        content_suggestions: List[Dict],
        collaborative_suggestions: List[Dict], 
        semantic_suggestions: List[Dict],
        safety_suggestions: List[Dict],
        max_suggestions: int,
        doctor_input: str = "",
        patient: Patient = None
    ) -> List[Dict]:
        """Combine and rank suggestions using dynamic ensemble approach"""
        try:
            # Create drug ID to suggestion mapping
            drug_suggestions = {}
            
            # Calculate dynamic weights based on context
            if doctor_input and patient:
                method_weights = self._calculate_dynamic_weights(doctor_input, patient)
            else:
                # Fallback to rebalanced static weights
                method_weights = {
                    'content_based': 0.35,
                    'collaborative': 0.10,
                    'semantic': 0.35,
                    'safety_optimized': 0.20
            }
            
            # Combine all suggestions
            all_suggestions = content_suggestions + collaborative_suggestions + semantic_suggestions + safety_suggestions
            
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
                
                # Add small randomization to prevent identical scores
                import random
                randomization_factor = random.uniform(0.95, 1.05)
                
                final_score = (total_score + diversity_bonus) * randomization_factor
                
                # Combine reasoning
                combined_reasoning = " | ".join(set(data['reasoning']))
                
                final_suggestions.append({
                    'drug': data['drug'],
                    'similarity_score': final_score,
                    'method': 'ensemble',
                    'reasoning': combined_reasoning,
                    'methods_used': data['methods']
                })
            
            # Apply contextual boost based on patient history
            if patient and patient.medical_history:
                final_suggestions = self._apply_contextual_boost(final_suggestions, patient)
            
            # Apply diversity bonus to prevent redundant suggestions
            final_suggestions = self._apply_diversity_bonus(final_suggestions)
            
            # Sort by final score
            final_suggestions.sort(key=lambda x: x['similarity_score'], reverse=True)
            return final_suggestions[:max_suggestions]
            
        except Exception as e:
            logger.error(f"Error in ensemble ranking: {e}")
            return []
    
    def _apply_contextual_boost(self, suggestions: List[Dict], patient: Patient) -> List[Dict]:
        """
        Apply contextual boost based on patient's chronic conditions
        """
        try:
            if not patient.medical_history:
                return suggestions
            
            history_lower = patient.medical_history.lower()
            
            # Define therapeutic class mappings for chronic conditions
            condition_therapeutic_mapping = {
                'diabetes': ['antidiabetic', 'insulin', 'metformin', 'glucose', 'diabetic'],
                'hypertension': ['antihypertensive', 'ace inhibitor', 'beta blocker', 'calcium channel blocker'],
                'heart': ['cardiac', 'cardiovascular', 'heart', 'cardio', 'beta blocker', 'ace inhibitor'],
                'asthma': ['bronchodilator', 'respiratory', 'asthma', 'inhaler', 'corticosteroid'],
                'copd': ['bronchodilator', 'respiratory', 'copd', 'inhaler', 'corticosteroid'],
                'depression': ['antidepressant', 'ssri', 'mood', 'mental health'],
                'anxiety': ['anxiolytic', 'anxiety', 'mental health', 'benzodiazepine']
            }
            
            for suggestion in suggestions:
                drug = suggestion['drug']
                boost_applied = False
                
                # Check if drug's therapeutic class matches patient's chronic conditions
                for condition, therapeutic_terms in condition_therapeutic_mapping.items():
                    if condition in history_lower:
                        # Check drug name, generic name, and therapeutic class
                        drug_text = f"{drug.name} {drug.generic_name} {drug.therapeutic_class or ''}".lower()
                        
                        for term in therapeutic_terms:
                            if term in drug_text:
                                # Apply 15-20% boost
                                boost_factor = 1.15 + (0.05 * len(therapeutic_terms))  # 15-20% boost
                                suggestion['similarity_score'] *= boost_factor
                                
                                # Add reasoning
                                if 'contextual_boost' not in suggestion:
                                    suggestion['contextual_boost'] = []
                                suggestion['contextual_boost'].append(f"Perfect match for {condition}")
                                boost_applied = True
                                break
                        
                        if boost_applied:
                            break
                
                # Add contextual boost reasoning to main reasoning
                if boost_applied and 'contextual_boost' in suggestion:
                    boost_reasoning = f"🎯 Contextual boost: {', '.join(suggestion['contextual_boost'])}"
                    if 'reasoning' in suggestion:
                        suggestion['reasoning'] += f" | {boost_reasoning}"
                    else:
                        suggestion['reasoning'] = boost_reasoning
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error applying contextual boost: {e}")
            return suggestions
    
    def _apply_diversity_bonus(self, suggestions: List[Dict]) -> List[Dict]:
        """
        Apply diversity bonus to prevent redundant suggestions from same therapeutic class
        """
        try:
            if len(suggestions) <= 1:
                return suggestions
            
            # Track therapeutic classes already used
            used_classes = set()
            diversified_suggestions = []
            
            for suggestion in suggestions:
                drug = suggestion['drug']
                therapeutic_class = drug.therapeutic_class or drug.category or 'unknown'
                
                # Check if this therapeutic class is already represented
                if therapeutic_class in used_classes:
                    # Apply penalty for redundancy
                    penalty_factor = 0.85  # 15% penalty
                    suggestion['similarity_score'] *= penalty_factor
                    
                    # Add reasoning
                    if 'reasoning' in suggestion:
                        suggestion['reasoning'] += f" | ⚠️ Similar to previous suggestion ({therapeutic_class})"
                    else:
                        suggestion['reasoning'] = f"⚠️ Similar to previous suggestion ({therapeutic_class})"
                else:
                    # Add diversity bonus for new therapeutic class
                    bonus_factor = 1.05  # 5% bonus
                    suggestion['similarity_score'] *= bonus_factor
                    
                    if 'reasoning' in suggestion:
                        suggestion['reasoning'] += f" | ✅ Diverse therapeutic approach ({therapeutic_class})"
                    else:
                        suggestion['reasoning'] = f"✅ Diverse therapeutic approach ({therapeutic_class})"
                
                # Add to used classes
                used_classes.add(therapeutic_class)
                diversified_suggestions.append(suggestion)
            
            # Re-sort after applying diversity adjustments
            diversified_suggestions.sort(key=lambda x: x['similarity_score'], reverse=True)
            
            return diversified_suggestions
            
        except Exception as e:
            logger.error(f"Error applying diversity bonus: {e}")
            return suggestions
    
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
                        suggestion['dosage_reasoning'] = f"Optimized for patient weight and condition"
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
        """Analyze condition using NLP to extract symptoms and severity"""
        try:
            if not self.condition_model:
                return {'symptoms': [], 'severity': 'unknown', 'category': 'general'}
            
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
    
    def get_enhanced_ai_analysis(self, patient_id: int, condition: str) -> Dict:
        """
        Get comprehensive AI analysis including dynamic weights and safety assessment
        This method demonstrates the enhanced AI capabilities
        """
        try:
            patient = Patient.objects.get(id=patient_id)
            
            # Get dynamic weights
            dynamic_weights = self._calculate_dynamic_weights(condition, patient)
            
            # Get condition analysis
            condition_analysis = self.get_condition_analysis(condition)
            
            # Get AI suggestions with enhanced scoring
            suggestions = self.get_ai_enhanced_suggestions(
                patient_id=patient_id,
                condition=condition,
                max_suggestions=3,
                use_patient_similarity=True,
                use_dosage_optimization=True
            )
            
            # Analyze patient complexity
            patient_complexity = self._analyze_patient_complexity(patient)
            
            return {
                'dynamic_weights': dynamic_weights,
                'condition_analysis': condition_analysis,
                'patient_complexity': patient_complexity,
                'suggestions': suggestions,
                'ai_enhancements': {
                    'dynamic_weighting': True,
                    'contextual_boost': True,
                    'diversity_bonus': True,
                    'multiplicative_safety_scoring': True
                }
            }
            
        except Exception as e:
            logger.error(f"Error in enhanced AI analysis: {e}")
            return {}
    
    def _analyze_patient_complexity(self, patient: Patient) -> Dict:
        """Analyze patient complexity for AI weighting decisions"""
        try:
            complexity_score = 0
            factors = []
            
            # Count chronic conditions
            if patient.medical_history:
                chronic_conditions = ['diabetes', 'hypertension', 'heart', 'kidney', 'liver', 'asthma', 'copd']
                condition_count = sum(1 for condition in chronic_conditions if condition in patient.medical_history.lower())
                complexity_score += condition_count * 0.2
                if condition_count > 0:
                    factors.append(f"{condition_count} chronic conditions")
            
            # Count current medications
            current_meds = self._get_patient_current_medications(patient)
            med_count = len(current_meds)
            complexity_score += min(0.3, med_count * 0.05)
            if med_count > 0:
                factors.append(f"{med_count} current medications")
            
            # Count allergies
            allergy_count = len(patient.patient_allergies.all())
            complexity_score += min(0.2, allergy_count * 0.1)
            if allergy_count > 0:
                factors.append(f"{allergy_count} known allergies")
            
            # Determine complexity level
            if complexity_score >= 0.7:
                level = "high"
            elif complexity_score >= 0.4:
                level = "moderate"
            else:
                level = "low"
            
            return {
                'score': complexity_score,
                'level': level,
                'factors': factors
            }
            
        except Exception as e:
            logger.error(f"Error analyzing patient complexity: {e}")
            return {'score': 0, 'level': 'unknown', 'factors': []}
