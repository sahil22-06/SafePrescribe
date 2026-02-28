import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel, Select,
  MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, CircularProgress, Avatar, Fab, Container, LinearProgress, Fade, Snackbar,
  Autocomplete, Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  LocalHospital as HospitalIcon,
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { patientsAPI } from '../services/api';
import { formatAppointmentDateTime, formatAppointmentTime } from '../utils/timeUtils';
// Using native HTML datetime-local input with enhanced styling instead of DatePicker
// This avoids compatibility issues with @mui/x-date-pickers

const ReceptionistDashboard = () => {
  const [user, setUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  // Dialog states
  const [patientDialog, setPatientDialog] = useState(false);
  const [appointmentDialog, setAppointmentDialog] = useState(false);

  // Form states
  const [patientForm, setPatientForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    emergency_contact: '',
    medical_history: '',
    blood_group: '',
    weight: '',
    height: '',
    kidney_function: '',
    liver_function: '',
    pregnancy_status: false,
    breastfeeding: false
  });

  const [appointmentForm, setAppointmentForm] = useState({
    patient: '',
    doctor: '',
    appointment_type: 'normal',
    scheduled_time: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
    reason: '',
    priority: 3
  });

  const navigate = useNavigate();

  useEffect(() => {
    // Support both keys: 'user' (used by ReceptionistPortal) and legacy 'userData'
    const rawUser = localStorage.getItem('user') || localStorage.getItem('userData');
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser);
      setUser(parsedUser);
      if (parsedUser.role !== 'receptionist') {
        navigate('/reception-portal');
        return;
      }
    } else {
      navigate('/reception-portal');
      return;
    }

    fetchData();

    // Set up auto-refresh every 30 seconds to show real-time status updates
    const interval = setInterval(() => {
      fetchData(true); // Silent refresh
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [navigate]);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        // For silent refresh, show subtle loading indicator
        setIsRefreshing(true);
        setRefreshProgress(0);
      }

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setRefreshProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      // Fetch appointments
      const appointmentsResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/clinic/appointments/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json();
        setAppointments(appointmentsData.results || appointmentsData);
      }

      // Fetch patients
      const patientsResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/patients/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (patientsResponse.ok) {
        const patientsData = await patientsResponse.json();
        setPatients(patientsData.results || patientsData);
      }

      // Fetch doctors only
      const doctorsResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/users/?role=doctor`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (doctorsResponse.ok) {
        const doctorsData = await doctorsResponse.json();
        const list = doctorsData.results || doctorsData;
        setDoctors(list);
        try {
          const savedId = localStorage.getItem('preferredDoctorId');
          let preferredId = savedId && list.find(d => String(d.id) === String(savedId)) ? savedId : '';
          if (!preferredId) {
            const match = list.find(d => `${(d.first_name || '').toLowerCase()} ${(d.last_name || '').toLowerCase()}`.includes('sahil'));
            if (match) preferredId = String(match.id);
          }
          if (preferredId) {
            setAppointmentForm(prev => ({ ...prev, doctor: preferredId }));
          }
        } catch (_) { }
      }

      // Complete progress
      clearInterval(progressInterval);
      setRefreshProgress(100);

      // Update last updated timestamp
      const updateTime = new Date();
      setLastUpdated(updateTime);

      // Show subtle update notification for silent refreshes
      if (silent) {
        setShowUpdateNotification(true);
        setTimeout(() => setShowUpdateNotification(false), 2000);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      if (!silent) {
        toast.error('Failed to load data');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      } else {
        // Hide subtle loading indicator after a brief delay
        setTimeout(() => {
          setIsRefreshing(false);
          setRefreshProgress(0);
        }, 500);
      }
    }
  };


  const handleCreatePatient = async () => {
    try {
      // Basic client-side validation for required fields
      const requiredFields = [
        { key: 'first_name', label: 'First Name' },
        { key: 'last_name', label: 'Last Name' },
        { key: 'date_of_birth', label: 'Date of Birth' },
        { key: 'gender', label: 'Gender' },
        { key: 'phone', label: 'Phone Number' },
        { key: 'address', label: 'Address' }
      ];

      // Critical medical fields that should be filled for patient safety
      const criticalFields = [
        { key: 'blood_group', label: 'Blood Group' },
        { key: 'weight', label: 'Weight' },
        { key: 'height', label: 'Height' }
      ];
      const missing = requiredFields.filter(f => !String(patientForm[f.key] || '').trim());
      if (missing.length) {
        toast.error(`Please fill: ${missing.map(m => m.label).join(', ')}`);
        return;
      }

      // Check critical medical fields and warn if missing
      const missingCritical = criticalFields.filter(f => !String(patientForm[f.key] || '').trim());
      if (missingCritical.length) {
        const proceed = window.confirm(
          `Warning: Missing critical medical information: ${missingCritical.map(m => m.label).join(', ')}\n\n` +
          'This information is important for safe medication prescribing. Do you want to proceed anyway?'
        );
        if (!proceed) {
          return;
        }
      }

      // Construct payload explicitly and trim strings to avoid empty values
      const payload = {
        first_name: String(patientForm.first_name || '').trim(),
        last_name: String(patientForm.last_name || '').trim(),
        date_of_birth: String(patientForm.date_of_birth || '').trim(),
        gender: String(patientForm.gender || '').trim(),
        phone: String(patientForm.phone || '').trim(),
        email: String(patientForm.email || '').trim() || null,
        address: String(patientForm.address || '').trim(),
        emergency_contact: String(patientForm.emergency_contact || '').trim() || null,
        medical_history: String(patientForm.medical_history || '').trim() || null,
        blood_group: String(patientForm.blood_group || '').trim() || null,
        weight: patientForm.weight ? parseFloat(patientForm.weight) : null,
        height: patientForm.height ? parseFloat(patientForm.height) : null,
        kidney_function: String(patientForm.kidney_function || '').trim() || null,
        liver_function: String(patientForm.liver_function || '').trim() || null,
        pregnancy_status: Boolean(patientForm.pregnancy_status),
        breastfeeding: Boolean(patientForm.breastfeeding),
      };
      console.log('Submitting new patient payload:', payload);
      const response = await patientsAPI.create(payload);

      if (response && response.status >= 200 && response.status < 300) {
        toast.success('Patient created successfully');
        setPatientDialog(false);
        resetPatientForm();
        fetchData();
      } else {
        let message = 'Failed to create patient';
        try {
          const errorData = response?.data;
          console.error('Create patient validation error:', errorData);
          if (typeof errorData === 'object' && errorData) {
            if (errorData.error || errorData.detail) {
              message = errorData.error || errorData.detail;
            } else {
              const firstKey = Object.keys(errorData)[0];
              const firstVal = Array.isArray(errorData[firstKey]) ? errorData[firstKey][0] : String(errorData[firstKey]);
              message = `${firstKey}: ${firstVal}`;
            }
          }
        } catch (_) { }
        toast.error(message);
      }
    } catch (err) {
      console.error('Error creating patient:', err);
      let message = 'Failed to create patient';
      const errorData = err?.response?.data;
      if (errorData) {
        console.error('Create patient error response:', errorData);
        if (errorData.error || errorData.detail) {
          message = errorData.error || errorData.detail;
        } else if (typeof errorData === 'object') {
          const firstKey = Object.keys(errorData)[0];
          const firstVal = Array.isArray(errorData[firstKey]) ? errorData[firstKey][0] : String(errorData[firstKey]);
          message = `${firstKey}: ${firstVal}`;
        }
      }
      toast.error(message);
    }
  };

  const handleCreateAppointment = async () => {
    try {
      const appointmentData = {
        ...appointmentForm,
        patient: parseInt(appointmentForm.patient),
        doctor: parseInt(appointmentForm.doctor),
        priority: parseInt(appointmentForm.priority)
      };

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/clinic/appointments/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(appointmentData)
      });

      if (response.ok) {
        toast.success('Appointment created successfully');
        setAppointmentDialog(false);
        resetAppointmentForm();
        fetchData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to create appointment');
      }
    } catch (err) {
      console.error('Error creating appointment:', err);
      toast.error('Failed to create appointment');
    }
  };

  const resetPatientForm = () => {
    setPatientForm({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      gender: '',
      phone: '',
      email: '',
      address: '',
      emergency_contact: '',
      medical_history: '',
      blood_type: '',
      weight_kg: '',
      height_cm: '',
      kidney_function: '',
      liver_function: '',
      pregnancy_status: false,
      breastfeeding: false
    });
  };

  const resetAppointmentForm = () => {
    setAppointmentForm({
      patient: '',
      doctor: '',
      appointment_type: 'normal',
      scheduled_time: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
      reason: '',
      priority: 3
    });
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
    const colors = {
      1: 'error',    // Emergency
      2: 'warning',  // High Priority
      3: 'primary',  // Normal
      4: 'default'   // Low Priority
    };
    return colors[priority] || 'default';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header moved into ReceptionistLayout */}

      {/* CSS Animation for pulse effect */}
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>

      {/* Subtle Loading Progress Bar */}
      <Fade in={isRefreshing}>
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999
        }}>
          <LinearProgress
            variant="determinate"
            value={refreshProgress}
            sx={{
              height: 3,
              '& .MuiLinearProgress-bar': {
                backgroundColor: 'primary.main'
              }
            }}
          />
        </Box>
      </Fade>

      {/* Enhanced Real-time Status Indicator */}
      <Box sx={{
        position: 'fixed',
        top: 80,
        right: 20,
        zIndex: 1000,
        background: 'rgba(255,255,255,0.95)',
        padding: '8px 12px',
        borderRadius: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <Box sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: isRefreshing ? 'warning.main' : 'success.main',
          animation: isRefreshing ? 'none' : 'pulse 2s infinite'
        }} />
        <Typography variant="caption" color="text.secondary">
          {isRefreshing ? 'Updating...' : `Last updated: ${lastUpdated.toLocaleTimeString()}`}
        </Typography>
        {isRefreshing && (
          <CircularProgress size={12} sx={{ ml: 1 }} />
        )}
      </Box>

      {/* Subtle Update Notification */}
      <Snackbar
        open={showUpdateNotification}
        autoHideDuration={2000}
        onClose={() => setShowUpdateNotification(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Box sx={{
          background: 'rgba(76, 175, 80, 0.9)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          backdropFilter: 'blur(10px)'
        }}>
          <CheckCircleIcon fontSize="small" />
          <Typography variant="body2">
            Data updated successfully
          </Typography>
        </Box>
      </Snackbar>

      <Container maxWidth="xl">
        <Grid container spacing={3}>
          {/* Quick Stats */}
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <ScheduleIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {appointments.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Appointments
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <PersonIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {patients.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Patients
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <HospitalIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {doctors.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Available Doctors
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <AssignmentIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {appointments.filter(a => a.status === 'scheduled').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Scheduled Today
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Appointments */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" fontWeight="bold">
                  Recent Appointments
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setAppointmentDialog(true)}
                >
                  Book Appointment
                </Button>
              </Box>

              {appointments.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <ScheduleIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    No appointments found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Book your first appointment to get started
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Patient</TableCell>
                        <TableCell>Doctor</TableCell>
                        <TableCell>Scheduled Time</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Priority</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {appointments.slice(0, 10).map((appointment) => (
                        <TableRow key={appointment.id}>
                          <TableCell>{appointment.patient_name}</TableCell>
                          <TableCell>{appointment.doctor_name}</TableCell>
                          <TableCell>
                            {formatAppointmentDateTime(appointment.scheduled_time)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={appointment.status.replace('_', ' ').toUpperCase()}
                              size="small"
                              color={getStatusColor(appointment.status)}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={`Priority ${appointment.priority}`}
                              size="small"
                              color={getPriorityColor(appointment.priority)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 2 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
                Quick Actions
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<PersonIcon />}
                  onClick={() => setPatientDialog(true)}
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  Register New Patient
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<ScheduleIcon />}
                  onClick={() => setAppointmentDialog(true)}
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  Book Appointment
                </Button>

                <Button
                  variant="outlined"
                  startIcon={isRefreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
                  onClick={() => fetchData(true)} // Use silent refresh for manual refresh too
                  disabled={isRefreshing}
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  Refresh Data
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
        onClick={() => setAppointmentDialog(true)}
      >
        <AddIcon />
      </Fab>

      {/* Patient Registration Dialog */}
      <Dialog open={patientDialog} onClose={() => setPatientDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Register New Patient</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={patientForm.first_name}
                onChange={(e) => setPatientForm({ ...patientForm, first_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={patientForm.last_name}
                onChange={(e) => setPatientForm({ ...patientForm, last_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date of Birth"
                type="date"
                value={patientForm.date_of_birth}
                onChange={(e) => setPatientForm({ ...patientForm, date_of_birth: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Gender</InputLabel>
                <Select
                  value={patientForm.gender}
                  onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}
                  label="Gender"
                >
                  <MenuItem value="M">Male</MenuItem>
                  <MenuItem value="F">Female</MenuItem>
                  <MenuItem value="O">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                value={patientForm.phone}
                onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value.slice(0, 15) })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={patientForm.email}
                onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={2}
                value={patientForm.address}
                onChange={(e) => setPatientForm({ ...patientForm, address: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Emergency Contact"
                value={patientForm.emergency_contact}
                onChange={(e) => setPatientForm({ ...patientForm, emergency_contact: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Medical History"
                multiline
                rows={3}
                value={patientForm.medical_history}
                onChange={(e) => setPatientForm({ ...patientForm, medical_history: e.target.value })}
                placeholder="Any relevant medical history, allergies, or conditions..."
              />
            </Grid>

            {/* Medical Information Section */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 3, mb: 2, color: 'primary.main', fontWeight: 600 }}>
                Medical Information
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Blood Group</InputLabel>
                <Select
                  value={patientForm.blood_group}
                  onChange={(e) => setPatientForm({ ...patientForm, blood_group: e.target.value })}
                  label="Blood Group"
                >
                  <MenuItem value="">Select Blood Group</MenuItem>
                  <MenuItem value="A+">A+</MenuItem>
                  <MenuItem value="A-">A-</MenuItem>
                  <MenuItem value="B+">B+</MenuItem>
                  <MenuItem value="B-">B-</MenuItem>
                  <MenuItem value="AB+">AB+</MenuItem>
                  <MenuItem value="AB-">AB-</MenuItem>
                  <MenuItem value="O+">O+</MenuItem>
                  <MenuItem value="O-">O-</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Kidney Function"
                value={patientForm.kidney_function}
                onChange={(e) => setPatientForm({ ...patientForm, kidney_function: e.target.value })}
                placeholder="e.g., Normal, Mild impairment, Severe impairment"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Liver Function"
                value={patientForm.liver_function}
                onChange={(e) => setPatientForm({ ...patientForm, liver_function: e.target.value })}
                placeholder="e.g., Normal, Mild impairment, Severe impairment"
              />
            </Grid>

            {/* Physical Measurements Section */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 3, mb: 2, color: 'primary.main', fontWeight: 600 }}>
                Physical Measurements
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Weight (kg)"
                type="number"
                value={patientForm.weight}
                onChange={(e) => setPatientForm({ ...patientForm, weight: e.target.value })}
                inputProps={{ step: 0.1, min: 0, max: 500 }}
                placeholder="e.g., 70.5"
                helperText="Weight in kilograms"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Height (cm)"
                type="number"
                value={patientForm.height}
                onChange={(e) => setPatientForm({ ...patientForm, height: e.target.value })}
                inputProps={{ step: 0.1, min: 0, max: 300 }}
                placeholder="e.g., 175.0"
                helperText="Height in centimeters"
              />
            </Grid>

            {/* BMI Calculation Display */}
            {patientForm.height && patientForm.weight && (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>BMI:</strong> {(() => {
                      const heightM = parseFloat(patientForm.height) / 100;
                      const weightKg = parseFloat(patientForm.weight);
                      const bmi = (weightKg / (heightM * heightM)).toFixed(1);
                      let category = '';
                      if (bmi < 18.5) category = 'Underweight';
                      else if (bmi < 25) category = 'Normal weight';
                      else if (bmi < 30) category = 'Overweight';
                      else category = 'Obese';
                      return `${bmi} (${category})`;
                    })()}
                  </Typography>
                </Alert>
              </Grid>
            )}

            {/* Pregnancy/Breastfeeding Status Section */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 3, mb: 2, color: 'primary.main', fontWeight: 600 }}>
                Pregnancy & Breastfeeding Status
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl component="fieldset">
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Is the patient pregnant?
                </Typography>
                <Select
                  value={patientForm.pregnancy_status}
                  onChange={(e) => setPatientForm({ ...patientForm, pregnancy_status: e.target.value === 'true' })}
                  label="Pregnancy Status"
                >
                  <MenuItem value={false}>No</MenuItem>
                  <MenuItem value={true}>Yes</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl component="fieldset">
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Is the patient breastfeeding?
                </Typography>
                <Select
                  value={patientForm.breastfeeding}
                  onChange={(e) => setPatientForm({ ...patientForm, breastfeeding: e.target.value === 'true' })}
                  label="Breastfeeding Status"
                >
                  <MenuItem value={false}>No</MenuItem>
                  <MenuItem value={true}>Yes</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPatientDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreatePatient}>
            Register Patient
          </Button>
        </DialogActions>
      </Dialog>

      {/* Appointment Booking Dialog */}
      <Dialog open={appointmentDialog} onClose={() => setAppointmentDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Book New Appointment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                options={patients}
                getOptionLabel={(option) => `${option.first_name} ${option.last_name}`}
                value={patients.find(p => p.id === appointmentForm.patient) || null}
                onChange={(event, newValue) => {
                  setAppointmentForm({ ...appointmentForm, patient: newValue ? newValue.id : '' });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Patient"
                    required
                    placeholder="Search for a patient..."
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                        {option.first_name?.[0]}{option.last_name?.[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="body1">
                          {option.first_name} {option.last_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.phone}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
                noOptionsText="No patients found"
                isOptionEqualToValue={(option, value) => option.id === value?.id}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Doctor</InputLabel>
                <Select
                  value={appointmentForm.doctor}
                  onChange={(e) => {
                    setAppointmentForm({ ...appointmentForm, doctor: e.target.value });
                    try { localStorage.setItem('preferredDoctorId', String(e.target.value)); } catch (_) { }
                  }}
                  label="Doctor"
                >
                  {doctors.map((doctor) => {
                    const label = doctor.username || `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim();
                    return (
                      <MenuItem key={doctor.id} value={doctor.id}>
                        {label}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Scheduled Time"
                type="datetime-local"
                value={appointmentForm.scheduled_time}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, scheduled_time: e.target.value })}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: dayjs().format('YYYY-MM-DDTHH:mm'),
                  step: 900 // 15-minute intervals
                }}
                helperText="Select a future date and time (15-minute intervals)"
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'primary.main',
                    },
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Appointment Type</InputLabel>
                <Select
                  value={appointmentForm.appointment_type}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_type: e.target.value })}
                  label="Appointment Type"
                >
                  <MenuItem value="normal">Normal Consultation</MenuItem>
                  <MenuItem value="emergency">Emergency</MenuItem>
                  <MenuItem value="follow_up">Follow-up</MenuItem>
                  <MenuItem value="checkup">Routine Checkup</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={appointmentForm.priority}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, priority: e.target.value })}
                  label="Priority"
                >
                  <MenuItem value={1}>Emergency</MenuItem>
                  <MenuItem value={2}>High Priority</MenuItem>
                  <MenuItem value={3}>Normal</MenuItem>
                  <MenuItem value={4}>Low Priority</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reason for Visit"
                multiline
                rows={3}
                value={appointmentForm.reason}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, reason: e.target.value })}
                placeholder="Describe the reason for the appointment..."
                required
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAppointmentDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateAppointment}>
            Book Appointment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReceptionistDashboard;
