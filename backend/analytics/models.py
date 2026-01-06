from django.db import models
from django.conf import settings
from patients.models import Patient
from drugs.models import Drug, Allergy
from rx.models import Prescription, PrescriptionMedication


class PrescriptionAnalytics(models.Model):
    """Store aggregated prescription analytics data"""
    date = models.DateField()
    total_prescriptions = models.IntegerField(default=0)
    active_prescriptions = models.IntegerField(default=0)
    completed_prescriptions = models.IntegerField(default=0)
    cancelled_prescriptions = models.IntegerField(default=0)
    expired_prescriptions = models.IntegerField(default=0)
    
    # Drug category breakdown
    antibiotics_count = models.IntegerField(default=0)
    analgesics_count = models.IntegerField(default=0)
    antihypertensives_count = models.IntegerField(default=0)
    antidiabetics_count = models.IntegerField(default=0)
    statins_count = models.IntegerField(default=0)
    other_count = models.IntegerField(default=0)
    
    # Safety metrics
    allergy_warnings_count = models.IntegerField(default=0)
    drug_interaction_warnings_count = models.IntegerField(default=0)
    duplicate_therapy_warnings_count = models.IntegerField(default=0)
    
    # Adherence metrics
    average_adherence_score = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    low_adherence_patients_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('date',)
        ordering = ['-date']
    
    def __str__(self):
        return f"Analytics for {self.date}"


class AllergyPatternAnalysis(models.Model):
    """Analyze allergy patterns across patients"""
    allergy = models.ForeignKey(Allergy, on_delete=models.CASCADE)
    total_patients_with_allergy = models.IntegerField(default=0)
    percentage_of_population = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    most_common_age_group = models.CharField(max_length=20, blank=True, null=True)
    gender_distribution = models.JSONField(default=dict)  # {'M': 45, 'F': 55}
    common_drug_conflicts = models.JSONField(default=list)  # List of drug names
    severity_distribution = models.JSONField(default=dict)  # {'mild': 30, 'moderate': 50, 'severe': 20}
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-total_patients_with_allergy']
    
    def __str__(self):
        return f"{self.allergy.name} - {self.total_patients_with_allergy} patients"


class SafetyScoreAnalytics(models.Model):
    """Track safety scores and trends"""
    date = models.DateField()
    average_safety_score = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    high_safety_prescriptions = models.IntegerField(default=0)  # Score >= 0.8
    medium_safety_prescriptions = models.IntegerField(default=0)  # Score 0.6-0.79
    low_safety_prescriptions = models.IntegerField(default=0)  # Score < 0.6
    contraindicated_prescriptions = models.IntegerField(default=0)  # Score = 0
    
    # Safety score breakdown by drug category
    safety_by_category = models.JSONField(default=dict)
    
    # Common safety issues
    top_safety_issues = models.JSONField(default=list)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('date',)
        ordering = ['-date']
    
    def __str__(self):
        return f"Safety Analytics for {self.date}"


class UsageStatistics(models.Model):
    """Track medication usage statistics"""
    date = models.DateField()
    drug = models.ForeignKey(Drug, on_delete=models.CASCADE)
    
    # Usage metrics
    prescriptions_count = models.IntegerField(default=0)
    total_quantity_prescribed = models.IntegerField(default=0)
    average_dosage = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    average_duration_days = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    
    # Patient demographics
    pediatric_usage = models.IntegerField(default=0)  # Age < 18
    adult_usage = models.IntegerField(default=0)      # Age 18-65
    geriatric_usage = models.IntegerField(default=0)  # Age > 65
    
    # Safety metrics
    allergy_conflicts_count = models.IntegerField(default=0)
    interaction_warnings_count = models.IntegerField(default=0)
    average_safety_score = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    
    # Adherence metrics
    average_adherence_score = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('date', 'drug')
        ordering = ['-date', '-prescriptions_count']
    
    def __str__(self):
        return f"{self.drug.name} - {self.date} ({self.prescriptions_count} prescriptions)"


class DrugInteractionAnalytics(models.Model):
    """Analyze drug interaction patterns"""
    drug1 = models.ForeignKey(Drug, on_delete=models.CASCADE, related_name='interaction_analytics_as_drug1')
    drug2 = models.ForeignKey(Drug, on_delete=models.CASCADE, related_name='interaction_analytics_as_drug2')
    
    # Interaction frequency
    co_prescription_count = models.IntegerField(default=0)
    interaction_warnings_count = models.IntegerField(default=0)
    severity_distribution = models.JSONField(default=dict)  # {'minor': 10, 'moderate': 25, 'major': 5}
    
    # Patient impact
    affected_patients_count = models.IntegerField(default=0)
    average_patient_age = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    
    # Clinical outcomes
    dose_adjustments_count = models.IntegerField(default=0)
    therapy_changes_count = models.IntegerField(default=0)
    adverse_events_count = models.IntegerField(default=0)
    
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('drug1', 'drug2')
        ordering = ['-co_prescription_count']
    
    def __str__(self):
        return f"{self.drug1.name} + {self.drug2.name} ({self.co_prescription_count} co-prescriptions)"
