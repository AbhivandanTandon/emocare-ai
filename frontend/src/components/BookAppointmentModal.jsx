import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import API from '../api/client';
import './BookAppointmentModal.css';

export default function BookAppointmentModal({ onClose }) {
  const [doctors,  setDoctors]  = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [datetime, setDatetime] = useState('');
  const [notes,    setNotes]    = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    API.get('/appointments/doctors')
      .then((r) => setDoctors(r.data))
      .catch(() => {});
  }, []);

  const submit = async () => {
    if (!datetime) { toast.error('Please select a date and time'); return; }
    setLoading(true);
    try {
      // Append browser timezone offset so backend gets a full ISO string
      // e.g. "2026-03-25T18:30" → "2026-03-25T18:30:00+05:30"
      const off = new Date().getTimezoneOffset();          // e.g. -330 for IST
      const sign = off <= 0 ? '+' : '-';
      const absOff = Math.abs(off);
      const hh = String(Math.floor(absOff / 60)).padStart(2, '0');
      const mm = String(absOff % 60).padStart(2, '0');
      const tzString = `${datetime}:00${sign}${hh}:${mm}`;

      await API.post('/appointments', {
        scheduled_at: tzString,
        doctor_id:    doctorId || null,
        notes,
      });
      toast.success('Appointment requested! Check your email for confirmation.');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="modal-box"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="modal-header">
          <h2 className="modal-title">Book an Appointment</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label className="input-label">Preferred Doctor (optional)</label>
            <select className="input" value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Any available doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="modal-field">
            <label className="input-label">Preferred Date & Time</label>
            <input className="input" type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <div className="modal-field">
            <label className="input-label">Notes for the doctor (optional)</label>
            <textarea
              className="input"
              style={{ height: 'auto', padding: '12px 14px', resize: 'vertical' }}
              rows={3}
              placeholder="What would you like to discuss?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading
              ? <span className="dots"><span/><span/><span/></span>
              : 'Request Appointment'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}