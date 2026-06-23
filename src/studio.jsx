// components/studio.jsx — Script-to-video generation (WIRED to live API)
//
// UI is unchanged from the prototype. What changed:
//   - generate() now calls the real backend (POST /api/videos/generate) and
//     polls (GET /api/videos/:token) every 5s until nothing is rendering.
//   - the render queue is fed by live data, normalized to the shape VideoRow
//     expects so the existing markup keeps working.
//   - VideoRow plays the real video URL when ready (the prototype never could).
//
// NOTE (Option 3 / pre-auth slice): the right-rail avatar picker is currently
// cosmetic. The backend route is token-scoped and renders with the server's
// configured stock avatar regardless of which avatar is selected here. The
// picker becomes functional in the later auth slice when routes go
// client/avatar-scoped. Left in place because it's the correct final UI.

import React from 'react'
import { AVATARS, clientFor } from './data.jsx'
import { AvatarTile, Icon, StatusBadge } from './shared.jsx'
import { listVideos, generateVideo, currentToken } from './api.js'

const SCENES = [
  { id: 'plain',     label: 'Plain', desc: 'No background.' },
  { id: 'office',    label: 'Office', desc: 'Neutral office.' },
  { id: 'studio',    label: 'Studio', desc: 'Branded set.' },
  { id: 'outdoor',   label: 'Outdoor', desc: 'Natural light.' },
];

// ---- live → display normalization ------------------------------------------
// The API returns: { id, heygen_video_id, title, status, progress, url,
//                    failure_reason, created_at }
// VideoRow was written for the mock shape: { id, avatarId, title, status,
//                    duration, createdAt, progress }
// Map one to the other so the existing markup renders without crashing.
function friendlyTime(ts) {
  if (!ts) return '';
  const then = new Date(ts.replace(' ', 'T') + (ts.includes('Z') ? '' : 'Z'));
  if (isNaN(then)) return '';
  const secs = Math.floor((Date.now() - then.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function normalizeVideo(v) {
  return {
    id: v.id,
    avatarId: v.avatar_id || null,   // live API doesn't expose this per-row; ok
    title: v.title || 'Untitled',
    status: v.status,                // ready | rendering | failed
    url: v.url || null,              // real, playable URL when ready
    duration: v.duration || null,    // live API rarely sends this; VideoRow guards
    createdAt: friendlyTime(v.created_at),
    progress: v.progress != null ? v.progress : (v.status === 'rendering' ? null : 100),
    failureReason: v.failure_reason || null,
  };
}

const StudioView = () => {
  const [avatarId, setAvatarId] = React.useState('av_jonah');
  const [script, setScript] = React.useState("Hey team — quick cue for Tuesday. Discipline over motivation. Motivation is a mood. Discipline is a system you've already paid into. Today's rep is showing up for the system, even when the mood disagrees.");
  const [scene, setScene] = React.useState('studio');
  const [language, setLanguage] = React.useState('EN');
  const [aspectRatio, setAspectRatio] = React.useState('16:9');
  const [generating, setGenerating] = React.useState(false);
  const [queue, setQueue] = React.useState([]);
  const [loadError, setLoadError] = React.useState(null);

  const pollRef = React.useRef(null);

  const avatar = AVATARS.find(a => a.id === avatarId);
  const readyAvatars = AVATARS.filter(a => a.status === 'ready');
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estSeconds = Math.max(5, Math.round(wordCount / 2.5));
  const estCost = (estSeconds * 0.04).toFixed(2);

  // Load the real queue on mount, and poll while anything is rendering.
  const refresh = React.useCallback(async () => {
    try {
      const data = await listVideos();
      const vids = (data.videos || []).map(normalizeVideo);
      setQueue(vids);
      setLoadError(null);
      const stillWorking = vids.some(v => v.status === 'rendering' || (v.status === 'ready' && !v.url));
      if (stillWorking) {
        clearTimeout(pollRef.current);
        pollRef.current = setTimeout(refresh, 5000);
      } else {
        setGenerating(false);
      }
    } catch (err) {
      setLoadError(err.message);
      setGenerating(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    return () => clearTimeout(pollRef.current);
  }, [refresh]);

  const generate = async () => {
    if (!script.trim()) return;
    setGenerating(true);
    try {
      await generateVideo(script.trim(), { title: script.slice(0, 60) });
      // Start polling immediately; the new row appears as 'rendering'.
      refresh();
    } catch (err) {
      setLoadError(err.message);
      setGenerating(false);
    }
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

        {loadError && (
          <div className="mono" style={{ color: 'var(--accent)', marginBottom: 12 }}>
            Couldn’t reach the render service: {loadError}
          </div>
        )}

        <div className="col" style={{ gap: 10 }}>
          {queue.length === 0 && !loadError && (
            <div className="mono" style={{ opacity: 0.6 }}>No renders yet. Generate one above.</div>
          )}
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
          {generating ? <>Generating…</> : <><Icon name="sparkle" size={14} /> Generate video</>}
        </button>
      </div>
    </div>
  );
};

const VideoRow = ({ video }) => {
  // Live rows have no resolvable avatar; guard so we never crash on undefined.
  const avatar = video.avatarId ? AVATARS.find(a => a.id === video.avatarId) : null;
  const who = avatar ? avatar.contact.split(' ')[0] : 'Avatar';
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="col" style={{
      padding: 12,
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)',
      background: 'var(--surface)',
      gap: 12
    }}>
      <div className="row" style={{ gap: 14 }}>
        <div
          onClick={() => video.status === 'ready' && video.url && setExpanded(e => !e)}
          style={{ width: 80, aspectRatio: '16/9', borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0, position: 'relative', cursor: (video.status === 'ready' && video.url) ? 'pointer' : 'default', background: '#0a0a0a' }}>
          {avatar ? <AvatarTile avatar={avatar} /> : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}><Icon name="studio" size={16} /></div>}
          {video.status === 'ready' && video.url && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.25)' }}>
              <Icon name={expanded ? 'pause' : 'play'} size={18} style={{ color: '#fff' }} />
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {video.title}
          </div>
          <div className="row" style={{ marginTop: 4 }}>
            <span className="mono">{who}</span>
            {video.duration && <><span className="mono">·</span><span className="mono">{video.duration}</span></>}
            {video.createdAt && <><span className="mono">·</span><span className="mono">{video.createdAt}</span></>}
          </div>
          {video.status === 'rendering' && (
            <div style={{ marginTop: 8, height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${video.progress || 30}%`, height: '100%', background: 'var(--accent)', transition: 'width 200ms linear' }} />
            </div>
          )}
          {video.status === 'failed' && video.failureReason && (
            <div className="mono" style={{ marginTop: 6, color: 'var(--accent)' }}>Reason: {video.failureReason}</div>
          )}
        </div>
        <div className="row" style={{ gap: 6 }}>
          {video.status === 'ready' && video.url && (
            <>
              <a className="icon-btn" href={video.url} target="_blank" rel="noopener" title="Open in new tab"><Icon name="arrow-r" size={14} /></a>
              <a className="icon-btn" href={video.url} download title="Download"><Icon name="download" size={14} /></a>
            </>
          )}
          {video.status === 'rendering' && <StatusBadge status="training" progress={video.progress} />}
          {video.status === 'failed' && <StatusBadge status="failed" />}
        </div>
      </div>

      {/* inline player — the real win: ready videos actually play */}
      {expanded && video.url && (
        <video
          controls
          autoPlay
          playsInline
          src={video.url}
          style={{ width: '100%', borderRadius: 'var(--r-sm)', background: '#000' }}
        />
      )}
    </div>
  );
};

export default StudioView;
