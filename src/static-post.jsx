// Static post editor: an episode with output_format 'static' — ordered images
// (one = a photo post, several = a carousel/album) + caption + hashtags.
// Scheduled and published from the Planner like any episode, to photo
// platforms (Facebook, Instagram, LinkedIn, X, Threads, Google Business).
import React from 'react'
import { Icon, uploadMany } from './shared.jsx'
import { ep } from './dashboard-api.js'
import { api } from './api.js'

const inputStyle = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px', boxSizing: 'border-box', width: '100%' };
// Each platform's caption limit (caption + hashtags). Longer text is trimmed
// at a word for that platform only when posting.
const LIMITS = [['X', 280], ['Threads', 500], ['Google Business', 1500], ['Instagram', 2200], ['LinkedIn', 3000]];
const isImg = (a) => /^image\//.test(a.mime || '') || /\.(png|jpe?g|webp|gif|bmp|tiff?|heic)$/i.test(a.filename || '');
const byName = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

export function StaticPostEditor({ cid, epId, full, assets, scripts, onAssetsChanged, onSaved, onFormat }) {
  const [title, setTitle] = React.useState(full.title || '');
  const [caption, setCaption] = React.useState(full.description || full.script_description || '');
  const [tags, setTags] = React.useState(full.hashtags || '');
  const [imgs, setImgs] = React.useState(Array.isArray(full.static_images) ? full.static_images : []);
  const [sel, setSel] = React.useState([]);
  const [dims, setDims] = React.useState({});           // assetId -> { w, h }
  const [dragFrom, setDragFrom] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [busy, setBusy] = React.useState('');
  const [err, setErr] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [dirty, setDirty] = React.useState(false);
  const touch = () => { setDirty(true); setMsg(''); };

  const library = (assets || []).filter(isImg);
  const byId = new Map(library.map((a) => [a.id, a]));
  const url = (id) => api.assetFileUrl(cid, id);
  const noteDims = (id) => (e) => { const { naturalWidth: w, naturalHeight: h } = e.currentTarget; if (w && h) setDims((m) => (m[id] ? m : { ...m, [id]: { w, h } })); };
  // Instagram feed accepts 4:5 (0.8) to 1.91:1 — outside that it may refuse or crop.
  const igWarn = (id) => { const d = dims[id]; if (!d) return null; const r = d.w / d.h; return r < 0.79 ? 'Taller than 4:5 - Instagram may crop or refuse it' : r > 1.92 ? 'Wider than 1.91:1 - Instagram may crop or refuse it' : null; };

  const save = async () => {
    setBusy('save'); setErr('');
    try {
      await ep.setMeta(cid, epId, { title: title.trim() || full.title, description: caption, hashtags: tags.trim(), staticImages: imgs });
      setDirty(false); setMsg('Saved. Schedule it from the Planner (Distribute → Schedule).');
      if (onSaved) onSaved();
    } catch (e) { setErr(e.message || 'Could not save.'); } finally { setBusy(''); }
  };
  const addIds = (ids) => { setImgs((x) => [...x, ...ids.filter((id) => !x.includes(id))]); touch(); };
  const moveTo = (from, to) => { setImgs((x) => { const n = [...x]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; }); touch(); };

  const addFiles = async (fileList) => {
    const all = Array.from(fileList || []);
    const files = all.filter((f) => (f.type || '').startsWith('image/') && f.size <= 50 * 1024 * 1024).sort((p, q) => byName(p.name, q.name));
    const skipped = all.length - files.length;
    if (!files.length) { setErr(skipped ? 'Only image files (up to 50 MB) can go in a static post.' : ''); return; }
    setBusy('upload'); setErr('');
    const { ok, failed } = await uploadMany(files, (f) => api.uploadAsset(cid, 'other', f));
    const ids = ok.map(({ result }) => result && (result.id || (result.asset && result.asset.id))).filter(Boolean);
    if (onAssetsChanged) await onAssetsChanged();
    addIds(ids);
    const notes = [];
    if (failed.length) notes.push(`${failed.length} failed: ` + failed.map((f) => `${f.name} (${f.error})`).join('; '));
    if (skipped) notes.push(`${skipped} skipped (not an image, or over 50 MB).`);
    setErr(notes.join(' ')); setBusy('');
  };
  const dropProps = {
    onDragOver: (e) => { if (Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); setDragOver(true); } },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); },
    onDrop: (e) => { if (!e.dataTransfer.files || !e.dataTransfer.files.length) return; e.preventDefault(); setDragOver(false); if (!busy) addFiles(e.dataTransfer.files); },
  };

  const briefTags = async () => {
    setBusy('tags'); setErr('');
    try { const b = await api.getBrief(cid); const t = String((b && b.social_hashtags) || '').trim(); if (t) { setTags(t); touch(); } else setErr('The Brief has no hashtags yet.'); }
    catch (e) { setErr(e.message || 'Could not read the Brief.'); } finally { setBusy(''); }
  };
  const suggestTags = async () => {
    setBusy('sugg'); setErr('');
    try { const r = await api.suggestHashtags(cid); const add = (r.hashtags || []).filter((h) => !tags.split(/\s+/).includes(h)); if (add.length) { setTags((t) => [t.trim(), ...add].filter(Boolean).join(' ')); touch(); } }
    catch (e) { setErr(e.message || 'Could not suggest hashtags.'); } finally { setBusy(''); }
  };
  const fromScript = (s) => {
    if (!s) return;
    setCaption(s.description || s.body || ''); if (s.hashtags) setTags(Array.isArray(s.hashtags) ? s.hashtags.join(' ') : String(s.hashtags));
    touch();
  };

  const total = [caption.trim(), tags.trim()].filter(Boolean).join('\n\n').length;
  const staticScripts = (scripts || []).filter((s) => s.channel === 'static');

  return (
    <div className="card card-pad">
      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 22, margin: '0 0 12px' }}>Static post: {full.title}</h2>
      <div className="card card-pad" style={{ marginBottom: 10 }}>
        <div className="label" style={{ marginBottom: 8 }}>FINAL FORMAT</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn sm" style={{ borderColor: 'var(--accent)', background: 'var(--surface-2)' }}>Static post</button>
          <button className="btn sm" onClick={() => { if (window.confirm('Turn this into a video/audio episode instead? Its images and caption are kept.')) onFormat('video'); }}>Video / audio episode…</button>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>Images + caption, posted as a photo (one image) or carousel/album (several). Nothing to stitch.</span>
        </div>
      </div>

      {/* Images */}
      <div className="card card-pad" {...dropProps} style={{ marginBottom: 10, outline: dragOver ? '2px dashed var(--accent)' : 'none', outlineOffset: -4, background: dragOver ? 'var(--surface-2)' : undefined }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
          <div className="label">IMAGES · {imgs.length}{imgs.length > 1 ? ' (carousel / album)' : ''}</div>
          <label className="btn sm" style={{ cursor: busy === 'upload' ? 'not-allowed' : 'pointer' }}>
            <Icon name="upload" size={12} /> {busy === 'upload' ? 'Uploading…' : 'Upload images'}
            <input type="file" accept="image/*" multiple disabled={busy === 'upload'} onChange={(e) => { const f = e.target.files; addFiles(f); e.target.value = ''; }} style={{ display: 'none' }} />
          </label>
        </div>
        {imgs.length === 0 ? (
          <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--r-md)', padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 14 }}>Drop the post's images here</div>
            <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 4 }}>One or several (filename order), or tick images in the library below. Drag to reorder; the first image leads.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {imgs.map((id, i) => {
              const a = byId.get(id); const warn = igWarn(id);
              return (
                <div key={id} draggable onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
                  onDragOver={(e) => { if (dragFrom != null) { e.preventDefault(); e.stopPropagation(); } }}
                  onDrop={(e) => { if (dragFrom == null) return; e.preventDefault(); e.stopPropagation(); moveTo(dragFrom, i); setDragFrom(null); }}
                  onDragEnd={() => setDragFrom(null)}
                  className="card" style={{ padding: 4, position: 'relative', cursor: 'grab', opacity: dragFrom === i ? 0.4 : 1 }} title={(a ? a.filename : 'image ' + id) + ' · drag to reorder'}>
                  <div style={{ height: 90, borderRadius: 6, overflow: 'hidden', background: 'var(--surface-2)' }}>
                    <img src={url(id)} alt="" draggable={false} onLoad={noteDims(id)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span className="badge" style={{ position: 'absolute', top: 6, left: 6, fontSize: 10, padding: '1px 5px', background: 'rgba(0,0,0,0.65)', color: '#fff' }}>{i + 1}</span>
                  <button className="icon-btn" title="Remove from this post" onClick={() => { setImgs((x) => x.filter((y) => y !== id)); touch(); }}
                    style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, padding: 0, background: 'rgba(0,0,0,0.65)', color: '#fff' }}><Icon name="close" size={10} /></button>
                  <div className="mono" style={{ fontSize: 10, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a ? a.filename : 'image ' + id}</div>
                  {dims[id] && <div className="mono" style={{ fontSize: 9, color: warn ? 'var(--warn, var(--accent))' : 'var(--text-4)' }} title={warn || ''}>{dims[id].w}×{dims[id].h}{warn ? ' · ⚠ IG shape' : ''}</div>}
                </div>
              );
            })}
          </div>
        )}
        {imgs.some((id) => igWarn(id)) && <div className="mono" style={{ fontSize: 11, color: 'var(--warn, var(--accent))', marginTop: 6 }}>⚠ Instagram feed posts must be between 4:5 (portrait) and 1.91:1 (landscape). Images outside that may be cropped or refused there; other platforms are fine.</div>}
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6 }}>Posted as JPEG, resized to at most 1440 px wide and under 4 MB so every platform accepts it. X shows up to 4 images per post.</div>
      </div>

      {/* Library */}
      {library.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
            <div className="label">FROM LIBRARY</div>
            <div className="row" style={{ gap: 6 }}>
              {sel.length > 0 && <button className="btn sm" onClick={() => setSel([])}>Clear ticks</button>}
              <button className="btn primary sm" disabled={!sel.length} style={{ opacity: sel.length ? 1 : 0.5 }} onClick={() => { addIds(sel); setSel([]); }}>
                <Icon name="plus" size={12} /> Add selected{sel.length ? ` (${sel.length})` : ''}
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, maxHeight: 280, overflow: 'auto' }}>
            {library.map((a) => {
              const on = sel.includes(a.id); const inPost = imgs.includes(a.id);
              return (
                <button key={a.id} className="card" onClick={() => setSel((x) => (x.includes(a.id) ? x.filter((y) => y !== a.id) : [...x, a.id]))} title={(on ? 'Untick ' : 'Tick ') + a.filename}
                  style={{ padding: 5, cursor: 'pointer', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 3, borderColor: on ? 'var(--accent)' : undefined, boxShadow: on ? '0 0 0 1px var(--accent)' : undefined }}>
                  <div style={{ height: 56, borderRadius: 5, overflow: 'hidden', background: 'var(--surface-2)', position: 'relative' }}>
                    <img src={url(a.id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <input type="checkbox" readOnly checked={on} tabIndex={-1} style={{ position: 'absolute', top: 3, left: 3, margin: 0, pointerEvents: 'none' }} />
                    {inPost && <span className="badge" style={{ position: 'absolute', top: 3, right: 3, fontSize: 9, padding: '1px 4px', background: 'var(--accent)', color: '#fff' }}>in post</span>}
                  </div>
                  <div className="mono" style={{ fontSize: 9.5, lineHeight: 1.25, wordBreak: 'break-word' }}>{a.filename}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Caption + hashtags */}
      <div className="card card-pad" style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="col" style={{ gap: 4 }}><span className="label">TITLE (internal + Planner)</span>
          <input value={title} onChange={(e) => { setTitle(e.target.value); touch(); }} style={inputStyle} /></label>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="label">CAPTION</span>
          {staticScripts.length > 0 && (
            <select value="" onChange={(e) => fromScript(staticScripts.find((s) => String(s.id) === e.target.value))} style={{ ...inputStyle, width: 'auto', fontSize: 12, padding: '5px 8px' }}>
              <option value="">From an approved Static post script…</option>
              {staticScripts.map((s) => <option key={s.id} value={s.id}>{(s.title || s.topic || 'Script ' + s.id).slice(0, 60)}</option>)}
            </select>
          )}
        </div>
        <textarea value={caption} onChange={(e) => { setCaption(e.target.value); touch(); }} rows={5} placeholder="What the post says (Static post scripts in Scripts can draft this with AI)" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="label">HASHTAGS · this post only</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" disabled={!!busy} onClick={briefTags} title="Replace with the client's Brief hashtags">{busy === 'tags' ? 'Loading…' : 'Use Brief hashtags'}</button>
            <button className="btn sm" disabled={!!busy} onClick={suggestTags} title="Add AI-suggested hashtags">{busy === 'sugg' ? 'Thinking…' : 'Suggest more'}</button>
          </div>
        </div>
        <input value={tags} onChange={(e) => { setTags(e.target.value); touch(); }} placeholder="#example #hashtags" style={inputStyle} />
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>
          {total} characters with hashtags. {LIMITS.filter(([, n]) => total > n).map(([p, n]) => `${p} (${n})`).join(', ') ? `Over the limit for ${LIMITS.filter(([, n]) => total > n).map(([p, n]) => `${p} (${n})`).join(', ')} — trimmed at a word there.` : 'Fits every platform.'}
        </div>
      </div>

      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn primary" disabled={busy === 'save' || !dirty} onClick={save}><Icon name="check" size={13} /> {busy === 'save' ? 'Saving…' : 'Save post'}</button>
        {dirty && <span className="mono" style={{ fontSize: 12, color: 'var(--warn, var(--accent))' }}>Unsaved changes</span>}
        {msg && <span className="mono" style={{ fontSize: 12, color: 'var(--ok)' }}>{msg}</span>}
      </div>
      {err && <div className="mono" style={{ color: 'var(--accent)', marginTop: 8 }}>{err}</div>}
    </div>
  );
}
