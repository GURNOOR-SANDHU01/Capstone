import React, { useState } from 'react';
import { Modal, Button } from '../ui';

export function RescheduleAppointmentModal({
  isOpen,
  onClose,
  appointment,
  onSubmit
}) {
  const tomorrowISO = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [newDate, setNewDate] = useState(tomorrowISO);
  const [saving, setSaving] = useState(false);
  const [newTime, setNewTime] = useState("03:00 PM");
  const [note, setNote] = useState("Please let me know if this proposed time works for you.");

  if (!appointment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const ok = await onSubmit(appointment.id, newDate, newTime, note.trim());
      if (ok !== false) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Propose New Appointment Time">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          Current appointment: <strong>{appointment.date} at {appointment.time}</strong>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>PROPOSED DATE</label>
            <input type="date" className="input-field" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>PROPOSED TIME</label>
            <input type="text" className="input-field" value={newTime} onChange={(e) => setNewTime(e.target.value)} required />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>MESSAGE / RATIONALE</label>
          <textarea className="input-field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={{ height: "auto" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Send Reschedule Request</Button>
        </div>
      </form>
    </Modal>
  );
}
