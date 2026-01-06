import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider,
  Alert
} from '@mui/material';
import MedicationAdder from './MedicationAdder';
import MedicationDisplay from './MedicationDisplay';
import { patientsAPI, drugsAPI } from '../services/api';

const PrescriptionWorkflow = () => {
  // State management
  const [patients, setPatients] = useState([]);
  const [drugs, setDrugs] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [prescriptionMedications, setPrescriptionMedications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load patients and drugs on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [patientsResponse, drugsResponse] = await Promise.all([
          patientsAPI.getAll(),
          drugsAPI.getAll()
        ]);
        setPatients(patientsResponse.data);
        setDrugs(drugsResponse.data);
      } catch (err) {
        setError('Failed to load data');
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle medication addition
  const handleMedicationAdded = async (medication) => {
    try {
      // Add medication to prescription list
      const newMedication = {
        ...medication,
        id: Date.now(), // Temporary ID for demo
        dosage: '500mg', // Default values for demo
        frequency: 'Twice daily',
        duration: '7 days',
        quantity: 14,
        refills: 0
      };

      setPrescriptionMedications(prev => [...prev, newMedication]);
      
      // Reset selected medication
      setSelectedMedication(null);
    } catch (err) {
      console.error('Error adding medication:', err);
    }
  };

  // Handle medication removal
  const handleMedicationRemove = (medicationId) => {
    setPrescriptionMedications(prev => 
      prev.filter(med => med.id !== medicationId)
    );
  };

  // Get selected patient object
  const selectedPatientObj = patients.find(p => p.id === selectedPatient);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Prescription Workflow with Conflict Checking
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        This workflow demonstrates real-time medication conflict checking. 
        Select a patient and medication, then try to add it to see conflict detection in action.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Patient and Medication Selection */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Step 1: Select Patient & Medication
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Patient</InputLabel>
                  <Select
                    value={selectedPatient}
                    onChange={(e) => setSelectedPatient(e.target.value)}
                    disabled={loading}
                  >
                    {patients.map((patient) => (
                      <MenuItem key={patient.id} value={patient.id}>
                        {patient.first_name} {patient.last_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Medication</InputLabel>
                  <Select
                    value={selectedMedication?.id || ''}
                    onChange={(e) => {
                      const drug = drugs.find(d => d.id === e.target.value);
                      setSelectedMedication(drug);
                    }}
                    disabled={loading}
                  >
                    {drugs.map((drug) => (
                      <MenuItem key={drug.id} value={drug.id}>
                        {drug.name} {drug.therapeutic_class && `(${drug.therapeutic_class})`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Medication Adder Component */}
            <Typography variant="h6" gutterBottom>
              Step 2: Add Medication
            </Typography>
            
            <MedicationAdder
              patientId={selectedPatient}
              selectedMedication={selectedMedication}
              onMedicationAdded={handleMedicationAdded}
              disabled={loading}
            />
          </Paper>
        </Grid>

        {/* Prescription Display */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Current Prescription
            </Typography>
            
            {selectedPatientObj && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Patient: {selectedPatientObj.first_name} {selectedPatientObj.last_name}
              </Typography>
            )}

            {prescriptionMedications.length === 0 ? (
              <Alert severity="info">
                No medications added yet. Select a patient and medication above to get started.
              </Alert>
            ) : (
              <Box>
                {prescriptionMedications.map((medication) => (
                  <MedicationDisplay
                    key={medication.id}
                    medication={medication}
                    onRemove={() => handleMedicationRemove(medication.id)}
                    showRemoveButton={true}
                  />
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Demo Information */}
      <Paper sx={{ p: 3, mt: 3, bgcolor: 'grey.50' }}>
        <Typography variant="h6" gutterBottom>
          Demo Information
        </Typography>
        
        <Typography variant="body2" paragraph>
          <strong>Known Conflicts for Testing:</strong>
        </Typography>
        
        <Box component="ul" sx={{ pl: 2 }}>
          <li><strong>Allergy Conflicts:</strong> Medications containing "penicillin" will conflict with patients allergic to "penicillin"</li>
          <li><strong>Drug Interactions:</strong> 
            <ul>
              <li>Warfarin + Aspirin/Ibuprofen (High severity - bleeding risk)</li>
              <li>Lisinopril + Ibuprofen (Moderate severity - blood pressure)</li>
              <li>Amoxicillin + Warfarin (Moderate severity - bleeding risk)</li>
            </ul>
          </li>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Try adding medications with these names to see conflict detection in action!
        </Typography>
      </Paper>
    </Box>
  );
};

export default PrescriptionWorkflow;
