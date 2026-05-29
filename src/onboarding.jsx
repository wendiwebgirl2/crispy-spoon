// components/onboarding.jsx — multi-step onboarding flow for a new avatar

import React from 'react'
import { Icon, Placeholder } from './shared.jsx'

const STEPS = [
  { id: 'client', label: 'Client' },
  { id: 'record', label: 'Record' },
  { id: 'consent', label: 'Consent' },
  { id: 'training', label: 'Training' },
];

const OnboardingView = ({ onDone, onCancel }) => {
  const [step, setStep] = React.useState(0);
  const [recording, setRecording] = React.useState(false);
  const [recordTime, setRecordTime] = React.useState(0);
  const [consentChecked, setConsentChecked] = React.useState({ likeness: false, voice: false, legal: false });
  const [signature, setSignature] = React.useState('');
  const [client, setClient] = React.useState({ companyName: '', contactName: '', email: '' });
  const [trainingProgress, setTrainingProgress] = React.useState(0);
  const [trainingStage, setTrainingStage] = React.useState(0);

  // record timer
  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecordTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  // training simulation
  React.useEffect(() => {
    if (step !== 3) return;
    const t = setInterval(() => {
      setTrainingProgress(p => {
        if (p >= 100) { clearInterval(t); return 100; }
        return p + 2;
      });
    }, 280);
    return () => clearInterval(t);
  }, [step]);
  React.useEffect(() => {
    if (trainingProgress < 25) setTrainingStage(0);
    else if (trainingProgress < 60) setTrainingStage(1);
    else if (trainingProgress < 95) setTrainingStage(2);
    else setTrainingStage(3);
  }, [trainingProgress]);

  const canAdvance = () => {
    if (step === 0) return client.companyName && client.contactName && client.email;
    if (step === 1) return recordTime >= 5; // simulate min duration
    if (step === 2) return consentChecked.likeness && consentChecked.voice && consentChecked.legal && signature.length > 2;
    return true;
  };

  const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  return (
    <div className="fade-in" style={{ maxWidth: 920, margin: '0 auto', padding: 'var(--pad)' }}>
      {/* step header */}
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 24 }}>
        <button className="btn ghost" onClick={onCancel}>
          <Icon name="arrow-l" size={14} /> Back to avatars
        </button>
        <div className="mono">step {step + 1} of {STEPS.length}</div>
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
        {step === 0 && <ClientStep client={client} setClient={setClient} />}
        {step === 1 && <RecordStep recording={recording} setRecording={setRecording} recordTime={recordTime} fmtTime={fmtTime} />}
        {step === 2 && <ConsentStep client={client} consentChecked={consentChecked} setConsentChecked={setConsentChecked} signature={signature} setSignature={setSignature} />}
        {step === 3 && <TrainingStep client={client} progress={trainingProgress} stage={trainingStage} onDone={onDone} />}
      </div>

      {step < 3 && (
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 20 }}>
          <button className="btn ghost" onClick={() => step === 0 ? onCancel() : setStep(s => s - 1)}>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <button className="btn primary" disabled={!canAdvance()}
            onClick={() => setStep(s => s + 1)}
            style={{ opacity: canAdvance() ? 1 : 0.4 }}>
            {step === 2 ? 'Sign & submit' : 'Continue'}
            <Icon name="arrow-r" size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

const ClientStep = ({ client, setClient }) => (
  <div>
    <div className="label" style={{ marginBottom: 12 }}>STEP 1 · CLIENT</div>
    <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 38, letterSpacing: '-0.01em', margin: '0 0 8px', textWrap: 'pretty' }}>
      Who are we <em style={{ color: 'var(--accent)' }}>casting</em>?
    </h2>
    <p style={{ color: 'var(--text-3)', maxWidth: 460, marginBottom: 32 }}>
      Every avatar is bound to a single client. You can add multiple avatars per client later.
    </p>

    <div className="col" style={{ gap: 18, maxWidth: 520 }}>
      <Field label="Company / Account name" hint="e.g. Halberd Capital">
        <input className="input" value={client.companyName} onChange={(e) => setClient({ ...client, companyName: e.target.value })} placeholder="Halberd Capital" />
      </Field>
      <Field label="Contact name" hint="the person whose likeness will be trained">
        <input className="input" value={client.contactName} onChange={(e) => setClient({ ...client, contactName: e.target.value })} placeholder="Amelia Okonkwo" />
      </Field>
      <Field label="Email" hint="we'll send the consent confirmation here">
        <input className="input" type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} placeholder="amelia@halberd.cap" />
      </Field>
    </div>
  </div>
);

const Field = ({ label, hint, children }) => (
  <label style={{ display: 'block' }}>
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
      <span className="label">{label}</span>
      {hint && <span className="mono">{hint}</span>}
    </div>
    {children}
  </label>
);

const RecordStep = ({ recording, setRecording, recordTime, fmtTime }) => {
  const REQUIRED = 120; // 2 minutes
  const pct = Math.min(100, (recordTime / REQUIRED) * 100);
  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>STEP 2 · RECORD</div>
      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 38, letterSpacing: '-0.01em', margin: '0 0 8px' }}>
        Record a 2-minute take.
      </h2>
      <p style={{ color: 'var(--text-3)', maxWidth: 480, marginBottom: 24 }}>
        Plain background. Look at the lens. Speak naturally — read the prompt or improvise. HeyGen needs the eye contact and consistent lighting to train a clean twin.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 24 }}>
        {/* preview */}
        <div style={{
          aspectRatio: '16/10',
          background: '#000',
          borderRadius: 'var(--r-md)',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid var(--border)'
        }}>
          <Placeholder label="LIVE PREVIEW · WEBCAM 1080p">
            {/* fake faceless silhouette */}
            <svg viewBox="0 0 200 200" style={{ width: '50%', height: '90%', position: 'absolute', left: '25%', bottom: '-15%', opacity: 0.5 }}>
              <circle cx="100" cy="80" r="36" fill="#2a2a2a" />
              <path d="M40 200 Q40 130 100 130 Q160 130 160 200 Z" fill="#2a2a2a" />
            </svg>
          </Placeholder>
          {recording && (
            <>
              <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--err)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--err)', animation: 'blink 0.8s steps(2) infinite' }} />
                REC · {fmtTime(recordTime)}
              </div>
              {/* fake waveform */}
              <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, height: 24, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                {Array.from({ length: 60 }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1, background: 'var(--gold)',
                    height: `${30 + Math.abs(Math.sin(i * 0.6 + recordTime * 0.4)) * 70}%`,
                    opacity: 0.85, borderRadius: 1
                  }} />
                ))}
              </div>
            </>
          )}
          <div style={{ position: 'absolute', top: 14, right: 14 }}>
            <span className="badge"><Icon name="cam" size={11} /> Webcam</span>
          </div>
        </div>

        {/* sidebar — prompt + record control */}
        <div className="col" style={{ gap: 16 }}>
          <div style={{ padding: 18, background: 'var(--surface-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
            <div className="label" style={{ marginBottom: 10 }}>SUGGESTED PROMPT</div>
            <p style={{ fontFamily: 'var(--f-display)', fontSize: 18, lineHeight: 1.4, color: 'var(--text)', margin: 0, fontStyle: 'italic' }}>
              "Hi, I'm <span style={{ color: 'var(--accent)', fontStyle: 'normal', fontFamily: 'var(--f-sans)' }}>[name]</span>. I'm walking you through what we do, in my own voice. Pay attention because the rest of the recording trains how I move, breathe, and pause…"
            </p>
          </div>

          <div className="col" style={{ gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="label">DURATION</span>
              <span className="mono" style={{ color: pct >= 100 ? 'var(--ok)' : 'var(--text-2)' }}>
                {fmtTime(recordTime)} / 02:00
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: pct >= 100 ? 'var(--ok)' : 'var(--accent)',
                transition: 'width 200ms linear'
              }} />
            </div>
          </div>

          <button
            className={recording ? 'btn lg' : 'btn primary lg'}
            onClick={() => setRecording(!recording)}
            style={{ justifyContent: 'center', width: '100%' }}>
            {recording ? <><Icon name="pause" size={14} /> Stop recording</> : <><Icon name="mic" size={14} /> Start recording</>}
          </button>

          <button className="btn" style={{ justifyContent: 'center' }}>
            <Icon name="upload" size={14} />
            Upload existing footage
          </button>

          <div className="mono" style={{ textAlign: 'center', color: 'var(--text-4)', marginTop: 4 }}>
            mp4 · mov · 1080p min · ≤ 5 min
          </div>
        </div>
      </div>
    </div>
  );
};

const ConsentStep = ({ client, consentChecked, setConsentChecked, signature, setSignature }) => (
  <div>
    <div className="label" style={{ marginBottom: 12 }}>STEP 3 · CONSENT</div>
    <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 38, letterSpacing: '-0.01em', margin: '0 0 8px' }}>
      Likeness <em style={{ color: 'var(--accent)' }}>release</em>.
    </h2>
    <p style={{ color: 'var(--text-3)', maxWidth: 540, marginBottom: 24 }}>
      HeyGen requires explicit consent before a digital twin can be trained on a real person's likeness or voice. This packet is sent to <span style={{ color: 'var(--text-2)' }}>{client.email || 'the client'}</span> for their signature too.
    </p>

    <div className="col" style={{ gap: 12, marginBottom: 28 }}>
      <ConsentItem
        checked={consentChecked.likeness}
        onChange={(v) => setConsentChecked({ ...consentChecked, likeness: v })}
        title="Likeness rights"
        desc="I confirm that the recorded individual has authorized cue:creative and HeyGen to train an AI model on their face and physical likeness for use within this workspace only."
      />
      <ConsentItem
        checked={consentChecked.voice}
        onChange={(v) => setConsentChecked({ ...consentChecked, voice: v })}
        title="Voice rights"
        desc="I confirm authorization to clone and synthesize the recorded individual's voice for generated speech, including across translated languages."
      />
      <ConsentItem
        checked={consentChecked.legal}
        onChange={(v) => setConsentChecked({ ...consentChecked, legal: v })}
        title="Legal & data handling"
        desc="I understand that revoking consent deletes the trained model and all derived assets within 30 days, and I accept the HeyGen Avatar Terms (v2.4)."
      />
    </div>

    <Field label="Sign your name" hint="legally binding">
      <input className="input" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={client.contactName || "Your full legal name"}
        style={{ fontFamily: 'var(--f-display)', fontStyle: 'italic', fontSize: 20, letterSpacing: '-0.01em' }} />
    </Field>
  </div>
);

const ConsentItem = ({ checked, onChange, title, desc }) => (
  <label style={{
    display: 'flex', gap: 14, padding: 16,
    border: '1px solid', borderColor: checked ? 'color-mix(in oklch, var(--accent) 35%, transparent)' : 'var(--border)',
    background: checked ? 'color-mix(in oklch, var(--accent) 4%, transparent)' : 'var(--surface-2)',
    borderRadius: 'var(--r-md)', cursor: 'pointer',
    transition: 'all 150ms ease'
  }}>
    <div style={{
      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
      border: '1px solid', borderColor: checked ? 'var(--accent)' : 'var(--border-strong)',
      background: checked ? 'var(--accent)' : 'transparent',
      display: 'grid', placeItems: 'center',
      color: 'var(--accent-ink)',
      marginTop: 2
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

const TrainingStep = ({ client, progress, stage, onDone }) => {
  const stages = [
    { title: 'Uploading footage',     desc: 'Securely transferring to HeyGen training pipeline.' },
    { title: 'Extracting frames',     desc: 'Analyzing facial geometry, expression range, and lighting.' },
    { title: 'Voice modeling',        desc: 'Training the voice clone across phoneme coverage.' },
    { title: 'Twin ready',            desc: 'Your digital twin is live and ready to cast.' },
  ];
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div className="label" style={{ marginBottom: 16 }}>STEP 4 · TRAINING</div>

      {/* ring */}
      <div style={{ position: 'relative', width: 180, height: 180, margin: '0 auto 28px' }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--border)" strokeWidth="2" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--accent)" strokeWidth="2"
            strokeDasharray={`${(progress/100) * 276.5} 276.5`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 300ms linear' }}/>
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid', placeItems: 'center',
          flexDirection: 'column'
        }}>
          <div>
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 48, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {progress}<span style={{ color: 'var(--text-3)', fontSize: 24 }}>%</span>
            </div>
            <div className="mono" style={{ textAlign: 'center', marginTop: 4 }}>
              {progress < 100 ? 'training' : 'complete'}
            </div>
          </div>
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 32, letterSpacing: '-0.01em', margin: '0 0 8px' }}>
        {progress < 100
          ? <>Training <em style={{ color: 'var(--accent)' }}>{client.contactName || 'your avatar'}</em>…</>
          : <>Twin <em style={{ color: 'var(--accent)' }}>cast</em>.</>}
      </h2>
      <p style={{ color: 'var(--text-3)', maxWidth: 460, margin: '0 auto 28px' }}>
        {progress < 100 ? "We'll email you the moment training completes. You can leave this page." : "You can now generate videos and start conversations with this avatar."}
      </p>

      {/* stage list */}
      <div style={{ maxWidth: 460, margin: '0 auto 28px', textAlign: 'left' }}>
        {stages.map((s, i) => (
          <div key={i} className="row" style={{ padding: '10px 0', borderBottom: i < stages.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{
              width: 22, height: 22, borderRadius: 999, flexShrink: 0,
              background: i < stage ? 'var(--accent)' : (i === stage ? 'transparent' : 'transparent'),
              border: '1px solid', borderColor: i <= stage ? 'var(--accent)' : 'var(--border-strong)',
              display: 'grid', placeItems: 'center',
              color: 'var(--accent-ink)'
            }}>
              {i < stage && <Icon name="check" size={12} stroke={2.8} />}
              {i === stage && progress < 100 && (
                <span style={{
                  width: 8, height: 8, borderRadius: 999,
                  background: 'var(--accent)',
                  animation: 'blink 1.2s steps(2) infinite'
                }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: i <= stage ? 'var(--text)' : 'var(--text-3)', fontSize: 13.5 }}>{s.title}</div>
              <div className="mono">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {progress >= 100 && (
        <button className="btn primary lg" onClick={onDone}>
          Open avatar <Icon name="arrow-r" size={14} />
        </button>
      )}
    </div>
  );
};


export { OnboardingView };
