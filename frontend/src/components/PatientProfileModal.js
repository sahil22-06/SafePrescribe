import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, 
  Grid, Card, CardContent, Chip, Avatar, Divider, Button, IconButton,
  List, ListItem, ListItemText, ListItemIcon, Badge, Alert, CircularProgress,
  Tabs, Tab, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Stack
} from '@mui/material';
import {
  Person as PersonIcon, MedicalServices as MedicalIcon, 
  LocalHospital as HospitalIcon, Phone as PhoneIcon, Email as EmailIcon,
  LocationOn as LocationIcon, CalendarToday as CalendarIcon,
  Warning as WarningIcon, CheckCircle as CheckCircleIcon,
  Close as CloseIcon, History as HistoryIcon, Medication as MedicationIcon,
  Assignment as AssignmentIcon, Timeline as TimelineIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import api from '../services/api';

const PatientProfileModal = ({ open, onClose, appointment, onStatusUpdate }) => {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [patientHistory, setPatientHistory] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  useEffect(() => {
    if (open && appointment?.patient) {
      fetchPatientDetails();
      fetchPatientHistory();
      fetchPrescriptions();
    }
  }, [open, appointment]);

  // Early return if no appointment data
  if (!appointment) {
    return null;
  }

  const fetchPatientDetails = async () => {
    if (!appointment?.patient) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/patients/${appointment.patient}/`);
      setPatient(response.data);
    } catch (error) {
      console.error('Error fetching patient details:', error);
      toast.error('Failed to load patient details');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientHistory = async () => {
    if (!appointment?.patient) return;
    
    try {
      const response = await api.get(`/patients/${appointment.patient}/appointments/`);
      setPatientHistory(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching patient history:', error);
    }
  };

  const fetchPrescriptions = async () => {
    if (!appointment?.patient) return;
    
    try {
      const response = await api.get(`/prescriptions/?patient=${appointment.patient}`);
      setPrescriptions(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    }
  };

  const calculateAge = (dateOfBirth) => {
    return dayjs().diff(dayjs(dateOfBirth), 'year');
  };

  const getStatusColor = (status) => {
    const colors = {
      'scheduled': 'primary',
      'waiting': 'warning', 
      'in_progress': 'info',
      'completed': 'success',
      'cancelled': 'error',
      'no_show': 'default'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = { 1: 'error', 2: 'warning', 3: 'primary', 4: 'default' };
    return colors[priority] || 'default';
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!appointment?.id) return;
    
    try {
      await api.post(`/clinic/appointments/${appointment.id}/status/`, { 
        status: newStatus 
      });
      toast.success(`Appointment status updated to ${newStatus.replace('_', ' ')}`);
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update appointment status');
    }
  };

  const handleAddNotes = async (notes) => {
    if (!appointment?.id) return;
    
    try {
      await api.patch(`/clinic/appointments/${appointment.id}/`, { notes });
      toast.success('Notes added successfully');
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (error) {
      console.error('Error adding notes:', error);
      toast.error('Failed to add notes');
    }
  };

  // CriticalInfoSection component for displaying vital safety information
  const CriticalInfoSection = ({ patient }) => {
    const hasAllergies = patient?.detailed_allergies && patient.detailed_allergies.length > 0;
    const hasCriticalConditions = patient?.kidney_function || patient?.liver_function || patient?.pregnancy_status;
    const hasBloodType = patient?.blood_type;
    
    // Show "No Critical Information" if no critical info exists
    if (!hasAllergies && !hasCriticalConditions && !hasBloodType) {
      return (
        <Box sx={{ mb: 3 }}>
          <Alert 
            severity="success" 
            icon={<CheckCircleIcon />}
            sx={{ borderRadius: 2 }}
          >
            <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'success.dark' }}>
              ✅ No Critical Safety Information
            </Typography>
            <Typography variant="body2" sx={{ color: 'success.dark' }}>
              No allergies, critical conditions, or special medical considerations recorded.
            </Typography>
          </Alert>
        </Box>
      );
    }

    return (
      <Box sx={{ mb: 3 }}>
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ 
            borderRadius: 2,
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
        >
          <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ color: 'warning.dark' }}>
            🚨 Critical Safety Information
          </Typography>
          
          <Stack spacing={2}>
            {/* Allergies Section */}
            {hasAllergies && (
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color: 'error.main' }}>
                  ⚠️ ALLERGIES - CRITICAL:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {patient.detailed_allergies.map((allergy, index) => (
                    <Chip
                      key={index}
                      label={`${allergy.allergen} (${allergy.severity})`}
                      color="error"
                      variant="filled"
                      size="small"
                      icon={<WarningIcon />}
                      sx={{ 
                        fontWeight: 'bold',
                        '& .MuiChip-label': {
                          fontSize: '0.8rem'
                        }
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Blood Type */}
            {hasBloodType && (
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color: 'info.main' }}>
                  🩸 Blood Type:
                </Typography>
                <Chip
                  label={patient.blood_type}
                  color="info"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>
            )}

            {/* Critical Medical Conditions */}
            {hasCriticalConditions && (
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color: 'warning.dark' }}>
                  🏥 Critical Medical Conditions:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {patient.kidney_function && (
                    <Chip
                      label={`Kidney: ${patient.kidney_function}`}
                      color="warning"
                      variant="outlined"
                      size="small"
                      icon={<MedicalIcon />}
                    />
                  )}
                  {patient.liver_function && (
                    <Chip
                      label={`Liver: ${patient.liver_function}`}
                      color="warning"
                      variant="outlined"
                      size="small"
                      icon={<MedicalIcon />}
                    />
                  )}
                  {patient.pregnancy_status && (
                    <Chip
                      label={`Pregnancy: ${patient.pregnancy_status}`}
                      color="warning"
                      variant="outlined"
                      size="small"
                      icon={<MedicalIcon />}
                    />
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        </Alert>
      </Box>
    );
  };

  if (!patient) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  const TabPanel = ({ children, value, index, ...other }) => (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          height: '90vh',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
            <PersonIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {patient.first_name} {patient.last_name}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Patient Profile & Medical History
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ 
        p: 0, 
        flex: 1, 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Critical Safety Information - Always at the top */}
        <Box sx={{ p: 3, pb: 0 }}>
          <CriticalInfoSection patient={patient} />
        </Box>

        {/* Patient Overview */}
        <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 64, height: 64 }}>
                      {patient.first_name?.[0]}{patient.last_name?.[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        {patient.first_name} {patient.last_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {calculateAge(patient.date_of_birth)} years old
                      </Typography>
                      <Chip 
                        label={patient.gender} 
                        size="small" 
                        color="primary" 
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PhoneIcon fontSize="small" color="action" />
                      <Typography variant="body2">{patient.phone_number}</Typography>
                    </Box>
                    {patient.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon fontSize="small" color="action" />
                        <Typography variant="body2">{patient.email}</Typography>
                      </Box>
                    )}
                    {patient.address && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocationIcon fontSize="small" color="action" />
                        <Typography variant="body2">{patient.address}</Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={8}>
              <Grid container spacing={2}>
                {/* Current Appointment */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Current Appointment
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Date & Time</Typography>
                          <Typography variant="body1">
                            {appointment.scheduled_time ? dayjs(appointment.scheduled_time).format('MMM DD, YYYY HH:mm') : 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Status</Typography>
                          <Chip 
                            label={appointment.status?.replace('_', ' ').toUpperCase() || 'N/A'}
                            color={getStatusColor(appointment.status)}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Type</Typography>
                          <Typography variant="body1">
                            {appointment.appointment_type?.replace('_', ' ') || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Priority</Typography>
                          <Chip 
                            label={`Priority ${appointment.priority || 'N/A'}`}
                            color={getPriorityColor(appointment.priority)}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">Reason</Typography>
                          <Typography variant="body1">{appointment.reason || 'N/A'}</Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Quick Actions */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Quick Actions
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {appointment.status === 'scheduled' && (
                          <Button
                            variant="contained"
                            color="warning"
                            onClick={() => handleStatusUpdate('waiting')}
                            startIcon={<TimelineIcon />}
                          >
                            Mark as Waiting
                          </Button>
                        )}
                        {appointment.status === 'waiting' && (
                          <Button
                            variant="contained"
                            color="info"
                            onClick={() => handleStatusUpdate('in_progress')}
                            startIcon={<MedicalIcon />}
                          >
                            Start Consultation
                          </Button>
                        )}
                        {appointment.status === 'in_progress' && (
                          <Button
                            variant="contained"
                            color="success"
                            onClick={() => handleStatusUpdate('completed')}
                            startIcon={<CheckCircleIcon />}
                          >
                            Complete Consultation
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Box>

        {/* Tabs for detailed information */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="Medical History" icon={<HistoryIcon />} />
            <Tab label="Appointment History" icon={<CalendarIcon />} />
            <Tab label="Prescriptions" icon={<MedicationIcon />} />
            <Tab label="Allergies & Conditions" icon={<WarningIcon />} />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Medical History
                  </Typography>
                  {patient.medical_history ? (
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {patient.medical_history}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No medical history recorded
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Health Information
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <CalendarIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Date of Birth" 
                        secondary={dayjs(patient.date_of_birth).format('MMM DD, YYYY')}
                      />
                    </ListItem>
                    {patient.blood_type && (
                      <ListItem>
                        <ListItemIcon>
                          <MedicalIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Blood Type" 
                          secondary={patient.blood_type}
                        />
                      </ListItem>
                    )}
                    {patient.emergency_contact && (
                      <ListItem>
                        <ListItemIcon>
                          <PhoneIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Emergency Contact" 
                          secondary={patient.emergency_contact}
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Appointment History
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Doctor</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {patientHistory.map((apt) => (
                      <TableRow key={apt.id}>
                        <TableCell>
                          {dayjs(apt.scheduled_time).format('MMM DD, YYYY')}
                        </TableCell>
                        <TableCell>{apt.doctor_name}</TableCell>
                        <TableCell>{apt.appointment_type?.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <Chip 
                            label={apt.status.replace('_', ' ')}
                            color={getStatusColor(apt.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{apt.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Prescription History
              </Typography>
              {prescriptions.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Medication</TableCell>
                        <TableCell>Dosage</TableCell>
                        <TableCell>Instructions</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {prescriptions.map((prescription) => (
                        <TableRow key={prescription.id}>
                          <TableCell>
                            {dayjs(prescription.created_at).format('MMM DD, YYYY')}
                          </TableCell>
                          <TableCell>{prescription.medication_name}</TableCell>
                          <TableCell>{prescription.dosage}</TableCell>
                          <TableCell>{prescription.instructions}</TableCell>
                          <TableCell>
                            <Chip 
                              label={prescription.status || 'Active'}
                              color="success"
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No prescriptions found
                </Typography>
              )}
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Allergies
                  </Typography>
                  {patient.detailed_allergies && patient.detailed_allergies.length > 0 ? (
                    <List>
                      {patient.detailed_allergies.map((allergy, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <WarningIcon color="error" />
                          </ListItemIcon>
                          <ListItemText 
                            primary={allergy.allergen}
                            secondary={`Severity: ${allergy.severity}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No allergies recorded
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Current Conditions
                  </Typography>
                  <List>
                    {patient.kidney_function && (
                      <ListItem>
                        <ListItemIcon>
                          <MedicalIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Kidney Function" 
                          secondary={patient.kidney_function}
                        />
                      </ListItem>
                    )}
                    {patient.liver_function && (
                      <ListItem>
                        <ListItemIcon>
                          <MedicalIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Liver Function" 
                          secondary={patient.liver_function}
                        />
                      </ListItem>
                    )}
                    {patient.pregnancy_status && (
                      <ListItem>
                        <ListItemIcon>
                          <MedicalIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Pregnancy Status" 
                          secondary={patient.pregnancy_status}
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ 
        p: 3, 
        flexShrink: 0,
        mt: 'auto'
      }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        <Button 
          variant="contained" 
          onClick={() => {
            // Open notes dialog or prescription dialog
            toast.info('Notes and prescription functionality coming soon');
          }}
        >
          Add Notes & Prescription
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PatientProfileModal;
