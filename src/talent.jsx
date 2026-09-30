import React, { useState, useEffect, useRef } from 'react'
import { Icon } from './shared.jsx'
import { api } from './api.js'

// Talent Library — agency-wide generic AI avatars for announcers and
// voiceovers (no digital twin), castable for any client in Studio. Add from
// HeyGen stock, from one photo, or from a text description; voice is always an
// ElevenLabs voice. Looks (new outfits/sets) are generated here too, so the
// HeyGen dashboard is only needed for its subscription-only features.

const inputStyle = {
  background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px',
  boxSizing: 'border-box', height: 38,
};
const STATUS = {
  ready: ['ready to cast', 'var(--ok)'],
  needs_voice: ['pick a voice', 'var(--warn)'],
  processing: ['HeyGen is building…', 'var(--text-4)'],
  failed: ['failed', 'var(--accent)'],
};

// File -> { base64, mime } for the API (images go to HeyGen as assets).
export function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!/^image\//.test(file.type)) return reject(new Error('Please choose an image file'));
    if (file.size > 15 * 1024 * 1024) return reject(new Error('Image is too large (15 MB max)'));
    const fr = new FileReader();
    fr.onload = () => resolve({ base64: String(fr.result).split(',')[1] || '', mime: file.type, name: file.name, preview: String(fr.result) });
    fr.onerror = () => reject(new Error('Could not read the image'));
    fr.readAsDataURL(file);
  });
}

function Thumb({ url, size = 56 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--surface-2)', flex: 'none', display: 'grid', placeItems: 'center', border: '1px solid var(--border)' }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="avatars" size={18} />}
    </div>
  );
}

function ImagePick({ label, value, onChange }) {
  const ref = useRef(null);
  const [err, setErr] = useState('');
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
      {value && <Thumb url={value.preview} size={44} />}
      <button className="btn sm" onClick={() => ref.current && ref.current.click()}><Icon name="upload" size={12} /> {value ? 'Change' : label}</button>
      {value && <button className="btn sm" onClick={() => onChange(null)}>Remove</button>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => {
        setErr('');
        try { onChange(await readImage(e.target.files[0])); } catch (x) { setErr(x.message); }
        e.target.value = '';
      }} />
      {err && <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{err}</span>}
    </div>
  );
}

// Generate a new look for an avatar we own — a talent OR a client twin.
//   photo:  upload a photo of the same person -> added as a look to the group
//   prompt: describe the new outfit/setting (+ up to 3 reference images);
//           the current look is the face reference, so the person stays the same
export function NewLookPanel({ groupId, baseLookId, defaultName, onCreated, onClose }) {
  const [mode, setMode] = useState('prompt');
  const [name, setName] = useState(defaultName || '');
  const [prompt, setPrompt] = useState('');
  const [photo, setPhoto] = useState(null);
  const [refs, setRefs] = useState([null, null, null]);
  const [aspect, setAspect] = useState('auto');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [made, setMade] = useState(null);

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const payload = mode === 'photo'
        ? { mode, name: name || 'New look', group_id: groupId, image_base64: photo && photo.base64, image_mime: photo && photo.mime }
        : { mode, name: name || 'New look', group_id: groupId, base_look_id: baseLookId, prompt, aspect_ratio: aspect,
            reference_images: refs.filter(Boolean).map((r) => ({ base64: r.base64, mime: r.mime })) };
      const r = await api.talentNewLook(payload);
      setMade(r.look);
      if (onCreated) onCreated(r.look);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="card card-pad" style={{ marginTop: 8, background: 'var(--surface-2)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="label">NEW LOOK</div>
        {onClose && <button className="btn sm" onClick={onClose}>Close</button>}
      </div>
      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        {[['prompt', 'Describe it'], ['photo', 'Upload a photo']].map(([k, l]) => (
          <button key={k} className="btn sm" onClick={() => setMode(k)} style={{ borderColor: mode === k ? 'var(--accent)' : undefined }}>{l}</button>
        ))}
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Look name (e.g. Navy blazer, office)" style={{ ...inputStyle, width: '100%', marginBottom: 8 }} />
      {mode === 'prompt' ? (
        <>
          <textarea className="textarea" value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 1000))}
            placeholder="Wardrobe, setting and light — e.g. “Wearing a navy blazer, bright modern office with plants behind, warm natural light, facing camera”"
            style={{ minHeight: 80, fontSize: 13, width: '100%' }} />
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', margin: '4px 0 8px' }}>{prompt.length}/1000 · keeps the same face — only the outfit/setting changes</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Optional reference images (a jacket, a set, a style):</div>
          <div className="col" style={{ gap: 6, marginBottom: 8 }}>
            {refs.map((r, i) => (i === 0 || refs[i - 1]) ? (
              <ImagePick key={i} label={`Reference ${i + 1}`} value={r} onChange={(v) => setRefs((xs) => xs.map((x, j) => (j === i ? v : x)))} />
            ) : null)}
          </div>
          <select value={aspect} onChange={(e) => setAspect(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
            {['auto', '16:9', '9:16', '1:1', '4:5', '5:4'].map((a) => <option key={a} value={a}>{a === 'auto' ? 'Frame: auto' : `Frame: ${a}`}</option>)}
          </select>
        </>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <ImagePick label="Choose photo" value={photo} onChange={setPhoto} />
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6 }}>Same person, front-facing, even light, whole head in frame.</div>
        </div>
      )}
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <button className="btn primary sm" disabled={busy || (mode === 'prompt' ? !prompt.trim() : !photo)} onClick={submit}
          style={{ opacity: busy || (mode === 'prompt' ? !prompt.trim() : !photo) ? 0.6 : 1 }}>
          <Icon name="sparkle" size={12} /> {busy ? 'Sending to HeyGen…' : 'Generate look'}
        </button>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>Uses HeyGen API credits.</span>
      </div>
      {made && <div className="mono" style={{ marginTop: 8, fontSize: 12, color: 'var(--ok)' }}>Look requested — HeyGen is building it. It appears in the looks list when ready (usually a minute or two).</div>}
      {err && <div className="mono" style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)' }}>{err}</div>}
    </div>
  );
}

// Looks of one group, with "use this look" + new-look generator.
function LooksBlock({ groupId, currentLookId, onPick, canCreate, name }) {
  const [looks, setLooks] = useState(null);
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const load = () => { setErr(''); api.talentLooks(groupId).then((r) => setLooks(r.looks || [])).catch((e) => setErr(e.message)); };
  useEffect(() => { if (groupId) load(); }, [groupId]);
  return (
    <div style={{ marginTop: 10 }}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {looks === null && !err && <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>Loading looks…</span>}
        {(looks || []).map((l) => (
          <button key={l.id} title={(l.name || 'Look') + (l.status && l.status !== 'completed' ? ` · ${l.status}` : '')} disabled={l.status && l.status !== 'completed'}
            onClick={() => onPick && onPick(l)}
            style={{ padding: 0, width: 48, height: 48, borderRadius: 6, overflow: 'hidden', cursor: onPick ? 'pointer' : 'default', background: 'var(--surface-2)', opacity: l.status && l.status !== 'completed' ? 0.5 : 1,
              border: currentLookId === l.id ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
            {l.preview_image_url ? <img src={l.preview_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="mono" style={{ fontSize: 9 }}>{l.status || '…'}</span>}
          </button>
        ))}
        {canCreate && <button className="btn sm" onClick={() => setCreating((v) => !v)}><Icon name="plus" size={12} /> New look</button>}
        <button className="btn sm" onClick={load} title="Refresh looks"><Icon name="history" size={12} /></button>
      </div>
      {err && <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>{err}</div>}
      {creating && <NewLookPanel groupId={groupId} baseLookId={currentLookId} defaultName={name ? `${name} — new look` : ''} onCreated={() => setTimeout(load, 1500)} onClose={() => setCreating(false)} />}
    </div>
  );
}

function VoicePicker({ voices, value, onPick }) {
  const [q, setQ] = useState('');
  const audio = useRef(null);
  const list = (voices || []).filter((v) => !q || `${v.name} ${Object.values(v.labels || {}).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const play = (url) => { try { if (audio.current) audio.current.pause(); audio.current = new Audio(url); audio.current.play(); } catch { /* ignore */ } };
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ElevenLabs voices (name, accent, age…)" style={{ ...inputStyle, width: '100%', marginBottom: 6 }} />
      <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
        {voices === null && <div className="mono" style={{ padding: 8, fontSize: 12 }}>Loading voices…</div>}
        {list.map((v) => (
          <div key={v.voice_id} className="row" style={{ gap: 8, alignItems: 'center', padding: '6px 8px', borderTop: '1px solid var(--border)', background: value === v.voice_id ? 'var(--surface-2)' : 'transparent' }}>
            {v.preview_url && <button className="btn sm" onClick={() => play(v.preview_url)} title="Preview"><Icon name="play" size={11} /></button>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>{v.name}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[v.category, ...Object.values(v.labels || {})].filter(Boolean).join(' · ')}</div>
            </div>
            <button className="btn sm" onClick={() => onPick(v)} style={{ borderColor: value === v.voice_id ? 'var(--accent)' : undefined }}>{value === v.voice_id ? 'Selected' : 'Use'}</button>
          </div>
        ))}
        {voices && !list.length && <div className="mono" style={{ padding: 8, fontSize: 12, color: 'var(--text-4)' }}>No voices match.</div>}
      </div>
    </div>
  );
}

function StockBrowser({ onPickLook }) {
  const [groups, setGroups] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [looks, setLooks] = useState(null);
  const loadMore = (tok) => {
    setLoading(true);
    api.talentStock(tok).then((r) => { setGroups((g) => (tok ? g : []).concat(r.groups || [])); setNext(r.next_token || null); })
      .catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { loadMore(null); }, []);
  const openGroup = (g) => { setOpen(g); setLooks(null); api.talentStockLooks(g.id).then((r) => setLooks(r.looks || [])).catch((e) => setErr(e.message)); };
  const shown = groups.filter((g) => !q || String(g.name).toLowerCase().includes(q.toLowerCase()));
  if (open) {
    return (
      <div>
        <button className="btn sm" onClick={() => setOpen(null)} style={{ marginBottom: 8 }}><Icon name="arrow-l" size={12} /> All stock characters</button>
        <div className="label" style={{ marginBottom: 8 }}>{open.name} — pick a look</div>
        {looks === null ? <div className="mono">Loading looks…</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {looks.map((l) => (
              <button key={l.id} onClick={() => onPickLook(l, open)} style={{ padding: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left' }}>
                {l.preview_image_url && <img src={l.preview_image_url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />}
                <div className="mono" style={{ fontSize: 10.5, padding: '4px 6px' }}>{l.name || 'Look'}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter loaded characters by name" style={{ ...inputStyle, width: '100%', marginBottom: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
        {shown.map((g) => (
          <button key={g.id} onClick={() => openGroup(g)} style={{ padding: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left' }}>
            {g.preview_image_url && <img src={g.preview_image_url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />}
            <div className="mono" style={{ fontSize: 10.5, padding: '4px 6px' }}>{g.name} · {g.looks_count} look{g.looks_count === 1 ? '' : 's'}</div>
          </button>
        ))}
      </div>
      {err && <div className="mono" style={{ color: 'var(--accent)', fontSize: 12, marginTop: 6 }}>{err}</div>}
      {next && <button className="btn sm" disabled={loading} onClick={() => loadMore(next)} style={{ marginTop: 8 }}>{loading ? 'Loading…' : 'Load more'}</button>}
    </div>
  );
}

function AddTalent({ voices, onAdded }) {
  const [source, setSource] = useState('stock');
  const [name, setName] = useState('');
  const [look, setLook] = useState(null);      // stock pick
  const [photo, setPhoto] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [refs, setRefs] = useState([null, null, null]);
  const [aspect, setAspect] = useState('16:9');
  const [voice, setVoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ready = name.trim() && (source === 'stock' ? look : source === 'photo' ? photo : prompt.trim());
  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const body = { name: name.trim(), source, voice_id: voice && voice.voice_id, voice_name: voice && voice.name };
      if (source === 'stock') body.look_id = look.id;
      if (source === 'photo') Object.assign(body, { image_base64: photo.base64, image_mime: photo.mime });
      if (source === 'prompt') Object.assign(body, { prompt: prompt.trim(), aspect_ratio: aspect, reference_images: refs.filter(Boolean).map((r) => ({ base64: r.base64, mime: r.mime })) });
      await api.talentCreate(body);
      setName(''); setLook(null); setPhoto(null); setPrompt(''); setRefs([null, null, null]); setVoice(null);
      if (onAdded) onAdded();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="label" style={{ marginBottom: 10 }}>ADD TALENT</div>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['stock', 'HeyGen stock avatar'], ['photo', 'From a photo'], ['prompt', 'Describe a person']].map(([k, l]) => (
          <button key={k} className="btn sm" onClick={() => setSource(k)} style={{ borderColor: source === k ? 'var(--accent)' : undefined }}>{l}</button>
        ))}
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Talent name (e.g. Announcer — Grace)" style={{ ...inputStyle, width: '100%', marginBottom: 10 }} />
      {source === 'stock' && (look ? (
        <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <Thumb url={look.preview_image_url} /> <div className="mono" style={{ fontSize: 12 }}>{look.name}</div>
          <button className="btn sm" onClick={() => setLook(null)}>Change</button>
        </div>
      ) : <div style={{ marginBottom: 10 }}><StockBrowser onPickLook={(l, g) => { setLook(l); if (!name.trim()) setName(g.name); }} /></div>)}
      {source === 'photo' && (
        <div style={{ marginBottom: 10 }}>
          <ImagePick label="Choose photo" value={photo} onChange={setPhoto} />
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6 }}>
            One clear, front-facing portrait. Only use a photo of someone who has agreed to be an AI avatar (or a properly licensed stock photo).
          </div>
        </div>
      )}
      {source === 'prompt' && (
        <div style={{ marginBottom: 10 }}>
          <textarea className="textarea" value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 1000))}
            placeholder="Age, look, wardrobe, setting, light — e.g. “Friendly woman in her 40s, shoulder-length brown hair, navy blazer, bright radio studio, soft key light, facing camera”"
            style={{ minHeight: 90, fontSize: 13, width: '100%' }} />
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', margin: '4px 0 8px' }}>{prompt.length}/1000 · fully synthetic — not a real person</div>
          <div className="col" style={{ gap: 6, marginBottom: 8 }}>
            {refs.map((r, i) => (i === 0 || refs[i - 1]) ? (
              <ImagePick key={i} label={`Style reference ${i + 1} (optional)`} value={r} onChange={(v) => setRefs((xs) => xs.map((x, j) => (j === i ? v : x)))} />
            ) : null)}
          </div>
          <select value={aspect} onChange={(e) => setAspect(e.target.value)} style={inputStyle}>
            {['16:9', '9:16', '1:1', '4:5', '5:4', 'auto'].map((a) => <option key={a} value={a}>{`Frame: ${a}`}</option>)}
          </select>
        </div>
      )}
      <div className="label" style={{ margin: '6px 0 6px' }}>VOICE (ELEVENLABS){voice ? ` — ${voice.name}` : ''}</div>
      <VoicePicker voices={voices} value={voice && voice.voice_id} onPick={setVoice} />
      <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button className="btn primary sm" disabled={!ready || busy} onClick={submit} style={{ opacity: !ready || busy ? 0.6 : 1 }}>
          <Icon name="plus" size={12} /> {busy ? 'Adding…' : 'Add to talent library'}
        </button>
        {source !== 'stock' && <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>Uses HeyGen API credits.</span>}
      </div>
      {err && <div className="mono" style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)' }}>{err}</div>}
    </div>
  );
}

function TalentCard({ t, voices, onChanged }) {
  const [open, setOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [name, setName] = useState(t.name);
  const [err, setErr] = useState('');
  const [st, stColor] = STATUS[t.status] || [t.status, 'var(--text-4)'];
  const save = async (payload) => { setErr(''); try { await api.talentUpdate(t.id, payload); onChanged(); } catch (e) { setErr(e.message); } };
  return (
    <div className="card card-pad">
      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
        <Thumb url={t.thumbnail_url} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
            {{ stock: 'HeyGen stock', photo: 'from photo', prompt: 'described' }[t.source] || t.source}
            {' · '}<span style={{ color: stColor }}>{st}</span>
            {t.voice_name ? ` · voice: ${t.voice_name}` : ''}
          </div>
          {t.status === 'failed' && t.failure_reason && <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{t.failure_reason}</div>}
        </div>
        <button className="btn sm" onClick={() => setOpen((v) => !v)}>{open ? 'Close' : 'Manage'}</button>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ gap: 8, marginBottom: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button className="btn sm" disabled={!name.trim() || name === t.name} onClick={() => save({ name: name.trim() })}>Rename</button>
          </div>
          <button className="btn sm" onClick={() => setVoiceOpen((v) => !v)} style={{ marginBottom: 8 }}><Icon name="mic" size={12} /> {t.voice_id ? 'Change voice' : 'Pick a voice'}</button>
          {voiceOpen && <VoicePicker voices={voices} value={t.voice_id} onPick={(v) => { setVoiceOpen(false); save({ voice_id: v.voice_id, voice_name: v.name }); }} />}
          {t.heygen_group_id && (
            <>
              <div className="label" style={{ marginTop: 8 }}>LOOKS {t.source === 'stock' ? '(stock looks — click to switch)' : '(click to switch, or make a new one)'}</div>
              <LooksBlock groupId={t.heygen_group_id} currentLookId={t.heygen_avatar_id} name={t.name} canCreate={t.source !== 'stock'}
                onPick={(l) => save({ heygen_avatar_id: l.id, thumbnail_url: l.preview_image_url || null })} />
            </>
          )}
          <button className="btn sm" style={{ marginTop: 12, borderColor: 'var(--accent)', color: 'var(--accent)' }}
            onClick={async () => { if (window.confirm(`Remove “${t.name}” from the talent library? Past casts are kept.`)) { try { await api.talentDelete(t.id); onChanged(); } catch (e) { setErr(e.message); } } }}>
            <Icon name="close" size={12} /> Remove from library
          </button>
          {err && <div className="mono" style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)' }}>{err}</div>}
        </div>
      )}
    </div>
  );
}

const TalentView = () => {
  const [talent, setTalent] = useState(null);
  const [voices, setVoices] = useState(null);
  const [err, setErr] = useState('');
  const load = () => { setErr(''); api.talentList().then((r) => setTalent(r.talent || [])).catch((e) => setErr(e.message)); };
  useEffect(() => {
    load();
    api.talentVoices().then((r) => setVoices(r.voices || [])).catch((e) => { setVoices([]); setErr(e.message); });
  }, []);
  // HeyGen builds photo/described talent in the background — poll while any are processing.
  useEffect(() => {
    if (!talent || !talent.some((t) => t.status === 'processing')) return undefined;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [talent]);
  return (
    <div className="v-pad fade-in">
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 26, letterSpacing: '-0.01em', margin: '0 0 4px' }}>
        <em style={{ color: 'var(--accent)' }}>Talent</em> library
      </h1>
      <div className="mono" style={{ color: 'var(--text-4)', marginBottom: 16 }}>
        Generic AI talent for announcers and voiceovers — no digital twin. Anything here can be cast for any client in Studio (listed under “Talent library”).
      </div>
      <AddTalent voices={voices} onAdded={load} />
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      <div className="col" style={{ gap: 10 }}>
        {talent === null && <div className="mono">Loading…</div>}
        {talent && !talent.length && <div className="mono" style={{ color: 'var(--text-4)' }}>No talent yet — add your first above.</div>}
        {(talent || []).map((t) => <TalentCard key={t.id} t={t} voices={voices} onChanged={load} />)}
      </div>
    </div>
  );
};

export { TalentView }
