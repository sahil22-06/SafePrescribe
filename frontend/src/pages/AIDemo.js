import React, { useState } from 'react';
import {
  Box, Container, Typography, Paper, Button, TextField,
  Card, CardContent, Chip, Alert, CircularProgress,
  Grid, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import {
  Psychology as AIIcon,
  SmartToy as MLIcon,
  TrendingUp as TrendingIcon,
  Security as SafetyIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { aiSuggestionsAPI } from '../services/api';

const AIDemo = () => {
  const [condition, setCondition] = useState('');
  const [patientId, setPatientId] = useState(1);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const testConditions = [
    "severe headache with nausea",
    "chronic back pain with muscle spasms",
    "mild anxiety with sleep disturbances",
    "acute bacterial infection with fever",
    "diabetes management",
    "hypertension control"
  ];

  const testAIFeatures = async () => {
    if (!condition.trim()) {
      setError('Please enter a condition to analyze');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);

    try {
      // Test condition analysis
      const analysisResponse = await aiSuggestionsAPI.analyzeCondition({
        condition: condition
      });

      // Test AI suggestions
      const suggestionsResponse = await aiSuggestionsAPI.getEnhancedSuggestions({
        patient_id: patientId,
        condition: condition,
        max_suggestions: 5,
        use_patient_similarity: true,
        use_dosage_optimization: true
      });

      setResults({
        analysis: analysisResponse.data,
        suggestions: suggestionsResponse.data
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to test AI features. Make sure you are logged in.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'severe': return 'error';
      case 'moderate': return 'warning';
      case 'mild': return 'success';
      default: return 'default';
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'content_based': return <SearchIcon />;
      case 'collaborative': return <TrendingIcon />;
      case 'semantic': return <AIIcon />;
      case 'safety_optimized': return <SafetyIcon />;
      case 'ensemble': return <MLIcon />;
      default: return <AIIcon />;
    }
  };

  const getMethodColor = (method) => {
    switch (method) {
      case 'content_based': return 'primary';
      case 'collaborative': return 'success';
      case 'semantic': return 'info';
      case 'safety_optimized': return 'warning';
      case 'ensemble': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <AIIcon sx={{ fontSize: 48, color: 'primary.main' }} />
          AI-Powered Medication Suggestions
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
          Experience the power of machine learning in medical decision support
        </Typography>
      </Box>

      {/* Test Interface */}
      <Paper sx={{ p: 4, mb: 4 }}>
        <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <MLIcon color="primary" />
          Test AI Features
        </Typography>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Medical Condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="e.g., severe headache with nausea"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Patient ID"
              type="number"
              value={patientId}
              onChange={(e) => setPatientId(Number(e.target.value))}
              variant="outlined"
            />
          </Grid>
        </Grid>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Quick Test Conditions:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {testConditions.map((testCondition, index) => (
              <Chip
                key={index}
                label={testCondition}
                onClick={() => setCondition(testCondition)}
                variant="outlined"
                size="small"
              />
            ))}
          </Box>
        </Box>

        <Button
          variant="contained"
          size="large"
          onClick={testAIFeatures}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <AIIcon />}
          sx={{ mb: 2 }}
        >
          {loading ? 'Analyzing...' : 'Test AI Analysis'}
        </Button>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {/* Results */}
      {results && (
        <Box>
          {/* Condition Analysis Results */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AIIcon color="primary" />
              Condition Analysis Results
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      Severity
                    </Typography>
                    <Chip
                      label={results.analysis.severity_assessment}
                      color={getSeverityColor(results.analysis.severity_assessment)}
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      Category
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {results.analysis.suggested_categories}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      Symptoms
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {results.analysis.extracted_symptoms.length} detected
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      Sentiment Score
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {results.analysis.sentiment_score?.toFixed(2) || 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {results.analysis.extracted_symptoms.length > 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Detected Symptoms:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {results.analysis.extracted_symptoms.map((symptom, index) => (
                    <Chip key={index} label={symptom} color="info" size="small" />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>

          {/* AI Suggestions Results */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingIcon color="primary" />
              AI-Enhanced Suggestions ({results.suggestions.suggestions?.length || 0})
            </Typography>

            {results.suggestions.suggestions?.length > 0 ? (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  AI Methods Used: {results.suggestions.ai_methods_used?.join(', ') || 'N/A'}
                </Typography>

                {results.suggestions.suggestions.map((suggestion, index) => (
                  <Card key={suggestion.id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            {suggestion.name}
                            {suggestion.methods_used && suggestion.methods_used.length > 1 && (
                              <Chip
                                label={`${suggestion.methods_used.length} methods`}
                                size="small"
                                color="secondary"
                              />
                            )}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {suggestion.generic_name} • {suggestion.strength} • {suggestion.form}
                          </Typography>
                          {suggestion.therapeutic_class && (
                            <Chip
                              label={suggestion.therapeutic_class}
                              size="small"
                              sx={{ mb: 1 }}
                            />
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip
                              icon={getMethodIcon(suggestion.method)}
                              label={suggestion.method.replace('_', ' ').toUpperCase()}
                              color={getMethodColor(suggestion.method)}
                              size="small"
                            />
                            <Chip
                              label={`${Math.round(suggestion.safety_score * 100)}%`}
                              color={suggestion.safety_score > 0.8 ? 'success' : suggestion.safety_score > 0.6 ? 'warning' : 'error'}
                              size="small"
                            />
                          </Box>
                        </Box>
                      </Box>

                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="body2">
                            <strong>AI Analysis:</strong> {suggestion.reasoning}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {suggestion.dosage_reasoning && (
                              <Typography variant="body2">
                                <strong>Dosage Optimization:</strong> {suggestion.dosage_reasoning}
                              </Typography>
                            )}
                            {suggestion.recommended_dosage_mg && (
                              <Typography variant="body2">
                                <strong>Recommended Dosage:</strong> {suggestion.recommended_dosage_mg}mg
                              </Typography>
                            )}
                            {suggestion.methods_used && suggestion.methods_used.length > 1 && (
                              <Typography variant="body2">
                                <strong>AI Methods Used:</strong> {suggestion.methods_used.join(', ')}
                              </Typography>
                            )}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <Alert severity="info">
                No AI suggestions found for this condition.
              </Alert>
            )}
          </Paper>
        </Box>
      )}

      {/* Feature Overview */}
      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>
          AI Features Overview
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <SearchIcon color="primary" />
                  <Typography variant="h6">Content-Based Filtering</Typography>
                </Box>
                <Typography variant="body2">
                  Uses TF-IDF vectorization to analyze drug descriptions and match them with medical conditions.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <TrendingIcon color="primary" />
                  <Typography variant="h6">Collaborative Filtering</Typography>
                </Box>
                <Typography variant="body2">
                  Finds similar patients and recommends medications based on successful treatment patterns.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <SafetyIcon color="primary" />
                  <Typography variant="h6">Safety Optimization</Typography>
                </Box>
                <Typography variant="body2">
                  Advanced risk assessment considering patient demographics, medical history, and drug interactions.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default AIDemo;
