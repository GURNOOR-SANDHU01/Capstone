import { useCallback, useEffect, useRef, useState } from 'react';

const PREFERRED_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const pickMimeType = () => PREFERRED_TYPES.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
const nowMs = () => Date.now();

export const canRecordAudio = () =>
  typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

export const formatSeconds = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Browser microphone recording (MediaRecorder) with a live input level and an auto-stop limit.
 * The audio stays in memory as a Blob; nothing is written to browser storage.
 *
 *   const rec = useAudioRecorder({ maxSeconds: 120, onRecorded: (blob, seconds) => ... });
 *   rec.start(); rec.stop(); rec.cancel();
 *   rec.state: 'idle' | 'recording';  rec.seconds; rec.level (0..1); rec.error
 */
export function useAudioRecorder({ maxSeconds = 120, minSeconds = 1, onRecorded } = {}) {
  const [state, setState] = useState('idle');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  const cleanupStream = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
  }, [stop]);

  useEffect(() => () => {
    cancelledRef.current = true;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    cleanupStream();
  }, [cleanupStream]);

  const start = useCallback(async () => {
    if (recorderRef.current?.state === 'recording') return;
    setError('');
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }
      });
      streamRef.current = stream;

      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 64));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }

      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        cleanupStream();
        setState('idle');
        if (cancelledRef.current) return;
        const duration = (nowMs() - startedAtRef.current) / 1000;
        if (duration < minSeconds) {
          setError('That recording was too short. Hold on a little longer.');
          return;
        }
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mimeType || 'audio/webm' });
        onRecordedRef.current?.(blob, duration);
      };
      recorderRef.current = rec;
      startedAtRef.current = nowMs();
      setSeconds(0);
      rec.start(250);
      setState('recording');
      timerRef.current = setInterval(() => {
        const s = (nowMs() - startedAtRef.current) / 1000;
        setSeconds(s);
        if (s >= maxSeconds) stop();
      }, 200);
    } catch (err) {
      cleanupStream();
      setState('idle');
      setError(
        err?.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow microphone access in your browser settings and try again.'
          : err?.name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : 'Could not start recording on this browser.'
      );
    }
  }, [cleanupStream, maxSeconds, minSeconds, stop]);

  return { state, seconds, level, error, setError, start, stop, cancel };
}
