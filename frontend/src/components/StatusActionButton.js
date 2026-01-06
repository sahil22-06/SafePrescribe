import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import {
  PlayArrow as StartIcon,
  CheckCircle as CompleteIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';

const StatusActionButton = ({ 
  status, 
  onClick, 
  loading = false, 
  disabled = false,
  size = 'small',
  variant = 'contained'
}) => {
  const getButtonConfig = () => {
    switch (status) {
      case 'scheduled':
      case 'waiting':
        return {
          text: 'Start Consultation',
          icon: <StartIcon />,
          color: 'primary',
          sx: {
            backgroundColor: '#3b82f6',
            '&:hover': {
              backgroundColor: '#2563eb',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
            },
            transition: 'all 0.2s ease',
            fontWeight: 600,
            textTransform: 'none'
          }
        };
      case 'in_progress':
        return {
          text: 'Mark as Completed',
          icon: <CompleteIcon />,
          color: 'success',
          sx: {
            backgroundColor: '#16a34a',
            '&:hover': {
              backgroundColor: '#15803d',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.4)'
            },
            transition: 'all 0.2s ease',
            fontWeight: 600,
            textTransform: 'none'
          }
        };
      case 'completed':
        return {
          text: 'Completed',
          icon: <CompleteIcon />,
          color: 'default',
          sx: {
            backgroundColor: '#6b7280',
            color: 'white',
            cursor: 'not-allowed',
            fontWeight: 600,
            textTransform: 'none'
          }
        };
      case 'cancelled':
        return {
          text: 'Cancelled',
          icon: <ScheduleIcon />,
          color: 'default',
          sx: {
            backgroundColor: '#dc2626',
            color: 'white',
            cursor: 'not-allowed',
            fontWeight: 600,
            textTransform: 'none'
          }
        };
      default:
        return {
          text: 'Unknown Status',
          icon: <ScheduleIcon />,
          color: 'default',
          sx: {
            backgroundColor: '#6b7280',
            color: 'white',
            cursor: 'not-allowed',
            fontWeight: 600,
            textTransform: 'none'
          }
        };
    }
  };

  const config = getButtonConfig();
  const isActionable = ['scheduled', 'waiting', 'in_progress'].includes(status);

  return (
    <Button
      variant={variant}
      size={size}
      color={config.color}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : config.icon}
      onClick={onClick}
      disabled={disabled || loading || !isActionable}
      sx={config.sx}
    >
      {config.text}
    </Button>
  );
};

export default StatusActionButton;
