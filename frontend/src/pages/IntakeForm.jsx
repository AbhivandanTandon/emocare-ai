import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API from '../api/client';
import Logo from '../components/Logo';
import './IntakeForm.css';

const STEPS = [
  { id: 'personal', title: 'Personal Details',     icon: '👤' },
  { id: 'concerns', title: 'Your Concerns',         icon: '💬' },
  { id: 'history',  title: 'Mental Health History', icon: '📋' },
  { id: 'sharing',  title: 'Sharing Preferences',   icon: '🔒' },
  { id: 'consent',  title: 'Consent & Agreement',   icon: '✅' },
];

const CONCERNS = [
  'Anxiety','Depression','Stress','Sleep Issues',
  'Relationship Issues','Grief','Trauma','Work Burnout','Self-Esteem','Other',
];

const HISTORY_OPTIONS = [
  'No prior treatment',
  'Previously seen a therapist',
  'Currently on medication',
  'Hospitalized before',
  'Family history of mental illness',
];

const DEFAULT_FORM = {
  age: '', gender: '', occupation: '', emergency_contact: '',
  primary_concerns: [], describe_situation: '',
  history_items: [], previous_therapy: '',
  share_with_doctor: true, share_sessions: true,
  share_audio: false, share_risk_scores: true,
  consent_research: false, consent_treatment: false, consent_data: false,
  additional_notes: '',
};

export default function IntakeForm() {
  const navigate = useNavigate();
  const [step, setStep]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm]     = useState(DEFAULT_FORM);

  const set  = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k, v) => setForm((f) => ({
    ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v],
  }));

  const submit = async () => {
    if (!form.consent_treatment || !form.consent_data) {
      toast.error('Please accept the required consents');
      return;
    }
    setLoading(true);
    try {
      await API.post('/users/intake', form);
      toast.success('Intake form submitted!');
      navigate('/chat');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const progress = (step / (STEPS.length - 1)) * 100;

  return (
    <div className="intake-root">
      <div className="intake-bg" />

      <div className="intake-container">
        {/* Header */}
        <div className="intake-header">
          <div className="intake-logo">
            <Logo size={28} animated />
          </div>
          <div>
            <h1 className="intake-title">Welcome to EmoCare AI</h1>
            <p className="intake-sub">Help us understand you better — takes about 5 minutes</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="intake-steps">
          <div className="intake-track">
            <div className="intake-track-fill" style={{ width: `${progress}%` }} />
          </div>
          {STEPS.map((s, i) => (
            <div key={s.id}
              className={`intake-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              onClick={() => i < step && setStep(i)}>
              <div className="intake-dot-circle">
                {i < step ? '✓' : s.icon}
              </div>
              <span className="intake-dot-label">{s.title}</span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="intake-card">
          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>

              {/* Step 0 — Personal */}
              {step === 0 && (
                <div className="intake-fields">
                  <h2 className="intake-step-title">Personal Details</h2>
                  <p className="intake-step-desc">Basic information to personalize your experience</p>
                  <div className="intake-row">
                    <div className="intake-field">
                      <label className="input-label">Age</label>
                      <input className="input" type="number" placeholder="Your age"
                        value={form.age} onChange={(e) => set('age', e.target.value)} />
                    </div>
                    <div className="intake-field">
                      <label className="input-label">Gender</label>
                      <select className="input intake-select" value={form.gender}
                        onChange={(e) => set('gender', e.target.value)}>
                        <option value="">Select...</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Non-binary</option>
                        <option>Prefer not to say</option>
                      </select>
                    </div>
                  </div>
                  <div className="intake-field">
                    <label className="input-label">Occupation</label>
                    <input className="input" type="text" placeholder="Your occupation"
                      value={form.occupation} onChange={(e) => set('occupation', e.target.value)} />
                  </div>
                  <div className="intake-field">
                    <label className="input-label">Emergency Contact (optional)</label>
                    <input className="input" type="text" placeholder="Name and phone"
                      value={form.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)} />
                  </div>
                </div>
              )}

              {/* Step 1 — Concerns */}
              {step === 1 && (
                <div className="intake-fields">
                  <h2 className="intake-step-title">Your Concerns</h2>
                  <p className="intake-step-desc">Select everything that applies</p>
                  <div className="intake-chips">
                    {CONCERNS.map((c) => (
                      <button key={c} type="button"
                        className={`intake-chip ${form.primary_concerns.includes(c) ? 'selected' : ''}`}
                        onClick={() => toggle('primary_concerns', c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="intake-field" style={{ marginTop: 20 }}>
                    <label className="input-label">Describe your situation</label>
                    <textarea className="input intake-textarea" rows={5}
                      placeholder="Share as much or as little as you're comfortable with..."
                      value={form.describe_situation}
                      onChange={(e) => set('describe_situation', e.target.value)} />
                  </div>
                </div>
              )}

              {/* Step 2 — History */}
              {step === 2 && (
                <div className="intake-fields">
                  <h2 className="intake-step-title">Mental Health History</h2>
                  <p className="intake-step-desc">Select all that apply — helps your doctor</p>
                  <div className="intake-checkboxes">
                    {HISTORY_OPTIONS.map((h) => (
                      <label key={h} className="intake-checkbox-item">
                        <input type="checkbox" style={{ accentColor: 'var(--c06)' }}
                          checked={form.history_items.includes(h)}
                          onChange={() => toggle('history_items', h)} />
                        <span>{h}</span>
                      </label>
                    ))}
                  </div>
                  <div className="intake-field" style={{ marginTop: 20 }}>
                    <label className="input-label">Previous therapy experience (optional)</label>
                    <textarea className="input intake-textarea" rows={3}
                      placeholder="What worked, what didn't, any preferences..."
                      value={form.previous_therapy}
                      onChange={(e) => set('previous_therapy', e.target.value)} />
                  </div>
                </div>
              )}

              {/* Step 3 — Sharing */}
              {step === 3 && (
                <div className="intake-fields">
                  <h2 className="intake-step-title">Sharing Preferences</h2>
                  <p className="intake-step-desc">Control what your assigned doctor can see</p>
                  {[
                    { k: 'share_with_doctor',  label: 'Share my profile with doctor',            desc: 'Name, concerns, history' },
                    { k: 'share_sessions',      label: 'Share conversation summaries',            desc: 'General topics, not full transcripts' },
                    { k: 'share_audio',         label: 'Share audio recordings',                  desc: 'Raw audio from sessions' },
                    { k: 'share_risk_scores',   label: 'Share AI risk analysis',                  desc: 'Emotion scores and escalation levels' },
                  ].map((item) => (
                    <div key={item.k}
                      className={`intake-toggle-row ${form[item.k] ? 'on' : ''}`}
                      onClick={() => set(item.k, !form[item.k])}>
                      <div>
                        <div className="intake-toggle-label">{item.label}</div>
                        <div className="intake-toggle-desc">{item.desc}</div>
                      </div>
                      <div className={`intake-switch ${form[item.k] ? 'on' : ''}`}>
                        <div className="intake-knob" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 4 — Consent */}
              {step === 4 && (
                <div className="intake-fields">
                  <h2 className="intake-step-title">Consent & Agreement</h2>
                  <p className="intake-step-desc">Please read and accept the following</p>
                  {[
                    {
                      k: 'consent_treatment', required: true,
                      label: 'Consent to AI-assisted support',
                      desc: 'I understand EmoCare AI uses machine learning to analyze my messages. This is a research prototype — not a clinical diagnostic tool.',
                    },
                    {
                      k: 'consent_data', required: true,
                      label: 'Data processing consent',
                      desc: 'I consent to my conversation data being stored securely and processed by AI models to provide mental health support within this research platform.',
                    },
                    {
                      k: 'consent_research', required: false,
                      label: 'Research participation (optional)',
                      desc: 'I agree to anonymized data being used for improving AI models and mental health research. Optional — does not affect your access.',
                    },
                  ].map((item) => (
                    <label key={item.k} className="intake-consent-block">
                      <input type="checkbox" style={{ accentColor: 'var(--c06)', flexShrink: 0, marginTop: 3 }}
                        checked={form[item.k]}
                        onChange={(e) => set(item.k, e.target.checked)} />
                      <div>
                        <div className="intake-consent-label">
                          {item.label}
                          {item.required && <span className="intake-required">Required</span>}
                        </div>
                        <div className="intake-consent-desc">{item.desc}</div>
                      </div>
                    </label>
                  ))}
                  <div className="intake-field" style={{ marginTop: 20 }}>
                    <label className="input-label">Additional notes for your doctor (optional)</label>
                    <textarea className="input intake-textarea" rows={3}
                      placeholder="Anything else you'd like us to know..."
                      value={form.additional_notes}
                      onChange={(e) => set('additional_notes', e.target.value)} />
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="intake-nav">
          <button className="btn btn-secondary" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            ← Back
          </button>
          <span className="intake-nav-step">{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1
            ? <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>Next →</button>
            : <button className="btn btn-primary" onClick={submit} disabled={loading}>
                {loading ? <span className="dots"><span/><span/><span/></span> : 'Submit →'}
              </button>
          }
        </div>
      </div>
    </div>
  );
}