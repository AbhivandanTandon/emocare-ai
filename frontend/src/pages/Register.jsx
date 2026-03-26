import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import API from '../api/client';
import { useAuthStore } from '../store/authStore';
import Logo from '../components/Logo';
import './Auth.css';

export default function Register() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!consent) { toast.error('Please accept the research consent'); return; }
    setLoading(true);
    try {
      const { data } = await API.post('/auth/register', form);
      login(
        { email: form.email, role: data.role, user_id: data.user_id, full_name: data.full_name },
        data.access_token
      );
      toast.success('Account created!');
      navigate('/chat');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
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
            <h1 className="auth-card-title">Create account</h1>
            <p className="auth-card-sub">Join the EmoCare AI research platform</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {[
              { key: 'full_name', label: 'Full Name',    type: 'text',     placeholder: 'Your full name'    },
              { key: 'email',     label: 'Email',        type: 'email',    placeholder: 'name@example.com'  },
              { key: 'password',  label: 'Password',     type: 'password', placeholder: '••••••••••'        },
            ].map((f) => (
              <div className="auth-field" key={f.key}>
                <label className="input-label">{f.label}</label>
                <input
                  className="input"
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  required
                />
              </div>
            ))}

            <label className="auth-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="auth-consent-text">
                I understand this is a research prototype. AI outputs are not medical
                diagnoses or clinical recommendations. Emergency: 112 | Tele-MANAS: 14416
              </span>
            </label>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full auth-submit"
              disabled={loading || !consent}
            >
              {loading ? (
                <span className="dots"><span /><span /><span /></span>
              ) : (
                'Create account →'
              )}
            </button>
          </form>

          <div className="auth-card-footer">
            <div className="auth-link-row">
              Already have an account? <Link to="/login">Sign in</Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}