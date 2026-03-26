import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user:  JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('access_token') || null,

  login: (userData, token) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    set({ user: userData, token });
  },

  logout: () => {
    localStorage.clear();
    set({ user: null, token: null });
  },
}));