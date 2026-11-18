// Prompt library: saved prompts that work well, kept for repeated use.
// One compact row under a prompt field: a "Saved prompts" menu that fills the
// field, "Save" to keep what's in the field, and "Manage" to edit or delete.
// The list is shared across the account (stored by the render server).
import React from 'react'
import { listPrompts, savePrompt, updatePrompt, deletePrompt } from './api.js'

const ENGINE_LABELS = { any: 'Any engine', hedra: 'Hedra', heygen: 'HeyGen' };

// Shared cache so every picker on the page shows the same list without
// re-fetching; `bump` re-renders pickers after a change.
const cache = { token: null, prompts: [], listeners: new Set() };
async function refresh(token) {
  if (!token) return;
  try {
    const r = await listPrompts(token);
    cache.token = token; cache.prompts = r.prompts || [];
  } catch { cache.prompts = []; }
  cache.listeners.forEach((fn) => fn());
}

export function PromptLibrary({ token, engineKind, value, onPick, selStyle }) {
  const [, bump] = React.useReducer((n) => n + 1, 0);
  const [mode, setMode] = React.useState(null); // null | 'save' | 'manage'
  const [name, setName] = React.useState('');
  const [engine, setEngine] = React.useState(engineKind || 'any');
  const [note, setNote] = React.useState('');
  const [editId, setEditId] = React.useState(null);
  const [editText, setEditText] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    cache.listeners.add(bump);
    if (token && cache.token !== token) refresh(token);
    return () => { cache.listeners.delete(bump); };
  }, [token]);

  const style = { ...(selStyle || {}), fontSize: 12, padding: '5px 8px' };
  const fits = cache.prompts.filter((p) => p.engine === 'any' || p.engine === engineKind);
  const run = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(); await refresh(token); } catch (e) { setErr(e.message || 'Something went wrong.'); }
    finally { setBusy(false); }
  };

  if (!token) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value="" style={{ ...style, flex: 1, minWidth: 140 }} title="Fill this field with a saved prompt"
          onChange={(e) => { const p = fits.find((x) => x.id === e.target.value); if (p) onPick(p.text); }}>
          <option value="">{fits.length ? `Saved prompts (${fits.length})…` : (cache.prompts.length ? `No saved prompts for ${ENGINE_LABELS[engineKind] || 'this engine'}` : 'No saved prompts yet')}</option>
          {fits.map((p) => <option key={p.id} value={p.id}>{p.name}{p.engine !== 'any' ? ` · ${ENGINE_LABELS[p.engine]}` : ''}</option>)}
        </select>
        <button className="btn sm" disabled={!String(value || '').trim()} title="Save what's in this field to the library"
          onClick={() => { setMode(mode === 'save' ? null : 'save'); setName(''); setNote(''); setEngine(engineKind || 'any'); }}>Save</button>
        <button className="btn sm" onClick={() => setMode(mode === 'manage' ? null : 'manage')}>Manage</button>
      </div>

      {mode === 'save' && (
        <div className="col" style={{ gap: 6, marginTop: 6, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Mark - gentle gestures" style={{ ...style, width: '100%', boxSizing: 'border-box' }} />
          <div className="row" style={{ gap: 6 }}>
            <select value={engine} onChange={(e) => setEngine(e.target.value)} style={style}>
              {Object.entries(ENGINE_LABELS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="When to use it (optional)" style={{ ...style, flex: 1 }} />
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', whiteSpace: 'pre-wrap' }}>Saves: "{String(value || '').trim()}"</div>
          <button className="btn primary sm" disabled={busy || !name.trim()} style={{ alignSelf: 'flex-start' }}
            onClick={() => run(async () => { await savePrompt(token, { name: name.trim(), engine, note: note.trim(), text: String(value).trim() }); setMode(null); })}>
            {busy ? 'Saving…' : 'Save to library'}
          </button>
        </div>
      )}

      {mode === 'manage' && (
        <div className="col" style={{ gap: 6, marginTop: 6, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', maxHeight: 320, overflow: 'auto' }}>
          {cache.prompts.length === 0 && <div className="mono" style={{ fontSize: 11 }}>No saved prompts yet. Type one in the field above and press Save.</div>}
          {cache.prompts.map((p) => (
            <div key={p.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{p.name} <span className="mono" style={{ fontSize: 10, fontWeight: 400 }}>· {ENGINE_LABELS[p.engine] || p.engine}</span></span>
                <span className="row" style={{ gap: 4 }}>
                  <button className="btn sm" onClick={() => { setEditId(editId === p.id ? null : p.id); setEditText(p.text); }}>{editId === p.id ? 'Cancel' : 'Edit'}</button>
                  <button className="btn sm" disabled={busy} onClick={() => { if (window.confirm(`Delete the saved prompt "${p.name}"?`)) run(() => deletePrompt(token, p.id)); }}>Delete</button>
                </span>
              </div>
              {p.note && <div className="mono" style={{ fontSize: 10, color: 'var(--text-4)' }}>{p.note}</div>}
              {editId === p.id ? (
                <div className="col" style={{ gap: 4, marginTop: 4 }}>
                  <textarea className="textarea" value={editText} onChange={(e) => setEditText(e.target.value)} style={{ minHeight: 60, fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                  <button className="btn primary sm" disabled={busy || !editText.trim()} style={{ alignSelf: 'flex-start' }}
                    onClick={() => run(async () => { await updatePrompt(token, p.id, { name: p.name, engine: p.engine, note: p.note, text: editText.trim() }); setEditId(null); })}>Save changes</button>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{p.text}</div>
              )}
            </div>
          ))}
        </div>
      )}
      {err && <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>{err}</div>}
    </div>
  );
}
