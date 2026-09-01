import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { api } from './api.js'
import { Icon, ensureOperatorName } from './shared.jsx'

// Live Brief editor for the selected client. Contact fields (phone/address/
// mobile/website) are the source of truth the Scripts tab injects verbatim;
// the repository fields (positioning/audience/tone/notes) steer the copy.
const CONTACT = [
  ['client_code', 'Client code (used in download filenames, e.g. ACME)', false],
  ['email', 'Email', false],
  ['approval_email', 'Approval contact email', false],
  ['phone', 'Phone', false],
  ['mobile', 'Mobile', false],
  ['website', 'Website', false],
  ['blog_url', 'Blog link', false],
  ['transistor_url', 'Transistor podcast link', false],
  ['transistor_show_id', 'Transistor show ID (for auto-publish)', false],
  ['address', 'Address', true],
];
const REPO = [
  ['positioning', 'Positioning', true],
  ['audience', 'Audience', true],
  ['tone', 'Brand tone', false],
  ['notes', 'Notes', true],
];
const THEME = [
  ['theme_primary', 'Primary'],
  ['theme_secondary', 'Secondary'],
  ['theme_accent', 'Accent'],
];
const KEYS = [...CONTACT, ...REPO, ...THEME].map(([k]) => k).concat(['repo_richtext', 'topics_to_avoid']);

const KIND_OPTS = ['podcast', 'social', 'website', 'other'];

function DistributionCard({ clientId }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ kind: 'podcast', platform: '', url: '', username: '', notes: '', secret: '' });
  const [revealed, setRevealed] = useState({});
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);

  const load = () => api.listCredentials(clientId)
    .then((r) => setRows(Array.isArray(r) ? r : []))
    .catch((e) => setErr(e.message || 'Could not load channels.'));
  useEffect(() => { setRows([]); setErr(''); if (clientId) load(); }, [clientId]);

  const add = async () => {
    if (!form.platform.trim()) { setErr('Platform is required.'); return; }
    setBusy(true); setErr('');
    try {
      await api.addCredential(clientId, form);
      setForm({ kind: form.kind, platform: '', url: '', username: '', notes: '', secret: '' });
      await load();
    } catch (e) { setErr(e.message || 'Could not add channel.'); } finally { setBusy(false); }
  };
  const reveal = async (id) => {
    if (revealed[id]) { setRevealed((r) => ({ ...r, [id]: null })); return; }
    try { const d = await api.revealCredential(clientId, id); setRevealed((r) => ({ ...r, [id]: d.secret || '(empty)' })); }
    catch (e) { setErr(e.message || 'Could not reveal password.'); }
  };
  const saveEdit = async () => {
    if (!edit.platform.trim()) { setErr('Platform is required.'); return; }
    setBusy(true); setErr('');
    try {
      await api.updateCredential(clientId, edit.id, {
        kind: edit.kind, platform: edit.platform, url: edit.url,
        username: edit.username, notes: edit.notes,
        ...(edit.secret ? { secret: edit.secret } : {}),
      });
      setEdit(null);
      await load();
    } catch (e) { setErr(e.message || 'Could not save channel.'); } finally { setBusy(false); }
  };

  const remove = async (id) => {
    try { await api.deleteCredential(clientId, id); await load(); }
    catch (e) { setErr(e.message || 'Could not remove channel.'); }
  };

  const toggle2fa = async (c) => {
    const next = !c.twofa_verified;
    let name = '';
    if (next) { name = ensureOperatorName(); if (!name) return; }
    setErr('');
    try { await api.verifyCredential2fa(clientId, c.id, next, name); await load(); }
    catch (e) { setErr(e.message || 'Could not update 2FA status.'); }
  };

  const inp = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '8px 10px', boxSizing: 'border-box', width: '100%' };

  return (
    <div className="card card-pad" style={{ flex: '1 1 320px' }}>
      <div className="label" style={{ marginBottom: 12 }}>DISTRIBUTION · podcast / socials / websites</div>
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 8 }}>{err}</div>}
      {rows.length === 0 && <div className="mono" style={{ color: 'var(--text-4)', marginBottom: 10 }}>No channels yet.</div>}
      {rows.map((c) => (edit && edit.id === c.id ? (
        <div key={c.id} className="col" style={{ gap: 8, borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
          <div className="row" style={{ gap: 8 }}>
            <select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })} style={{ ...inp, width: 130 }}>
              {KIND_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input placeholder="Platform" value={edit.platform} onChange={(e) => setEdit({ ...edit, platform: e.target.value })} style={inp} />
          </div>
          <input placeholder="URL" value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} style={inp} />
          <input placeholder="Handle / username" value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} style={inp} />
          <input type="password" placeholder="New password (leave blank to keep)" value={edit.secret} onChange={(e) => setEdit({ ...edit, secret: e.target.value })} style={inp} autoComplete="new-password" />
          <input placeholder="Notes" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} style={inp} />
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm primary" onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save channel'}</button>
            <button className="btn sm" onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div key={c.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{c.platform} <span className="mono" style={{ color: 'var(--text-4)', fontWeight: 400 }}>{c.kind}</span></div>
            {c.url && <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.url}</div>}
            {c.username && <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>{c.username}</div>}
            {revealed[c.id] && <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12 }}>pw: {revealed[c.id]}</div>}
            <label className="row" onClick={(e) => e.stopPropagation()} style={{ gap: 6, alignItems: 'center', cursor: 'pointer', marginTop: 4, color: c.twofa_verified ? 'var(--ok)' : 'var(--accent)' }}>
              <input type="checkbox" checked={!!c.twofa_verified} onChange={() => toggle2fa(c)} style={{ accentColor: 'var(--ok)', cursor: 'pointer' }} />
              <span className="mono" style={{ fontSize: 11.5 }}>{c.twofa_verified ? `2FA verified${c.twofa_verified_by ? ' \u00b7 ' + c.twofa_verified_by : ''}` : '2FA not verified'}</span>
            </label>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {c.hasSecret && <button className="btn sm" onClick={() => reveal(c.id)}>{revealed[c.id] ? 'Hide' : 'Password'}</button>}
            <button className="btn sm" onClick={() => setEdit({ id: c.id, kind: c.kind || 'podcast', platform: c.platform || '', url: c.url || '', username: c.username || '', notes: c.notes || '', secret: '' })}>Edit</button>
            <button className="btn sm" onClick={() => remove(c.id)}>Remove</button>
          </div>
        </div>
      )))}
      <div className="col" style={{ gap: 8, marginTop: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={{ ...inp, width: 130 }}>
            {KIND_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input placeholder="Platform (e.g. Spotify, Instagram)" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} style={inp} />
        </div>
        <input placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} style={inp} />
        <input placeholder="Handle / username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={inp} />
        <input type="password" placeholder="Password (stored encrypted)" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} style={inp} autoComplete="new-password" />
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={inp} />
        <button className="btn primary" onClick={add} disabled={busy}>{busy ? 'Adding…' : 'Add channel'}</button>
      </div>
    </div>
  );
}

// Show-level metadata for the self-hosted podcast RSS feed (title, author,
// category, etc). The feed URL itself is read-only here — it's generated
// server-side (token-scoped, no login) the first time this loads.
function PodcastFeedCard({ clientId }) {
  const [feed, setFeed] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => api.getPodcastFeed(clientId).then(setFeed).catch((e) => setErr(e.message || 'Could not load podcast feed settings.'));
  useEffect(() => { setFeed(null); setErr(''); if (clientId) load(); }, [clientId]);

  const set = (k, v) => { setFeed((f) => ({ ...f, [k]: v })); setSaved(false); };
  const save = async () => {
    setSaving(true); setErr(''); setSaved(false);
    try {
      const updated = await api.putPodcastFeed(clientId, {
        title: feed.title, description: feed.description, author: feed.author, ownerEmail: feed.owner_email,
        category: feed.category, subcategory: feed.subcategory, explicit: feed.explicit, language: feed.language,
      });
      setFeed(updated); setSaved(true);
    } catch (e) { setErr(e.message || 'Could not save.'); } finally { setSaving(false); }
  };
  const copyUrl = () => {
    if (!feed?.feedUrl) return;
    navigator.clipboard?.writeText(feed.feedUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const inp = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '8px 10px', boxSizing: 'border-box', width: '100%' };
  if (!feed) return <div className="card card-pad" style={{ flex: '1 1 320px' }}><div className="label">PODCAST FEED</div>{err && <div className="mono" style={{ color: 'var(--accent)', marginTop: 8 }}>{err}</div>}</div>;

  return (
    <div className="card card-pad" style={{ flex: '1 1 320px' }}>
      <div className="label" style={{ marginBottom: 12 }}>PODCAST FEED · Apple / Spotify submit this URL once</div>
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 8 }}>{err}</div>}
      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        <input readOnly value={feed.feedUrl || ''} style={{ ...inp, color: 'var(--text-3)' }} onFocus={(e) => e.target.select()} />
        <button className="btn sm" onClick={copyUrl}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <div className="col" style={{ gap: 8 }}>
        <input placeholder="Show title" value={feed.title ?? ''} onChange={(e) => set('title', e.target.value)} style={inp} />
        <textarea placeholder="Show description" value={feed.description ?? ''} onChange={(e) => set('description', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
        <input placeholder="Author / host name" value={feed.author ?? ''} onChange={(e) => set('author', e.target.value)} style={inp} />
        <input placeholder="Owner email (iTunes contact)" value={feed.owner_email ?? ''} onChange={(e) => set('owner_email', e.target.value)} style={inp} />
        <div className="row" style={{ gap: 8 }}>
          <input placeholder="Category (e.g. Business)" value={feed.category ?? ''} onChange={(e) => set('category', e.target.value)} style={inp} />
          <input placeholder="Subcategory (optional)" value={feed.subcategory ?? ''} onChange={(e) => set('subcategory', e.target.value)} style={inp} />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <select value={feed.explicit || 'no'} onChange={(e) => set('explicit', e.target.value)} style={{ ...inp, width: 140 }}>
            <option value="no">Not explicit</option>
            <option value="yes">Explicit</option>
          </select>
          <input placeholder="Language (e.g. en-us)" value={feed.language ?? ''} onChange={(e) => set('language', e.target.value)} style={inp} />
        </div>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <button className="btn sm primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save feed settings'}</button>
          {saved && <span className="mono" style={{ color: 'var(--ok)' }}>✓ saved</span>}
        </div>
      </div>
    </div>
  );
}

// Which Upload-Post profile (created in their dashboard, holds this client's
// connected YouTube/Facebook/Instagram) to publish through, plus the
// Facebook Page id Upload-Post requires explicitly for Facebook posts.
function SocialDistributionCard({ clientId }) {
  const [dist, setDist] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () => api.getDistribution(clientId).then(setDist).catch((e) => setErr(e.message || 'Could not load distribution settings.'));
  useEffect(() => { setDist(null); setErr(''); if (clientId) load(); }, [clientId]);

  const set = (k, v) => { setDist((d) => ({ ...d, [k]: v })); setSaved(false); };
  const save = async () => {
    setSaving(true); setErr(''); setSaved(false);
    try {
      const updated = await api.putDistribution(clientId, { uploadPostProfile: dist.upload_post_profile, facebookPageId: dist.facebook_page_id });
      setDist(updated); setSaved(true);
    } catch (e) { setErr(e.message || 'Could not save.'); } finally { setSaving(false); }
  };

  const inp = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '8px 10px', boxSizing: 'border-box', width: '100%' };
  if (!dist) return <div className="card card-pad" style={{ flex: '1 1 320px' }}><div className="label">SOCIAL DISTRIBUTION</div>{err && <div className="mono" style={{ color: 'var(--accent)', marginTop: 8 }}>{err}</div>}</div>;

  return (
    <div className="card card-pad" style={{ flex: '1 1 320px' }}>
      <div className="label" style={{ marginBottom: 12 }}>SOCIAL DISTRIBUTION · YouTube / Facebook / Instagram via Upload-Post</div>
      <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginBottom: 10 }}>
        Connect this client's accounts once at app.upload-post.com/manage-users, then enter the profile name you gave it there.
      </div>
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 8 }}>{err}</div>}
      <div className="col" style={{ gap: 8 }}>
        <input placeholder="Upload-Post profile name" value={dist.upload_post_profile ?? ''} onChange={(e) => set('upload_post_profile', e.target.value)} style={inp} />
        <input placeholder="Facebook Page id (required for Facebook posts)" value={dist.facebook_page_id ?? ''} onChange={(e) => set('facebook_page_id', e.target.value)} style={inp} />
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <button className="btn sm primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save distribution settings'}</button>
          {saved && <span className="mono" style={{ color: 'var(--ok)' }}>✓ saved</span>}
        </div>
        <HashtagManager clientId={clientId} />
      </div>
    </div>
  );
}

// Reusable social hashtag list on the Brief. Add tags one at a time or generate
// a suggested set, delete any, and save — social scripts read from this list.
function HashtagManager({ clientId }) {
  const [tags, setTags] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState('');
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (clientId == null) return;
    api.getBrief(clientId)
      .then((b) => setTags(String(b?.social_hashtags || '').split(/\s+/).filter(Boolean)))
      .catch(() => {});
  }, [clientId]);

  const norm = (t) => { t = t.trim(); if (!t) return ''; return t.startsWith('#') ? t : '#' + t; };
  const add = () => {
    const parts = input.split(/[\s,]+/).map(norm).filter(Boolean);
    if (!parts.length) return;
    setTags((prev) => [...new Set([...prev, ...parts])]);
    setInput(''); setSaved(false);
  };
  const del = (t) => { setTags((prev) => prev.filter((x) => x !== t)); setSaved(false); };
  const generate = async () => {
    setBusy('gen'); setErr('');
    try { const r = await api.suggestHashtags(clientId); setTags((prev) => [...new Set([...prev, ...(r.hashtags || [])])]); setSaved(false); }
    catch (e) { setErr(e.message || 'Could not generate hashtags.'); }
    finally { setBusy(''); }
  };
  const save = async () => {
    setBusy('save'); setErr('');
    try { await api.putBrief(clientId, { social_hashtags: tags.join(' ') }); setSaved(true); }
    catch (e) { setErr(e.message || 'Could not save hashtags.'); }
    finally { setBusy(''); }
  };

  const inp = { flex: 1, minWidth: 160, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '10px 12px', boxSizing: 'border-box' };
  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <div className="label" style={{ marginBottom: 8 }}>SOCIAL HASHTAGS · applied to social scripts</div>
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 8 }}>{err}</div>}
      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Add a hashtag…" style={inp} />
        <button className="btn sm" onClick={add}><Icon name="plus" size={13} /> Add</button>
        <button className="btn sm" onClick={generate} disabled={busy === 'gen'}><Icon name="sparkle" size={13} /> {busy === 'gen' ? 'Generating…' : 'Generate list'}</button>
      </div>
      {tags.length > 0 ? (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {tags.map((t) => (
            <span key={t} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent)' }}>
              {t}
              <span role="button" onClick={() => del(t)} title="Remove" style={{ cursor: 'pointer', fontWeight: 700, opacity: 0.7 }}>×</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12, marginBottom: 10 }}>No hashtags yet — add some or generate a list.</div>
      )}
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <button className="btn sm primary" onClick={save} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save hashtags'}</button>
        {saved && <span className="mono" style={{ color: 'var(--ok)' }}>✓ saved</span>}
      </div>
    </div>
  );
}

function Field({ label, value, multiline, onChange }) {
  const base = {
    width: '100%', background: 'var(--surface-2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    fontFamily: 'var(--f-mono)', fontSize: 13, padding: '10px 12px',
    boxSizing: 'border-box',
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      {multiline ? (
        <textarea
          className="textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{ ...base, resize: 'vertical', minHeight: 64 }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...base, height: 42 }}
        />
      )}
    </div>
  );
}

const ASSET_KINDS = [
  { id: 'logo', label: 'Logo' },
  { id: 'background', label: 'Background' },
  { id: 'music', label: 'Music' },
  { id: 'font', label: 'Font' },
  { id: 'video', label: 'Video' },
  { id: 'other', label: 'Other' },
];

function AssetsSection({ clientId }) {
  const [assets, setAssets] = useState([]);
  const [kind, setKind] = useState('logo');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState(null);   // { url, name } for click-to-enlarge

  const load = () => api.listAssets(clientId).then((r) => setAssets(Array.isArray(r) ? r : [])).catch(() => setAssets([]));
  useEffect(() => { if (clientId != null) load(); }, [clientId]);

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setErr('');
    try { await api.uploadAsset(clientId, kind, file); await load(); }
    catch (ex) { setErr(ex.message || 'Upload failed.'); }
    finally { setBusy(false); }
  };
  const remove = async (id) => {
    if (!window.confirm('Delete this asset? This cannot be undone.')) return;
    try { await api.deleteAsset(clientId, id); await load(); } catch (ex) { setErr(ex.message); }
  };
  const isImage = (a) => (a.mime || '').startsWith('image/') || ['logo', 'background'].includes(a.kind);
  const isVideo = (a) => (a.mime || '').startsWith('video/') || a.kind === 'video';
  const isAudio = (a) => (a.mime || '').startsWith('audio/') || ['music', 'audio'].includes(a.kind);

  return (
    <div style={{ marginTop: 28 }}>
      <div className="label" style={{ marginBottom: 12 }}>ASSETS · logo, backgrounds, music, fonts</div>
      <div className="card card-pad">
        <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ height: 36, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13 }}>
            {ASSET_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <label className="btn sm" style={{ cursor: busy ? 'not-allowed' : 'pointer' }}>
            <Icon name="upload" size={13} /> {busy ? 'Uploading…' : 'Upload'}
            <input type="file" onChange={onFile} disabled={busy} style={{ display: 'none' }} />
          </label>
          {err && <span className="mono" style={{ color: 'var(--accent)' }}>{err}</span>}
        </div>
        {assets.length === 0 ? (
          <div className="mono" style={{ color: 'var(--text-4)' }}>No assets yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
            {assets.map((a) => (
              <div key={a.id} className="card" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ height: 80, borderRadius: 6, overflow: 'hidden', background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
                  {isImage(a)
                    ? <img src={api.assetFileUrl(clientId, a.id)} alt={a.filename} title="Click to view full size" onClick={() => setLightbox({ type: 'image', url: api.assetFileUrl(clientId, a.id), name: a.filename })} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} />
                    : isVideo(a)
                      ? <video src={api.assetFileUrl(clientId, a.id)} preload="metadata" muted title="Click to play full size" onClick={() => setLightbox({ type: 'video', url: api.assetFileUrl(clientId, a.id), name: a.filename })} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} />
                      : <Icon name={isAudio(a) ? 'mic' : 'doc'} size={20} style={{ color: 'var(--text-3)' }} />}
                </div>
                {/* Full, legible filename — wraps instead of truncating so it can be read without hovering. */}
                <div className="mono" style={{ fontSize: 11, lineHeight: 1.35, wordBreak: 'break-word' }} title={a.filename}>{a.filename}</div>
                {/* Audio: inline player so it can be previewed right in the card. */}
                {isAudio(a) && <audio controls preload="none" src={api.assetFileUrl(clientId, a.id)} style={{ width: '100%', height: 32 }} />}
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge">{a.kind}</span>
                  <button className="icon-btn" title="Delete" onClick={() => remove(a.id)}><Icon name="close" size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.8)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 200, cursor: 'zoom-out' }}>
          {lightbox.type === 'video'
            ? <video src={lightbox.url} controls autoPlay onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 10, border: '1px solid var(--border)', background: '#000' }} />
            : <img src={lightbox.url} alt={lightbox.name} style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 10, border: '1px solid var(--border)' }} />}
        </div>
      )}
    </div>
  );
}

function LookPicker({ avatar, onSet }) {
  const [looks, setLooks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    (async () => {
      if (!avatar.heygen_group_id) { setErr('No HeyGen group on this avatar.'); setLoading(false); return; }
      if (!avatar._token) { setErr('No token to look this up.'); setLoading(false); return; }
      try {
        const r = await api.listAvatarLooks(avatar._token, avatar.heygen_group_id);
        if (live) setLooks((r && r.looks) || []);
      } catch (e) { if (live) setErr(e.message || 'Could not load looks.'); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [avatar.id]);
  const pick = async (lookId) => {
    setErr('');
    const look = (looks || []).find((l) => l.id === lookId);
    try { await api.setAvatarLook(avatar._token, avatar.id, lookId, look && look.image_url); if (onSet) onSet(); }
    catch (e) { setErr(e.message); }
  };
  return (
    <div style={{ marginTop: 6 }}>
      {loading ? <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>Loading looks…</div>
       : err ? <div className="mono" style={{ color: 'var(--accent)', fontSize: 11 }}>{err}</div>
       : (looks && looks.length) ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {looks.map((l) => (
            <button key={l.id} onClick={() => pick(l.id)} title={l.name || 'Use this look'}
              style={{ padding: 0, width: 44, height: 44, borderRadius: 5, overflow: 'hidden', cursor: 'pointer', background: 'var(--surface-2)',
                border: avatar.heygen_avatar_id === l.id ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
              {l.image_url ? <img src={l.image_url} alt={l.name || 'look'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="avatars" size={14} />}
            </button>
          ))}
        </div>
      ) : <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>No looks found in HeyGen.</div>}
    </div>
  );
}

function VoiceSettings({ avatar, onClose, onSaved }) {
  const isEleven = avatar.voice_id && !/^[0-9a-f]{32}$/i.test(String(avatar.voice_id));
  const [v3, setV3] = useState(!!avatar.voice_v3);
  const [stability, setStability] = useState(avatar.voice_stability != null ? Number(avatar.voice_stability) : 0.5);
  const [similarity, setSimilarity] = useState(avatar.voice_similarity != null ? Number(avatar.voice_similarity) : 0.75);
  const [style, setStyle] = useState(avatar.voice_style != null ? Number(avatar.voice_style) : 0.0);
  const [speed, setSpeed] = useState(avatar.voice_speed != null ? Number(avatar.voice_speed) : 1.0);
  const [boost, setBoost] = useState(avatar.voice_speaker_boost == null ? true : !!avatar.voice_speaker_boost);
  const [text, setText] = useState("[excited] Here is a quick preview of this voice. [whispers] Even the quiet parts come through. [laughs] Sounds good.");
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  const payload = () => ({
    voice_v3: v3 ? 1 : 0,
    voice_stability: Number(stability),
    voice_similarity: Number(similarity),
    voice_style: Number(style),
    voice_speed: Number(speed),
    voice_speaker_boost: boost ? 1 : 0,
  });
  const doPreview = async () => {
    setErr(''); setBusy('preview');
    try { const url = await api.previewAvatarVoice(avatar._token, avatar.id, { ...payload(), text }); const a = new Audio(url); await a.play(); }
    catch (e) { setErr(e.message || 'Preview failed'); } finally { setBusy(''); }
  };
  const doSave = async () => {
    setErr(''); setSaved(false); setBusy('save');
    try { await api.setAvatarVoice(avatar._token, avatar.id, payload()); setSaved(true); if (onSaved) onSaved(); }
    catch (e) { setErr(e.message || 'Save failed'); } finally { setBusy(''); }
  };

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 };
  const card = { background: 'var(--surface)', color: 'var(--text)', width: 'min(460px, 94vw)', maxHeight: '88vh', overflowY: 'auto', borderRadius: 10, padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.35)' };
  const rowLbl = { fontSize: 12, color: 'var(--text-3)', marginBottom: 5, display: 'block' };
  const slider = (val, set, min, max, step) => (
    <input type="range" min={min} max={max} step={step} value={val} style={{ width: '100%' }}
      onChange={(e) => { set(Number(e.target.value)); setSaved(false); }} />
  );

  return createPortal(
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Voice settings</div>
          <button className="btn sm" onClick={onClose} aria-label="Close"><Icon name="close" size={14} /></button>
        </div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 16 }}>{avatar._name || avatar.name || 'Avatar'}</div>

        {!isEleven ? (
          <div className="mono" style={{ fontSize: 13, color: 'var(--text-3)' }}>
            This avatar's voice is still on HeyGen. Rebuild the twin on ElevenLabs to unlock v3 + voice settings.
          </div>
        ) : (
          <>
            <label className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 18 }}>
              <input type="checkbox" checked={v3} onChange={(e) => { setV3(e.target.checked); setSaved(false); }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>ElevenLabs v3 (expressive + audio tags)</span>
            </label>

            <div style={{ marginBottom: 18 }}>
              <span style={rowLbl}>Stability{v3 ? ' (v3 modes)' : ': ' + Number(stability).toFixed(2)}</span>
              {v3 ? (
                <div className="row" style={{ gap: 6 }}>
                  {[['Creative', 0], ['Natural', 0.5], ['Robust', 1]].map(([name, val]) => (
                    <button key={name} type="button" className={'btn sm' + (Number(stability) === val ? ' primary' : '')}
                      onClick={() => { setStability(val); setSaved(false); }}>{name}</button>
                  ))}
                </div>
              ) : slider(stability, setStability, 0, 1, 0.05)}
            </div>

            <div style={{ marginBottom: 18 }}><span style={rowLbl}>Similarity: {Number(similarity).toFixed(2)}</span>{slider(similarity, setSimilarity, 0, 1, 0.05)}</div>
            <div style={{ marginBottom: 18 }}><span style={rowLbl}>Style / exaggeration: {Number(style).toFixed(2)}</span>{slider(style, setStyle, 0, 1, 0.05)}</div>
            <div style={{ marginBottom: 18 }}><span style={rowLbl}>Speed / pace: {Number(speed).toFixed(2)}&times;</span>{slider(speed, setSpeed, 0.5, 2, 0.05)}</div>

            <label className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 18 }}>
              <input type="checkbox" checked={boost} onChange={(e) => { setBoost(e.target.checked); setSaved(false); }} />
              <span style={{ fontSize: 14 }}>Speaker boost</span>
            </label>

            <div style={{ marginBottom: 16 }}>
              <span style={rowLbl}>Preview script (v3 audio tags in [brackets])</span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', resize: 'vertical' }} />
            </div>

            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <button className="btn" onClick={doPreview} disabled={busy === 'preview'}><Icon name="sparkle" size={13} /> {busy === 'preview' ? 'Synthesizing…' : 'Preview'}</button>
              <button className="btn primary" onClick={doSave} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save voice settings'}</button>
              {saved && <span className="mono" style={{ fontSize: 12, color: 'var(--ok, #3a3)' }}>Saved</span>}
            </div>
            {err && <div className="mono" style={{ fontSize: 12, color: 'var(--accent)', marginTop: 10 }}>{err}</div>}
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 12 }}>Preview is instant and does not spend a render.</div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function LooksModal({ avatar, onClose, onSet }) {
  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 };
  const card = { background: 'var(--surface)', color: 'var(--text)', width: 'min(560px, 94vw)', maxHeight: '88vh', overflowY: 'auto', borderRadius: 10, padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.35)' };
  return createPortal(
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Avatar look</div>
          <button className="btn sm" onClick={onClose} aria-label="Close"><Icon name="close" size={14} /></button>
        </div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 14 }}>
          {avatar._name || avatar.name || 'Avatar'} — pick the HeyGen look this avatar renders with. Changing it does not touch the cloned voice.
        </div>
        <LookPicker avatar={avatar} onSet={onSet} />
      </div>
    </div>,
    document.body
  );
}

function AvatarsSection({ clientId }) {
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openLooks, setOpenLooks] = useState(null);
  const [openVoice, setOpenVoice] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (clientId == null) { setLoading(false); return; }
    let live = true; setLoading(true);
    (async () => {
      try {
        const invRes = await api.listClientInvites(clientId).catch(() => []);
        const rows = Array.isArray(invRes) ? invRes : (invRes && invRes.invites ? invRes.invites : []);
        const tokens = rows.map((r) => r.token).filter(Boolean);
        const nameByToken = {};
        for (const iv of rows) if (iv.token) nameByToken[iv.token] = iv.label || iv.client_email || null;
        const perToken = await Promise.all(tokens.map((t) => api.listAvatars(t).then((r) => r.avatars || []).catch(() => [])));
        const seen = new Set(); const out = [];
        for (const a of perToken.flat()) {
          if (!a || !a.heygen_avatar_id) continue;
          if (a.id != null && seen.has(a.id)) continue;
          if (a.id != null) seen.add(a.id);
          out.push({ ...a, _name: (a.invite_token && nameByToken[a.invite_token]) || a.name || 'Avatar', _token: a.invite_token || tokens[0] || null });
        }
        if (live) setAvatars(out);
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [clientId, refreshKey]);

  return (
    <div style={{ marginTop: 28 }}>
      <div className="label" style={{ marginBottom: 12 }}>AVATARS · recorded twins</div>
      <div className="card card-pad">
        {loading ? (
          <div className="mono" style={{ color: 'var(--text-4)' }}>Loading avatars…</div>
        ) : avatars.length === 0 ? (
          <div className="mono" style={{ color: 'var(--text-4)' }}>No avatars recorded for this client yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {avatars.map((a) => (
              <div key={a.id} className="card" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ height: 96, borderRadius: 6, overflow: 'hidden', background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
                  {a.thumbnail_url
                    ? <img src={a.thumbnail_url} alt={a._name} onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Icon name="avatars" size={22} style={{ color: 'var(--text-3)' }} />}
                </div>
                <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a._name}>{a._name}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{a.created_at ? String(a.created_at).slice(0, 10) : 'ready'}</div>
                <button className="btn sm" onClick={() => setOpenLooks(a.id)} style={{ marginTop: 2 }}>
                  <Icon name="sliders" size={12} /> Looks
                </button>
                {openLooks === a.id && <LooksModal avatar={a} onClose={() => setOpenLooks(null)} onSet={() => { setOpenLooks(null); setRefreshKey((k) => k + 1); }} />}
                <button className="btn sm" onClick={() => setOpenVoice(a.id)}>
                  <Icon name="sparkle" size={12} /> Voice
                </button>
                {openVoice === a.id && <VoiceSettings avatar={a} onClose={() => setOpenVoice(null)} onSaved={() => setRefreshKey((k) => k + 1)} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RichText({ value, onChange }) {
  const ref = React.useRef(null);
  // Sync external value into the div, but never while the user is typing in it
  // (that would clobber the caret). onInput pushes edits back out to state.
  React.useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.innerHTML !== (value || '')) el.innerHTML = value || '';
  }, [value]);
  const exec = (cmd, arg) => {
    if (ref.current) ref.current.focus();
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };
  const tb = { padding: '4px 9px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 12, cursor: 'pointer' };
  return (
    <div>
      <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...tb, fontWeight: 700 }} onClick={() => exec('bold')}>B</button>
        <button type="button" style={{ ...tb, fontStyle: 'italic' }} onClick={() => exec('italic')}>I</button>
        <button type="button" style={{ ...tb, textDecoration: 'underline' }} onClick={() => exec('underline')}>U</button>
        <button type="button" style={tb} onClick={() => exec('formatBlock', 'H3')}>H</button>
        <button type="button" style={tb} onClick={() => exec('insertUnorderedList')}>&bull; List</button>
        <button type="button" style={tb} onClick={() => exec('insertOrderedList')}>1. List</button>
        <button type="button" style={tb} onClick={() => exec('removeFormat')}>Clear</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
        data-ph="Type the client's repository — positioning, offers, key facts. Use the toolbar for headings, bold, and lists."
        style={{
          height: 400, overflowY: 'auto', padding: '12px 14px',
          border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
          background: 'var(--surface-2)', color: 'var(--text)',
          fontFamily: '"DM Sans", inherit', fontSize: 14, lineHeight: 1.55, outline: 'none',
        }}
      />
    </div>
  );
}

function TopicsSection({ clientId, onSendTopicToScripts, reloadSignal, sendLabel }) {
  const [topics, setTopics] = useState([]);
  const [adding, setAdding] = useState('');
  const [addingJob, setAddingJob] = useState('');
  const [editing, setEditing] = useState(null);   // { id, text, job_number }
  // Inline send-to-script panel: pick channels + optional content direction
  // before the topic hands off to the script writer.
  const [sending, setSending] = useState(null);   // { id, channels: {longform,shortform,blog}, extra }
  const [err, setErr] = useState('');

  const load = () => api.listTopics(clientId).then((r) => setTopics(Array.isArray(r) ? r : [])).catch(() => setTopics([]));
  useEffect(() => { if (clientId != null) load(); /* eslint-disable-next-line */ }, [clientId]);
  // Reload when a parent signals a change (e.g. a topic was consumed into a
  // script on the Scripts page). Skipped on first mount (handled above).
  const firstReload = useRef(true);
  useEffect(() => {
    if (firstReload.current) { firstReload.current = false; return; }
    if (clientId != null) load();
    /* eslint-disable-next-line */
  }, [reloadSignal]);

  const inp = { flex: 1, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 14, padding: '8px 10px', boxSizing: 'border-box' };

  const add = async () => {
    const t = adding.trim(); if (!t) return;
    try { await api.addTopic(clientId, t, addingJob.trim() || null); setAdding(''); setAddingJob(''); load(); } catch (e) { setErr(e.message || 'Could not add topic.'); }
  };
  const saveEdit = async () => {
    if (!editing || !editing.text.trim()) return;
    try { await api.updateTopic(clientId, editing.id, editing.text.trim(), (editing.job_number || '').trim() || null); setEditing(null); load(); } catch (e) { setErr(e.message || 'Could not save topic.'); }
  };
  const remove = async (id) => {
    try { await api.deleteTopic(clientId, id); load(); } catch (e) { setErr(e.message || 'Could not delete topic.'); }
  };
  const copy = (text) => { try { navigator.clipboard.writeText(text); } catch { /* ignore */ } };

  // Hand the topic to the script writer (Scripts view) with topic, channels,
  // and direction preloaded. The queue entry is removed there, after a
  // generation succeeds.
  const sendToScript = (topic) => {
    setErr('');
    if (!onSendTopicToScripts) { setErr('Script writer navigation unavailable.'); return; }
    const chans = Object.entries(sending?.channels || {}).filter(([, v]) => v).map(([k]) => k);
    onSendTopicToScripts({
      id: topic.id, text: topic.text, job_number: topic.job_number || '',
      channels: chans.length ? chans : undefined,
      extra: (sending?.extra || '').trim() || undefined,
    });
    setSending(null);
  };

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="label" style={{ marginBottom: 12 }}>TOPICS · queue ideas for script generation</div>
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <input value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="New topic…" style={inp} />
        <input value={addingJob} onChange={(e) => setAddingJob(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Job #" style={{ ...inp, flex: '0 0 90px' }} />
        <button className="btn primary sm" onClick={add}><Icon name="plus" size={13} /> Add topic</button>
      </div>
      {topics.length === 0 ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>No topics yet — add one above.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {topics.map((t) => (
            <div key={t.id} className="card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {editing && editing.id === t.id ? (
                <>
                  <input value={editing.text} autoFocus onChange={(e) => setEditing({ ...editing, text: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} style={inp} />
                  <input value={editing.job_number || ''} onChange={(e) => setEditing({ ...editing, job_number: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} placeholder="Job #" style={{ ...inp, flex: '0 0 90px' }} />
                  <button className="btn sm" onClick={saveEdit}><Icon name="check" size={13} /> Save</button>
                  <button className="btn sm ghost" onClick={() => setEditing(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, fontSize: 14, minWidth: 160 }}>{t.text}{t.job_number ? <span className="mono" style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>Job {t.job_number}</span> : null}</div>
                  <button className="btn sm" onClick={() => copy(t.text)}><Icon name="doc" size={13} /> Copy</button>
                  <button className="btn sm" onClick={() => setEditing({ id: t.id, text: t.text, job_number: t.job_number || '' })}><Icon name="sliders" size={13} /> Edit</button>
                  <button className="btn sm" onClick={() => setSending(sending?.id === t.id ? null : { id: t.id, channels: { longform: true, shortform: true, tvradio: false, blog: false }, extra: '' })}><Icon name="send" size={13} /> {sendLabel || 'Send to script'}</button>
                  <button className="btn sm" style={{ color: 'var(--accent)' }} onClick={() => remove(t.id)}><Icon name="close" size={13} /> Delete</button>
                </>
              )}
              {sending?.id === t.id && !editing && (
              <div className="row" style={{ flex: '1 1 100%', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', marginTop: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="label" style={{ fontSize: 10 }}>CHANNELS</div>
                  {[['longform', 'Longform (LF)'], ['shortform', 'Shortform (SF ×3)'], ['tvradio', 'TV / Radio (×3)'], ['blog', 'Blog']].map(([k, lab]) => (
                    <label key={k} className="mono" style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!sending.channels[k]}
                        onChange={() => setSending({ ...sending, channels: { ...sending.channels, [k]: !sending.channels[k] } })} />
                      {lab}
                    </label>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="label" style={{ fontSize: 10 }}>CONTENT DIRECTION (optional)</div>
                  <textarea value={sending.extra} onChange={(e) => setSending({ ...sending, extra: e.target.value })}
                    placeholder="Any angle, offer, or detail to steer this batch…"
                    style={{ ...inp, minHeight: 54, resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
                <button className="btn primary sm" style={{ alignSelf: 'flex-end' }} onClick={() => sendToScript(t)}><Icon name="send" size={13} /> Send</button>
              </div>
            )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Onboarding checklist — a collapsible card pinned to the top of the brief.
// Tracks the post-agreement setup tasks: percentage complete, per-task assignee
// (from the dashboard user list), and a date/time + name stamp when a task is
// marked done. The "channels" task is derived from truth (every distribution
// channel must be 2FA-verified); the "2FA session" task surfaces the booking
// page. Incomplete tasks read red, completed read green.
function OnboardingCard({ clientId }) {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [showSched, setShowSched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setData(null); setErr(''); setShowSched(false);
    if (clientId == null) return;
    api.getOnboarding(clientId).then(setData).catch((e) => setErr(e.message || 'Could not load onboarding.'));
    api.listUsers().then((u) => setUsers(Array.isArray(u) ? u : [])).catch(() => {});
    api.me().then((m) => setIsAdmin(!!(m && m.role === 'admin'))).catch(() => {});
  }, [clientId]);

  const apply = (promise) => { setErr(''); return promise.then(setData).catch((e) => setErr(e.message || 'Could not update.')); };
  const setAssignee = (t, v) => apply(api.updateOnboardingTask(clientId, t.id, { assignee: v }));
  const toggleNa = (t) => apply(api.updateOnboardingTask(clientId, t.id, { na: !t.na }));
  const toggleDone = (t) => {
    if (t.type === 'derived') return;
    if (!t.done) { const name = ensureOperatorName(); if (!name) return; return apply(api.updateOnboardingTask(clientId, t.id, { done: true, name })); }
    return apply(api.updateOnboardingTask(clientId, t.id, { done: false }));
  };
  const addTask = async () => {
    const l = newLabel.trim(); if (!l) return;
    setBusy(true); setErr('');
    try { const d = await api.addOnboardingTask(clientId, l); setData(d); setNewLabel(''); }
    catch (e) { setErr(e.message || 'Could not add task.'); } finally { setBusy(false); }
  };
  const removeTask = (t) => apply(api.deleteOnboardingTask(clientId, t.id));
  const copyLink = () => { if (data && data.bookingUrl) navigator.clipboard?.writeText(data.bookingUrl); };

  if (clientId == null) return null;

  const pct = (data && data.percent) || 0;
  const complete = !!(data && data.complete);
  const barColor = complete ? 'var(--ok)' : 'var(--accent)';
  const sel = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 12, padding: '5px 8px', maxWidth: 150 };

  return (
    <div className="card card-pad" style={{ marginBottom: 16, borderColor: complete ? 'var(--ok)' : 'var(--border-strong)' }}>
      <div onClick={() => setOpen((o) => !o)} style={{ cursor: 'pointer' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}>
            <span style={{ color: 'var(--text-3)', fontSize: 12, width: 12 }}>{open ? '▾' : '▸'}</span>
            <div className="label" style={{ margin: 0 }}>ONBOARDING</div>
          </div>
          {complete
            ? <span className="mono" style={{ color: 'var(--ok)', fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap' }}>{'✓'} 100% Onboarded</span>
            : <span className="mono" style={{ color: 'var(--text-3)', fontSize: 11.5, whiteSpace: 'nowrap' }}>{data ? `${pct}% · ${data.done}/${data.total}` : 'Loading…'}</span>}
        </div>
        <div style={{ marginTop: 8, height: 8, background: 'var(--surface-3)', borderRadius: 100, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, transition: 'width .3s' }} />
        </div>
      </div>

      {err && <div className="mono" style={{ color: 'var(--accent)', marginTop: 10 }}>{err}</div>}

      {open && data && (
        <div style={{ marginTop: 8, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 4 }}>
          {data.tasks.map((t) => {
            const done = t.done;
            const color = done ? 'var(--ok)' : 'var(--accent)';
            return (
              <div key={t.id} className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                {t.type === 'derived' ? (
                  <span title="Verified automatically from your connected channels" style={{ flex: '0 0 auto', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: `1.5px solid ${color}`, color, fontSize: 12 }}>{done ? '✓' : '↻'}</span>
                ) : (
                  <input type="checkbox" checked={done} onChange={() => toggleDone(t)} disabled={t.na} style={{ flex: '0 0 auto', width: 18, height: 18, accentColor: 'var(--ok)', cursor: t.na ? 'default' : 'pointer' }} />
                )}
                <div style={{ flex: '1 1 240px', minWidth: 200 }}>
                  <div style={{ fontSize: 13.5, color: t.na ? 'var(--text-4)' : (done ? 'var(--ok)' : 'var(--text)'), textDecoration: t.na ? 'line-through' : 'none', fontWeight: done ? 600 : 500 }}>
                    {t.label}{t.is_custom ? <span className="mono" style={{ color: 'var(--text-4)', fontWeight: 400, fontSize: 11 }}> {'·'} custom</span> : null}
                  </div>
                  {t.type === 'derived' && (
                    <div className="mono" style={{ fontSize: 11.5, color, marginTop: 2 }}>
                      {t.derived.total === 0 ? 'No channels added yet — add them in Distribution below.' : `${t.derived.verified}/${t.derived.total} channels 2FA-verified${done ? '' : ' — verify each in Distribution below'}`}
                    </div>
                  )}
                  {done && t.completed_by && (
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{'✓'} {t.completed_by} {'·'} {String(t.completed_at).slice(0, 16).replace('T', ' ')}</div>
                  )}
                  {t.type === 'booking' && (
                    <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                      <a className="btn sm" href={data.bookingUrl} target="_blank" rel="noopener">Open booking page</a>
                      <button className="btn sm" onClick={copyLink}>Copy link</button>
                      <button className="btn sm" onClick={() => setShowSched((v) => !v)}>{showSched ? 'Hide scheduler' : 'Show scheduler'}</button>
                    </div>
                  )}
                  {t.type === 'booking' && showSched && (
                    <iframe src={data.bookingUrl} title="2FA setup booking" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', width: '100%', height: 520, marginTop: 8 }} />
                  )}
                </div>
                <select value={t.assignee || ''} onChange={(e) => setAssignee(t, e.target.value)} disabled={!isAdmin} style={{ ...sel, opacity: isAdmin ? 1 : 0.6 }} title={isAdmin ? 'Assign to' : 'Only admins can assign'}>
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id || u.username} value={u.username}>{u.username}</option>)}
                  {t.assignee && !users.some((u) => u.username === t.assignee) ? <option value={t.assignee}>{t.assignee}</option> : null}
                </select>
                {t.type !== 'derived' && (
                  <button className="btn sm" onClick={() => toggleNa(t)} title="Mark not applicable" style={{ opacity: t.na ? 1 : 0.55 }}>{t.na ? 'N/A ✓' : 'N/A'}</button>
                )}
                {t.is_custom ? <button className="btn sm" onClick={() => removeTask(t)} title="Remove custom task">{'×'}</button> : null}
              </div>
            );
          })}

          <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }} placeholder="Add a custom onboarding task…" style={{ flex: '1 1 260px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, padding: '8px 10px' }} />
            <button className="btn sm primary" onClick={addTask} disabled={busy || !newLabel.trim()}>{busy ? 'Adding…' : 'Add task'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BriefView({ clientId, onSendTopicToScripts }) {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (clientId == null) { setLoading(false); return; }
    setLoading(true); setErr(''); setSaved(false);
    api.getBrief(clientId)
      .then((b) => setForm(b || {}))
      .catch((e) => setErr(e.message || 'Could not load the brief.'))
      .finally(() => setLoading(false));
  }, [clientId]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  const save = async () => {
    if (clientId == null) return;
    setSaving(true); setErr('');
    try {
      const payload = Object.fromEntries(KEYS.map((k) => [k, form[k] ?? '']));
      await api.putBrief(clientId, payload);
      setSaved(true);
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const verifyQA = async () => {
    const name = ensureOperatorName();
    if (!name) return;
    setErr('');
    try { const b = await api.verifyBriefQA(clientId, name); setForm(b || {}); }
    catch (e) { setErr(e.message || 'Could not record verification.'); }
  };
  const clearQA = async () => {
    setErr('');
    try { const b = await api.verifyBriefQA(clientId, ''); setForm(b || {}); }
    catch (e) { setErr(e.message || 'Could not clear verification.'); }
  };

  if (clientId == null) {
    return (
      <div className="v-pad">
        <div className="mono" style={{ color: 'var(--text-3)' }}>
          Select a client on the Clients tab first — then its brief loads here.
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="v-pad"><div className="mono" style={{ color: 'var(--text-3)' }}>Loading brief…</div></div>;
  }

  return (
    <div className="v-pad fade-in">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="label">BRIEF · LIVE</div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, lineHeight: 1.1, margin: '6px 0 16px' }}>
            The client <em>brief</em>.
          </h1>
        </div>
        <div className="row" style={{ gap: 12, alignItems: 'center', paddingTop: 18 }}>
          {saved && <span className="mono" style={{ color: 'var(--ok)' }}>✓ saved</span>}
          <button className="btn primary lg" onClick={save} disabled={saving}>
            <Icon name="check" size={15} stroke={2.2} />
            {saving ? 'Saving…' : 'Save brief'}
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* CENTER COLUMN */}
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
      {err && (
        <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>
        </div>
      )}

      <div className="label" style={{ marginBottom: 12 }}>INFORMATION</div>
      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card card-pad" style={{ flex: '1 1 320px' }}>
          <div className="label" style={{ marginBottom: 12 }}>CONTACT · injected verbatim into scripts</div>
          <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginBottom: 10 }}>
            Approval contact email receives script and episode approval requests. It is not used in generated copy.
          </div>
          {CONTACT.map(([k, label, ml]) => (
            <Field key={k} label={label} multiline={ml} value={form[k] ?? ''} onChange={(v) => set(k, v)} />
          ))}
        </div>
        <DistributionCard clientId={clientId} />
      </div>

      <div className="label" style={{ marginTop: 16, marginBottom: 12 }}>PUBLISHING</div>
      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <PodcastFeedCard clientId={clientId} />
        <SocialDistributionCard clientId={clientId} />
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="label" style={{ marginBottom: 12 }}>REPO · steers the copy</div>
        <RichText value={form.repo_richtext ?? ''} onChange={(v) => set('repo_richtext', v)} />
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="label" style={{ marginBottom: 8 }}>TOPICS TO AVOID · never used in scripts</div>
        <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginBottom: 10 }}>
          No-go subjects, claims, or themes. Anything listed here is excluded when scripts are generated. Also pulled in from the client onboarding form.
        </div>
        <textarea value={form.topics_to_avoid ?? ''} onChange={(e) => set('topics_to_avoid', e.target.value)} rows={4}
          placeholder="e.g. competitor names, pricing/discounts, politics, medical claims — one per line or comma-separated"
          style={{ width: '100%', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', font: 'inherit', fontSize: 13, padding: '9px 11px', boxSizing: 'border-box', resize: 'vertical' }} />
      </div>

      <div className="card card-pad" style={{ marginTop: 16, maxWidth: 480 }}>
        <div className="label" style={{ marginBottom: 12 }}>THEME · brand colors</div>
        {THEME.map(([k, label]) => (
          <div key={k} style={{ marginBottom: 12 }}>
            <div className="label" style={{ marginBottom: 6 }}>{label}</div>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form[k] || '') ? form[k] : '#000000'} onChange={(e) => set(k, e.target.value)}
                style={{ width: 44, height: 34, padding: 0, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', cursor: 'pointer' }} />
              <input value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder="#RRGGBB"
                style={{ flex: 1, height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Topics moved to the Scripts page; Assets moved to the Studio Assets step. */}

      <AvatarsSection clientId={clientId} />

          {/* Internal quality check — moved to the bottom of the center column */}
      <div className="card card-pad" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderColor: form.qa_verified_at ? 'var(--ok)' : 'var(--border)' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="label" style={{ marginBottom: 4 }}>INTERNAL QUALITY CHECK</div>
          {form.qa_verified_at ? (
            <div className="mono" style={{ fontSize: 13, color: 'var(--text-2)' }}>
              I have reviewed the information for this client and verified it for accuracy.
              <div style={{ color: 'var(--ok)', marginTop: 4 }}>✓ {form.qa_verified_by} · {String(form.qa_verified_at).slice(0, 16).replace('T', ' ')}</div>
            </div>
          ) : (
            <div className="mono" style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Not yet verified. Confirm you have reviewed this client's information for accuracy.
            </div>
          )}
        </div>
        {form.qa_verified_at
          ? <button className="btn sm" onClick={clearQA}>Clear</button>
          : <button className="btn primary sm" onClick={verifyQA}><Icon name="check" size={13} /> I have reviewed &amp; verified</button>}
      </div>
        </div>

        {/* RIGHT RAIL — onboarding checklist (collapsible) */}
        <aside style={{ flex: '1 1 300px', minWidth: 260, maxWidth: 360, position: 'sticky', top: 16, alignSelf: 'flex-start' }}>
          <OnboardingCard clientId={clientId} />
        </aside>
      </div>
    </div>
  );
}

export { BriefView, LookPicker, TopicsSection, AssetsSection, VoiceSettings }
