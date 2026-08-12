import React from 'react';
import { Clock } from 'lucide-react';

export const TIME_SLOTS_DEMO = [
  "09:00 AM",
  "10:30 AM",
  "01:30 PM",
  "03:00 PM",
  "04:30 PM"
];

export function TimeSlotSelector({ selectedTime, onSelect }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
      {TIME_SLOTS_DEMO.map((slot) => {
        const isSelected = selectedTime === slot;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onSelect(slot)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: isSelected ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
              background: isSelected ? "var(--color-primary-soft)" : "var(--color-surface)",
              color: isSelected ? "var(--color-primary-dark)" : "var(--color-text)",
              fontWeight: isSelected ? 700 : 500,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            <Clock size={13} />
            <span>{slot}</span>
          </button>
        );
      })}
    </div>
  );
}
