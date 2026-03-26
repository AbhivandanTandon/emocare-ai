import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import toast from 'react-hot-toast';
import API from '../api/client';
import { useAuthStore } from '../store/authStore';
import RiskBadge from '../components/RiskBadge';
import ShapHeatmap from '../components/ShapHeatmap';
import { useNavigate } from 'react-router-dom';
import './TherapistDashboard.css';

const TRIAGE = ['Neutral', 'Anxiety', 'Depression'];
const COLORS = { Neutral: '#2eb82e', Anxiety: '#ff9933', Depression: '#cc3300' };
const ESCALATION_COLORS = { Low: '#2eb82e', Moderate: '#ff9933', High: '#e74c3c', Imminent: '#cc0000' };

export default function TherapistDashboard() {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    try {
      const { data } = await API.get('/therapist/sessions');
      setSessions(data);
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchTranscript = async (sessionId) => {
    setTranscriptLoading(true);
    setTranscript(null);
    try {
      const { data } = await API.get(`/therapist/session/${sessionId}/transcript`);
      setTranscript(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load transcript');
    } finally {
      setTranscriptLoading(false);
    }
  };

  const assignSession = async (sessionId) => {
    try {
      await API.post(`/therapist/session/${sessionId}/assign`);
      toast.success('Session assigned to you');
      fetchSessions();
    } catch {
      toast.error('Assignment failed');
    }
  };

  const handleSelectSession = (session) => {
    setSelected(session);
    setActiveTab('overview');
    fetchTranscript(session.id);
  };

  // Build chart data from fusion artifact
  const buildRadarData = (artifact) => {
    if (!artifact?.fusion?.probabilities) return [];
    const { text_model, audio_model, fusion } = artifact;
    return TRIAGE.map((cls) => ({
      class: cls,
      Text: text_model?.probabilities?.[cls] || 0,
      Audio: audio_model?.probabilities?.[cls] || 0,
      Fused: fusion?.probabilities?.[cls] || 0,
    }));
  };

  const buildBarData = (artifact) => {
    if (!artifact?.fusion?.probabilities) return [];
    const { text_model, audio_model, fusion } = artifact;
    return TRIAGE.map((cls) => ({
      name: cls,
      Text: parseFloat(((text_model?.probabilities?.[cls] || 0) * 100).toFixed(1)),
      Audio: parseFloat(((audio_model?.probabilities?.[cls] || 0) * 100).toFixed(1)),
      Fused: parseFloat(((fusion?.probabilities?.[cls] || 0) * 100).toFixed(1)),
    }));
  };

  return (
    <div className="td-layout">
      {/* Sidebar */}
      <aside className="td-sidebar">
        <div className="td-sidebar-header">
          <span>🧠</span>
          <div>
            <h2>EmoCare AI</h2>
            <p>Therapist Dashboard</p>
          </div>
        </div>

        <div className="td-nav">
          <button className="td-nav-item active">
            🚨 Escalated Sessions
            <span className="badge">{sessions.length}</span>
          </button>
        </div>

        <div className="td-session-list">
          {loading ? (
            <div className="td-loading">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="td-empty">
              <span>✅</span>
              <p>No escalated sessions</p>
            </div>
          ) : (
            sessions.map((s) => (
              <motion.div
                key={s.id}
                className={`td-session-item ${selected?.id === s.id ? 'active' : ''}`}
                onClick={() => handleSelectSession(s)}
                whileHover={{ x: 3 }}
              >
                <div className="td-session-top">
                  <span
                    className="td-escalation-dot"
                    style={{ background: ESCALATION_COLORS[s.escalation_level] }}
                  />
                  <span className="td-session-id">#{s.id.slice(0, 8)}</span>
                  <RiskBadge level={s.escalation_level} />
                </div>
                <div className="td-session-meta">
                  <span>{s.risk_label}</span>
                  <span>{(s.confidence * 100).toFixed(0)}% confidence</span>
                </div>
                <div className="td-session-time">
                  {new Date(s.created_at).toLocaleString()}
                </div>
                {!s.assigned_therapist_id && (
                  <button
                    className="td-assign-btn"
                    onClick={(e) => { e.stopPropagation(); assignSession(s.id); }}
                  >
                    Assign to me
                  </button>
                )}
                {s.assigned_therapist_id && (
                  <span className="td-assigned">✓ Assigned</span>
                )}
              </motion.div>
            ))
          )}
        </div>

        <div className="td-sidebar-footer">
          <p>{user?.full_name}</p>
          <div className="td-footer-btns">
            <button onClick={() => navigate('/chat')} className="td-footer-btn">💬 Chat</button>
            <button onClick={logout} className="td-footer-btn danger">Sign Out</button>
          </div>
        </div>
      </aside>

      {/* Main panel */}
      <main className="td-main">
        {!selected ? (
          <div className="td-welcome">
            <span>🩺</span>
            <h2>Select a session to review</h2>
            <p>Sessions with High or Imminent risk escalation appear in the left panel.</p>
            <p>You can view transcripts, model predictions, and SHAP explainability for each session.</p>
          </div>
        ) : (
          <div className="td-detail">
            {/* Header */}
            <div className="td-detail-header">
              <div>
                <h2>Session #{selected.id.slice(0, 8)}</h2>
                <p>{new Date(selected.created_at).toLocaleString()}</p>
              </div>
              <div className="td-detail-badges">
                <RiskBadge level={selected.escalation_level} large />
                <span className="td-risk-label" style={{ color: COLORS[selected.risk_label] }}>
                  {selected.risk_label} · {(selected.confidence * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="td-tabs">
              {['overview', 'transcript', 'shap', 'charts'].map((tab) => (
                <button
                  key={tab}
                  className={`td-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'overview' && '📊 Overview'}
                  {tab === 'transcript' && '💬 Transcript'}
                  {tab === 'shap' && '🔍 SHAP'}
                  {tab === 'charts' && '📈 Charts'}
                </button>
              ))}
            </div>

            <div className="td-tab-content">
              <AnimatePresence mode="wait">
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                  <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {selected.artifact?.fusion ? (
                      <>
                        {/* Metrics grid */}
                        <div className="td-metrics-grid">
                          {[
                            { label: 'Risk Label', value: selected.artifact.fusion.label, color: COLORS[selected.artifact.fusion.label] },
                            { label: 'Confidence', value: `${(selected.artifact.fusion.confidence * 100).toFixed(2)}%`, color: '#e0e0e0' },
                            { label: 'Escalation', value: selected.escalation_level, color: ESCALATION_COLORS[selected.escalation_level] },
                            { label: 'Shannon Entropy', value: `${selected.artifact.fusion.metrics?.shannon_entropy_fused?.toFixed(4)} bits`, color: '#f39c12' },
                            { label: 'JSD', value: selected.artifact.fusion.metrics?.jensen_shannon_divergence?.toFixed(4), color: '#3498db' },
                            { label: 'Modal Agreement', value: selected.artifact.fusion.metrics?.cross_modal_agreement ? '✓ Yes' : '✗ No', color: selected.artifact.fusion.metrics?.cross_modal_agreement ? '#2eb82e' : '#e74c3c' },
                          ].map((m) => (
                            <div key={m.label} className="td-metric-card">
                              <p className="td-metric-label">{m.label}</p>
                              <p className="td-metric-value" style={{ color: m.color }}>{m.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Clinical flags */}
                        <div className="td-flags">
                          <p className="td-section-title">⚠️ Clinical Flags</p>
                          <div className="td-flags-grid">
                            {Object.entries(selected.artifact.fusion.clinical || {})
                              .filter(([k, v]) => k.startsWith('flag_') && v === true)
                              .map(([k]) => (
                                <span key={k} className="td-flag-chip">
                                  🚩 {k.replace('flag_', '').replace(/_/g, ' ')}
                                </span>
                              ))}
                            {!Object.entries(selected.artifact.fusion.clinical || {})
                              .some(([k, v]) => k.startsWith('flag_') && v === true) && (
                              <span className="td-flag-chip safe">✅ No flags triggered</span>
                            )}
                          </div>
                        </div>

                        {/* Probability table */}
                        <div className="td-prob-table">
                          <p className="td-section-title">🔬 Modality Output</p>
                          <table>
                            <thead>
                              <tr>
                                <th>Modality</th>
                                <th>Prediction</th>
                                {TRIAGE.map((c) => <th key={c}>{c}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { name: '🧠 Text (RoBERTa)', data: selected.artifact.text_model },
                                { name: '🎙 Audio (WavLM)', data: selected.artifact.audio_model },
                                { name: '⚡ Fused', data: selected.artifact.fusion },
                              ].map((row) => (
                                <tr key={row.name}>
                                  <td>{row.name}</td>
                                  <td style={{ color: COLORS[row.data?.label], fontWeight: 700 }}>
                                    {row.data?.label}
                                  </td>
                                  {TRIAGE.map((c) => (
                                    <td key={c}>
                                      {((row.data?.probabilities?.[c] || 0) * 100).toFixed(1)}%
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p className="td-no-data">No prediction data available for this session.</p>
                    )}
                  </motion.div>
                )}

                {/* TRANSCRIPT TAB */}
                {activeTab === 'transcript' && (
                  <motion.div key="transcript" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {transcriptLoading ? (
                      <div className="td-loading">Loading transcript...</div>
                    ) : transcript ? (
                      <div className="td-transcript">
                        <div className="td-transcript-header">
                          <p>Patient ID: <strong>{transcript.patient_id?.slice(0, 8)}...</strong></p>
                          <RiskBadge level={transcript.escalation_level} />
                        </div>
                        <div className="td-messages">
                          {transcript.messages?.map((msg, i) => (
                            <div key={i} className={`td-msg ${msg.role}`}>
                              <span className="td-msg-role">
                                {msg.role === 'user' ? '👤 Patient' : '🤖 Assistant'}
                              </span>
                              <div className="td-msg-bubble">{msg.content}</div>
                              <span className="td-msg-time">
                                {new Date(msg.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="td-no-data">Select a session to view its transcript.</p>
                    )}
                  </motion.div>
                )}

                {/* SHAP TAB */}
                {activeTab === 'shap' && (
                  <motion.div key="shap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="td-section-title">🔍 Gradient × Embedding Token Saliency</p>
                    {selected.shap && Object.keys(selected.shap).length > 0 ? (
                      <>
                        <ShapHeatmap data={selected.shap} />
                        <div className="td-shap-meta">
                          <p>Predicted class: <strong style={{ color: COLORS[selected.shap.pred_label] }}>{selected.shap.pred_label}</strong></p>
                          <p>Method: Gradient × Embedding Norm (∂L/∂e · e)</p>
                          <p>Tokens analyzed: {selected.shap.tokens?.length || 0}</p>
                        </div>
                      </>
                    ) : (
                      <p className="td-no-data">No SHAP data available for this session.</p>
                    )}
                  </motion.div>
                )}

                {/* CHARTS TAB */}
                {activeTab === 'charts' && (
                  <motion.div key="charts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {selected.artifact?.fusion ? (
                      <div className="td-charts">
                        {/* Bar chart */}
                        <div className="td-chart-card">
                          <p className="td-section-title">📊 Cross-Modal Probability Distribution</p>
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={buildBarData(selected.artifact)} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
                              <XAxis dataKey="name" stroke="#7f8fa6" />
                              <YAxis stroke="#7f8fa6" unit="%" />
                              <Tooltip
                                contentStyle={{ background: '#16213e', border: '1px solid #2d2d2d', borderRadius: 8 }}
                                labelStyle={{ color: '#e0e0e0' }}
                              />
                              <Legend />
                              <Bar dataKey="Text" fill="#3498db" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Audio" fill="#9b59b6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Fused" fill="#e74c3c" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Radar chart */}
                        <div className="td-chart-card">
                          <p className="td-section-title">🕸 Multi-Modal Probability Radar</p>
                          <ResponsiveContainer width="100%" height={300}>
                            <RadarChart data={buildRadarData(selected.artifact)}>
                              <PolarGrid stroke="#2d2d2d" />
                              <PolarAngleAxis dataKey="class" stroke="#7f8fa6" />
                              <Radar name="Text (RoBERTa)" dataKey="Text" stroke="#3498db" fill="#3498db" fillOpacity={0.15} />
                              <Radar name="Audio (WavLM)" dataKey="Audio" stroke="#9b59b6" fill="#9b59b6" fillOpacity={0.15} />
                              <Radar name="Fused" dataKey="Fused" stroke="#e74c3c" fill="#e74c3c" fillOpacity={0.15} />
                              <Legend />
                              <Tooltip
                                contentStyle={{ background: '#16213e', border: '1px solid #2d2d2d', borderRadius: 8 }}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Entropy metrics */}
                        <div className="td-chart-card">
                          <p className="td-section-title">📉 Uncertainty Metrics</p>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart
                              data={[
                                { name: 'Text Entropy', value: parseFloat((selected.artifact.fusion.metrics?.shannon_entropy_text || 0).toFixed(4)) },
                                { name: 'Audio Entropy', value: parseFloat((selected.artifact.fusion.metrics?.shannon_entropy_audio || 0).toFixed(4)) },
                                { name: 'Fused Entropy', value: parseFloat((selected.artifact.fusion.metrics?.shannon_entropy_fused || 0).toFixed(4)) },
                                { name: 'JSD', value: parseFloat((selected.artifact.fusion.metrics?.jensen_shannon_divergence || 0).toFixed(4)) },
                              ]}
                              margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
                              <XAxis dataKey="name" stroke="#7f8fa6" tick={{ fontSize: 11 }} />
                              <YAxis stroke="#7f8fa6" />
                              <Tooltip
                                contentStyle={{ background: '#16213e', border: '1px solid #2d2d2d', borderRadius: 8 }}
                              />
                              <Bar dataKey="value" fill="#f39c12" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : (
                      <p className="td-no-data">No chart data available.</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}