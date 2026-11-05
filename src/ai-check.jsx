import React, { useState, useEffect, useRef } from 'react'
import { Icon } from './shared.jsx'
import { api } from './api.js'

// AI Visibility — asks ChatGPT, Claude, Perplexity, Gemini and Grok (live web
// search on) the questions a client's customers ask, and measures whether the
// answers mention the client and cite the client's own sites. Each run is saved
// so visibility can be tracked over time. Data: voicecast lib/aiCheck.js.

const inputStyle = {
  background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px',
  boxSizing: 'border-box',
};
const ECOLOR = { chatgpt: '#10a37f', claude: '#d97757', perplexity: '#20b8cd', gemini: '#4a90d6', grok: '#9aa0a6' };
const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
const fmtWhen = (s) => {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z'));
  return isNaN(d.getTime()) ? String(s) : d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

function Tile({ label, value, sub }) {
  return (
    <div className="card card-pad" style={{ flex: '1 1 150px', minWidth: 140 }}>
      <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, lineHeight: 1.1 }}>{value}</div>
      <div className="label" style={{ marginTop: 6 }}>{label}</div>
      {sub && <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Dot({ engine }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ECOLOR[engine] || 'var(--text-4)', flex: 'none' }} />;
}

// Visibility % per finished run, oldest to newest.
function Trend({ checks }) {
  const runs = checks.filter((c) => c.status === 'done' && c.summary).slice().reverse();
  if (runs.length < 2) return <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>The trend fills in after two or more checks. Run one every week or two.</div>;
  const W = 100 / runs.length;
  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 110, display: 'block' }} role="img" aria-label="AI visibility per check">
        {runs.map((c, i) => {
          const v = Number(c.summary.overall.visibility) || 0;
          const h = (v / 100) * 38;
          return <rect key={c.id} x={i * W + W * 0.2} y={40 - h} width={W * 0.6} height={Math.max(h, 0.4)} fill="var(--accent-2, #fbb033)"><title>{`${fmtWhen(c.startedAt)}: ${v}% visible`}</title></rect>;
        })}
      </svg>
      <div className="row mono" style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
        <span>{fmtWhen(runs[0].startedAt)}</span><span>% of answers that mention or cite the client</span><span>{fmtWhen(runs[runs.length - 1].startedAt)}</span>
      </div>
    </div>
  );
}

function ResultRow({ r, label }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '7px 0' }}>
      <div className="row" style={{ gap: 10, alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap' }} onClick={() => setOpen((v) => !v)}>
        <Dot engine={r.engine} />
        <strong style={{ minWidth: 86, fontSize: 13 }}>{label}</strong>
        {r.error ? (
          <span className="mono" style={{ fontSize: 12, color: 'var(--warn)' }}>error: {r.error}</span>
        ) : (
          <>
            <span className="mono" style={{ fontSize: 12, color: r.mentioned ? 'var(--ok)' : 'var(--text-4)' }}>{r.mentioned ? '✓ mentioned' : '✗ not mentioned'}</span>
            <span className="mono" style={{ fontSize: 12, color: r.cited ? 'var(--ok)' : 'var(--text-4)' }}>{r.cited ? `✓ cited${r.citeRank ? ` (#${r.citeRank} source)` : ''}` : '✗ not cited'}</span>
            {r.competitors.length > 0 && <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>also named: {r.competitors.join(', ')}</span>}
          </>
        )}
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-4)' }}>{open ? 'hide' : 'show answer'}</span>
      </div>
      {open && !r.error && (
        <div style={{ margin: '8px 0 4px 18px' }}>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, color: 'var(--text-2, var(--text))', maxHeight: 320, overflowY: 'auto', background: 'var(--surface-2)', padding: 10, borderRadius: 'var(--r-sm)' }}>{r.answer}</div>
          {r.citations.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="label" style={{ marginBottom: 4 }}>SOURCES</div>
              {r.citations.map((c, i) => {
                const own = r.clientUrls.includes(c.url);
                return (
                  <div key={i} className="mono" style={{ fontSize: 12, marginBottom: 2 }}>
                    {i + 1}. <a href={c.url} target="_blank" rel="noreferrer" style={{ color: own ? 'var(--ok)' : 'var(--text-3)', fontWeight: own ? 700 : 400 }}>{c.title || host(c.url)}</a>
                    <span style={{ color: 'var(--text-4)' }}> · {host(c.url)}{own ? ' · client' : ''}</span>
                  </div>
                );
              })}
            </div>
          )}
          {r.model && <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6 }}>model {r.model}{r.searches != null ? ` · ${r.searches} search${r.searches === 1 ? '' : 'es'}` : ''}</div>}
        </div>
      )}
    </div>
  );
}

const AiCheckView = ({ activeClientId, onSelectClient }) => {
  const cid = activeClientId;
  const [clientList, setClientList] = useState([]);
  const [ov, setOv] = useState(null);
  const [view, setView] = useState(null); // { check, results } being shown
  const [pick, setPick] = useState({}); // engine id -> selected
  const [cfg, setCfg] = useState(null);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [newQ, setNewQ] = useState('');
  const [sugg, setSugg] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const poll = useRef(null);

  useEffect(() => { api.listClients().then((cs) => setClientList(Array.isArray(cs) ? cs : (cs.clients || []))).catch(() => setClientList([])); }, []);

  const apply = (o) => {
    setOv(o);
    setCfg((c) => (c && c._cid === cid ? c : { ...o.config, _cid: cid }));
    setPick((p) => (Object.keys(p).length ? p : Object.fromEntries(o.engines.map((e) => [e.id, e.configured]))));
    setView((v) => (v && o.checks.some((c) => c.id === v.check.id) && v.check.status !== 'running' ? v : o.latest));
    if (!o.config.saved && !o.prompts.length) setCfgOpen(true);
  };
  const load = () => {
    if (cid == null) return Promise.resolve();
    setErr('');
    return api.aiCheck(cid).then(apply).catch((e) => setErr(e.message || 'Could not load.'));
  };
  useEffect(() => { setOv(null); setView(null); setPick({}); setCfg(null); setSugg([]); setMsg(''); load(); }, [cid]);

  // Poll while a check is running.
  const runningId = view && view.check.status === 'running' ? view.check.id : null;
  useEffect(() => {
    clearInterval(poll.current);
    if (!runningId) return undefined;
    poll.current = setInterval(() => {
      api.aiCheckResult(cid, runningId).then((v) => {
        setView(v);
        if (v.check.status !== 'running') { clearInterval(poll.current); load(); }
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(poll.current);
  }, [runningId, cid]);

  const act = async (key, fn, okMsg) => {
    setBusy(key); setErr(''); setMsg('');
    try { const r = await fn(); if (okMsg) setMsg(okMsg); return r; }
    catch (e) { setErr(e.message); return null; }
    finally { setBusy(''); }
  };

  const clientPicker = (
    <select value={cid || ''} onChange={(e) => { const id = Number(e.target.value); if (id && onSelectClient) onSelectClient(id); }} style={{ ...inputStyle, minWidth: 220, height: 38 }}>
      <option value="">Pick a client…</option>
      {clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );

  if (cid == null) {
    return (
      <div className="v-pad">
        <div className="card card-pad" style={{ borderStyle: 'dashed' }}>
          <div className="label" style={{ marginBottom: 6 }}>AI VISIBILITY</div>
          <div className="mono" style={{ color: 'var(--text-3)', marginBottom: 10 }}>AI checks are per client — pick one.</div>
          {clientPicker}
        </div>
      </div>
    );
  }
  if (!ov) return <div className="v-pad"><div className="mono">{err || 'Loading…'}</div></div>;

  const clientName = (clientList.find((c) => c.id === cid) || {}).name || ov.config.clientName || '';
  const labelOf = Object.fromEntries(ov.engines.map((e) => [e.id, e.label]));
  const activeQs = ov.prompts.filter((p) => p.active).length;
  const chosen = ov.engines.filter((e) => e.configured && pick[e.id]).map((e) => e.id);
  const calls = Math.min(activeQs, ov.maxPrompts) * chosen.length;
  const s = view && view.check.summary;
  const o = s && s.overall;
  const isRunning = view && view.check.status === 'running';

  const run = () => act('run', async () => {
    const r = await api.runAiCheck(cid, { engines: chosen });
    const v = await api.aiCheckResult(cid, r.checkId);
    setView(v);
    const o2 = await api.aiCheck(cid); setOv(o2);
  });
  const saveCfg = () => act('cfg', async () => {
    const r = await api.saveAiCheckConfig(cid, { brands: cfg.brands, domains: cfg.domains, competitors: cfg.competitors, location: cfg.location });
    setCfg({ ...r.config, _cid: cid }); setCfgOpen(false); await load();
  }, 'Settings saved. They apply to the next check.');
  const addQs = (texts) => act('add', async () => { apply(await api.addAiPrompts(cid, texts)); setNewQ(''); setSugg((x) => x.filter((t) => !texts.includes(t))); });
  const suggest = () => act('sugg', async () => { const r = await api.suggestAiPrompts(cid); setSugg(r.suggestions || []); if (!(r.suggestions || []).length) setMsg('No suggestions came back — try adding more to the Brief.'); });

  // Results grouped by question.
  const byQ = [];
  if (view) {
    const m = new Map();
    for (const r of view.results) {
      const k = r.promptId || r.prompt;
      if (!m.has(k)) { m.set(k, { prompt: r.prompt, rows: [] }); byQ.push(m.get(k)); }
      m.get(k).rows.push(r);
    }
  }

  return (
    <div className="v-pad fade-in">
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 26, letterSpacing: '-0.01em', margin: '0 0 4px' }}>
        <em style={{ color: 'var(--accent)' }}>AI Visibility</em>{clientName ? ` — ${clientName}` : ''}
      </h1>
      <div className="mono" style={{ color: 'var(--text-4)', marginBottom: 16 }}>
        Asks each AI assistant (with live web search) the questions customers ask, then checks whether the answer names {clientName || 'the client'} and cites their own sites.
      </div>

      {/* run */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {clientPicker}
          {ov.engines.map((e) => (
            <label key={e.id} className="row mono" title={e.configured ? `model ${e.model}${e.via ? ` via ${e.via}` : ''}` : `Add ${e.keyName} to the server env file to turn this on`}
              style={{ gap: 6, alignItems: 'center', fontSize: 12, opacity: e.configured ? 1 : 0.45, cursor: e.configured ? 'pointer' : 'not-allowed', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '6px 9px' }}>
              <input type="checkbox" disabled={!e.configured || isRunning} checked={!!(e.configured && pick[e.id])} onChange={(ev) => setPick((p) => ({ ...p, [e.id]: ev.target.checked }))} />
              <Dot engine={e.id} /> {e.label}{e.via && <span style={{ color: 'var(--text-4)' }}> · via {e.via}</span>}{!e.configured && ' (not set up)'}
            </label>
          ))}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <button className="btn primary sm" disabled={!!busy || isRunning || !calls} onClick={run} style={{ opacity: busy || isRunning || !calls ? 0.6 : 1 }}>
            <Icon name="sparkle" size={12} /> {isRunning ? 'Check running…' : busy === 'run' ? 'Starting…' : 'Run AI check'}
          </button>
          <button className="btn sm" onClick={() => setCfgOpen((v) => !v)}><Icon name="sliders" size={12} /> Brand, sites & competitors</button>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>
            {calls ? `${Math.min(activeQs, ov.maxPrompts)} question${activeQs === 1 ? '' : 's'} × ${chosen.length} AI${chosen.length === 1 ? '' : 's'} = ${calls} answers` : !activeQs ? 'Add questions below first.' : 'Pick at least one AI.'}
            {activeQs > ov.maxPrompts ? ` (first ${ov.maxPrompts} questions only)` : ''}
          </span>
        </div>
        {isRunning && (
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${view.check.total ? Math.round((view.check.done / view.check.total) * 100) : 0}%`, background: 'var(--accent-2, #fbb033)', transition: 'width .4s' }} />
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{view.check.done} of {view.check.total} answers in — you can leave this page, it keeps running.</div>
          </div>
        )}
        {cfgOpen && cfg && (
          <div className="col" style={{ gap: 10, marginTop: 14, maxWidth: 720 }}>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <label className="col" style={{ gap: 4, flex: '1 1 220px' }}>
                <span className="label">BRAND NAMES <span style={{ color: 'var(--text-4)' }}>· one per line — any of these counts as a mention</span></span>
                <textarea className="textarea" value={cfg.brands} onChange={(e) => setCfg({ ...cfg, brands: e.target.value })} style={{ minHeight: 70, fontSize: 13 }} />
              </label>
              <label className="col" style={{ gap: 4, flex: '1 1 220px' }}>
                <span className="label">CLIENT'S OWN SITES <span style={{ color: 'var(--text-4)' }}>· domains, one per line</span></span>
                <textarea className="textarea" value={cfg.domains} onChange={(e) => setCfg({ ...cfg, domains: e.target.value })} placeholder="example.com" style={{ minHeight: 70, fontSize: 13 }} />
              </label>
            </div>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <label className="col" style={{ gap: 4, flex: '1 1 220px' }}>
                <span className="label">COMPETITORS <span style={{ color: 'var(--text-4)' }}>· names, one per line</span></span>
                <textarea className="textarea" value={cfg.competitors} onChange={(e) => setCfg({ ...cfg, competitors: e.target.value })} style={{ minHeight: 70, fontSize: 13 }} />
              </label>
              <label className="col" style={{ gap: 4, flex: '1 1 220px' }}>
                <span className="label">SEARCH AS IF IN <span style={{ color: 'var(--text-4)' }}>· e.g. Knoxville, TN</span></span>
                <input value={cfg.location} onChange={(e) => setCfg({ ...cfg, location: e.target.value })} placeholder="City, State" style={{ ...inputStyle, height: 38 }} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>YouTube/Facebook links to the client's own posts always count as their sources.</span>
              </label>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn primary sm" disabled={!!busy} onClick={saveCfg}><Icon name="check" size={12} /> Save settings</button>
              <button className="btn sm" onClick={() => setCfgOpen(false)}>Close</button>
            </div>
          </div>
        )}
        {msg && <div className="mono" style={{ marginTop: 10, fontSize: 12, color: 'var(--ok)' }}>{msg}</div>}
        {err && <div className="mono" style={{ marginTop: 10, fontSize: 12, color: 'var(--warn)' }}>{err}</div>}
      </div>

      {/* scores */}
      {o && (
        <>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <Tile label="AI visibility" value={pct(o.visibility)} sub={`${o.answers} answers${isRunning ? ' so far' : ''}`} />
            <Tile label="Mentioned" value={pct(o.mentionRate)} sub={`${o.mentioned} of ${o.answers} answers name the client`} />
            <Tile label="Cited as a source" value={pct(o.citeRate)} sub={`${o.cited} of ${o.answers} link the client's sites`} />
            <Tile label="Avg source position" value={o.avgRank == null ? '—' : `#${o.avgRank}`} sub="when cited (1 = top source)" />
            <Tile label="Share of voice" value={pct(o.shareOfVoice)} sub="client vs listed competitors" />
          </div>

          <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'stretch', marginBottom: 16 }}>
            <div className="card card-pad" style={{ flex: '1 1 320px', overflowX: 'auto' }}>
              <div className="label" style={{ marginBottom: 10 }}>BY AI ASSISTANT</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr className="mono" style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px 8px 0' }}>AI</th><th style={{ padding: '4px 8px 8px', textAlign: 'right' }}>Visible</th>
                    <th style={{ padding: '4px 8px 8px', textAlign: 'right' }}>Mentioned</th><th style={{ padding: '4px 8px 8px', textAlign: 'right' }}>Cited</th>
                    <th style={{ padding: '4px 0 8px 8px', textAlign: 'right' }}>Avg pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(s.byEngine).map(([id, b]) => (
                    <tr key={id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 8px 7px 0', whiteSpace: 'nowrap' }}><span className="row" style={{ gap: 6, alignItems: 'center' }}><Dot engine={id} />{labelOf[id] || id}</span>
                        {b.errors > 0 && <span className="mono" style={{ fontSize: 11, color: 'var(--warn)' }}>{b.errors} error{b.errors === 1 ? '' : 's'}</span>}</td>
                      <td className="mono" style={{ padding: '7px 8px', textAlign: 'right' }}>{pct(b.visibility)}</td>
                      <td className="mono" style={{ padding: '7px 8px', textAlign: 'right' }}>{pct(b.mentionRate)}</td>
                      <td className="mono" style={{ padding: '7px 8px', textAlign: 'right' }}>{pct(b.citeRate)}</td>
                      <td className="mono" style={{ padding: '7px 0 7px 8px', textAlign: 'right' }}>{b.avgRank == null ? '—' : `#${b.avgRank}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card card-pad" style={{ flex: '1 1 320px' }}>
              <div className="label" style={{ marginBottom: 10 }}>VISIBILITY OVER TIME</div>
              <Trend checks={ov.checks} />
            </div>
          </div>

          <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'stretch', marginBottom: 16 }}>
            <div className="card card-pad" style={{ flex: '1 1 300px' }}>
              <div className="label" style={{ marginBottom: 10 }}>SITES THE AIs CITE MOST</div>
              {s.topSources.length ? s.topSources.map((t) => (
                <div key={t.name} className="row mono" style={{ justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                  <span>{t.name}</span><span style={{ color: 'var(--text-4)' }}>{t.count} answer{t.count === 1 ? '' : 's'}</span>
                </div>
              )) : <div className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>No sources yet.</div>}
            </div>
            <div className="card card-pad" style={{ flex: '1 1 300px' }}>
              <div className="label" style={{ marginBottom: 10 }}>COMPETITORS NAMED</div>
              {s.competitors.length ? s.competitors.map((t) => (
                <div key={t.name} className="row mono" style={{ justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                  <span>{t.name}</span><span style={{ color: 'var(--text-4)' }}>{t.count} answer{t.count === 1 ? '' : 's'}</span>
                </div>
              )) : <div className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>{ov.config.competitors ? 'None of the listed competitors came up.' : 'Add competitors in "Brand, sites & competitors" to track them.'}</div>}
            </div>
          </div>
        </>
      )}

      {/* questions */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 10 }}>QUESTIONS <span style={{ color: 'var(--text-4)' }}>· what customers ask an AI — don't include the client's name</span></div>
        {ov.prompts.map((p) => (
          <div key={p.id} className="row" style={{ gap: 10, alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--border)' }}>
            <input type="checkbox" checked={p.active} title="Include in checks" onChange={(e) => act('t', async () => apply(await api.updateAiPrompt(cid, p.id, { active: e.target.checked })))} />
            <span style={{ fontSize: 13, flex: 1, color: p.active ? 'var(--text)' : 'var(--text-4)' }}>{p.text}</span>
            <button className="btn sm ghost" title="Remove question" onClick={() => act('d', async () => apply(await api.deleteAiPrompt(cid, p.id)))}><Icon name="close" size={11} /></button>
          </div>
        ))}
        {!ov.prompts.length && <div className="mono" style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 6 }}>No questions yet. Add some, or let AI suggest a starting set from the Brief.</div>}
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input value={newQ} onChange={(e) => setNewQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newQ.trim()) addQs([newQ.trim()]); }}
            placeholder="e.g. best hot tub store near Knoxville" style={{ ...inputStyle, height: 36, flex: '1 1 320px' }} />
          <button className="btn sm" disabled={!newQ.trim() || !!busy} onClick={() => addQs([newQ.trim()])}><Icon name="plus" size={12} /> Add</button>
          <button className="btn sm" disabled={!!busy} onClick={suggest}><Icon name="sparkle" size={12} /> {busy === 'sugg' ? 'Thinking…' : 'Suggest questions'}</button>
        </div>
        {sugg.length > 0 && (
          <div style={{ marginTop: 12, padding: 10, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="label">SUGGESTED</span>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn sm" onClick={() => addQs(sugg)}><Icon name="plus" size={11} /> Add all</button>
                <button className="btn sm ghost" onClick={() => setSugg([])}>Dismiss</button>
              </span>
            </div>
            {sugg.map((t) => (
              <div key={t} className="row" style={{ gap: 8, alignItems: 'center', padding: '3px 0' }}>
                <button className="btn sm ghost" title="Add" onClick={() => addQs([t])}><Icon name="plus" size={11} /></button>
                <span style={{ fontSize: 13 }}>{t}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* answers */}
      {view && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <div className="label">ANSWERS · {fmtWhen(view.check.startedAt)}{view.check.startedBy ? ` · by ${view.check.startedBy}` : ''}
              {view.check.status === 'interrupted' && <span style={{ color: 'var(--warn)' }}> · interrupted (server restarted)</span>}
              {view.check.status === 'failed' && <span style={{ color: 'var(--warn)' }}> · failed: {view.check.error}</span>}
            </div>
            {ov.checks.length > 1 && (
              <select value={view.check.id} onChange={(e) => act('v', async () => setView(await api.aiCheckResult(cid, Number(e.target.value))))} style={{ ...inputStyle, height: 32, fontSize: 12 }}>
                {ov.checks.map((c) => <option key={c.id} value={c.id}>{fmtWhen(c.startedAt)} · {c.status === 'done' && c.summary ? `${c.summary.overall.visibility ?? 0}% visible` : c.status}</option>)}
              </select>
            )}
          </div>
          {byQ.map((q, i) => (
            <div key={i} style={{ marginTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>“{q.prompt}”</div>
              {q.rows.map((r) => <ResultRow key={r.id} r={r} label={labelOf[r.engine] || r.engine} />)}
            </div>
          ))}
          {!byQ.length && <div className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>{isRunning ? 'Waiting for the first answers…' : 'No answers in this check.'}</div>}
        </div>
      )}
    </div>
  );
};

export { AiCheckView }
