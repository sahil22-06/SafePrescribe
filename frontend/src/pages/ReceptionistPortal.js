import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent,
  CircularProgress, Alert, Snackbar, IconButton, Button,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Autocomplete,
  RadioGroup, FormControlLabel, Radio, Tooltip, Skeleton,
  Fade, Zoom
} from '@mui/material';
import {
  LocalHospital as ClinicIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon,
  PersonAdd as PersonAddIcon,
  EventAvailable as EventAvailableIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Cancel as CancelIcon,
  PlayArrow as OngoingIcon,
  AccessTime as AccessTimeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIconAlt,
  Person as PersonIcon,
  LocalHospital as LocalHospitalIcon,
  CalendarToday as CalendarTodayIcon
} from '@mui/icons-material';
import { clinicAPI } from '../services/clinicApi';
import { patientsAPI, authAPI } from '../services/api';

const ReceptionistPortal = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [selectedStatFilter, setSelectedStatFilter] = useState(null);
  
  // Modal states
  const [bookAppointmentOpen, setBookAppointmentOpen] = useState(false);
  const [registerPatientOpen, setRegisterPatientOpen] = useState(false);
  
  // Booking form state
  const [bookingForm, setBookingForm] = useState({
    patient: null,
    doctor: '',
    scheduled_time: '',
    reason: '',
    priority: 3,
    appointment_type: 'normal'
  });
  const [bookingLoading, setBookingLoading] = useState(false);

  // Patient registration form state
  const [patientForm, setPatientForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    medical_history: '',
    blood_group: '',
    height: '',
    weight: '',
    detailed_allergies: [],
  });
  const [patientFormError, setPatientFormError] = useState('');
  const [patientFormLoading, setPatientFormLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData(true); // Silent refresh
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      
      const [statsRes, appointmentsRes, patientsRes, doctorsRes] = await Promise.all([
        clinicAPI.getDashboardStats(),
        clinicAPI.getAppointments({ scheduled_time__date: new Date().toISOString().split('T')[0] }),
        patientsAPI.getAll(),
        authAPI.getDoctors()
      ]);
      
      setDashboardStats(statsRes.data);
      setAppointments(appointmentsRes.data.results || appointmentsRes.data);
      setPatients(patientsRes.data.results || patientsRes.data);
      setDoctors(doctorsRes.data); // Now using actual doctors from API
      setError('');
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      if (!silent) {
        if (err.response?.status === 401) {
          setError('Please log in to access the receptionist portal');
        } else if (err.response?.status === 500) {
          setError('Server error. Please try again or contact support.');
        } else {
          setError('Failed to load dashboard data');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = () => {
    setToast({ open: false, message: '', severity: 'success' });
  };

  // Patient registration handlers
  const handlePatientFormChange = (field, value) => {
    setPatientForm(prev => ({
      ...prev,
      [field]: value
    }));
    setPatientFormError(''); // Clear error when user starts typing
  };

  const handleClosePatientModal = () => {
    setRegisterPatientOpen(false);
    setPatientForm({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      gender: '',
      phone: '',
      email: '',
      address: '',
      medical_history: '',
      blood_group: '',
      height: '',
      weight: '',
      detailed_allergies: [],
    });
    setPatientFormError('');
  };

  const handleRegisterPatient = async () => {
    setPatientFormLoading(true);
    setPatientFormError('');

    try {
      // Validate required fields
      const requiredFields = ['first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'address'];
      const missingFields = requiredFields.filter(field => !patientForm[field]);
      
      if (missingFields.length > 0) {
        setPatientFormError(`Please fill in all required fields: ${missingFields.join(', ')}`);
        return;
      }

      // Prepare payload
      const payload = {
        first_name: patientForm.first_name.trim(),
        last_name: patientForm.last_name.trim(),
        date_of_birth: patientForm.date_of_birth,
        gender: patientForm.gender,
        phone: patientForm.phone.trim(),
        email: patientForm.email.trim() || null,
        address: patientForm.address.trim(),
        medical_history: patientForm.medical_history.trim() || null,
        blood_group: patientForm.blood_group || null,
        height: patientForm.height ? parseFloat(patientForm.height) : null,
        weight: patientForm.weight ? parseFloat(patientForm.weight) : null,
        detailed_allergies: patientForm.detailed_allergies || [],
      };

      console.log('Creating patient with payload:', payload);

      // Create patient
      const response = await patientsAPI.create(payload);
      console.log('Patient created successfully:', response.data);

      // Show success message
      setToast({
        open: true,
        message: 'Patient registered successfully!',
        severity: 'success'
      });

      // Close modal and reset form
      handleClosePatientModal();

      // Refresh patients list
      const patientsRes = await patientsAPI.getAll();
      setPatients(patientsRes.data.results || patientsRes.data);

    } catch (err) {
      console.error('Failed to register patient:', err);
      setPatientFormError(err.response?.data?.detail || 'Failed to register patient. Please try again.');
    } finally {
      setPatientFormLoading(false);
    }
  };

  const handleStatCardClick = (statType) => {
    setSelectedStatFilter(statType);
    // Filter appointments based on clicked stat
    // This will be implemented in the table filtering logic
  };


  const handleCheckIn = async (appointmentId) => {
    try {
      // The backend check_in action handles both checking in and adding to queue
      await clinicAPI.checkInAppointment(appointmentId);
      
      showToast('Patient checked in and added to doctor queue!', 'success');
      fetchDashboardData(true); // Silent refresh
    } catch (err) {
      console.error('Check-in error:', err);
      showToast('Failed to check in patient', 'error');
    }
  };

  const handleCancel = async (appointmentId) => {
    try {
      await clinicAPI.cancelAppointment(appointmentId);
      
      showToast('Appointment cancelled successfully!', 'success');
      fetchDashboardData(true); // Silent refresh
    } catch (err) {
      console.error('Cancel error:', err);
      showToast('Failed to cancel appointment', 'error');
    }
  };

  const handleBookAppointment = () => {
    setBookAppointmentOpen(true);
  };

  const handleCloseBookingModal = () => {
    setBookAppointmentOpen(false);
    setBookingForm({
      patient: null,
      doctor: '',
      scheduled_time: '',
      reason: '',
      priority: 3,
      appointment_type: 'normal'
    });
  };

  const handleBookingFormChange = (field, value) => {
    setBookingForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitBooking = async () => {
    if (!bookingForm.patient || !bookingForm.doctor || !bookingForm.scheduled_time || !bookingForm.reason) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setBookingLoading(true);
    try {
      const appointmentData = {
        patient: bookingForm.patient.id,
        doctor: bookingForm.doctor,
        scheduled_time: bookingForm.scheduled_time,
        reason: bookingForm.reason,
        priority: bookingForm.priority,
        appointment_type: bookingForm.appointment_type
      };
      
      await clinicAPI.createAppointment(appointmentData);
      
      showToast('Appointment booked successfully!', 'success');
      handleCloseBookingModal();
      fetchDashboardData(true);
    } catch (err) {
      console.error('❌ Appointment creation error:', err);
      showToast('Failed to book appointment', 'error');
    } finally {
      setBookingLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'in_progress': return 'info'; // Ongoing - Blue
      case 'completed': return 'success'; // Completed - Green
      case 'checked_in': return 'warning'; // Checked In - Orange
      case 'cancelled': return 'error'; // Cancelled - Red
      case 'scheduled': return 'default'; // Scheduled - Gray
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'in_progress': return 'Ongoing';
      case 'completed': return 'Completed';
      case 'checked_in': return 'Checked In';
      case 'cancelled': return 'Cancelled';
      case 'scheduled': return 'Scheduled';
      default: return 'Scheduled';
    }
  };

  const getStatusSortOrder = (status) => {
    switch (status) {
      case 'in_progress': return 1; // Ongoing - First
      case 'completed': return 2; // Completed - Second
      case 'cancelled': return 3; // Cancelled - Third
      case 'checked_in': return 4; // Checked In - Fourth
      case 'scheduled': return 5; // Scheduled - Last
      default: return 6;
    }
  };

  const filteredAppointments = selectedStatFilter 
    ? appointments.filter(apt => {
        switch (selectedStatFilter) {
          case 'waiting': return apt.status === 'checked_in';
          case 'ongoing': return apt.status === 'in_progress';
          case 'completed': return apt.status === 'completed';
          case 'emergency': return apt.priority === 1;
          default: return true;
        }
      })
    : appointments;

  // Sort appointments by status (Ongoing, Completed, Cancelled, Checked In, Scheduled)
  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    const statusOrderA = getStatusSortOrder(a.status);
    const statusOrderB = getStatusSortOrder(b.status);
    
    // If status order is the same, sort by scheduled time
    if (statusOrderA === statusOrderB) {
      return new Date(a.scheduled_time) - new Date(b.scheduled_time);
    }
    
    return statusOrderA - statusOrderB;
  });


  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return '#f44336'; // Emergency - Red
      case 2: return '#ff9800'; // High - Orange
      case 3: return '#4caf50'; // Normal - Green
      case 4: return '#9e9e9e'; // Low - Grey
      default: return '#4caf50';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 1: return 'Emergency';
      case 2: return 'High';
      case 3: return 'Normal';
      case 4: return 'Low';
      default: return 'Normal';
    }
  };


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Retry
            </Button>
          }
        >
          {error}
          {error.includes('log in') && (
            <Box sx={{ mt: 2 }}>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={() => window.location.href = '/login'}
                sx={{ textTransform: 'none' }}
              >
                Go to Login
              </Button>
            </Box>
          )}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      width: '100%', 
      minHeight: '100vh', 
      bgcolor: '#F7F9FC',
      fontFamily: '"Inter", "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Enhanced Header */}
      <Paper sx={{ mb: 3, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', bgcolor: 'white' }}>
        <Box sx={{ p: 4, borderBottom: '1px solid #E8ECF0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ 
                width: 48, 
                height: 48, 
                borderRadius: 2, 
                bgcolor: '#4A90E2', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <ClinicIcon sx={{ fontSize: 28, color: 'white' }} />
              </Box>
              <Box>
                <Typography variant="h4" component="h1" fontWeight="700" color="#333333" sx={{ fontSize: '28px', lineHeight: 1.2 }}>
                  Receptionist Portal
                </Typography>
                <Typography variant="body1" color="#6c757d" sx={{ fontSize: '16px', fontWeight: 400 }}>
                  Manage appointments and patient check-ins
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Refresh Data">
              <IconButton 
                onClick={handleRefresh} 
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: '#F7F9FC',
                  border: '1px solid #E8ECF0',
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' }
                  },
                  '&:hover': {
                    bgcolor: '#4A90E2',
                    color: 'white',
                    borderColor: '#4A90E2'
                  }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Enhanced Stat Cards */}
        {dashboardStats && (
          <Box sx={{ p: 4, bgcolor: '#F7F9FC' }}>
            {/* Statistics Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card 
                  sx={{ 
                    textAlign: 'center', 
                    bgcolor: 'white',
                    cursor: 'pointer',
                    borderRadius: 3,
                    border: '1px solid #E8ECF0',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': { 
                      transform: 'translateY(-4px)', 
                      boxShadow: '0 8px 30px rgba(74, 144, 226, 0.15)',
                      borderColor: '#4A90E2'
                    }
                  }}
                  onClick={() => handleStatCardClick('total')}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ 
                      width: 56, 
                      height: 56, 
                      borderRadius: 3, 
                      bgcolor: '#4A90E2', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2
                    }}>
                      <PeopleIcon sx={{ fontSize: 28, color: 'white' }} />
                    </Box>
                    <Typography variant="h3" fontWeight="700" color="#333333" sx={{ fontSize: '32px', mb: 1 }}>
                      {dashboardStats.appointment_stats?.total_today || 0}
                    </Typography>
                    <Typography variant="body2" color="#6c757d" sx={{ fontSize: '14px', fontWeight: 500 }}>
                      Today's Appointments
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card 
                  sx={{ 
                    textAlign: 'center', 
                    bgcolor: 'white',
                    cursor: 'pointer',
                    borderRadius: 3,
                    border: '1px solid #E8ECF0',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': { 
                      transform: 'translateY(-4px)', 
                      boxShadow: '0 8px 30px rgba(255, 193, 7, 0.15)',
                      borderColor: '#FFC107'
                    }
                  }}
                  onClick={() => handleStatCardClick('waiting')}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ 
                      width: 56, 
                      height: 56, 
                      borderRadius: 3, 
                      bgcolor: '#FFC107', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2
                    }}>
                      <ScheduleIcon sx={{ fontSize: 28, color: 'white' }} />
                    </Box>
                    <Typography variant="h3" fontWeight="700" color="#333333" sx={{ fontSize: '32px', mb: 1 }}>
                      {dashboardStats.queue_stats?.total_waiting || 0}
                    </Typography>
                    <Typography variant="body2" color="#6c757d" sx={{ fontSize: '14px', fontWeight: 500 }}>
                      Waiting in Queue
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card 
                  sx={{ 
                    textAlign: 'center', 
                    bgcolor: 'white',
                    cursor: 'pointer',
                    borderRadius: 3,
                    border: '1px solid #E8ECF0',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': { 
                      transform: 'translateY(-4px)', 
                      boxShadow: '0 8px 30px rgba(0, 196, 159, 0.15)',
                      borderColor: '#00C49F'
                    }
                  }}
                  onClick={() => handleStatCardClick('completed')}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ 
                      width: 56, 
                      height: 56, 
                      borderRadius: 3, 
                      bgcolor: '#00C49F', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2
                    }}>
                      <AssignmentIcon sx={{ fontSize: 28, color: 'white' }} />
                    </Box>
                    <Typography variant="h3" fontWeight="700" color="#333333" sx={{ fontSize: '32px', mb: 1 }}>
                      {dashboardStats.appointment_stats?.completed_today || 0}
                    </Typography>
                    <Typography variant="body2" color="#6c757d" sx={{ fontSize: '14px', fontWeight: 500 }}>
                      Completed Today
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card 
                  sx={{ 
                    textAlign: 'center', 
                    bgcolor: 'white',
                    cursor: 'pointer',
                    borderRadius: 3,
                    border: '1px solid #E8ECF0',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': { 
                      transform: 'translateY(-4px)', 
                      boxShadow: '0 8px 30px rgba(211, 47, 47, 0.15)',
                      borderColor: '#D32F2F'
                    }
                  }}
                  onClick={() => handleStatCardClick('emergency')}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ 
                      width: 56, 
                      height: 56, 
                      borderRadius: 3, 
                      bgcolor: '#D32F2F', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2
                    }}>
                      <WarningIcon sx={{ fontSize: 28, color: 'white' }} />
                    </Box>
                    <Typography variant="h3" fontWeight="700" color="#333333" sx={{ fontSize: '32px', mb: 1 }}>
                      {dashboardStats.appointment_stats?.emergency_today || 0}
                    </Typography>
                    <Typography variant="body2" color="#6c757d" sx={{ fontSize: '14px', fontWeight: 500 }}>
                      Emergency Cases
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Enhanced Action Bar */}
      <Paper sx={{ mb: 3, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', bgcolor: 'white' }}>
        <Box sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<PersonAddIcon />}
              onClick={() => setRegisterPatientOpen(true)}
              sx={{
                bgcolor: '#4A90E2',
                color: 'white',
                px: 4,
                py: 2,
                fontSize: '16px',
                fontWeight: 600,
                borderRadius: 3,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: '#357ABD',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(74, 144, 226, 0.3)'
                },
                transition: 'all 0.3s ease-in-out'
              }}
            >
              Register Patient
            </Button>
            
            <Button
              variant="contained"
              size="large"
              startIcon={<EventAvailableIcon />}
              onClick={() => setBookAppointmentOpen(true)}
              sx={{
                bgcolor: '#00C49F',
                color: 'white',
                px: 4,
                py: 2,
                fontSize: '16px',
                fontWeight: 600,
                borderRadius: 3,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: '#00A085',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(0, 196, 159, 0.3)'
                },
                transition: 'all 0.3s ease-in-out'
              }}
            >
              Book Appointment
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Enhanced Appointments Table */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', bgcolor: 'white' }}>
        <Box sx={{ p: 4, borderBottom: '1px solid #E8ECF0' }}>
          <Typography variant="h5" fontWeight="700" color="#333333" sx={{ fontSize: '20px' }}>
            Today's Appointments
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F7F9FC' }}>
                <TableCell sx={{ fontWeight: 600, color: '#333333', fontSize: '14px' }}><strong>Date</strong></TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#333333', fontSize: '14px' }}><strong>Time</strong></TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#333333', fontSize: '14px' }}><strong>Patient</strong></TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#333333', fontSize: '14px' }}><strong>Doctor</strong></TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#333333', fontSize: '14px' }}><strong>Type</strong></TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#333333', fontSize: '14px' }}><strong>Priority</strong></TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#333333', fontSize: '14px' }}><strong>Status</strong></TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#333333', fontSize: '14px' }}><strong>Reason</strong></TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#333333', fontSize: '14px' }}><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedAppointments.map((appointment) => (
                <TableRow 
                  key={appointment.id} 
                  hover
                  sx={{ 
                    '&:hover': { 
                      bgcolor: '#F7F9FC',
                      '& td': { borderColor: '#E8ECF0' }
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 2, 
                        bgcolor: '#FF9800', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <CalendarTodayIcon sx={{ fontSize: 16, color: 'white' }} />
                      </Box>
                      <Typography variant="body2" fontWeight="500" color="#333333">
                        {new Date(appointment.scheduled_time).toLocaleDateString('en-US', { 
                          year: 'numeric',
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 2, 
                        bgcolor: '#4A90E2', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <AccessTimeIcon sx={{ fontSize: 16, color: 'white' }} />
                      </Box>
                      <Typography variant="body2" fontWeight="500" color="#333333">
                        {new Date(appointment.scheduled_time).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 2, 
                        bgcolor: '#00C49F', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <PersonIcon sx={{ fontSize: 16, color: 'white' }} />
                      </Box>
                      <Typography variant="body2" fontWeight="500" color="#333333">
                        {appointment.patient_details?.full_name || 
                         appointment.patient?.full_name || 
                         appointment.patient_name || 
                         'Unknown'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 2, 
                        bgcolor: '#FFC107', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <LocalHospitalIcon sx={{ fontSize: 16, color: 'white' }} />
                      </Box>
                      <Typography variant="body2" color="#6c757d">
                        {appointment.doctor_details?.get_full_name?.() || 
                         `${appointment.doctor_details?.first_name || ''} ${appointment.doctor_details?.last_name || ''}`.trim() ||
                         appointment.doctor?.get_full_name?.() || 
                         appointment.doctor_name || 
                         (appointment.doctor ? `${appointment.doctor.first_name || ''} ${appointment.doctor.last_name || ''}`.trim() : 'Unknown Doctor')}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={appointment.appointment_type || 'Normal'} 
                      size="small" 
                      sx={{
                        bgcolor: appointment.appointment_type === 'emergency' ? '#D32F2F' : '#F7F9FC',
                        color: appointment.appointment_type === 'emergency' ? 'white' : '#6c757d',
                        fontWeight: 500,
                        border: '1px solid #E8ECF0'
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box 
                        sx={{ 
                          width: 8, 
                          height: 8, 
                          borderRadius: '50%', 
                          bgcolor: getPriorityColor(appointment.priority) 
                        }} 
                      />
                      <Typography variant="body2" fontWeight="500" color="#333333">
                        {getPriorityLabel(appointment.priority)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={getStatusLabel(appointment.status)} 
                      size="small" 
                      sx={{
                        bgcolor: getStatusColor(appointment.status) === 'success' ? '#00C49F' : 
                                 getStatusColor(appointment.status) === 'warning' ? '#FFC107' :
                                 getStatusColor(appointment.status) === 'error' ? '#D32F2F' :
                                 getStatusColor(appointment.status) === 'info' ? '#4A90E2' : '#6c757d',
                        color: 'white',
                        fontWeight: 500,
                        textTransform: 'capitalize'
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200, color: '#6c757d' }}>
                      {appointment.reason || 'No reason provided'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {appointment.status === 'scheduled' && (
                        <Tooltip title="Check In Patient">
                          <IconButton 
                            size="small" 
                            onClick={() => handleCheckIn(appointment.id)}
                            sx={{
                              bgcolor: '#00C49F',
                              color: 'white',
                              '&:hover': {
                                bgcolor: '#00A085',
                                transform: 'scale(1.1)'
                              },
                              transition: 'all 0.2s ease-in-out'
                            }}
                          >
                            <CheckCircleOutlineIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(appointment.status === 'scheduled' || appointment.status === 'checked_in' || appointment.status === 'in_progress') && (
                        <Tooltip title="Cancel Appointment">
                          <IconButton 
                            size="small" 
                            onClick={() => handleCancel(appointment.id)}
                            sx={{
                              bgcolor: '#D32F2F',
                              color: 'white',
                              '&:hover': {
                                bgcolor: '#B71C1C',
                                transform: 'scale(1.1)'
                              },
                              transition: 'all 0.2s ease-in-out'
                            }}
                          >
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>


      {/* Book Appointment Modal */}
      <Dialog 
        open={bookAppointmentOpen} 
        onClose={handleCloseBookingModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventAvailableIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              Book New Appointment
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Patient Selection */}
            <Autocomplete
              options={patients}
              getOptionLabel={(option) => option.full_name || `${option.first_name} ${option.last_name}`}
              value={bookingForm.patient}
              onChange={(event, newValue) => handleBookingFormChange('patient', newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Patient"
                  required
                  placeholder="Search for existing patient"
                />
              )}
            />

            {/* Doctor Selection */}
            <FormControl fullWidth required>
              <InputLabel>Doctor</InputLabel>
              <Select
                value={bookingForm.doctor}
                onChange={(e) => handleBookingFormChange('doctor', e.target.value)}
                label="Doctor"
              >
                {doctors.map((doctor) => (
                  <MenuItem key={doctor.id} value={doctor.id}>
                    {doctor.get_full_name?.() || `${doctor.first_name} ${doctor.last_name}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Date & Time */}
            <TextField
              label="Appointment Date & Time"
              type="datetime-local"
              value={bookingForm.scheduled_time}
              onChange={(e) => handleBookingFormChange('scheduled_time', e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            {/* Reason */}
            <TextField
              label="Reason for Visit"
              value={bookingForm.reason}
              onChange={(e) => handleBookingFormChange('reason', e.target.value)}
              required
              fullWidth
              multiline
              rows={3}
              placeholder="Describe the reason for the appointment"
            />

            {/* Priority */}
            <FormControl component="fieldset">
              <Typography variant="subtitle2" gutterBottom>
                Priority Level
              </Typography>
              <RadioGroup
                value={bookingForm.priority}
                onChange={(e) => handleBookingFormChange('priority', parseInt(e.target.value))}
                row
              >
                <FormControlLabel value={3} control={<Radio />} label="Normal" />
                <FormControlLabel value={2} control={<Radio />} label="High" />
                <FormControlLabel value={1} control={<Radio />} label="Emergency" />
              </RadioGroup>
            </FormControl>

            {/* Appointment Type */}
            <FormControl fullWidth>
              <InputLabel>Appointment Type</InputLabel>
              <Select
                value={bookingForm.appointment_type}
                onChange={(e) => handleBookingFormChange('appointment_type', e.target.value)}
                label="Appointment Type"
              >
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="follow_up">Follow-up</MenuItem>
                <MenuItem value="emergency">Emergency</MenuItem>
                <MenuItem value="consultation">Consultation</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseBookingModal} disabled={bookingLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitBooking} 
            variant="contained" 
            disabled={bookingLoading}
            startIcon={bookingLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            {bookingLoading ? 'Booking...' : 'Book Appointment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Register Patient Modal */}
      <Dialog 
        open={registerPatientOpen} 
        onClose={handleClosePatientModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonAddIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              Register New Patient
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {patientFormError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {patientFormError}
              </Alert>
            )}

            {/* Basic Information */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  name="first_name"
                  value={patientForm.first_name}
                  onChange={(e) => handlePatientFormChange('first_name', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  name="last_name"
                  value={patientForm.last_name}
                  onChange={(e) => handlePatientFormChange('last_name', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date of Birth"
                  name="date_of_birth"
                  type="date"
                  value={patientForm.date_of_birth}
                  onChange={(e) => handlePatientFormChange('date_of_birth', e.target.value)}
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Gender</InputLabel>
                  <Select
                    label="Gender"
                    name="gender"
                    value={patientForm.gender}
                    onChange={(e) => handlePatientFormChange('gender', e.target.value)}
                  >
                    <MenuItem value="M">Male</MenuItem>
                    <MenuItem value="F">Female</MenuItem>
                    <MenuItem value="O">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Contact Information */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  name="phone"
                  value={patientForm.phone}
                  onChange={(e) => handlePatientFormChange('phone', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={patientForm.email}
                  onChange={(e) => handlePatientFormChange('email', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  name="address"
                  multiline
                  rows={3}
                  value={patientForm.address}
                  onChange={(e) => handlePatientFormChange('address', e.target.value)}
                  required
                />
              </Grid>
            </Grid>

            {/* Medical Information */}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Medical History"
                  name="medical_history"
                  multiline
                  rows={3}
                  value={patientForm.medical_history}
                  onChange={(e) => handlePatientFormChange('medical_history', e.target.value)}
                  placeholder="Any relevant medical history, conditions, or notes"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Blood Group</InputLabel>
                  <Select
                    label="Blood Group"
                    name="blood_group"
                    value={patientForm.blood_group}
                    onChange={(e) => handlePatientFormChange('blood_group', e.target.value)}
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
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Height (cm)"
                  name="height"
                  type="number"
                  value={patientForm.height}
                  onChange={(e) => handlePatientFormChange('height', e.target.value)}
                  inputProps={{ step: 0.1, min: 0, max: 300 }}
                  placeholder="e.g., 175.0"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Weight (kg)"
                  name="weight"
                  type="number"
                  value={patientForm.weight}
                  onChange={(e) => handlePatientFormChange('weight', e.target.value)}
                  inputProps={{ step: 0.1, min: 0, max: 500 }}
                  placeholder="e.g., 70.5"
                />
              </Grid>
            </Grid>

            {/* BMI Display */}
            {patientForm.height && patientForm.weight && (
              <Alert severity="info">
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
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleClosePatientModal} disabled={patientFormLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleRegisterPatient} 
            variant="contained" 
            disabled={patientFormLoading}
            startIcon={patientFormLoading ? <CircularProgress size={20} /> : <PersonAddIcon />}
          >
            {patientFormLoading ? 'Registering...' : 'Register Patient'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseToast} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ReceptionistPortal;