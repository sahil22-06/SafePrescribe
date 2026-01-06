import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent,
  CircularProgress, Alert, Snackbar, Chip, IconButton, Button
} from '@mui/material';
import {
  LocalHospital as ClinicIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { clinicAPI } from '../services/clinicApi';
import DoctorQueueDashboard from '../components/DoctorQueueDashboard';

const DoctorPortal = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await clinicAPI.getDashboardStats();
      setDashboardStats(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      
      // Check if it's an authentication error
      if (err.response?.status === 401) {
        setError('Please log in to access the clinic dashboard');
      } else if (err.response?.status === 500) {
        setError('Server error. Please try again or contact support.');
      } else {
        setError('Failed to load dashboard statistics');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardStats();
  };

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = () => {
    setToast({ open: false, message: '', severity: 'success' });
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
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: '#f5f7fa' }}>
      {/* Header */}
      <Paper sx={{ mb: 3, borderRadius: 2, boxShadow: 2 }}>
        <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ClinicIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" component="h1" fontWeight="bold" color="primary">
                  Doctor Queue Dashboard
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Manage patient consultations and queue
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={handleRefresh} color="primary" size="large">
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Quick Stats */}
        {dashboardStats && (
          <Box sx={{ p: 3, bgcolor: '#f8f9fa' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', bgcolor: 'white' }}>
                  <CardContent>
                    <PeopleIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {dashboardStats.appointment_stats?.total_today || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Today's Appointments
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', bgcolor: 'white' }}>
                  <CardContent>
                    <ScheduleIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                    <Typography variant="h4" fontWeight="bold" color="warning.main">
                      {dashboardStats.queue_stats?.total_waiting || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Waiting in Queue
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', bgcolor: 'white' }}>
                  <CardContent>
                    <AssignmentIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {dashboardStats.appointment_stats?.completed_today || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed Today
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', bgcolor: 'white' }}>
                  <CardContent>
                    <ClinicIcon sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                    <Typography variant="h4" fontWeight="bold" color="error.main">
                      {dashboardStats.doctor_stats?.doctors_available || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Available Doctors
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Doctor Queue Dashboard Component */}
      <DoctorQueueDashboard onRefresh={fetchDashboardStats} showToast={showToast} />

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

export default DoctorPortal;
