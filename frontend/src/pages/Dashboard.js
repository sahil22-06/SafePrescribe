import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Avatar,
  Button,
  IconButton,
  Tooltip,
  LinearProgress,
  Stack,
} from '@mui/material';
import {
  People as PeopleIcon,
  Medication as MedicationIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  PersonAdd as PersonAddIcon,
  PostAdd as PostAddIcon,
  Science as ScienceIcon,
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  AccessTime as AccessTimeIcon,
  LocalHospital as LocalHospitalIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { patientsAPI, drugsAPI, prescriptionsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [heroStats, setHeroStats] = useState({
    totalPatients: 0,
    activePrescriptions: 0,
    totalMedications: 0,
  });
  const [secondaryStats, setSecondaryStats] = useState({
    completedPrescriptions: 0,
    expiredPrescriptions: 0,
    cancelledPrescriptions: 0,
    pendingPrescriptions: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [patientsStats, drugsStats, prescriptionsStats, prescriptionsList] = await Promise.all([
          patientsAPI.getStats(),
          drugsAPI.getStats(),
          prescriptionsAPI.getStats(),
          prescriptionsAPI.getAll({ limit: 5 })
        ]);

        // Hero stats (most important)
        setHeroStats({
          totalPatients: patientsStats.data.total_patients,
          activePrescriptions: prescriptionsStats.data.active_prescriptions,
          totalMedications: drugsStats.data.total_drugs,
        });

        // Secondary stats
        setSecondaryStats({
          completedPrescriptions: prescriptionsStats.data.completed_prescriptions,
          expiredPrescriptions: prescriptionsStats.data.expired_prescriptions,
          cancelledPrescriptions: prescriptionsStats.data.cancelled_prescriptions,
          pendingPrescriptions: prescriptionsStats.data.pending_prescriptions,
        });

        // Generate mock chart data for last 7 days
        const mockChartData = generateChartData();
        setChartData(mockChartData);

        setRecentActivity(prescriptionsList.data.results || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    return () => {
      setHeroStats({ totalPatients: 0, activePrescriptions: 0, totalMedications: 0 });
      setSecondaryStats({ completedPrescriptions: 0, expiredPrescriptions: 0, cancelledPrescriptions: 0, pendingPrescriptions: 0 });
      setChartData([]);
      setRecentActivity([]);
    };
  }, []);

  const generateChartData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({
      day,
      active: Math.floor(Math.random() * 15) + 5,
      completed: Math.floor(Math.random() * 10) + 3,
      pending: Math.floor(Math.random() * 8) + 2,
    }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon color="success" />;
      case 'completed':
        return <CheckCircleIcon color="info" />;
      case 'cancelled':
        return <WarningIcon color="error" />;
      case 'expired':
        return <WarningIcon color="warning" />;
      default:
        return <ScheduleIcon color="info" />;
    }
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'active':
        return <Chip label="Active" color="success" size="small" />;
      case 'completed':
        return <Chip label="Completed" color="info" size="small" />;
      case 'cancelled':
        return <Chip label="Cancelled" color="error" size="small" />;
      case 'expired':
        return <Chip label="Expired" color="warning" size="small" />;
      default:
        return <Chip label="Pending" color="warning" size="small" />;
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const handleCardClick = (type, value) => {
    switch (type) {
      case 'patients':
        navigate('/patients');
        break;
      case 'activePrescriptions':
        navigate('/prescriptions', { state: { filter: 'active' } });
        break;
      case 'medications':
        navigate('/medications');
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: '#F7F9FC',
      p: 3,
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h3" sx={{ 
              fontWeight: 700, 
              color: '#212529',
              fontSize: '2.5rem',
              mb: 1
            }}>
              Dashboard
            </Typography>
            <Typography variant="h6" sx={{ 
              color: '#6c757d',
              fontWeight: 400
            }}>
              Welcome back, {user?.full_name || user?.username || 'Doctor'}
            </Typography>
          </Box>
          
          {/* Integrated User Info */}
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body1" sx={{ fontWeight: 600, color: '#212529' }}>
                  {user.full_name || user.username || user.email || 'Doctor'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#6c757d' }}>
                  {user.role?.charAt(0).toUpperCase() + user.role?.slice(1) || 'User'}
                </Typography>
              </Box>
              <Avatar sx={{ 
                width: 48, 
                height: 48, 
                bgcolor: '#4A90E2',
                fontSize: '1.2rem',
                fontWeight: 600
              }}>
                {(user.full_name || user.username || user.email || 'D')[0].toUpperCase()}
              </Avatar>
            </Box>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Hero Section - Most Important Metrics */}
        <Grid item xs={12}>
          <Typography variant="h5" sx={{ 
            fontWeight: 600, 
            color: '#212529', 
            mb: 3,
            fontSize: '1.5rem'
          }}>
            Key Metrics
          </Typography>
        </Grid>

        {/* Hero Cards */}
        <Grid item xs={12} md={4}>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 3,
              border: '1px solid #E8ECF0',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 40px rgba(74, 144, 226, 0.15)',
                borderColor: '#4A90E2'
              }
            }}
            onClick={() => handleCardClick('patients')}
          >
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ 
                    color: '#6c757d', 
                    fontWeight: 500,
                    mb: 1,
                    fontSize: '0.9rem'
                  }}>
                    Total Patients
                  </Typography>
                  <Typography variant="h3" sx={{ 
                    fontWeight: 700, 
                    color: '#212529',
                    fontSize: '2.5rem'
                  }}>
                    {heroStats.totalPatients}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <TrendingUpIcon sx={{ fontSize: 16, color: '#00C49F', mr: 0.5 }} />
                    <Typography variant="body2" sx={{ color: '#00C49F', fontWeight: 500 }}>
                      +12% this month
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ 
                  bgcolor: '#E3F2FD', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <PeopleIcon sx={{ fontSize: 32, color: '#4A90E2' }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 3,
              border: '1px solid #E8ECF0',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 40px rgba(46, 125, 50, 0.15)',
                borderColor: '#2E7D32'
              }
            }}
            onClick={() => handleCardClick('activePrescriptions')}
          >
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ 
                    color: '#6c757d', 
                    fontWeight: 500,
                    mb: 1,
                    fontSize: '0.9rem'
                  }}>
                    Active Prescriptions
                  </Typography>
                  <Typography variant="h3" sx={{ 
                    fontWeight: 700, 
                    color: '#212529',
                    fontSize: '2.5rem'
                  }}>
                    {heroStats.activePrescriptions}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <TrendingUpIcon sx={{ fontSize: 16, color: '#00C49F', mr: 0.5 }} />
                    <Typography variant="body2" sx={{ color: '#00C49F', fontWeight: 500 }}>
                      +8% this week
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ 
                  bgcolor: '#E8F5E8', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ReceiptIcon sx={{ fontSize: 32, color: '#2E7D32' }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 3,
              border: '1px solid #E8ECF0',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 40px rgba(2, 136, 209, 0.15)',
                borderColor: '#0288D1'
              }
            }}
            onClick={() => handleCardClick('medications')}
          >
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ 
                    color: '#6c757d', 
                    fontWeight: 500,
                    mb: 1,
                    fontSize: '0.9rem'
                  }}>
                    Total Medications
                  </Typography>
                  <Typography variant="h3" sx={{ 
                    fontWeight: 700, 
                    color: '#212529',
                    fontSize: '2.5rem'
                  }}>
                    {heroStats.totalMedications}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <TrendingUpIcon sx={{ fontSize: 16, color: '#00C49F', mr: 0.5 }} />
                    <Typography variant="body2" sx={{ color: '#00C49F', fontWeight: 500 }}>
                      +5% this month
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ 
                  bgcolor: '#E1F5FE', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MedicationIcon sx={{ fontSize: 32, color: '#0288D1' }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Data Visualization Section */}
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #E8ECF0' }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#212529' }}>
                  Prescription Activity (Last 7 Days)
                </Typography>
                <IconButton size="small">
                  <ArrowForwardIcon />
                </IconButton>
              </Box>
              
              {/* Simple Bar Chart using Material-UI */}
              <Box sx={{ height: 200, display: 'flex', alignItems: 'end', gap: 1, px: 2 }}>
                {chartData.map((data, index) => (
                  <Box key={index} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                      {/* Active */}
                      <Box sx={{ 
                        height: `${(data.active / 20) * 100}px`,
                        bgcolor: '#4A90E2',
                        borderRadius: '4px 4px 0 0',
                        minHeight: 4,
                        width: 20
                      }} />
                      {/* Completed */}
                      <Box sx={{ 
                        height: `${(data.completed / 20) * 100}px`,
                        bgcolor: '#00C49F',
                        borderRadius: '0 0 0 0',
                        minHeight: 4,
                        width: 20
                      }} />
                      {/* Pending */}
                      <Box sx={{ 
                        height: `${(data.pending / 20) * 100}px`,
                        bgcolor: '#FFC107',
                        borderRadius: '0 0 4px 4px',
                        minHeight: 4,
                        width: 20
                      }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: '#6c757d', fontWeight: 500 }}>
                      {data.day}
                    </Typography>
                  </Box>
                ))}
              </Box>
              
              {/* Legend */}
              <Box sx={{ display: 'flex', gap: 3, mt: 3, justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: '#4A90E2', borderRadius: 1 }} />
                  <Typography variant="body2" sx={{ color: '#6c757d' }}>Active</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: '#00C49F', borderRadius: 1 }} />
                  <Typography variant="body2" sx={{ color: '#6c757d' }}>Completed</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: '#FFC107', borderRadius: 1 }} />
                  <Typography variant="body2" sx={{ color: '#6c757d' }}>Pending</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Secondary Stats */}
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #E8ECF0' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#212529', mb: 3 }}>
                Prescription Status
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon sx={{ fontSize: 20, color: '#0288D1' }} />
                    <Typography variant="body2" sx={{ color: '#6c757d' }}>Completed</Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#212529' }}>
                    {secondaryStats.completedPrescriptions}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon sx={{ fontSize: 20, color: '#FFC107' }} />
                    <Typography variant="body2" sx={{ color: '#6c757d' }}>Pending</Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#212529' }}>
                    {secondaryStats.pendingPrescriptions}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon sx={{ fontSize: 20, color: '#FF9800' }} />
                    <Typography variant="body2" sx={{ color: '#6c757d' }}>Expired</Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#212529' }}>
                    {secondaryStats.expiredPrescriptions}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon sx={{ fontSize: 20, color: '#D32F2F' }} />
                    <Typography variant="body2" sx={{ color: '#6c757d' }}>Cancelled</Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#212529' }}>
                    {secondaryStats.cancelledPrescriptions}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity Timeline */}
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #E8ECF0' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#212529', mb: 3 }}>
                Recent Activity
              </Typography>
              {recentActivity.length > 0 ? (
                <List sx={{ p: 0 }}>
                  {recentActivity.map((activity, index) => (
                    <React.Fragment key={activity.id}>
                      <ListItem sx={{ px: 0, py: 2 }}>
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <Box sx={{ 
                            bgcolor: '#E3F2FD', 
                            borderRadius: 2, 
                            p: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <LocalHospitalIcon sx={{ fontSize: 20, color: '#4A90E2' }} />
                          </Box>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body1" sx={{ fontWeight: 600, color: '#212529' }}>
                                New prescription created for {activity.patient_details?.full_name}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <AccessTimeIcon sx={{ fontSize: 16, color: '#6c757d' }} />
                                <Typography variant="body2" sx={{ color: '#6c757d' }}>
                                  {formatTimeAgo(activity.created_at)}
                                </Typography>
                              </Box>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="body2" sx={{ color: '#6c757d', mb: 1 }}>
                                {activity.medications?.[0]?.drug_details?.name || 'Unknown medication'} - {activity.medications?.[0]?.dosage || 'N/A'}
                              </Typography>
                              {getStatusChip(activity.status)}
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < recentActivity.length - 1 && <Divider sx={{ mx: 5 }} />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <LocalHospitalIcon sx={{ fontSize: 48, color: '#E0E0E0', mb: 2 }} />
                  <Typography variant="body1" sx={{ color: '#6c757d' }}>
                    No recent activity
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #E8ECF0' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#212529', mb: 3 }}>
                Quick Actions
              </Typography>
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<PersonAddIcon />}
                  onClick={() => navigate('/patients')}
                  sx={{
                    bgcolor: '#4A90E2',
                    borderRadius: 2,
                    py: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '1rem',
                    '&:hover': {
                      bgcolor: '#357ABD'
                    }
                  }}
                >
                  Add New Patient
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PostAddIcon />}
                  onClick={() => navigate('/prescriptions')}
                  sx={{
                    bgcolor: '#00C49F',
                    borderRadius: 2,
                    py: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '1rem',
                    '&:hover': {
                      bgcolor: '#00A085'
                    }
                  }}
                >
                  Create Prescription
                </Button>
                <Button
                  variant="contained"
                  startIcon={<ScienceIcon />}
                  onClick={() => navigate('/medications')}
                  sx={{
                    bgcolor: '#FFC107',
                    color: '#212529',
                    borderRadius: 2,
                    py: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '1rem',
                    '&:hover': {
                      bgcolor: '#FFB300'
                    }
                  }}
                >
                  Review Interactions
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AssessmentIcon />}
                  onClick={() => navigate('/')}
                  sx={{
                    borderColor: '#4A90E2',
                    color: '#4A90E2',
                    borderRadius: 2,
                    py: 1.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '1rem',
                    '&:hover': {
                      borderColor: '#357ABD',
                      bgcolor: '#F3F8FF'
                    }
                  }}
                >
                  Generate Reports
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 