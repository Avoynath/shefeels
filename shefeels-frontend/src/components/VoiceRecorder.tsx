import { useState, useRef, useEffect } from 'react';
import MicIcon from '../assets/chat/MicIcon.svg';
import { buildApiUrl } from '../utils/apiBase';
import fetchWithAuth from '../utils/fetchWithAuth';
import { useToastActions } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/api';

type Props = {
  // imageUrl is optional and will be provided when the server generated an image
  // imageJobId is optional and will be provided when async image generation is in progress
  onResult: (inputUrl: string | null, outputUrl: string | null, transcript?: string, imageUrl?: string | null, imageJobId?: string | null) => void;
};

type ExtraProps = {
  className?: string;
  style?: React.CSSProperties;
};

export default function VoiceRecorder({ onResult, className, style }: Props & ExtraProps) {
  const { showError } = useToastActions();
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const skipUploadRef = useRef(false);
  const revokeTimersRef = useRef<number[]>([]);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [audioData, setAudioData] = useState<number[]>(new Array(40).fill(0));

  useEffect(() => {
    return () => {
      if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      try {
        for (const t of revokeTimersRef.current || []) {
          try { clearTimeout(t); } catch (e) { }
        }
      } catch (e) { }
    };
  }, []);

  // Update audio visualization
  useEffect(() => {
    if (!recording || paused) return;

    const updateVisualization = () => {
      if (!analyserRef.current) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Sample 40 bars from the frequency data
      const bars = 40;
      const step = Math.floor(bufferLength / bars);
      const newData = [];
      for (let i = 0; i < bars; i++) {
        const value = dataArray[i * step] / 255; // Normalize to 0-1
        newData.push(value);
      }
      setAudioData(newData);
    };

    const animationId = requestAnimationFrame(function animate() {
      updateVisualization();
      if (recording && !paused) {
        requestAnimationFrame(animate);
      }
    });

    return () => cancelAnimationFrame(animationId);
  }, [recording, paused]);

  async function ensurePermission() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // API not supported
        alert('Microphone not supported in this browser. Use a modern browser with getUserMedia.');
        return false;
      }

      // If not a secure context (http on non-localhost) many browsers block getUserMedia
      if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        alert('Microphone access requires HTTPS or localhost. Please open the app on https or use localhost.');
        return false;
      }

      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      return true;
    } catch (e) {
      console.warn('ensurePermission failed', e);
      // Provide user-facing feedback for permission denial or errors
      try {
        const err = e as any;
        if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
          alert('Microphone permission was denied. Allow microphone access in your browser and try again.');
          return false;
        }
      } catch { }
      return false;
    }
  }

  async function startRecording() {
    if (!(await ensurePermission())) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      if (!mr) {
        alert('Recording is not supported on this device/browser.');
        return;
      }

      // Setup audio visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      skipUploadRef.current = false;
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        try {
          setBusy(true);
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          // If user cancelled (delete), skip upload and cleanup
          if (skipUploadRef.current) {
            chunksRef.current = [];
            return;
          }

          // Create a file for upload
          const file = new File([blob], 'recording.webm', { type: 'audio/webm' });

          // Create a local object URL so the UI can render the user's sent voice immediately
          try {
            const localUrl = URL.createObjectURL(blob);
            // Revoke after 5 minutes
            const id = window.setTimeout(() => { try { URL.revokeObjectURL(localUrl); } catch (e) { } }, 1000 * 60 * 5);
            revokeTimersRef.current.push(id as unknown as number);
            try { onResult(localUrl, null, undefined); } catch (e) { console.error('onResult local render error', e); }
          } catch (e) { console.warn('Failed to create local object URL', e); }

          // Upload in background; when server responds, only render the AI response
          try {
            const resJson = await upload(file);
            // Parse nested audio structure from response
            const audioData = resJson?.audio || {};
            const outputUrl = audioData?.output_url || resJson?.output_url || resJson?.outputUrl || null;
            const imageUrl = audioData?.image_url || resJson?.image_url || resJson?.imageUrl || resJson?.image || null;
            const transcript = audioData?.transcript || resJson?.transcript || resJson?.transcription || '';
            // Extract image_job_id for async image generation
            const imageJobId = resJson?.image_job_id || null;
            if (outputUrl || imageJobId) {
              try { onResult(null, outputUrl, transcript, imageUrl, imageJobId); } catch (e) { console.error('onResult server response error', e); }
            }
          } catch (e) {
            console.error('upload error', e);
          }
        } finally {
          setBusy(false);
          if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
          }
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setPaused(false);
      setDuration(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (e) {
      console.error('startRecording error', e);
      alert('Failed to start microphone recording. Check console for details and ensure your browser supports microphone capture.');
    }
  }

  function stopRecording() {
    try {
      const mr = mediaRef.current;
      if (!mr) return;
      if (mr.state !== 'inactive') mr.stop();
      mediaRef.current = null;
      setRecording(false);
      setPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (e) { }
  }

  function pauseRecording() {
    try {
      const mr = mediaRef.current;
      if (!mr || mr.state !== 'recording') return;
      mr.pause();
      setPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (e) {
      console.error('pauseRecording error', e);
    }
  }

  function resumeRecording() {
    try {
      const mr = mediaRef.current;
      if (!mr || mr.state !== 'paused') return;
      mr.resume();
      setPaused(false);
      // Restart timer
      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (e) {
      console.error('resumeRecording error', e);
    }
  }

  function cancelRecording() {
    try {
      const mr = mediaRef.current;
      if (!mr) return;
      // Indicate that upload should be skipped when the recorder stops
      skipUploadRef.current = true;
      // Stop tracks without uploading
      try { if (mr.state !== 'inactive') mr.stream.getTracks().forEach(track => track.stop()); } catch (e) { }
      mediaRef.current = null;
      chunksRef.current = [];
      setRecording(false);
      setPaused(false);
      setDuration(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch (e) {
      console.error('cancelRecording error', e);
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async function upload(file: File) {
    // Detailed grouped logs for observability
    console.group('🎬 Voice Turn');
    try {
      console.log('🎙️ start upload; file=', file.name, 'size(bytes)=', file.size);
      const fd = new FormData();
      fd.append('file', file);
      // attempt to send character_id and session_id if available in global state
      try {
        const sel = (window as any).__hl_selected_character_id;
        if (sel) fd.append('character_id', String(sel));
      } catch { }
      try {
        const sid = (window as any).__hl_session_id || `session-${Date.now()}`;
        fd.append('session_id', sid);
      } catch { }

      const token = localStorage.getItem('hl_token');
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = buildApiUrl('/voice/chat');
      console.log('⬆️ POST', url, { sessionId: (window as any).__hl_session_id, characterId: (window as any).__hl_selected_character_id });
      const res = await fetchWithAuth(url, { method: 'POST', body: fd, headers });
      if (!res.ok) {
        // Try to parse structured error body to surface helpful messages
        let errBody: any = null;
        try { errBody = await res.json(); } catch (e) { errBody = null; }
        const status = res.status;
        try {
          if (status >= 400 && status < 500) {
            const detail = errBody?.detail ?? errBody?.message ?? getErrorMessage(errBody) ?? `Request failed (${status})`;
            showError('Failed to send voice message', String(detail));
          } else if (status >= 500) {
            // server side error
            // eslint-disable-next-line no-console
            console.warn('/voice/chat server error', status, errBody);
            showError('Failed to send voice message', 'Unable to process your request currently.');
          } else {
            showError('Failed to send voice message', getErrorMessage(errBody));
          }
        } catch (ee) {
          try { showError('Failed to send voice message', `Request failed (${status})`); } catch (e) { }
        }
        console.groupEnd();
        throw new Error('voice upload failed');
      }
      const j = await res.json();
      console.log('✅ /voice/chat response:', j);
      console.groupEnd();
      return j;
    } catch (e) {
      console.error('voice upload', e);
      try { showError('Failed to send voice message', getErrorMessage(e)); } catch (ee) { }
      console.groupEnd();
      throw e;
    }
  }

  // Normal state - just the mic button
  if (!recording) {
    return (
      <button
        type="button"
        onClick={() => {
          if (busy) return;
          startRecording();
        }}
        className={`transition-colors p-0 text-white/70 hover:text-white ${busy ? 'opacity-50 cursor-not-allowed' : ''} ${className || ''}`}
        title={busy ? 'Processing...' : 'Record voice'}
        disabled={busy}
        style={style}
      >
        {busy ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" className="animate-spin">
            <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
          </svg>
        ) : (
          <img src={MicIcon} alt="Mic" width={16} height={16} style={{ display: 'block' }} />
        )}
      </button>
    );
  }

  // Recording state - inline, constrained to the input container to avoid overflow
  return (
    <div className="absolute inset-x-0 bottom-0 z-50 flex items-end" style={{ pointerEvents: 'none' }}>
      <div className="w-full bg-[#2b2418] border-t border-white/[0.06] px-3 py-2 flex items-center gap-3 max-h-[64px] overflow-hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', pointerEvents: 'auto' }}>
        {/* Delete button */}
        <button
          type="button"
          onClick={cancelRecording}
          className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          title="Cancel recording"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Recording indicator with waveform */}
        <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 min-w-0 overflow-hidden">
          {/* Red recording dot */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          </div>

          {/* Timer */}
          <span className="text-white/90 text-sm font-mono min-w-[40px]">
            {formatTime(duration)}
          </span>

          {/* Audio waveform visualization */}
          <div className="flex-1 flex items-center justify-center gap-[2px] h-8 px-2 min-w-0 overflow-hidden">
            {audioData.map((value, i) => {
              const height = paused ? 4 : Math.max(4, value * 28);
              return (
                <div
                  key={i}
                  className="w-[2px] bg-white/60 rounded-full transition-all duration-75"
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
        </div>

        {/* Pause/Resume button */}
        <button
          type="button"
          onClick={() => {
            if (paused) resumeRecording();
            else pauseRecording();
          }}
          className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          title={paused ? 'Resume recording' : 'Pause recording'}
        >
          {paused ? (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </svg>
          )}
        </button>

        {/* Send button */}
        <button
          type="button"
          onClick={stopRecording}
          className="w-12 h-12 flex items-center justify-center rounded-full transition-all"
          style={{ background: 'var(--primary)', color: 'var(--hl-black)', boxShadow: 'var(--sh-lift)' }}
          title="Send recording"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
