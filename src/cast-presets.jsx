// Saved cast settings: the Studio right-column choices (engine, shape,
// resolution, delivery, Hedra direction, background, ...) kept under a name so
// they don't have to be set every time. Shared across the account. A preset
// can be tied to one avatar: it is then applied automatically whenever that
// avatar is picked.
//   getSettings() -> the current settings object (Studio decides what's in it)
//   onApply(preset, automatic) -> Studio sets its state from preset.settings
//   describe(settings) -> short summary line for the Manage list
import React from 'react'
import { listCastPresets, saveCastPreset, updateCastPreset, deleteCastPreset } from './api.js'

export function CastPresets({ token, avatar, getSettings, onApply, describe, selStyle }) {
  const [presets, setPresets] = React.useState(null);
  const [mode, setMode] = React.useState(null); // null | 'save' | 'manage'
  const [name, setName] = React.useState('');
  const [auto, setAuto] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [note, setNote] = React.useState('');
  const lastAuto = React.useRef(null);

  React.useEffect(() => {
    if (!token) return undefined;
    let live = true;
    listCastPresets(token).then((r) => { if (live) setPresets(r.presets || []); }).catch(() => { if (live) setPresets([]); });
    return () => { live = false; };
  }, [token]);

  // Automatic preset for the avatar just picked (once per pick).
  const avatarId = avatar ? avatar.id : null;
  React.useEffect(() => {
    if (!presets || !avatarId || lastAuto.current === avatarId) return;
    lastAuto.current = avatarId;
    const p = presets.find((x) => x.avatar_id === avatarId);
    if (p) onApply(p, true);
  }, [avatarId, presets]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => {
    setBusy(true); setErr('');
    try { const r = await fn(); if (r && r.presets) setPresets(r.presets); return true; }
    catch (e) { setErr(e.message || 'Something went wrong.'); return false; }
    finally { setBusy(false); }
  };
  const style = { ...(selStyle || {}), fontSize: 12, padding: '6px 8px' };
  const avName = avatar ? avatar.label : '';
  const list = presets || [];
  const autoPreset = avatarId ? list.find((x) => x.avatar_id === avatarId) : null;

  if (!token) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
        <select value="" style={{ ...style, flex: 1, minWidth: 0 }} title="Set everything below from saved settings"
          onChange={(e) => {
            const p = list.find((x) => x.id === e.target.value);
            if (p) { onApply(p, false); setNote(`Applied "${p.name}".`); }
          }}>
          <option value="">{presets === null ? 'Loading saved settings…' : list.length ? `Saved cast settings (${list.length})…` : 'No saved cast settings yet'}</option>
          {list.map((p) => <option key={p.id} value={p.id}>{p.name}{p.avatar_id && p.avatar_id === avatarId ? ' · auto for this avatar' : ''}</option>)}
        </select>
        <button className="btn sm" title="Save the settings below under a name" onClick={() => { setMode(mode === 'save' ? null : 'save'); setName(''); setAuto(false); }}>Save</button>
        <button className="btn sm" onClick={() => setMode(mode === 'manage' ? null : 'manage')}>Manage</button>
      </div>
      {autoPreset && <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Automatic for this avatar: "{autoPreset.name}" (applied when picked)</div>}
      {note && <div className="mono" style={{ fontSize: 11, color: 'var(--ok, var(--text-3))', marginTop: 4 }}>{note}</div>}

      {mode === 'save' && (
        <div className="col" style={{ gap: 6, marginTop: 6, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Eli - vertical Hedra 720p" style={{ ...style, width: '100%', boxSizing: 'border-box' }} />
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>Saves: {describe(getSettings())}</div>
          {avatar && (
            <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 12 }}>
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Apply automatically when {avName} is picked
            </label>
          )}
          <button className="btn primary sm" disabled={busy || !name.trim()} style={{ alignSelf: 'flex-start' }}
            onClick={async () => {
              const ok = await run(() => saveCastPreset(token, { name: name.trim(), avatar_id: auto && avatar ? avatar.id : null, settings: getSettings() }));
              if (ok) { setMode(null); setNote(`Saved "${name.trim()}".`); }
            }}>{busy ? 'Saving…' : 'Save settings'}</button>
        </div>
      )}

      {mode === 'manage' && (
        <div className="col" style={{ gap: 6, marginTop: 6, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', maxHeight: 360, overflow: 'auto' }}>
          {list.length === 0 && <div className="mono" style={{ fontSize: 11 }}>Nothing saved yet. Set up a cast below, then press Save.</div>}
          {list.map((p) => {
            const mine = !!(avatar && p.avatar_id === avatar.id);
            return (
              <div key={p.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}{p.avatar_id ? <span className="mono" style={{ fontSize: 10, fontWeight: 400 }}>{mine ? ' · auto for this avatar' : ' · auto for another avatar'}</span> : null}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--text-4)', margin: '2px 0 4px' }}>{describe(p.settings || {})}</div>
                <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                  <button className="btn sm" disabled={busy} title="Replace this preset's settings with what's set now"
                    onClick={() => { if (window.confirm(`Replace "${p.name}" with the current settings?`)) run(() => updateCastPreset(token, p.id, { name: p.name, avatar_id: p.avatar_id, settings: getSettings() })).then((ok) => ok && setNote(`Updated "${p.name}".`)); }}>Update with current</button>
                  {avatar && (
                    <button className="btn sm" disabled={busy}
                      onClick={() => run(() => updateCastPreset(token, p.id, { name: p.name, avatar_id: mine ? null : avatar.id, settings: p.settings }))}>
                      {mine ? 'Stop auto for this avatar' : 'Auto for this avatar'}
                    </button>
                  )}
                  <button className="btn sm" disabled={busy} onClick={() => { if (window.confirm(`Delete the saved settings "${p.name}"?`)) run(() => deleteCastPreset(token, p.id)); }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {err && <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>{err}</div>}
    </div>
  );
}
