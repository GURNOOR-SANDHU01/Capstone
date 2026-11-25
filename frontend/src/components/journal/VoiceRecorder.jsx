import React, { useEffect, useState } from 'react';
import { Mic, Square, RotateCcw, Loader2, Send, AlertCircle } from 'lucide-react';
import { useAudioRecorder, formatSeconds as fmt } from '../../hooks/useAudioRecorder';

const MAX_SECONDS = 120;
// The voice-emotion model listens to the first 12 s; Whisper transcribes the whole recording
const VOICE_MODEL_SECONDS = 12;

/**
 * Records a voice journal entry in the browser and hands the Blob to onSubmit.
 * States: idle -> recording -> recorded (review/playback) -> (submitting) -> idle
 */
export default function VoiceRecorder({ onSubmit, busy = false, disabled = false }) {
  const [recorded, setRecorded] = useState(null); // { blob, url, seconds }
  const rec = useAudioRecorder({
    maxSeconds: MAX_SECONDS,
    onRecorded: (blob, seconds) => setRecorded({ blob, url: URL.createObjectURL(blob), seconds })
  });

  useEffect(() => () => recorded?.url && URL.revokeObjectURL(recorded.url), [recorded]);

  const discard = () => setRecorded(null);

  const submit = async () => {
    if (!recorded) return;
    const ok = await onSubmit(recorded.blob);
    if (ok) discard();
  };

  const isRecording = rec.state === 'recording';

  return (
    <div
      style={{
        border: '1px dashed var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'center',
        background: isRecording ? 'rgba(231, 76, 60, 0.05)' : 'var(--color-bg)'
      }}
    >
      {!recorded && (
        <>
          <button
            type="button"
            onClick={isRecording ? rec.stop : rec.start}
            disabled={disabled || busy}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: 'none',
              cursor: disabled || busy ? 'not-allowed' : 'pointer',
              background: isRecording ? '#E74C3C' : 'var(--color-primary-dark)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isRecording ? `0 0 0 ${4 + rec.level * 14}px rgba(231, 76, 60, 0.25)` : 'none',
              transition: 'box-shadow 0.08s'
            }}
          >
            {isRecording ? <Square size={24} /> : <Mic size={26} />}
          </button>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {isRecording ? `Recording… ${fmt(rec.seconds)} / ${fmt(MAX_SECONDS)}` : 'Tap to start speaking'}
          </div>
          {isRecording && (
            <div style={{ width: '100%', maxWidth: 260, height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(rec.level * 100)}%`, height: '100%', background: '#E74C3C', transition: 'width 0.08s' }} />
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: 360 }}>
            Speak naturally about your day. Your words are transcribed and your tone of voice is analysed
            (mainly the first {VOICE_MODEL_SECONDS} seconds). The recording itself is not stored.
          </div>
        </>
      )}

      {recorded && (
        <>
          <audio src={recorded.url} controls style={{ width: '100%' }} />
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Recorded {fmt(recorded.seconds)}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={discard} disabled={busy}>
              <RotateCcw size={14} /> <span>Re-record</span>
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
              {busy ? <Loader2 size={14} className="spin-anim" /> : <Send size={14} />}
              <span>{busy ? 'Transcribing & analysing…' : 'Analyse & Save'}</span>
            </button>
          </div>
        </>
      )}

      {rec.error && (
        <div role="alert" style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#C0392B' }}>
          <AlertCircle size={14} /> <span>{rec.error}</span>
        </div>
      )}
    </div>
  );
}
