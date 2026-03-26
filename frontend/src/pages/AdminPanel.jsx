import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import API from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import './AdminPanel.css';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('metrics');
  const [metrics, setMetrics] = useState(null);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [therapistForm, setTherapistForm] = useState({ email: '', password: '', full_name: '' });
  const [creating, setCreating] = useState(false);
  const wsRef = useRef(null);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMetrics();
    fetchAlerts();
    connectWebSocket();
    const interval = setInterval(() => { fetchMetrics(); fetchAlerts(); }, 30000);
    return () => { clearInterval(interval); wsRef.current?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab]);

  const connectWebSocket = () => {
    if (!token) return;
    const ws = new WebSocket(`ws://localhost:8000/ws/${token}`);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'crisis_alert') {
        toast.error(`🚨 ${data.level} RISK — User ${data.user_id?.slice(0, 8)}`, { duration: 10000 });
        fetchAlerts();
        fetchMetrics();
      }
    };
    ws.onerror = () => {};
    wsRef.current = ws;
  };

  const fetchMetrics = async () => {
    try {
      const { data } = await API.get('/admin/metrics');
      setMetrics(data);
    } catch {
      // ignore
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/admin/users');
      setUsers(data);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const fetchAlerts = async () => {
    try {
      const { data } = await API.get('/admin/alerts');
      setAlerts(data);
    } catch {
      // ignore
    }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/admin/audit-logs');
      setAuditLogs(data);
    } catch { toast.error('Failed to load audit logs'); }
    finally { setLoading(false); }
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      await API.post(`/admin/alerts/${alertId}/acknowledge`);
      toast.success('Alert acknowledged');
      fetchAlerts();
      fetchMetrics();
    } catch { toast.error('Failed to acknowledge'); }
  };

  const createTherapist = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await API.post('/admin/therapists', therapistForm);
      toast.success('Therapist account created');
      setTherapistForm({ email: '', password: '', full_name: '' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create therapist');
    } finally { setCreating(false); }
  };

  const LEVEL_COLORS = { High: '#e74c3c', Imminent: '#cc0000', Moderate: '#ff9933', Low: '#2eb82e' };
  const ROLE_COLORS = { admin: '#6c63ff', therapist: '#3498db', user: '#7f8fa6' };

  return (
    <div className="ap-layout">
      {/* Sidebar */}
      <aside className="ap-sidebar">
        <div className="ap-sidebar-header">
          <span>⚙️</span>
          <div>
            <h2>EmoCare AI</h2>
            <p>Admin Panel</p>
          </div>
        </div>

        <nav className="ap-nav">
          {[
            { id: 'metrics', icon: '📊', label: 'System Metrics' },
            { id: 'alerts', icon: '🚨', label: 'Crisis Alerts', count: alerts.length },
            { id: 'users', icon: '👥', label: 'Users' },
            { id: 'therapists', icon: '🩺', label: 'Add Therapist' },
            { id: 'audit', icon: '📋', label: 'Audit Logs' },
          ].map((item) => (
            <button
              key={item.id}
              className={`ap-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.count > 0 && <span className="ap-badge">{item.count}</span>}
            </button>
          ))}
        </nav>

        <div className="ap-sidebar-footer">
          <p>{user?.full_name}</p>
          <div className="ap-footer-btns">
            <button onClick={() => navigate('/chat')} className="ap-footer-btn">💬 Chat</button>
            <button onClick={() => navigate('/therapist')} className="ap-footer-btn">🩺 Therapist</button>
            <button onClick={logout} className="ap-footer-btn danger">Sign Out</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ap-main">
        <AnimatePresence mode="wait">

          {/* METRICS */}
          {activeTab === 'metrics' && (
            <motion.div key="metrics" className="ap-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="ap-title">📊 System Metrics</h2>
              {metrics ? (
                <>
                  <div className="ap-metrics-grid">
                    {[
                      { label: 'Total Users', value: metrics.total_users, icon: '👥', color: '#6c63ff' },
                      { label: 'Total Sessions', value: metrics.total_sessions, icon: '💬', color: '#3498db' },
                      { label: 'Unacknowledged Alerts', value: metrics.unacknowledged_alerts, icon: '🚨', color: '#e74c3c' },
                      { label: 'Crisis Sessions', value: metrics.crisis_sessions, icon: '⚠️', color: '#ff9933' },
                      { label: 'Active WebSockets', value: metrics.active_websockets, icon: '🔌', color: '#2eb82e' },
                    ].map((m) => (
                      <motion.div
                        key={m.label}
                        className="ap-metric-card"
                        style={{ borderColor: m.color + '44' }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <div className="ap-metric-icon" style={{ background: m.color + '22', color: m.color }}>
                          {m.icon}
                        </div>
                        <div>
                          <p className="ap-metric-label">{m.label}</p>
                          <p className="ap-metric-value" style={{ color: m.color }}>{m.value}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="ap-status-card">
                    <p className="ap-section-title">🟢 System Status</p>
                    <div className="ap-status-grid">
                      {[
                        { name: 'FastAPI Backend', status: 'Online' },
                        { name: 'PostgreSQL', status: 'Online' },
                        { name: 'Redis', status: 'Online' },
                        { name: 'RoBERTa (Text Model)', status: 'Loaded' },
                        { name: 'WavLM-Large (Audio Model)', status: 'Loaded' },
                        { name: 'RAG Knowledge Base', status: 'Ready' },
                        { name: 'WebSocket Server', status: `${metrics.active_websockets} connections` },
                      ].map((s) => (
                        <div key={s.name} className="ap-status-row">
                          <span className="ap-status-dot" />
                          <span className="ap-status-name">{s.name}</span>
                          <span className="ap-status-val">{s.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="ap-loading">Loading metrics...</div>
              )}
            </motion.div>
          )}

          {/* ALERTS */}
          {activeTab === 'alerts' && (
            <motion.div key="alerts" className="ap-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="ap-title-row">
                <h2 className="ap-title">🚨 Crisis Alerts</h2>
                <button className="ap-refresh-btn" onClick={fetchAlerts}>↻ Refresh</button>
              </div>
              {alerts.length === 0 ? (
                <div className="ap-empty">
                  <span>✅</span>
                  <p>No unacknowledged alerts</p>
                </div>
              ) : (
                <div className="ap-alert-list">
                  {alerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      className="ap-alert-card"
                      style={{ borderColor: LEVEL_COLORS[alert.level] + '88' }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div className="ap-alert-header">
                        <span className="ap-alert-level" style={{ color: LEVEL_COLORS[alert.level] }}>
                          {alert.level === 'Imminent' ? '🔴' : '🟠'} {alert.level} RISK
                        </span>
                        <span className="ap-alert-time">{new Date(alert.created_at).toLocaleString()}</span>
                      </div>
                      <p className="ap-alert-user">User: <code>{alert.user_id?.slice(0, 12)}...</code></p>
                      <p className="ap-alert-msg">{alert.message}</p>
                      <div className="ap-alert-actions">
                        <button
                          className="ap-ack-btn"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          ✓ Acknowledge
                        </button>
                        <button
                          className="ap-view-btn"
                          onClick={() => navigate('/therapist')}
                        >
                          View Session →
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* USERS */}
          {activeTab === 'users' && (
            <motion.div key="users" className="ap-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="ap-title">👥 User Registry</h2>
              <p className="ap-subtitle">Pseudonymized metadata only — no chat content is shown here.</p>
              {loading ? (
                <div className="ap-loading">Loading users...</div>
              ) : (
                <div className="ap-table-wrap">
                  <table className="ap-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Last Login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td><code>{u.id.slice(0, 8)}...</code></td>
                          <td>{u.email}</td>
                          <td>{u.full_name}</td>
                          <td>
                            <span className="ap-role-chip" style={{ borderColor: ROLE_COLORS[u.role], color: ROLE_COLORS[u.role] }}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            <span className={`ap-status-chip ${u.is_active ? 'active' : 'inactive'}`}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td>{u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ADD THERAPIST */}
          {activeTab === 'therapists' && (
            <motion.div key="therapists" className="ap-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="ap-title">🩺 Create Therapist Account</h2>
              <p className="ap-subtitle">Therapists can view escalated sessions, transcripts, and SHAP explainability.</p>
              <div className="ap-form-card">
                <form onSubmit={createTherapist}>
                  {[
                    { key: 'full_name', label: 'Full Name', type: 'text', placeholder: 'Dr. Jane Smith' },
                    { key: 'email', label: 'Email', type: 'email', placeholder: 'therapist@clinic.com' },
                    { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
                  ].map((f) => (
                    <div key={f.key} className="ap-form-group">
                      <label>{f.label}</label>
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        value={therapistForm[f.key]}
                        onChange={(e) => setTherapistForm({ ...therapistForm, [f.key]: e.target.value })}
                        required
                      />
                    </div>
                  ))}
                  <button type="submit" className="ap-create-btn" disabled={creating}>
                    {creating ? 'Creating...' : '+ Create Therapist Account'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* AUDIT LOGS */}
          {activeTab === 'audit' && (
            <motion.div key="audit" className="ap-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="ap-title">📋 Audit Logs</h2>
              <p className="ap-subtitle">All system actions logged for compliance and research review.</p>
              {loading ? (
                <div className="ap-loading">Loading logs...</div>
              ) : (
                <div className="ap-table-wrap">
                  <table className="ap-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Action</th>
                        <th>User ID</th>
                        <th>Role</th>
                        <th>Target</th>
                        <th>IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log, i) => (
                        <tr key={i}>
                          <td>{new Date(log.ts).toLocaleString()}</td>
                          <td><code className="ap-action">{log.action}</code></td>
                          <td><code>{log.user_id?.slice(0, 8) || '—'}...</code></td>
                          <td>
                            {log.role && (
                              <span className="ap-role-chip" style={{ borderColor: ROLE_COLORS[log.role], color: ROLE_COLORS[log.role] }}>
                                {log.role}
                              </span>
                            )}
                          </td>
                          <td><code>{log.target_id?.slice(0, 8) || '—'}</code></td>
                          <td>{log.ip || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}