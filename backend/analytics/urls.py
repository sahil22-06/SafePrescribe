from django.urls import path
from .views import (
    prescription_trends_dashboard,
    allergy_pattern_analysis,
    safety_score_analytics,
    usage_statistics,
    drug_interaction_analytics
)

urlpatterns = [
    path('prescription-trends/', prescription_trends_dashboard, name='prescription-trends'),
    path('allergy-patterns/', allergy_pattern_analysis, name='allergy-patterns'),
    path('safety-scores/', safety_score_analytics, name='safety-scores'),
    path('usage-statistics/', usage_statistics, name='usage-statistics'),
    path('drug-interactions/', drug_interaction_analytics, name='drug-interactions'),
]
