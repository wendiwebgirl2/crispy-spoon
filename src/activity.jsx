import React from 'react'
import { api } from './api.js'

// Local 12-hour formatter. activity_log 'at' is UTC with no zone marker.
function fmtWhen(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Admin-only activity log — every mutating action across the dashboard.
export function ActivityLogView({ me }) {
  const [rows, setRows] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [user, setUser] = React.useState('');
  const [err, setErr] = React.useState('');
  const [offset, setOffset] = React.useState(0);
  const LIMIT = 100;

  const load = React.useCallback(() => {
    const qs = `?limit=${LIMIT}&offset=${offset}` + (user ? `&user=${encodeURIComponent(user)}` : '');
    api.getActivity(qs).then((r) => setRows(Array.isArray(r) ? r : [])).catch((e) => setErr(e.message || 'Could not load activity.'));
  }, [offset, user]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { api.listUsers().then((u) => setUsers(Array.isArray(u) ? u : [])).catch(() => {}); }, []);

  if (me && me.role !== 'admin') return <div className="v-pad fade-in"><div className="mono" style={{ color: 'var(--text-3)' }}>Admins only.</div></div>;

  const sel = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 12, padding: '6px 9px' };

  return (
    <div className="fade-in" style={{ padding: 'var(--pad)', maxWidth: 940 }}>
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>Filter by user</span>
        <select value={user} onChange={(e) => { setOffset(0); setUser(e.target.value); }} style={sel}>
          <option value="">Everyone</option>
          {users.map((u) => <option key={u.id} value={u.username}>{u.username}</option>)}
        </select>
        <button className="btn sm" onClick={load}>Refresh</button>
      </div>
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      {rows === null ? <div className="mono">Loading…</div> : rows.length === 0 ? <div className="mono" style={{ color: 'var(--text-3)' }}>No activity yet.</div> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {rows.map((r) => (
            <div key={r.id} className="row" style={{ gap: 10, alignItems: 'baseline', padding: '9px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)', width: 118, flex: 'none' }}>{fmtWhen(r.at)}</span>
              <span style={{ fontWeight: 600, fontSize: 12, width: 84, flex: 'none' }}>{r.username || '—'}</span>
              <span style={{ fontSize: 13, flex: 1, minWidth: 150 }}>{r.action}</span>
              {r.target && <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.target}</span>}
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{r.method} {r.path}</span>
            </div>
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 8, marginTop: 12, justifyContent: 'center' }}>
        <button className="btn sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>← Newer</button>
        <button className="btn sm" disabled={!!rows && rows.length < LIMIT} onClick={() => setOffset(offset + LIMIT)}>Older →</button>
      </div>
    </div>
  );
}
