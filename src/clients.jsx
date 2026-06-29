import React, { useState, useEffect } from 'react'
import { api } from './api.js'
import { Icon } from './shared.jsx'

// Live Clients screen — reads and writes the same-origin VoiceCast API.
// Entered here, a client persists to the database and becomes selectable for
// the Brief and Scripts tabs. (The seed avatar/episode browsing lived here
// before; that hierarchy belongs to the HeyGen/Railway side and returns when
// that backend is wired.)
function ClientsView({ activeClientId, onSelect, onOpenBrief }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr('');
    try {
      const cs = await api.listClients();
      setClients(Array.isArray(cs) ? cs : (cs?.clients || []));
    } catch (e) {
      setErr(e.message || 'Could not load clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true); setErr('');
    try {
      const c = await api.createClient({ name: n });
      setName('');
      await load();
      const id = c?.id ?? c?.client?.id;
      if (id != null) onSelect?.(id);
    } catch (e) {
      setErr(e.message || 'Could not add client.');
    } finally {
      setBusy(false);
    }
  };

  const rename = async (c) => {
    const next = window.prompt('Rename client', c.name);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === c.name) return;
    setErr('');
    try { await api.renameClient(c.id, { name: trimmed }); await load(); }
    catch (e) { setErr(e.message || 'Could not rename.'); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"? This also removes its brief and scripts.`)) return;
    setErr('');
    try {
      await api.deleteClient(c.id);
      if (activeClientId === c.id) onSelect?.(null);
      await load();
    } catch (e) {
      setErr(e.message || 'Could not delete.');
    }
  };

  return (
    <div className="v-pad fade-in">
      <div className="label">CLIENTS · LIVE</div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 34, lineHeight: 1.1, margin: '6px 0 4px' }}>
        Your <em>clients</em>, saved for real.
      </h1>
      <div className="mono" style={{ color: 'var(--text-3)' }}>
        Stored in the database — these feed the Brief and Scripts tabs.
      </div>

      {err && (
        <div className="card card-pad" style={{ marginTop: 16, borderColor: 'var(--accent)' }}>
          <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>
        </div>
      )}

      <div className="card card-pad" style={{ marginTop: 18, marginBottom: 22 }}>
        <div className="label">ADD A CLIENT</div>
        <div className="row" style={{ gap: 10, marginTop: 10, alignItems: 'stretch' }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder="Company or client name"
            style={{
              flex: 1, height: 44, padding: '0 14px',
              background: 'var(--surface-2)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
              fontFamily: 'var(--f-mono)', fontSize: 14,
            }}
          />
          <button className="btn primary" onClick={add} disabled={busy || !name.trim()}>
            <Icon name="plus" size={14} stroke={2.2} />
            {busy ? 'Adding…' : 'Add client'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>Loading clients…</div>
      ) : clients.length === 0 ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>No clients yet — add your first above.</div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {clients.map((c) => {
            const active = c.id === activeClientId;
            return (
              <div
                key={c.id}
                className="card card-pad row"
                style={{
                  gap: 12, alignItems: 'center',
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                }}
              >
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onSelect?.(c.id)}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                  <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2 }}>
                    id {c.id}{c.created_at ? ` · added ${String(c.created_at).slice(0, 10)}` : ''}
                  </div>
                </div>
                {active && <span className="badge" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>selected</span>}
                <button className="btn sm" onClick={() => onOpenBrief?.(c.id)}>
                  <Icon name="doc" size={13} /> Brief
                </button>
                <button className="icon-btn" title="Rename" onClick={() => rename(c)}>
                  <Icon name="more" size={14} />
                </button>
                <button className="icon-btn" title="Delete" onClick={() => remove(c)} style={{ color: 'var(--accent)' }}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { ClientsView }
