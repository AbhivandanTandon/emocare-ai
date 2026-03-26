import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import Logo from './Logo';
import ConversationList from './ConversationList';
import './Sidebar.css';

const RISK_CFG = {
  Low:      { color: '#4A7C3F', cls: 'green',  label: 'All clear',        dot: 'green'  },
  Moderate: { color: '#C07820', cls: 'yellow', label: 'Monitor closely',   dot: 'yellow' },
  High:     { color: '#C03820', cls: 'red',    label: 'Therapist alerted', dot: 'red'    },
  Imminent: { color: '#941810', cls: 'red',    label: 'Emergency active',  dot: 'red'    },
};

const PROB_ITEMS = [
  { key: 'Neutral',    color: '#4A7C3F', abbr: 'NEU' },
  { key: 'Anxiety',    color: '#C07820', abbr: 'ANX' },
  { key: 'Depression', color: '#C03820', abbr: 'DEP' },
];

export default function Sidebar({ onShowShap, showShap, hasShap, onNewChat, onLoadSession }) {
  const [tab, setTab]  = useState('history');
  const user           = useAuthStore((s) => s.user);
  const logout         = useAuthStore((s) => s.logout);
  const { currentRisk, messages, sessions } = useChatStore();

  const cfg         = RISK_CFG[currentRisk] || RISK_CFG.Low;
  const lastAi      = [...messages].reverse().find((m) => m.role === 'assistant' && m.fusion);
  const probs       = lastAi?.fusion?.probabilities;
  const metrics     = lastAi?.fusion?.metrics;
  const hasAnalysis = !!probs;

  const riskWidth =
    currentRisk === 'Low'      ? '15%'  :
    currentRisk === 'Moderate' ? '45%'  :
    currentRisk === 'High'     ? '78%'  : '100%';

  return (
    <aside className="sidebar">

      {/* Brand */}
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">
            <Logo size={20} animated />
          </div>
          <div>
            <div className="sidebar-brand-name">Emo<span>Care</span> AI</div>
            <div className="sidebar-brand-sub">Research Platform</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}
        >
          Chats
          {sessions.length > 0 && (
            <span className="sidebar-tab-count">{sessions.length}</span>
          )}
        </button>
        <button
          className={`sidebar-tab ${tab === 'analysis' ? 'active' : ''}`}
          onClick={() => setTab('analysis')}
        >
          Analysis
          {hasAnalysis && <span className="sidebar-tab-dot" />}
        </button>
      </div>

      {/* Tab body */}
      <div className="sidebar-tab-body">
        <AnimatePresence mode="wait">

          {/* History tab */}
          {tab === 'history' && (
            <motion.div
              key="history"
              className="sidebar-tab-pane"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ConversationList
                onSelectSession={onLoadSession}
                onNewChat={onNewChat}
              />
            </motion.div>
          )}

          {/* Analysis tab */}
          {tab === 'analysis' && (
            <motion.div
              key="analysis"
              className="sidebar-tab-pane"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Risk card */}
              <div className="sidebar-section">
                <div className="sidebar-section-label">Risk Level</div>
                <div className="risk-card" style={{ borderColor: cfg.color + '40' }}>
                  <div className="risk-card-top">
                    <div className={`glow-dot ${cfg.dot} ${currentRisk !== 'Low' ? 'pulse' : ''}`} />
                    <span className={`badge badge-${
                      cfg.cls === 'green' ? 'green' :
                      cfg.cls === 'yellow' ? 'yellow' : 'red'
                    }`}>
                      {currentRisk}
                    </span>
                  </div>
                  <div className="risk-card-label">{cfg.label}</div>
                  <div className="risk-card-bar">
                    <motion.div
                      className="risk-card-fill"
                      style={{ background: cfg.color }}
                      initial={{ width: '0%' }}
                      animate={{ width: riskWidth }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              </div>

              {/* Probability bars */}
              {probs && (
                <div className="sidebar-section">
                  <div className="sidebar-section-label">Model Output</div>
                  <div className="prob-list">
                    {PROB_ITEMS.map(({ key, color, abbr }) => {
                      const v   = probs[key] || 0;
                      const pct = Math.round(v * 1000) / 10;
                      return (
                        <div key={key} className="prob-row">
                          <span className="prob-abbr mono" style={{ color }}>
                            {abbr}
                          </span>
                          <div className="prob-track">
                            <motion.div
                              className="prob-fill"
                              style={{ background: color }}
                              initial={{ width: '0%' }}
                              animate={{ width: `${v * 100}%` }}
                              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </div>
                          <span className="prob-val mono" style={{ color }}>
                            {pct}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Fusion metrics */}
              {metrics && (
                <div className="sidebar-section">
                  <div className="sidebar-section-label">Fusion Metrics</div>
                  <div className="metric-grid">
                    {[
                      { label: 'Entropy', value: metrics.shannon_entropy_fused?.toFixed(3),        unit: 'bits' },
                      { label: 'JSD',     value: metrics.jensen_shannon_divergence?.toFixed(4),     unit: ''     },
                      { label: 'Margin',  value: (metrics.prediction_margin * 100)?.toFixed(1),     unit: '%'    },
                      { label: 'Modal',   value: metrics.cross_modal_agreement ? 'Agree' : 'Split', unit: ''     },
                    ].map((m) => (
                      <div key={m.label} className="metric-cell">
                        <div className="metric-label">{m.label}</div>
                        <div className="metric-value mono">
                          {m.value}<span>{m.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SHAP toggle */}
              {hasShap && (
                <div className="sidebar-section">
                  <button
                    className={`shap-toggle ${showShap ? 'active' : ''}`}
                    onClick={onShowShap}
                  >
                    <Logo size={13} />
                    <span>Token Saliency</span>
                    <span className="shap-toggle-arrow">{showShap ? '↑' : '↓'}</span>
                  </button>
                </div>
              )}

              {!hasAnalysis && (
                <div className="sidebar-no-analysis">
                  Send a message to see model analysis
                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.full_name}</div>
            <div className="sidebar-user-role">{user?.role}</div>
          </div>
        </div>
        <div className="sidebar-actions">
          <button
            className="btn btn-ghost btn-sm btn-full btn-danger"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </div>

    </aside>
  );
}