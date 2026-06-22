// components/onboarding.jsx — record-on-site flow (WIRED to live API)
//
// Reordered to match the backend's legal contract: CONSENT must be signed
// before a recording can be uploaded (the /api/recordings route returns 403
// without a consent on file). Flow is now:
//   1. Consent  — load release text, sign, POST /api/consent
//   2. Record   — real getUserMedia + MediaRecorder, hold the blob
//   3. Submit   — POST /api/recordings (multipart), honest "submitted" state
//
// The old Client step is removed: in the token model the client already exists
// behind the invitation token. Creating clients is operator/auth work (later
// slice). The Training step is replaced with an honest "submitted" screen —
// the token flow stores the recording in R2 but does not yet trigger HeyGen
// twin-training, so we don't pretend it does.

import React from 'react'
import { Icon } from './shared.jsx'
import { getConsent, postConsent, uploadRecording, currentToken } from './api.js'

const STEPS = [
  { id: 'consent', label: 'Consent' },
  { id: 'record',  label: 'Record' },
  { id: 'done',    label: 'Submit' },
];

const OnboardingView = ({ onDone, onCancel }) => {
  const [step, setStep] = React.useState(0);

  // —— consent state ——
  const [consentText, setConsentText] = React.useState('');
  const [consentLoading, setConsentLoading] = React.useState(true);
  const [consentErr, setConsentErr] = React.useState(null);
  const [alreadySigned, setAlreadySigned] = React.useState(false);
  const [checks, setChecks] = React.useState({ likeness: false, voice: false, legal: false });
  const [signature, setSignature] = React.useState('');
  const [signing, setSigning] = React.useState(false);

  // —— record state ——
  const [stream, setStream] = React.useState(null);
  const [recording, setRecording] = React.useState(false);
  const [recordTime, setRecordTime] = React.useState(0);
  const [recordedBlob, setRecordedBlob] = React.useState(null);
  const [recordErr, setRecordErr] = React.useState(null);
  const previewRef = React.useRef(null);
  const recorderRef = React.useRef(null);
  const chunksRef = React.useRef([]);

  // —— submit state ——
  const [uploading, setUploading] = React.useState(false);
  const [uploadErr, setUploadErr] = React.useState(null);
  const [submitted, setSubmitted] = React.useState(null); // holds recording meta

  const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  // Load consent text on mount.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getConsent();
        if (!alive) return;
        setConsentText(data.text || '');
        if (data.already_signed) setAlreadySigned(true);
      } catch (err) {
        if (alive) setConsentErr(err.message);
      } finally {
        if (alive) setConsentLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Record timer.
  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecordTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  // Attach the live stream to the <video> whenever it changes.
  React.useEffect(() => {
    if (previewRef.current && stream && !recordedBlob) {
      previewRef.current.srcObject = stream;
      previewRef.current.muted = true;
      previewRef.current.play?.().catch(() => {});
    }
  }, [stream, recordedBlob, step]);

  // Stop the camera when leaving the flow.
  React.useEffect(() => {
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [stream]);

  const signConsent = async () => {
    setSigning(true);
    setConsentErr(null);
    try {
      await postConsent(signature.trim());
      setStep(1); // advance to Record
    } catch (err) {
      setConsentErr(err.message);
    } finally {
      setSigning(false);
    }
  };

  const enableCamera = async () => {
    setRecordErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(s);
    } catch (err) {
      setRecordErr('Could not access camera/mic: ' + err.message);
    }
  };

  const toggleRecord = () => {
    if (!stream) return;
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    // start
    chunksRef.current = [];
    setRecordedBlob(null);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setRecording(false);
      // swap preview to playback of the recorded take
      if (previewRef.current) {
        previewRef.current.srcObject = null;
        previewRef.current.src = URL.createObjectURL(blob);
        previewRef.current.muted = false;
        previewRef.current.controls = true;
      }
    };
    recorderRef.current = rec;
    rec.start();
    setRecordTime(0);
    setRecording(true);
    // ensure preview shows live feed while recording
    if (previewRef.current) {
      previewRef.current.srcObject = stream;
      previewRef.current.src = '';
      previewRef.current.muted = true;
      previewRef.current.controls = false;
    }
  };

  const reRecord = () => {
    setRecordedBlob(null);
    setRecordTime(0);
    if (previewRef.current && stream) {
      previewRef.current.src = '';
      previewRef.current.srcObject = stream;
      previewRef.current.muted = true;
      previewRef.current.controls = false;
      previewRef.current.play?.().catch(() => {});
    }
  };

  const submit = async () => {
    if (!recordedBlob) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const data = await uploadRecording(recordedBlob);
      setSubmitted(data.recording || {});
      stream?.getTracks().forEach(t => t.stop());
      setStep(2); // done
    } catch (err) {
      setUploadErr(err.message);
    } finally {
      setUploading(false);
    }
  };

  const consentReady = checks.likeness && checks.voice && checks.legal && signature.trim().length > 2;

  return (
    <div className="fade-in" style={{ maxWidth: 920, margin: '0 auto', padding: 'var(--pad)' }}>
      {/* header */}
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 24 }}>
        <button className="btn ghost" onClick={onCancel}>
          <Icon name="arrow-l" size={14} /> Back to avatars
        </button>
        <div className="mono">step {Math.min(step + 1, STEPS.length)} of {STEPS.length}</div>
      </div>

      {/* stepper */}
      <div className="row" style={{ gap: 0, marginBottom: 36 }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="row" style={{ gap: 10, flex: 'none', opacity: i > step ? 0.4 : 1 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 999,
                background: i < step ? 'var(--accent)' : (i === step ? 'var(--surface-3)' : 'transparent'),
                border: i === step ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
                display: 'grid', placeItems: 'center',
                color: i < step ? 'var(--accent-ink)' : 'var(--text-2)',
                fontFamily: 'var(--f-mono)', fontSize: 11,
                transition: 'all 200ms ease'
              }}>
                {i < step ? <Icon name="check" size={12} stroke={2.2} /> : i + 1}
              </div>
              <span style={{ fontSize: 13, color: i === step ? 'var(--text)' : 'var(--text-3)' }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: 'var(--border)', margin: '0 16px' }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="card" style={{ padding: 36, minHeight: 460 }}>
        {step === 0 && (
          <ConsentStep
            text={consentText}
            loading={consentLoading}
            error={consentErr}
            alreadySigned={alreadySigned}
            checks={checks} setChecks={setChecks}
            signature={signature} setSignature={setSignature}
            onSkip={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <RecordStep
            previewRef={previewRef}
            stream={stream}
            recording={recording}
            recordTime={recordTime}
            recordedBlob={recordedBlob}
            recordErr={recordErr}
            fmtTime={fmtTime}
            onEnable={enableCamera}
            onToggle={toggleRecord}
            onReRecord={reRecord}
          />
        )}
        {step === 2 && (
          <SubmittedStep recording={submitted} onDone={onDone} />
        )}
      </div>

      {/* footer nav */}
      {step === 0 && !alreadySigned && (
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 20 }}>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn primary" disabled={!consentReady || signing}
            onClick={signConsent} style={{ opacity: (!consentReady || signing) ? 0.4 : 1 }}>
            {signing ? 'Signing…' : 'Sign & continue'}<Icon name="arrow-r" size={14} />
          </button>
        </div>
      )}
      {step === 0 && alreadySigned && (
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn primary" onClick={() => setStep(1)}>
            Continue to recording <Icon name="arrow-r" size={14} />
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 20 }}>
          <button className="btn ghost" onClick={() => setStep(0)}>Back</button>
          <div className="col" style={{ alignItems: 'flex-end', gap: 6 }}>
            {uploadErr && <span className="mono" style={{ color: 'var(--accent)' }}>{uploadErr}</span>}
            <button className="btn primary" disabled={!recordedBlob || uploading}
              onClick={submit} style={{ opacity: (!recordedBlob || uploading) ? 0.4 : 1 }}>
              {uploading ? 'Uploading…' : 'Submit recording'}<Icon name="arrow-r" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ——————————————————————————————————————————————————————————————
// Step 1 — Consent
// ——————————————————————————————————————————————————————————————
const ConsentStep = ({ text, loading, error, alreadySigned, checks, setChecks, signature, setSignature, onSkip }) => (
  <div>
    <div className="label" style={{ marginBottom: 12 }}>STEP 1 · CONSENT</div>
    <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 38, letterSpacing: '-0.01em', margin: '0 0 8px' }}>
      Likeness <em style={{ color: 'var(--accent)' }}>release</em>.
    </h2>
    <p style={{ color: 'var(--text-3)', maxWidth: 540, marginBottom: 20 }}>
      Consent must be signed before any footage is recorded. This release is recorded and time-stamped.
    </p>

    {alreadySigned ? (
      <div style={{ padding: 16, background: 'color-mix(in oklch, var(--ok, #3d7a4f) 8%, transparent)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
        <div className="row" style={{ gap: 10 }}>
          <Icon name="check" size={16} style={{ color: 'var(--ok, #3d7a4f)' }} />
          <span>Consent is already on file for this invitation. You can go straight to recording.</span>
        </div>
      </div>
    ) : (
      <>
        {/* release text from backend */}
        <div style={{
          maxHeight: 180, overflowY: 'auto', padding: 16,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', fontSize: 13, lineHeight: 1.6,
          whiteSpace: 'pre-wrap', color: 'var(--text-2)', marginBottom: 20
        }}>
          {loading ? 'Loading release…' : (error ? ('Could not load release: ' + error) : text)}
        </div>

        <div className="col" style={{ gap: 12, marginBottom: 24 }}>
          <ConsentItem checked={checks.likeness} onChange={(v) => setChecks({ ...checks, likeness: v })}
            title="Likeness rights"
            desc="I authorize cue:creative and HeyGen to train an AI model on the recorded individual's face and physical likeness for use within this workspace only." />
          <ConsentItem checked={checks.voice} onChange={(v) => setChecks({ ...checks, voice: v })}
            title="Voice rights"
            desc="I authorize cloning and synthesizing the recorded individual's voice for generated speech, including across translated languages." />
          <ConsentItem checked={checks.legal} onChange={(v) => setChecks({ ...checks, legal: v })}
            title="Legal & data handling"
            desc="I understand revoking consent deletes the trained model and derived assets, and I accept the applicable Avatar Terms." />
        </div>

        <label style={{ display: 'block' }}>
          <div className="label" style={{ marginBottom: 6 }}>Sign your full legal name</div>
          <input className="input" value={signature} onChange={(e) => setSignature(e.target.value)}
            placeholder="Your full legal name"
            style={{ fontFamily: 'var(--f-display)', fontStyle: 'italic', fontSize: 20, letterSpacing: '-0.01em' }} />
        </label>
      </>
    )}
  </div>
);

const ConsentItem = ({ checked, onChange, title, desc }) => (
  <label style={{
    display: 'flex', gap: 14, padding: 16,
    border: '1px solid', borderColor: checked ? 'color-mix(in oklch, var(--accent) 35%, transparent)' : 'var(--border)',
    background: checked ? 'color-mix(in oklch, var(--accent) 4%, transparent)' : 'var(--surface-2)',
    borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'all 150ms ease'
  }}>
    <div style={{
      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
      border: '1px solid', borderColor: checked ? 'var(--accent)' : 'var(--border-strong)',
      background: checked ? 'var(--accent)' : 'transparent',
      display: 'grid', placeItems: 'center', color: 'var(--accent-ink)', marginTop: 2
    }}>
      {checked && <Icon name="check" size={12} stroke={3} />}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ display: 'none' }} />
    </div>
    <div>
      <div style={{ fontWeight: 500, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5 }}>{desc}</div>
    </div>
  </label>
);

// ——————————————————————————————————————————————————————————————
// Step 2 — Record (real camera)
// ——————————————————————————————————————————————————————————————
const RecordStep = ({ previewRef, stream, recording, recordTime, recordedBlob, recordErr, fmtTime, onEnable, onToggle, onReRecord }) => (
  <div>
    <div className="label" style={{ marginBottom: 12 }}>STEP 2 · RECORD</div>
    <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 38, letterSpacing: '-0.01em', margin: '0 0 8px' }}>
      Record your take.
    </h2>
    <p style={{ color: 'var(--text-3)', maxWidth: 480, marginBottom: 24 }}>
      Plain background, look at the lens, speak naturally. Review your take, then submit — or re-record.
    </p>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 24 }}>
      {/* preview */}
      <div style={{
        aspectRatio: '16/10', background: '#000', borderRadius: 'var(--r-md)',
        position: 'relative', overflow: 'hidden', border: '1px solid var(--border)'
      }}>
        <video ref={previewRef} autoPlay playsInline muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {!stream && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-3)', fontFamily: 'var(--f-mono)', fontSize: 12 }}>
            Camera off
          </div>
        )}
        {recording && (
          <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--err, #c8553d)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--err, #c8553d)', animation: 'blink 0.8s steps(2) infinite' }} />
            REC · {fmtTime(recordTime)}
          </div>
        )}
        <div style={{ position: 'absolute', top: 14, right: 14 }}>
          <span className="badge"><Icon name="cam" size={11} /> Webcam</span>
        </div>
      </div>

      {/* control rail */}
      <div className="col" style={{ gap: 16 }}>
        <div style={{ padding: 18, background: 'var(--surface-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
          <div className="label" style={{ marginBottom: 10 }}>SUGGESTED PROMPT</div>
          <p style={{ fontFamily: 'var(--f-display)', fontSize: 17, lineHeight: 1.4, color: 'var(--text)', margin: 0, fontStyle: 'italic' }}>
            "Hi, I'm <span style={{ color: 'var(--accent)', fontStyle: 'normal' }}>[name]</span>. I'm walking you through what we do, in my own voice…"
          </p>
        </div>

        {recordErr && <div className="mono" style={{ color: 'var(--accent)' }}>{recordErr}</div>}

        {!stream ? (
          <button className="btn primary lg" onClick={onEnable} style={{ justifyContent: 'center', width: '100%' }}>
            <Icon name="cam" size={14} /> Enable camera
          </button>
        ) : !recordedBlob ? (
          <button className={recording ? 'btn lg' : 'btn primary lg'} onClick={onToggle}
            style={{ justifyContent: 'center', width: '100%' }}>
            {recording ? <><Icon name="pause" size={14} /> Stop recording</> : <><Icon name="mic" size={14} /> Start recording</>}
          </button>
        ) : (
          <button className="btn lg" onClick={onReRecord} style={{ justifyContent: 'center', width: '100%' }}>
            <Icon name="history" size={14} /> Re-record
          </button>
        )}

        {recordedBlob && (
          <div className="mono" style={{ textAlign: 'center', color: 'var(--ok, #3d7a4f)' }}>
            Take ready ({(recordedBlob.size / 1024 / 1024).toFixed(1)} MB) — review above, then Submit.
          </div>
        )}
        <div className="mono" style={{ textAlign: 'center', color: 'var(--text-4)' }}>
          Recording happens in your browser. Nothing uploads until you press Submit.
        </div>
      </div>
    </div>
  </div>
);

// ——————————————————————————————————————————————————————————————
// Step 3 — Submitted (honest end state; no fake training)
// ——————————————————————————————————————————————————————————————
const SubmittedStep = ({ recording, onDone }) => (
  <div style={{ textAlign: 'center', padding: '40px 0' }}>
    <div style={{
      width: 72, height: 72, borderRadius: 999, margin: '0 auto 24px',
      background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
      border: '1px solid var(--accent)', display: 'grid', placeItems: 'center'
    }}>
      <Icon name="check" size={30} stroke={2.4} style={{ color: 'var(--accent)' }} />
    </div>
    <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 34, letterSpacing: '-0.01em', margin: '0 0 8px' }}>
      Recording <em style={{ color: 'var(--accent)' }}>submitted</em>.
    </h2>
    <p style={{ color: 'var(--text-3)', maxWidth: 460, margin: '0 auto 12px' }}>
      Your footage is securely stored. We'll follow up once the avatar is ready to cast — you can close this page.
    </p>
    {recording?.bytes != null && (
      <div className="mono" style={{ color: 'var(--text-4)', marginBottom: 28 }}>
        {(recording.bytes / 1024 / 1024).toFixed(2)} MB uploaded
      </div>
    )}
    <button className="btn primary lg" onClick={onDone}>
      Back to avatars <Icon name="arrow-r" size={14} />
    </button>
  </div>
);

export { OnboardingView };
