import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper function to validate token with backend
const validateToken = async (token) => {
  try {
    const response = await authAPI.getProfile();
    return response.status === 200;
  } catch (error) {
    console.log('Token validation failed:', error.response?.status);
    return false;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on app start
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');
    
    console.log('AuthContext: Checking localStorage - token:', !!token, 'userData:', !!userData);
    
    if (token && userData) {
      try {
        // Validate token with backend before setting user
        validateToken(token).then((isValid) => {
          console.log('AuthContext: Token validation result:', isValid);
          if (isValid) {
            const parsedUser = JSON.parse(userData);
            console.log('AuthContext: Setting user from localStorage:', parsedUser);
            setUser(parsedUser);
          } else {
            console.log('AuthContext: Token invalid, clearing storage');
            // Token is invalid, clear storage
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            setUser(null);
          }
          setLoading(false);
        }).catch((error) => {
          console.error('Token validation error:', error);
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          setUser(null);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        setUser(null);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = (userData) => {
    console.log('AuthContext: Setting user data:', userData);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    console.log('AuthContext: User data saved to localStorage');
  };

  const logout = () => {
    console.log('AuthContext: Logging out user');
    setUser(null);
    
    // Clear all authentication-related data
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userData'); // Clear any additional user data
    
    // Clear any other cached data
    localStorage.removeItem('patients');
    localStorage.removeItem('prescriptions');
    localStorage.removeItem('drugs');
    
    // Clear session storage as well
    sessionStorage.clear();
    
    // Force redirect to login
    window.location.href = '/login';
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 