import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  Card,
  CardContent
} from '@mui/material';
import {
  Psychology as AIIcon,
  Lightbulb as SuggestionIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import MedicationSuggestionPanel from './MedicationSuggestionPanel';
import AIEnhancedSuggestionPanel from './AIEnhancedSuggestionPanel';

const MasterSuggestionPanel = ({
  patient,
  condition,
  onAddSuggestion,
  excludedDrugs = [],
  searchTerm = '',
  drugs = []
}) => {
  const [useAI, setUseAI] = useState(false);

  const handleModeToggle = (event) => {
    setUseAI(event.target.checked);
  };

  // Get excluded drug names
  const getExcludedDrugNames = () => {
    if (!excludedDrugs.length || !drugs.length) return [];

    return excludedDrugs.map(drugId => {
      const drug = drugs.find(d => d.id === drugId);
      return drug ? drug.name : `Drug ${drugId}`;
    });
  };

  const excludedDrugNames = getExcludedDrugNames();

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'white',
      borderRadius: 3,
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      border: '1px solid #E8ECF0'
    }}>
      {/* Unified Header */}
      <Box sx={{
        p: 3,
        borderBottom: '1px solid #E8ECF0',
        bgcolor: '#F7F9FC'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 32,
              height: 32,
              borderRadius: 2,
              bgcolor: '#4A90E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {useAI ? <AIIcon sx={{ fontSize: 18, color: 'white' }} /> : <SuggestionIcon sx={{ fontSize: 18, color: 'white' }} />}
            </Box>
            <Typography variant="h6" fontWeight="600" color="#333333" sx={{ fontFamily: 'Inter, sans-serif' }}>
              Medication Suggestions
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={useAI}
                onChange={handleModeToggle}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#4A90E2',
                    '& + .MuiSwitch-track': {
                      backgroundColor: '#4A90E2',
                    },
                  },
                }}
              />
            }
            label={
              <Typography variant="body2" fontWeight="500" color="#6c757d" sx={{ fontFamily: 'Inter, sans-serif' }}>
                {useAI ? 'AI Mode' : 'Standard Mode'}
              </Typography>
            }
            labelPlacement="start"
          />
        </Box>

        {/* Mode Description */}
        <Alert
          severity="info"
          icon={<InfoIcon sx={{ color: '#4A90E2' }} />}
          sx={{
            mb: 2,
            bgcolor: '#E3F2FD',
            border: '1px solid #BBDEFB',
            borderRadius: 2,
            '& .MuiAlert-message': {
              color: '#1976D2'
            }
          }}
        >
          <Typography variant="body2" fontWeight="500" sx={{ fontFamily: 'Inter, sans-serif' }}>
            {useAI ? (
              <>
                <strong>AI-Enhanced Mode:</strong> Advanced machine learning algorithms analyze patient data,
                medical history, and drug interactions to provide personalized medication recommendations
                with safety scores and detailed explanations.
              </>
            ) : (
              <>
                <strong>Standard Mode:</strong> Traditional rule-based suggestions filtered by patient
                allergies and current medications. Fast and reliable for common conditions.
              </>
            )}
          </Typography>
        </Alert>

        {/* Patient Info */}
        {patient && (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Chip
              icon={<InfoIcon sx={{ fontSize: 16 }} />}
              label={`Patient: ${patient.name || 'undefined'}`}
              sx={{
                bgcolor: '#E3F2FD',
                color: '#1976D2',
                border: '1px solid #BBDEFB',
                fontWeight: 500,
                fontFamily: 'Inter, sans-serif'
              }}
              size="small"
            />
            {patient.allergies && patient.allergies.length > 0 && (
              <Chip
                label={`${patient.allergies.length} Allergies`}
                sx={{
                  bgcolor: '#FFF3E0',
                  color: '#F57C00',
                  border: '1px solid #FFCC02',
                  fontWeight: 500,
                  fontFamily: 'Inter, sans-serif'
                }}
                size="small"
              />
            )}
            {excludedDrugs.length > 0 && (
              <Chip
                label={`${excludedDrugs.length} Current Meds`}
                sx={{
                  bgcolor: '#E8F5E8',
                  color: '#2E7D32',
                  border: '1px solid #C8E6C9',
                  fontWeight: 500,
                  fontFamily: 'Inter, sans-serif'
                }}
                size="small"
              />
            )}
          </Box>
        )}
      </Box>


      {/* Suggestion Panel Container */}
      <Box sx={{
        flex: 1,
        overflow: 'hidden',
        p: 3,
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: '#F7F9FC',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: '#4A90E2',
          borderRadius: '4px',
          '&:hover': {
            background: '#357ABD',
          },
        },
      }}>
        {useAI ? (
          <AIEnhancedSuggestionPanel
            patient={patient}
            condition={condition}
            onAddSuggestion={onAddSuggestion}
            excludedDrugs={excludedDrugs}
            searchTerm={searchTerm}
          />
        ) : (
          <MedicationSuggestionPanel
            patient={patient}
            condition={condition}
            onAddSuggestion={onAddSuggestion}
            excludedDrugs={excludedDrugs}
            searchTerm={searchTerm}
          />
        )}
      </Box>
    </Box>
  );
};

export default MasterSuggestionPanel;
