import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, FormControl, InputLabel, Select, MenuItem, TextField, Button, Alert, Paper, Divider, Typography, Box, Snackbar, FormHelperText, Chip, Card, CardContent, IconButton, Tooltip, List, ListItem, ListItemIcon, ListItemText
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MedicationIcon from '@mui/icons-material/Medication';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import ScienceIcon from '@mui/icons-material/Science';
import SecurityIcon from '@mui/icons-material/Security';
import { conflictAPI } from '../services/api';
import MasterSuggestionPanel from './MasterSuggestionPanel';


function toISODate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

const PrescriptionDialog = ({
  open,
  onClose,
  onSubmit,
  patients,
  drugs,
  drugsLoading = false,
  initialPatient = '',
  initialData = {},
  loading = false,
  error = '',
  backendWarning = '',
  onFormChange, // New prop for parent component to track form changes
}) => {
  // Debug drugs prop
  console.log('💊 PrescriptionDialog received drugs:', drugs?.length || 0, 'drugs');

  // Snackbar state for user feedback
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Form state using useState
  const [formData, setFormData] = useState({
    patient: initialPatient || '',
    prescribed_date: '',
    expiry_date: '',
    status: 'active',
    instructions: '',
    reason: '', // Moved reason to prescription level
    medications: [], // Ensure medications is always an array
    medForm: {
      drug: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity: '',
      refills: ''
    },
    ...initialData,
  });

  // Form validation errors
  const [errors, setErrors] = useState({});

  // Helper function to ensure medications is always an array
  const getMedications = () => {
    return Array.isArray(formData.medications) ? formData.medications : [];
  };

  // Allergy warning states
  const [medAllergyWarnings, setMedAllergyWarnings] = useState([]);
  const [medFormAllergyWarning, setMedFormAllergyWarning] = useState('');

  // Real-time conflict checking states
  const [conflictWarnings, setConflictWarnings] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingMedication, setPendingMedication] = useState(null);
  const [prescriptionInteractions, setPrescriptionInteractions] = useState([]);

  // Reset form when dialog opens - simplified
  useEffect(() => {
    if (open) {
      setFormData({
        patient: initialPatient || '',
        prescribed_date: '',
        expiry_date: '',
        status: 'active',
        instructions: '',
        reason: initialData?.reason || '', // Preserve reason from initialData if available
        medications: initialData?.medications || [], // Ensure medications is always an array
        medForm: {
          drug: '',
          dosage: '',
          frequency: '',
          duration: '',
          quantity: '',
          refills: ''
        },
        ...initialData,
      });
      setErrors({});
    }
  }, [open, initialPatient]); // Only reset when dialog opens or initialPatient changes

  // Check for allergy warnings in added medications
  useEffect(() => {
    if (!formData.patient) {
      setMedAllergyWarnings([]);
      return;
    }
    const patient = patients.find((p) => p.id === Number(formData.patient));
    if (!patient) {
      setMedAllergyWarnings([]);
      return;
    }
    const patientAllergyIds = (patient.detailed_allergies || []).map(a => a.allergy?.id);
    const warnings = formData.medications.map((med) => {
      const drug = drugs.find((d) => d.id === Number(med?.drug));
      if (drug && drug.allergy_conflicts) {
        const drugConflictIds = drug.allergy_conflicts.map(a => a.id);
        const conflicts = patientAllergyIds.filter(id => drugConflictIds.includes(id));
        if (conflicts.length > 0) {
          const conflictNames = drug.allergy_conflicts.filter(a => conflicts.includes(a.id)).map(a => a.name);
          return `Warning: Patient is allergic to: ${conflictNames.join(', ')}. This drug may cause an allergic reaction.`;
        }
      }
      return '';
    });
    setMedAllergyWarnings(warnings);
  }, [formData.patient, formData.medications, patients, drugs]);

  // Check for allergy warnings in medication form
  useEffect(() => {
    if (!formData.patient || !formData.medForm.drug) {
      setMedFormAllergyWarning('');
      return;
    }
    const patient = patients.find((p) => p.id === Number(formData.patient));
    const drug = drugs.find((d) => d.id === Number(formData.medForm.drug));
    if (patient && drug && drug.allergy_conflicts) {
      const patientAllergyIds = (patient.detailed_allergies || []).map(a => a.allergy?.id);
      const drugConflictIds = drug.allergy_conflicts.map(a => a.id);
      const conflicts = patientAllergyIds.filter(id => drugConflictIds.includes(id));
      if (conflicts.length > 0) {
        const conflictNames = drug.allergy_conflicts.filter(a => conflicts.includes(a.id)).map(a => a.name);
        setMedFormAllergyWarning(`Warning: Patient is allergic to: ${conflictNames.join(', ')}. This drug may cause an allergic reaction.`);
        return;
      }
    }
    setMedFormAllergyWarning('');
  }, [formData.patient, formData.medForm.drug, patients, drugs]);

  // Check for interactions between medications in the prescription
  const checkPrescriptionInteractions = useCallback(async () => {
    if (getMedications().length < 2) return;

    console.log('🔍 Checking interactions between prescription medications...');
    const interactions = [];

    for (let i = 0; i < getMedications().length; i++) {
      for (let j = i + 1; j < getMedications().length; j++) {
        const med1 = getMedications()[i];
        const med2 = getMedications()[j];

        try {
          const response = await conflictAPI.checkConflict({
            patient_id: Number(formData.patient),
            new_medication_id: Number(med2.drug)
          });

          if (response.data.status === 'conflict') {
            // Check if this is a drug-drug interaction (not allergy)
            const drugInteractions = response.data.warnings.filter(w => w.type === 'Drug-Drug Interaction');
            if (drugInteractions.length > 0) {
              interactions.push({
                medication1: med1,
                medication2: med2,
                warnings: drugInteractions
              });
            }
          }
        } catch (error) {
          console.error('Error checking prescription interactions:', error);
        }
      }
    }

    if (interactions.length > 0) {
      console.log('🔍 Found prescription interactions:', interactions);
      // You could set these in state to display them
    }
  }, [formData.medications, formData.patient]);

  // Check prescription interactions when medications change
  useEffect(() => {
    checkPrescriptionInteractions();
  }, [checkPrescriptionInteractions]);

  // Test useEffect trigger
  useEffect(() => {
    console.log('🧪 Test useEffect - formData changed:', {
      patient: formData.patient,
      drug: formData.medForm.drug,
      fullFormData: formData
    });

    // Notify parent component of form changes
    if (onFormChange) {
      onFormChange(formData);
    }
  }, [formData, onFormChange]);

  // Check for interactions between medications in the form
  const checkFormInteractions = useCallback(async () => {
    if (getMedications().length < 2) {
      setPrescriptionInteractions([]);
      return;
    }

    console.log('🔍 Checking interactions between form medications...');

    try {
      // Get all medication IDs in the prescription
      const medicationIds = getMedications().map(med => Number(med?.drug)).filter(Boolean);

      const response = await conflictAPI.checkPrescriptionInteractions({
        patient_id: Number(formData.patient),
        medication_ids: medicationIds
      });

      if (response.data.status === 'conflict') {
        const interactions = [];

        // Handle drug-drug interactions
        if (response.data.interactions) {
          const drugInteractions = response.data.interactions.map(interaction => ({
            medication1: formData.medications.find(med => Number(med?.drug) === interaction.medication1_id),
            medication2: formData.medications.find(med => Number(med?.drug) === interaction.medication2_id),
            warnings: [{
              type: 'Multi-Drug Interaction',
              severity: interaction.severity,
              message: `High risk of ${interaction.interaction_name} when combining [${interaction.medication1_name}, ${interaction.medication2_name}]. ${interaction.description}`
            }]
          }));
          interactions.push(...drugInteractions);
        }

        // Handle duplicate therapy warnings
        if (response.data.duplicate_therapy) {
          const duplicateTherapyWarnings = response.data.duplicate_therapy.map(duplicate => ({
            therapeutic_class: duplicate.therapeutic_class,
            medication_ids: duplicate.medication_ids,
            medication_names: duplicate.medication_names,
            severity: duplicate.severity,
            description: duplicate.description,
            type: 'Duplicate Therapy'
          }));

          // Convert duplicate therapy warnings to interaction format for consistency
          duplicateTherapyWarnings.forEach(duplicate => {
            interactions.push({
              therapeutic_class: duplicate.therapeutic_class,
              medication_ids: duplicate.medication_ids,
              medication_names: duplicate.medication_names,
              warnings: [{
                type: 'Duplicate Therapy',
                severity: duplicate.severity,
                message: duplicate.description
              }]
            });
          });
        }

        console.log('🔍 Found form interactions:', interactions);
        setPrescriptionInteractions(interactions);
      } else {
        setPrescriptionInteractions([]);
      }
    } catch (error) {
      console.error('Error checking form interactions:', error);
      setPrescriptionInteractions([]);
    }
  }, [formData.medications, formData.patient]);

  // Auto-update conflict warnings when medications change
  useEffect(() => {
    if (getMedications().length >= 2 && formData.patient) {
      console.log('🔄 Auto-updating conflict warnings due to medication list change...');
      checkFormInteractions();
    } else if (getMedications().length < 2) {
      // Clear interactions if less than 2 medications
      setPrescriptionInteractions([]);
    }
  }, [formData.medications.length, formData.patient, checkFormInteractions]);

  // Check if medication form is valid
  const isMedicationFormValid = useCallback(() => {
    const requiredFields = ['drug', 'dosage', 'frequency', 'duration', 'quantity', 'refills'];
    return requiredFields.every(field => {
      const value = formData.medForm[field];
      return value !== null && value !== undefined && value.toString().trim() !== '';
    });
  }, [formData.medForm]);

  // Add medication to the list
  const handleAddMedication = useCallback(async () => {
    // Validate required fields using the same validation function
    if (!isMedicationFormValid()) {
      setSnackbar({
        open: true,
        message: 'Please fill in all required medication fields',
        severity: 'error'
      });
      return;
    }

    // Check for conflicts with existing medications in the prescription
    if (formData.patient && formData.medForm.drug) {
      try {
        // 1. FIRST: Check for allergies (this should always run)
        const allergyResponse = await conflictAPI.checkAllergyOnly({
          patient_id: Number(formData.patient),
          new_medication_id: Number(formData.medForm.drug)
        });

        if (allergyResponse.data.status === 'conflict') {
          // Show allergy conflict modal
          setConflictWarnings(allergyResponse.data.warnings);
          setPendingMedication({
            drug: formData.medForm.drug,
            dosage: formData.medForm.dosage,
            frequency: formData.medForm.frequency,
            duration: formData.medForm.duration,
            quantity: parseInt(formData.medForm.quantity),
            refills: parseInt(formData.medForm.refills),
            reason: formData.medForm.reason
          });
          setShowConflictModal(true);
          return;
        }

        // 2. SECOND: Check for drug interactions (only if allergy check passes)
        const currentMedicationIds = getMedications().map(med => Number(med?.drug)).filter(Boolean);
        const newMedicationId = Number(formData.medForm.drug);
        const allMedicationIds = [...currentMedicationIds, newMedicationId];

        // Only check if there are 2 or more medications
        if (allMedicationIds.length >= 2) {
          const interactionResponse = await conflictAPI.checkPrescriptionInteractions({
            patient_id: Number(formData.patient),
            medication_ids: allMedicationIds
          });

          if (interactionResponse.data.status === 'conflict') {
            const warnings = [];

            // Handle drug-drug interactions
            if (interactionResponse.data.interactions) {
              const drugInteractions = interactionResponse.data.interactions.map(interaction => ({
                type: 'Multi-Drug Interaction',
                severity: interaction.severity,
                message: `High risk of ${interaction.interaction_name} when combining [${interaction.medication1_name}, ${interaction.medication2_name}]. ${interaction.description}`
              }));
              warnings.push(...drugInteractions);
            }

            // Handle duplicate therapy warnings
            if (interactionResponse.data.duplicate_therapy) {
              const duplicateTherapyWarnings = interactionResponse.data.duplicate_therapy.map(duplicate => ({
                type: 'Duplicate Therapy',
                severity: duplicate.severity,
                message: duplicate.description
              }));
              warnings.push(...duplicateTherapyWarnings);
            }

            // Show conflict modal
            setConflictWarnings(warnings);
            setPendingMedication({
              drug: formData.medForm.drug,
              dosage: formData.medForm.dosage,
              frequency: formData.medForm.frequency,
              duration: formData.medForm.duration,
              quantity: parseInt(formData.medForm.quantity),
              refills: parseInt(formData.medForm.refills),
              reason: formData.medForm.reason
            });
            setShowConflictModal(true);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking conflicts:', error);
        // Continue with adding medication if conflict check fails
      }
    }

    // Add medication to the array
    const newMedication = {
      drug: formData.medForm.drug,
      dosage: formData.medForm.dosage,
      frequency: formData.medForm.frequency,
      duration: formData.medForm.duration,
      quantity: parseInt(formData.medForm.quantity),
      refills: parseInt(formData.medForm.refills)
    };

    setFormData(prev => ({
      ...prev,
      medications: [...prev.medications, newMedication],
      medForm: {
        drug: '',
        dosage: '',
        frequency: '',
        duration: '',
        quantity: '',
        refills: ''
      }
    }));

    setSnackbar({
      open: true,
      message: 'Medication added successfully',
      severity: 'success'
    });
  }, [formData.medForm, conflictAPI, isMedicationFormValid]);

  // Handle conflict modal actions
  const handleOverrideConflict = useCallback(() => {
    if (pendingMedication) {
      // Determine conflict type based on warnings
      const hasAllergyConflict = conflictWarnings.some(w => w.type === 'Allergy');
      const hasInteractionConflict = conflictWarnings.some(w => w.type === 'Multi-Drug Interaction');
      const hasDuplicateTherapyConflict = conflictWarnings.some(w => w.type === 'Duplicate Therapy');

      let conflictType = 'unknown';
      if (hasAllergyConflict) {
        conflictType = 'allergy';
      } else if (hasDuplicateTherapyConflict) {
        conflictType = 'duplicate_therapy';
      } else if (hasInteractionConflict) {
        conflictType = 'interaction';
      }

      const medicationWithWarning = {
        ...pendingMedication,
        hasConflictWarning: true,
        conflictWarnings: conflictWarnings,
        conflictType: conflictType
      };

      setFormData(prev => ({
        ...prev,
        medications: [...prev.medications, medicationWithWarning],
        medForm: {
          drug: '',
          dosage: '',
          frequency: '',
          duration: '',
          quantity: '',
          refills: ''
        }
      }));

      setSnackbar({
        open: true,
        message: 'Medication added with override warning',
        severity: 'warning'
      });
    }
    setShowConflictModal(false);
    setPendingMedication(null);
    setConflictWarnings([]);
  }, [pendingMedication, conflictWarnings]);

  const handleCancelConflict = useCallback(() => {
    setShowConflictModal(false);
    setPendingMedication(null);
    setConflictWarnings([]);
  }, []);

  // Remove medication from the list
  const handleRemoveMedication = useCallback(async (idx) => {
    // Remove the medication
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, index) => index !== idx)
    }));

    setSnackbar({
      open: true,
      message: 'Medication removed',
      severity: 'info'
    });

    // After removal, re-check for conflicts with remaining medications
    const updatedMedications = formData.medications.filter((_, index) => index !== idx);

    if (updatedMedications.length >= 2 && formData.patient) {
      try {
        console.log('🔄 Re-checking conflicts after medication removal...');

        // Get all medication IDs in the updated prescription
        const medicationIds = updatedMedications.map(med => Number(med?.drug)).filter(Boolean);

        const response = await conflictAPI.checkPrescriptionInteractions({
          patient_id: Number(formData.patient),
          medication_ids: medicationIds
        });

        if (response.data.status === 'conflict') {
          const interactions = [];

          // Handle drug-drug interactions
          if (response.data.interactions) {
            const drugInteractions = response.data.interactions.map(interaction => ({
              medication1: updatedMedications.find(med => Number(med?.drug) === interaction.medication1_id),
              medication2: updatedMedications.find(med => Number(med?.drug) === interaction.medication2_id),
              warnings: [{
                type: 'Multi-Drug Interaction',
                severity: interaction.severity,
                message: `High risk of ${interaction.interaction_name} when combining [${interaction.medication1_name}, ${interaction.medication2_name}]. ${interaction.description}`
              }]
            }));
            interactions.push(...drugInteractions);
          }

          // Handle duplicate therapy warnings
          if (response.data.duplicate_therapy) {
            const duplicateTherapyWarnings = response.data.duplicate_therapy.map(duplicate => ({
              therapeutic_class: duplicate.therapeutic_class,
              medication_ids: duplicate.medication_ids,
              medication_names: duplicate.medication_names,
              warnings: [{
                type: 'Duplicate Therapy',
                severity: duplicate.severity,
                message: duplicate.description
              }]
            }));
            interactions.push(...duplicateTherapyWarnings);
          }

          console.log('🔄 Updated interactions after removal:', interactions);
          setPrescriptionInteractions(interactions);
        } else {
          // No conflicts remaining
          console.log('🔄 No conflicts remaining after medication removal');
          setPrescriptionInteractions([]);
        }
      } catch (error) {
        console.error('Error re-checking conflicts after removal:', error);
        // Don't show error to user, just log it
      }
    } else {
      // Less than 2 medications remaining, clear interactions
      console.log('🔄 Less than 2 medications remaining, clearing interactions');
      setPrescriptionInteractions([]);
    }
  }, [formData.medications, formData.patient, setSnackbar]);

  // Form submission handler
  const handleSubmit = useCallback(() => {
    if (getMedications().length === 0) {
      setSnackbar({
        open: true,
        message: 'Please add at least one medication',
        severity: 'error'
      });
      return;
    }

    const submitData = {
      ...formData,
      prescribed_date: toISODate(formData.prescribed_date),
      expiry_date: toISODate(formData.expiry_date),
      patient: Number(formData.patient),
      medications: formData.medications,
      status: formData.status.toLowerCase(),
      reason: formData.reason, // Explicitly include prescription-level reason
    };

    console.log('📤 Submitting prescription data:', submitData);
    console.log('📤 Reason field in submit data:', submitData.reason);
    onSubmit(submitData);
  }, [formData, onSubmit, setSnackbar]);

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Handle adding a suggestion from the AI panel
  const handleAddSuggestion = useCallback((suggestion) => {
    if (!drugs || drugs.length === 0) {
      setSnackbar({
        open: true,
        message: 'Medication database not loaded yet. Please try again.',
        severity: 'warning'
      });
      return;
    }

    let drugId = suggestion.id || suggestion.drug_id;

    // Check if the drug exists in the drugs array (try both string and number comparison)
    let drugExists = drugs.find(d => d.id === drugId);

    // If not found, try converting to number/string
    if (!drugExists) {
      drugExists = drugs.find(d => d.id == drugId); // Loose equality
    }

    // If still not found, try to find by name
    if (!drugExists && suggestion.name) {
      drugExists = drugs.find(d => d.name.toLowerCase() === suggestion.name.toLowerCase());
      if (drugExists) {
        drugId = drugExists.id;
      }
    }

    if (!drugExists) {
      setSnackbar({
        open: true,
        message: `Warning: ${suggestion.name} not found in medication database. Please select manually.`,
        severity: 'warning'
      });
      return;
    }

    // Populate the medication form fields with the suggestion data
    setFormData(prev => {
      const newFormData = {
        ...prev,
        medForm: {
          ...prev.medForm,
          drug: drugId,
          dosage: suggestion.dosage || suggestion.recommended_dosage || suggestion.strength || '',
          frequency: suggestion.frequency || suggestion.recommended_frequency || 'As directed',
          duration: suggestion.duration || suggestion.recommended_duration || '7 days',
          quantity: suggestion.quantity || suggestion.recommended_quantity || '30',
          refills: suggestion.refills || suggestion.recommended_refills || '0'
        }
      };
      return newFormData;
    });

    // Show success message
    setSnackbar({
      open: true,
      message: `${suggestion.name} added to medication form. Click "Add Medication" to add it to the prescription.`,
      severity: 'success'
    });
  }, [drugs]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#F7F9FC',
            borderRadius: 3
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: 'white',
          borderBottom: '1px solid #E8ECF0',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          fontSize: '1.5rem',
          color: '#333333'
        }}>
          {initialData && initialData.id ? 'Edit Prescription' : 'New Prescription'}
        </DialogTitle>
        <DialogContent
          sx={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            p: 0,
            bgcolor: '#F7F9FC'
          }}
        >
          <Box sx={{
            display: 'flex',
            height: '100%',
            overflow: 'hidden',
            gap: 2,
            p: 2
          }}>
            {/* Left Column - Prescription Form */}
            <Box sx={{
              flex: '0 0 66.666%',
              overflowY: 'auto',
              bgcolor: 'white',
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '1px solid #E8ECF0'
            }}>
              {/* Section 1: Prescription Info */}
              <Box sx={{ p: 4, borderBottom: '1px solid #E8ECF0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 2,
                    bgcolor: '#4A90E2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Typography sx={{ color: 'white', fontSize: '1.2rem' }}>📋</Typography>
                  </Box>
                  <Typography variant="h6" sx={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '1.3rem',
                    color: '#333333'
                  }}>
                    Prescription Information
                  </Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth error={!!errors.patient}>
                      <InputLabel sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Patient</InputLabel>
                      <Select
                        label="Patient"
                        value={formData.patient || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, patient: e.target.value }))}
                        disabled={!!initialPatient}
                        sx={{
                          fontFamily: 'Inter, sans-serif',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#E8ECF0',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#4A90E2',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#4A90E2',
                          },
                        }}
                      >
                        {patients.map((p) => (
                          <MenuItem key={p.id} value={p.id} sx={{ fontFamily: 'Inter, sans-serif' }}>
                            {p.first_name} {p.last_name}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.patient && (
                        <FormHelperText sx={{ fontFamily: 'Inter, sans-serif' }}>{errors.patient}</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Prescribed Date"
                      type="date"
                      value={formData.prescribed_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, prescribed_date: e.target.value }))}
                      error={!!errors.prescribed_date}
                      helperText={errors.prescribed_date}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        fontFamily: 'Inter, sans-serif',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#E8ECF0',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#4A90E2',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#4A90E2',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Reason for Prescription */}
              <Box sx={{ p: 4, borderBottom: '1px solid #E8ECF0' }}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Reason for Prescription"
                      value={formData.reason || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                      multiline
                      rows={3}
                      placeholder="Enter the medical condition or reason for this prescription (e.g., 'hypertension', 'diabetes management', 'pain relief')..."
                      helperText="This reason applies to the entire prescription and will be stored with the prescription"
                      sx={{
                        fontFamily: 'Inter, sans-serif',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#E8ECF0',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#4A90E2',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#4A90E2',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Section 2: Add Medication */}
              <Box sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 2,
                    bgcolor: '#4A90E2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Typography sx={{ color: 'white', fontSize: '1.2rem' }}>💊</Typography>
                  </Box>
                  <Typography variant="h6" sx={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '1.3rem',
                    color: '#333333'
                  }}>
                    Add Medication
                  </Typography>
                </Box>

                <Grid container spacing={3} sx={{ mb: 3 }} key="medication-form">
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth error={!!errors.medForm?.drug}>
                      <InputLabel>Medication</InputLabel>
                      {drugsLoading && (
                        <Alert severity="info" sx={{ mb: 1 }}>
                          Loading medications...
                        </Alert>
                      )}
                      <Select
                        label="Medication"
                        value={formData.medForm.drug || ''}
                        disabled={drugsLoading}
                        onChange={(e) => {
                          const newDrugValue = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            medForm: { ...prev.medForm, drug: newDrugValue }
                          }));

                          // Clear any existing conflict warnings when medication selection changes
                          // Conflicts will only be checked when the medication is actually added
                          setConflictWarnings([]);
                        }}
                      >
                        {drugs.map((d) => (
                          <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                        ))}
                      </Select>
                      {errors.medForm?.drug && (
                        <FormHelperText>{errors.medForm.drug}</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <TextField
                      fullWidth
                      label="Dosage"
                      value={formData.medForm.dosage}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          medForm: { ...prev.medForm, dosage: e.target.value }
                        }));
                      }}
                      error={!!errors.medForm?.dosage}
                      helperText={errors.medForm?.dosage}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <TextField
                      fullWidth
                      label="Frequency"
                      value={formData.medForm.frequency}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          medForm: { ...prev.medForm, frequency: e.target.value }
                        }));
                      }}
                      error={!!errors.medForm?.frequency}
                      helperText={errors.medForm?.frequency}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <TextField
                      fullWidth
                      label="Duration"
                      value={formData.medForm.duration}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          medForm: { ...prev.medForm, duration: e.target.value }
                        }));
                      }}
                      error={!!errors.medForm?.duration}
                      helperText={errors.medForm?.duration}
                    />
                  </Grid>
                  <Grid item xs={12} sm={1}>
                    <TextField
                      fullWidth
                      label="Qty"
                      type="number"
                      value={formData.medForm.quantity}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          medForm: { ...prev.medForm, quantity: e.target.value }
                        }));
                      }}
                      error={!!errors.medForm?.quantity}
                      helperText={errors.medForm?.quantity}
                    />
                  </Grid>
                  <Grid item xs={12} sm={1}>
                    <TextField
                      fullWidth
                      label="Refills"
                      type="number"
                      value={formData.medForm.refills}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          medForm: { ...prev.medForm, refills: e.target.value }
                        }));
                      }}
                      error={!!errors.medForm?.refills}
                      helperText={errors.medForm?.refills}
                    />
                  </Grid>
                  {medFormAllergyWarning && (
                    <Grid item xs={12}>
                      <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 1 }}>{medFormAllergyWarning}</Alert>
                    </Grid>
                  )}
                  {/* Real-time conflict warnings */}
                  {conflictWarnings.length > 0 && (
                    <Grid item xs={12}>
                      <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          ⚠️ Medication Conflict Detected ({conflictWarnings.length} warning{conflictWarnings.length > 1 ? 's' : ''})
                        </Typography>
                        {conflictWarnings.map((warning, index) => (
                          <Box key={index} sx={{ mb: 1 }}>
                            <Chip
                              label={warning.type}
                              color={warning.severity === 'High' ? 'error' : warning.severity === 'Moderate' ? 'warning' : 'info'}
                              size="small"
                              sx={{ mr: 1 }}
                            />
                            <Typography variant="body2" component="span">
                              {warning.message}
                            </Typography>
                          </Box>
                        ))}
                        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                          Click "Add Medication" to see override options.
                        </Typography>
                      </Alert>
                    </Grid>
                  )}
                  {checkingConflicts && (
                    <Grid item xs={12}>
                      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 1 }}>
                        Checking for medication conflicts...
                      </Alert>
                    </Grid>
                  )}
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Button
                        variant="contained"
                        onClick={handleAddMedication}
                        disabled={!isMedicationFormValid()}
                        sx={{
                          bgcolor: '#4A90E2',
                          color: 'white',
                          fontWeight: 600,
                          px: 3,
                          py: 1.5,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontFamily: 'Inter, sans-serif',
                          '&:hover': {
                            bgcolor: '#357ABD',
                          },
                          '&:disabled': {
                            bgcolor: '#BDBDBD',
                          }
                        }}
                      >
                        Add Medication
                      </Button>
                      {!isMedicationFormValid() && (
                        <Typography variant="caption" sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          color: '#6c757d',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          <Box sx={{ width: 6, height: 6, bgcolor: '#FFC107', borderRadius: '50%' }} />
                          Complete all required fields (*) to add this medication to the prescription.
                        </Typography>
                      )}
                      <Button
                        variant="outlined"
                        onClick={checkFormInteractions}
                        disabled={getMedications().length < 2}
                        sx={{
                          borderColor: '#4A90E2',
                          color: '#4A90E2',
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 500,
                          px: 3,
                          py: 1.5,
                          borderRadius: 2,
                          textTransform: 'none',
                          '&:hover': {
                            borderColor: '#357ABD',
                            backgroundColor: 'rgba(74, 144, 226, 0.1)'
                          },
                          '&:disabled': {
                            borderColor: '#BDBDBD',
                            color: '#BDBDBD'
                          }
                        }}
                      >
                        Check Interactions
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
                {/* Dynamic List of Added Medications */}
                {getMedications().length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Medications List</Typography>
                    {getMedications().filter(medication => medication).map((medication, idx) => {
                      // Determine styling based on current conflict status
                      let borderColor = 'transparent';
                      let backgroundColor = 'background.paper';
                      let iconColor = 'default';
                      let chipColor = 'default';
                      let chipLabel = '';
                      let hasCurrentConflict = false;

                      // Check if this medication is involved in any current conflicts
                      const medicationId = Number(medication?.drug);

                      // Check for drug-drug interactions
                      const hasInteractionConflict = prescriptionInteractions.some(interaction =>
                        interaction.medication1 && Number(interaction.medication1?.drug) === medicationId ||
                        interaction.medication2 && Number(interaction.medication2?.drug) === medicationId
                      );

                      // Check for duplicate therapy conflicts
                      const hasDuplicateTherapyConflict = prescriptionInteractions.some(interaction =>
                        interaction.medication_ids && interaction.medication_ids.includes(medicationId)
                      );

                      // Check for allergy conflicts (from stored warning)
                      const hasAllergyConflict = medication?.hasConflictWarning && medication?.conflictType === 'allergy';

                      if (hasAllergyConflict) {
                        // Red styling for allergy conflicts
                        borderColor = 'error.main';
                        backgroundColor = 'error.light';
                        iconColor = 'error';
                        chipColor = 'error';
                        chipLabel = 'ALLERGY OVERRIDE';
                        hasCurrentConflict = true;
                      } else if (hasDuplicateTherapyConflict) {
                        // Orange styling for duplicate therapy conflicts
                        borderColor = 'orange.main';
                        backgroundColor = 'orange.light';
                        iconColor = 'warning';
                        chipColor = 'warning';
                        chipLabel = 'DUPLICATE THERAPY';
                        hasCurrentConflict = true;
                      } else if (hasInteractionConflict) {
                        // Yellow styling for interaction conflicts
                        borderColor = 'warning.main';
                        backgroundColor = 'warning.light';
                        iconColor = 'warning';
                        chipColor = 'warning';
                        chipLabel = 'INTERACTION OVERRIDE';
                        hasCurrentConflict = true;
                      }

                      return (
                        <Card
                          key={idx}
                          elevation={1}
                          sx={{
                            mb: 2,
                            overflow: 'visible',
                            backgroundColor: 'white',
                            borderRadius: 2,
                            border: '1px solid #E8ECF0',
                            borderLeft: hasCurrentConflict ? `4px solid ${borderColor}` : '4px solid transparent',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                              transform: 'translateY(-1px)'
                            }
                          }}
                        >
                          <CardContent sx={{ p: 2.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                              {/* Warning Icon */}
                              {hasCurrentConflict && (
                                <Box sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  bgcolor: borderColor,
                                  flexShrink: 0,
                                  mt: 0.5
                                }}>
                                  <WarningIcon sx={{ color: 'white', fontSize: 18 }} />
                                </Box>
                              )}

                              {/* Medication Details */}
                              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Typography variant="h6" sx={{
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: 700,
                                    fontSize: '1rem',
                                    color: '#333333'
                                  }}>
                                    {drugs.find(d => d.id === Number(medication?.drug))?.name || 'Unknown Medication'}
                                  </Typography>
                                  {hasCurrentConflict && (
                                    <Chip
                                      label={chipLabel}
                                      size="small"
                                      color={chipColor === 'error' ? 'error' : 'warning'}
                                      sx={{
                                        fontWeight: 600,
                                        fontSize: '0.7rem',
                                        height: 22,
                                        '& .MuiChip-label': {
                                          px: 1
                                        }
                                      }}
                                    />
                                  )}
                                </Box>

                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                                  <Chip
                                    label={`${medication?.dosage || 'N/A'}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      fontSize: '0.75rem',
                                      height: 24,
                                      color: 'text.secondary',
                                      borderColor: '#E0E0E0'
                                    }}
                                  />
                                  <Chip
                                    label={`${medication?.frequency || 'N/A'}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      fontSize: '0.75rem',
                                      height: 24,
                                      color: 'text.secondary',
                                      borderColor: '#E0E0E0'
                                    }}
                                  />
                                  <Chip
                                    label={`${medication?.duration || 'N/A'}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      fontSize: '0.75rem',
                                      height: 24,
                                      color: 'text.secondary',
                                      borderColor: '#E0E0E0'
                                    }}
                                  />
                                  <Chip
                                    label={`Qty: ${medication?.quantity || 'N/A'}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      fontSize: '0.75rem',
                                      height: 24,
                                      color: 'text.secondary',
                                      borderColor: '#E0E0E0'
                                    }}
                                  />
                                  <Chip
                                    label={`Refills: ${medication?.refills || 'N/A'}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      fontSize: '0.75rem',
                                      height: 24,
                                      color: 'text.secondary',
                                      borderColor: '#E0E0E0'
                                    }}
                                  />
                                </Box>

                                {medication?.reason && (
                                  <Typography variant="body2" sx={{
                                    fontStyle: 'italic',
                                    color: 'text.secondary',
                                    fontFamily: 'Inter, sans-serif',
                                    fontSize: '0.85rem'
                                  }}>
                                    Reason: {medication?.reason}
                                  </Typography>
                                )}
                              </Box>

                              {/* Action Button */}
                              <Tooltip title="Remove medication">
                                <IconButton
                                  onClick={() => handleRemoveMedication(idx)}
                                  sx={{
                                    color: 'text.secondary',
                                    '&:hover': {
                                      color: '#D32F2F',
                                      bgcolor: '#FFEBEE'
                                    },
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>

                            {/* Allergy Warning */}
                            {medAllergyWarnings[idx] && (
                              <Alert
                                severity="warning"
                                icon={<SecurityIcon />}
                                sx={{
                                  mt: 2,
                                  borderRadius: 2,
                                  '& .MuiAlert-icon': {
                                    color: '#F57C00'
                                  }
                                }}
                              >
                                <Typography variant="body2" sx={{ fontFamily: 'Inter, sans-serif' }}>
                                  {medAllergyWarnings[idx]}
                                </Typography>
                              </Alert>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}

                    {/* Prescription-wide conflict summary */}
                    {prescriptionInteractions.length > 0 && (
                      <Alert
                        severity="error"
                        icon={<ErrorIcon />}
                        sx={{
                          mt: 3,
                          borderRadius: 2,
                          '& .MuiAlert-icon': {
                            fontSize: 24
                          }
                        }}
                      >
                        <Typography variant="h6" sx={{
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          mb: 1
                        }}>
                          Prescription Conflict Summary
                        </Typography>

                        <Typography variant="body2" sx={{
                          mb: 2,
                          fontFamily: 'Inter, sans-serif',
                          color: 'text.secondary'
                        }}>
                          This prescription contains medications with known conflicts. Review all warnings before proceeding.
                        </Typography>

                        <List dense sx={{ bgcolor: 'rgba(255,255,255,0.7)', borderRadius: 1, p: 1 }}>
                          {prescriptionInteractions.map((interaction, idx) => {
                            // Determine conflict type and icon
                            let conflictType = 'Conflict';
                            let conflictIcon = <ErrorIcon color="error" />;
                            let conflictSeverity = 'error';

                            if (interaction.warnings && interaction.warnings.length > 0) {
                              const warning = interaction.warnings[0];
                              if (warning.type === 'Allergy') {
                                conflictType = 'Allergy';
                                conflictIcon = <SecurityIcon color="error" />;
                                conflictSeverity = 'error';
                              } else if (warning.type === 'Duplicate Therapy') {
                                conflictType = 'Duplicate Therapy';
                                conflictIcon = <MedicationIcon color="warning" />;
                                conflictSeverity = 'warning';
                              } else if (warning.type === 'Multi-Drug Interaction') {
                                conflictType = 'Interaction';
                                conflictIcon = <ScienceIcon color="warning" />;
                                conflictSeverity = 'warning';
                              }
                            }

                            // Get medication names for display
                            let medicationNames = [];
                            if (interaction.medication_names && interaction.medication_names.length > 0) {
                              // For duplicate therapy, use the medication names from backend
                              medicationNames = interaction.medication_names;
                              console.log('🔍 Using medication_names from backend:', medicationNames);
                            } else if (interaction.medication1 && interaction.medication2) {
                              // For drug-drug interactions, find names from drugs array
                              medicationNames = [
                                drugs.find(d => d.id === Number(interaction.medication1?.drug))?.name,
                                drugs.find(d => d.id === Number(interaction.medication2?.drug))?.name
                              ].filter(Boolean); // Remove any undefined values
                              console.log('🔍 Using medication1/medication2 names:', medicationNames);
                            }

                            return (
                              <ListItem key={idx} sx={{ px: 0, py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                  {conflictIcon}
                                </ListItemIcon>
                                <ListItemText
                                  primary={`${conflictType}: ${medicationNames.join(' and ')} may cause adverse effects.`}
                                  primaryTypographyProps={{
                                    variant: 'body2',
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: 500
                                  }}
                                />
                              </ListItem>
                            );
                          })}
                        </List>
                      </Alert>
                    )}

                    {/* Prescription interactions between existing medications */}
                    {prescriptionInteractions.length > 0 && (
                      <Alert
                        severity="warning"
                        icon={<ScienceIcon />}
                        sx={{
                          mt: 2,
                          borderRadius: 2,
                          '& .MuiAlert-icon': {
                            fontSize: 24
                          }
                        }}
                      >
                        <Typography variant="h6" sx={{
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          mb: 1
                        }}>
                          Interactions Between Prescription Medications
                        </Typography>

                        <Typography variant="body2" sx={{
                          mb: 2,
                          fontFamily: 'Inter, sans-serif',
                          color: 'text.secondary'
                        }}>
                          The following interactions have been detected between medications in this prescription:
                        </Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {prescriptionInteractions.map((interaction, idx) => (
                            <Box key={idx} sx={{
                              p: 2,
                              bgcolor: 'rgba(255,255,255,0.7)',
                              borderRadius: 1.5,
                              border: '1px solid rgba(255,152,0,0.3)'
                            }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <WarningIcon sx={{ color: '#F57C00', fontSize: 18 }} />
                                <Typography variant="subtitle2" sx={{
                                  fontWeight: 600,
                                  color: '#333333',
                                  fontFamily: 'Inter, sans-serif'
                                }}>
                                  {(() => {
                                    // Get medication names for display
                                    let medicationNames = [];
                                    if (interaction.medication_names && interaction.medication_names.length > 0) {
                                      // For duplicate therapy, use the medication names from backend
                                      medicationNames = interaction.medication_names;
                                    } else if (interaction.medication1 && interaction.medication2) {
                                      // For drug-drug interactions, find names from drugs array
                                      medicationNames = [
                                        drugs.find(d => d.id === Number(interaction.medication1?.drug))?.name,
                                        drugs.find(d => d.id === Number(interaction.medication2?.drug))?.name
                                      ].filter(Boolean); // Remove any undefined values
                                    }
                                    return medicationNames.join(' + ');
                                  })()}
                                </Typography>
                              </Box>

                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {interaction.warnings.map((warning, warnIdx) => (
                                  <Typography key={warnIdx} variant="body2" sx={{
                                    color: 'text.secondary',
                                    fontFamily: 'Inter, sans-serif',
                                    fontSize: '0.85rem',
                                    lineHeight: 1.4,
                                    ml: 2
                                  }}>
                                    • {warning.message}
                                  </Typography>
                                ))}
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      </Alert>
                    )}
                  </Box>
                )}
                <Divider sx={{ my: 2 }} />
                {/* Other prescription fields */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Expiry Date"
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        label="Status"
                        value={formData.status || 'active'}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      >
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="completed">Completed</MenuItem>
                        <MenuItem value="cancelled">Cancelled</MenuItem>
                        <MenuItem value="expired">Expired</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Instructions"
                      value={formData.instructions}
                      onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                      multiline
                      rows={3}
                      placeholder="Special instructions for the patient..."
                    />
                  </Grid>
                </Grid>
                {(backendWarning) && (
                  <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
                    {backendWarning}
                  </Alert>
                )}
                {error && (
                  <Alert severity="error">{error}</Alert>
                )}
              </Box>
            </Box>

            {/* Right Column - AI Suggestions Panel */}
            <Box sx={{
              flex: '0 0 33.334%',
              overflowY: 'auto'
            }}>
              <MasterSuggestionPanel
                patient={patients?.find(p => p.id === formData.patient)}
                condition={formData.reason || ''}
                onAddSuggestion={handleAddSuggestion}
                excludedDrugs={getMedications().map(med => med?.drug).filter(Boolean)}
                searchTerm={formData.reason || ''}
                drugs={drugs}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{
          bgcolor: 'white',
          borderTop: '1px solid #E8ECF0',
          p: 3,
          gap: 2
        }}>
          <Button
            onClick={onClose}
            sx={{
              color: '#4A90E2',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              px: 3,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: 'rgba(74, 144, 226, 0.1)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || getMedications().length === 0}
            sx={{
              bgcolor: '#4A90E2',
              color: 'white',
              fontWeight: 600,
              px: 4,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontFamily: 'Inter, sans-serif',
              '&:hover': {
                bgcolor: '#357ABD',
              },
              '&:disabled': {
                bgcolor: '#BDBDBD',
              }
            }}
          >
            {initialData && initialData.id ? 'Update' : 'Create'} Prescription
          </Button>
        </DialogActions>
      </Dialog>

      {/* Conflict Warning Modal */}
      <Dialog
        open={showConflictModal}
        onClose={handleCancelConflict}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'visible'
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: '#D32F2F',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderRadius: '12px 12px 0 0',
          p: 3
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.2)',
            flexShrink: 0
          }}>
            <ErrorIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              fontSize: '1.3rem',
              mb: 0.5
            }}>
              Medication Conflict Warning
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {conflictWarnings.length} warning{conflictWarnings.length > 1 ? 's' : ''} detected
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3, bgcolor: 'white' }}>
          <Alert
            severity="error"
            icon={<ReportProblemIcon />}
            sx={{ mb: 3, borderRadius: 2 }}
          >
            <Typography variant="subtitle1" sx={{
              fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              mb: 0.5
            }}>
              Critical Safety Alert
            </Typography>
            <Typography variant="body2" sx={{
              fontFamily: 'Inter, sans-serif'
            }}>
              {conflictWarnings.length} conflict{conflictWarnings.length > 1 ? 's have' : ' has'} been detected.
              Proceeding may cause serious harm to the patient.
            </Typography>
          </Alert>

          <Typography variant="body1" sx={{
            mb: 2,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            color: '#333333'
          }}>
            The following conflicts have been detected with the selected medication:
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {conflictWarnings.map((warning, index) => {
              const isAllergy = warning.type === 'Allergy';
              const isDuplicate = warning.type === 'Duplicate Therapy';
              const isInteraction = warning.type === 'Multi-Drug Interaction';

              let icon = <ErrorIcon />;
              let severity = 'error';

              if (isAllergy) {
                icon = <SecurityIcon />;
                severity = 'error';
              } else if (isDuplicate) {
                icon = <MedicationIcon />;
                severity = 'warning';
              } else if (isInteraction) {
                icon = <ScienceIcon />;
                severity = 'warning';
              }

              return (
                <Alert
                  key={index}
                  severity={severity}
                  icon={icon}
                  sx={{ borderRadius: 2 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Chip
                      label={warning.type}
                      size="small"
                      color={severity}
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: 20
                      }}
                    />
                    <Chip
                      label={`${warning.severity} Risk`}
                      size="small"
                      variant="outlined"
                      color={severity}
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: 20
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{
                    fontFamily: 'Inter, sans-serif',
                    lineHeight: 1.4
                  }}>
                    {warning.message}
                  </Typography>
                </Alert>
              );
            })}
          </Box>

          <Alert
            severity="info"
            icon={<InfoIcon />}
            sx={{ mt: 3, borderRadius: 2 }}
          >
            <Typography variant="subtitle2" sx={{
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              mb: 0.5
            }}>
              Recommendation
            </Typography>
            <Typography variant="body2" sx={{
              fontFamily: 'Inter, sans-serif'
            }}>
              Consider alternative medications or consult with a pharmacist before proceeding.
            </Typography>
          </Alert>
        </DialogContent>

        <DialogActions sx={{
          bgcolor: 'white',
          borderTop: '1px solid #E8ECF0',
          p: 3,
          gap: 2,
          borderRadius: '0 0 12px 12px'
        }}>
          <Button
            onClick={handleCancelConflict}
            sx={{
              color: '#4A90E2',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              px: 3,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: 'rgba(74, 144, 226, 0.1)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleOverrideConflict}
            variant="contained"
            sx={{
              bgcolor: '#F57C00',
              color: 'white',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              px: 4,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              '&:hover': {
                bgcolor: '#E65100',
              }
            }}
          >
            Override & Add Medication
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for user feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default PrescriptionDialog; 