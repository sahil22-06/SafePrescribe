import api from './api';

// Clinic Management API
export const clinicAPI = {
  // Dashboard Statistics
  getDashboardStats: () => api.get('/clinic/stats/'),
  
  // Appointments
  getAppointments: (params) => api.get('/appointments/', { params }),
  createAppointment: (data) => api.post('/appointments/', data),
  updateAppointment: (id, data) => api.put(`/appointments/${id}/`, data),
  deleteAppointment: (id) => api.delete(`/appointments/${id}/`),
  checkInAppointment: (id) => api.post(`/appointments/${id}/check_in/`),
  cancelAppointment: (id) => api.post(`/appointments/${id}/cancel/`),
  
  // Queue Management
  getDoctorQueue: (doctorId) => api.get(`/queues/doctor/${doctorId}/`),
  getQueues: (params) => api.get('/queues/', { params }),
  addToQueue: (data) => api.post('/queues/', data),
  removeFromQueue: (id) => api.delete(`/queues/${id}/`),
  
  // Consultations
  getConsultations: (params) => api.get('/consultations/', { params }),
  startConsultation: (data) => api.post('/consultations/start/', data),
  endConsultation: (data) => api.post('/consultations/end/', data),
  updateConsultation: (id, data) => api.put(`/consultations/${id}/`, data),
};

export default clinicAPI;
