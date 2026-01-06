import React, { useState } from 'react';
import {
  Box, Snackbar, Alert
} from '@mui/material';
import DoctorQueueDashboard from '../components/DoctorQueueDashboard';

const Clinic = () => {
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = () => {
    setToast({ open: false, message: '', severity: 'success' });
  };

  return (
    <Box sx={{ width: '100%', minHeight: '100vh' }}>
      {/* Doctor Queue Dashboard */}
      <DoctorQueueDashboard showToast={showToast} />

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

export default Clinic;