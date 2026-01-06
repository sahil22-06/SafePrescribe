import React from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Card, CardContent, Typography, Box, Avatar, Chip, Divider, Grid, Paper } from '@mui/material';
import { blue, grey } from '@mui/material/colors';

const Profile = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: grey[100] }}>
      <Navbar />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
        <Card sx={{ maxWidth: 480, width: '100%', borderRadius: 4, boxShadow: 6, background: 'white' }}>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
              <Avatar sx={{ width: 96, height: 96, bgcolor: blue[700], fontSize: 40, mb: 2, boxShadow: 3 }}>
                {(user.full_name || user.username || user.email || 'U')[0].toUpperCase()}
              </Avatar>
              <Typography variant="h4" fontWeight={700} color={blue[700]} gutterBottom>
                {user.full_name || user.username || 'User'}
              </Typography>
              <Chip label={user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'} color="primary" sx={{ fontWeight: 600, fontSize: 16, bgcolor: blue[50], color: blue[700], mb: 1 }} />
              <Typography variant="body1" color={blue[500]} sx={{ mb: 1 }}>
                {user.email}
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: blue[50], borderRadius: 2 }}>
                  <Typography variant="subtitle2" color={blue[700]}>First Name</Typography>
                  <Typography variant="body1" fontWeight={500}>{user.first_name || '-'}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: blue[50], borderRadius: 2 }}>
                  <Typography variant="subtitle2" color={blue[700]}>Last Name</Typography>
                  <Typography variant="body1" fontWeight={500}>{user.last_name || '-'}</Typography>
                </Paper>
              </Grid>
              {user.license_number && (
                <Grid item xs={12} sm={6}>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: blue[50], borderRadius: 2 }}>
                    <Typography variant="subtitle2" color={blue[700]}>License Number</Typography>
                    <Typography variant="body1" fontWeight={500}>{user.license_number}</Typography>
                  </Paper>
                </Grid>
              )}
              {user.phone && (
                <Grid item xs={12} sm={6}>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: blue[50], borderRadius: 2 }}>
                    <Typography variant="subtitle2" color={blue[700]}>Phone</Typography>
                    <Typography variant="body1" fontWeight={500}>{user.phone}</Typography>
                  </Paper>
                </Grid>
              )}
              {user.address && (
                <Grid item xs={12}>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: blue[50], borderRadius: 2 }}>
                    <Typography variant="subtitle2" color={blue[700]}>Address</Typography>
                    <Typography variant="body1" fontWeight={500}>{user.address}</Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Profile; 