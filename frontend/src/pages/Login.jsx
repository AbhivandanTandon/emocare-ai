import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import API from '../api/client';
import { useAuthStore } from '../store/authStore';
import Logo from '../components/Logo';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const form = new FormData();
      form.append('username', email);
      form.append('password', password);
      const { data } = await API.post('/auth/login', form);
      login(
        { email, role: data.role, user_id: data.user_id, full_name: data.full_name },
        data.access_token
      );
      toast.success(`Welcome back, ${data.full_name}`);
      navigate(
        data.role === 'admin' ? '/admin' :
        data.role === 'therapist' ? '/therapist' : '/chat'
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-grid" />

      <motion.div
        className="auth-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Wordmark */}
        <div className="auth-wordmark">
          <div className="auth-wordmark-logo">
            <Logo size={22} animated />
          </div>
          <div className="auth-wordmark-text">
            Emo<span>Care</span> AI
          </div>
        </div>

        {/* Card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <h1 className="auth-card-title">Sign in</h1>
            <p className="auth-card-sub">Access your mental health dashboard</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="input-label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label className="input-label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="auth-submit">
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="dots"><span /><span /><span /></span>
                ) : (
                  'Continue →'
                )}
              </button>
            </div>
          </form>

          <div className="auth-card-footer">
            <div className="auth-link-row">
              Don't have an account? <Link to="/register">Create one</Link>
            </div>
            <div className="auth-warning">
              ⚠️ Research prototype only — not a clinical diagnostic tool
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}