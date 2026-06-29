import React, { useState, useEffect } from 'react'
import { api } from './api.js'
import { Icon } from './shared.jsx'

// Live Brief editor for the selected client. Contact fields (phone/address/
// mobile/website) are the source of truth the Scripts tab injects verbatim;
// the repository fields (positioning/audience/tone/notes) steer the copy.
const CONTACT = [
  ['phone', 'Phone', false],
  ['mobile', 'Mobile', false],
  ['website', 'Website', false],
  ['address', 'Address', true],
];
const REPO = [
  ['positioning', 'Positioning', true],
  ['audience', 'Audience', true],
  ['tone', 'Brand tone', false],
  ['notes', 'Notes', true],
];
const KEYS = [...CONTACT, ...REPO].map(([k]) => k);

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

function BriefView({ clientId }) {
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
      <div className="label">BRIEF · LIVE · CLIENT {clientId}</div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, lineHeight: 1.1, margin: '6px 0 16px' }}>
        The client <em>brief</em>.
      </h1>

      {err && (
        <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>
        </div>
      )}

      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card card-pad" style={{ flex: '1 1 320px' }}>
          <div className="label" style={{ marginBottom: 12 }}>CONTACT · injected verbatim into scripts</div>
          {CONTACT.map(([k, label, ml]) => (
            <Field key={k} label={label} multiline={ml} value={form[k] ?? ''} onChange={(v) => set(k, v)} />
          ))}
        </div>
        <div className="card card-pad" style={{ flex: '1 1 320px' }}>
          <div className="label" style={{ marginBottom: 12 }}>REPOSITORY · steers the copy</div>
          {REPO.map(([k, label, ml]) => (
            <Field key={k} label={label} multiline={ml} value={form[k] ?? ''} onChange={(v) => set(k, v)} />
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 12, alignItems: 'center', marginTop: 18 }}>
        <button className="btn primary lg" onClick={save} disabled={saving}>
          <Icon name="check" size={15} stroke={2.2} />
          {saving ? 'Saving…' : 'Save brief'}
        </button>
        {saved && (
          <span className="mono" style={{ color: 'var(--ok)' }}>✓ saved</span>
        )}
      </div>
    </div>
  );
}

export { BriefView }
