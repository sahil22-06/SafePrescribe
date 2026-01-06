import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel, Select,
  MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Alert, CircularProgress, Avatar, Divider, List, ListItem,
  ListItemText, ListItemAvatar, ListItemSecondaryAction, Fab, Tooltip, Badge, Container
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  CheckCircle as CompleteIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  LocalHospital as HospitalIcon,
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon,
  ExitToApp as LogoutIcon,
  Medication as MedicationIcon,
  Description as PrescriptionIcon,
  Queue as QueueIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

const DoctorDashboard = () => {
  const [user, setUser] = useState(null);
  const [queue, setQueue] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPatient, setCurrentPatient] = useState(null);
  
  // Dialog states
  const [patientDialog, setPatientDialog] = useState(false);
  const [prescriptionDialog, setPrescriptionDialog] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      if (parsedUser.role !== 'doctor') {
        navigate('/clinic/login');
        return;
      }
    } else {
      navigate('/clinic/login');
      return;
    }
    
    fetchData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch doctor's queue
      const queueResponse = await fetch(`http://localhost:8000/api/clinic/queue/?doctor=${user?.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (queueResponse.ok) {
        const queueData = await queueResponse.json();
        setQueue(queueData.results || queueData);
      }
      
      // Fetch doctor's appointments
      const appointmentsResponse = await fetch('http://localhost:8000/api/clinic/appointments/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json();
        // Filter to show only current doctor's appointments
        const doctorAppointments = (appointmentsData.results || appointmentsData).filter(
          apt => apt.doctor_id === user?.id
        );
        setAppointments(doctorAppointments);
      }
      
      setError('');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    navigate('/clinic/login');
    toast.success('Logged out successfully');
  };

  const handleStartConsultation = async (appointment) => {
    try {
      const response = await fetch(`http://localhost:8000/api/clinic/appointments/${appointment.id}/status/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'in_progress',
          actual_start_time: new Date().toISOString()
        })
      });

      if (response.ok) {
        setCurrentPatient(appointment);
        setPatientDialog(true);
        toast.success('Consultation started');
        fetchData();
      } else {
        toast.error('Failed to start consultation');
      }
    } catch (err) {
      console.error('Error starting consultation:', err);
      toast.error('Failed to start consultation');
    }
  };

  const handleCompleteConsultation = async (appointment) => {
    try {
      const response = await fetch(`http://localhost:8000/api/clinic/appointments/${appointment.id}/status/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'completed',
          actual_end_time: new Date().toISOString()
        })
      });

      if (response.ok) {
        toast.success('Consultation completed');
        setCurrentPatient(null);
        setPatientDialog(false);
        fetchData();
      } else {
        toast.error('Failed to complete consultation');
      }
    } catch (err) {
      console.error('Error completing consultation:', err);
      toast.error('Failed to complete consultation');
    }
  };

  const handleRemoveFromQueue = async (queueId) => {
    try {
      const response = await fetch('http://localhost:8000/api/clinic/queue/remove/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ queue_id: queueId })
      });

      if (response.ok) {
        toast.success('Patient removed from queue');
        fetchData();
      } else {
        toast.error('Failed to remove from queue');
      }
    } catch (err) {
      console.error('Error removing from queue:', err);
      toast.error('Failed to remove from queue');
    }
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

  const getPriorityIcon = (priority) => {
    if (priority === 1) return <WarningIcon color="error" />;
    return <ScheduleIcon color="primary" />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 0, boxShadow: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <HospitalIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight="bold" color="primary">
                Doctor Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Welcome, Dr. {user?.full_name} {user?.specialization ? `(${user.specialization})` : ''}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchData}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              color="error"
            >
              Logout
            </Button>
          </Box>
        </Box>
      </Paper>

      <Container maxWidth="xl">
        <Grid container spacing={3}>
          {/* Quick Stats */}
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Badge badgeContent={queue.length} color="error">
                    <Avatar sx={{ bgcolor: 'warning.main' }}>
                      <QueueIcon />
                    </Avatar>
                  </Badge>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {queue.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Patients in Queue
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
                    <ScheduleIcon />
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

          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <CompleteIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {appointments.filter(a => a.status === 'completed').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed Today
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
                  <Avatar sx={{ bgcolor: 'error.main' }}>
                    <WarningIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {queue.filter(q => q.priority === 1).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Emergency Cases
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Current Patient Card */}
          {currentPatient && (
            <Grid item xs={12}>
              <Card sx={{ bgcolor: 'success.light', color: 'white', mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <HospitalIcon sx={{ fontSize: 40 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" fontWeight="bold">
                        Currently Consulting
                      </Typography>
                      <Typography variant="body1">
                        {currentPatient.patient_name} - {currentPatient.reason}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      color="error"
                      onClick={() => handleCompleteConsultation(currentPatient)}
                      startIcon={<CompleteIcon />}
                    >
                      Complete Consultation
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Patient Queue */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ borderRadius: 2, boxShadow: 2 }}>
              <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="h6" fontWeight="bold">
                  Patient Queue ({queue.length})
                </Typography>
              </Box>
              
              {queue.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <ScheduleIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    No patients in queue
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Patients will appear here when they check in
                  </Typography>
                </Box>
              ) : (
                <List>
                  {queue.map((queueEntry, index) => (
                    <ListItem
                      key={queueEntry.id}
                      sx={{
                        borderBottom: '1px solid #f0f0f0',
                        '&:hover': { bgcolor: '#f8f9fa' }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: getPriorityColor(queueEntry.priority) + '.main' }}>
                          {queueEntry.position}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {queueEntry.patient_name}
                            </Typography>
                            <Chip
                              label={getPriorityIcon(queueEntry.priority)}
                              size="small"
                              color={getPriorityColor(queueEntry.priority)}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {queueEntry.reason}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Estimated wait: {queueEntry.estimated_wait_time} minutes
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Start Consultation">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleStartConsultation(queueEntry.appointment)}
                            >
                              <StartIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remove from Queue">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveFromQueue(queueEntry.id)}
                            >
                              <StopIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
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
                  startIcon={<PrescriptionIcon />}
                  onClick={() => setPrescriptionDialog(true)}
                  disabled={!currentPatient}
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  Write Prescription
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<MedicationIcon />}
                  disabled={!currentPatient}
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  Check Medications
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchData}
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  Refresh Queue
                </Button>
              </Box>

              {/* Queue Statistics */}
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                Queue Statistics
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Total in Queue:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {queue.length}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Emergency Cases:</Typography>
                  <Typography variant="body2" fontWeight="bold" color="error.main">
                    {queue.filter(q => q.priority === 1).length}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Average Wait:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {queue.length > 0 ? Math.round(queue.reduce((acc, q) => acc + q.estimated_wait_time, 0) / queue.length) : 0} min
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* Patient Details Dialog */}
      <Dialog open={patientDialog} onClose={() => setPatientDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Patient Consultation - {currentPatient?.patient_name}
        </DialogTitle>
        <DialogContent>
          {currentPatient && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Patient Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Reason for Visit:</Typography>
                  <Typography variant="body1">{currentPatient.reason}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Priority:</Typography>
                  <Chip
                    label={`Priority ${currentPatient.priority}`}
                    size="small"
                    color={getPriorityColor(currentPatient.priority)}
                  />
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 3 }} />
              
              <Typography variant="h6" sx={{ mb: 2 }}>
                Consultation Notes
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                placeholder="Enter consultation notes, diagnosis, and treatment plan..."
                sx={{ mb: 2 }}
              />
              
              <Typography variant="h6" sx={{ mb: 2 }}>
                Diagnosis
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={2}
                placeholder="Enter diagnosis..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPatientDialog(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              setPatientDialog(false);
              setPrescriptionDialog(true);
            }}
          >
            Write Prescription
          </Button>
        </DialogActions>
      </Dialog>

      {/* Prescription Dialog */}
      <Dialog open={prescriptionDialog} onClose={() => setPrescriptionDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Write Prescription - {currentPatient?.patient_name}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This will open the prescription dialog with the current patient pre-selected.
            The prescription system will handle drug interactions and allergy checks automatically.
          </Alert>
          <Typography variant="body1">
            Click "Open Prescription Dialog" to access the full prescription system.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrescriptionDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              setPrescriptionDialog(false);
              // In a real implementation, this would open the prescription dialog
              toast.info('Prescription dialog would open here');
            }}
          >
            Open Prescription Dialog
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DoctorDashboard;
