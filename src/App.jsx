import React from 'react'
import { Icon } from './shared.jsx'
import logoLockup from './assets/LOGO-cuecreative.png'
import { api } from './api.js'
import { ClientsView } from './clients.jsx'
import { BriefView } from './brief.jsx'
import { ClientDetailView } from './client-detail.jsx'
import { InvitationsView } from './invitations.jsx'
import { PlannerView } from './planner.jsx'
import { ScriptsView } from './scripts.jsx'
import { BillingView } from './billing.jsx'
import StudioView from './studio.jsx'
import { RecordingsView } from './recordings.jsx'
import { EpisodesView } from './episodes.jsx'
import { OnboardingView } from './onboarding.jsx'
import { SettingsView } from './settings.jsx'

const NAV = [
  { id: 'clients',       label: 'Clients',        icon: 'avatars' },
  { id: 'studio',        label: 'Studio',         icon: 'studio',   countKey: 'rendering' },
  { id: 'planner',       label: 'Planner',        icon: 'history',  countKey: 'planner' },
  { id: 'onboarding',    label: 'Record on-site', icon: 'mic' },
  { id: 'billing',       label: 'Billing',        icon: 'sliders' },
];

const HEADER_TITLES = {
  clients:         { title: 'Clients',        sub: 'your roster — saved to the live API' },
  brief:           { title: 'Brief',          sub: 'contact + positioning for the selected client' },
  invitations:     { title: 'Invitations',    sub: 'notifications sent to clients — live status' },
  planner:         { title: 'Planner',         sub: 'production status + publishing schedule' },
  scripts:         { title: 'Scripts',         sub: 'Claude-generated copy from the client brief' },
  studio:          { title: 'Studio',          sub: 'cast a script into a HeyGen render' },
  episodes:        { title: 'Episodes',        sub: 'stitch audio + generate video for the selected client' },
  recordings:      { title: 'Recordings',      sub: 'R2 masters + HeyGen renders for the active token' },
  onboarding:      { title: 'On-site record',  sub: 'record an avatar in person, no email needed' },
  settings:        { title: 'Settings',        sub: 'workspace · branding · integrations' },
  billing:         { title: 'Billing',         sub: 'plans, usage, and invoices' },
  changes:         { title: 'Client changes',  sub: 'requested changes across every client — newest first' },
  attention:       { title: 'Needs attention',  sub: 'clients & tasks waiting on you — newest first' },
};

// Local 12-hour, user-local time formatter for attention timestamps. SQLite
// datetime('now') is UTC with no zone marker, so tag it as UTC before display.
function fmtWhen(s) {
  if (!s) return '';
  const iso = String(s).includes('T') ? String(s) : String(s).replace(' ', 'T');
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Requested-changes inbox. Each row links straight to the item's home view.
function ChangesView({ onOpen }) {
  const [rows, setRows] = React.useState(null);
  React.useEffect(() => { api.listChanges().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, []);
  const TYPE_VIEW = { script: 'scripts', cast: 'studio', episode: 'episodes' };
  if (rows === null) return <div className="v-pad fade-in"><div className="mono">Loading…</div></div>;
  if (!rows.length) return <div className="v-pad fade-in"><div className="mono" style={{ color: 'var(--text-3)' }}>No open change requests — nothing from clients right now.</div></div>;
  return (
    <div className="fade-in" style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
      {rows.map((r) => (
        <div key={r.type + '-' + r.id} className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="badge">{r.type}</span>
            {r.job_number && <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>Job {r.job_number}</span>}
            <span style={{ fontWeight: 600, fontSize: 13 }}>{r.title || r.topic || (r.type + ' ' + r.id)}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>{r.client_name}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)', marginLeft: 'auto' }}>{r.approval_updated_at ? String(r.approval_updated_at).slice(0, 10) : ''}</span>
          </div>
          {r.approval_comment && (
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>
              <span style={{ color: 'var(--accent)' }}>Client notes:</span> {r.approval_comment}{r.approval_by ? ' — ' + r.approval_by : ''}
            </div>
          )}
          <div>
            <button className="btn sm" onClick={() => onOpen(r.client_id, TYPE_VIEW[r.type] || 'clients')}>
              Open in {TYPE_VIEW[r.type] || 'dashboard'} →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// "Needs attention" inbox — clients and tasks waiting on the operator,
// grouped by client. Each row links straight to the item's home view.
const ATTN_META = {
  approved: { color: 'var(--ok)',     label: 'Approved' },
  pending:  { color: 'var(--accent)', label: 'Pending' },
  rendered: { color: 'var(--accent)', label: 'Ready' },
  failed:   { color: 'var(--warn)',   label: 'Needs retry' },
  invite:   { color: 'var(--text-3)', label: 'Invite' },
};
// Category display order within a client — most urgent first.
const ATTN_ORDER = ['failed', 'rendered', 'approved', 'invite', 'pending'];

function AttentionView({ onOpen }) {
  const [data, setData] = React.useState(null);
  const [openClient, setOpenClient] = React.useState(null);
  const [busy, setBusy] = React.useState(null);
  React.useEffect(() => {
    let live = true;
    api.attention().then((d) => { if (live) setData(d && d.clients ? d : { total: 0, clients: [] }); })
      .catch(() => { if (live) setData({ total: 0, clients: [] }); });
    return () => { live = false; };
  }, []);

  const dismiss = async (it) => {
    const key = it.code + '-' + it.id;
    setBusy(key);
    try { await api.dismissAttention(it.code, it.id); } catch { /* best-effort */ }
    setData((cur) => {
      if (!cur) return cur;
      const clients = cur.clients
        .map((c) => ({ ...c, items: c.items.filter((x) => !(x.code === it.code && x.id === it.id)) }))
        .filter((c) => c.items.length);
      return { total: clients.reduce((n, c) => n + c.items.length, 0), clients };
    });
    setBusy(null);
  };

  if (data === null) return <div className="v-pad fade-in"><div className="mono">Loading…</div></div>;
  if (!data.clients.length) return <div className="v-pad fade-in"><div className="mono" style={{ color: 'var(--text-3)' }}>All caught up — nothing needs your attention right now.</div></div>;

  const current = openClient != null ? data.clients.find((c) => c.clientId === openClient) : null;

  // ——— Landing: one card per client with its open-alert count ———
  if (!current) {
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--gap)', maxWidth: 900 }}>
          {data.clients.map((c) => {
            const counts = {};
            for (const it of c.items) counts[it.type] = (counts[it.type] || 0) + 1;
            return (
              <button key={c.clientId} className="card card-pad" onClick={() => setOpenClient(c.clientId)}
                style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{c.clientName || ('Client ' + c.clientId)}</span>
                  <span style={{ fontFamily: 'var(--f-display)', fontSize: 22, lineHeight: 1 }}>{c.items.length}</span>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {ATTN_ORDER.filter((t) => counts[t]).map((t) => {
                    const m = ATTN_META[t];
                    return (
                      <span key={t} className="row" style={{ gap: 5, fontSize: 12, color: 'var(--text-3)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flex: 'none' }} />
                        {counts[t]} {m.label.toLowerCase()}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ——— Drill-in: one client's alerts grouped by category ———
  const groups = {};
  for (const it of current.items) (groups[it.type] = groups[it.type] || []).push(it);
  return (
    <div className="fade-in" style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820 }}>
      <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
        <button className="btn sm" onClick={() => setOpenClient(null)}><Icon name="arrow-l" size={12} /> All clients</button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{current.clientName || ('Client ' + current.clientId)}</span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>{current.items.length} open</span>
      </div>
      {ATTN_ORDER.filter((t) => groups[t]).map((t) => {
        const m = ATTN_META[t];
        return (
          <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flex: 'none' }} />
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>{groups[t].length}</span>
            </div>
            {groups[t].map((it) => (
              <div key={it.code + '-' + it.id} className="card" style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase' }}>{it.kind}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{it.title}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>· {it.action}</span>
                {it.detail && <span className="mono" style={{ fontSize: 11, color: 'var(--warn)', width: '100%' }}>{it.detail}</span>}
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)', marginLeft: 'auto' }}>{fmtWhen(it.at)}</span>
                <button className="btn sm" onClick={() => onOpen(it)}>Open →</button>
                <button className="btn sm" disabled={busy === (it.code + '-' + it.id)} onClick={() => dismiss(it)}
                  title="Dismiss this alert">
                  <Icon name="check" size={12} /> Done
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const [view, setView] = React.useState('clients');
  const [studioNonce, setStudioNonce] = React.useState(0);
  const goStudio = () => { setStudioNonce((n) => n + 1); setView('studio'); };
  const [castRequest, setCastRequest] = React.useState(null);
  const [scriptTopicRequest, setScriptTopicRequest] = React.useState(null);
  const [scriptRequest, setScriptRequest] = React.useState(null);
  const [episodeRequest, setEpisodeRequest] = React.useState(null);
  const [inviteFocus, setInviteFocus] = React.useState(null);

  // Deep-open an item from the "Needs attention" inbox — route by kind so the
  // target view opens the actual episode/script/cast/invite, not just its tab.
  const openAttentionItem = (it) => {
    if (!it) return;
    if (it.kind === 'episode') { setActiveClientId(it.client_id); setEpisodeRequest({ openId: it.id }); setView('episodes'); }
    else if (it.kind === 'script') { setActiveClientId(it.client_id); setScriptRequest({ openId: it.id }); setView('scripts'); }
    else if (it.kind === 'cast') { setActiveClientId(it.client_id); setCastRequest({ clientId: it.client_id }); setView('studio'); }
    else if (it.kind === 'invite') { setActiveClientId(it.client_id); setInviteFocus(it.id); setView('invitations'); }
    else { setActiveClientId(it.client_id); setView(it.view || 'clients'); }
  };
  const [activeClientId, setActiveClientId] = React.useState(null);
  const [alerts, setAlerts] = React.useState(null);
  React.useEffect(() => {
    let live = true;
    const load = () => api.alerts().then((a) => { if (live) setAlerts(a); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { live = false; clearInterval(t); };
  }, [view]);
  const [activeClientName, setActiveClientName] = React.useState('');
  React.useEffect(() => {
    if (!activeClientId) { setActiveClientName(''); return; }
    api.listClients()
      .then((r) => {
        const list = Array.isArray(r) ? r : (r.clients || []);
        const c = list.find((x) => x.id === activeClientId);
        setActiveClientName((c && c.name) || '');
      })
      .catch(() => setActiveClientName(''));
  }, [activeClientId]);
  const [detailClient, setDetailClient] = React.useState(null);

  // Nav badge counts. null hides the badge (see the countKey guard below).
  // Previously these were derived from mock fixtures and showed invented
  // numbers; wire them to real endpoints before switching them back on.
  const counts = {
    planner:   null,
    rendering: null,
  };

  const hd = (view === 'client-detail' && detailClient)
    ? { title: detailClient.name, sub: 'client workspace' }
    : HEADER_TITLES[view] || HEADER_TITLES.clients;

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand">
          <img src={logoLockup} alt="cue:creative" style={{ height: 32, width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
        </div>

        <div className="side-section">WORKSPACE</div>
        <nav className="side-nav">
          {NAV.map(n => (
            <button
              key={n.id}
              className={'nav-item' + (view === n.id ? ' active' : '')}
              onClick={() => n.id === 'studio' ? goStudio() : setView(n.id)}
              title={n.label}
            >
              <Icon
                name={n.icon}
                size={16}
                stroke={1.6}
                className="nav-icon"
                style={{ color: view === n.id ? 'var(--accent)' : 'var(--text-3)' }}
              />
              <span>{n.label}</span>
              {n.countKey != null && counts[n.countKey] != null && (
                <span className="nav-count">{counts[n.countKey]}</span>
              )}
            </button>
          ))}
        </nav>

        {alerts && (
          <>
            <div className="side-section" style={{ marginTop: 14 }}>ALERTS</div>
            <div className="side-nav">
              <button
                className={'nav-item' + (view === 'attention' ? ' active' : '')}
                onClick={() => setView('attention')}
                title="Needs attention"
              >
                <Icon name="bell" size={16} stroke={1.6} className="nav-icon" style={{ color: view === 'attention' ? 'var(--accent)' : 'var(--text-3)' }} />
                <span>Needs attention</span>
                {alerts.attention > 0 && <span className="nav-count">{alerts.attention}</span>}
              </button>
            </div>
            <div className="side-nav">
              {[
                { k: 'changes', label: 'Changes from client', color: 'var(--warn)', go: () => setView('changes') },
                { k: 'pending', label: 'Pending approval', color: 'var(--accent)' },
                { k: 'in_production', label: 'In production', color: 'var(--text-2)' },
                { k: 'approved', label: 'Approved', color: 'var(--ok)' },
                { k: 'invites_recorded', label: 'Invites recorded', color: 'var(--text-3)' },
              ].map((a) => (
                <div key={a.k} className={'nav-item' + (a.go && view === 'changes' && a.k === 'changes' ? ' active' : '')}
                  onClick={a.go} style={{ cursor: a.go ? 'pointer' : 'default' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flex: 'none', marginRight: 8 }} />
                  <span style={{ fontSize: 12 }}>{a.label}</span>
                  <span className="nav-count" style={{ background: 'transparent', color: a.color, fontWeight: 700 }}>{alerts[a.k] ?? 0}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="side-nav" style={{ marginTop: 'auto' }}>
          <button
            className={'nav-item' + (view === 'settings' ? ' active' : '')}
            onClick={() => setView('settings')}
            title="Settings (admin)"
          >
            <Icon name="settings" size={16} className="nav-icon" style={{ color: view === 'settings' ? 'var(--accent)' : 'var(--text-3)' }} />
            <span>Settings</span>
          </button>
        </div>

        <div className="side-foot">
          <div className="side-avatar">A</div>
          <div className="side-foot-meta">
            <div className="name">Studio admin</div>
            <div className="role">cuecreative.com</div>
          </div>
          <button className="icon-btn" style={{ width: 26, height: 26 }} title="Account">
            <Icon name="more" size={14} />
          </button>
        </div>
      </aside>

      <main className="main" style={{ gridTemplateRows: '4px calc(var(--hd-h) - 4px) 1fr' }}>
        <div className="wood" style={{ height: 4 }} />
        <header className="hd">
          <div>
            <div className="hd-title">{hd.title}</div>
            <div className="mono">{hd.sub}</div>
          </div>
          {activeClientName && (
            <div className="mono" style={{ marginLeft: 14, fontSize: 12, color: 'var(--ok)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap' }}>
              CLIENT · {activeClientName}
            </div>
          )}
          <div className="hd-spacer" />
          <div className="hd-search">
            <Icon name="search" size={14} />
            <input placeholder="Search clients, avatars, episodes…" />
            <span className="hd-kbd">⌘K</span>
          </div>
          <button className="icon-btn" title="Activity"><Icon name="history" size={16} /></button>
        </header>

        <section className="view" key={view + (view === 'client-detail' && detailClient ? ':' + detailClient.id : '')}>
          {view === 'clients' && (
            <ClientsView
              activeClientId={activeClientId}
              onSelect={setActiveClientId}
              onOpenClient={(c) => { setActiveClientId(c.id); setDetailClient(c); setView('client-detail'); }}
            />
          )}
          {view === 'brief' && <BriefView clientId={activeClientId} onSendTopicToScripts={(t) => { setScriptTopicRequest(t); setView('scripts'); }} />}
          {view === 'client-detail' && <ClientDetailView client={detailClient} onBack={() => setView('clients')} onOpenStudio={(clientId) => { setActiveClientId(clientId); goStudio(); }} onCastScript={(clientId, body, title, jobNumber, scriptId) => { setCastRequest({ clientId, body, title, jobNumber, scriptId }); setView('studio'); }} onSendTopicToScripts={(t) => { setScriptTopicRequest(t); setView('scripts'); }} />}
          {view === 'invitations' && <InvitationsView focusId={inviteFocus} onFocusConsumed={() => setInviteFocus(null)} />}
          {view === 'planner' && <PlannerView activeClientId={activeClientId} onBackToStudio={goStudio} onCastScript={(clientId, body, title, jobNumber, scriptId) => { setCastRequest({ clientId, body, title, jobNumber, scriptId }); setView('studio'); }} />}
          {view === 'scripts' && <ScriptsView activeClientId={activeClientId} onSelectClient={setActiveClientId} onBackToStudio={goStudio} topicRequest={scriptTopicRequest} onTopicConsumed={() => setScriptTopicRequest(null)} scriptRequest={scriptRequest} onScriptRequestConsumed={() => setScriptRequest(null)} onCastScript={(clientId, body, title, jobNumber, scriptId) => { setCastRequest({ clientId, body, title, jobNumber, scriptId }); setView('studio'); }} />}
          {view === 'studio' && <StudioView key={studioNonce} onNavigate={setView} castRequest={castRequest} onCastConsumed={() => setCastRequest(null)} activeClientId={activeClientId} onSelectClient={setActiveClientId} />}
          {view === 'episodes' && <EpisodesView activeClientId={activeClientId} onBackToStudio={goStudio} episodeRequest={episodeRequest} onEpisodeRequestConsumed={() => setEpisodeRequest(null)} />}
          {view === 'recordings' && <RecordingsView activeClientId={activeClientId} onBackToStudio={goStudio} onCastScript={(clientId, body, title, jobNumber, scriptId) => { setCastRequest({ clientId, body, title, jobNumber, scriptId }); setView('studio'); }} onCreateEpisode={(req) => { setEpisodeRequest(req); setView('episodes'); }} />}
          {view === 'onboarding' && (
            <OnboardingView
              onDone={() => setView('clients')}
              onCancel={() => setView('clients')}
            />
          )}
          {view === 'settings' && <SettingsView />}
          {view === 'changes' && <ChangesView onOpen={(clientId, targetView) => { setActiveClientId(clientId); setView(targetView); }} />}
          {view === 'attention' && <AttentionView onOpen={openAttentionItem} />}
          {view === 'billing' && <BillingView />}
        </section>
      </main>
    </div>
  );
}

export default App
