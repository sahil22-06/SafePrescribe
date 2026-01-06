import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  CircularProgress,
  Snackbar
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { conflictAPI } from '../services/api';

const MedicationAdder = ({ 
  patientId, 
  onMedicationAdded, 
  selectedMedication = null,
  disabled = false 
}) => {
  // State management
  const [loading, setLoading] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [conflictWarnings, setConflictWarnings] = useState([]);
  const [pendingMedication, setPendingMedication] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Handle adding medication with conflict checking
  const handleAddMedication = useCallback(async () => {
    if (!patientId || !selectedMedication) {
      setSnackbar({
        open: true,
        message: 'Please select a patient and medication',
        severity: 'error'
      });
      return;
    }

    setLoading(true);
    
    try {
      // Call the conflict checking API
      const response = await conflictAPI.checkConflict({
        patient_id: patientId,
        new_medication_id: selectedMedication.id
      });

      const { status, warnings } = response.data;

      if (status === 'ok') {
        // No conflicts - proceed with adding medication
        await addMedicationToPrescription();
        setSnackbar({
          open: true,
          message: 'Medication added successfully',
          severity: 'success'
        });
      } else if (status === 'conflict') {
        // Conflicts detected - show warning modal
        setConflictWarnings(warnings);
        setPendingMedication(selectedMedication);
        setShowWarningModal(true);
      }
    } catch (error) {
      console.error('Error checking medication conflicts:', error);
      setSnackbar({
        open: true,
        message: 'Error checking medication conflicts. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [patientId, selectedMedication]);

  // Add medication to prescription (called when no conflicts or after override)
  const addMedicationToPrescription = useCallback(async () => {
    try {
      // This would typically call your prescription API
      // For now, we'll just call the onMedicationAdded callback
      if (onMedicationAdded) {
        await onMedicationAdded(pendingMedication || selectedMedication);
      }
    } catch (error) {
      console.error('Error adding medication:', error);
      setSnackbar({
        open: true,
        message: 'Error adding medication to prescription',
        severity: 'error'
      });
    }
  }, [onMedicationAdded, pendingMedication, selectedMedication]);

  // Handle override (proceed despite conflicts)
  const handleOverride = useCallback(async () => {
    setShowWarningModal(false);
    await addMedicationToPrescription();
    setSnackbar({
      open: true,
      message: 'Medication added with warnings acknowledged',
      severity: 'warning'
    });
  }, [addMedicationToPrescription]);

  // Handle cancel (don't add medication)
  const handleCancel = useCallback(() => {
    setShowWarningModal(false);
    setConflictWarnings([]);
    setPendingMedication(null);
  }, []);

  // Get severity color and icon
  const getSeverityProps = (severity) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return { color: 'error', icon: <ErrorIcon /> };
      case 'moderate':
        return { color: 'warning', icon: <WarningIcon /> };
      case 'low':
        return { color: 'info', icon: <InfoIcon /> };
      default:
        return { color: 'warning', icon: <WarningIcon /> };
    }
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Box>
      {/* Add Medication Button */}
      <Button
        variant="contained"
        startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
        onClick={handleAddMedication}
        disabled={disabled || loading || !patientId || !selectedMedication}
        sx={{ mb: 2 }}
      >
        {loading ? 'Checking...' : 'Add Medicine'}
      </Button>

      {/* Conflict Warning Modal */}
      <Dialog
        open={showWarningModal}
        onClose={handleCancel}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="warning" />
            <Typography variant="h6">Medication Conflict Detected</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Warning</AlertTitle>
            The following conflicts have been detected with the selected medication:
          </Alert>

          <List>
            {conflictWarnings.map((warning, index) => {
              const severityProps = getSeverityProps(warning.severity);
              return (
                <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Box display="flex" alignItems="center" gap={1} width="100%" mb={1}>
                    <ListItemIcon sx={{ minWidth: 'auto' }}>
                      {severityProps.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {warning.type}
                          </Typography>
                          <Chip
                            label={warning.severity}
                            color={severityProps.color}
                            size="small"
                          />
                        </Box>
                      }
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                    {warning.message}
                  </Typography>
                </ListItem>
              );
            })}
          </List>

          <Alert severity="info" sx={{ mt: 2 }}>
            <AlertTitle>Important</AlertTitle>
            Please review these warnings carefully. You can choose to cancel or override and add the medication anyway.
          </Alert>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCancel} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleOverride} 
            variant="contained" 
            color="warning"
            startIcon={<WarningIcon />}
          >
            Override & Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
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
    </Box>
  );
};

export default MedicationAdder;
