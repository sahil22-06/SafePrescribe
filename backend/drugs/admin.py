from django.contrib import admin
from .models import Drug, Allergy, Interaction

@admin.register(Drug)
class DrugAdmin(admin.ModelAdmin):
    list_display = ['name', 'generic_name', 'therapeutic_class', 'availability']
    list_filter = ['therapeutic_class', 'availability', 'form']
    search_fields = ['name', 'generic_name']
    filter_horizontal = ['allergy_conflicts']

@admin.register(Allergy)
class AllergyAdmin(admin.ModelAdmin):
    list_display = ['name', 'description']
    search_fields = ['name']

@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):
    list_display = ['name', 'severity', 'get_drug_count', 'created_at']
    list_filter = ['severity', 'created_at']
    search_fields = ['name', 'description']
    filter_horizontal = ['drugs']
    
    def get_drug_count(self, obj):
        return obj.drugs.count()
    get_drug_count.short_description = 'Number of Drugs'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'severity')
        }),
        ('Drugs Involved', {
            'fields': ('drugs',),
            'description': 'Select all drugs that are part of this interaction. The interaction will trigger when ALL selected drugs are present in a patient\'s medication list.'
        }),
    )
