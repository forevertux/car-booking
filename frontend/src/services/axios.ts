import axios from 'axios';
import { API_ENDPOINTS, getAuthToken } from '../config/api';

// Create axios instance
const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor to add auth token and route to correct service
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Route to correct service based on URL path
    const url = config.url || '';
    
    if (url.includes('/pin') || url.includes('/auth') || url.includes('/users') || url.includes('/admin')) {
      config.baseURL = API_ENDPOINTS.USER_SERVICE;
    } else if (url.includes('/bookings')) {
      config.baseURL = API_ENDPOINTS.BOOKING_SERVICE;
    } else if (url.includes('/maintenance')) {
      config.baseURL = API_ENDPOINTS.MAINTENANCE_SERVICE;
    } else if (url.includes('/issues')) {
      config.baseURL = API_ENDPOINTS.ISSUES_SERVICE;
    } else if (url.includes('/notify')) {
      config.baseURL = API_ENDPOINTS.NOTIFICATION_SERVICE;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken');
      // Don't redirect here - let the components handle it via React Router
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;