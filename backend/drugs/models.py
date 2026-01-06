from django.db import models

class Allergy(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class Drug(models.Model):
    FORM_CHOICES = [
        ('tablet', 'Tablet'),
        ('capsule', 'Capsule'),
        ('liquid', 'Liquid'),
        ('injection', 'Injection'),
        ('cream', 'Cream'),
        ('ointment', 'Ointment'),
        ('inhaler', 'Inhaler'),
        ('drops', 'Drops'),
    ]
    
    AVAILABILITY_CHOICES = [
        ('available', 'Available'),
        ('out_of_stock', 'Out of Stock'),
        ('discontinued', 'Discontinued'),
    ]
    
    name = models.CharField(max_length=200)
    generic_name = models.CharField(max_length=200)
    strength = models.CharField(max_length=50)
    form = models.CharField(max_length=20, choices=FORM_CHOICES)
    category = models.CharField(max_length=100)
    manufacturer = models.CharField(max_length=200)
    dosage_instructions = models.TextField()
    side_effects = models.TextField(blank=True, null=True)
    contraindications = models.TextField(blank=True, null=True)
    interactions = models.TextField(blank=True, null=True)
    therapeutic_class = models.CharField(max_length=100, blank=True, null=True)
    # Add allergy conflicts
    allergy_conflicts = models.ManyToManyField(Allergy, blank=True, related_name='conflicting_drugs')
    availability = models.CharField(max_length=20, choices=AVAILABILITY_CHOICES, default='available')
    price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Safety fields
    pregnancy_safe = models.BooleanField(default=False)
    breastfeeding_safe = models.BooleanField(default=False)
    pediatric_safe = models.BooleanField(default=True)
    geriatric_safe = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} {self.strength} {self.form}"

class Interaction(models.Model):
    """
    Represents a clinical interaction event that can involve
    two or more drugs.
    """
    SEVERITY_CHOICES = [
        ('High', 'High'),
        ('Moderate', 'Moderate'),
        ('Low', 'Low'),
    ]

    name = models.CharField(max_length=255, help_text="Clinical name of the interaction, e.g., 'Serotonin Syndrome Risk'")
    description = models.TextField(help_text="Detailed explanation of the interaction, its risks, and management.")
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES)
    
    # The key change: this links the interaction to a group of drugs.
    drugs = models.ManyToManyField(
        Drug,
        related_name='interaction_sets',
        help_text='The set of drugs that cause this interaction when taken together.'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        drug_names = ", ".join([drug.name for drug in self.drugs.all()])
        return f"{self.name} ({self.severity}) - {drug_names}"

    class Meta:
        ordering = ['name']
