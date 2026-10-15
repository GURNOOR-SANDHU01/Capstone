import React from 'react';
import { Stethoscope, MapPin, Check } from 'lucide-react';

import { AVAILABLE_DOCTORS_DEMO } from '../../data/mockData';

export function DoctorSelector({ selectedDoctorId, onSelect, doctors = AVAILABLE_DOCTORS_DEMO }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {doctors.map((doc) => {
        const isSelected = selectedDoctorId === doc.id;
        return (
          <div
            key={doc.id}
            onClick={() => onSelect(doc)}
            style={{
              padding: 12,
              borderRadius: 10,
              border: isSelected ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
              background: isSelected ? "var(--color-primary-soft)" : "var(--color-surface)",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              transition: "all 0.15s ease"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#EAF7F2", color: "#2E7D62", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Stethoscope size={20} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E" }}>{doc.name}</div>
                <div style={{ fontSize: 12, color: "var(--color-primary-dark)", fontWeight: 600 }}>{doc.specialization}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <MapPin size={11} /> {doc.clinic}
                </div>
              </div>
            </div>

            {isSelected && (
              <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "var(--color-primary-dark)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Check size={14} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
