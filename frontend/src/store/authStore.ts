import { create } from 'zustand';
import axios from '../services/axios';
import { setAuthToken, removeAuthToken } from '../config/api';

interface User {
  id: number;
  name: string;
  phone: string;
  role: 'user' | 'admin' | 'driver';
  created_at: string;
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  
  requestPin: (phone: string) => Promise<void>;
  validatePin: (phone: string, pin: string) => Promise<void>;
  fetchUserDetails: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  requestPin: async (phone: string) => {
    set({ isLoading: true, error: null });
    try {
      await axios.post('/pin/request-pin', { phone });
      set({ isLoading: false });
    } catch (error: any) {
      set({ 
        isLoading: false, 
        error: error.response?.data?.message || 'Error sending PIN' 
      });
      throw error;
    }
  },

  validatePin: async (phone: string, pin: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post('/pincheck/validate-pin', { phone, pin });
      setAuthToken(response.data.token);
      
      // Fetch user details after successful login
      const userResponse = await axios.get('/auth/user-details');
      set({ 
        user: userResponse.data.user, 
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        isLoading: false, 
        error: error.response?.data?.error || 'PIN invalid sau expirat' 
      });
      throw error;
    }
  },

  fetchUserDetails: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.get('/auth/user-details');
      set({ user: response.data.user, isLoading: false });
    } catch (error: any) {
      set({ user: null, isLoading: false });
      removeAuthToken();
    }
  },

  logout: () => {
    removeAuthToken();
    set({ user: null, error: null });
  },

  clearError: () => {
    set({ error: null });
  }
}));

export default useAuthStore;