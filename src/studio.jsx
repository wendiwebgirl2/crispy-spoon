// components/studio.jsx — Studio: client → destination → type decision flow,
// then either an avatar-video render or full episode assembly (cover, intro
// music, intro/body/outro, music bed/segment, stitch) — mirrors the
// cast.cuecreative.com Episodes tab.

import React from 'react'
import {
  CLIENTS,
  AVATARS,
  GENERATED_VIDEOS,
  clientFor,
  avatarsForClient,
  briefFor
} from './data.jsx'
import { AvatarTile, Icon, StatusBadge } from './shared.jsx'

const SCENES = [
  { id: 'plain',     label: 'Plain', desc: 'No background.' },
  { id: 'office',    label: 'Office', desc: 'Neutral office.' },
  { id: 'studio',    label: 'Studio', desc: 'Branded set.' },
  { id: 'outdoor',   label: 'Outdoor', desc: 'Natural light.' },
];

const DEFAULT_SCRIPT = "Hey team — quick cue for Tuesday. Discipline over motivation. Motivation is a mood. Discipline is a system you've already paid into. Today's rep is showing up for the system, even when the mood disagrees.";

// destination = where the finished piece goes. types = valid content shapes per
// destination (each presets an aspect ratio). 'download' is always available so a
// client with no connected channels is never a dead end.
const DESTINATIONS = {
  podcast:   { label: 'Podcast',          icon: 'mic',      types: [{ id: 'episode', label: 'Podcast episode', ar: '1:1' }] },
  youtube:   { label: 'YouTube',          icon: 'play',     types: [{ id: 'long', label: 'Video', ar: '16:9' }, { id: 'short', label: 'Short', ar: '9:16' }] },
  instagram: { label: 'Instagram',        icon: 'cam',      types: [{ id: 'reel', label: 'Reel', ar: '9:16' }, { id: 'post', label: 'Feed video', ar: '1:1' }] },
  facebook:  { label: 'Facebook',         icon: 'cam',      types: [{ id: 'post', label: 'Video post', ar: '16:9' }] },
  website:   { label: 'Website / Blog',   icon: 'doc',      types: [{ id: 'embed', label: 'Embedded video', ar: '16:9' }] },
  download:  { label: 'Direct / download', icon: 'download', types: [{ id: 'file', label: 'Video file', ar: '16:9' }] },
};
const CHANNEL_ORDER = ['podcast', 'youtube', 'instagram', 'facebook', 'website'];

const STEPS = [
  { id: 'client',      n: 1, label: 'Client' },
  { id: 'destination', n: 2, label: 'Destination' },
  { id: 'type',        n: 3, label: 'Type' },
];

const StudioView = () => {
  // —— decision flow ——
  const [step, setStep] = React.useState('client');   // client | destination | type | render
  const [clientId, setClientId] = React.useState(null);
  const [destination, setDestination] = React.useState(null);
  const [contentType, setContentType] = React.useState(null);
  const [renderMode, setRenderMode] = React.useState('video');   // video | assembly

  // —— render step (video) ——
  const [avatarId, setAvatarId] = React.useState(null);
  const [script, setScript] = React.useState(DEFAULT_SCRIPT);
  const [scene, setScene] = React.useState('studio');
  const [language, setLanguage] = React.useState('EN');
  const [aspectRatio, setAspectRatio] = React.useState('16:9');
  const [generating, setGenerating] = React.useState(false);
  const [queue, setQueue] = React.useState(GENERATED_VIDEOS);

  const client = clientId ? CLIENTS.find(c => c.id === clientId) : null;
  const clientAvatars = clientId ? avatarsForClient(clientId) : [];
  const primaryAvatar = clientAvatars[0] || null;
  const brief = primaryAvatar ? briefFor(primaryAvatar) : null;

  const pickClient = (id) => {
    setClientId(id);
    setDestination(null);
    setContentType(null);
    setStep('destination');
  };
  const pickDestination = (k) => {
    setDestination(k);
    setContentType(null);
    setStep('type');
  };
  const chooseType = (t) => {
    setContentType(t.id);
    setAspectRatio(t.ar);
    // podcast episodes open straight into assembly; everything else into video
    setRenderMode(t.id === 'episode' || destination === 'podcast' ? 'assembly' : 'video');
    const readyHere = clientAvatars.filter(a => a.status === 'ready');
    const a = readyHere[0] || primaryAvatar;
    if (a) {
      setAvatarId(a.id);
      setLanguage((a.languages && a.languages[0]) || 'EN');
    }
    setStep('render');
  };
  const startOver = () => {
    setStep('client');
    setClientId(null);
    setDestination(null);
    setContentType(null);
  };

  /* ──────────────── STEP 1 · CLIENT ──────────────── */
  if (step === 'client') {
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)', overflow: 'auto', height: '100%' }}>
        <Stepper current="client" />
        <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, letterSpacing: '-0.01em', margin: '18px 0 4px' }}>
          Which <em style={{ color: 'var(--accent)' }}>client</em> are we casting for?
        </h1>
        <div className="mono" style={{ marginBottom: 24 }}>Pick the client, then where it's going and what shape it takes.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--gap)' }}>
          {CLIENTS.map(c => {
            const avs = avatarsForClient(c.id);
            const ready = avs.filter(a => a.status === 'ready').length;
            return (
              <button key={c.id} className="card card-pad" onClick={() => pickClient(c.id)}
                style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 18, fontFamily: '"DM Sans"', letterSpacing: '-0.01em' }}>{c.companyName}</div>
                <div className="mono">{c.contact} · {c.role}</div>
                <div className="mono" style={{ color: ready ? 'var(--ok)' : 'var(--text-4)', marginTop: 2 }}>
                  {ready ? `${ready} avatar${ready > 1 ? 's' : ''} ready` : 'no trained avatar yet'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ──────────────── STEP 2 · DESTINATION ──────────────── */
  if (step === 'destination') {
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)', overflow: 'auto', height: '100%' }}>
        <Stepper current="destination" />
        <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, letterSpacing: '-0.01em', margin: '18px 0 4px' }}>
          Where does this go for <em style={{ color: 'var(--accent)' }}>{client.companyName}</em>?
        </h1>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 24 }}>
          <span className="mono">Connected channels come from the client's brief.</span>
          <button className="btn sm" onClick={() => setStep('client')}><Icon name="more" size={12} /> Change client</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)' }}>
          {CHANNEL_ORDER.map(k => {
            const meta = DESTINATIONS[k];
            const s = brief && brief.socials ? brief.socials[k] : null;
            const connected = !!(s && s.handle);
            return (
              <button key={k} disabled={!connected} onClick={() => connected && pickDestination(k)}
                className="card card-pad"
                style={{
                  textAlign: 'left', color: 'inherit',
                  cursor: connected ? 'pointer' : 'not-allowed',
                  opacity: connected ? 1 : 0.5,
                  display: 'flex', flexDirection: 'column', gap: 8
                }}>
                <Icon name={meta.icon} size={18} style={{ color: connected ? 'var(--accent)' : 'var(--text-4)' }} />
                <div style={{ fontSize: 15, fontFamily: '"DM Sans"' }}>{meta.label}</div>
                <div className="mono" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {connected ? s.handle : 'not connected'}
                </div>
              </button>
            );
          })}
          <button onClick={() => pickDestination('download')} className="card card-pad"
            style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Icon name="download" size={18} style={{ color: 'var(--accent)' }} />
            <div style={{ fontSize: 15, fontFamily: '"DM Sans"' }}>{DESTINATIONS.download.label}</div>
            <div className="mono">no channel needed</div>
          </button>
        </div>
      </div>
    );
  }

  /* ──────────────── STEP 3 · TYPE ──────────────── */
  if (step === 'type') {
    const types = DESTINATIONS[destination].types;
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)', overflow: 'auto', height: '100%' }}>
        <Stepper current="type" />
        <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, letterSpacing: '-0.01em', margin: '18px 0 4px' }}>
          What <em style={{ color: 'var(--accent)' }}>type</em> for {DESTINATIONS[destination].label}?
        </h1>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 24 }}>
          <span className="mono">Sets the format and aspect ratio for the render.</span>
          <button className="btn sm" onClick={() => setStep('destination')}><Icon name="more" size={12} /> Change destination</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--gap)' }}>
          {types.map(t => (
            <button key={t.id} onClick={() => chooseType(t)} className="card card-pad"
              style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontFamily: '"DM Sans"' }}>{t.label}</div>
                <div className="mono" style={{ marginTop: 4 }}>{DESTINATIONS[destination].label}</div>
              </div>
              <span className="badge"><Icon name="cam" size={11} /> {t.ar}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ──────────────── RENDER STEP ──────────────── */
  const avatar = avatarId ? AVATARS.find(a => a.id === avatarId) : null;
  const typeLabel = (DESTINATIONS[destination].types.find(t => t.id === contentType) || {}).label || '';

  if (!avatar) {
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)' }}>
        <div className="mono" style={{ marginBottom: 16 }}>This client has no avatar to cast yet.</div>
        <button className="btn" onClick={startOver}><Icon name="more" size={12} /> Start over</button>
      </div>
    );
  }

  const readyAvatars = clientAvatars;   // client-scoped; non-ready shown disabled
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estSeconds = Math.max(5, Math.round(wordCount / 2.5));
  const estCost = (estSeconds * 0.04).toFixed(2);
  const canGenerate = !generating && !!script.trim() && avatar.status === 'ready';

  const generate = () => {
    if (!script.trim() || avatar.status !== 'ready') return;
    setGenerating(true);
    const newJob = {
      id: 'gv_' + Date.now(),
      avatarId,
      title: script.slice(0, 60) + (script.length > 60 ? '…' : ''),
      status: 'rendering',
      duration: `0:${String(estSeconds).padStart(2, '0')}`,
      createdAt: 'just now',
      progress: 0
    };
    setQueue(q => [newJob, ...q]);
    let p = 0;
    const t = setInterval(() => {
      p += 8;
      setQueue(q => q.map(v => v.id === newJob.id ? { ...v, progress: Math.min(p, 100) } : v));
      if (p >= 100) {
        clearInterval(t);
        setQueue(q => q.map(v => v.id === newJob.id ? { ...v, status: 'ready', progress: 100 } : v));
        setGenerating(false);
      }
    }, 280);
  };

  const ModeToggle = () => (
    <div className="row" style={{ gap: 4 }}>
      {[['video', 'Avatar video'], ['assembly', 'Episode assembly']].map(([m, label]) => (
        <button key={m} onClick={() => setRenderMode(m)} className="btn sm"
          style={{
            background: renderMode === m ? 'var(--surface-2)' : 'transparent',
            borderColor: renderMode === m ? 'var(--accent)' : 'var(--border)',
            color: renderMode === m ? 'var(--text)' : 'var(--text-2)'
          }}>{label}</button>
      ))}
    </div>
  );

  return (
    <div className="fade-in" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* top bar: breadcrumb + mode toggle */}
      <div className="row" style={{ justifyContent: 'space-between', padding: '10px var(--pad)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Crumb label={client.companyName} onClick={() => setStep('client')} />
          <span className="mono" style={{ color: 'var(--text-4)' }}>▸</span>
          <Crumb label={DESTINATIONS[destination].label} onClick={() => setStep('destination')} />
          <span className="mono" style={{ color: 'var(--text-4)' }}>▸</span>
          <Crumb label={typeLabel} onClick={() => setStep('type')} />
          <button className="btn sm" onClick={startOver}><Icon name="more" size={12} /> Start over</button>
        </div>
        <ModeToggle />
      </div>

      {renderMode === 'assembly'
        ? <EpisodeAssembly avatar={avatar} clientName={client.companyName} />
        : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', flex: 1, minHeight: 0 }}>
            {/* —— center: script editor + queue —— */}
            <div style={{ overflow: 'auto', padding: 'var(--pad)' }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <div className="label">STUDIO · NEW RENDER</div>
                  <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 38, letterSpacing: '-0.01em', margin: '6px 0 0' }}>
                    Cast a <em style={{ color: 'var(--accent)' }}>script</em> into video.
                  </h1>
                </div>
              </div>

              {/* live preview tile */}
              <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
                <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', justifyContent: 'space-between' }}>
                  <div className="row">
                    <div style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden' }}>
                      <AvatarTile avatar={avatar} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13 }}>{avatar.contact}</div>
                      <div className="mono">{clientFor(avatar).companyName}</div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="badge"><Icon name="cam" size={11} /> {aspectRatio}</span>
                    <span className="badge"><Icon name="lang" size={11} /> {language}</span>
                    <span className="badge"><Icon name="studio" size={11} /> {SCENES.find(s => s.id === scene).label}</span>
                  </div>
                </div>
                <div style={{
                  aspectRatio: aspectRatio === '16:9' ? '16/9' : (aspectRatio === '9:16' ? '9/16' : '1/1'),
                  maxHeight: 320,
                  margin: '0 auto',
                  position: 'relative',
                  background: '#0a0a0a',
                  display: 'grid', placeItems: 'center',
                  width: aspectRatio === '9:16' ? 240 : (aspectRatio === '1:1' ? 320 : '100%')
                }}>
                  <AvatarTile avatar={avatar} />
                  <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                    <div style={{
                      background: 'rgba(0,0,0,0.6)',
                      backdropFilter: 'blur(8px)',
                      padding: '10px 14px',
                      borderRadius: 'var(--r-sm)',
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: '#fff',
                      maxHeight: 80, overflow: 'hidden',
                      textWrap: 'pretty'
                    }}>
                      {script.slice(0, 140)}{script.length > 140 && '…'}
                    </div>
                  </div>
                </div>
              </div>

              {/* script editor */}
              <div style={{ marginBottom: 24 }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="label">SCRIPT</span>
                  <span className="mono">{wordCount} words · ~{estSeconds}s · ${estCost}</span>
                </div>
                <textarea
                  className="textarea"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={8}
                  placeholder="Paste or write the script you want the avatar to deliver…"
                  style={{ fontSize: 15, fontFamily: 'var(--f-display)', lineHeight: 1.5, letterSpacing: '0', minHeight: 180 }}
                />
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  <button className="btn sm"><Icon name="sparkle" size={12} /> Refine with Claude</button>
                  <button className="btn sm"><Icon name="doc" size={12} /> Paste from doc</button>
                  <button className="btn sm"><Icon name="mic" size={12} /> Dictate</button>
                </div>
              </div>

              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="label">RECENT RENDERS</div>
                <span className="mono">{queue.length} videos</span>
              </div>

              <div className="col" style={{ gap: 10 }}>
                {queue.map(v => <VideoRow key={v.id} video={v} />)}
              </div>
            </div>

            {/* —— right rail: settings —— */}
            <div style={{ borderLeft: '1px solid var(--border)', padding: 'var(--pad)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div className="label" style={{ marginBottom: 14 }}>AVATAR</div>
              <div className="col" style={{ gap: 4, marginBottom: 22 }}>
                {readyAvatars.map(av => {
                  const isReady = av.status === 'ready';
                  return (
                    <button key={av.id} onClick={() => isReady && setAvatarId(av.id)} disabled={!isReady}
                      className="row"
                      style={{
                        padding: 8, borderRadius: 'var(--r-sm)',
                        background: avatarId === av.id ? 'var(--surface-2)' : 'transparent',
                        border: '1px solid', borderColor: avatarId === av.id ? 'var(--border-strong)' : 'transparent',
                        cursor: isReady ? 'pointer' : 'not-allowed', opacity: isReady ? 1 : 0.5,
                        color: 'inherit', textAlign: 'left'
                      }}>
                      <div style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0 }}>
                        <AvatarTile avatar={av} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{av.contact}</div>
                        <div className="mono">{isReady ? clientFor(av).companyName : av.status}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="label" style={{ marginBottom: 10 }}>SCENE</div>
              <div className="col" style={{ gap: 4, marginBottom: 22 }}>
                {SCENES.map(s => (
                  <button key={s.id} onClick={() => setScene(s.id)}
                    className="row"
                    style={{
                      padding: '8px 10px', borderRadius: 'var(--r-sm)',
                      background: scene === s.id ? 'var(--surface-2)' : 'transparent',
                      border: '1px solid', borderColor: scene === s.id ? 'var(--border-strong)' : 'transparent',
                      cursor: 'pointer', color: 'inherit'
                    }}>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 13 }}>{s.label}</div>
                      <div className="mono">{s.desc}</div>
                    </div>
                    {scene === s.id && <Icon name="check" size={14} style={{ color: 'var(--accent)' }} />}
                  </button>
                ))}
              </div>

              <div className="label" style={{ marginBottom: 10 }}>ASPECT RATIO</div>
              <div className="row" style={{ gap: 4, marginBottom: 22 }}>
                {['16:9', '9:16', '1:1'].map(r => (
                  <button key={r} onClick={() => setAspectRatio(r)} className="btn sm"
                    style={{
                      flex: 1, justifyContent: 'center',
                      background: aspectRatio === r ? 'var(--surface-2)' : 'transparent',
                      borderColor: aspectRatio === r ? 'var(--accent)' : 'var(--border)',
                      color: aspectRatio === r ? 'var(--text)' : 'var(--text-2)'
                    }}>{r}</button>
                ))}
              </div>

              <div className="label" style={{ marginBottom: 10 }}>LANGUAGE</div>
              <div className="row" style={{ gap: 4, marginBottom: 22, flexWrap: 'wrap' }}>
                {avatar.languages.length ? avatar.languages.map(l => (
                  <button key={l} onClick={() => setLanguage(l)} className="btn sm"
                    style={{
                      background: language === l ? 'var(--surface-2)' : 'transparent',
                      borderColor: language === l ? 'var(--accent)' : 'var(--border)',
                      color: language === l ? 'var(--text)' : 'var(--text-2)'
                    }}>{l}</button>
                )) : <span className="mono">No language packs trained.</span>}
              </div>

              <div style={{ marginTop: 'auto' }} />

              <div style={{
                padding: 14,
                background: 'var(--surface-2)',
                borderRadius: 'var(--r-md)',
                marginBottom: 12,
                border: '1px solid var(--border)'
              }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="mono">Estimated cost</span>
                  <span style={{ fontFamily: 'var(--f-display)', fontSize: 24 }}>${estCost}</span>
                </div>
                <div className="mono">{estSeconds}s · {wordCount} words · charged on completion</div>
              </div>

              <button className="btn primary lg" onClick={generate} disabled={!canGenerate}
                style={{ justifyContent: 'center', opacity: canGenerate ? 1 : 0.5 }}>
                {generating
                  ? <>Queueing…</>
                  : (avatar.status === 'ready'
                      ? <><Icon name="sparkle" size={14} /> Generate {typeLabel || 'video'}</>
                      : <>Avatar still training</>)}
              </button>
            </div>
          </div>
        )}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
 * EPISODE ASSEMBLY — cover, intro music, intro/body/outro, music
 * (segment|bed), stitch. Mirrors the cast.cuecreative.com Episodes tab.
 * ──────────────────────────────────────────────────────────── */
const PART_SLOTS = [
  { id: 'intro_music', label: 'Intro music', hint: 'plays first', kind: 'music', required: false },
  { id: 'intro',       label: 'Intro (VO)',  hint: 'spoken intro', kind: 'voice', required: false },
  { id: 'body',        label: 'Body',        hint: 'main recording', kind: 'voice', required: true },
  { id: 'outro',       label: 'Outro',       hint: 'spoken outro', kind: 'voice', required: false },
];

const EpisodeAssembly = ({ avatar, clientName }) => {
  const [title, setTitle] = React.useState('');
  const [cover, setCover] = React.useState(null);        // { via, label }
  const [coverPrompt, setCoverPrompt] = React.useState('');
  const [overlay, setOverlay] = React.useState('');
  const [slots, setSlots] = React.useState({});          // { slotId: { via, label } }
  const [music, setMusic] = React.useState(null);        // { via, label }
  const [musicMode, setMusicMode] = React.useState('segment');  // segment | bed
  const [bedLevel, setBedLevel] = React.useState(0.10);
  const [musicPrompt, setMusicPrompt] = React.useState('');
  const [episodes, setEpisodes] = React.useState([]);
  const [stitching, setStitching] = React.useState(false);

  const setSlot = (id, val) => setSlots(s => ({ ...s, [id]: val }));
  const hasBody = !!slots.body;

  const stitch = () => {
    if (!hasBody || stitching) return;
    setStitching(true);
    const ep = {
      id: 'ep_' + Date.now(),
      title: title.trim() || 'Untitled episode',
      status: 'rendering',
      progress: 0,
      createdAt: 'just now',
      mode: musicMode,
    };
    setEpisodes(e => [ep, ...e]);
    let p = 0;
    const t = setInterval(() => {
      p += 10;
      setEpisodes(e => e.map(x => x.id === ep.id ? { ...x, progress: Math.min(p, 100) } : x));
      if (p >= 100) {
        clearInterval(t);
        setEpisodes(e => e.map(x => x.id === ep.id ? { ...x, status: 'ready', progress: 100 } : x));
        setStitching(false);
      }
    }, 240);
  };

  // human-readable stitch order, reflecting what's actually set
  const order = [
    slots.intro_music && 'intro music',
    slots.intro && 'intro',
    (music && musicMode === 'segment') && 'segment music',
    hasBody ? (music && musicMode === 'bed' ? 'body (+ music bed)' : 'body') : 'body',
    slots.outro && 'outro',
  ].filter(Boolean).join('  →  ');

  return (
    <div style={{ overflow: 'auto', padding: 'var(--pad)', flex: 1, minHeight: 0 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="label">STUDIO · EPISODE ASSEMBLY</div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 34, letterSpacing: '-0.01em', margin: '6px 0 0' }}>
            Stitch an <em style={{ color: 'var(--accent)' }}>episode</em>.
          </h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden' }}><AvatarTile avatar={avatar} /></div>
          <div>
            <div style={{ fontSize: 13 }}>{avatar.contact}</div>
            <div className="mono">{clientName}</div>
          </div>
        </div>
      </div>

      {/* title */}
      <div style={{ marginBottom: 18 }}>
        <div className="label" style={{ marginBottom: 8 }}>EPISODE TITLE</div>
        <input className="textarea" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Daily Cue — discipline over motivation"
          style={{ minHeight: 0, height: 44, fontSize: 15, fontFamily: 'var(--f-display)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
        {/* cover art */}
        <div className="card card-pad">
          <div className="label" style={{ marginBottom: 12 }}>COVER ART</div>
          <div style={{ aspectRatio: '1/1', maxWidth: 160, borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', marginBottom: 12, border: '1px solid var(--border)' }}>
            {cover
              ? <div style={{ textAlign: 'center', padding: 12 }}><Icon name="studio" size={22} style={{ color: 'var(--accent)' }} /><div className="mono" style={{ marginTop: 6 }}>{cover.label}</div></div>
              : <span className="mono">no cover yet</span>}
          </div>
          <input className="textarea" value={coverPrompt} onChange={(e) => setCoverPrompt(e.target.value)}
            placeholder="Describe the cover (AI generate)…"
            style={{ minHeight: 0, height: 40, fontSize: 13, marginBottom: 8 }} />
          <input className="textarea" value={overlay} onChange={(e) => setOverlay(e.target.value)}
            placeholder="Overlay title (optional)"
            style={{ minHeight: 0, height: 36, fontSize: 13, marginBottom: 10 }} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm" onClick={() => setCover({ via: 'ai', label: 'AI cover' })}><Icon name="sparkle" size={12} /> Generate</button>
            <button className="btn sm" onClick={() => setCover({ via: 'upload', label: 'uploaded.jpg' })}><Icon name="upload" size={12} /> Upload</button>
          </div>
        </div>

        {/* music */}
        <div className="card card-pad">
          <div className="label" style={{ marginBottom: 12 }}>MUSIC</div>
          <div className="row" style={{ gap: 4, marginBottom: 12 }}>
            {[['segment', 'Segment'], ['bed', 'Bed']].map(([m, label]) => (
              <button key={m} onClick={() => setMusicMode(m)} className="btn sm"
                style={{
                  flex: 1, justifyContent: 'center',
                  background: musicMode === m ? 'var(--surface-2)' : 'transparent',
                  borderColor: musicMode === m ? 'var(--accent)' : 'var(--border)',
                  color: musicMode === m ? 'var(--text)' : 'var(--text-2)'
                }}>{label}</button>
            ))}
          </div>
          <div className="mono" style={{ marginBottom: 10 }}>
            {musicMode === 'segment' ? 'Plays as its own part before the body.' : 'Mixed under the body at low volume.'}
          </div>
          {musicMode === 'bed' && (
            <div style={{ marginBottom: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="mono">Bed level</span><span className="mono">{bedLevel.toFixed(2)}</span>
              </div>
              <input type="range" min="0.02" max="0.4" step="0.02" value={bedLevel}
                onChange={(e) => setBedLevel(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
          )}
          <input className="textarea" value={musicPrompt} onChange={(e) => setMusicPrompt(e.target.value)}
            placeholder="Describe style/mood — no artist names…"
            style={{ minHeight: 0, height: 40, fontSize: 13, marginBottom: 10 }} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm" onClick={() => setMusic({ via: 'ai', label: 'generated track' })}><Icon name="sparkle" size={12} /> Generate</button>
            <button className="btn sm" onClick={() => setMusic({ via: 'upload', label: 'uploaded.mp3' })}><Icon name="upload" size={12} /> Upload</button>
          </div>
          {music && <div className="mono" style={{ marginTop: 8, color: 'var(--ok)' }}>● {music.label}</div>}
        </div>
      </div>

      {/* audio parts */}
      <div className="card card-pad" style={{ marginBottom: 'var(--gap)' }}>
        <div className="label" style={{ marginBottom: 12 }}>AUDIO PARTS</div>
        <div className="col" style={{ gap: 2 }}>
          {PART_SLOTS.map(slot => {
            const val = slots[slot.id];
            return (
              <div key={slot.id} className="row" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)', gap: 12 }}>
                <div style={{ width: 120 }}>
                  <div style={{ fontSize: 13 }}>{slot.label}{slot.required && <span style={{ color: 'var(--accent)' }}> *</span>}</div>
                  <div className="mono">{slot.hint}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="mono" style={{ color: val ? 'var(--ok)' : 'var(--text-4)' }}>
                    {val ? `● ${val.label}` : 'empty'}
                  </span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => setSlot(slot.id, { via: 'upload', label: 'uploaded file' })}>
                    <Icon name="upload" size={12} /> Upload
                  </button>
                  {slot.kind === 'voice' && (
                    <button className="btn sm" onClick={() => setSlot(slot.id, { via: 'synth', label: `synth · ${avatar.contact.split(' ')[0]}` })}>
                      <Icon name="mic" size={12} /> Use synth
                    </button>
                  )}
                  {slot.kind === 'music' && (
                    <button className="btn sm" onClick={() => setSlot(slot.id, { via: 'ai', label: 'generated music' })}>
                      <Icon name="sparkle" size={12} /> Generate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* stitch */}
      <div className="card card-pad" style={{ marginBottom: 'var(--gap)' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="label">STITCH</div>
          <span className="mono">{musicMode} music</span>
        </div>
        <div className="mono" style={{ marginBottom: 14 }}>{order || 'add a body recording to begin'}</div>
        <button className="btn primary lg" onClick={stitch} disabled={!hasBody || stitching}
          style={{ justifyContent: 'center', opacity: (!hasBody || stitching) ? 0.5 : 1 }}>
          {stitching ? <>Stitching…</> : <><Icon name="sparkle" size={14} /> Stitch into finished episode</>}
        </button>
        {!hasBody && <div className="mono" style={{ marginTop: 8, color: 'var(--text-4)' }}>Body is required (* ) before stitching.</div>}
      </div>

      {/* finished episodes */}
      {episodes.length > 0 && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="label">FINISHED EPISODES</div>
            <span className="mono">{episodes.length}</span>
          </div>
          <div className="col" style={{ gap: 10 }}>
            {episodes.map(ep => (
              <div key={ep.id} className="row" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
                  <Icon name={ep.status === 'ready' ? 'play' : 'studio'} size={16} style={{ color: ep.status === 'ready' ? 'var(--accent)' : 'var(--text-3)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ep.title}</div>
                  <div className="row" style={{ marginTop: 4 }}>
                    <span className="mono">{ep.mode} music</span><span className="mono">·</span><span className="mono">{ep.createdAt}</span>
                  </div>
                  {ep.status === 'rendering' && (
                    <div style={{ marginTop: 8, height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${ep.progress || 0}%`, height: '100%', background: 'var(--accent)', transition: 'width 200ms linear' }} />
                    </div>
                  )}
                </div>
                {ep.status === 'ready'
                  ? <button className="icon-btn" title="Download"><Icon name="download" size={14} /></button>
                  : <StatusBadge status="training" progress={ep.progress} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Stepper = ({ current }) => (
  <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
    {STEPS.map((s, i) => {
      const active = s.id === current;
      const done = STEPS.findIndex(x => x.id === current) > i;
      return (
        <React.Fragment key={s.id}>
          <div className="row" style={{ gap: 8, opacity: active || done ? 1 : 0.5 }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center',
              fontSize: 12, fontFamily: 'var(--f-mono)',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#fff' : 'var(--text-3)',
              border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)'
            }}>{s.n}</span>
            <span style={{ fontSize: 13, color: active ? 'var(--text)' : 'var(--text-3)' }}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && <span className="mono" style={{ color: 'var(--text-4)' }}>▸</span>}
        </React.Fragment>
      );
    })}
  </div>
);

const Crumb = ({ label, onClick }) => (
  <button onClick={onClick} className="btn sm"
    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
    {label}
  </button>
);

const VideoRow = ({ video }) => {
  const avatar = AVATARS.find(a => a.id === video.avatarId);
  return (
    <div className="row" style={{
      padding: 12,
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)',
      background: 'var(--surface)',
      gap: 14
    }}>
      <div style={{ width: 80, aspectRatio: '16/9', borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
        <AvatarTile avatar={avatar} />
        {video.status === 'ready' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
            <Icon name="play" size={18} style={{ color: '#fff' }} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {video.title}
        </div>
        <div className="row" style={{ marginTop: 4 }}>
          <span className="mono">{avatar.contact.split(' ')[0]}</span>
          <span className="mono">·</span>
          <span className="mono">{video.duration}</span>
          <span className="mono">·</span>
          <span className="mono">{video.createdAt}</span>
        </div>
        {video.status === 'rendering' && (
          <div style={{ marginTop: 8, height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${video.progress || 0}%`, height: '100%', background: 'var(--accent)', transition: 'width 200ms linear' }} />
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 6 }}>
        {video.status === 'ready' && (
          <>
            <button className="icon-btn" title="Download"><Icon name="download" size={14} /></button>
            <button className="icon-btn" title="More"><Icon name="more" size={14} /></button>
          </>
        )}
        {video.status === 'rendering' && <StatusBadge status="training" progress={video.progress} />}
        {video.status === 'queued' && <StatusBadge status="queued" />}
      </div>
    </div>
  );
};

export default StudioView;
