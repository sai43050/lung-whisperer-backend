import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

// Add interceptor to append JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = async (username, password) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  
  const response = await api.post(`/auth/login`, formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  
  if (response.data && response.data.access_token) {
    localStorage.setItem('access_token', response.data.access_token);
    // Persist full user model for frontend metadata mapping
    localStorage.setItem('user', JSON.stringify({
      user_id: response.data.user_id,
      username: response.data.username,
      role: response.data.role,
      full_name: response.data.full_name
    }));
  }
  return response.data;
};

export const register = async (username, password, role, fullName) => {
  const response = await api.post(`/auth/register`, { username, password, role, full_name: fullName });
  return response.data;
};

export const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    if (!user) return null;
    return JSON.parse(user);
  } catch (error) {
    console.error("Critical Auth State Failure. Purging local storage.", error);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    return null;
  }
};

export const logout = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('access_token');
};

export const predictScan = async (userId, file) => {
  const formData = new FormData();
  formData.append('user_id', userId);
  formData.append('file', file);

  const response = await api.post('/predict', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const predictAudio = async (userId, file) => {
  const formData = new FormData();
  formData.append('user_id', userId);
  formData.append('file', file);

  const response = await api.post('/predict/audio', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getHistory = async (userId) => {
  const response = await api.get(`/history?user_id=${userId}`);
  return response.data;
};

export const getScanResult = async (scanId) => {
  const response = await api.get(`/scan/${scanId}`);
  return response.data;
};

// --- Monitoring APIs ---

export const simulateVitals = async (userId, spo2, respiratoryRate, heartRate) => {
  const response = await api.post('/vitals', {
    user_id: userId,
    spo2: spo2,
    respiratory_rate: respiratoryRate,
    heart_rate: heartRate
  });
  return response.data;
};

export const getVitals = async (userId) => {
  const response = await api.get(`/vitals/${userId}`);
  return response.data;
};

export const getVitalsHistory = async (userId) => {
  const response = await api.get(`/vitals/${userId}/history`);
  return response.data;
};

export const getAlerts = async (userId) => {
  const response = await api.get(`/alerts/${userId}`);
  return response.data;
};

export const getAllPatients = async () => {
  const response = await api.get('/patients');
  return response.data;
};

export const getPatients = getAllPatients;

export const updateReport = async (userId, reportText) => {
  const response = await api.post(`/patients/${userId}/report`, { report: reportText });
  return response.data;
};

// --- Generative AI APIs ---
export const generateMedicalReport = async (userId) => {
  const response = await api.get(`/ai/report/${userId}`);
  return response.data;
};

export const sendAIChatMessage = async (message) => {
  const response = await api.post('/ai/chat', { message });
  return response.data;
};

// --- Medications APIs ---
export const getMedications = async () => {
  const response = await api.get('/medications');
  return response.data;
};

export const addMedication = async (name, dosage, time) => {
  const response = await api.post('/medications', { name, dosage, time });
  return response.data;
};

export const toggleMedication = async (medId) => {
  const response = await api.patch(`/medications/${medId}/toggle`);
  return response.data;
};

export const deleteMedication = async (medId) => {
  const response = await api.delete(`/medications/${medId}`);
  return response.data;
};

// --- Smoking Profile APIs ---
export const getSmokingProfile = async () => {
  const response = await api.get('/user/smoking-profile');
  return response.data;
};

export const updateSmokingProfile = async (profileData) => {
  const response = await api.patch('/user/smoking-profile', profileData);
  return response.data;
};

// --- Breathing exercise APIs ---
export const logBreathingSession = async (technique, rounds, durationMinutes) => {
  const response = await api.post('/breathing', { technique, rounds, duration_minutes: durationMinutes });
  return response.data;
};

export const getBreathingHistory = async () => {
  const response = await api.get('/breathing/history');
  return response.data;
};

export default api;
