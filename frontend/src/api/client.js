import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// In local dev the Vite proxy forwards /api → localhost:8000.
// In production (Vercel) set VITE_API_URL to the backend (e.g. https://emocare-api.up.railway.app/api).
const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

API.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;