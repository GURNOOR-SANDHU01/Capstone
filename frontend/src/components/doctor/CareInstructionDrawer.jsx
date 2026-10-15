import React, { useState } from 'react';
import { Bell, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Drawer, Button, LoadState } from '../ui';
import { listMyPatients } from '../../services/clinicalApi';
import { describeError } from '../../services/apiClient';
import { useAsyncData } from '../../hooks/useAsyncData';

export function CareInstructionDrawer({ open, onClose, onSubmit }) {
  const roster = useAsyncData(listMyPatients, [], []);
  const patients = roster.data || [];
  const [patientId, setPatientId] = useState("");
  const selectedPatientId = patientId || patients[0]?.id || "";
  const patientName = patients.find((p) => p.id === selectedPatientId)?.name || "";
  const [submitError, setSubmitError] = useState("");
  const [medicationName, setMedicationName] = useState("");
  const [schedule, setSchedule] = useState("Daily at 9:00 PM");
  const todayISO = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState("");
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
    if (!selectedPatientId) {
      errs.patient = "Select a consenting patient.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError("");
    try {
      await onSubmit({
        patientId: selectedPatientId,
        patientName,
        type: "Medication Reminder",
        medicationName: medicationName.trim(),
        schedule: schedule.trim(),
        startDate,
        endDate,
        notes: notes.trim()
      });
      setMedicationName("");
      setNotes("");
      onClose();
    } catch (err) {
      setSubmitError(describeError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const footerActions = (
    <>
      {submitError && <span role="alert" style={{ color: "#C0392B", fontSize: 12, flex: 1 }}>{submitError}</span>}
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
          <LoadState loading={roster.loading} error={roster.error} onRetry={roster.reload} label="Loading patients..." />
          {!roster.loading && !roster.error && patients.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>No patients currently consent to your care.</p>
          ) : (
            <select className="input-field" value={selectedPatientId} onChange={(e) => setPatientId(e.target.value)}>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {errors.patient && <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4 }}>{errors.patient}</div>}
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
