// Hedra photo avatars: a photo + a voice, nothing at HeyGen (Hedra's API has
// no avatar object). Shared by Studio (cast window) and the Talent page:
//   NewHedraAvatar  - create one (photo source + voice)
//   HedraLooks      - the avatar's looks (several photos, e.g. horizontal +
//                     vertical): switch, add, remove
//   HedraPhotoSource - the photo picker both of them use
import React from 'react'
import { listRecordings, hedraVoices, hedraFrameUrl, createHedraAvatar, hedraLooks, addHedraLook, switchHedraLook, deleteHedraLook } from './api.js'

const recLabel = (r) => (r.signed_name || r.title || 'Recording') + (r.uploaded_at || r.created_at ? ' · ' + String(r.uploaded_at || r.created_at).slice(0, 10) : '');

function useRecordings(token) {
  const [recs, setRecs] = React.useState([]);
  React.useEffect(() => {
    if (!token) return;
    listRecordings(token).then((r) => setRecs(Array.isArray(r) ? r : (r.recordings || []))).catch(() => setRecs([]));
  }, [token]);
  return recs;
}

// Photo source: frame from a recording | upload | an existing avatar's look.
// value = { src, recId, t, file, fromAv }; onChange(next).
// sources = [{ id, label }] for "existing avatar's look".
export function HedraPhotoSource({ token, recs, sources, value, onChange, selStyle }) {
  const [dur, setDur] = React.useState(null);
  const [frame, setFrame] = React.useState(null);
  const [frameErr, setFrameErr] = React.useState('');
  const full = { ...selStyle, width: '100%', boxSizing: 'border-box', marginBottom: 8 };
  const v = value;
  const set = (patch) => onChange({ ...v, ...patch });
  const recId = v.recId || (recs[0] ? String(recs[0].id) : '');

  // Frame preview, fetched a moment after the slider stops moving.
  React.useEffect(() => {
    if (v.src !== 'recording' || !recId) return undefined;
    const h = setTimeout(async () => {
      setFrameErr('');
      try {
        const r = await fetch(hedraFrameUrl(token, recId, v.t));
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'No frame'); }
        const secs = Number(r.headers.get('X-Recording-Seconds')); if (secs) setDur(secs);
        const url = URL.createObjectURL(await r.blob());
        setFrame((old) => { if (old) URL.revokeObjectURL(old); return url; });
      } catch (e) { setFrame(null); setFrameErr(e.message); }
    }, 400);
    return () => clearTimeout(h);
  }, [v.src, recId, v.t, token]);

  const uploadUrl = React.useMemo(() => (v.file ? URL.createObjectURL(v.file) : null), [v.file]);
  return (
    <>
      <select value={v.src} onChange={(e) => set({ src: e.target.value })} style={full}>
        <option value="recording">Frame from a recording</option>
        <option value="upload">Upload a photo</option>
        <option value="avatar">Use an existing avatar's look</option>
      </select>
      {v.src === 'recording' && (recs.length === 0
        ? <div className="mono" style={{ fontSize: 11, marginBottom: 8 }}>No recordings for this client.</div>
        : (
          <>
            <select value={recId} onChange={(e) => { set({ recId: e.target.value, t: 3 }); setDur(null); }} style={full}>
              {recs.map((r) => <option key={r.id} value={r.id}>{recLabel(r)}</option>)}
            </select>
            <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input type="range" min="0" max={Math.max(1, Math.floor((dur || 30) - 0.5))} step="0.5" value={v.t} onChange={(e) => set({ t: Number(e.target.value), recId })} style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 11, minWidth: 54, textAlign: 'right' }}>{Number(v.t).toFixed(1)}s{dur ? ' / ' + Math.floor(dur) + 's' : ''}</span>
            </div>
            {frame && <img src={frame} alt="frame" style={{ width: '100%', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', marginBottom: 8 }} />}
            {frameErr && <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>{frameErr}</div>}
          </>
        ))}
      {v.src === 'upload' && (
        <>
          <input type="file" accept="image/*" onChange={(e) => set({ file: e.target.files[0] || null })} style={{ fontSize: 12, marginBottom: 8 }} />
          {uploadUrl && <img src={uploadUrl} alt="upload" style={{ width: '100%', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', marginBottom: 8 }} />}
        </>
      )}
      {v.src === 'avatar' && (
        <select value={v.fromAv || ''} onChange={(e) => set({ fromAv: e.target.value })} style={full}>
          <option value="">Choose an avatar…</option>
          {(sources || []).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      )}
    </>
  );
}

const photoReady = (p, recs) => (p.src === 'upload' ? !!p.file : p.src === 'recording' ? !!(p.recId || recs[0]) : !!p.fromAv);
const photoFields = (p, recs) => ({
  recording_id: p.src === 'recording' ? (p.recId || (recs[0] ? String(recs[0].id) : '')) : '',
  t: p.src === 'recording' ? p.t : '',
  from_avatar_id: p.src === 'avatar' ? p.fromAv : '',
});

// Create a Hedra photo avatar: a photo + a voice (one the client has, or
// cloned from a recording).
export function NewHedraAvatar({ token, sources, selStyle, onCreated }) {
  const recs = useRecordings(token);
  const [name, setName] = React.useState('');
  const [photo, setPhoto] = React.useState({ src: 'recording', t: 3 });
  const [voices, setVoices] = React.useState([]);
  const [voice, setVoice] = React.useState('');
  const [cloneRec, setCloneRec] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const full = { ...selStyle, width: '100%', boxSizing: 'border-box', marginBottom: 8 };

  React.useEffect(() => {
    hedraVoices(token).then((r) => { const v = r.voices || []; setVoices(v); setVoice(v[0] ? v[0].voice_id : 'clone'); }).catch(() => setVoices([]));
  }, [token]);
  const cloneFrom = cloneRec || (recs[0] ? String(recs[0].id) : '');
  const canSave = !busy && name.trim() && photoReady(photo, recs) && (voice === 'clone' ? cloneFrom : voice);

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const r = await createHedraAvatar({
        token, name: name.trim(), ...photoFields(photo, recs),
        voice_id: voice !== 'clone' ? voice : '', clone_voice_recording_id: voice === 'clone' ? cloneFrom : '',
      }, photo.src === 'upload' ? photo.file : null);
      onCreated && onCreated(r.avatar);
    } catch (e) { setErr(e.message || 'Could not create the avatar.'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }}>
      <div className="label" style={{ marginBottom: 6 }}>NAME</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane - patio look" style={full} />

      <div className="label" style={{ marginBottom: 6 }}>PHOTO (first look - add more looks later)</div>
      <HedraPhotoSource token={token} recs={recs} sources={sources} value={photo} onChange={setPhoto} selStyle={selStyle} />

      <div className="label" style={{ marginBottom: 6 }}>VOICE</div>
      <select value={voice} onChange={(e) => setVoice(e.target.value)} style={full}>
        {voices.map((v) => <option key={v.voice_id} value={v.voice_id}>{v.name} ({v.source === 'heygen' ? 'HeyGen voice' : 'ElevenLabs'})</option>)}
        <option value="clone">Clone a new voice from a recording (ElevenLabs)</option>
      </select>
      {voice === 'clone' && (recs.length
        ? <select value={cloneFrom} onChange={(e) => setCloneRec(e.target.value)} style={full}>{recs.map((r) => <option key={r.id} value={r.id}>{recLabel(r)}</option>)}</select>
        : <div className="mono" style={{ fontSize: 11, marginBottom: 8 }}>No recordings to clone from.</div>)}

      {err && <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>{err}</div>}
      <button className="btn primary sm" disabled={!canSave} onClick={save} style={{ opacity: canSave ? 1 : 0.5 }}>
        {busy ? 'Creating…' : 'Create Hedra photo avatar'}
      </button>
    </div>
  );
}

const SHAPE = { horizontal: 'H', vertical: 'V', square: 'SQ' };

// The looks of one Hedra avatar. Click a look to cast with it; "+ New look"
// adds a photo (e.g. a vertical one for 9:16 casts). aspect = the cast's shape
// (Studio) for a hint when the look in use doesn't match it.
// onChanged(currentLook) after a switch/add so the caller can refresh.
export function HedraLooks({ token, avatarId, aspect, sources, selStyle, onChanged }) {
  const recs = useRecordings(token);
  const [looks, setLooks] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState('');
  const [useNow, setUseNow] = React.useState(true);
  const [photo, setPhoto] = React.useState({ src: 'upload', t: 3 });
  const full = { ...selStyle, width: '100%', boxSizing: 'border-box', marginBottom: 8 };

  React.useEffect(() => {
    if (!token || !avatarId) return;
    let live = true;
    hedraLooks(token, avatarId).then((r) => { if (live) setLooks(r.looks || []); }).catch((e) => { if (live) { setLooks([]); setErr(e.message); } });
    return () => { live = false; };
  }, [token, avatarId]);

  const after = (r) => {
    const list = r.looks || [];
    setLooks(list);
    const cur = list.find((l) => l.current);
    if (onChanged && cur) onChanged(cur);
  };
  const run = async (what, fn) => {
    setBusy(what); setErr('');
    try { after(await fn()); return true; } catch (e) { setErr(e.message || 'Something went wrong.'); return false; } finally { setBusy(''); }
  };
  const add = async () => {
    const ok = await run('add', () => addHedraLook(token, avatarId, { name: name.trim(), use: useNow ? '1' : '', ...photoFields(photo, recs) }, photo.src === 'upload' ? photo.file : null));
    if (ok) { setAdding(false); setName(''); setPhoto({ src: 'upload', t: 3 }); }
  };

  const cur = (looks || []).find((l) => l.current);
  const want = aspect === '9:16' ? 'vertical' : aspect === '16:9' ? 'horizontal' : aspect === '1:1' ? 'square' : null;
  const better = want && cur && cur.shape && cur.shape !== want ? (looks || []).find((l) => l.shape === want) : null;
  const mismatch = want && cur && cur.shape && cur.shape !== want;

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="label" style={{ marginBottom: 6 }}>LOOKS {looks && looks.length ? `(${looks.length})` : ''}</div>
      {looks === null && <div className="mono" style={{ fontSize: 11 }}>Loading looks…</div>}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {(looks || []).map((l) => (
          <div key={l.id} style={{ position: 'relative' }}>
            <button title={`${l.name}${l.width ? ` · ${l.width}×${l.height}` : ''}${l.current ? ' · in use' : ' · click to cast with this look'}`}
              disabled={!!busy || l.current}
              onClick={() => run('use', () => switchHedraLook(token, avatarId, l.id))}
              style={{ padding: 0, width: 64, height: 64, borderRadius: 'var(--r-sm)', overflow: 'hidden', cursor: l.current ? 'default' : 'pointer', background: '#0a0a0a',
                border: l.current ? '2px solid var(--accent)' : '1px solid var(--border)', display: 'block' }}>
              {l.url && <img src={l.url} alt={l.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />}
            </button>
            {l.shape && <span className="mono" style={{ position: 'absolute', left: 3, top: 3, fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,0,0,0.65)', color: '#fff' }}>{SHAPE[l.shape]}</span>}
            {!l.current && (
              <button title="Remove this look" disabled={!!busy}
                onClick={() => { if (window.confirm(`Remove the look "${l.name}"? Its photo is deleted.`)) run('del', () => deleteHedraLook(token, avatarId, l.id)); }}
                style={{ position: 'absolute', right: 2, top: 2, width: 16, height: 16, lineHeight: '14px', padding: 0, fontSize: 11, borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer' }}>×</button>
            )}
            <div className="mono" style={{ fontSize: 10, width: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{l.name}</div>
          </div>
        ))}
        <button className="btn sm" onClick={() => setAdding((a) => !a)} style={{ height: 64, width: 64, flexDirection: 'column', justifyContent: 'center', fontSize: 11 }}>
          {adding ? 'Close' : '+ New look'}
        </button>
      </div>
      {mismatch && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--warn, var(--accent))', marginTop: 6 }}>
          {better
            ? <>The look in use is {cur.shape}; this cast is {aspect}. <button className="btn sm" disabled={!!busy} onClick={() => run('use', () => switchHedraLook(token, avatarId, better.id))}>Use "{better.name}"</button></>
            : <>The look in use is {cur.shape}; this cast is {aspect}, so the photo will be cropped. Add a {want} look for better framing.</>}
        </div>
      )}
      {busy && <div className="mono" style={{ fontSize: 11, marginTop: 6 }}>{busy === 'add' ? 'Adding look…' : busy === 'use' ? 'Switching look…' : 'Removing…'}</div>}
      {err && <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>{err}</div>}
      {adding && (
        <div style={{ marginTop: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }}>
          <div className="label" style={{ marginBottom: 6 }}>NEW LOOK</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Vertical - office (optional)" style={full} />
          <HedraPhotoSource token={token} recs={recs} sources={(sources || []).filter((s) => s.id !== avatarId)} value={photo} onChange={setPhoto} selStyle={selStyle} />
          <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 12, marginBottom: 8 }}>
            <input type="checkbox" checked={useNow} onChange={(e) => setUseNow(e.target.checked)} /> Cast with this look now
          </label>
          <button className="btn primary sm" disabled={!!busy || !photoReady(photo, recs)} onClick={add} style={{ opacity: !busy && photoReady(photo, recs) ? 1 : 0.5 }}>
            {busy === 'add' ? 'Adding…' : 'Add look'}
          </button>
        </div>
      )}
    </div>
  );
}
