// components/task-status.jsx — Task Status: the onboarding tasks assigned to
// people, pulled out of the old sidebar "My Tasks" snippet into a page of its
// own. Admins see and can check off everyone's open tasks, grouped by
// assignee; managers/editors see the same checklist styling but scoped to
// only the tasks assigned to them (enforced server-side — GET /alerts/my-tasks
// returns an admin-or-self view depending on the caller's role).

import React from 'react'
import { api } from './api.js'
import { ensureOperatorName } from './shared.jsx'

// Plain printable checklist for one person — basic on purpose: name, the
// date/time it was printed, and an empty box per task to check off by hand.
function printTasks(personLabel, rows) {
  const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const w = window.open('', '_blank', 'width=680,height=880');
  if (!w) return;
  const printedAt = new Date().toLocaleString();
  const items = rows.map((t) => `<li><span class="box"></span>${esc(t.label)} <span class="client">&mdash; ${esc(t.client_name)}</span></li>`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(personLabel)} &mdash; Task List</title>
    <style>
      body{font-family:Georgia,serif;max-width:600px;margin:40px auto;color:#222;background:#fff;line-height:1.6}
      h1{font-size:22px;margin:0 0 4px}
      .meta{font-family:monospace;font-size:12px;color:#666;border-bottom:1px solid #ccc;padding-bottom:12px;margin-bottom:20px}
      ul{list-style:none;padding:0;margin:0}
      li{padding:8px 0;border-bottom:1px solid #eee;font-size:15px}
      .box{display:inline-block;width:14px;height:14px;border:1.5px solid #333;margin-right:10px;vertical-align:-2px}
      .client{color:#777;font-size:13px}
    </style></head><body>
    <h1>${esc(personLabel)}</h1>
    <div class="meta">Printed ${esc(printedAt)} &middot; ${rows.length} open task${rows.length === 1 ? '' : 's'}</div>
    <ul>${items || '<li>No open tasks.</li>'}</ul>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

// Row styling matches brief.jsx's OnboardingCard so a task reads the same way
// whether you're checking it off here or on the client's Brief page.
function TaskRow({ t, onToggle, onOpen }) {
  return (
    <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '9px 0', borderTop: '1px solid var(--border)' }}>
      <input type="checkbox" checked={false} onChange={() => onToggle(t)}
        style={{ flex: '0 0 auto', width: 18, height: 18, accentColor: 'var(--ok)', cursor: 'pointer' }} />
      <div style={{ flex: '1 1 240px', minWidth: 200 }}>
        <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>{t.label}</div>
        <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 2 }}>{t.client_name}</div>
      </div>
      <button className="btn sm" onClick={() => onOpen(t)} title="Open this client's Brief">Open →</button>
    </div>
  );
}

function AssigneeGroup({ name, tasks, onToggle, onOpen }) {
  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="label" style={{ margin: 0 }}>{name || 'UNASSIGNED'}</div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span className="mono" style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{tasks.length} open</span>
          <button className="btn sm" onClick={() => printTasks(name || 'Unassigned', tasks)}>Print</button>
        </div>
      </div>
      {tasks.map((t) => <TaskRow key={t.id} t={t} onToggle={onToggle} onOpen={onOpen} />)}
    </div>
  );
}

export function TaskStatusView({ me, onOpenClient }) {
  const [tasks, setTasks] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [filter, setFilter] = React.useState('all'); // admin only: 'all' | an assignee name

  const isAdmin = !!(me && me.role === 'admin');

  const load = React.useCallback(() => {
    api.myTasks().then((t) => setTasks(Array.isArray(t) ? t : [])).catch((e) => setErr(e.message || 'Could not load tasks.'));
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const toggleDone = (t) => {
    const name = ensureOperatorName();
    if (!name) return;
    setErr('');
    api.updateOnboardingTask(t.client_id, t.id, { done: true, name })
      .then(load)
      .catch((e) => setErr(e.message || 'Could not update that task.'));
  };
  const openClient = (t) => onOpenClient && onOpenClient(t.client_id);

  // Group by assignee (admin view) — named people alphabetical, unassigned last.
  const groups = React.useMemo(() => {
    if (!tasks) return [];
    const byName = new Map();
    for (const t of tasks) {
      const key = (t.assignee || '').trim();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(t);
    }
    const named = [...byName.entries()].filter(([k]) => k).sort((a, b) => a[0].localeCompare(b[0]));
    const unassigned = byName.get('');
    return unassigned && unassigned.length ? [...named, ['', unassigned]] : named;
  }, [tasks]);

  const counts = React.useMemo(() => groups.map(([name, rows]) => ({ name, count: rows.length })), [groups]);
  const visibleGroups = filter === 'all' ? groups : groups.filter(([name]) => name === filter);

  return (
    <div className="fade-in rail-320" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100%', minHeight: 0 }}>
      <div style={{ overflow: 'auto', padding: 'var(--pad)' }}>
        <div className="label">TASK STATUS</div>
        <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 34, letterSpacing: '-0.01em', margin: '6px 0 18px' }}>
          {isAdmin ? <>Onboarding tasks, <em style={{ color: 'var(--accent)' }}>everyone's</em>.</> : <>Your <em style={{ color: 'var(--accent)' }}>onboarding</em> tasks.</>}
        </h1>

        {err && (
          <div className="card card-pad" style={{ borderColor: 'var(--err)', marginBottom: 16 }}>
            <span className="mono" style={{ color: 'var(--err)' }}>{err}</span>
          </div>
        )}

        {tasks === null ? (
          <div className="mono" style={{ color: 'var(--text-3)' }}>Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="mono" style={{ color: 'var(--text-3)' }}>Nothing open — every assigned onboarding task is done or N/A.</div>
        ) : isAdmin ? (
          visibleGroups.map(([name, rows]) => (
            <AssigneeGroup key={name || '__unassigned'} name={name} tasks={rows} onToggle={toggleDone} onOpen={openClient} />
          ))
        ) : (
          <div className="card card-pad">
            <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
              <button className="btn sm" onClick={() => printTasks((me && me.username) || 'Your tasks', tasks)}>Print</button>
            </div>
            {tasks.map((t) => <TaskRow key={t.id} t={t} onToggle={toggleDone} onOpen={openClient} />)}
          </div>
        )}
      </div>

      {/* —— right rail: summary + (admin) per-person filter —— */}
      <div className="rail-aside-320" style={{ borderLeft: '1px solid var(--border)', padding: 'var(--pad)', overflow: 'auto' }}>
        <div className="label" style={{ marginBottom: 10 }}>{isAdmin ? 'BY PERSON' : 'SUMMARY'}</div>
        {tasks === null ? (
          <div className="mono" style={{ color: 'var(--text-4)' }}>Loading…</div>
        ) : isAdmin ? (
          <div className="col" style={{ gap: 2 }}>
            <button onClick={() => setFilter('all')} className="nav-item" style={{ width: '100%', cursor: 'pointer', background: filter === 'all' ? 'var(--surface-2)' : 'transparent' }}>
              <span style={{ fontSize: 13, flex: 1, textAlign: 'left' }}>Everyone</span>
              <span className="nav-count">{tasks.length}</span>
            </button>
            {counts.map(({ name, count }) => (
              <button key={name || '__unassigned'} onClick={() => setFilter(name)} className="nav-item"
                style={{ width: '100%', cursor: 'pointer', background: filter === name ? 'var(--surface-2)' : 'transparent' }}>
                <span style={{ fontSize: 13, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Unassigned'}</span>
                <span className="nav-count">{count}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mono" style={{ color: 'var(--text-3)', fontSize: 13, lineHeight: 1.6 }}>
            {tasks.length} open task{tasks.length === 1 ? '' : 's'} assigned to you, across {new Set(tasks.map((t) => t.client_id)).size} client{new Set(tasks.map((t) => t.client_id)).size === 1 ? '' : 's'}.
          </div>
        )}
      </div>
    </div>
  );
}
