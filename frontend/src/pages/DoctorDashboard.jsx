import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import API from '../api/client';
import AppointmentCalendar from '../components/AppointmentCalendar';
import Logo from '../components/Logo';
import { useAuthStore } from '../store/authStore';
import './AdminDashboard.css';

const TABS = [
  { id: 'Patients',     label: 'Patients',     icon: '◈' },
  { id: 'Appointments', label: 'Appointments', icon: '◷' },
  { id: 'Calendar',     label: 'Calendar',     icon: '▦' },
  { id: 'Alerts',       label: 'Alerts',       icon: '◉' },
];

const RISK_COLOR = {
  Neutral:    '#4A7C3F',
  Anxiety:    '#C07820',
  Depression: '#C03820',
};

export default function DoctorDashboard() {
  const logout = useAuthStore((s) => s.logout);
  const user   = useAuthStore((s) => s.user);

  const [tab, setTab]           = useState('Patients');
  const [patients, setPatients] = useState([]);
  const [appts, setAppts]       = useState([]);
  const [alerts, setAlerts]     = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, a, al] = await Promise.all([
        API.get('/admin/patients'),
        API.get('/appointments/doctor'),
        API.get('/admin/alerts'),
      ]);
      setPatients(p.data);
      setAppts(a.data);
      setAlerts(al.data);
    } catch { toast.error('Failed to load dashboard'); }
    finally  { setLoading(false); }
  };

  const ackAlert = async (id) => {
    try {
      await API.patch(`/admin/alerts/${id}/acknowledge`);
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const unread = alerts.filter((a) => !a.is_acknowledged).length;

  return (
    <div className="dash-root">
      <aside className="dash-sidebar">
        <div className="dash-sidebar-top">
          <div className="dash-brand">
            <Logo size={22} animated />
            <div>
              <div className="dash-brand-name">EmoCare <span>AI</span></div>
              <div className="dash-brand-sub">Clinical Console</div>
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
              <div className="dash-user-role">Therapist</div>
            </div>
          </div>
          <button className="btn btn-danger btn-sm btn-full" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

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
                {/* Patients */}
                {tab === 'Patients' && (
                  <div className="dash-table-wrap">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Email</th>
                          <th>Risk</th>
                          <th>Concerns</th>
                          <th>Messages</th>
                          <th>Last Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patients.map((p) => (
                          <tr key={p.id}>
                            <td className="td-name">{p.full_name}</td>
                            <td className="td-email">{p.email}</td>
                            <td>
                              <span style={{
                                color: RISK_COLOR[p.risk_label] || 'var(--text-4)',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.75rem',
                              }}>
                                {p.risk_label || 'Neutral'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                              {p.intake_share_with_doctor && p.intake_primary_concerns?.length > 0
                                ? p.intake_primary_concerns.slice(0, 2).join(', ')
                                : <span style={{ color: 'var(--text-5)', fontStyle: 'italic' }}>Private</span>}
                            </td>
                            <td className="td-date">{p.msg_count}</td>
                            <td className="td-date">
                              {p.last_login
                                ? new Date(p.last_login).toLocaleDateString()
                                : 'Never'}
                            </td>
                          </tr>
                        ))}
                        {patients.length === 0 && (
                          <tr>
                            <td colSpan={6}>
                              <div className="dash-empty">No patients assigned</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
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
                        <span className={`badge ${
                          a.status === 'confirmed' ? 'badge-green'  :
                          a.status === 'cancelled' ? 'badge-red'    :
                          a.status === 'completed' ? 'badge-dim'    : 'badge-yellow'
                        }`}>{a.status}</span>
                      </div>
                    ))}
                    {appts.length === 0 && (
                      <div className="dash-empty">No appointments assigned to you</div>
                    )}
                  </div>
                )}

                {/* Calendar */}
                {tab === 'Calendar' && (
                  <AppointmentCalendar
                    appointments={appts}
                    doctors={[]}
                    onUpdate={fetchAll}
                    role="therapist"
                  />
                )}

                {/* Alerts */}
                {tab === 'Alerts' && (
                  <div>
                    {alerts.map((a) => (
                      <div key={a.id}
                        className={`alert-row level-${a.level.toLowerCase()} ${a.is_acknowledged ? 'acked' : ''}`}>
                        <div className="alert-level">{a.level}</div>
                        <div className="alert-info">
                          <div className="alert-user">{a.user?.name}</div>
                          <div className="alert-msg">{a.message}</div>
                          <div className="alert-time">
                            {new Date(a.created_at).toLocaleString()}
                          </div>
                        </div>
                        {!a.is_acknowledged
                          ? <button className="btn btn-secondary btn-sm" onClick={() => ackAlert(a.id)}>Acknowledge</button>
                          : <span className="badge badge-dim">Done</span>}
                      </div>
                    ))}
                    {alerts.length === 0 && <div className="dash-empty">No alerts</div>}
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  );
}