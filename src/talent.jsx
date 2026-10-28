import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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

// Full-size image viewer. Any thumbnail calls expandImage(url, caption); the
// one <ImageLightbox /> mounted in TalentView shows it (Esc or click to close).
const LIGHTBOX_EVENT = 'talent:expand-image';
const expandImage = (url, caption) => { if (url) window.dispatchEvent(new CustomEvent(LIGHTBOX_EVENT, { detail: { url, caption } })); };

function ImageLightbox() {
  const [img, setImg] = useState(null);
  useEffect(() => {
    const onOpen = (e) => setImg(e.detail);
    const onKey = (e) => { if (e.key === 'Escape') setImg(null); };
    window.addEventListener(LIGHTBOX_EVENT, onOpen);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener(LIGHTBOX_EVENT, onOpen); window.removeEventListener('keydown', onKey); };
  }, []);
  if (!img) return null;
  // Portaled to <body>: the page's fade-in transform would otherwise trap a
  // position:fixed overlay inside the content column.
  return createPortal(
    <div onClick={() => setImg(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,7,0.82)', zIndex: 1200, display: 'grid', placeItems: 'center', padding: 24, cursor: 'zoom-out' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, maxWidth: '100%' }}>
        <img src={img.url} alt={img.caption || ''} style={{ maxWidth: 'min(900px, 92vw)', maxHeight: '82vh', objectFit: 'contain', borderRadius: 8, background: '#000', boxShadow: '0 10px 40px rgba(0,0,0,.5)' }} />
        <div className="mono" style={{ color: '#eee', fontSize: 12 }}>{img.caption ? img.caption + ' · ' : ''}click or press Esc to close</div>
      </div>
    </div>,
    document.body
  );
}

// Small "expand" corner button for a look tile — sits on top of the tile so
// the tile's own click (pick this look) still works.
function ExpandBtn({ url, caption }) {
  if (!url) return null;
  return (
    <span role="button" title="View full size" onClick={(e) => { e.stopPropagation(); expandImage(url, caption); }}
      style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, lineHeight: 1, cursor: 'zoom-in' }}>⤢</span>
  );
}

function Thumb({ url, size = 56, caption }) {
  return (
    <div onClick={url ? () => expandImage(url, caption) : undefined} title={url ? 'View full size' : undefined}
      style={{ width: size, height: size, borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--surface-2)', flex: 'none', display: 'grid', placeItems: 'center', border: '1px solid var(--border)', cursor: url ? 'zoom-in' : 'default' }}>
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
            style={{ position: 'relative', padding: 0, width: 64, height: 64, borderRadius: 6, overflow: 'hidden', cursor: onPick ? 'pointer' : 'default', background: 'var(--surface-2)', opacity: l.status && l.status !== 'completed' ? 0.5 : 1,
              border: currentLookId === l.id ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
            {l.preview_image_url ? <img src={l.preview_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="mono" style={{ fontSize: 9 }}>{l.status || '…'}</span>}
            <ExpandBtn url={l.preview_image_url} caption={l.name || 'Look'} />
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

// Voice picker: "My voices" (already saved in our ElevenLabs account) or the full ElevenLabs
// Voice Library (6,000+ public voices, filterable). A library voice is added to our account
// when chosen — that uses one of the plan's voice slots, so the picker says so.
function VoicePicker({ voices, value, onPick }) {
  const [mode, setMode] = useState('mine'); // mine | library
  const [q, setQ] = useState('');
  const audio = useRef(null);
  const play = (url) => { try { if (audio.current) audio.current.pause(); audio.current = new Audio(url); audio.current.play(); } catch { /* ignore */ } };

  // ---- library state
  const [gender, setGender] = useState('female');
  const [age, setAge] = useState('');
  const [accent, setAccent] = useState('');
  const [useCase, setUseCase] = useState('');
  const [sort, setSort] = useState('trending');
  const [lib, setLib] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(null);
  const [slots, setSlots] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(null);
  const [err, setErr] = useState('');

  const fetchLib = async (pg, replace) => {
    setLoading(true); setErr('');
    try {
      const params = { page: pg, page_size: 30, sort };
      if (gender) params.gender = gender;
      if (age) params.age = age;
      if (accent) params.accent = accent;
      if (useCase) params.use_cases = useCase;
      if (q.trim()) params.search = q.trim();
      const r = await api.talentVoiceLibrary(params);
      setLib((cur) => (replace ? r.voices : [...cur, ...r.voices]));
      setHasMore(!!r.has_more); setTotal(r.total_count); setPage(pg);
      if (r.slots) setSlots(r.slots);
    } catch (e) { setErr(e.message || 'Could not load the voice library.'); }
    finally { setLoading(false); }
  };
  // Reload from page 0 when a filter changes (search is debounced).
  useEffect(() => {
    if (mode !== 'library') return undefined;
    const t = setTimeout(() => fetchLib(0, true), q ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gender, age, accent, useCase, sort, q]);

  const useLibraryVoice = async (v) => {
    setAdding(v.voice_id); setErr('');
    try {
      const r = await api.talentAddLibraryVoice({ public_owner_id: v.public_owner_id, voice_id: v.voice_id, name: v.name });
      if (r.slots) setSlots(r.slots);
      onPick({ voice_id: r.voice_id, name: r.name || v.name });
    } catch (e) { setErr(e.message || 'Could not add that voice.'); }
    finally { setAdding(null); }
  };

  const mine = (voices || []).filter((v) => !q || `${v.name} ${Object.values(v.labels || {}).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const sel = { ...inputStyle, width: 'auto', padding: '6px 8px', fontSize: 12 };
  const tab = (id, label) => (
    <button className="btn sm" onClick={() => setMode(id)} style={{ borderColor: mode === id ? 'var(--accent)' : undefined, color: mode === id ? 'var(--accent)' : undefined }}>{label}</button>
  );
  const rows = mode === 'mine' ? mine : lib;
  return (
    <div>
      <div className="row" style={{ gap: 6, marginBottom: 6 }}>
        {tab('mine', `My voices${voices ? ` (${voices.length})` : ''}`)}
        {tab('library', 'Full ElevenLabs library')}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={mode === 'mine' ? 'Search my voices (name, accent, age…)' : 'Search the whole library (name, style, accent…)'} style={{ ...inputStyle, width: '100%', marginBottom: 6 }} />
      {mode === 'library' && (
        <>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <select value={gender} onChange={(e) => setGender(e.target.value)} style={sel}><option value="">Any gender</option><option value="female">Female</option><option value="male">Male</option><option value="neutral">Neutral</option></select>
            <select value={age} onChange={(e) => setAge(e.target.value)} style={sel}><option value="">Any age</option><option value="young">Young</option><option value="middle_aged">Middle-aged</option><option value="old">Older</option></select>
            <select value={useCase} onChange={(e) => setUseCase(e.target.value)} style={sel}>
              <option value="">Any use</option><option value="narrative_story">Narration / story</option><option value="conversational">Conversational</option><option value="social_media">Social media</option><option value="advertisement">Advertisement</option><option value="informative_educational">Informative / educational</option><option value="entertainment_tv">Entertainment / TV</option><option value="characters_animation">Characters</option>
            </select>
            <select value={accent} onChange={(e) => setAccent(e.target.value)} style={sel}>
              <option value="">Any accent</option><option value="american">American</option><option value="british">British</option><option value="australian">Australian</option><option value="canadian">Canadian</option><option value="irish">Irish</option><option value="indian">Indian</option><option value="southern">Southern</option><option value="standard">Standard</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={sel}><option value="trending">Trending</option><option value="usage_character_count_1y">Most used</option><option value="cloned_by_count">Most added</option><option value="created_date">Newest</option></select>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 6 }}>
            {total != null ? `${total.toLocaleString()} voices match · ` : ''}choosing one adds it to your ElevenLabs account{slots && slots.limit != null ? ` (uses 1 voice slot — ${slots.used} of ${slots.limit} used)` : ''}.
          </div>
        </>
      )}
      <div style={{ maxHeight: mode === 'library' ? 320 : 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
        {mode === 'mine' && voices === null && <div className="mono" style={{ padding: 8, fontSize: 12 }}>Loading voices…</div>}
        {rows.map((v) => (
          <div key={v.voice_id} className="row" style={{ gap: 8, alignItems: 'center', padding: '6px 8px', borderTop: '1px solid var(--border)', background: value === v.voice_id ? 'var(--surface-2)' : 'transparent' }}>
            {v.preview_url && <button className="btn sm" onClick={() => play(v.preview_url)} title="Preview"><Icon name="play" size={11} /></button>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>{v.name}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[v.category, ...Object.values(v.labels || {})].filter(Boolean).join(' · ')}</div>
            </div>
            {mode === 'mine'
              ? <button className="btn sm" onClick={() => onPick(v)} style={{ borderColor: value === v.voice_id ? 'var(--accent)' : undefined }}>{value === v.voice_id ? 'Selected' : 'Use'}</button>
              : <button className="btn sm" disabled={adding === v.voice_id} onClick={() => useLibraryVoice(v)}>{adding === v.voice_id ? 'Adding…' : (value === v.voice_id ? 'Selected' : 'Add & use')}</button>}
          </div>
        ))}
        {mode === 'library' && loading && <div className="mono" style={{ padding: 8, fontSize: 12 }}>Loading library…</div>}
        {mode === 'library' && !loading && hasMore && <div style={{ padding: 8 }}><button className="btn sm" onClick={() => fetchLib(page + 1, false)}>Load more</button></div>}
        {!loading && voices !== null && !rows.length && <div className="mono" style={{ padding: 8, fontSize: 12, color: 'var(--text-4)' }}>No voices match.</div>}
      </div>
      {err && <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>{err}</div>}
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
              <button key={l.id} onClick={() => onPickLook(l, open)} style={{ position: 'relative', padding: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left' }}>
                {l.preview_image_url && <img src={l.preview_image_url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />}
                <ExpandBtn url={l.preview_image_url} caption={`${open.name} — ${l.name || 'Look'}`} />
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
          <button key={g.id} onClick={() => openGroup(g)} style={{ position: 'relative', padding: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left' }}>
            {g.preview_image_url && <img src={g.preview_image_url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />}
            <ExpandBtn url={g.preview_image_url} caption={g.name} />
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
        <Thumb url={t.thumbnail_url} caption={t.name} />
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
      <ImageLightbox />
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
