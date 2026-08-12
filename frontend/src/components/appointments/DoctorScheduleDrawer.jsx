import React, { useState } from 'react';
import { Video, Building, AlertCircle, User, MapPin } from 'lucide-react';
import { Drawer, Button } from '../ui';
import { TimeSlotSelector } from './TimeSlotSelector';

export function DoctorScheduleDrawer({ open, onClose, onSubmit }) {
  const [patientName, setPatientName] = useState("Gurnoor Sandhu");
  const [patientId, setPatientId] = useState("P-0041");
  const [clinicName, setClinicName] = useState("SentiMed Central Clinic");
  const todayISO = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayISO);
  const [time, setTime] = useState("10:30 AM");
  const [type, setType] = useState("Video Consultation");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = Boolean(reason.trim() || notes.trim() || date !== todayISO);

  const validate = () => {
    const errs = {};
    if (!reason.trim()) {
      errs.reason = "Clinical reason for consultation is required.";
    }
    if (!date) {
      errs.date = "Please select a valid date.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    onSubmit({
      doctorId: "D-201",
      doctorName: "Dr. Sarah Jenkins",
      specialization: "Clinical Neuropsychology",
      patientName,
      patientId,
      clinicName,
      date,
      time,
      type,
      reason: reason.trim(),
      notes: notes.trim(),
      meetingProvider: "google-meet",
      meetingUrl: "https://meet.google.com/demo-sentimed-call"
    });

    setIsSubmitting(false);
    setReason("");
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
        {isSubmitting ? "Scheduling..." : "Schedule & Confirm"}
      </Button>
    </>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Schedule Patient Appointment"
      description="Schedule a confirmed consultation directly for an authorized patient."
      size="lg"
      footer={footerActions}
      isDirty={isDirty}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* 1. SELECT PATIENT */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            1. SELECT AUTHORIZED PATIENT
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

        {/* 2. CLINIC LOCATION */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            2. CLINIC LOCATION
          </label>
          <input 
            type="text" 
            className="input-field" 
            value={clinicName} 
            onChange={(e) => setClinicName(e.target.value)} 
            required 
          />
        </div>

        {/* 3. CONSULTATION DATE */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            3. CONSULTATION DATE
          </label>
          <input 
            type="date" 
            className="input-field" 
            value={date} 
            min={todayISO}
            onChange={(e) => {
              setDate(e.target.value);
              if (errors.date) setErrors({ ...errors, date: null });
            }} 
            required 
          />
          {errors.date && <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4 }}>{errors.date}</div>}
        </div>

        {/* 4. PREFERRED TIME SLOT */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 8 }}>
            4. TIME SLOT
          </label>
          <TimeSlotSelector
            selectedTime={time}
            onSelect={(slot) => setTime(slot)}
          />
        </div>

        {/* 5. CONSULTATION TYPE */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 8 }}>
            5. CONSULTATION TYPE
          </label>
          <div className="segmented-control">
            <button
              type="button"
              onClick={() => setType("Video Consultation")}
              className={`segmented-tab ${type === "Video Consultation" ? "active" : ""}`}
            >
              <Video size={15} />
              <span>Video Consultation (Google Meet)</span>
            </button>
            <button
              type="button"
              onClick={() => setType("In-person Consultation")}
              className={`segmented-tab ${type === "In-person Consultation" ? "active" : ""}`}
            >
              <Building size={15} />
              <span>In-person Consultation</span>
            </button>
          </div>
        </div>

        {/* 6. REASON FOR CONSULTATION */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            6. CLINICAL REASON (REQUIRED)
          </label>
          <textarea
            className="input-field"
            rows={3}
            placeholder="Clinical rationale, symptoms review, or follow-up goals..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (errors.reason) setErrors({ ...errors, reason: null });
            }}
            style={{ height: "auto", borderColor: errors.reason ? "var(--color-danger)" : undefined }}
          />
          {errors.reason && (
            <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <AlertCircle size={13} /> {errors.reason}
            </div>
          )}
        </div>

        {/* 7. CLINICAL NOTES */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            7. CLINICAL INSTRUCTIONS / NOTES (OPTIONAL)
          </label>
          <textarea
            className="input-field"
            rows={2}
            placeholder="Instructions for patient prior to consultation..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ height: "auto" }}
          />
        </div>
      </form>
    </Drawer>
  );
}
