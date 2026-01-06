import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Prescriptions from './pages/Prescriptions';
import Medications from './pages/Medications';
import Login from './pages/Login';
import Signup from './pages/Signup';
import PatientProfile from './pages/PatientProfile';
import PrescriptionWorkflow from './components/PrescriptionWorkflow';
import Clinic from './pages/Clinic';
import ReceptionistPortal from './pages/ReceptionistPortal';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                  <Navbar />
                  <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                    <Dashboard />
                  </Box>
                </Box>
              </ProtectedRoute>
            } />
            <Route path="/patients" element={
              <ProtectedRoute>
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                  <Navbar />
                  <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                    <Patients />
                  </Box>
                </Box>
              </ProtectedRoute>
            } />
            <Route path="/prescriptions" element={
              <ProtectedRoute>
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                  <Navbar />
                  <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                    <Prescriptions />
                  </Box>
                </Box>
              </ProtectedRoute>
            } />
            <Route path="/medications" element={
              <ProtectedRoute>
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                  <Navbar />
                  <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                    <Medications />
                  </Box>
                </Box>
              </ProtectedRoute>
            } />
            <Route path="/patients/:id" element={
              <ProtectedRoute>
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                  <Navbar />
                  <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                    <PatientProfile />
                  </Box>
                </Box>
              </ProtectedRoute>
            } />
            <Route path="/prescription-workflow" element={
              <ProtectedRoute>
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                  <Navbar />
                  <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                    <PrescriptionWorkflow />
                  </Box>
                </Box>
              </ProtectedRoute>
            } />
            <Route path="/clinic" element={
              <ProtectedRoute>
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                  <Navbar />
                  <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                    <Clinic />
                  </Box>
                </Box>
              </ProtectedRoute>
            } />
            <Route path="/receptionist-portal" element={
              <RoleRoute allowedRoles={['receptionist']} forbidden="/login">
                <ReceptionistPortal />
              </RoleRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
