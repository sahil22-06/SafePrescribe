import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography,
  Chip, Alert, CircularProgress, Button,
  FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, Accordion, AccordionSummary,
  AccordionDetails, LinearProgress, Switch, FormControlLabel,
  Snackbar
} from '@mui/material';
import {
  Lightbulb as SuggestionIcon,
  Add as AddIcon,
  Warning as WarningIcon,
  CheckCircle as SafeIcon,
  Person as PersonIcon,
  Psychology as AIIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  TrendingUp as TrendingIcon,
  Security as SafetyIcon
} from '@mui/icons-material';
import { aiSuggestionsAPI } from '../services/api';

const AIEnhancedSuggestionPanel = ({
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
  const [sortBy, setSortBy] = useState('safety_score');
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const [aiSettings, setAiSettings] = useState({
    usePatientSimilarity: true,
    useDosageOptimization: true,
    useSemanticAnalysis: true,
    useContentFiltering: true
  });
  const [conditionAnalysis, setConditionAnalysis] = useState(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isTyping, setIsTyping] = useState(false);

  const analyzeCondition = useCallback(async () => {
    const term = searchTerm || condition;
    if (!term || term.length < 2) return;
    
    try {
      const response = await aiSuggestionsAPI.analyzeCondition({
        condition: term
      });
      setConditionAnalysis(response.data);
    } catch (err) {
      console.error('Condition analysis error:', err);
    }
  }, [searchTerm]);

  const fetchAISuggestions = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const term = searchTerm || condition;
      
      const response = await aiSuggestionsAPI.getEnhancedSuggestions({
        patient_id: patient.id,
        condition: term,
        excluded_drugs: excludedDrugs,
        max_suggestions: maxSuggestions,
        use_patient_similarity: aiSettings.usePatientSimilarity,
        use_dosage_optimization: aiSettings.useDosageOptimization
      });
      
      let items = response.data.suggestions || [];
      
      // Client-side sorting
      if (sortBy === 'safety_score') {
        items = items.sort((a, b) => (b.safety_score || 0) - (a.safety_score || 0));
      } else if (sortBy === 'name') {
        items = items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } else if (sortBy === 'method') {
        items = items.sort((a, b) => (a.method || '').localeCompare(b.method || ''));
      }
      
      setSuggestions(items);
      
      // Show success snackbar when suggestions are found
      if (items.length > 0) {
        setSnackbar({
          open: true,
          message: `Found ${items.length} AI suggestions!`,
          severity: 'success'
        });
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to fetch AI suggestions';
      setError(errorMessage);
      setSuggestions([]);
      
      // Show error snackbar
      setSnackbar({
        open: true,
        message: `AI Error: ${errorMessage}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [patient, searchTerm, condition, excludedDrugs, maxSuggestions, aiSettings, sortBy]);

  useEffect(() => {
    // Debounce fetch to reduce API calls while typing
    let timeout;
    const term = searchTerm || condition;
    
    if (patient && term && term.length >= 2) {
      setHasSearched(true);
      setIsTyping(true); // Show typing indicator
      timeout = setTimeout(() => {
        console.log('🔍 AI Enhanced: Triggering search after debounce for:', term);
        setIsTyping(false); // Hide typing indicator
        fetchAISuggestions();
        analyzeCondition();
      }, 1000); // Increased debounce for AI processing to wait for complete typing
    } else if (term && term.length < 2) {
      setSuggestions([]);
      setError('');
      setIsTyping(false);
    } else if (!term) {
      setSuggestions([]);
      setError('');
      setHasSearched(false);
      setIsTyping(false);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [patient, searchTerm, condition, excludedDrugs, maxSuggestions, aiSettings]);

  // Immediate test on mount if we have a term
  useEffect(() => {
    const term = searchTerm || condition;
    if (patient && term && term.length >= 2 && !hasSearched) {
      setTimeout(() => {
        fetchAISuggestions();
        analyzeCondition();
      }, 1000);
    }
  }, [patient?.id]); // Only run when patient changes


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
        dosage: suggestion.recommended_dosage_mg 
          ? `${suggestion.recommended_dosage_mg}mg`
          : (suggestion.strength || ''),
        frequency: 'As directed',
        duration: '7 days',
        quantity: '30',
        refills: '0'
      });
      
      // Show success toast
      const drugName = suggestion.drug?.name || suggestion.name || 'Medication';
      setSnackbar({
        open: true,
        message: `AI: ${drugName} added to medication form!`,
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
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'content_based':
        return <SearchIcon />;
      case 'collaborative':
        return <PersonIcon />;
      case 'semantic':
        return <AIIcon />;
      case 'safety_optimized':
        return <SafetyIcon />;
      case 'ensemble':
        return <AIIcon />;
      default:
        return <SuggestionIcon />;
    }
  };

  const getMethodColor = (method) => {
    switch (method) {
      case 'content_based':
        return 'primary';
      case 'collaborative':
        return 'success';
      case 'semantic':
        return 'info';
      case 'safety_optimized':
        return 'warning';
      case 'ensemble':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getSafetyColor = (score) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'warning';
    return 'error';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'severe': return 'error';
      case 'moderate': return 'warning';
      case 'mild': return 'success';
      default: return 'default';
    }
  };

  if (!patient) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Select a patient to get AI-powered medication suggestions
        </Typography>
      </Paper>
    );
  }



  return (
    <Box sx={{ 
      height: '100%', 
      maxHeight: '100%',
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'white',
      borderRadius: 2,
      overflow: 'hidden'
    }}>
      {/* AI Header */}
      <Box sx={{
        bgcolor: '#F7F9FC',
        p: 3,
        borderBottom: '1px solid #E8ECF0',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
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
            <AIIcon sx={{ fontSize: 18, color: 'white' }} />
          </Box>
          <Typography variant="h6" sx={{ 
            fontWeight: 600, 
            color: '#333333',
            fontFamily: 'Inter, sans-serif',
            fontSize: '1.1rem'
          }}>
            AI Suggestions
          </Typography>
          {isTyping && (
            <Chip 
              label="Typing..."
              size="small"
              sx={{
                bgcolor: '#FFC107',
                color: 'white',
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}
            />
          )}
          {suggestions.length > 0 && !isTyping && (
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
          )}
        </Box>
      </Box>


      {/* AI Suggestions Results */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto', 
        display: 'flex', 
        flexDirection: 'column',
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
        
        {/* Loading State */}
        {loading && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            py: 6,
            textAlign: 'center'
          }}>
            <CircularProgress sx={{ color: '#4A90E2', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#333333', mb: 1, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
              AI Analyzing...
            </Typography>
            <Typography variant="body2" sx={{ color: '#6c757d', fontFamily: 'Inter, sans-serif' }}>
              Finding optimal medications for your patient
            </Typography>
          </Box>
        )}

        {/* Error State */}
        {error && (
          <Alert severity="error" sx={{ 
            mb: 2, 
            borderRadius: 2,
            fontFamily: 'Inter, sans-serif'
          }}>
            {error}
          </Alert>
        )}

        {/* Suggestions List */}
        {!loading && suggestions.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {suggestions.map((suggestion, index) => {
              const drug = suggestion.drug || suggestion;
              const safetyScore = suggestion.safety_score || 0;
              
              return (
                <Card key={suggestion.id || index} sx={{
                  bgcolor: 'white',
                  border: '1px solid #E8ECF0',
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(74, 144, 226, 0.15)',
                    borderColor: '#4A90E2'
                  }
                }}>
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
                          {drug.name || suggestion.name || `Suggestion ${index + 1}`}
                        </Typography>
                        {drug.generic_name && (
                          <Typography variant="body2" sx={{ 
                            color: '#6c757d',
                            fontSize: '0.9rem',
                            fontFamily: 'Inter, sans-serif',
                            mb: 0.5
                          }}>
                            {drug.generic_name}
                          </Typography>
                        )}
                        {drug.strength && (
                          <Typography variant="body2" sx={{ 
                            color: '#6c757d',
                            fontSize: '0.9rem',
                            fontFamily: 'Inter, sans-serif'
                          }}>
                            {drug.strength} • {drug.form || 'Tablet'}
                          </Typography>
                        )}
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Chip
                          label={`${Math.round(safetyScore * 100)}% Safe`}
                          size="small"
                          sx={{
                            bgcolor: safetyScore >= 0.8 ? '#00C49F' : safetyScore >= 0.6 ? '#FFC107' : '#D32F2F',
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
              );
            })}
          </Box>
        )}

        {/* Empty State */}
        {!loading && suggestions.length === 0 && !error && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            py: 6,
            textAlign: 'center'
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
              <AIIcon sx={{ fontSize: 32, color: '#6c757d' }} />
            </Box>
            <Typography variant="h6" sx={{ color: '#333333', mb: 1, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
              Ready for AI Analysis
            </Typography>
            <Typography variant="body2" sx={{ color: '#6c757d', fontFamily: 'Inter, sans-serif' }}>
              Enter a condition to get AI-powered suggestions
            </Typography>
          </Box>
        )}

      </Box>

      {/* Warning Dialog */}
      {showWarningDialog && pendingSuggestion && (
        <Alert severity="warning" sx={{ 
          m: 3, 
          borderRadius: 2,
          fontFamily: 'Inter, sans-serif'
        }}>
          <Typography variant="h6" gutterBottom sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
            <WarningIcon sx={{ mr: 1 }} />
            Medication Warning
          </Typography>
          <Typography variant="body2" gutterBottom sx={{ fontFamily: 'Inter, sans-serif' }}>
            This medication has contraindications or safety concerns. Please review carefully before adding to prescription.
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setShowWarningDialog(false);
                setPendingSuggestion(null);
              }}
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
              variant="contained"
              onClick={handleConfirmAddWithWarning}
              sx={{
                bgcolor: '#FFC107',
                color: '#333333',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: '#FFB300'
                }
              }}
            >
              Use Anyway
            </Button>
          </Box>
        </Alert>
      )}
      
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

export default AIEnhancedSuggestionPanel;
