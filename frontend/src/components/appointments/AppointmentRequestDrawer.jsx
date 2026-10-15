import React, { useState, useEffect } from 'react';
import { Video, Building, AlertCircle } from 'lucide-react';
import { Drawer, Button } from '../ui';
import { DoctorSelector } from './DoctorSelector';
import { TimeSlotSelector } from './TimeSlotSelector';
import { listDoctors } from '../../services/clinicalApi';
import { describeError } from '../../services/apiClient';
import { useAsyncData } from '../../hooks/useAsyncData';
import { LoadState } from '../ui';

export function AppointmentRequestDrawer({ open, onClose, onSubmit }) {
  const doctors = useAsyncData(listDoctors, [], []);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  useEffect(() => {
    if (!selectedDoctor && doctors.data?.length) setSelectedDoctor(doctors.data[0]);
  }, [doctors.data, selectedDoctor]);
  const [submitError, setSubmitError] = useState("");
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
      errs.reason = "Reason for appointment is required.";
    }
    if (!date) {
      errs.date = "Please select a valid date.";
    }
    if (!selectedDoctor) {
      errs.doctor = "Please choose a doctor.";
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
      // The patient's identity is taken from the signed-in account on the server
      await onSubmit({
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        specialization: selectedDoctor.specialization,
        clinicName: selectedDoctor.clinic,
        date,
        time,
        type,
        reason: reason.trim(),
        notes: notes.trim()
      });
      setReason("");
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
        {isSubmitting ? "Sending Request..." : "Send Appointment Request"}
      </Button>
    </>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Request Doctor Appointment"
      description="Choose a doctor and request a consultation."
      size="lg"
      footer={footerActions}
      isDirty={isDirty}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* 1. SELECT DOCTOR & CLINIC */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 8 }}>
            1. SELECT DOCTOR & CLINIC
          </label>
          <LoadState loading={doctors.loading} error={doctors.error} onRetry={doctors.reload} label="Loading doctors..." />
          {!doctors.loading && !doctors.error && (doctors.data || []).length === 0 && (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>No doctors are available for booking yet.</p>
          )}
          <DoctorSelector
            doctors={doctors.data || []}
            selectedDoctorId={selectedDoctor?.id}
            onSelect={(doc) => setSelectedDoctor(doc)}
          />
          {errors.doctor && <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4 }}>{errors.doctor}</div>}
        </div>

        {/* 2. PREFERRED DATE */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            2. PREFERRED DATE
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

        {/* 3. PREFERRED TIME SLOT */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 8 }}>
            3. PREFERRED TIME SLOT
          </label>
          <TimeSlotSelector
            selectedTime={time}
            onSelect={(slot) => setTime(slot)}
          />
        </div>

        {/* 4. CONSULTATION TYPE */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 8 }}>
            4. CONSULTATION TYPE
          </label>
          <div className="segmented-control">
            <button
              type="button"
              onClick={() => setType("Video Consultation")}
              className={`segmented-tab ${type === "Video Consultation" ? "active" : ""}`}
            >
              <Video size={15} />
              <span>Video Consultation</span>
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

        {/* 5. REASON FOR APPOINTMENT */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            5. REASON FOR APPOINTMENT (REQUIRED)
          </label>
          <textarea
            className="input-field"
            rows={3}
            placeholder="Briefly describe your current symptoms, concerns, or goals..."
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

        {/* 6. ADDITIONAL NOTES */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            6. ADDITIONAL NOTES (OPTIONAL)
          </label>
          <textarea
            className="input-field"
            rows={2}
            placeholder="Any scheduling preferences or additional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ height: "auto" }}
          />
        </div>
      </form>
    </Drawer>
  );
}
