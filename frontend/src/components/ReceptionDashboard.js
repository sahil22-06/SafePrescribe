import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel, Select,
  MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Alert, CircularProgress, Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  PersonAdd as PersonAddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { clinicAPI } from '../services/clinicApi';
import { patientsAPI, authAPI } from '../services/api';
// import dayjs from 'dayjs';

const ReceptionDashboard = ({ onRefresh, showToast }) => {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Dialog states
  const [appointmentDialog, setAppointmentDialog] = useState(false);
  const [patientDialog, setPatientDialog] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  
  // Form states
  const [appointmentForm, setAppointmentForm] = useState(() => {
    // Set default time to 1 hour from now
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    
    return {
      patient: '',
      doctor: '',
      appointment_type: 'normal',
      scheduled_time: defaultTime.toISOString().slice(0, 16),
      reason: '',
      priority: 3
    };
  });
  
  const [patientForm, setPatientForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [appointmentsRes, patientsRes, doctorsRes] = await Promise.all([
        clinicAPI.getAppointments({ scheduled_time__date: new Date().toISOString().split('T')[0] }),
        patientsAPI.getAll(),
        authAPI.getProfile() // This will get current user, we'll use all users as doctors for now
      ]);
      
      setAppointments(appointmentsRes.data.results || appointmentsRes.data);
      setPatients(patientsRes.data.results || patientsRes.data);
      
      // Get all users as potential doctors (in a real app, you'd have a separate doctors API)
      // For now, we'll fetch users from the backend
      try {
        const usersResponse = await fetch('http://localhost:8000/api/users/', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        });
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setDoctors(usersData.results || usersData);
        } else {
          // Fallback to mock data if API fails
          setDoctors([
            { id: 1, first_name: 'Dr. John', last_name: 'Smith', email: 'john@clinic.com' },
            { id: 2, first_name: 'Dr. Sarah', last_name: 'Johnson', email: 'sarah@clinic.com' },
            { id: 3, first_name: 'Dr. Michael', last_name: 'Brown', email: 'michael@clinic.com' }
          ]);
        }
      } catch (err) {
        console.warn('Could not fetch doctors, using mock data:', err);
        // Fallback to mock data
        setDoctors([
          { id: 1, first_name: 'Dr. John', last_name: 'Smith', email: 'john@clinic.com' },
          { id: 2, first_name: 'Dr. Sarah', last_name: 'Johnson', email: 'sarah@clinic.com' },
          { id: 3, first_name: 'Dr. Michael', last_name: 'Brown', email: 'michael@clinic.com' }
        ]);
      }
      
      setError('');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAppointment = async () => {
    try {
      // Validate required fields
      if (!appointmentForm.patient || !appointmentForm.doctor || !appointmentForm.scheduled_time || !appointmentForm.reason) {
        showToast('Please fill in all required fields', 'error');
        return;
      }

      // Validate scheduled time is in the future
      const selectedTime = new Date(appointmentForm.scheduled_time);
      const now = new Date();
      if (selectedTime <= now) {
        showToast('Scheduled time must be in the future', 'error');
        return;
      }

      const appointmentData = {
        ...appointmentForm,
        patient: parseInt(appointmentForm.patient),
        doctor: parseInt(appointmentForm.doctor),
        priority: parseInt(appointmentForm.priority),
        scheduled_time: selectedTime.toISOString()
      };
      
      console.log('Creating appointment with data:', appointmentData);
      console.log('API endpoint:', '/clinic/appointments/');
      console.log('Auth token:', localStorage.getItem('authToken') ? 'Present' : 'Missing');
      
      const response = await clinicAPI.createAppointment(appointmentData);
      console.log('Appointment created successfully:', response.data);
      
      showToast('Appointment created successfully!', 'success');
      setAppointmentDialog(false);
      resetAppointmentForm();
      fetchData();
      onRefresh();
    } catch (err) {
      console.error('Error creating appointment:', err);
      console.error('Error response:', err.response);
      console.error('Error status:', err.response?.status);
      console.error('Error data:', err.response?.data);
      console.error('Full error details:', JSON.stringify(err.response?.data, null, 2));
      
      // Handle different types of errors
      let errorMessage = 'Failed to create appointment';
      if (err.response?.data) {
        if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (typeof err.response.data === 'object') {
          // Handle validation errors
          const errors = [];
          for (const [field, messages] of Object.entries(err.response.data)) {
            if (Array.isArray(messages)) {
              errors.push(`${field}: ${messages.join(', ')}`);
            } else {
              errors.push(`${field}: ${messages}`);
            }
          }
          errorMessage = errors.join('; ');
        }
      }
      
      showToast(errorMessage, 'error');
    }
  };

  const handleCreatePatient = async () => {
    try {
      // Validate required fields
      if (!patientForm.first_name || !patientForm.last_name || !patientForm.date_of_birth || !patientForm.gender) {
        showToast('Please fill in all required fields (Name, DOB, Gender)', 'error');
        return;
      }

      console.log('Creating patient with data:', patientForm);
      const response = await patientsAPI.create(patientForm);
      console.log('Patient created successfully:', response.data);
      
      showToast('Patient created successfully!', 'success');
      setPatientDialog(false);
      resetPatientForm();
      fetchData();
    } catch (err) {
      console.error('Error creating patient:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || 'Failed to create patient';
      showToast(errorMessage, 'error');
    }
  };

  const resetAppointmentForm = () => {
    // Set default time to 1 hour from now
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    
    setAppointmentForm({
      patient: '',
      doctor: '',
      appointment_type: 'normal',
      scheduled_time: defaultTime.toISOString().slice(0, 16),
      reason: '',
      priority: 3
    });
    setEditingAppointment(null);
  };

  const resetPatientForm = () => {
    setPatientForm({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      gender: '',
      phone: '',
      email: '',
      address: ''
    });
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

  const getPriorityLabel = (priority) => {
    const labels = {
      1: 'Emergency',
      2: 'High Priority',
      3: 'Normal',
      4: 'Low Priority'
    };
    return labels[priority] || 'Normal';
  };

  const getStatusColor = (status) => {
    const colors = {
      'scheduled': 'primary',
      'waiting': 'warning',
      'in_progress': 'success',
      'completed': 'default',
      'cancelled': 'error'
    };
    return colors[status] || 'default';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header Actions */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" fontWeight="bold" color="primary">
            Reception Dashboard
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => setPatientDialog(true)}
              sx={{ textTransform: 'none' }}
            >
              Register Patient
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAppointmentDialog(true)}
              sx={{ textTransform: 'none' }}
            >
              Book Appointment
            </Button>
          </Box>
        </Box>
        
        <Typography variant="body1" color="text.secondary">
          Manage patient registrations and appointment bookings for today
        </Typography>
      </Paper>

      {/* Today's Appointments */}
      <Paper sx={{ borderRadius: 2, boxShadow: 2 }}>
        <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0' }}>
          <Typography variant="h6" fontWeight="bold">
            Today's Appointments ({appointments.length})
          </Typography>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f7fa' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Doctor</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Priority</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.id} hover>
                  <TableCell>
                    {new Date(appointment.scheduled_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {appointment.patient_name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {appointment.doctor_name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={appointment.appointment_type.replace('_', ' ').toUpperCase()}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getPriorityLabel(appointment.priority)}
                      size="small"
                      color={getPriorityColor(appointment.priority)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={appointment.status.replace('_', ' ').toUpperCase()}
                      size="small"
                      color={getStatusColor(appointment.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {appointment.reason}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" color="primary">
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Appointment Dialog */}
      <Dialog open={appointmentDialog} onClose={() => setAppointmentDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Book New Appointment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Patient</InputLabel>
                <Select
                  value={appointmentForm.patient}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, patient: e.target.value })}
                  label="Patient"
                >
                  {patients.map((patient) => (
                    <MenuItem key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Doctor</InputLabel>
                <Select
                  value={appointmentForm.doctor}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, doctor: e.target.value })}
                  label="Doctor"
                >
                  {doctors.map((doctor) => (
                    <MenuItem key={doctor.id} value={doctor.id}>
                      {doctor.first_name} {doctor.last_name} {doctor.email ? `(${doctor.email})` : ''}
                    </MenuItem>
                  ))}
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
                  min: new Date().toISOString().slice(0, 16) // Set minimum to current time
                }}
                helperText="Select a future date and time"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
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
              <FormControl fullWidth>
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
                placeholder="Describe symptoms or reason for visit..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAppointmentDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateAppointment} variant="contained">
            Book Appointment
          </Button>
        </DialogActions>
      </Dialog>

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
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={patientForm.last_name}
                onChange={(e) => setPatientForm({ ...patientForm, last_name: e.target.value })}
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
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
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
                label="Phone"
                value={patientForm.phone}
                onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
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
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPatientDialog(false)}>Cancel</Button>
          <Button onClick={handleCreatePatient} variant="contained">
            Register Patient
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReceptionDashboard;

