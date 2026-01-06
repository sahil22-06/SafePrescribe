from rest_framework import serializers
from .models import Drug, Allergy

class AllergySerializer(serializers.ModelSerializer):
    class Meta:
        model = Allergy
        fields = ['id', 'name', 'description']

class DrugSerializer(serializers.ModelSerializer):
    allergy_conflicts = AllergySerializer(many=True, read_only=True)
    class Meta:
        model = Drug
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at'] 