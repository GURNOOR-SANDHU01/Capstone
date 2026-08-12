import React, { useState } from 'react';
import { 
  Video, 
  Building, 
  AlertCircle 
} from 'lucide-react';
import { Modal, Button } from '../ui';
import { DoctorSelector, AVAILABLE_DOCTORS_DEMO } from './DoctorSelector';
import { TimeSlotSelector } from './TimeSlotSelector';

export function ScheduleAppointmentModal({ 
  isOpen, 
  onClose, 
  userRole = "patient", 
  onSubmit 
}) {
  const isDoctor = userRole === "doctor";

  // Form State
  const [selectedDoctor, setSelectedDoctor] = useState(AVAILABLE_DOCTORS_DEMO[0]);
  const [patientName, setPatientName] = useState("Gurnoor Sandhu");
  const todayISO = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayISO);
  const [time, setTime] = useState("10:30 AM");
  const [type, setType] = useState("Video Consultation");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Validation State
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const errs = {};
    if (!reason.trim()) {
      errs.reason = "Reason for appointment is required.";
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

    // Immediately submit to state repository & close modal instantly
    onSubmit({
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      specialization: selectedDoctor.specialization,
      clinicName: selectedDoctor.clinic,
      patientName,
      patientId: "P-0041",
      date,
      time,
      type,
      reason: reason.trim(),
      notes: notes.trim(),
      meetingProvider: null,
      meetingUrl: null
    });

    setIsSubmitting(false);
    setReason("");
    setNotes("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isDoctor ? "Schedule Patient Appointment" : "Request Doctor Appointment"}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Doctor Selector */}
        {!isDoctor ? (
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
              1. SELECT DOCTOR & CLINIC
            </label>
            <DoctorSelector
              selectedDoctorId={selectedDoctor.id}
              onSelect={(doc) => setSelectedDoctor(doc)}
            />
          </div>
        ) : (
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>SELECT PATIENT</label>
            <select className="input-field" value={patientName} onChange={(e) => setPatientName(e.target.value)}>
              <option value="Gurnoor Sandhu">Gurnoor Sandhu (P-0041)</option>
              <option value="Patient B (Anonymized)">Patient B (P-0039)</option>
            </select>
          </div>
        )}

        {/* Preferred Date (Future Dates Only) */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
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

        {/* Preferred Time Slot */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
            3. PREFERRED TIME SLOT
          </label>
          <TimeSlotSelector
            selectedTime={time}
            onSelect={(slot) => setTime(slot)}
          />
        </div>

        {/* Consultation Type Selector */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
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

        {/* Reason for Appointment (Required) */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
            5. REASON FOR APPOINTMENT (REQUIRED)
          </label>
          <textarea
            className="input-field"
            rows={2}
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

        {/* Additional Notes (Optional) */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
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

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Send Appointment Request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
