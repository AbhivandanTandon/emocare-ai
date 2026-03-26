import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import API from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import AudioRecorder from '../components/AudioRecorder';
import BookAppointmentModal from '../components/BookAppointmentModal';
import Logo from '../components/Logo';
import MessageBubble from '../components/MessageBubble';
import ShapHeatmap from '../components/ShapHeatmap';
import Sidebar from '../components/Sidebar';
import './Chat.css';

const STARTERS = [
  "I've been feeling anxious lately",
  "I'm struggling to sleep at night",
  "I feel overwhelmed and disconnected",
  "I want to talk about my mood",
];

export default function Chat() {
  const [input, setInput]             = useState('');
  const [audioBlob, setAudioBlob]     = useState(null);
  const [showShap, setShowShap]       = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const textareaRef = useRef(null);
  const bottomRef   = useRef(null);

  const {
    messages, addMessage, isAnalyzing, setAnalyzing,
    setRisk, sessionId, setSessionId, newChat, loadSession, setSessions,
  } = useChatStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAnalyzing]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, []);

  const handleNewChat = () => {
    newChat();
    setShowShap(false);
    setInput('');
  };

  const handleLoadSession = async (session) => {
    if (session.id === sessionId) return;
    setHistoryLoading(true);
    try {
      const { data } = await API.get(`/chat/history/${session.id}`);
      loadSession(session.id, data.messages, data.risk_label);
      setShowShap(false);
    } catch {
      toast.error('Failed to load conversation');
    } finally {
      setHistoryLoading(false);
    }
  };

  const sendMessage = async (text = input) => {
    const content = text.trim();
    if (!content && !audioBlob) return;

    const userText = content || '[Audio message]';
    addMessage({ role: 'user', content: userText, id: Date.now() });
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append('text', userText);
      formData.append(
        'conversation_history',
        JSON.stringify(messages.slice(-10).map((m) => ({ role: m.role, content: m.content })))
      );
      if (sessionId) formData.append('session_id', sessionId);
      if (audioBlob) {
        formData.append('audio', audioBlob, 'recording.webm');
        setAudioBlob(null);
      }

      const { data } = await API.post('/chat/message', formData);
      const escalation = data.fusion?.clinical?.escalation_level || 'Low';
      setRisk(escalation);
      if (data.session_id) setSessionId(data.session_id);

      addMessage({
        role: 'assistant',
        content: data.response,
        id: Date.now() + 1,
        fusion: data.fusion,
        shap: data.shap,
        escalation,
      });

      const { data: sessions } = await API.get('/chat/sessions');
      setSessions(sessions);

      if (escalation === 'High' || escalation === 'Imminent') {
        toast.error(`${escalation} risk — therapist alerted`, { duration: 8000 });
      }
    } catch {
      toast.error('Failed to send message');
      addMessage({
        role: 'assistant',
        content: 'An error occurred. Please try again.',
        id: Date.now() + 1,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const lastAiMsg = [...messages].reverse().find((m) => m.role === 'assistant' && m.shap);

  return (
    <div className="chat-root">
      <Sidebar
        onShowShap={() => setShowShap((v) => !v)}
        showShap={showShap}
        hasShap={!!lastAiMsg?.shap}
        onNewChat={handleNewChat}
        onLoadSession={handleLoadSession}
      />

      <div className="chat-area">

        {/* Header */}
        <header className="chat-header">
          <div className="chat-header-left">
            <div className="chat-header-title">
              {sessionId ? 'Conversation' : 'New conversation'}
            </div>
            <div className="chat-header-sub">
              {messages.length > 0
                ? `${messages.length} message${messages.length !== 1 ? 's' : ''}`
                : 'Start typing to begin'}
            </div>
          </div>
          <div className="chat-header-right">
            <div className="badge badge-dim">
              <span className="glow-dot green" />
              Models active
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowBooking(true)}
            >
              Book Appointment
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleNewChat}>
              New chat
            </button>
            <div className="crisis-bar">
              Emergency: 112 · Tele-MANAS: 14416
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="chat-messages">
          {historyLoading ? (
            <div className="chat-history-loading">
              <div className="dots"><span/><span/><span/></div>
              <p>Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            <motion.div
              className="chat-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="chat-empty-icon">
                <Logo size={28} animated />
              </div>
              <h3>How are you feeling today?</h3>
              <p>
                Share anything on your mind. Your messages are encrypted and private.
              </p>
              <div className="starter-grid">
                {STARTERS.map((s) => (
                  <motion.button
                    key={s}
                    className="starter-chip"
                    onClick={() => sendMessage(s)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="chat-messages-inner">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} user={user} />
                ))}
                {isAnalyzing && (
                  <motion.div
                    key="typing"
                    className="msg-row msg-ai"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="msg-avatar msg-avatar-ai">
                      <Logo size={14} />
                    </div>
                    <div className="typing-indicator">
                      <span/><span/><span/>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* SHAP */}
        <AnimatePresence>
          {showShap && lastAiMsg?.shap && (
            <motion.div
              className="shap-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <ShapHeatmap data={lastAiMsg.shap} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input */}
        <div className="chat-input">
          <div className="chat-input-inner">
            {audioBlob && (
              <motion.div
                className="audio-pill"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <span className="glow-dot green" />
                Audio ready · Click send
                <button
                  className="audio-pill-remove"
                  onClick={() => setAudioBlob(null)}
                >
                  ×
                </button>
              </motion.div>
            )}

            <div className="input-composer">
              <textarea
                ref={textareaRef}
                className="composer-textarea"
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Share how you're feeling..."
                rows={1}
              />

              <div className="composer-actions">
                <AudioRecorder onRecorded={(blob) => setAudioBlob(blob)} />
                <motion.button
                  className="send-btn"
                  onClick={() => sendMessage()}
                  disabled={isAnalyzing || (!input.trim() && !audioBlob)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isAnalyzing
                    ? <span className="dots"><span/><span/><span/></span>
                    : '↑'}
                </motion.button>
              </div>
            </div>

            <div className="composer-hint">
              Press <kbd>Enter</kbd> to send ·{' '}
              <kbd>Shift+Enter</kbd> for new line ·{' '}
              Research prototype · Not a medical device
            </div>
          </div>
        </div>

      </div>

      {/* Booking modal */}
      <AnimatePresence>
        {showBooking && (
          <BookAppointmentModal onClose={() => setShowBooking(false)} />
        )}
      </AnimatePresence>

    </div>
  );
}