import React from 'react';
import { Video, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';

/**
 * Reusable MeetingButton Component
 * Renders the appointment's video call join link, opening in a new tab.
 * Displays "Meeting link unavailable" when no URL exists.
 */
export function MeetingButton({
  meetingUrl,
  provider = "google-meet",
  size = "md",
  disabled = false,
  style = {},
  className = ""
}) {
  if (!meetingUrl) {
    return (
      <Button
        variant="ghost"
        size={size}
        disabled={true}
        style={{ opacity: 0.6, cursor: "not-allowed", ...style }}
        className={className}
      >
        <span>Meeting link unavailable</span>
      </Button>
    );
  }

  return (
    <a
      href={meetingUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none" }}
    >
      <Button
        variant="primary"
        size={size}
        disabled={disabled}
        icon={Video}
        style={{ ...style }}
        className={className}
      >
        <span>{provider === "jitsi" ? "Join Video Call" : "Join Google Meet"}</span>
        <ExternalLink size={14} style={{ marginLeft: 4 }} />
      </Button>
    </a>
  );
}
