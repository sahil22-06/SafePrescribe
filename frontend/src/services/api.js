import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('API: 401 Unauthorized - clearing auth data');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('userData');
      sessionStorage.clear();

      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login/', credentials),
  register: (userData) => api.post('/auth/register/', userData),
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (userData) => api.put('/auth/profile/update/', userData),
  getDoctors: () => api.get('/auth/doctors/'),
};

// Patients API
export const patientsAPI = {
  getAll: (params) => api.get('/patients/', { params }),
  getById: (id) => api.get(`/patients/${id}/`),
  create: (patientData) => api.post('/patients/', patientData),
  update: (id, patientData) => api.put(`/patients/${id}/`, patientData),
  delete: (id) => api.delete(`/patients/${id}/`),
  getStats: () => api.get('/patients/stats/'),
};

// Drugs API
export const drugsAPI = {
  getAll: (params) => api.get('/drugs/', { params }),
  getById: (id) => api.get(`/drugs/${id}/`),
  create: (drugData) => api.post('/drugs/', drugData),
  update: (id, drugData) => api.put(`/drugs/${id}/`, drugData),
  delete: (id) => api.delete(`/drugs/${id}/`),
  getStats: () => api.get('/drugs/stats/'),
};

// Prescriptions API
export const prescriptionsAPI = {
  getAll: (params) => api.get('/prescriptions/', { params }),
  getById: (id) => api.get(`/prescriptions/${id}/`),
  create: (prescriptionData) => api.post('/prescriptions/', prescriptionData),
  update: (id, prescriptionData) => api.put(`/prescriptions/${id}/`, prescriptionData),
  delete: (id) => api.delete(`/prescriptions/${id}/`),
  getStats: () => api.get('/prescriptions/stats/'),
};

// Allergies API
export const allergiesAPI = {
  getAll: (params) => api.get('/allergies/', { params }),
  getById: (id) => api.get(`/allergies/${id}/`),
  create: (allergyData) => api.post('/allergies/', allergyData),
  update: (id, allergyData) => api.put(`/allergies/${id}/`, allergyData),
  delete: (id) => api.delete(`/allergies/${id}/`),
};

// Medication Conflict Checking API
export const conflictAPI = {
  checkConflict: (data) => api.post('/medications/check-conflict/', data),
  checkPrescriptionInteractions: (data) => api.post('/medications/check-prescription-interactions/', data),
  checkAllergyOnly: (data) => api.post('/medications/check-allergy-only/', data),
};

// Standard Suggestions API
export const suggestionsAPI = {
  getAllergyAwareSuggestions: (data) => api.post('/suggestions/allergy-aware/', data),
  getBasicSuggestions: (data) => api.post('/suggestions/basic/', data),
};

// AI-Enhanced Suggestions API
export const aiSuggestionsAPI = {
  getEnhancedSuggestions: (data) => api.post('/ai-suggestions/enhanced/', data),
  analyzeCondition: (data) => api.post('/ai-suggestions/analyze-condition/', data),
  getSafetyAnalysis: (data) => api.post('/ai-suggestions/safety-analysis/', data),
};

export default api; 