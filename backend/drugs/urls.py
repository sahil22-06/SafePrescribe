from django.urls import path
from .views import (
    DrugListCreateView, DrugDetailView, drug_stats, 
    AllergyListCreateView, AllergyDetailView, 
    check_medication_conflict, check_prescription_interactions, check_allergy_only,
    get_allergy_aware_suggestions, get_enhanced_ai_suggestions, 
    analyze_condition, get_safety_analysis
)

urlpatterns = [
    path('drugs/', DrugListCreateView.as_view(), name='drug-list'),
    path('drugs/<int:pk>/', DrugDetailView.as_view(), name='drug-detail'),
    path('drugs/stats/', drug_stats, name='drug-stats'),
    path('allergies/', AllergyListCreateView.as_view(), name='allergy-list'),
    path('allergies/<int:pk>/', AllergyDetailView.as_view(), name='allergy-detail'),
    path('medications/check-conflict/', check_medication_conflict, name='check-medication-conflict'),
    path('medications/check-prescription-interactions/', check_prescription_interactions, name='check-prescription-interactions'),
    path('medications/check-allergy-only/', check_allergy_only, name='check-allergy-only'),
    
    # AI Suggestion API endpoints
    path('suggestions/allergy-aware/', get_allergy_aware_suggestions, name='allergy-aware-suggestions'),
    path('suggestions/basic/', get_allergy_aware_suggestions, name='basic-suggestions'),  # Alias for backward compatibility
    path('ai-suggestions/enhanced/', get_enhanced_ai_suggestions, name='enhanced-ai-suggestions'),
    path('ai-suggestions/analyze-condition/', analyze_condition, name='analyze-condition'),
    path('ai-suggestions/safety-analysis/', get_safety_analysis, name='safety-analysis'),
] 