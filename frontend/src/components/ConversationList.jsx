import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import API from '../api/client';
import { useChatStore } from '../store/chatStore';
import Logo from './Logo';
import './ConversationList.css';

const RISK_COLORS = {
  Neutral:    'var(--r-low)',
  Anxiety:    'var(--r-moderate)',
  Depression: 'var(--r-high)',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ConversationList({ onSelectSession, onNewChat }) {
  const {
    sessions, sessionsLoading,
    setSessions, setSessionsLoading,
    activeSessionId, deleteSessionFromList,
  } = useChatStore();

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const { data } = await API.get('/chat/sessions');
      setSessions(data);
    } catch {
      // silently fail
    } finally {
      setSessionsLoading(false);
    }
  }, [setSessions, setSessionsLoading]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await API.delete(`/chat/sessions/${sessionId}`);
      deleteSessionFromList(sessionId);
      toast.success('Conversation deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="conv-list">
      {/* New chat button */}
      <div className="conv-new-wrap">
        <button className="conv-new-btn" onClick={onNewChat}>
          <span className="conv-new-icon">+</span>
          New conversation
        </button>
      </div>

      {/* History */}
      <div className="conv-section-label">Recent</div>

      {sessionsLoading ? (
        <div className="conv-loading">
          <div className="dots"><span /><span /><span /></div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="conv-empty">
          <Logo size={28} animated />
          <p>No conversations yet</p>
          <span>Start chatting to see your history here</span>
        </div>
      ) : (
        <div className="conv-items">
          <AnimatePresence>
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                className={`conv-item ${activeSessionId === session.id ? 'active' : ''}`}
                onClick={() => onSelectSession(session)}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                layout
              >
                <div className="conv-item-inner">
                  <div className="conv-item-top">
                    <span
                      className="conv-risk-dot"
                      style={{ background: RISK_COLORS[session.risk_label] || 'var(--t4)' }}
                    />
                    <span className="conv-time">{timeAgo(session.created_at)}</span>
                    <button
                      className="conv-delete"
                      onClick={(e) => handleDelete(e, session.id)}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                  <p className="conv-preview">{session.preview}</p>
                  <div className="conv-meta">
                    <span className="conv-count">{session.message_count} messages</span>
                    {session.is_escalated && (
                      <span className="conv-escalated">⚠ Escalated</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}