import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Alert,
  Chip,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  LocalHospital as PrescriptionIcon,
  Psychology as AIIcon,
  Person as PatientIcon
} from '@mui/icons-material';
import PrescriptionDialog from '../components/PrescriptionDialog';
import MasterSuggestionPanel from '../components/MasterSuggestionPanel';

const PrescriptionPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  
  // State for prescription data
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [prescriptionMedications, setPrescriptionMedications] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [prescriptionReason, setPrescriptionReason] = useState('');

  // Handle adding a suggestion to the prescription
  const handleAddSuggestion = useCallback((suggestion) => {
    console.log('Adding suggestion to prescription:', suggestion);
    
    // Convert suggestion to medication format expected by PrescriptionDialog
    const newMedication = {
      drug: suggestion.id || suggestion.drug_id,
      dosage: suggestion.dosage || suggestion.recommended_dosage || '',
      frequency: suggestion.frequency || suggestion.recommended_frequency || '',
      duration: suggestion.duration || suggestion.recommended_duration || '',
      quantity: suggestion.quantity || suggestion.recommended_quantity || '',
      refills: suggestion.refills || suggestion.recommended_refills || ''
    };

    // Add to prescription medications
    setPrescriptionMedications(prev => [...prev, newMedication]);
    
    // Show success message
    console.log('Medication added to prescription:', newMedication);
  }, []);

  // Handle prescription form changes
  const handlePrescriptionChange = useCallback((formData) => {
    if (formData.patient && formData.patient !== selectedPatient?.id) {
      // Find the patient object
      // This would typically come from a patients list or API call
      // For now, we'll create a mock patient object
      const patient = {
        id: formData.patient,
        name: `Patient ${formData.patient}`,
        allergies: [] // This would come from the actual patient data
      };
      setSelectedPatient(patient);
    }
    
    // Update prescription medications from form data
    if (formData.medications) {
      setPrescriptionMedications(formData.medications);
    }
    
    // Update search term from form data
    if (formData.reason) {
      setPrescriptionReason(formData.reason);
      setSearchTerm(formData.reason);
    }
  }, [selectedPatient]);

  // Get excluded drugs for suggestions
  const excludedDrugs = prescriptionMedications.map(med => med.drug).filter(Boolean);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Page Header */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <PrescriptionIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" component="h1">
            Prescription Management
          </Typography>
        </Box>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Create prescriptions with AI-powered medication suggestions and real-time conflict checking.
        </Typography>

        {/* Status Indicators */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {selectedPatient && (
            <Chip 
              icon={<PatientIcon />} 
              label={`Patient: ${selectedPatient.name}`} 
              color="primary" 
              variant="outlined"
            />
          )}
          {prescriptionMedications.length > 0 && (
            <Chip 
              label={`${prescriptionMedications.length} Medications`} 
              color="success" 
              variant="outlined"
            />
          )}
          {searchTerm && (
            <Chip 
              label={`Condition: ${searchTerm}`} 
              color="info" 
              variant="outlined"
            />
          )}
        </Box>
      </Paper>

      {/* Main Content - Two Column Layout */}
      <Grid container spacing={3}>
        {/* Left Column - Prescription Form */}
        <Grid item xs={12} lg={8}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              Prescription Form
            </Typography>
            <PrescriptionDialog 
              onFormChange={handlePrescriptionChange}
              // Pass any additional props needed by PrescriptionDialog
            />
          </Paper>
        </Grid>

        {/* Right Column - AI Suggestions Panel */}
        <Grid item xs={12} lg={4}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 2, 
              height: 'fit-content',
              position: isMobile ? 'static' : 'sticky',
              top: 24,
              maxHeight: isMobile ? 'none' : 'calc(100vh - 48px)',
              overflow: 'auto'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AIIcon color="primary" />
              <Typography variant="h6" component="h2">
                AI Suggestions
              </Typography>
            </Box>
            
            <Divider sx={{ mb: 2 }} />

            {/* Conditional Rendering Based on State */}
            {!selectedPatient ? (
              <Alert severity="info" icon={<PatientIcon />}>
                <Typography variant="body2">
                  Please select a patient in the prescription form to see personalized medication suggestions.
                </Typography>
              </Alert>
            ) : !searchTerm ? (
              <Alert severity="info" icon={<PrescriptionIcon />}>
                <Typography variant="body2">
                  Enter a condition or reason for prescription to get relevant medication suggestions.
                </Typography>
              </Alert>
            ) : (
              <MasterSuggestionPanel
                patient={selectedPatient}
                condition={prescriptionReason}
                onAddSuggestion={handleAddSuggestion}
                excludedDrugs={excludedDrugs}
                searchTerm={searchTerm}
              />
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Debug Information (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <Paper elevation={1} sx={{ p: 2, mt: 3, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Debug Information:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`Patient: ${selectedPatient?.name || 'None'}`} size="small" />
            <Chip label={`Medications: ${prescriptionMedications.length}`} size="small" />
            <Chip label={`Excluded: ${excludedDrugs.length}`} size="small" />
            <Chip label={`Search: ${searchTerm || 'None'}`} size="small" />
          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default PrescriptionPage;
