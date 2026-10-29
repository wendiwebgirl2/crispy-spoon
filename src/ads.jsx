import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './shared.jsx'
import { api } from './api.js'

// Ads — paid Meta + Google ads for every client, draft to wrap. Numbers are
// typed in from Ads Manager / Google Ads (nothing is pulled from the platforms).
// Data: voicecast routes/ads.js (ads + ad_accounts tables).

const inputStyle = {
  background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px',
  boxSizing: 'border-box', height: 38,
};
const fld = { ...inputStyle, width: '100%', height: undefined, fontFamily: 'inherit', fontSize: 14 };

const STATUSES = [['draft', 'Draft'], ['review', 'Client review'], ['live', 'Live'], ['paused', 'Paused'], ['ended', 'Ended']];
const STATUS_LABEL = Object.fromEntries(STATUSES);
const STATUS_TONE = { draft: '', review: 'warn', live: 'training', paused: '', ended: '' };
const PLABEL = { meta: 'Meta', google: 'Google' };
const PCOLOR = { meta: '#1f5fbf', google: '#3d7a34' };
const FORMATS = { meta: ['Image', 'Video', 'Carousel', 'Reel', 'Story', 'Lead form'], google: ['Search', 'Performance Max', 'Display', 'YouTube', 'Demand Gen'] };
const OBJECTIVES = ['Awareness', 'Traffic', 'Leads', 'Calls', 'Sales', 'Engagement'];
const DAY = 86400000;

const money = (n) => (n == null || isNaN(n) ? '—' : '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: n >= 1000 ? 0 : 2 }));
const fmtN = (n) => (n == null ? '—' : Number(n).toLocaleString());
const pct = (n) => (n == null || !isFinite(n) ? '—' : (n * 100).toFixed(2) + '%');
const parseDay = (s) => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = (s) => { const d = parseDay(s); return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''; };
// SQLite datetime('now') is UTC with no zone marker.
const stampMs = (t) => { if (!t) return null; const iso = String(t).replace(' ', 'T'); const d = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z'); return isNaN(d) ? null : d; };
const safeUrl = (u) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : null);
const ctr = (a) => (a.impressions ? (a.clicks || 0) / a.impressions : null);
const cpr = (a) => (a.results ? (a.spend || 0) / a.results : null);

// What needs a look, in plain words.
function flagsFor(a) {
  const out = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = parseDay(a.end_date);
  if (a.status === 'live' && end) {
    const d = Math.round((end - today) / DAY);
    if (d < 0) out.push('Past end date but still live');
    else if (d <= 7) out.push(d === 0 ? 'Ends today' : `Ends in ${d} day${d === 1 ? '' : 's'}`);
  }
  if (a.budget > 0 && a.spend > a.budget) out.push('Over budget by ' + money(a.spend - a.budget));
  const age = stampMs(a.updated_at) ? Math.floor((Date.now() - stampMs(a.updated_at)) / DAY) : 0;
  if (a.status === 'live' && age >= 7) out.push(`Numbers not updated in ${age} days`);
  if (a.status === 'review' && age >= 5) out.push(`Waiting on client ${age} days`);
  return out;
}

const PlatformBadge = ({ p }) => (
  <span className="badge" style={{ color: PCOLOR[p], borderColor: `color-mix(in srgb, ${PCOLOR[p]} 35%, transparent)`, background: `color-mix(in srgb, ${PCOLOR[p]} 8%, white)` }}>{PLABEL[p] || p}</span>
);
const StatusPill = ({ s }) => (
  <span className={'badge ' + (STATUS_TONE[s] || '')}><span className="dot" />{STATUS_LABEL[s] || s}</span>
);
function BudgetBar({ spend, budget }) {
  if (!(budget > 0)) return null;
  const r = (spend || 0) / budget;
  return (
    <div style={{ height: 5, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }} title={`${money(spend || 0)} of ${money(budget)}`}>
      <div style={{ height: '100%', width: Math.min(100, r * 100).toFixed(1) + '%', background: r > 1 ? 'var(--err)' : 'var(--gold)', borderRadius: 3 }} />
    </div>
  );
}
function Tile({ label, value, sub, alert }) {
  return (
    <div className="card card-pad" style={{ flex: '1 1 150px', minWidth: 140, borderColor: alert ? 'color-mix(in srgb, var(--maroon) 40%, transparent)' : undefined }}>
      <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, lineHeight: 1.1, color: alert ? 'var(--maroon)' : undefined }}>{value}</div>
      <div className="label" style={{ marginTop: 6 }}>{label}</div>
      {sub && <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
function Seg({ value, options, onChange }) {
  return (
    <div className="row" style={{ gap: 0, border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--surface)' }}>
      {options.map(([v, l], i) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          style={{ border: 0, borderLeft: i ? '1px solid var(--border)' : 0, height: 36, padding: '0 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: value === v ? 'var(--maroon)' : 'transparent', color: value === v ? '#fff' : 'var(--text-2)' }}>{l}</button>
      ))}
    </div>
  );
}
const Field = ({ label, full, children }) => (
  <label className="col" style={{ gap: 4, gridColumn: full ? '1 / -1' : undefined, minWidth: 0 }}>
    <span className="mono" style={{ color: 'var(--text-4)' }}>{label}</span>
    {children}
  </label>
);
// Portaled to <body> so the overlay covers the whole window, not just the scrolled view.
const Modal = ({ onClose, children, width = 640 }) => createPortal(
  <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.55)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 200, overflowY: 'auto' }}>
    <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: `min(${width}px, 96vw)`, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
      {children}
    </div>
  </div>,
  document.body
);

const BLANK = { platform: 'meta', name: '', campaign: '', format: 'Image', objective: 'Leads', status: 'draft', start_date: '', end_date: '', budget: '', spend: '', impressions: '', clicks: '', results: '', link: '', creative_link: '', notes: '' };

function AdModal({ ad, clients, onSave, onDelete, onClose }) {
  const [f, setF] = useState(() => {
    const base = { ...BLANK, ...(ad.id ? ad : {}), client_id: ad.client_id || (clients[0] && clients[0].id) || '' };
    for (const k of Object.keys(base)) if (base[k] == null) base[k] = '';
    if (!ad.id && ad.platform) { base.platform = ad.platform; base.format = FORMATS[ad.platform][0]; }
    return base;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [armed, setArmed] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setPlatform = (p) => setF((x) => ({ ...x, platform: p, format: FORMATS[p].includes(x.format) ? x.format : FORMATS[p][0] }));
  const save = async () => {
    if (!f.client_id) return setErr('Pick a client.');
    if (!f.name.trim()) return setErr('Give the ad a name.');
    if (f.start_date && f.end_date && f.end_date < f.start_date) return setErr('End date is before the start date.');
    setBusy(true); setErr('');
    try { await onSave(f); } catch (e) { setErr(e.message); setBusy(false); }
  };
  const del = async () => {
    if (!armed) return setArmed(true);
    setBusy(true);
    try { await onDelete(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal onClose={onClose}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: 'var(--f-display)', fontSize: 24, lineHeight: 1.1 }}>{ad.id ? 'Edit ad' : 'New ad'}</div>
        <div className="row" style={{ gap: 12, fontSize: 13 }}>
          {ad.id && safeUrl(ad.link) && <a href={ad.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--maroon)', textDecoration: 'underline' }}>{ad.platform === 'meta' ? 'Open in Ads Manager' : 'Open in Google Ads'}</a>}
          {ad.id && safeUrl(ad.creative_link) && <a href={ad.creative_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--maroon)', textDecoration: 'underline' }}>Creative</a>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <Field label="Client">
          <select value={f.client_id} onChange={(e) => setF((x) => ({ ...x, client_id: Number(e.target.value) }))} style={fld}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Platform"><Seg value={f.platform} options={[['meta', 'Meta'], ['google', 'Google']]} onChange={setPlatform} /></Field>
        <Field label="Ad name" full><input value={f.name} onChange={set('name')} maxLength={200} placeholder="Fall open house, 30s video" style={fld} /></Field>
        <Field label="Campaign"><input value={f.campaign} onChange={set('campaign')} maxLength={200} style={fld} /></Field>
        <Field label="Format">
          <select value={f.format} onChange={set('format')} style={fld}>{FORMATS[f.platform].map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Objective">
          <select value={f.objective} onChange={set('objective')} style={fld}>{OBJECTIVES.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Status">
          <select value={f.status} onChange={set('status')} style={fld}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
        <Field label="Start date"><input type="date" value={f.start_date} onChange={set('start_date')} style={fld} /></Field>
        <Field label="End date"><input type="date" value={f.end_date} onChange={set('end_date')} style={fld} /></Field>
        <Field label="Flight budget ($)"><input type="number" min="0" step="0.01" inputMode="decimal" value={f.budget} onChange={set('budget')} style={fld} /></Field>
        <Field label="Spend to date ($)"><input type="number" min="0" step="0.01" inputMode="decimal" value={f.spend} onChange={set('spend')} style={fld} /></Field>
        <Field label="Impressions"><input type="number" min="0" step="1" inputMode="numeric" value={f.impressions} onChange={set('impressions')} style={fld} /></Field>
        <Field label="Clicks"><input type="number" min="0" step="1" inputMode="numeric" value={f.clicks} onChange={set('clicks')} style={fld} /></Field>
        <Field label="Results (leads, calls, sales)"><input type="number" min="0" step="1" inputMode="numeric" value={f.results} onChange={set('results')} style={fld} /></Field>
        <Field label="Ads Manager / Google Ads link"><input type="url" value={f.link} onChange={set('link')} placeholder="https://" style={fld} /></Field>
        <Field label="Creative link (Drive, Frame, etc.)" full><input type="url" value={f.creative_link} onChange={set('creative_link')} placeholder="https://" style={fld} /></Field>
        <Field label="Notes" full><textarea value={f.notes} onChange={set('notes')} rows={3} maxLength={4000} style={{ ...fld, resize: 'vertical' }} /></Field>
      </div>
      {ad.id && (ad.updated_by || ad.created_by) && <div className="mono" style={{ color: 'var(--text-4)' }}>Last edited by {ad.updated_by || ad.created_by}</div>}
      {err && <div style={{ color: 'var(--err)', fontSize: 13 }}>{err}</div>}
      <div className="row between" style={{ borderTop: '1px solid var(--border)', paddingTop: 14, flexWrap: 'wrap', gap: 8 }}>
        {ad.id
          ? <button className="btn sm" onClick={del} disabled={busy} style={armed ? { background: 'var(--err)', color: '#fff', borderColor: 'transparent' } : { color: 'var(--err)' }}>{armed ? 'Click again to delete' : 'Delete ad'}</button>
          : <span />}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary sm" onClick={save} disabled={busy}><Icon name="check" size={12} /> {busy ? 'Saving…' : 'Save ad'}</button>
        </div>
      </div>
    </Modal>
  );
}

function AccountModal({ client, account, onSave, onClose }) {
  const [f, setF] = useState(() => {
    const a = account || {};
    return { meta_account: a.meta_account || '', google_account: a.google_account || '', monthly_budget: a.monthly_budget == null ? '' : a.monthly_budget, contact: a.contact || '', notes: a.notes || '' };
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => { setBusy(true); setErr(''); try { await onSave(f); } catch (e) { setErr(e.message); setBusy(false); } };
  return (
    <Modal onClose={onClose} width={520}>
      <div className="label">Ad accounts · {client.name}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Field label="Meta ad account ID"><input value={f.meta_account} onChange={set('meta_account')} maxLength={60} placeholder="act_1234567890" style={fld} /></Field>
        <Field label="Google Ads customer ID"><input value={f.google_account} onChange={set('google_account')} maxLength={60} placeholder="123-456-7890" style={fld} /></Field>
        <Field label="Monthly ad budget ($)"><input type="number" min="0" step="1" inputMode="decimal" value={f.monthly_budget} onChange={set('monthly_budget')} style={fld} /></Field>
        <Field label="Ads contact"><input value={f.contact} onChange={set('contact')} maxLength={200} style={fld} /></Field>
        <Field label="Notes" full><textarea value={f.notes} onChange={set('notes')} rows={3} maxLength={4000} style={{ ...fld, resize: 'vertical' }} /></Field>
      </div>
      {err && <div style={{ color: 'var(--err)', fontSize: 13 }}>{err}</div>}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn sm" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn primary sm" onClick={save} disabled={busy}><Icon name="check" size={12} /> {busy ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}

function AdCard({ a, clientName, onOpen }) {
  const flags = flagsFor(a);
  const dates = [fmtDay(a.start_date), fmtDay(a.end_date)].filter(Boolean).join(' – ');
  return (
    <button type="button" onClick={onOpen} className="card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', cursor: 'pointer', width: '100%', borderRadius: 'var(--r-sm)' }}>
      <div className="row between" style={{ gap: 6 }}>
        <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{clientName}</span>
        {a.status === 'live' && <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: '#fff', background: 'var(--maroon)', padding: '2px 6px', borderRadius: 3 }}>ON AIR</span>}
      </div>
      <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{a.name}</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-4)' }}>
        <PlatformBadge p={a.platform} />{a.format && <span>{a.format}</span>}{dates && <span>· {dates}</span>}
      </div>
      {a.budget > 0 && (
        <div className="row between mono" style={{ fontSize: 11 }}><span>{money(a.spend || 0)} spent</span><span>of {money(a.budget)}</span></div>
      )}
      <BudgetBar spend={a.spend} budget={a.budget} />
      {flags.length > 0 && <div className="mono" style={{ fontSize: 11, color: 'var(--maroon)' }}>{flags[0]}</div>}
    </button>
  );
}

const COLS = [
  ['client', 'Client'], ['name', 'Ad'], ['platform', 'Platform'], ['status', 'Status'], ['start_date', 'Start'], ['end_date', 'End'],
  ['budget', 'Budget', 1], ['spend', 'Spend', 1], ['impressions', 'Impr.', 1], ['clicks', 'Clicks', 1], ['ctr', 'CTR', 1], ['results', 'Results', 1], ['cpr', 'Cost/result', 1],
];

const AdsView = () => {
  const [clients, setClients] = useState([]);
  const [ads, setAds] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [fClient, setFClient] = useState('');
  const [fPlatform, setFPlatform] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('board');
  const [sort, setSort] = useState({ key: 'updated_at', dir: -1 });
  const [editing, setEditing] = useState(null);
  const [acctFor, setAcctFor] = useState(null);

  const load = () => {
    setErr('');
    return Promise.all([api.listClients(), api.listAds()])
      .then(([cs, d]) => {
        const list = Array.isArray(cs) ? cs : (cs.clients || []);
        setClients([...list].sort((a, b) => String(a.name).localeCompare(String(b.name))));
        setAds(d.ads || []); setAccounts(d.accounts || []);
      })
      .catch((e) => setErr(e.message || 'Could not load ads.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 2600); return () => clearTimeout(t); }, [msg]);

  const nameOf = (id) => (clients.find((c) => c.id === id) || {}).name || 'Unknown client';
  const accountOf = (id) => accounts.find((a) => a.client_id === id);
  const needle = q.trim().toLowerCase();
  const matches = (a, ignoreStatus) => (!fClient || a.client_id === Number(fClient)) && (!fPlatform || a.platform === fPlatform)
    && (ignoreStatus || !fStatus || a.status === fStatus)
    && (!needle || [a.name, a.campaign, a.notes, a.format, nameOf(a.client_id)].join(' ').toLowerCase().includes(needle));
  const shown = ads.filter((a) => matches(a, false));

  // summary over what the filters show
  const live = shown.filter((a) => a.status === 'live');
  const liveMeta = live.filter((a) => a.platform === 'meta').length;
  const sum = (k) => shown.reduce((s, a) => s + (Number(a[k]) || 0), 0);
  const spend = sum('spend'), budget = sum('budget'), impr = sum('impressions'), clicks = sum('clicks'), results = sum('results');
  const attention = shown.flatMap((a) => flagsFor(a).map((f) => ({ a, f })));

  const saveAd = async (f) => {
    const payload = { ...f };
    if (editing.id) await api.updateAd(editing.client_id, editing.id, payload);
    else await api.createAd(f.client_id, payload);
    setEditing(null); setMsg(editing.id ? 'Ad saved.' : 'Ad added.'); load();
  };
  const deleteAd = async () => { await api.deleteAd(editing.client_id, editing.id); setEditing(null); setMsg('Ad deleted.'); load(); };
  const saveAccount = async (f) => { await api.saveAdAccount(acctFor.id, f); setAcctFor(null); setMsg('Ad accounts saved.'); load(); };
  const newAd = (clientId) => setEditing({ client_id: clientId || (fClient ? Number(fClient) : undefined), platform: fPlatform || undefined });

  const val = (a, k) => k === 'client' ? nameOf(a.client_id) : k === 'ctr' ? ctr(a) : k === 'cpr' ? cpr(a) : k === 'status' ? STATUSES.findIndex((s) => s[0] === a.status) : a[k];
  const sorted = [...shown].sort((x, y) => {
    const a = val(x, sort.key), b = val(y, sort.key);
    if (a == null && b == null) return 0; if (a == null || a === '') return 1; if (b == null || b === '') return -1;
    return (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))) * sort.dir;
  });
  const sortBy = (k) => setSort((s) => (s.key === k ? { key: k, dir: -s.dir } : { key: k, dir: 1 }));

  if (loading) return <div className="v-pad"><div className="mono" style={{ color: 'var(--text-4)' }}>Loading ads…</div></div>;

  return (
    <div className="v-pad fade-in col" style={{ gap: 16 }}>
      <div className="row between" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 26, letterSpacing: '-0.01em', margin: '0 0 4px', fontWeight: 400 }}>
            <em style={{ color: 'var(--accent)' }}>Ads</em> — Meta + Google
          </h1>
          <div className="mono" style={{ color: 'var(--text-4)' }}>Numbers are entered by hand from Ads Manager and Google Ads. Update spend and results on live ads at least weekly.</div>
        </div>
        <button className="btn primary" onClick={() => newAd()} disabled={!clients.length}><Icon name="plus" size={14} /> New ad</button>
      </div>

      {err && <div className="card card-pad" style={{ color: 'var(--err)' }}>{err} <button className="btn sm" style={{ marginLeft: 8 }} onClick={load}>Try again</button></div>}

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <Tile label="Live ads" value={live.length} sub={`Meta ${liveMeta} · Google ${live.length - liveMeta}`} />
        <Tile label="Spend tracked" value={money(spend)} sub={budget ? `of ${money(budget)} in flight budgets` : null} />
        <Tile label="CTR" value={impr ? pct(clicks / impr) : '—'} sub={impr ? `${fmtN(clicks)} clicks / ${fmtN(impr)} impr.` : null} />
        <Tile label="Cost per result" value={results ? money(spend / results) : '—'} sub={results ? `${fmtN(results)} results` : null} />
        <Tile label="Needs attention" value={new Set(attention.map((x) => x.a.id)).size} sub="ending soon, over budget, stale" alert={attention.length > 0} />
      </div>

      <div className="card card-pad">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={fClient} onChange={(e) => setFClient(e.target.value)} style={{ ...inputStyle, minWidth: 200 }} aria-label="Client">
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Seg value={fPlatform} options={[['', 'All'], ['meta', 'Meta'], ['google', 'Google']]} onChange={setFPlatform} />
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={inputStyle} aria-label="Status">
            <option value="">Any status</option>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ads, campaigns, notes" aria-label="Search" style={{ ...inputStyle, flex: '1 1 200px', minWidth: 0 }} />
          <Seg value={mode} options={[['board', 'Board'], ['table', 'Table']]} onChange={setMode} />
        </div>
      </div>

      {attention.length > 0 && (
        <div className="card card-pad" style={{ borderLeft: '3px solid var(--maroon)' }}>
          <div className="label" style={{ marginBottom: 8 }}>Needs attention</div>
          <div className="col" style={{ gap: 6 }}>
            {attention.slice(0, 12).map(({ a, f }, i) => (
              <div key={a.id + ':' + i} className="row" style={{ gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
                <PlatformBadge p={a.platform} />
                <button type="button" onClick={() => setEditing(a)} style={{ background: 'none', border: 0, padding: 0, color: 'var(--maroon)', cursor: 'pointer', fontWeight: 500, textAlign: 'left' }}>{nameOf(a.client_id)} · {a.name}</button>
                <span className="mono" style={{ color: 'var(--text-4)' }}>{f}</span>
              </div>
            ))}
            {attention.length > 12 && <div className="mono" style={{ color: 'var(--text-4)' }}>+{attention.length - 12} more</div>}
          </div>
        </div>
      )}

      {!clients.length ? (
        <div className="card card-pad" style={{ borderStyle: 'dashed' }}>
          <div className="label" style={{ marginBottom: 6 }}>ADS</div>
          <div className="mono" style={{ color: 'var(--text-3)' }}>Add a client on the Clients page first, then log their ads here.</div>
        </div>
      ) : !ads.length ? (
        <div className="card card-pad" style={{ borderStyle: 'dashed', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--f-display)', fontSize: 22, marginBottom: 6 }}>No ads yet</div>
          <div className="mono" style={{ color: 'var(--text-3)', marginBottom: 12 }}>Log each Meta or Google ad you run for a client: status, dates, budget, and results.</div>
          <button className="btn primary" onClick={() => newAd()}><Icon name="plus" size={14} /> New ad</button>
        </div>
      ) : mode === 'board' ? (
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(230px, 1fr))', gap: 12, minWidth: 1200 }}>
            {STATUSES.map(([s]) => {
              const list = ads.filter((a) => a.status === s && matches(a, true)).sort((x, y) => String(x.end_date || '9').localeCompare(String(y.end_date || '9')));
              return (
                <div key={s} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
                  <div className="row between" style={{ padding: '2px 4px 4px' }}>
                    <StatusPill s={s} />
                    <span style={{ fontFamily: 'var(--f-display)', fontSize: 22, lineHeight: 1, color: 'var(--text-2)' }}>{list.length}</span>
                  </div>
                  {list.length ? list.map((a) => <AdCard key={a.id} a={a} clientName={nameOf(a.client_id)} onOpen={() => setEditing(a)} />)
                    : <div className="mono" style={{ color: 'var(--text-4)', padding: '6px 4px' }}>{s === 'live' ? 'Nothing on air.' : 'None'}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
            <thead>
              <tr>
                {COLS.map(([k, l, r]) => (
                  <th key={k} onClick={() => sortBy(k)} className="label" aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}
                    style={{ padding: '10px 12px', textAlign: r ? 'right' : 'left', whiteSpace: 'nowrap', cursor: 'pointer', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', color: sort.key === k ? 'var(--maroon)' : undefined, fontWeight: 500 }}>
                    {l}{sort.key === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length ? sorted.map((a) => {
                const td = (v, r, extra) => <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textAlign: r ? 'right' : 'left', ...(r ? { fontFamily: 'var(--f-mono)', fontSize: 12.5 } : {}), ...extra }}>{v}</td>;
                return (
                  <tr key={a.id} onClick={() => setEditing(a)} style={{ cursor: 'pointer' }}>
                    {td(nameOf(a.client_id))}
                    {td(a.name, false, { whiteSpace: 'normal', minWidth: 180, fontWeight: 600 })}
                    {td(<PlatformBadge p={a.platform} />)}
                    {td(<StatusPill s={a.status} />)}
                    {td(fmtDay(a.start_date) || '—', false, { fontFamily: 'var(--f-mono)', fontSize: 12.5 })}
                    {td(fmtDay(a.end_date) || '—', false, { fontFamily: 'var(--f-mono)', fontSize: 12.5 })}
                    {td(money(a.budget), true)}{td(money(a.spend), true)}{td(fmtN(a.impressions), true)}{td(fmtN(a.clicks), true)}
                    {td(pct(ctr(a)), true)}{td(fmtN(a.results), true)}{td(cpr(a) == null ? '—' : money(cpr(a)), true)}
                  </tr>
                );
              }) : <tr><td colSpan={COLS.length} className="mono" style={{ padding: 14, color: 'var(--text-4)' }}>No ads match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {clients.length > 0 && (
        <div className="col" style={{ gap: 12 }}>
          <div className="row between">
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 22, fontWeight: 400, margin: 0 }}><em style={{ color: 'var(--accent)' }}>Clients</em></h2>
            <span className="mono" style={{ color: 'var(--text-4)' }}>{clients.length} client{clients.length === 1 ? '' : 's'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {clients.map((c) => {
              const mine = ads.filter((a) => a.client_id === c.id);
              const cl = mine.filter((a) => a.status === 'live');
              const active = mine.filter((a) => a.status !== 'ended');
              const sp = active.reduce((s, a) => s + (Number(a.spend) || 0), 0);
              const bu = active.reduce((s, a) => s + (Number(a.budget) || 0), 0);
              const acct = accountOf(c.id) || {};
              return (
                <div key={c.id} className="card card-pad col" style={{ gap: 10, minWidth: 0 }}>
                  <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontFamily: 'var(--f-display)', fontSize: 20, lineHeight: 1.15 }}>{c.name}</div>
                    <button className="btn sm" onClick={() => setAcctFor(c)}>Ad accounts</button>
                  </div>
                  <div className="row" style={{ gap: 12, flexWrap: 'wrap', fontSize: 12.5 }}>
                    <span><span style={{ fontFamily: 'var(--f-display)', fontSize: 18 }}>{cl.length}</span> live</span>
                    <span style={{ color: PCOLOR.meta }}>Meta {cl.filter((a) => a.platform === 'meta').length}</span>
                    <span style={{ color: PCOLOR.google }}>Google {cl.filter((a) => a.platform === 'google').length}</span>
                    <span style={{ color: 'var(--text-4)' }}>{mine.length} total</span>
                  </div>
                  {bu > 0 && (
                    <div className="col" style={{ gap: 4 }}>
                      <div className="row between mono" style={{ fontSize: 11 }}><span>{money(sp)} spent</span><span>of {money(bu)} active budgets</span></div>
                      <BudgetBar spend={sp} budget={bu} />
                    </div>
                  )}
                  {acct.monthly_budget != null && <div className="mono" style={{ color: 'var(--text-4)' }}>Monthly ad budget {money(acct.monthly_budget)}</div>}
                  {(acct.meta_account || acct.google_account) && (
                    <div className="mono" style={{ color: 'var(--text-4)', display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 8, borderTop: '1px solid var(--border)', overflowWrap: 'anywhere' }}>
                      {acct.meta_account && <span>Meta {acct.meta_account}</span>}
                      {acct.google_account && <span>Google {acct.google_account}</span>}
                    </div>
                  )}
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn sm" onClick={() => setFClient(String(c.id))}>Show ads</button>
                    <button className="btn sm" onClick={() => newAd(c.id)}><Icon name="plus" size={12} /> New ad</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing && <AdModal ad={editing} clients={clients} onSave={saveAd} onDelete={deleteAd} onClose={() => setEditing(null)} />}
      {acctFor && <AccountModal client={acctFor} account={accountOf(acctFor.id)} onSave={saveAccount} onClose={() => setAcctFor(null)} />}
      {msg && <div style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', background: 'var(--text)', color: '#fff', padding: '10px 16px', borderRadius: 'var(--r-sm)', fontSize: 13, fontWeight: 500, zIndex: 250 }}>{msg}</div>}
    </div>
  );
};

export { AdsView };
