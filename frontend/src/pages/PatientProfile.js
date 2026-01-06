import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { patientsAPI, prescriptionsAPI, allergiesAPI, drugsAPI, conflictAPI } from '../services/api';
import { clinicAPI } from '../services/clinicApi';
import {
  Box, Typography, Paper, Chip, Button, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Divider, Card,
  CardContent, CardActions, List, ListItem, ListItemText, ListItemSecondaryAction,
  IconButton, Alert, Snackbar, Tooltip
} from '@mui/material';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl,
  InputLabel, Select, MenuItem, IconButton as MuiIconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import WarningIcon from '@mui/icons-material/Warning';
import EditIcon from '@mui/icons-material/Edit';
import PrescriptionDialog from '../components/PrescriptionDialog';

const PatientProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we arrived here from the "Start Consultation" flow
  const isConsultationActive = location.state?.fromConsultation === true;
  const appointmentId = location.state?.appointmentId;
  const consultationId = location.state?.consultationId;

  console.log('🔍 PatientProfile - Navigation state:', location.state);
  console.log('🔍 PatientProfile - isConsultationActive:', isConsultationActive);
  console.log('🔍 PatientProfile - appointmentId:', appointmentId);
  console.log('🔍 PatientProfile - consultationId:', consultationId);

  const [patient, setPatient] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allergyDialogOpen, setAllergyDialogOpen] = useState(false);
  const [allergies, setAllergies] = useState([]);
  const [drugs, setDrugs] = useState([]);
  const [drugsLoading, setDrugsLoading] = useState(false);
  const [detailedAllergies, setDetailedAllergies] = useState([]);
  const [allergyLoading, setAllergyLoading] = useState(false);
  const [allergyError, setAllergyError] = useState('');
  const [creatingAllergyFromDrug, setCreatingAllergyFromDrug] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);
  const [prescriptionInteractions, setPrescriptionInteractions] = useState({});
  const [currentConsultation, setCurrentConsultation] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      console.log('🔍 PatientProfile - Fetching data for patient ID:', id);
      setLoading(true);
      setError('');
      try {
        const patientRes = await patientsAPI.getById(id);
        console.log('🔍 PatientProfile - Patient data received:', patientRes.data);
        setPatient(patientRes.data);
        const presRes = await prescriptionsAPI.getAll({ patient: id });
        console.log('🔍 PatientProfile - Prescriptions data received:', presRes.data);
        setPrescriptions(presRes.data);
      } catch (err) {
        console.error('❌ PatientProfile - Error fetching data:', err);
        setError('Failed to load patient profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Debug effect removed to prevent infinite re-renders

  // Fetch current consultation if we're in consultation mode but don't have consultation ID
  useEffect(() => {
    const fetchCurrentConsultation = async () => {
      if (isConsultationActive && !consultationId && appointmentId) {
        try {
          console.log('🔍 Fetching current consultation for appointment:', appointmentId);
          const consultations = await clinicAPI.getConsultations({
            appointment: appointmentId,
            ended_at__isnull: true
          });

          if (consultations.data && consultations.data.length > 0) {
            const consultation = consultations.data[0];
            console.log('🔍 Found current consultation:', consultation);
            setCurrentConsultation(consultation);
          }
        } catch (err) {
          console.error('❌ Failed to fetch current consultation:', err);
        }
      }
    };

    fetchCurrentConsultation();
  }, [isConsultationActive, consultationId, appointmentId]);

  useEffect(() => {
    if (allergyDialogOpen) {
      fetchAllergies();
      fetchDrugs();
      // Normalize the allergy data structure for the form
      const normalizedAllergies = patient?.detailed_allergies ?
        patient.detailed_allergies.map(allergy => ({
          allergy_id: allergy.allergy?.id || allergy.allergy_id,
          reaction: allergy.reaction || '',
          date_noted: allergy.date_noted || '',
          severity: allergy.severity || ''
        })) : [];
      setDetailedAllergies(normalizedAllergies);
    }
  }, [allergyDialogOpen, patient]);

  // Load drugs when prescription dialog opens
  useEffect(() => {
    if (prescriptionDialogOpen) {
      fetchDrugs();
    }
  }, [prescriptionDialogOpen]);

  // Load interaction data for prescriptions
  useEffect(() => {
    const loadInteractions = async () => {
      const interactions = {};
      for (const presc of prescriptions) {
        if (presc.medications && presc.medications.length > 1) {
          const warnings = await checkDrugInteractions(presc.medications);
          // Debug logging removed to prevent infinite re-renders
          interactions[presc.id] = warnings;
        }
      }
      // Debug logging removed to prevent infinite re-renders
      setPrescriptionInteractions(interactions);
    };

    if (prescriptions.length > 0) {
      loadInteractions();
    }
  }, [prescriptions]);

  const fetchAllergies = async () => {
    try {
      const res = await allergiesAPI.getAll();
      setAllergies(res.data);
    } catch (err) {
      setAllergies([]);
    }
  };

  const fetchDrugs = async () => {
    setDrugsLoading(true);
    try {
      const res = await drugsAPI.getAll();
      // Drugs loaded successfully
      setDrugs(res.data);
    } catch (err) {
      console.error('❌ Failed to load drugs:', err);
      setDrugs([]);
    } finally {
      setDrugsLoading(false);
    }
  };

  const handleAddAllergyRow = () => {
    setDetailedAllergies([
      ...detailedAllergies,
      { allergy_id: '', reaction: '', date_noted: '', severity: '' },
    ]);
  };
  const handleAllergyFieldChange = async (idx, field, value) => {
    if (field === 'allergy_id' && value && value !== '__add_new__') {
      // Check if it's a drug selection (starts with 'drug-')
      if (typeof value === 'string' && value.startsWith('drug-')) {
        const drugId = value.replace('drug-', '');
        const selectedDrug = drugs.find(drug => drug.id.toString() === drugId);

        if (selectedDrug) {
          setCreatingAllergyFromDrug(true);
          try {
            // Check if allergy already exists for this drug
            let allergyId = allergies.find(allergy => allergy.name === selectedDrug.name)?.id;

            if (!allergyId) {
              // Create new allergy entry with drug name
              const res = await allergiesAPI.create({
                name: selectedDrug.name,
                description: `Allergy to ${selectedDrug.name} (${selectedDrug.therapeutic_class || selectedDrug.category})`
              });
              allergyId = res.data.id;
              setAllergies([...allergies, res.data]);
            }

            // Update the form data with the allergy ID
            const updated = detailedAllergies.map((a, i) =>
              i === idx ? { ...a, [field]: allergyId } : a
            );
            setDetailedAllergies(updated);
          } catch (err) {
            console.error('Failed to create allergy for drug:', err);
          } finally {
            setCreatingAllergyFromDrug(false);
          }
        }
      } else {
        // It's a regular allergy selection
        const updated = detailedAllergies.map((a, i) =>
          i === idx ? { ...a, [field]: value } : a
        );
        setDetailedAllergies(updated);
      }
    } else {
      // For other fields, update normally
      const updated = detailedAllergies.map((a, i) =>
        i === idx ? { ...a, [field]: value } : a
      );
      setDetailedAllergies(updated);
    }
  };
  const handleRemoveAllergy = (idx) => {
    setDetailedAllergies(detailedAllergies.filter((_, i) => i !== idx));
  };
  const handleSaveAllergies = async () => {
    setAllergyLoading(true);
    setAllergyError('');
    try {
      // Filter out empty allergies and ensure all required fields are present
      const formattedAllergies = detailedAllergies
        .filter(allergy => allergy.allergy_id) // Only include allergies with valid allergy_id
        .map(allergy => ({
          allergy_id: allergy.allergy_id,
          reaction: allergy.reaction || '',
          date_noted: allergy.date_noted || '',
          severity: allergy.severity || ''
        }));

      // Debug: Log what we're sending
      console.log('🔍 Sending allergy data:', {
        patient_id: patient.id,
        field_name: 'detailed_allergies',
        data: formattedAllergies
      });

      // Send as detailed_allergies to match Create Patient page format
      await patientsAPI.update(patient.id, {
        detailed_allergies: formattedAllergies
      });
      setAllergyDialogOpen(false);
      // Refresh patient data
      const patientRes = await patientsAPI.getById(id);

      // Force a complete state update
      setPatient({ ...patientRes.data });

      // Also update the detailedAllergies state to match
      const normalizedAllergies = patientRes.data.detailed_allergies ?
        patientRes.data.detailed_allergies.map(allergy => ({
          allergy_id: allergy.allergy?.id || allergy.allergy_id,
          reaction: allergy.reaction || '',
          date_noted: allergy.date_noted || '',
          severity: allergy.severity || ''
        })) : [];
      setDetailedAllergies(normalizedAllergies);
      setSnackbar({
        open: true,
        message: 'Allergies saved successfully!',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error saving allergies:', err);
      setAllergyError('Failed to save allergies.');
    } finally {
      setAllergyLoading(false);
    }
  };

  // Handle navigation to new prescription
  const handleCreatePrescription = () => {
    setPrescriptionDialogOpen(true);
  };

  // Handle opening add allergy modal
  const handleAddAllergy = () => {
    setAllergyDialogOpen(true);
  };


  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Handle PrescriptionDialog close
  const handlePrescriptionDialogClose = () => {
    setPrescriptionDialogOpen(false);
  };

  // Handle prescription creation success
  const handlePrescriptionCreated = async (prescriptionData) => {
    // Prescription data received

    try {
      // Create the prescription via API
      const response = await prescriptionsAPI.create(prescriptionData);
      // Prescription created successfully

      setPrescriptionDialogOpen(false);
      setSnackbar({
        open: true,
        message: 'Prescription created successfully!',
        severity: 'success'
      });

      // Refresh prescriptions data
      const presRes = await prescriptionsAPI.getAll({ patient: id });
      // Prescriptions refreshed
      setPrescriptions(presRes.data);
    } catch (err) {
      console.error('❌ Failed to create prescription:', err);
      setSnackbar({
        open: true,
        message: 'Failed to create prescription. Please try again.',
        severity: 'error'
      });
    }
  };

  const handleCompleteConsultation = async () => {
    try {
      // Use consultation ID from navigation state, or fallback to current consultation
      const finalConsultationId = consultationId || currentConsultation?.id;

      console.log('🔍 Completing consultation with ID:', finalConsultationId);
      console.log('🔍 Consultation ID type:', typeof finalConsultationId);
      console.log('🔍 Consultation ID is null/undefined:', finalConsultationId === null || finalConsultationId === undefined);
      console.log('🔍 Using navigation consultation ID:', !!consultationId);
      console.log('🔍 Using current consultation ID:', !!currentConsultation?.id);

      if (!finalConsultationId) {
        console.error('❌ No consultation ID available!');
        setSnackbar({
          open: true,
          message: 'Error: No consultation ID found. Please try starting the consultation again.',
          severity: 'error'
        });
        return;
      }

      const requestData = {
        consultation_id: finalConsultationId,
        outcome: 'completed',
        notes: 'Consultation completed successfully.'
      };

      console.log('🔍 Sending request data:', requestData);

      // Make API call to end consultation
      await clinicAPI.endConsultation(requestData);

      setSnackbar({
        open: true,
        message: 'Consultation completed successfully!',
        severity: 'success'
      });

      // Navigate back to doctor's queue dashboard
      navigate('/clinic');
    } catch (err) {
      console.error('❌ Failed to complete consultation:', err);
      console.error('❌ Error response:', err.response?.data);
      setSnackbar({
        open: true,
        message: 'Failed to complete consultation. Please try again.',
        severity: 'error'
      });
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh"><CircularProgress /></Box>;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!patient && !loading) return <Typography align="center" color="text.secondary">Patient not found.</Typography>;

  const allergySeverityOptions = [
    { value: 'mild', label: 'Mild' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'severe', label: 'Severe' },
  ];

  // Function to check drug interactions for a prescription
  const checkDrugInteractions = async (medications) => {
    if (medications.length < 2) return [];

    try {
      const medicationIds = medications.map(med =>
        med.drug_details?.id || med.drug?.id
      ).filter(Boolean);

      if (medicationIds.length < 2) return [];

      const response = await conflictAPI.checkPrescriptionInteractions({
        patient_id: id, // Add patient_id as required by backend
        medication_ids: medicationIds
      });

      // API response received

      // Combine interactions and duplicate_therapy into warnings array
      const warnings = [];

      // Add drug-drug interactions
      if (response.data.interactions) {
        response.data.interactions.forEach(interaction => {
          warnings.push({
            type: 'Drug-Drug Interaction',
            severity: interaction.severity,
            message: interaction.description,
            medications: [
              { id: interaction.medication1_id, name: interaction.medication1_name },
              { id: interaction.medication2_id, name: interaction.medication2_name }
            ]
          });
        });
      }

      // Add duplicate therapy warnings
      if (response.data.duplicate_therapy) {
        response.data.duplicate_therapy.forEach(duplicate => {
          warnings.push({
            type: 'Duplicate Therapy',
            severity: duplicate.severity,
            message: duplicate.description,
            medications: duplicate.medication_ids.map((id, index) => ({
              id: id,
              name: duplicate.medication_names[index]
            }))
          });
        });
      }

      // Warnings processed
      return warnings;
    } catch (error) {
      console.error('Error checking drug interactions:', error);
      return [];
    }
  };

  return (
    <Box sx={{ backgroundColor: '#f8f9fa', minHeight: '100vh', p: 0 }}>
      <Box sx={{ p: 3 }}>
        <Button onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>

        {/* Complete Consultation Button - Only shown during active consultation */}
        {isConsultationActive && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'success.light', borderRadius: 2, border: '2px solid', borderColor: 'success.main' }}>
            <Typography variant="h6" color="success.dark" sx={{ mb: 1, fontWeight: 'bold' }}>
              🩺 Active Consultation
            </Typography>
            <Typography variant="body2" color="success.dark" sx={{ mb: 2 }}>
              You are currently conducting a consultation with {patient?.full_name}. Complete the consultation when finished.
            </Typography>
            <Button
              variant="contained"
              color="success"
              size="large"
              onClick={handleCompleteConsultation}
              sx={{
                fontWeight: 'bold',
                px: 4,
                py: 1.5,
                fontSize: '16px'
              }}
            >
              ✅ Complete Consultation
            </Button>
          </Box>
        )}

        <Grid container spacing={3}>
          {/* Left Column: Info, Allergies, History */}
          <Grid item xs={12} md={7}>
            <Card elevation={3} sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>Patient Profile</Typography>
                </Box>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>{patient.full_name}</Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Age:</Typography> {patient.age}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Gender:</Typography> {patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Phone:</Typography> {patient.phone}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Email:</Typography> {patient.email}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Address:</Typography> {patient.address}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Emergency Contact:</Typography> {patient.emergency_contact}
                    </Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 'bold' }}>Medical History</Typography>
                <Typography sx={{ whiteSpace: 'pre-line', mt: 1 }}>{patient.medical_history || 'None'}</Typography>
              </CardContent>
            </Card>

            <Card elevation={2} sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Allergies</Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setAllergyDialogOpen(true)}
                    startIcon={<EditIcon />}
                    sx={{ fontWeight: 'bold' }}
                  >
                    Manage Allergies
                  </Button>
                </Box>

                {patient.detailed_allergies && patient.detailed_allergies.length > 0 ? (
                  <List>
                    {/* Debug info */}
                    <Box sx={{ mb: 1, p: 1, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ color: '#1976d2' }}>
                        Debug: Found {patient.detailed_allergies.length} allergies
                      </Typography>
                    </Box>
                    {patient.detailed_allergies.map((a, index) => (
                      <ListItem key={a.id || `allergy-${index}-${a.allergy?.id || 'unknown'}`} sx={{ px: 0 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Chip
                                label={a.allergy?.name || 'Unknown'}
                                color="warning"
                                size="small"
                                sx={{ fontWeight: 'bold' }}
                              />
                              <Chip
                                label={a.severity ? a.severity.charAt(0).toUpperCase() + a.severity.slice(1) : 'N/A'}
                                size="small"
                                color={a.severity === 'severe' ? 'error' : a.severity === 'moderate' ? 'warning' : 'default'}
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" sx={{ mb: 0.5 }}>
                                <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Reaction:</Typography> {a.reaction || 'No reaction specified'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Date Noted:</Typography> {a.date_noted || 'Not specified'}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No allergies recorded.
                    </Typography>
                    {/* Debug info */}
                    <Box sx={{ mt: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ color: '#856404' }}>
                        Debug: patient.detailed_allergies = {JSON.stringify(patient.detailed_allergies)}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Card elevation={2} sx={{ p: 3 }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <LocalHospitalIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Prescription History</Typography>
                </Box>

                {prescriptions.length === 0 ? (
                  <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No prescriptions found for this patient.
                  </Typography>
                ) : (
                  <Box sx={{
                    maxHeight: '500px',
                    overflowY: 'auto',
                    pr: 1,
                    '&::-webkit-scrollbar': {
                      width: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                      backgroundColor: '#f1f1f1',
                      borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: '#c1c1c1',
                      borderRadius: '4px',
                      '&:hover': {
                        backgroundColor: '#a8a8a8',
                      },
                    },
                  }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {prescriptions.map((presc) => {
                        const medications = presc.medications || [];
                        const prescriptionDate = new Date(presc.prescribed_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        });

                        return (
                          <Card
                            key={presc.id}
                            elevation={2}
                            sx={{
                              transition: 'all 0.2s ease-in-out',
                              '&:hover': {
                                elevation: 4,
                                transform: 'translateY(-2px)',
                                boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                              }
                            }}
                          >
                            <CardContent sx={{ p: 3 }}>
                              {/* Card Header */}
                              <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 2,
                                pb: 1,
                                borderBottom: '1px solid',
                                borderColor: 'divider'
                              }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      fontWeight: 500,
                                      fontSize: '16px',
                                      color: '#212529'
                                    }}
                                  >
                                    {prescriptionDate}
                                  </Typography>
                                  <Chip
                                    label={presc.status}
                                    color={
                                      presc.status === 'Active' ? 'success' :
                                        presc.status === 'Completed' ? 'default' :
                                          presc.status === 'Cancelled' ? 'error' :
                                            'primary'
                                    }
                                    size="small"
                                    variant={presc.status === 'Completed' ? 'outlined' : 'filled'}
                                  />
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: '#6c757d',
                                      fontSize: '14px'
                                    }}
                                  >
                                    {presc.prescriber_details ? presc.prescriber_details.full_name : 'Unknown'}
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Prescription Reason */}
                              {presc.reason && (
                                <Box sx={{ mb: 2 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: '#6c757d',
                                      fontSize: '14px',
                                      fontStyle: 'italic'
                                    }}
                                  >
                                    <strong>Reason:</strong> {presc.reason}
                                  </Typography>
                                </Box>
                              )}


                              {/* Medications List */}
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {medications.map((med, medIndex) => {
                                  const drugName = med.drug_details?.name || med.drug?.name || 'Unknown Drug';
                                  const isAllergic = patient?.detailed_allergies?.some(allergy =>
                                    allergy.allergy?.name === drugName ||
                                    allergy.allergy?.name === med.drug_details?.name
                                  );

                                  // Check for duplicate therapy (same therapeutic class)
                                  const therapeuticClass = med.drug_details?.therapeutic_class || med.drug?.therapeutic_class;
                                  const duplicateTherapy = therapeuticClass && medications.filter(m =>
                                    (m.drug_details?.therapeutic_class || m.drug?.therapeutic_class) === therapeuticClass
                                  ).length > 1;

                                  // Check for drug interactions using backend API data
                                  const prescriptionWarnings = prescriptionInteractions[presc.id] || [];
                                  const hasInteraction = prescriptionWarnings.some(warning =>
                                    warning.type === 'Drug-Drug Interaction' &&
                                    warning.medications &&
                                    warning.medications.some(warnMed =>
                                      warnMed.id === (med.drug_details?.id || med.drug?.id)
                                    )
                                  );

                                  // Debug logging removed to prevent infinite re-renders

                                  return (
                                    <Box
                                      key={`${presc.id}-${medIndex}`}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        p: 2,
                                        backgroundColor: 'background.paper',
                                        borderRadius: 1,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        transition: 'all 0.2s ease'
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                        {/* Drug Name */}
                                        <Typography
                                          variant="body1"
                                          sx={{
                                            fontWeight: 'bold',
                                            fontSize: '16px',
                                            color: '#212529'
                                          }}
                                        >
                                          {drugName}
                                        </Typography>

                                        {/* Conflict Tags */}
                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                          {/* Allergy Warning */}
                                          {isAllergic && (
                                            <Chip
                                              icon={<WarningIcon />}
                                              label="Allergic"
                                              color="error"
                                              size="small"
                                              sx={{ fontWeight: 'bold' }}
                                            />
                                          )}

                                          {/* Drug Interaction Warning */}
                                          {hasInteraction && (
                                            <Chip
                                              label="Interaction"
                                              color="secondary"
                                              size="small"
                                              sx={{ fontWeight: 'bold' }}
                                            />
                                          )}

                                          {/* Duplicate Therapy Warning */}
                                          {duplicateTherapy && (
                                            <Chip
                                              label="Duplicate Therapy"
                                              color="warning"
                                              size="small"
                                              sx={{ fontWeight: 'bold' }}
                                            />
                                          )}
                                        </Box>

                                        {/* Dosage Details */}
                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                          <Chip
                                            label={`Dosage: ${med.dosage || 'N/A'}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontSize: '12px' }}
                                          />
                                          <Chip
                                            label={`Frequency: ${med.frequency || 'N/A'}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontSize: '12px' }}
                                          />
                                          <Chip
                                            label={`Duration: ${med.duration || 'N/A'}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontSize: '12px' }}
                                          />
                                          <Chip
                                            label={`Qty: ${med.quantity || 'N/A'}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontSize: '12px' }}
                                          />
                                          <Chip
                                            label={`Refills: ${med.refills || '0'}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontSize: '12px' }}
                                          />
                                        </Box>
                                      </Box>
                                    </Box>
                                  );
                                })}
                              </Box>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/* Right Column: Action Panel */}
          <Grid item xs={12} md={5}>
            {/* Add Prescription Card */}
            <Card elevation={3} sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  <LocalHospitalIcon sx={{ mr: 1, color: 'primary.main', fontSize: '2rem' }} />
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Add Prescription</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create a new prescription for this patient
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleCreatePrescription}
                  sx={{
                    fontWeight: 'bold',
                    px: 4,
                    py: 1.5,
                    borderRadius: 2
                  }}
                >
                  Create New Prescription
                </Button>
              </CardContent>
            </Card>

            {/* Add Allergy Card */}
            <Card elevation={3}>
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  <WarningIcon sx={{ mr: 1, color: 'warning.main', fontSize: '2rem' }} />
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Add Allergy</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Record a new allergy for this patient
                </Typography>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleAddAllergy}
                  sx={{
                    fontWeight: 'bold',
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    borderColor: 'warning.main',
                    color: 'warning.main',
                    '&:hover': {
                      borderColor: 'warning.dark',
                      backgroundColor: 'warning.light',
                      color: 'warning.dark'
                    }
                  }}
                >
                  Add New Allergy
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        {/* Allergy Management Dialog */}
        <Dialog open={allergyDialogOpen} onClose={() => setAllergyDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Allergies</DialogTitle>
          <DialogContent>
            {detailedAllergies.length === 0 && (
              <Typography variant="body2" color="text.secondary">No allergies added.</Typography>
            )}
            {detailedAllergies.map((a, idx) => (
              <Grid container spacing={1} key={idx} alignItems="center" sx={{ mb: 1 }}>
                <Grid item xs={4}>
                  <FormControl fullWidth>
                    <InputLabel>Allergy</InputLabel>
                    <Select
                      value={a.allergy_id || ''}
                      onChange={e => handleAllergyFieldChange(idx, 'allergy_id', e.target.value)}
                      disabled={creatingAllergyFromDrug}
                      renderValue={selected => {
                        const found = allergies.find(allergy => allergy.id === selected);
                        return found ? found.name : '';
                      }}
                    >
                      {allergies.map((allergy) => (
                        <MenuItem key={allergy.id} value={allergy.id}>
                          {allergy.name}
                        </MenuItem>
                      ))}
                      <Divider />
                      <Typography variant="subtitle2" sx={{ px: 2, py: 1, color: 'text.secondary' }}>
                        Add Medicine as Allergy:
                      </Typography>
                      {drugs.map((drug) => (
                        <MenuItem key={`drug-${drug.id}`} value={`drug-${drug.id}`}>
                          {drug.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Reaction/Notes"
                    value={a.reaction || ''}
                    onChange={e => handleAllergyFieldChange(idx, 'reaction', e.target.value)}
                  />
                </Grid>
                <Grid item xs={2}>
                  <TextField
                    fullWidth
                    label="Date Noted"
                    type="date"
                    value={a.date_noted || ''}
                    onChange={e => handleAllergyFieldChange(idx, 'date_noted', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={2}>
                  <FormControl fullWidth>
                    <InputLabel>Severity</InputLabel>
                    <Select
                      value={a.severity || ''}
                      onChange={e => handleAllergyFieldChange(idx, 'severity', e.target.value)}
                      label="Severity"
                    >
                      {allergySeverityOptions.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={1} sx={{ textAlign: 'right' }}>
                  <IconButton color="error" onClick={() => handleRemoveAllergy(idx)}>
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button variant="outlined" size="small" onClick={handleAddAllergyRow} sx={{ mt: 1 }} startIcon={<AddIcon />}>Add Allergy</Button>
            {allergyError && <Typography color="error">{allergyError}</Typography>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAllergyDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveAllergies} disabled={allergyLoading}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
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

        {/* PrescriptionDialog */}
        <PrescriptionDialog
          open={prescriptionDialogOpen}
          onClose={handlePrescriptionDialogClose}
          onSubmit={handlePrescriptionCreated}
          initialPatient={patient?.id}
          patients={[patient]} // Pass current patient as array
          drugs={drugs} // Pass drugs data
          drugsLoading={drugsLoading} // Pass loading state
        />
      </Box>
    </Box>
  );
};

export default PatientProfile; 