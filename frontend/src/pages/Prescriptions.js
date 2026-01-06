import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Card,
  CardContent,
  Collapse,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Medication as MedicationIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { prescriptionsAPI, patientsAPI, drugsAPI } from '../services/api';

function toISODate(dateStr) {
  // Accepts YYYY-MM-DD or DD-MM-YYYY, returns YYYY-MM-DD
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

const Prescriptions = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [formData, setFormData] = useState({
    patient: '',
    drug: '',
    dosage: '',
    frequency: '',
    duration: '',
    quantity: '',
    refills: '',
    instructions: '',
    prescribed_date: '',
    expiry_date: '',
    status: 'active',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [allergyWarning, setAllergyWarning] = useState('');

  useEffect(() => {
    fetchAll();
    // Optionally, clear prescriptions state on unmount
    return () => setPrescriptions([]);
  }, []);

  useEffect(() => {
    if (!formData.patient || !formData.drug) {
      setAllergyWarning('');
      return;
    }
    const patient = patients.find((p) => p.id === Number(formData.patient));
    const drug = drugs.find((d) => d.id === Number(formData.drug));
    if (patient && drug && patient.allergies && drug.allergy_conflicts) {
      const patientAllergyIds = patient.allergies.map((a) => a.id);
      const conflictAllergies = drug.allergy_conflicts.filter((a) => patientAllergyIds.includes(a.id));
      if (conflictAllergies.length > 0) {
        setAllergyWarning(
          `Warning: Patient is allergic to: ${conflictAllergies.map((a) => a.name).join(', ')}. This drug may cause an allergic reaction.`
        );
      } else {
        setAllergyWarning('');
      }
    } else {
      setAllergyWarning('');
    }
  }, [formData.patient, formData.drug, patients, drugs]);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [presRes, patRes, drugRes] = await Promise.all([
        prescriptionsAPI.getAll(),
        patientsAPI.getAll(),
        drugsAPI.getAll(),
      ]);
      setPrescriptions(presRes.data);
      setPatients(patRes.data);
      setDrugs(drugRes.data);
    } catch (err) {
      setError('Failed to load prescriptions or reference data.');
    } finally {
      setLoading(false);
    }
  };

  const filteredPrescriptions = prescriptions.filter(prescription => {
    const patientName = prescription.patient_details ? `${prescription.patient_details.first_name} ${prescription.patient_details.last_name}`.toLowerCase() : '';
    const medicationNames = prescription.medications ? 
      prescription.medications.map(med => med.drug_details?.name || '').join(' ').toLowerCase() : '';
    return (
      patientName.includes(searchTerm.toLowerCase()) ||
      medicationNames.includes(searchTerm.toLowerCase())
    );
  });

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpenDialog = (prescription = null) => {
    setSelectedPrescription(prescription);
    if (prescription) {
      // Get the first medication's details for editing
      const firstMedication = prescription.medications && prescription.medications.length > 0 
        ? prescription.medications[0] 
        : null;
      
      setFormData({
        patient: prescription.patient,
        drug: firstMedication ? firstMedication.drug : '',
        dosage: firstMedication ? firstMedication.dosage : '',
        frequency: firstMedication ? firstMedication.frequency : '',
        duration: firstMedication ? firstMedication.duration : '',
        quantity: firstMedication ? firstMedication.quantity : '',
        refills: firstMedication ? firstMedication.refills : '',
        instructions: prescription.instructions,
        prescribed_date: prescription.prescribed_date,
        expiry_date: prescription.expiry_date,
        status: prescription.status,
      });
    } else {
      setFormData({
        patient: '',
        drug: '',
        dosage: '',
        frequency: '',
        duration: '',
        quantity: '',
        refills: '',
        instructions: '',
        prescribed_date: '',
        expiry_date: '',
        status: 'active',
      });
    }
    setFormError('');
    setAllergyWarning('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPrescription(null);
    setFormError('');
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setFormError('');
  };

  const handleFormSubmit = async () => {
    setFormLoading(true);
    setFormError('');
    setAllergyWarning('');
    // Frontend validation
    const requiredFields = ['patient', 'drug', 'dosage', 'frequency', 'duration', 'quantity', 'refills', 'prescribed_date', 'expiry_date', 'status'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        setFormError(`Please fill in the ${field.replace('_', ' ')} field.`);
        setFormLoading(false);
        return;
      }
    }
    // Validate date format
    const prescribedDate = toISODate(formData.prescribed_date);
    const expiryDate = toISODate(formData.expiry_date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(prescribedDate) || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      setFormError('Dates must be in YYYY-MM-DD format.');
      setFormLoading(false);
      return;
    }
    try {
      const payload = {
        patient: Number(formData.patient),
        prescribed_date: prescribedDate,
        expiry_date: expiryDate,
        status: formData.status.toLowerCase(),
        instructions: formData.instructions,
        medications: [{
          drug: Number(formData.drug),
          dosage: formData.dosage,
          frequency: formData.frequency,
          duration: formData.duration,
          quantity: Number(formData.quantity),
          refills: Number(formData.refills),
        }]
      };
      
      let response;
      if (selectedPrescription) {
        response = await prescriptionsAPI.update(selectedPrescription.id, payload);
      } else {
        response = await prescriptionsAPI.create(payload);
      }
      // Show backend warning if present
      if (response && response.data && response.data.allergy_warning) {
        setAllergyWarning(response.data.allergy_warning);
      } else {
        setAllergyWarning('');
      }
      fetchAll();
      handleCloseDialog();
    } catch (err) {
      if (err.response && err.response.data) {
        const messages = Object.entries(err.response.data)
          .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
          .join(' ');
        setFormError(messages || 'Failed to save prescription.');
      } else {
        setFormError('Failed to save prescription.');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'active':
        return <Chip label="Active" color="primary" size="small" sx={{ fontWeight: 500 }} />;
      case 'completed':
        return <Chip label="Completed" color="success" size="small" sx={{ fontWeight: 500 }} />;
      case 'cancelled':
        return <Chip label="Cancelled" color="error" size="small" sx={{ fontWeight: 500 }} />;
      case 'expired':
        return <Chip label="Expired" color="warning" size="small" sx={{ fontWeight: 500 }} />;
      default:
        return <Chip label="Active" color="primary" size="small" sx={{ fontWeight: 500 }} />;
    }
  };

  const toggleRowExpansion = (prescriptionId) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(prescriptionId)) {
      newExpandedRows.delete(prescriptionId);
    } else {
      newExpandedRows.add(prescriptionId);
    }
    setExpandedRows(newExpandedRows);
  };

  const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };



  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Prescriptions</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          New Prescription
        </Button>
      </Box>

      <Paper elevation={2}>
        <Box p={3}>
          <Grid container spacing={2} alignItems="center" mb={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search prescriptions by patient or medication..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" gap={1} justifyContent="flex-end">
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  {filteredPrescriptions.length} prescriptions found
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <TableContainer 
            component={Paper} 
            elevation={0}
            sx={{ 
              borderRadius: 3, 
              border: '1px solid #E8ECF0',
              overflow: 'hidden'
            }}
          >
            <Table sx={{ fontFamily: 'Inter, sans-serif' }}>
              <TableHead>
                <TableRow sx={{ 
                  bgcolor: '#F7F9FC',
                  '& .MuiTableCell-head': {
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: '#212529',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #E8ECF0',
                    py: 2
                  }
                }}>
                  <TableCell sx={{ width: '40px' }}></TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Medications</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Prescribed Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell sx={{ width: '120px' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        Loading prescriptions...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#D32F2F' }}>
                      <Typography variant="body1">{error}</Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredPrescriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <MedicationIcon sx={{ fontSize: 48, color: '#E0E0E0', mb: 2 }} />
                        <Typography variant="h6" sx={{ color: '#6c757d', mb: 1 }}>
                          No prescriptions found
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6c757d' }}>
                          Try adjusting your search criteria
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPrescriptions
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((prescription, index) => {
                      const isExpanded = expandedRows.has(prescription.id);
                      const medicationCount = prescription.medications?.length || 0;
                      
                      return (
                        <React.Fragment key={prescription.id}>
                          {/* Primary Row */}
                          <TableRow 
                            sx={{ 
                              bgcolor: index % 2 === 0 ? 'white' : '#F8F9FC',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: '#F0F4FF',
                                transform: 'translateY(-1px)',
                                boxShadow: '0 4px 12px rgba(74, 144, 226, 0.1)'
                              },
                              '& .MuiTableCell-root': {
                                borderBottom: '1px solid #E8ECF0',
                                py: 2,
                                px: 3
                              }
                            }}
                            onClick={() => toggleRowExpansion(prescription.id)}
                          >
                            {/* Expand/Collapse Icon */}
                            <TableCell sx={{ width: '40px', px: 2 }}>
                              <IconButton 
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowExpansion(prescription.id);
                                }}
                                sx={{ 
                                  color: '#4A90E2',
                                  transition: 'transform 0.2s ease',
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                                }}
                              >
                                <ExpandMoreIcon />
                              </IconButton>
                            </TableCell>

                            {/* Patient */}
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PersonIcon sx={{ fontSize: 20, color: '#6c757d' }} />
                                <Typography variant="body1" sx={{ fontWeight: 600, color: '#212529' }}>
                                  {prescription.patient_details 
                                    ? `${prescription.patient_details.first_name} ${prescription.patient_details.last_name}`
                                    : 'Unknown Patient'
                                  }
                                </Typography>
                              </Box>
                            </TableCell>

                            {/* Medications Count */}
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MedicationIcon sx={{ fontSize: 20, color: '#6c757d' }} />
                                <Chip 
                                  label={`${medicationCount} Medication${medicationCount !== 1 ? 's' : ''}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ 
                                    fontWeight: 500,
                                    borderColor: '#4A90E2',
                                    color: '#4A90E2'
                                  }}
                                />
                              </Box>
                            </TableCell>

                            {/* Reason */}
                            <TableCell>
                              <Tooltip title={prescription.reason || 'No reason provided'} arrow>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: '#6c757d',
                                    maxWidth: '200px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {truncateText(prescription.reason || 'No reason provided', 30)}
                                </Typography>
                              </Tooltip>
                            </TableCell>

                            {/* Prescribed Date */}
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CalendarIcon sx={{ fontSize: 16, color: '#6c757d' }} />
                                <Typography variant="body2" sx={{ color: '#6c757d' }}>
                                  {prescription.prescribed_date || 'N/A'}
                                </Typography>
                              </Box>
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              {getStatusChip(prescription.status)}
                            </TableCell>

                            {/* Actions */}
                            <TableCell sx={{ width: '120px' }}>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title="View Prescription Details" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDialog(prescription);
                                    }}
                                    sx={{ color: '#4A90E2' }}
                                  >
                                    <ViewIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit Prescription" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDialog(prescription);
                                    }}
                                    sx={{ color: '#6c757d' }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Row - Medication Details */}
                          <TableRow>
                            <TableCell colSpan={7} sx={{ p: 0, borderBottom: 'none' }}>
                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                <Box sx={{ 
                                  bgcolor: '#FAFBFC',
                                  borderTop: '1px solid #E8ECF0',
                                  borderBottom: '1px solid #E8ECF0'
                                }}>
                                  <Box sx={{ p: 3 }}>
                                    <Typography variant="h6" sx={{ 
                                      fontWeight: 600, 
                                      color: '#212529', 
                                      mb: 2,
                                      fontSize: '1rem'
                                    }}>
                                      Medication Details
                                    </Typography>
                                    
                                    {medicationCount > 0 ? (
                                      <Table size="small">
                                        <TableHead>
                                          <TableRow>
                                            <TableCell sx={{ fontWeight: 600, color: '#212529' }}>Medication</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#212529' }}>Dosage</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#212529' }}>Quantity</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#212529' }}>Refills</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#212529' }}>Instructions</TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {prescription.medications.map((medication, medIndex) => (
                                            <TableRow key={medIndex} sx={{ 
                                              '&:hover': { bgcolor: 'rgba(74, 144, 226, 0.05)' }
                                            }}>
                                              <TableCell>
                                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                  {medication.drug_details?.name || 'Unknown Medication'}
                                                </Typography>
                                              </TableCell>
                                              <TableCell>
                                                <Typography variant="body2" sx={{ color: '#6c757d' }}>
                                                  {medication.dosage || '-'}
                                                </Typography>
                                              </TableCell>
                                              <TableCell>
                                                <Typography variant="body2" sx={{ color: '#6c757d' }}>
                                                  {medication.quantity || '-'}
                                                </Typography>
                                              </TableCell>
                                              <TableCell>
                                                <Typography variant="body2" sx={{ color: '#6c757d' }}>
                                                  {medication.refills || '-'}
                                                </Typography>
                                              </TableCell>
                                              <TableCell>
                                                <Typography variant="body2" sx={{ color: '#6c757d' }}>
                                                  {medication.instructions || '-'}
                                                </Typography>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    ) : (
                                      <Typography variant="body2" sx={{ color: '#6c757d', fontStyle: 'italic' }}>
                                        No medications found for this prescription.
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredPrescriptions.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              '& .MuiTablePagination-toolbar': {
                bgcolor: 'white',
                borderRadius: 2,
                border: '1px solid #E8ECF0',
                mt: 2
              }
            }}
          />
        </Box>
      </Paper>

      {/* Prescription Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedPrescription ? 'Edit Prescription' : 'New Prescription'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Patient</InputLabel>
                <Select
                  label="Patient"
                  name="patient"
                  value={formData.patient}
                  onChange={handleFormChange}
                >
                  {patients.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Medication</InputLabel>
                <Select
                  label="Medication"
                  name="drug"
                  value={formData.drug}
                  onChange={handleFormChange}
                >
                  {drugs.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Dosage"
                name="dosage"
                value={formData.dosage}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Frequency"
                name="frequency"
                value={formData.frequency}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Duration"
                name="duration"
                value={formData.duration}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Quantity"
                name="quantity"
                type="number"
                value={formData.quantity}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Refills"
                name="refills"
                type="number"
                value={formData.refills}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Prescribed Date"
                name="prescribed_date"
                type="date"
                value={formData.prescribed_date}
                onChange={handleFormChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Expiry Date"
                name="expiry_date"
                type="date"
                value={formData.expiry_date}
                onChange={handleFormChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
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
                name="instructions"
                value={formData.instructions}
                onChange={handleFormChange}
                multiline
                rows={3}
                placeholder="Special instructions for the patient..."
              />
            </Grid>
            {allergyWarning && (
              <Grid item xs={12}>
                <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
                  {allergyWarning}
                </Alert>
              </Grid>
            )}
            {formError && (
              <Grid item xs={12}>
                <Typography color="error">{formError}</Typography>
              </Grid>
            )}
            {formData.patient && (() => {
              const patient = patients.find((p) => p.id === Number(formData.patient));
              if (patient && patient.detailed_allergies && patient.detailed_allergies.length > 0) {
                return (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1">Patient Allergies</Typography>
                    {patient.detailed_allergies.map((a) => (
                      <Alert key={a.id} severity="warning" sx={{ mb: 1 }}>
                        <strong>{a.allergy?.name || 'Unknown'}</strong>
                        {a.reaction ? ` — ${a.reaction}` : ''}
                        {a.date_noted ? ` (Noted: ${a.date_noted})` : ''}
                      </Alert>
                    ))}
                  </Box>
                );
              }
              return null;
            })()}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleFormSubmit} disabled={formLoading}>
            {selectedPrescription ? 'Update' : 'Create'} Prescription
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Prescriptions; 