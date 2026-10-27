import { useState, useEffect } from 'react'
import { api } from './api.js'
import { fmtStamp, Icon } from './shared.jsx'

// Team notes — the internal, staff-only conversation about an episode and its
// script. Pass episodeId OR scriptId; the server joins the two, so the same
// thread shows on the episode and on the script it was built from. Anyone on
// staff can add a note; only admins see the delete button.
export function NotesThread({ clientId, episodeId, scriptId, collapsible = false }) {
  // Rows are tagged with the thread they belong to, so switching to another
  // episode/script shows "Loading…" instead of the previous thread's notes.
  const key = (episodeId ? 'e' : 's') + (episodeId || scriptId) + '@' + clientId;
  const [loaded, setLoaded] = useState({ key: null, rows: null });
  const rows = loaded.key === key ? loaded.rows : null;
  const setRows = (fn) => setLoaded((cur) => ({ key, rows: typeof fn === 'function' ? fn(cur.key === key ? cur.rows : null) : fn }));
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const target = episodeId ? { episodeId } : { scriptId };

  useEffect(() => {
    let live = true;
    if (!clientId || !(episodeId || scriptId)) return undefined;
    api.teamNotes(clientId, target).then((r) => { if (live) { setLoaded({ key, rows: Array.isArray(r) ? r : [] }); setErr(''); } })
      .catch((e) => { if (live) { setLoaded({ key, rows: [] }); setErr(e.message || 'Could not load notes.'); } });
    api.me().then((m) => { if (live) setIsAdmin(!!m && m.role === 'admin'); }).catch(() => {});
    return () => { live = false; };
  }, [clientId, episodeId, scriptId]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true); setErr('');
    try { const row = await api.addTeamNote(clientId, { ...target, body }); setRows((cur) => [...(cur || []), row]); setDraft(''); }
    catch (e) { setErr(e.message || 'Could not add the note.'); }
    finally { setBusy(false); }
  };
  const remove = async (n) => {
    if (!window.confirm('Delete this note for everyone? This cannot be undone.')) return;
    try { await api.deleteTeamNote(clientId, n.id); setRows((cur) => (cur || []).filter((x) => x.id !== n.id)); }
    catch (e) { setErr(e.message || 'Could not delete the note.'); }
  };

  const count = rows ? rows.length : 0;
  const title = <>Team notes{count ? ` (${count})` : ''} <span className="mono" style={{ color: 'var(--text-4)', fontWeight: 400 }}>(internal — clients never see these)</span></>;
  const content = (
    <>
      {rows === null ? <div className="mono" style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>Loading…</div>
        : !rows.length ? <div className="mono" style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>No notes yet — start the conversation below.</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6, maxHeight: 320, overflowY: 'auto' }}>
            {rows.map((n) => (
              <div key={n.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, fontSize: 12.5 }}>{n.username || 'Earlier notes'}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{fmtStamp(n.created_at)}</span>
                  {scriptId && n.episode_id && <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>· on episode</span>}
                  {isAdmin && <button className="btn sm" style={{ marginLeft: 'auto', padding: '2px 8px' }} onClick={() => remove(n)} title="Delete note (admins only)">Delete</button>}
                </div>
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', marginTop: 3, color: 'var(--text-2)' }}>{n.body}</div>
              </div>
            ))}
          </div>
        )}
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(); }}
        placeholder="Add a note for the team — production reminders, client context, to-dos… (⌘+Enter to post)"
        style={{ width: '100%', marginTop: 8, padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13, resize: 'vertical' }} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{err}</span>
        <button className="btn sm primary" disabled={busy || !draft.trim()} onClick={add}><Icon name="check" size={12} /> {busy ? 'Posting…' : 'Add note'}</button>
      </div>
    </>
  );

  if (collapsible) {
    return (
      <details open={count > 0} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '8px 12px' }}>
        <summary style={{ fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{title}</summary>
        {content}
      </details>
    );
  }
  return (
    <div className="card card-pad" style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
      {content}
    </div>
  );
}
