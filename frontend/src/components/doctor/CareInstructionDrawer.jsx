import React, { useState } from 'react';
import { Bell, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Drawer, Button } from '../ui';

export function CareInstructionDrawer({ open, onClose, onSubmit }) {
  const [patientName, setPatientName] = useState("Gurnoor Sandhu");
  const [patientId, setPatientId] = useState("P-0041");
  const [medicationName, setMedicationName] = useState("");
  const [schedule, setSchedule] = useState("Daily at 9:00 PM");
  const todayISO = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState("2026-09-30");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = Boolean(medicationName.trim() || notes.trim());

  const validate = () => {
    const errs = {};
    if (!medicationName.trim()) {
      errs.medicationName = "Medication or instruction name is required.";
    }
    if (!schedule.trim()) {
      errs.schedule = "Schedule frequency is required.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    onSubmit({
      patientId,
      patientName,
      doctorName: "Dr. Sarah Jenkins",
      type: "Medication Reminder",
      medicationName: medicationName.trim(),
      schedule: schedule.trim(),
      startDate,
      endDate,
      notes: notes.trim()
    });

    setIsSubmitting(false);
    setMedicationName("");
    setNotes("");
    onClose();
  };

  const footerActions = (
    <>
      <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button 
        variant="primary" 
        onClick={handleSubmit}
        loading={isSubmitting}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Issuing..." : "Issue Care Instruction"}
      </Button>
    </>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Issue Care Instruction"
      description="Issue patient-facing medication schedules and clinical care instructions."
      size="lg"
      footer={footerActions}
      isDirty={isDirty}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* 1. SELECT PATIENT */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            1. SELECT PATIENT
          </label>
          <select 
            className="input-field" 
            value={patientName} 
            onChange={(e) => {
              const val = e.target.value;
              setPatientName(val);
              setPatientId(val.includes("B") ? "P-0039" : "P-0041");
            }}
          >
            <option value="Gurnoor Sandhu">Gurnoor Sandhu (P-0041)</option>
            <option value="Patient B (Anonymized)">Patient B (P-0039)</option>
          </select>
        </div>

        {/* 2. MEDICATION / INSTRUCTION NAME */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            2. MEDICATION OR INSTRUCTION NAME (REQUIRED)
          </label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="e.g. Magnesium Glycinate 200mg or Daily CBT Journaling" 
            value={medicationName} 
            onChange={(e) => {
              setMedicationName(e.target.value);
              if (errors.medicationName) setErrors({ ...errors, medicationName: null });
            }} 
            required 
          />
          {errors.medicationName && (
            <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <AlertCircle size={13} /> {errors.medicationName}
            </div>
          )}
        </div>

        {/* 3. SCHEDULE FREQUENCY */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            3. SCHEDULE FREQUENCY (REQUIRED)
          </label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="e.g. Daily at 9:00 PM or Twice daily after meals" 
            value={schedule} 
            onChange={(e) => {
              setSchedule(e.target.value);
              if (errors.schedule) setErrors({ ...errors, schedule: null });
            }} 
            required 
          />
          {errors.schedule && <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4 }}>{errors.schedule}</div>}
        </div>

        {/* 4. DURATION DATES */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
              4. START DATE
            </label>
            <input 
              type="date" 
              className="input-field" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              required 
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
              5. END DATE
            </label>
            <input 
              type="date" 
              className="input-field" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              required 
            />
          </div>
        </div>

        {/* 5. CLINICAL NOTES & RATIONALE */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            6. CLINICAL NOTES & RATIONALE (OPTIONAL)
          </label>
          <textarea
            className="input-field"
            rows={3}
            placeholder="e.g. Take with warm water before sleep. Monitor for drowsiness..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ height: "auto" }}
          />
        </div>
      </form>
    </Drawer>
  );
}
