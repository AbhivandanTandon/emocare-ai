import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';
import { useAuthStore } from '../store/authStore';
import './MessageBubble.css';

const RISK_BADGE = {
  Moderate: { cls: 'badge-yellow', label: 'Moderate Risk' },
  High:     { cls: 'badge-red',    label: 'High Risk — Therapist Alerted' },
  Imminent: { cls: 'badge-crisis', label: '🚨 Imminent Risk — Emergency Protocol' },
};

function AudioPlayer({ messageId, token }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [playing, setPlaying]   = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent]   = useState(0);
  const [error, setError]       = useState(false);
  const audioRef = useRef(null);

  const load = async () => {
    if (audioUrl) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/chat/audio/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Not found');
      const blob = await response.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime   = () => setCurrent(audio.currentTime);
    const onEnded  = () => { setPlaying(false); setCurrent(0); };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate',     onTime);
    audio.addEventListener('ended',          onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate',     onTime);
      audio.removeEventListener('ended',          onEnded);
    };
  }, [audioUrl]);

  const togglePlay = async () => {
    await load();
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setError(true);
      }
    }
  };

  const seek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="audio-player">
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      <button
        className="audio-play-btn"
        onClick={togglePlay}
        disabled={error}
        title={error ? 'Audio unavailable' : playing ? 'Pause' : 'Play'}
      >
        {loading  ? <span className="audio-spinner" />
         : error  ? '✕'
         : playing ? '⏸'
                   : '▶'}
      </button>

      <div className="audio-track" onClick={seek}>
        <div className="audio-track-bg">
          <div className="audio-track-fill"  style={{ width: `${progress}%` }} />
          <div className="audio-track-thumb" style={{ left: `${progress}%` }} />
        </div>
      </div>

      <span className="audio-time">
        {duration > 0 ? `${fmt(current)} / ${fmt(duration)}` : '🎙 Audio'}
      </span>
    </div>
  );
}

/* ── Timestamp — handles UUID ids, numeric ids, and created_at ── */
function formatTime(message) {
  if (message.created_at) {
    const d = new Date(message.created_at);
    if (!isNaN(d)) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (typeof message.id === 'number' || /^\d+$/.test(String(message.id))) {
    const d = new Date(Number(message.id));
    if (!isNaN(d)) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return '';
}

/* ── Determine if this message has playable audio ── */
function messageHasAudio(message) {
  // Live message just sent this session
  if (message.has_audio) return true;
  // Loaded from history — backend sets audio_available
  if (message.audio_available) return true;
  // Fallback — check prediction/fusion for audio_file_id
  if (message.fusion?.audio_file_id)    return true;
  if (message.prediction?.audio_file_id) return true;
  return false;
}

export default function MessageBubble({ message, user }) {
  const isUser    = message.role === 'user';
  const riskBadge = message.escalation && RISK_BADGE[message.escalation];
  const token     = useAuthStore((s) => s.token);

  const hasAudio = isUser && messageHasAudio(message);
  const timeStr  = formatTime(message);
  const showText = message.content && message.content !== '[Audio message]';

  return (
    <motion.div
      className={`msg-row ${isUser ? 'msg-user' : 'msg-ai'}`}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Avatar */}
      <div className={`msg-avatar ${isUser ? 'msg-avatar-user' : 'msg-avatar-ai'}`}>
        {isUser
          ? user?.full_name?.[0]?.toUpperCase() || 'U'
          : <Logo size={14} />}
      </div>

      {/* Content column */}
      <div className="msg-content">

        {/* Sender + time */}
        <div className="msg-sender">
          <span>{isUser ? user?.full_name || 'You' : 'EmoCare AI'}</span>
          {timeStr && <span className="msg-time">{timeStr}</span>}
        </div>

        {/* Bubble */}
        <div className={`msg-bubble ${isUser ? 'msg-bubble-user' : 'msg-bubble-ai'}`}>

          {/* Audio player — only for user messages with audio */}
          {hasAudio && (
            <AudioPlayer messageId={message.id} token={token} />
          )}

          {/* Transcript / text */}
          {showText && (
            <p className={hasAudio ? 'bubble-text-after-audio' : ''}>
              {message.content}
            </p>
          )}

        </div>

        {/* Risk badge */}
        {riskBadge && (
          <motion.div
            className={`badge ${riskBadge.cls}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            style={{ marginTop: 6, display: 'inline-flex' }}
          >
            {riskBadge.label}
          </motion.div>
        )}

      </div>
    </motion.div>
  );
}