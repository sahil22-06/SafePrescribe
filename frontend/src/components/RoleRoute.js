import React from 'react';
import { Navigate } from 'react-router-dom';

const RoleRoute = ({ children, allowedRoles = [], forbidden = '/' }) => {
  const token = localStorage.getItem('authToken');
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user')) || JSON.parse(localStorage.getItem('userData'));
  } catch {
    try { user = JSON.parse(localStorage.getItem('userData')); } catch { user = null; }
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={forbidden} replace />;
  }

  return children;
};

export default RoleRoute;


