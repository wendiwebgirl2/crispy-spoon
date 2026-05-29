// components/studio.jsx — Script-to-video generation
import React from 'react'
import { AVATARS, GENERATED_VIDEOS, clientFor } from './data.jsx'
import { AvatarTile, Icon, StatusBadge } from './shared.jsx'

const SCENES = [
  { id: 'plain',     label: 'Plain', desc: 'No background.' },
  { id: 'office',    label: 'Office', desc: 'Neutral office.' },
  { id: 'studio',    label: 'Studio', desc: 'Branded set.' },
  { id: 'outdoor',   label: 'Outdoor', desc: 'Natural light.' },
];

const StudioView = () => {
  const [avatarId, setAvatarId] = React.useState('av_jonah');
  const [script, setScript] = React.useState("Hey team — quick cue for Tuesday. Discipline over motivation. Motivation is a mood. Discipline is a system you've already paid into. Today's rep is showing up for the system, even when the mood disagrees.");
  const [scene, setScene] = React.useState('studio');
  const [language, setLanguage] = React.useState('EN');
  const [aspectRatio, setAspectRatio] = React.useState('16:9');
  const [generating, setGenerating] = React.useState(false);
  const [queue, setQueue] = React.useState(GENERATED_VIDEOS);

  const avatar = AVATARS.find(a => a.id === avatarId);
  const readyAvatars = AVATARS.filter(a => a.status === 'ready');
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estSeconds = Math.max(5, Math.round(wordCount / 2.5));
  const estCost = (estSeconds * 0.04).toFixed(2);

  const generate = () => {
    if (!script.trim()) return;
    setGenerating(true);
    const newJob = {
      id: 'gv_' + Date.now(),
      avatarId,
      title: script.slice(0, 60) + (script.length > 60 ? '…' : ''),
      status: 'rendering',
      duration: `0:${String(estSeconds).padStart(2,'0')}`,
      createdAt: 'just now',
      progress: 0
    };
    setQueue(q => [newJob, ...q]);
    // simulate progress
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

  return (
    <div className="fade-in" style={{
      display: 'grid',
      gridTemplateColumns: '1fr 320px',
      height: '100%',
      minHeight: 0
    }}>
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
          {readyAvatars.map(av => (
            <button key={av.id} onClick={() => setAvatarId(av.id)}
              className="row"
              style={{
                padding: 8, borderRadius: 'var(--r-sm)',
                background: avatarId === av.id ? 'var(--surface-2)' : 'transparent',
                border: '1px solid', borderColor: avatarId === av.id ? 'var(--border-strong)' : 'transparent',
                cursor: 'pointer', color: 'inherit', textAlign: 'left'
              }}>
              <div style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0 }}>
                <AvatarTile avatar={av} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{av.contact}</div>
                <div className="mono">{clientFor(av).companyName}</div>
              </div>
            </button>
          ))}
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

        <button className="btn primary lg" onClick={generate} disabled={generating || !script.trim()}
          style={{ justifyContent: 'center', opacity: (generating || !script.trim()) ? 0.5 : 1 }}>
          {generating ? <>Queueing…</> : <><Icon name="sparkle" size={14} /> Generate video</>}
        </button>
      </div>
    </div>
  );
};

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