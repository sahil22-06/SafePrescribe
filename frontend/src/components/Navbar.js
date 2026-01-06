import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem,
  Avatar,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Medication as MedicationIcon,
  Receipt as ReceiptIcon,
  Menu as MenuIcon,
  AccountCircle as AccountCircleIcon,
  Science as ScienceIcon,
  LocalHospital as ClinicIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
    { label: 'Patients', path: '/patients', icon: <PeopleIcon /> },
    { label: 'Prescriptions', path: '/prescriptions', icon: <ReceiptIcon /> },
    { label: 'Medications', path: '/medications', icon: <MedicationIcon /> },
    { label: 'Clinic', path: '/clinic', icon: <ClinicIcon /> },
    { label: 'Conflict Checker', path: '/prescription-workflow', icon: <ScienceIcon /> },
  ];

  // Add receptionist-specific navigation
  const receptionistNavItems = [
    { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
    { label: 'Patients', path: '/patients', icon: <PeopleIcon /> },
    { label: 'Prescriptions', path: '/prescriptions', icon: <ReceiptIcon /> },
    { label: 'Medications', path: '/medications', icon: <MedicationIcon /> },
    { label: 'Receptionist Portal', path: '/receptionist-portal', icon: <ClinicIcon /> },
    { label: 'Conflict Checker', path: '/prescription-workflow', icon: <ScienceIcon /> },
  ];

  // Choose navigation items based on user role
  const getNavItems = () => {
    if (user?.role === 'receptionist') {
      return receptionistNavItems;
    }
    return navItems;
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleClose();
  };

  return (
    <AppBar position="static" elevation={2}>
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 0, mr: 4, fontWeight: 'bold' }}
        >
          SafePrescribe
        </Typography>
        
        {isMobile ? (
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ ml: 'auto' }}
          >
            <MenuIcon />
          </IconButton>
        ) : (
          <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
            {getNavItems().map((item) => (
              <Button
                key={item.path}
                color="inherit"
                startIcon={item.icon}
                onClick={() => navigate(item.path)}
                sx={{
                  backgroundColor: location.pathname === item.path ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>
        )}
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ mr: 2, color: 'rgba(255, 255, 255, 0.8)' }}>
            {user?.full_name || user?.username || user?.email || 'User'}
          </Typography>
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
              <AccountCircleIcon />
            </Avatar>
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem onClick={() => { handleClose(); navigate('/profile'); }}>Profile</MenuItem>
            <MenuItem onClick={() => { handleClose(); navigate('/settings'); }}>Settings</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar; 