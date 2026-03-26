import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

export default function AudioRecorder({ onRecorded }) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs]           = useState(0);
  const mrRef    = useRef(null);
  const chunks   = useRef([]);
  const timerRef = useRef(null);

  const toggle = async () => {
    if (recording) {
      mrRef.current?.stop();
      clearInterval(timerRef.current);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr     = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        chunks.current = [];
        setSecs(0);

        mr.ondataavailable = (e) => chunks.current.push(e.data);
        mr.onstop = () => {
          onRecorded(new Blob(chunks.current, { type: 'audio/webm' }));
          stream.getTracks().forEach((t) => t.stop());
          setRecording(false);
          setSecs(0);
        };

        mr.start();
        mrRef.current = mr;
        setRecording(true);
        timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
      } catch {
        alert('Microphone access denied');
      }
    }
  };

  return (
    <motion.button
      onClick={toggle}
      style={{
        height:       34,
        minWidth:     recording ? 64 : 34,
        borderRadius: 17,
        background:   recording ? 'rgba(200,64,32,0.08)' : 'var(--c02)',
        border:       `1.5px solid ${recording ? 'rgba(200,64,32,0.3)' : 'var(--border-2)'}`,
        color:        recording ? 'var(--r-high)' : 'var(--text-3)',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        gap:          6,
        padding:      '0 10px',
        fontSize:     '0.75rem',
        fontWeight:   600,
        fontFamily:   'var(--font-mono)',
        transition:   'all 0.15s',
        flexShrink:   0,
        cursor:       'pointer',
        letterSpacing: '0.3px',
      }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      title={recording ? `Stop recording (${secs}s)` : 'Record audio'}
    >
      {recording ? (
        <>
          <span style={{
            width: 7, height: 7,
            borderRadius: '50%',
            background: 'var(--r-high)',
            animation: 'rec-blink 1s ease-in-out infinite',
            flexShrink: 0,
          }} />
          {secs}s
          <style>{`
            @keyframes rec-blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
          `}</style>
        </>
      ) : (
        'Rec'
      )}
    </motion.button>
  );
}