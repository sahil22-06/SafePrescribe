import React from 'react';
import {
  Paper,
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

const MedicationDisplay = ({ 
  medication, 
  warnings = [], 
  onRemove,
  showRemoveButton = true 
}) => {
  // Get the highest severity warning
  const getHighestSeverity = () => {
    if (!warnings || warnings.length === 0) return null;
    
    const severityOrder = { 'high': 3, 'moderate': 2, 'low': 1 };
    return warnings.reduce((highest, warning) => {
      const currentSeverity = severityOrder[warning.severity.toLowerCase()] || 0;
      const highestSeverity = severityOrder[highest.severity.toLowerCase()] || 0;
      return currentSeverity > highestSeverity ? warning : highest;
    });
  };

  const highestSeverityWarning = getHighestSeverity();

  // Get severity props
  const getSeverityProps = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return { 
          color: 'error', 
          icon: <ErrorIcon />, 
          bgColor: '#ffebee',
          borderColor: '#f44336'
        };
      case 'moderate':
        return { 
          color: 'warning', 
          icon: <WarningIcon />, 
          bgColor: '#fff3e0',
          borderColor: '#ff9800'
        };
      case 'low':
        return { 
          color: 'info', 
          icon: <InfoIcon />, 
          bgColor: '#e3f2fd',
          borderColor: '#2196f3'
        };
      default:
        return { 
          color: 'default', 
          icon: <WarningIcon />, 
          bgColor: '#f5f5f5',
          borderColor: '#9e9e9e'
        };
    }
  };

  const severityProps = getSeverityProps(highestSeverityWarning?.severity);

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        mb: 1,
        border: highestSeverityWarning ? `2px solid ${severityProps.borderColor}` : '1px solid #e0e0e0',
        backgroundColor: highestSeverityWarning ? severityProps.bgColor : 'white',
        position: 'relative'
      }}
    >
      {/* Warning indicator */}
      {highestSeverityWarning && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
          }}
        >
          <Tooltip title={`${highestSeverityWarning.type}: ${highestSeverityWarning.message}`}>
            <Chip
              icon={severityProps.icon}
              label={highestSeverityWarning.severity}
              color={severityProps.color}
              size="small"
              variant="outlined"
            />
          </Tooltip>
        </Box>
      )}

      {/* Medication details */}
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box flex={1}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
            {medication.name}
          </Typography>
          
          {medication.dosage && (
            <Typography variant="body2" color="text.secondary">
              Dosage: {medication.dosage}
            </Typography>
          )}
          
          {medication.frequency && (
            <Typography variant="body2" color="text.secondary">
              Frequency: {medication.frequency}
            </Typography>
          )}
          
          {medication.duration && (
            <Typography variant="body2" color="text.secondary">
              Duration: {medication.duration}
            </Typography>
          )}
          
          <Box display="flex" gap={1} mt={1}>
            {medication.quantity && (
              <Chip label={`Qty: ${medication.quantity}`} size="small" variant="outlined" />
            )}
            {medication.refills && (
              <Chip label={`Refills: ${medication.refills}`} size="small" variant="outlined" />
            )}
          </Box>
        </Box>

        {/* Remove button */}
        {showRemoveButton && onRemove && (
          <IconButton
            onClick={onRemove}
            color="error"
            size="small"
            sx={{ ml: 1 }}
          >
            <DeleteIcon />
          </IconButton>
        )}
      </Box>

      {/* Detailed warnings */}
      {warnings && warnings.length > 0 && (
        <Box mt={2}>
          {warnings.map((warning, index) => (
            <Alert
              key={index}
              severity={warning.severity.toLowerCase()}
              icon={getSeverityProps(warning.severity).icon}
              sx={{ mb: 1 }}
            >
              <Typography variant="body2">
                <strong>{warning.type}:</strong> {warning.message}
              </Typography>
            </Alert>
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default MedicationDisplay;
