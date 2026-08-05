// components/scripts.jsx — Scripts tab. Real Claude generation against the live
// VoiceCast API (same origin): pick a client, choose channels, generate copy
// grounded in the client's brief, verified against their PAMW, with history.

import React, { useState, useEffect } from 'react'
import { api } from './api.js'
import { Icon } from './shared.jsx'

const CHANNEL_FALLBACK = [
  { key: 'longform',  label: 'Longform (5–7 min)', variants: 1 },
  { key: 'shortform', label: 'Shortform (under 1 min)', variants: 3 },
  { key: 'blog',      label: 'Blog post', variants: 1 },
];

// Length helpers. Module scope so both the batch result cards and the history
// rows can show them, not just the edit modal. 850 chars/min is the read rate.
const charCount = (t) => String(t || '').trim().length;
const readTime = (t) => {
  const mins = charCount(t) / 850;
  return mins < 1 ? `${Math.max(1, Math.round(mins * 60))} sec` : `${mins.toFixed(1)} min`;
};

// Compact type prefix so scripts on the same topic can be told apart in any
// listing — shortform variants number themselves (SF1/SF2/SF3), longform and
// blog don't need to. Duplicated in client-detail.jsx and episodes.jsx (no
// shared module between these views) — change one, change all three.
const typePrefix = (channel, variant) => {
  if (channel === 'shortform') return 'SF' + (variant || 1);
  if (channel === 'longform') return 'LF';
  if (channel === 'blog') return 'Blog';
  return (channel || '—').slice(0, 2).toUpperCase();
};
const castTitleFor = (s) => `${typePrefix(s.channel, s.variant)}: ${(s.title && s.title.trim()) || (s.topic && s.topic.trim()) || 'Untitled'}`;

const ScriptsView = ({ onCastScript, activeClientId, onSelectClient, onBackToStudio, topicRequest, onTopicConsumed } = {}) => {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(null);
  const [brief, setBrief] = useState(null);
  const [channels, setChannels] = useState(CHANNEL_FALLBACK);
  const [picked, setPicked] = useState({ longform: true, shortform: true, blog: false });
  const [topic, setTopic] = useState('');
  const [extra, setExtra] = useState('');
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [expandedTopic, setExpandedTopic] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [revisePrompt, setRevisePrompt] = useState('');
  const [revising, setRevising] = useState(false);
  const [reviseNote, setReviseNote] = useState('');

  // manual entry
  const [manualOpen, setManualOpen] = useState(false);
  const [manualChannel, setManualChannel] = useState('longform');
  const [manualTopic, setManualTopic] = useState('');
  const [manualBody, setManualBody] = useState('');

  // Topic handed off from the Brief's Topics queue. Preload it into the topic
  // field and remember its queue id — the queue entry is deleted only after a
  // generation actually succeeds, so navigating away never loses a topic.
  const [pendingTopicId, setPendingTopicId] = useState(null);
  useEffect(() => {
    if (!topicRequest) return;
    setTopic(topicRequest.text || '');
    setPendingTopicId(topicRequest.id ?? null);
    if (onTopicConsumed) onTopicConsumed();
  }, [topicRequest]);

  useEffect(() => {
    api.listClients()
      .then(cs => { setClients(cs || []); if (cs && cs.length) setClientId(activeClientId && cs.some((c) => c.id === activeClientId) ? activeClientId : cs[0].id); })
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
      if (pendingTopicId != null) {
        try { await api.deleteTopic(clientId, pendingTopicId); } catch { /* queue entry may already be gone */ }
        setPendingTopicId(null);
      }
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
      if (approval_status === 'approved') {
        const who = window.prompt('Approved by (name):', '');
        if (who === null) return; // cancelled
        if (who.trim()) payload.approval_by = who.trim();
      }
      await api.updateScript(clientId, sid, payload);
      await refreshHistory();
    } catch (e) { setErr(e.message); }
  };
  const APPROVAL_LABEL = { pending: 'pending approval', changes_requested: 'changes added', changes_completed: 'changes completed', approved: 'approved', approved_with_changes: 'approved w/ changes', in_production: 'in production' };
  const remove  = async (sid) => { try { await api.deleteScript(clientId, sid); await refreshHistory(); } catch (e) { setErr(e.message); } };
  const sendApproval = async (sid) => {
    setErr('');
    try {
      const to = window.prompt('Send this script for approval to which email?\n(Leave blank to use the brief approval contact.)', '');
      if (to === null) return;
      const r = await api.sendScriptApproval(clientId, sid, to.trim() || undefined);
      if (!(r && r.email && r.email.sent)) {
        setErr('Marked pending — email not sent: ' + ((r && r.email && r.email.error) || 'unknown') + (r && r.approval_link ? ' (link: ' + r.approval_link + ')' : ''));
      }
      await refreshHistory();
    } catch (e) { setErr(e.message); }
  };
  const copy    = (text) => { try { navigator.clipboard.writeText(text); } catch { /* noop */ } };
  const download = (h) => {
    try {
      const name = ((h.topic || h.channel || 'script').replace(/[^\w-]+/g, '_')).slice(0, 40) + '-' + h.id + '.txt';
      const blob = new Blob([String(h.body || '')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { /* noop */ }
  };
  const openEdit = (h) => { setEditing(h); setEditBody(h.body || ''); setEditTitle(h.title || ''); setEditDesc(h.description || ''); setRevisePrompt(''); setReviseNote(''); setErr(''); };
  const saveEdit = async () => {
    try {
      const payload = { body: editBody, title: editTitle, description: editDesc };
      if (editing && (editing.approval_status === 'changes_requested' || editing.approval_status === 'approved_with_changes')) {
        payload.approval_status = 'changes_completed';
      }
      await api.updateScript(clientId, editing.id, payload);
      setEditing(null); await refreshHistory();
    } catch (e) { setErr(e.message); }
  };
  const reviseWithClaude = async () => {
    if (!revisePrompt.trim() || !editing) return;
    setRevising(true); setErr(''); setReviseNote('');
    try {
      const out = await api.reviseScript(clientId, editing.id, revisePrompt.trim());
      const revised = (out && (out.body || out.revised || out.text)) || (typeof out === 'string' ? out : '');
      if (revised && revised.trim()) {
        setEditBody(revised.trim());
        setReviseNote('Claude revised the draft — review and Save to keep it.');
        setRevisePrompt('');
      } else {
        setErr('Claude returned an empty revision. Try rephrasing your instruction.');
      }
    } catch (e) { setErr(e.message || 'Revision failed.'); }
    finally { setRevising(false); }
  };
  const labelFor = (k) => (channels.find(c => c.key === k) || {}).label || k;

  // Group history by TOPIC — each topic is a collapsible card you click to open
  // and see every script composed on it. Entries with no topic group together.
  const groupedHistory = React.useMemo(() => {
    const groups = new Map();
    for (const h of history) {
      const t = (h.topic && h.topic.trim()) ? h.topic.trim() : '';
      const key = t ? 'topic:' + t.toLowerCase() : 'untitled';
      if (!groups.has(key)) groups.set(key, { key, topic: t || 'Untitled topic', date: h.created_at, items: [] });
      const g = groups.get(key);
      g.items.push(h);
      if (h.created_at && (!g.date || h.created_at > g.date)) g.date = h.created_at;
    }
    return [...groups.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [history]);

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
        {onBackToStudio && <button className="btn sm" style={{ marginBottom: 10 }} onClick={onBackToStudio}><Icon name="arrow-l" size={12} /> Studio</button>}
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
              {picked[c.key] && <Icon name="check" size={12} style={{ color: 'var(--accent)' }} />} {c.label}{c.variants > 1 ? ` ×${c.variants}` : ''}
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
              {results.map(s => (
                <ResultCard key={s.id} script={s} label={labelFor(s.channel)}
                  onCopy={() => copy(s.body)}
                  onDownload={() => download(s)}
                  onEdit={() => openEdit(s)}
                  onSend={() => sendApproval(s.id)}
                  onCast={onCastScript ? () => onCastScript(clientId, s.body, castTitleFor(s)) : null}
                  onDelete={() => {
                    if (window.confirm(`Delete this ${labelFor(s.channel)} script? This can’t be undone.`)) {
                      setResults((r) => r.filter((x) => x.id !== s.id));
                      remove(s.id);
                    }
                  }} />
              ))}
            </div>
          </>
        )}

        {/* history */}
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="label">HISTORY</div>
          <span className="mono">{history.length} on file</span>
        </div>
        <div className="col" style={{ gap: 20 }}>
          {groupedHistory.map(g => {
            const open = expandedTopic === g.key;
            return (
            <div key={g.key} className="card" style={{ overflow: 'hidden' }}>
              <button onClick={() => setExpandedTopic(open ? null : g.key)}
                style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                <Icon name="arrow-r" size={13} style={{ color: 'var(--text-4)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{g.topic}</span>
                <span className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>{g.date ? String(g.date).slice(0, 10) : ''} · {g.items.length} {g.items.length === 1 ? 'script' : 'scripts'}</span>
              </button>
              {open && (
              <div className="col" style={{ gap: 8, padding: '0 14px 14px' }}>
                {g.items.map(h => (
            <div key={h.id} className="col" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="badge">{labelFor(h.channel)}</span>
                  {h.status && h.status !== 'draft' && <span className="mono" style={{ color: h.status === 'approved' ? 'var(--ok)' : 'var(--text-4)' }}>{h.status}</span>}
                  {h.approval_status && h.approval_status !== 'none' && <span className="mono" style={{ color: (h.approval_status.startsWith('approved') || h.approval_status === 'in_production') ? 'var(--ok)' : h.approval_status === 'changes_completed' ? 'var(--text-2)' : h.approval_status === 'pending' ? 'var(--text-4)' : 'var(--accent)' }}>{(APPROVAL_LABEL[h.approval_status] || h.approval_status.replace(/_/g, ' '))}{(h.approval_status.startsWith('approved') || h.approval_status === 'in_production') && h.approval_by ? ' · by ' + h.approval_by : ''}{(h.approval_status.startsWith('approved') || h.approval_status === 'in_production' || h.approval_status === 'changes_completed') && h.approval_updated_at ? ' · ' + String(h.approval_updated_at).slice(0, 10) : ''}</span>}
                  {h.model === 'manual' && <span className="mono">manual</span>}
                </div>
                <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  <strong>{typePrefix(h.channel, h.variant)}: {(h.title && h.title.trim()) || (h.topic && h.topic.trim()) || 'Untitled'} · </strong>{h.body}
                </div>
                {h.description && (
                  <div className="mono" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-3)', marginTop: 6 }}>
                    {h.description}
                    <span style={{ color: 'var(--text-4)' }}> · {h.description.length}/500</span>
                  </div>
                )}
                <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12, marginTop: 6 }}>
                  {charCount(h.body).toLocaleString()} chars · ~{readTime(h.body)} read
                </div>
                {(h.approval_status === 'changes_requested' || h.approval_status === 'approved_with_changes') && h.approval_comment && (
                  <div className="mono" style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                    <span style={{ color: 'var(--accent)' }}>Client notes:</span> {h.approval_comment}
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <button className="btn sm" onClick={() => copy(h.body)}><Icon name="doc" size={12} /> Copy</button>
                <button className="btn sm" onClick={() => download(h)}><Icon name="download" size={12} /> Download</button>
                <button className="btn sm" onClick={() => openEdit(h)}><Icon name="sliders" size={12} /> Edit</button>
                {h.approval_status !== 'approved' && h.approval_status !== 'in_production' && <button className="btn sm" onClick={() => setApproval(h.id, 'approved', 'approved')}><Icon name="check" size={12} /> Mark approved</button>}
                {(h.approval_status === 'approved' || h.approval_status === 'approved_with_changes') && <button className="btn sm" onClick={() => setApproval(h.id, 'in_production', 'approved')}><Icon name="play" size={12} /> In production</button>}
                <button className="btn sm" onClick={() => sendApproval(h.id)}><Icon name="send" size={12} /> Send for approval</button>
                {onCastScript && <button className="btn sm" onClick={() => onCastScript(clientId, h.body, castTitleFor(h))}><Icon name="sparkle" size={12} /> Cast</button>}
                <button className="btn sm" onClick={() => { if (window.confirm(`Delete this ${labelFor(h.channel)} script${h.topic ? ` — “${h.topic}”` : ''}? This can’t be undone.`)) remove(h.id); }} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}><Icon name="close" size={12} /> Delete</button>
              </div>
            </div>
                ))}
              </div>
              )}
            </div>
            );
          })}
          {history.length === 0 && <div className="mono" style={{ color: 'var(--text-4)' }}>No scripts yet for this client.</div>}
        </div>
      </div>

      {/* —— right rail: client + PAMW source of truth —— */}
      <div style={{ borderLeft: '1px solid var(--border)', padding: 'var(--pad)', overflow: 'auto' }}>
        <div className="label" style={{ marginBottom: 10 }}>CLIENT</div>
        <select value={clientId || ''} onChange={(e) => { const v = Number(e.target.value) || e.target.value; setClientId(v); onSelectClient && onSelectClient(v); }}
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
            <input className="textarea" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title" style={{ minHeight: 0, height: 40, fontSize: 15 }} />
            <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={500}
              placeholder="Description (max 500 characters)"
              style={{ minHeight: 64, resize: 'vertical', padding: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13, lineHeight: 1.5 }} />
            <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12, marginTop: -6 }}>{editDesc.length}/500</div>
            <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)}
              style={{ flex: 1, minHeight: 340, resize: 'vertical', padding: 14, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 15, lineHeight: 1.6 }} />
            <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>
              {charCount(editBody).toLocaleString()} characters · ~{readTime(editBody)} read
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
            {err && <div className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>{err}</div>}
            {reviseNote && !err && <div className="mono" style={{ color: 'var(--ok)', fontSize: 12 }}>{reviseNote}</div>}
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

const ResultCard = ({ script, label, onCopy, onDownload, onEdit, onSend, onCast, onDelete }) => {
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
      <div style={{ fontFamily: 'var(--f-display)', fontSize: 19, lineHeight: 1.25, marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>{typePrefix(script.channel, script.variant)}: </span>
        {(script.title && script.title.trim()) || (script.topic && script.topic.trim()) || 'Untitled'}
      </div>
      {Array.isArray(script.keywords) && script.keywords.length > 0 && (
        <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {script.keywords.map((k) => <span key={k} className="badge">{k}</span>)}
        </div>
      )}
      {script.description && (
        <div className="mono" style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-3)', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
          {script.description}
          <span style={{ color: 'var(--text-4)' }}> · {script.description.length}/500</span>
        </div>
      )}
      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{script.body}</div>
      {!clean && (
        <div className="mono" style={{ marginTop: 10, color: 'var(--gold, #b8852a)' }}>
          {checks.issues.join(' · ')}
        </div>
      )}
      <div className="row" style={{ marginTop: 12, gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="mono" style={{ color: 'var(--text-4)', fontSize: 12, marginRight: 4 }}>
          {charCount(script.body).toLocaleString()} chars · ~{readTime(script.body)} read
        </span>
        <button className="btn sm" onClick={onCopy}><Icon name="doc" size={12} /> Copy</button>
        {onDownload && <button className="btn sm" onClick={onDownload}><Icon name="download" size={12} /> Download</button>}
        {onEdit && <button className="btn sm" onClick={onEdit}><Icon name="sliders" size={12} /> Edit</button>}
        {onSend && <button className="btn sm" onClick={onSend}><Icon name="send" size={12} /> Send for approval</button>}
        {onCast && <button className="btn sm" onClick={onCast}><Icon name="sparkle" size={12} /> Cast</button>}
        {onDelete && <button className="btn sm" onClick={onDelete} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}><Icon name="close" size={12} /> Delete</button>}
      </div>
    </div>
  );
};

export { ScriptsView };
