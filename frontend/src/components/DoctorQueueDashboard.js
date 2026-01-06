import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, 
  Chip, IconButton, Alert, CircularProgress, Avatar, 
  Tooltip, Fade, Zoom
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  LocalHospital as HospitalIcon,
  AccessTime as AccessTimeIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { clinicAPI } from '../services/clinicApi';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const DoctorQueueDashboard = ({ onRefresh, showToast }) => {
  const { user: currentUser } = useAuth(); // Get current logged-in user
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser?.id) {
      fetchDoctorQueue(currentUser.id);
      const interval = setInterval(() => fetchDoctorQueue(currentUser.id, true), 30000); // Auto-refresh every 30 seconds
      return () => clearInterval(interval);
    } else {
      setLoading(false);
      setError('Please log in to access the doctor dashboard');
    }
  }, [currentUser?.id]);

  const fetchDoctorQueue = async (doctorId, silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      
      const response = await clinicAPI.getDoctorQueue(doctorId);
      setQueue(response.data.queue || []);
      setError('');
    } catch (err) {
      console.error('❌ Error fetching doctor queue:', err);
      setError('Failed to load patient queue');
      showToast('Failed to load patient queue.', 'error');
    } finally {
      if (!silent) setLoading(false);
      else setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (currentUser?.id) {
      await fetchDoctorQueue(currentUser.id, true);
    }
    if (onRefresh) onRefresh();
  };

  const handleStartConsultation = async (appointmentId, patientId) => {
    try {
      console.log('🔍 Starting consultation - appointmentId:', appointmentId, 'patientId:', patientId);
      
      // Make API call to start consultation
      const consultationResponse = await clinicAPI.startConsultation({
        appointment_id: appointmentId,
        doctor_id: currentUser.id
      });
      
      console.log('🔍 Consultation started, response:', consultationResponse.data);
      const consultationId = consultationResponse.data.id;
      
      showToast('Consultation started successfully!', 'success');
      
      // Navigate to patient profile with consultation state
      console.log('🔍 Navigating to:', `/patients/${patientId}`);
      navigate(`/patients/${patientId}`, { 
        state: { 
          fromConsultation: true, 
          appointmentId: appointmentId,
          consultationId: consultationId
        } 
      });
      
      // Refresh queue data
      await fetchDoctorQueue(currentUser.id);
    } catch (err) {
      console.error('❌ Failed to start consultation:', err);
      showToast('Failed to start consultation', 'error');
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return '#D32F2F'; // Emergency - Red
      case 2: return '#FFC107'; // High - Orange
      case 3: return '#4A90E2'; // Normal - Blue
      case 4: return '#6c757d'; // Low - Grey
      default: return '#4A90E2';
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

  const calculateWaitTime = (checkedInAt) => {
    if (!checkedInAt) return 'Unknown';
    const now = new Date();
    const checkedIn = new Date(checkedInAt);
    const diffMinutes = Math.floor((now - checkedIn) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just arrived';
    if (diffMinutes < 60) return `${diffMinutes} min`;
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress sx={{ color: '#4A90E2' }} />
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
      {/* Doctor's Personal Queue Header */}
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
                <HospitalIcon sx={{ fontSize: 28, color: 'white' }} />
              </Box>
              <Box>
                <Typography variant="h4" component="h1" fontWeight="700" color="#333333" sx={{ fontSize: '28px', lineHeight: 1.2 }}>
                  {currentUser ? `${currentUser.first_name} ${currentUser.last_name}'s Queue` : 'Doctor Queue Dashboard'}
                </Typography>
                <Typography variant="body1" color="#6c757d" sx={{ fontSize: '16px', fontWeight: 400 }}>
                  Manage your patient consultations
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Refresh Queue">
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

        {/* Queue Statistics */}
        <Box sx={{ p: 4, bgcolor: '#F7F9FC' }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ 
                textAlign: 'center', 
                bgcolor: 'white',
                borderRadius: 3,
                border: '1px solid #E8ECF0',
                transition: 'all 0.3s ease-in-out',
                '&:hover': { 
                  transform: 'translateY(-2px)', 
                  boxShadow: '0 8px 30px rgba(74, 144, 226, 0.15)'
                }
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 3, 
                    bgcolor: '#4A90E2', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2
                  }}>
                    <ScheduleIcon sx={{ fontSize: 24, color: 'white' }} />
                  </Box>
                  <Typography variant="h3" fontWeight="700" color="#333333" sx={{ fontSize: '28px', mb: 1 }}>
                    {queue.length}
                  </Typography>
                  <Typography variant="body2" color="#6c757d" sx={{ fontSize: '14px', fontWeight: 500 }}>
                    Patients Waiting
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ 
                textAlign: 'center', 
                bgcolor: 'white',
                borderRadius: 3,
                border: '1px solid #E8ECF0',
                transition: 'all 0.3s ease-in-out',
                '&:hover': { 
                  transform: 'translateY(-2px)', 
                  boxShadow: '0 8px 30px rgba(255, 193, 7, 0.15)'
                }
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 3, 
                    bgcolor: '#FFC107', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2
                  }}>
                    <AccessTimeIcon sx={{ fontSize: 24, color: 'white' }} />
                  </Box>
                  <Typography variant="h3" fontWeight="700" color="#333333" sx={{ fontSize: '28px', mb: 1 }}>
                    {queue.length > 0 ? calculateWaitTime(queue[0]?.checked_in_at) : '0'}
                  </Typography>
                  <Typography variant="body2" color="#6c757d" sx={{ fontSize: '14px', fontWeight: 500 }}>
                    Longest Wait
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ 
                textAlign: 'center', 
                bgcolor: 'white',
                borderRadius: 3,
                border: '1px solid #E8ECF0',
                transition: 'all 0.3s ease-in-out',
                '&:hover': { 
                  transform: 'translateY(-2px)', 
                  boxShadow: '0 8px 30px rgba(211, 47, 47, 0.15)'
                }
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 3, 
                    bgcolor: '#D32F2F', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2
                  }}>
                    <WarningIcon sx={{ fontSize: 24, color: 'white' }} />
                  </Box>
                  <Typography variant="h3" fontWeight="700" color="#333333" sx={{ fontSize: '28px', mb: 1 }}>
                    {queue.filter(p => p.appointment?.priority === 1).length}
                  </Typography>
                  <Typography variant="body2" color="#6c757d" sx={{ fontSize: '14px', fontWeight: 500 }}>
                    Emergency Cases
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Patient Queue */}
      <Paper sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', bgcolor: 'white' }}>
        <Box sx={{ p: 4, borderBottom: '1px solid #E8ECF0' }}>
          <Typography variant="h5" fontWeight="700" color="#333333" sx={{ fontSize: '20px' }}>
            Patient Queue
          </Typography>
        </Box>
        
        <Box sx={{ p: 4 }}>
          {queue.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Box sx={{ 
                width: 80, 
                height: 80, 
                borderRadius: 4, 
                bgcolor: '#F7F9FC', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                mx: 'auto',
                mb: 3
              }}>
                <PersonIcon sx={{ fontSize: 40, color: '#6c757d' }} />
              </Box>
              <Typography variant="h6" color="#6c757d" sx={{ fontSize: '18px', fontWeight: 500, mb: 1 }}>
                No patients in queue
              </Typography>
              <Typography variant="body2" color="#6c757d" sx={{ fontSize: '14px' }}>
                Patients will appear here when they check in
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {queue.map((patient, index) => (
                <Grid item xs={12} md={6} lg={4} key={patient.id}>
                  <Fade in={true} timeout={300 + (index * 100)}>
                    <Card sx={{ 
                      borderRadius: 3,
                      border: '1px solid #E8ECF0',
                      transition: 'all 0.3s ease-in-out',
                      '&:hover': { 
                        transform: 'translateY(-4px)', 
                        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                        borderColor: '#4A90E2'
                      }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        {/* Patient Header */}
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                          <Avatar sx={{ 
                            width: 48, 
                            height: 48, 
                            bgcolor: '#4A90E2',
                            mr: 2,
                            fontSize: '18px',
                            fontWeight: 600
                          }}>
                            {patient.appointment?.patient_details?.first_name?.[0] || 'P'}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" fontWeight="600" color="#333333" sx={{ fontSize: '16px', mb: 0.5 }}>
                              {patient.appointment?.patient_details?.full_name || 
                               `${patient.appointment?.patient_details?.first_name || ''} ${patient.appointment?.patient_details?.last_name || ''}`.trim() || 
                               'Unknown Patient'}
                            </Typography>
                            <Typography variant="body2" color="#6c757d" sx={{ fontSize: '14px' }}>
                              Age: {patient.appointment?.patient_details?.age || 'N/A'} • Queue Position: #{index + 1}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Wait Time */}
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Box sx={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: 2, 
                            bgcolor: '#FFC107', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            mr: 1
                          }}>
                            <AccessTimeIcon sx={{ fontSize: 14, color: 'white' }} />
                          </Box>
                          <Typography variant="body2" fontWeight="500" color="#333333">
                            Waiting for {calculateWaitTime(patient.checked_in_at)}
                          </Typography>
                        </Box>

                        {/* Reason for Visit */}
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="body2" color="#6c757d" sx={{ fontSize: '12px', fontWeight: 500, mb: 1, textTransform: 'uppercase' }}>
                            Reason for Visit
                          </Typography>
                          <Typography variant="body2" color="#333333" sx={{ fontSize: '14px', lineHeight: 1.4 }}>
                            {patient.appointment?.reason || 'No reason provided'}
                          </Typography>
                        </Box>

                        {/* Priority */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box 
                              sx={{ 
                                width: 8, 
                                height: 8, 
                                borderRadius: '50%', 
                                bgcolor: getPriorityColor(patient.appointment?.priority),
                                mr: 1
                              }} 
                            />
                            <Typography variant="body2" fontWeight="500" color="#333333">
                              {getPriorityLabel(patient.appointment?.priority)} Priority
                            </Typography>
                          </Box>
                          {patient.appointment?.priority === 1 && (
                            <Chip 
                              label="Emergency" 
                              size="small" 
                              sx={{
                                bgcolor: '#D32F2F',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: '11px'
                              }}
                            />
                          )}
                        </Box>

                        {/* Start Consultation Button */}
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<StartIcon />}
                          onClick={() => handleStartConsultation(patient.appointment?.id, patient.appointment?.patient_details?.id)}
                          sx={{
                            bgcolor: '#4A90E2',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '14px',
                            py: 1.5,
                            borderRadius: 3,
                            boxShadow: '0 4px 15px rgba(74, 144, 226, 0.3)',
                            '&:hover': {
                              bgcolor: '#357ABD',
                              boxShadow: '0 6px 20px rgba(74, 144, 226, 0.4)',
                              transform: 'translateY(-2px)'
                            },
                            transition: 'all 0.3s ease-in-out'
                          }}
                        >
                          Start Consultation
                        </Button>
                      </CardContent>
                    </Card>
                  </Fade>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default DoctorQueueDashboard;