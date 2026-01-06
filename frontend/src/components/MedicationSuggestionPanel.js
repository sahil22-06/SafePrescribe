import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, List, ListItem,
  Chip, IconButton, Alert, CircularProgress, Button,
  FormControl, InputLabel, Select, MenuItem, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Card, CardContent, Snackbar
} from '@mui/material';
import {
  Lightbulb as SuggestionIcon,
  Add as AddIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as SafeIcon,
  LocalHospital as PillIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { suggestionsAPI } from '../services/api';

const MedicationSuggestionPanel = ({
  patient,
  condition,
  onAddSuggestion,
  excludedDrugs = [],
  searchTerm = ''
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [maxSuggestions, setMaxSuggestions] = useState(5);
  const [sortBy, setSortBy] = useState('safety');
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isTyping, setIsTyping] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await suggestionsAPI.getAllergyAwareSuggestions({
        patient_id: patient.id,
        condition: searchTerm || condition,
        excluded_drugs: excludedDrugs,
        max_suggestions: maxSuggestions
      });
      let items = response.data.suggestions || [];
      // Client-side sorting
      if (sortBy === 'safety') {
        items = items.sort((a, b) => (b.safety_score || 0) - (a.safety_score || 0));
      } else if (sortBy === 'name') {
        items = items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }
      setSuggestions(items);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch suggestions');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [patient, searchTerm, condition, excludedDrugs, maxSuggestions, sortBy]);

  useEffect(() => {
    // Debounce fetch to reduce API calls while typing
    let t;
    if (patient && searchTerm && searchTerm.length >= 2) {
      setHasSearched(true);
      setIsTyping(true); // Show typing indicator
      t = setTimeout(() => {
        console.log('🔍 Standard: Triggering search after debounce for:', searchTerm);
        setIsTyping(false); // Hide typing indicator
        fetchSuggestions();
      }, 800); // Increased debounce to wait for complete typing
    } else if (searchTerm && searchTerm.length < 2) {
      setSuggestions([]);
      setError('');
      setIsTyping(false);
    } else if (!searchTerm) {
      setSuggestions([]);
      setError('');
      setHasSearched(false);
      setIsTyping(false);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [patient, searchTerm, excludedDrugs, maxSuggestions, fetchSuggestions]);

  const handleAddSuggestion = (suggestion) => {
    // If medication has contraindications, show warning dialog first
    if (suggestion.is_contraindicated || suggestion.contraindication_level === 'severe') {
      setPendingSuggestion(suggestion);
      setShowWarningDialog(true);
      return;
    }
    
    // Otherwise, add directly
    addSuggestionToPrescription(suggestion);
  };

  const addSuggestionToPrescription = (suggestion) => {
    if (onAddSuggestion) {
      onAddSuggestion({
        id: suggestion.id,
        name: suggestion.name,
        drug_id: suggestion.id,
        dosage: (typeof suggestion.recommended_dosage_mg === 'number' && suggestion.recommended_dosage_mg > 0)
          ? `${suggestion.recommended_dosage_mg}mg`
          : (suggestion.strength || ''),
        frequency: 'As directed',
        duration: '7 days',
        quantity: '30',
        refills: '0'
      });
      
      // Show success snackbar
      setSnackbar({
        open: true,
        message: `${suggestion.name} added to medication form!`,
        severity: 'success'
      });
    }
    setSelectedSuggestion(suggestion.id);
    setTimeout(() => setSelectedSuggestion(null), 2000);
  };

  const handleConfirmAddWithWarning = () => {
    if (pendingSuggestion) {
      addSuggestionToPrescription(pendingSuggestion);
      setShowWarningDialog(false);
      setPendingSuggestion(null);
      
      // Show warning snackbar
      setSnackbar({
        open: true,
        message: `${pendingSuggestion.name} added to medication form with safety warning!`,
        severity: 'warning'
      });
    }
  };

  const handleCancelAddWithWarning = () => {
    setShowWarningDialog(false);
    setPendingSuggestion(null);
  };

  const getSafetyColor = (score) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'warning';
    return 'error';
  };

  const getSafetyIcon = (score) => {
    if (score >= 0.8) return <SafeIcon fontSize="small" />;
    if (score >= 0.6) return <InfoIcon fontSize="small" />;
    return <WarningIcon fontSize="small" />;
  };

  const getWelcomeContent = () => {
    if (!patient) {
      return {
        icon: '👋',
        title: 'Welcome to Smart Suggestions',
        subtitle: 'Select a patient to get started',
        description: 'I\'ll help you find safe medication alternatives based on patient allergies and medical conditions.'
      };
    } else if (!searchTerm || searchTerm.length < 2) {
      return {
        icon: '🔍',
        title: 'Start Typing a Condition',
        subtitle: `Ready to help ${patient.first_name}`,
        description: 'Type at least 2 characters in the "Reason for Prescription" field to see smart suggestions.'
      };
    } else if (loading) {
      return {
        icon: '⚡',
        title: 'Finding Safe Alternatives',
        subtitle: `Analyzing for "${searchTerm}"`,
        description: 'Checking patient allergies and finding the best medication options...'
      };
    }
    return null;
  };

  const welcomeContent = getWelcomeContent();

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'white',
      borderRadius: 2,
      overflow: 'hidden'
    }}>
      {/* Welcome/Loading/Error States */}
      {welcomeContent && (
        <Box sx={{
          textAlign: 'center',
          py: 6,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          flex: 1,
          justifyContent: 'center'
        }}>
          <Box sx={{
            background: '#F7F9FC',
            borderRadius: '50%',
            width: 80,
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            border: '2px solid #E8ECF0'
          }}>
            <Typography sx={{ fontSize: '2.5rem' }}>
              {welcomeContent.icon}
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ color: '#333333', fontWeight: 600, fontSize: '1.2rem', fontFamily: 'Inter, sans-serif' }}>
            {welcomeContent.title}
          </Typography>
          <Typography variant="body2" sx={{ color: '#6c757d', mb: 1, fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
            {welcomeContent.subtitle}
          </Typography>
          <Typography variant="caption" sx={{
            color: '#6c757d',
            maxWidth: 300,
            lineHeight: 1.5,
            fontSize: '0.9rem',
            fontFamily: 'Inter, sans-serif'
          }}>
            {welcomeContent.description}
          </Typography>
          {loading && (
            <CircularProgress size={35} sx={{ color: '#4A90E2', mt: 2 }} />
          )}
        </Box>
      )}


      {error && (
        <Alert
          severity="error"
          sx={{
            m: 3,
            borderRadius: 2,
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {error}
          <Button
            size="small"
            onClick={fetchSuggestions}
            sx={{ mt: 1, display: 'block', fontFamily: 'Inter, sans-serif' }}
          >
            Retry
          </Button>
        </Alert>
      )}

      {!loading && !error && suggestions.length === 0 && hasSearched && (
        <Alert
          severity="info"
          sx={{
            m: 3,
            borderRadius: 2,
            fontFamily: 'Inter, sans-serif'
          }}
        >
          No safe alternatives found for "{searchTerm}".
          Try a different condition or check patient allergies.
        </Alert>
      )}

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto', 
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
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 3,
            p: 2,
            bgcolor: '#F7F9FC',
            borderRadius: 2,
            border: '1px solid #E8ECF0'
          }}>
            <Box sx={{
              width: 32,
              height: 32,
              borderRadius: 2,
              bgcolor: '#4A90E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 1.5
            }}>
              <PillIcon sx={{ color: 'white', fontSize: 18 }} />
            </Box>
            <Typography variant="h6" sx={{ color: '#333333', fontWeight: 600, fontSize: '1.1rem', fontFamily: 'Inter, sans-serif' }}>
              Safe Alternatives
            </Typography>
            <Chip 
              label={`${suggestions.length} found`}
              size="small"
              sx={{
                bgcolor: '#4A90E2',
                color: 'white',
                fontWeight: 600,
                ml: 'auto',
                fontFamily: 'Inter, sans-serif'
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {suggestions.map((suggestion, index) => (
              <Card
                key={suggestion.id}
                sx={{
                  bgcolor: 'white',
                  border: '1px solid #E8ECF0',
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(74, 144, 226, 0.15)',
                    borderColor: '#4A90E2'
                  }
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ 
                        color: '#333333', 
                        fontWeight: 600,
                        fontSize: '1.1rem',
                        fontFamily: 'Inter, sans-serif',
                        mb: 0.5
                      }}>
                        {suggestion.name}
                      </Typography>
                      {suggestion.generic_name && suggestion.generic_name !== suggestion.name && (
                        <Typography variant="body2" sx={{ 
                          color: '#6c757d',
                          fontSize: '0.9rem',
                          fontFamily: 'Inter, sans-serif',
                          mb: 0.5
                        }}>
                          {suggestion.generic_name}
                        </Typography>
                      )}
                      {suggestion.strength && (
                        <Typography variant="body2" sx={{ 
                          color: '#6c757d',
                          fontSize: '0.9rem',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          {suggestion.strength} • {suggestion.form || 'Tablet'}
                        </Typography>
                      )}
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Chip
                        label={`${Math.round(suggestion.safety_score * 100)}% Safe`}
                        size="small"
                        sx={{
                          bgcolor: suggestion.safety_score >= 0.8 ? '#00C49F' : suggestion.safety_score >= 0.6 ? '#FFC107' : '#D32F2F',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          fontFamily: 'Inter, sans-serif'
                        }}
                      />
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleAddSuggestion(suggestion)}
                        sx={{
                          bgcolor: '#4A90E2',
                          color: 'white',
                          fontWeight: 600,
                          px: 2.5,
                          py: 1,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontFamily: 'Inter, sans-serif',
                          '&:hover': {
                            bgcolor: '#357ABD',
                            transform: 'scale(1.02)'
                          }
                        }}
                      >
                        <AddIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
                        USE
                      </Button>
                    </Box>
                  </Box>

                  {suggestion.reasoning && (
                    <Typography variant="body2" sx={{ 
                      color: '#6c757d',
                      fontSize: '0.9rem',
                      fontStyle: 'italic',
                      mt: 2,
                      p: 2,
                      bgcolor: '#F7F9FC',
                      borderRadius: 1.5,
                      border: '1px solid #E8ECF0',
                      fontFamily: 'Inter, sans-serif'
                    }}>
                      {suggestion.reasoning}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* Empty State */}
      {suggestions.length === 0 && !loading && !welcomeContent && (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          py: 6,
          textAlign: 'center',
          flex: 1
        }}>
          <Box sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: '#F7F9FC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            border: '2px solid #E8ECF0'
          }}>
            <PillIcon sx={{ fontSize: 32, color: '#6c757d' }} />
          </Box>
          <Typography variant="h6" sx={{ color: '#333333', mb: 1, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
            Ready for Suggestions
          </Typography>
          <Typography variant="body2" sx={{ color: '#6c757d', fontFamily: 'Inter, sans-serif' }}>
            Enter a condition to get safe medication alternatives
          </Typography>
        </Box>
      )}

      {/* Warning Dialog for Contraindicated Medications */}
      <Dialog
        open={showWarningDialog}
        onClose={handleCancelAddWithWarning}
        maxWidth="sm"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 3,
            fontFamily: 'Inter, sans-serif'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          color: '#D32F2F',
          backgroundColor: '#FFEBEE',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600
        }}>
          <WarningIcon color="error" />
          Medication Safety Warning
        </DialogTitle>
        <DialogContent sx={{ pt: 3, fontFamily: 'Inter, sans-serif' }}>
          <Typography variant="body1" sx={{ mb: 2, fontFamily: 'Inter, sans-serif' }}>
            You are about to add <strong>{pendingSuggestion?.name}</strong> to the prescription.
          </Typography>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            <Typography variant="body2" fontWeight="600" sx={{ fontFamily: 'Inter, sans-serif' }}>
              This medication has the following contraindications:
            </Typography>
            <Box component="ul" sx={{ mt: 1, pl: 2 }}>
              {pendingSuggestion?.warnings?.map((warning, index) => (
                <li key={index}>
                  <Typography variant="body2" sx={{ fontFamily: 'Inter, sans-serif' }}>{warning}</Typography>
                </li>
              ))}
            </Box>
          </Alert>
          <Typography variant="body2" sx={{ color: '#6c757d', fontFamily: 'Inter, sans-serif' }}>
            Please ensure you have reviewed the patient's medical history and are prescribing this medication with appropriate caution.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={handleCancelAddWithWarning}
            variant="outlined"
            sx={{
              borderColor: '#4A90E2',
              color: '#4A90E2',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              '&:hover': {
                borderColor: '#357ABD',
                backgroundColor: 'rgba(74, 144, 226, 0.1)'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmAddWithWarning}
            variant="contained"
            sx={{
              bgcolor: '#FFC107',
              color: '#333333',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              '&:hover': {
                bgcolor: '#FFB300'
              }
            }}
            startIcon={<WarningIcon />}
          >
            Use with Warning
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        severity={snackbar.severity}
      />
    </Box>
  );
};

export default MedicationSuggestionPanel;
