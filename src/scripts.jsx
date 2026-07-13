// components/scripts.jsx — Scripts tab. Real Claude generation against the live
// VoiceCast API (same origin): pick a client, choose channels, generate copy
// grounded in the client's brief, verified against their PAMW, with history.

import React, { useState, useEffect } from 'react'
import { api } from './api.js'
import { Icon } from './shared.jsx'

const CHANNEL_FALLBACK = [
  { key: 'podcast',   label: 'Podcast segment' },
  { key: 'instagram', label: 'Instagram caption' },
  { key: 'linkedin',  label: 'LinkedIn post' },
  { key: 'x',         label: 'X / Tweet' },
];

const ScriptsView = ({ onCastScript } = {}) => {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(null);
  const [brief, setBrief] = useState(null);
  const [channels, setChannels] = useState(CHANNEL_FALLBACK);
  const [picked, setPicked] = useState({ podcast: true, instagram: true, linkedin: false, x: false });
  const [topic, setTopic] = useState('');
  const [extra, setExtra] = useState('');
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [revisePrompt, setRevisePrompt] = useState('');
  const [revising, setRevising] = useState(false);

  // manual entry
  const [manualOpen, setManualOpen] = useState(false);
  const [manualChannel, setManualChannel] = useState('podcast');
  const [manualTopic, setManualTopic] = useState('');
  const [manualBody, setManualBody] = useState('');

  useEffect(() => {
    api.listClients()
      .then(cs => { setClients(cs || []); if (cs && cs.length) setClientId(cs[0].id); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!clientId) return;
    setBrief(null); setHistory([]); setResults([]); setErr('');
    api.getBrief(clientId).then(setBrief).catch(() => {});
    api.listScripts(clientId).then(s => setHistory(s || [])).catch(() => {});
    api.channels(clientId).then(ch => { if (Array.isArray(ch) && ch.length) setChannels(ch); }).catch(() => {});
  }, [clientId]);

  const toggle = (k) => setPicked(p => ({ ...p, [k]: !p[k] }));
  const chosen = channels.filter(c => picked[c.key]).map(c => c.key);

  const refreshHistory = async () => {
    try { const s = await api.listScripts(clientId); setHistory(s || []); } catch { /* noop */ }
  };

  const generate = async () => {
    if (!clientId || chosen.length === 0) return;
    setBusy(true); setErr('');
    try {
      const out = await api.generate(clientId, {
        topic: topic.trim(),
        channels: chosen,
        extra: extra.trim() || undefined,
      });
      setResults(out.scripts || []);
      await refreshHistory();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const addManual = async () => {
    if (!manualBody.trim()) return;
    setBusy(true); setErr('');
    try {
      await api.manual(clientId, { channel: manualChannel, topic: manualTopic.trim() || undefined, body: manualBody });
      setManualBody(''); setManualTopic(''); setManualOpen(false);
      await refreshHistory();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const setApproval = async (sid, approval_status, status) => {
    try {
      const payload = { approval_status };
      if (status) payload.status = status;
      await api.updateScript(clientId, sid, payload);
      await refreshHistory();
    } catch (e) { setErr(e.message); }
  };
  const APPROVAL_LABEL = { pending: 'pending approval', changes_requested: 'changes added', changes_completed: 'changes completed', approved: 'approved', approved_with_changes: 'approved w/ changes', in_production: 'in production' };
  const remove  = async (sid) => { try { await api.deleteScript(clientId, sid); await refreshHistory(); } catch (e) { setErr(e.message); } };
  const sendApproval = async (sid) => {
    setErr('');
    try {
      const r = await api.sendScriptApproval(clientId, sid);
      if (!(r && r.email && r.email.sent)) {
        setErr('Marked pending — email not sent: ' + ((r && r.email && r.email.error) || 'unknown') + (r && r.approval_link ? ' (link: ' + r.approval_link + ')' : ''));
      }
      await refreshHistory();
    } catch (e) { setErr(e.message); }
  };
  const copy    = (text) => { try { navigator.clipboard.writeText(text); } catch { /* noop */ } };
  const openEdit = (h) => { setEditing(h); setEditBody(h.body || ''); setRevisePrompt(''); setErr(''); };
  const saveEdit = async () => {
    try {
      const payload = { body: editBody };
      if (editing && (editing.approval_status === 'changes_requested' || editing.approval_status === 'approved_with_changes')) {
        payload.approval_status = 'changes_completed';
      }
      await api.updateScript(clientId, editing.id, payload);
      setEditing(null); await refreshHistory();
    } catch (e) { setErr(e.message); }
  };
  const reviseWithClaude = async () => {
    if (!revisePrompt.trim() || !editing) return;
    setRevising(true); setErr('');
    try {
      const out = await api.reviseScript(clientId, editing.id, revisePrompt.trim());
      setEditBody(out.body || editBody);
      setRevisePrompt('');
    } catch (e) { setErr(e.message); }
    finally { setRevising(false); }
  };
  const wordCount = (t) => (String(t || '').trim().match(/\S+/g) || []).length;
  const readTime = (t) => {
    const words = wordCount(t);
    const mins = words / 140;
    return mins < 1 ? `${Math.max(1, Math.round(mins * 60))} sec` : `${mins.toFixed(1)} min`;
  };

  const labelFor = (k) => (channels.find(c => c.key === k) || {}).label || k;

  if (loading) {
    return <div className="v-pad fade-in"><div className="mono">Loading clients from the API…</div></div>;
  }

  if (!clients.length) {
    return (
      <div className="v-pad fade-in">
        <div style={{ fontFamily: 'var(--f-display)', fontSize: 24, fontStyle: 'italic', marginBottom: 8 }}>no clients yet</div>
        <div className="mono">The API returned no clients. Create one first, then come back to generate scripts.</div>
        {err && <div className="mono" style={{ color: 'var(--err)', marginTop: 12 }}>{err}</div>}
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100%', minHeight: 0 }}>
      {/* —— center: generator + results + history —— */}
      <div style={{ overflow: 'auto', padding: 'var(--pad)' }}>
        <div className="label">SCRIPTS · CLAUDE</div>
        <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 34, letterSpacing: '-0.01em', margin: '6px 0 18px' }}>
          Generate <em style={{ color: 'var(--accent)' }}>copy</em> from the brief.
        </h1>

        {err && (
          <div className="card card-pad" style={{ borderColor: 'var(--err)', marginBottom: 16 }}>
            <span className="mono" style={{ color: 'var(--err)' }}>{err}</span>
          </div>
        )}

        {/* channels */}
        <div className="label" style={{ marginBottom: 8 }}>CHANNELS</div>
        <div className="row" style={{ gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {channels.map(c => (
            <button key={c.key} onClick={() => toggle(c.key)} className="btn sm"
              style={{
                background: picked[c.key] ? 'var(--surface-2)' : 'transparent',
                borderColor: picked[c.key] ? 'var(--accent)' : 'var(--border)',
                color: picked[c.key] ? 'var(--text)' : 'var(--text-2)'
              }}>
              {picked[c.key] && <Icon name="check" size={12} style={{ color: 'var(--accent)' }} />} {c.label}
            </button>
          ))}
        </div>

        {/* topic + extra */}
        <div className="label" style={{ marginBottom: 8 }}>TOPIC</div>
        <input className="textarea" value={topic} onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. why discipline beats motivation"
          style={{ minHeight: 0, height: 44, fontSize: 15, marginBottom: 12 }} />

        <div className="label" style={{ marginBottom: 8 }}>EXTRA DIRECTION (optional)</div>
        <textarea className="textarea" value={extra} onChange={(e) => setExtra(e.target.value)}
          placeholder="Any angle, offer, or detail to steer this batch…"
          style={{ minHeight: 70, fontSize: 14, marginBottom: 14 }} />

        <div className="row" style={{ gap: 10, marginBottom: 28 }}>
          <button className="btn primary lg" onClick={generate} disabled={busy || !chosen.length}
            style={{ opacity: (busy || !chosen.length) ? 0.5 : 1 }}>
            {busy ? <>Generating…</> : <><Icon name="sparkle" size={14} /> Generate {chosen.length || ''} script{chosen.length === 1 ? '' : 's'}</>}
          </button>
          <button className="btn" onClick={() => setManualOpen(o => !o)}>
            <Icon name="doc" size={13} /> Write your own
          </button>
        </div>

        {/* manual entry */}
        {manualOpen && (
          <div className="card card-pad" style={{ marginBottom: 28 }}>
            <div className="label" style={{ marginBottom: 10 }}>ADD YOUR OWN SCRIPT</div>
            <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {channels.map(c => (
                <button key={c.key} onClick={() => setManualChannel(c.key)} className="btn sm"
                  style={{
                    background: manualChannel === c.key ? 'var(--surface-2)' : 'transparent',
                    borderColor: manualChannel === c.key ? 'var(--accent)' : 'var(--border)',
                    color: manualChannel === c.key ? 'var(--text)' : 'var(--text-2)'
                  }}>{c.label}</button>
              ))}
            </div>
            <input className="textarea" value={manualTopic} onChange={(e) => setManualTopic(e.target.value)}
              placeholder="Topic (optional)" style={{ minHeight: 0, height: 40, fontSize: 14, marginBottom: 8 }} />
            <textarea className="textarea" value={manualBody} onChange={(e) => setManualBody(e.target.value)}
              placeholder="Paste or write the script…" style={{ minHeight: 120, fontSize: 14, marginBottom: 10 }} />
            <button className="btn primary" onClick={addManual} disabled={busy || !manualBody.trim()}
              style={{ opacity: (busy || !manualBody.trim()) ? 0.5 : 1 }}>
              <Icon name="plus" size={13} /> Save script
            </button>
          </div>
        )}

        {/* results */}
        {results.length > 0 && (
          <>
            <div className="label" style={{ marginBottom: 12 }}>THIS BATCH</div>
            <div className="col" style={{ gap: 12, marginBottom: 28 }}>
              {results.map(s => <ResultCard key={s.id} script={s} label={labelFor(s.channel)} onCopy={() => copy(s.body)} />)}
            </div>
          </>
        )}

        {/* history */}
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="label">HISTORY</div>
          <span className="mono">{history.length} on file</span>
        </div>
        <div className="col" style={{ gap: 8 }}>
          {history.map(h => (
            <div key={h.id} className="row" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="badge">{labelFor(h.channel)}</span>
                  {h.status && h.status !== 'draft' && <span className="mono" style={{ color: h.status === 'approved' ? 'var(--ok)' : 'var(--text-4)' }}>{h.status}</span>}
                  {h.approval_status && h.approval_status !== 'none' && <span className="mono" style={{ color: (h.approval_status.startsWith('approved') || h.approval_status === 'in_production') ? 'var(--ok)' : h.approval_status === 'changes_completed' ? 'var(--text-2)' : h.approval_status === 'pending' ? 'var(--text-4)' : 'var(--accent)' }}>{(APPROVAL_LABEL[h.approval_status] || h.approval_status.replace(/_/g, ' '))}{h.approval_status === 'changes_completed' && h.approval_updated_at ? ' · ' + String(h.approval_updated_at).slice(0, 10) : ''}</span>}
                  {h.model === 'manual' && <span className="mono">manual</span>}
                </div>
                <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {h.topic ? <strong>{h.topic} · </strong> : null}{h.body}
                </div>
                {(h.approval_status === 'changes_requested' || h.approval_status === 'approved_with_changes') && h.approval_comment && (
                  <div className="mono" style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                    <span style={{ color: 'var(--accent)' }}>Client notes:</span> {h.approval_comment}
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="icon-btn" title="Copy" onClick={() => copy(h.body)}><Icon name="doc" size={13} /></button>
                <button className="icon-btn" title="Edit / review" onClick={() => openEdit(h)}><Icon name="sliders" size={13} /></button>
                {h.approval_status !== 'approved' && h.approval_status !== 'in_production' && <button className="icon-btn" title="Mark approved" onClick={() => setApproval(h.id, 'approved', 'approved')}><Icon name="check" size={13} /></button>}
                {(h.approval_status === 'approved' || h.approval_status === 'approved_with_changes') && <button className="icon-btn" title="Mark in production" onClick={() => setApproval(h.id, 'in_production', 'approved')}><Icon name="play" size={13} /></button>}
                <button className="icon-btn" title="Send for approval" onClick={() => sendApproval(h.id)}><Icon name="send" size={13} /></button>
                {h.status === 'approved' && onCastScript && <button className="icon-btn" title="Cast this script" onClick={() => onCastScript(clientId, h.body)}><Icon name="sparkle" size={13} /></button>}
                <button className="icon-btn" title="Delete" onClick={() => { if (window.confirm(`Delete this ${labelFor(h.channel)} script${h.topic ? ` — “${h.topic}”` : ''}? This can’t be undone.`)) remove(h.id); }}><Icon name="close" size={13} /></button>
              </div>
            </div>
          ))}
          {history.length === 0 && <div className="mono" style={{ color: 'var(--text-4)' }}>No scripts yet for this client.</div>}
        </div>
      </div>

      {/* —— right rail: client + PAMW source of truth —— */}
      <div style={{ borderLeft: '1px solid var(--border)', padding: 'var(--pad)', overflow: 'auto' }}>
        <div className="label" style={{ marginBottom: 10 }}>CLIENT</div>
        <select value={clientId || ''} onChange={(e) => setClientId(Number(e.target.value) || e.target.value)}
          className="textarea" style={{ minHeight: 0, height: 40, fontSize: 14, marginBottom: 22, width: '100%' }}>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.companyName || `Client ${c.id}`}</option>)}
        </select>

        <div className="label" style={{ marginBottom: 10 }}>CONTACT — SOURCE OF TRUTH</div>
        <div className="mono" style={{ color: 'var(--text-4)', marginBottom: 10 }}>generation must match these exactly</div>
        <div className="col" style={{ gap: 10, marginBottom: 22 }}>
          <Field label="Phone"   value={brief?.phone} />
          <Field label="Address" value={brief?.address} />
          <Field label="Mobile"  value={brief?.mobile} />
          <Field label="Website" value={brief?.website} link />
        </div>

        <div className="label" style={{ marginBottom: 10 }}>GROUNDING</div>
        <div className="col" style={{ gap: 10 }}>
          <Field label="Positioning" value={brief?.positioning} />
          <Field label="Audience"    value={brief?.audience} />
          <Field label="Tone"        value={brief?.tone} />
        </div>
      </div>
      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.55)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: 'min(760px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="label">EDIT SCRIPT{editing.topic ? ' · ' + editing.topic : ''}</div>
              <button className="icon-btn" title="Close" onClick={() => setEditing(null)}><Icon name="close" size={14} /></button>
            </div>
            <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)}
              style={{ flex: 1, minHeight: 340, resize: 'vertical', padding: 14, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 15, lineHeight: 1.6 }} />
            <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>
              {wordCount(editBody)} words · ~{readTime(editBody)} read
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input className="textarea" value={revisePrompt} onChange={(e) => setRevisePrompt(e.target.value)}
                placeholder="Tell Claude how to revise this (e.g. “make it shorter and punchier”)…"
                onKeyDown={(e) => { if (e.key === 'Enter' && !revising) reviseWithClaude(); }}
                style={{ minHeight: 0, height: 40, fontSize: 14, flex: 1 }} />
              <button className="btn sm" onClick={reviseWithClaude} disabled={revising || !revisePrompt.trim()}
                style={{ opacity: (revising || !revisePrompt.trim()) ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                <Icon name="sparkle" size={13} /> {revising ? 'Revising…' : 'Edit with Claude'}
              </button>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn sm" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn primary sm" onClick={saveEdit}><Icon name="check" size={13} /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, value, link }) => (
  <div>
    <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 13, lineHeight: 1.5, color: value ? 'var(--text)' : 'var(--text-4)', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
      {value
        ? (link ? <a href={/^https?:\/\//.test(value) ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{value}</a> : value)
        : '— not on file'}
    </div>
  </div>
);

const ResultCard = ({ script, label, onCopy }) => {
  const checks = script.checks || { issues: [] };
  const clean = !checks.issues || checks.issues.length === 0;
  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="badge">{label}</span>
        {clean
          ? <span className="mono" style={{ color: 'var(--ok)' }}>✓ verified</span>
          : <span className="mono" style={{ color: 'var(--gold, #b8852a)' }}>⚠ review</span>}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{script.body}</div>
      {!clean && (
        <div className="mono" style={{ marginTop: 10, color: 'var(--gold, #b8852a)' }}>
          {checks.issues.join(' · ')}
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn sm" onClick={onCopy}><Icon name="doc" size={12} /> Copy</button>
      </div>
    </div>
  );
};

export { ScriptsView };
