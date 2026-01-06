import React from 'react';
import { AppBar, Toolbar, Typography, Box, Button } from '@mui/material';

const ReceptionistLayout = ({ title = 'Receptionist Portal', onLogout, children }) => {
  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fde68a 0%, #fca5a5 100%)' }}>
      <AppBar position="static" elevation={0} sx={{ background: 'linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' }}>{title}</Typography>
          {onLogout && <Button color="inherit" onClick={onLogout}>Logout</Button>}
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 3 }}>{children}</Box>
    </Box>
  );
};

export default ReceptionistLayout;


