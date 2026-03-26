import React, { useState } from 'react';
import { motion } from 'framer-motion';
import './AppointmentCalendar.css';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_COLOR = {
  pending:   '#C07820',
  confirmed: '#4A7C3F',
  cancelled: '#C03820',
  completed: 'var(--text-5)',
};

export default function AppointmentCalendar({ appointments }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(null);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const dayAppts = (day) => {
    return appointments.filter((a) => {
      const ad = new Date(a.scheduled_at);
      return ad.getFullYear() === year &&
             ad.getMonth()    === month &&
             ad.getDate()     === day;
    });
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (day) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year  === today.getFullYear();

  return (
    <div className="cal-root">
      {/* Header */}
      <div className="cal-header">
        <button className="btn btn-secondary btn-sm" onClick={prevMonth}>←</button>
        <h2 className="cal-title">{MONTHS[month]} {year}</h2>
        <button className="btn btn-secondary btn-sm" onClick={nextMonth}>→</button>
      </div>

      {/* Day names */}
      <div className="cal-days-header">
        {DAYS.map((d) => <div key={d} className="cal-day-name">{d}</div>)}
      </div>

      {/* Grid */}
      <div className="cal-grid">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="cal-cell empty" />;
          const appts = dayAppts(day);
          return (
            <div
              key={day}
              className={`cal-cell
                ${isToday(day) ? 'today' : ''}
                ${selected === day ? 'sel' : ''}
                ${appts.length > 0 ? 'has-appts' : ''}`}
              onClick={() => setSelected(selected === day ? null : day)}
            >
              <span className="cal-day-num">{day}</span>
              <div className="cal-dots">
                {appts.slice(0, 3).map((a, j) => (
                  <span key={j} className="cal-dot"
                    style={{ background: STATUS_COLOR[a.status] }}
                    title={`${a.user?.name || a.doctor?.name || 'Appointment'} — ${a.status}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail */}
      {selected && dayAppts(selected).length > 0 && (
        <motion.div className="cal-detail"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}>
          <h3 className="cal-detail-title">{MONTHS[month]} {selected}, {year}</h3>
          {dayAppts(selected).map((a) => (
            <div key={a.id} className="cal-appt-item">
              <div className="cal-appt-bar" style={{ background: STATUS_COLOR[a.status] }} />
              <div className="cal-appt-info">
                <div className="cal-appt-user">
                  {a.user?.name || a.doctor?.name || 'Appointment'}
                </div>
                <div className="cal-appt-time">
                  {new Date(a.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {a.doctor && ` · Dr. ${a.doctor.name}`}
                </div>
                {a.notes && <div className="cal-appt-notes">{a.notes}</div>}
              </div>
              <span className={`badge ${
                a.status === 'confirmed' ? 'badge-green'  :
                a.status === 'cancelled' ? 'badge-red'    :
                a.status === 'completed' ? 'badge-dim'    : 'badge-yellow'
              }`}>{a.status}</span>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}