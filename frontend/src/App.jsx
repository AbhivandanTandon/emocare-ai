import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Login           from './pages/Login';
import Register        from './pages/Register';
import Chat            from './pages/Chat';
import IntakeForm      from './pages/IntakeForm';
import AdminDashboard  from './pages/AdminDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import './App.css';

function Guard({ children, roles }) {
  const { user, token } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={
      user.role === 'admin' ? '/admin' :
      user.role === 'therapist' ? '/therapist' : '/chat'
    } replace />;
  }
  return children;
}

export default function App() {
  const { user, token } = useAuthStore();

  const defaultRoute = !token ? '/login'
    : user?.role === 'admin'     ? '/admin'
    : user?.role === 'therapist' ? '/therapist'
    : '/chat';

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background:   'var(--c00)',
            color:        'var(--text-1)',
            border:       '1px solid var(--border-2)',
            borderRadius: '8px',
            fontSize:     '14px',
            boxShadow:    'var(--shadow-md)',
          },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/login"    element={!token ? <Login />    : <Navigate to={defaultRoute} />} />
        <Route path="/register" element={!token ? <Register /> : <Navigate to={defaultRoute} />} />

        {/* User */}
        <Route path="/intake" element={<Guard><IntakeForm /></Guard>} />
        <Route path="/chat"   element={<Guard><Chat /></Guard>} />

        {/* Admin */}
        <Route path="/admin" element={
          <Guard roles={['admin']}><AdminDashboard /></Guard>
        } />

        {/* Doctor */}
        <Route path="/therapist" element={
          <Guard roles={['therapist', 'admin']}><DoctorDashboard /></Guard>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </BrowserRouter>
  );
}