import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import API from '../api/client';
import AppointmentCalendar from '../components/AppointmentCalendar';
import Logo from '../components/Logo';
import { useAuthStore } from '../store/authStore';
import './AdminDashboard.css';

const TABS = [
  { id: 'Overview',     label: 'Overview',      icon: '▣' },
  { id: 'Users',        label: 'Users',          icon: '◈' },
  { id: 'Alerts',       label: 'Alerts',         icon: '◉' },
  { id: 'Appointments', label: 'Appointments',   icon: '◷' },
  { id: 'Calendar',     label: 'Calendar',       icon: '▦' },
];

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ borderTopColor: color }}>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const logout = useAuthStore((s) => s.logout);
  const user   = useAuthStore((s) => s.user);

  const [tab, setTab]     = useState('Overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts]   = useState([]);
  const [appts, setAppts]     = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, u, a, ap, d] = await Promise.all([
        API.get('/admin/stats'),
        API.get('/admin/users'),
        API.get('/admin/alerts'),
        API.get('/appointments/all'),
        API.get('/appointments/doctors'),
      ]);
      setStats(s.data);
      setUsers(u.data);
      setAlerts(a.data);
      setAppts(ap.data);
      setDoctors(d.data);
    } catch { toast.error('Failed to load dashboard'); }
    finally  { setLoading(false); }
  };

  const updateRole = async (userId, role) => {
    try {
      await API.patch(`/admin/users/${userId}/role`, { role });
      toast.success('Role updated');
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const toggleActive = async (userId) => {
    try {
      await API.patch(`/admin/users/${userId}/toggle`);
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const ackAlert = async (id) => {
    try {
      await API.patch(`/admin/alerts/${id}/acknowledge`);
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const updateAppt = async (id, status, doctorId = null) => {
    try {
      await API.patch(`/appointments/${id}`, { status, doctor_id: doctorId });
      toast.success(`Appointment ${status}`);
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const unread = alerts.filter((a) => !a.is_acknowledged).length;

  return (
    <div className="dash-root">
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-top">
          <div className="dash-brand">
            <Logo size={22} animated />
            <div>
              <div className="dash-brand-name">EmoCare <span>AI</span></div>
              <div className="dash-brand-sub">Admin Console</div>
            </div>
          </div>
        </div>

        <nav className="dash-nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`dash-nav-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="dash-nav-icon">{t.icon}</span>
              {t.label}
              {t.id === 'Alerts' && unread > 0 && (
                <span className="dash-nav-badge">{unread}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <div className="dash-user">
            <div className="dash-avatar">{user?.full_name?.[0]?.toUpperCase()}</div>
            <div>
              <div className="dash-user-name">{user?.full_name}</div>
              <div className="dash-user-role">Administrator</div>
            </div>
          </div>
          <button className="btn btn-danger btn-sm btn-full" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="dash-main">
        <div className="dash-header">
          <h1 className="dash-title">{tab}</h1>
          <button className="btn btn-secondary btn-sm" onClick={fetchAll}>
            Refresh
          </button>
        </div>

        <div className="dash-content">
          {loading ? (
            <div className="dash-loading">
              <div className="dots"><span/><span/><span/></div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {/* Overview */}
                {tab === 'Overview' && stats && (
                  <div>
                    <div className="stat-grid">
                      <StatCard label="Total Users"          value={stats.total_users}           color="var(--c07)" />
                      <StatCard label="Therapists"           value={stats.total_therapists}       color="#4A7C3F"    />
                      <StatCard label="Total Sessions"       value={stats.total_sessions}         color="var(--c06)" />
                      <StatCard label="Unread Alerts"        value={stats.unacknowledged_alerts}  color="#C03820"    />
                      <StatCard label="Pending Appointments" value={stats.pending_appointments}   color="#C07820"    />
                      <StatCard label="High Risk Sessions"   value={stats.high_risk_sessions}     color="#C03820"    />
                    </div>
                    <div className="dash-section">
                      <div className="dash-section-title">Unacknowledged Alerts</div>
                      {alerts.filter((a) => !a.is_acknowledged).slice(0, 5).map((a) => (
                        <div key={a.id} className={`alert-row level-${a.level.toLowerCase()}`}>
                          <div className="alert-level">{a.level}</div>
                          <div className="alert-info">
                            <div className="alert-user">{a.user?.name}</div>
                            <div className="alert-msg">{a.message}</div>
                          </div>
                          <div className="alert-time">
                            {new Date(a.created_at).toLocaleTimeString()}
                          </div>
                          <button className="btn btn-secondary btn-sm" onClick={() => ackAlert(a.id)}>
                            Acknowledge
                          </button>
                        </div>
                      ))}
                      {alerts.filter((a) => !a.is_acknowledged).length === 0 && (
                        <div className="dash-empty">No unacknowledged alerts</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Users */}
                {tab === 'Users' && (
                  <div className="dash-table-wrap">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id}>
                            <td className="td-name">{u.full_name}</td>
                            <td className="td-email">{u.email}</td>
                            <td>
                              <select className="dash-select" value={u.role}
                                onChange={(e) => updateRole(u.id, e.target.value)}>
                                <option value="user">User</option>
                                <option value="therapist">Therapist</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                            <td>
                              <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="td-date">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td>
                              <button className="btn btn-secondary btn-sm"
                                onClick={() => toggleActive(u.id)}>
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Alerts */}
                {tab === 'Alerts' && (
                  <div>
                    {alerts.map((a) => (
                      <div key={a.id}
                        className={`alert-row level-${a.level.toLowerCase()} ${a.is_acknowledged ? 'acked' : ''}`}>
                        <div className="alert-level">{a.level}</div>
                        <div className="alert-info">
                          <div className="alert-user">{a.user?.name} · {a.user?.email}</div>
                          <div className="alert-msg">{a.message}</div>
                          <div className="alert-time">{new Date(a.created_at).toLocaleString()}</div>
                        </div>
                        {!a.is_acknowledged
                          ? <button className="btn btn-secondary btn-sm" onClick={() => ackAlert(a.id)}>Acknowledge</button>
                          : <span className="badge badge-dim">Done</span>}
                      </div>
                    ))}
                    {alerts.length === 0 && <div className="dash-empty">No alerts</div>}
                  </div>
                )}

                {/* Appointments */}
                {tab === 'Appointments' && (
                  <div>
                    {appts.map((a) => (
                      <div key={a.id} className="appt-row">
                        <div className="appt-info">
                          <div className="appt-user">{a.user?.name}</div>
                          <div className="appt-time">
                            {new Date(a.scheduled_at).toLocaleString()}
                          </div>
                          {a.notes && <div className="appt-notes">{a.notes}</div>}
                        </div>
                        <div className="appt-doctor">
                          {a.doctor
                            ? <span className="badge badge-green">{a.doctor.name}</span>
                            : (
                              <select className="dash-select" defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) updateAppt(a.id, 'confirmed', e.target.value);
                                }}>
                                <option value="">Assign doctor...</option>
                                {doctors.map((d) => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                            )}
                        </div>
                        <span className={`badge ${
                          a.status === 'confirmed' ? 'badge-green'  :
                          a.status === 'cancelled' ? 'badge-red'    :
                          a.status === 'completed' ? 'badge-dim'    : 'badge-yellow'
                        }`}>{a.status}</span>
                        <div className="appt-actions">
                          {a.status === 'pending' && a.doctor && (
                            <button className="btn btn-primary btn-sm"
                              onClick={() => updateAppt(a.id, 'confirmed')}>
                              Confirm
                            </button>
                          )}
                          {!['cancelled','completed'].includes(a.status) && (
                            <button className="btn btn-danger btn-sm"
                              onClick={() => updateAppt(a.id, 'cancelled')}>
                              Cancel
                            </button>
                          )}
                          {a.status === 'confirmed' && (
                            <button className="btn btn-secondary btn-sm"
                              onClick={() => updateAppt(a.id, 'completed')}>
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {appts.length === 0 && <div className="dash-empty">No appointments</div>}
                  </div>
                )}

                {/* Calendar */}
                {tab === 'Calendar' && (
                  <AppointmentCalendar
                    appointments={appts}
                    doctors={doctors}
                    onUpdate={fetchAll}
                    role="admin"
                  />
                )}

              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  );
}