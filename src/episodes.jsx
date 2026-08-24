import React, { useState, useEffect } from 'react'
import { Icon, downloadWithPrompt, buildArchiveZip } from './shared.jsx'
import { ep, video, rec, clientToken, sched } from './dashboard-api.js'
import { api, episodeWaveformStart, episodeWaveformStatus, episodeWaveformFileUrl } from './api.js'
import { LookPicker } from './brief.jsx'

const inputStyle = {
  background: 'var(--surface-2)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
  fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px',
  boxSizing: 'border-box', width: '100%',
};

// Render a stored 24h "HH:MM" air time as regular 12-hour time (e.g. "2:30 PM").
const fmtAirTime = (t) => {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return '';
  let h = +m[1]; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
};
// "Aired Jun 3, 2026 · 2:30 PM" from air_date/air_time (either may be blank).
const fmtAired = (d, t) => {
  const parts = [];
  if (d) { const dt = new Date(d + 'T00:00:00'); parts.push(isNaN(dt) ? d : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })); }
  if (t) parts.push(fmtAirTime(t));
  return parts.join(' · ');
};

// Duplicated from scripts.jsx / client-detail.jsx (no shared module between
// these views) — change one, change all three.
const typePrefix = (channel, variant) => {
  if (channel === 'shortform') return 'SF' + (variant || 1);
  if (channel === 'longform') return 'LF';
  if (channel === 'tvradio') return 'TV' + (variant || 1);
  if (channel === 'blog') return 'Blog';
  return (channel || '—').slice(0, 2).toUpperCase();
};

// Episode title for a script: "E{n} - {LF/SF#}: {title}" — the episode number
// sits BEFORE the LF/SF tag, then the original title (matches castTitleFor).
const scriptEpLabel = (s) => {
  const n = String(s.episode_number || '').trim().replace(/^E/i, '');
  const t = (s.title && s.title.trim()) || (s.topic && s.topic.trim()) || ('Script ' + s.id);
  return `${n ? `E${n} - ` : ''}${typePrefix(s.channel, s.variant)}: ${t}`;
};

function SlotCard({ name, label, pathField, full, busy, audioOpts, recordings = [], avatarVideos = [], assets = [], onUseAsset, onStillSec, onUpload, onSynth, onUseRecording, onUseVideo, onClearVideo, onClearSlot }) {
  const [recPick, setRecPick] = useState('');
  const [vidPick, setVidPick] = useState('');
  const videoField = name + '_video_path';
  const isVideo = !!full[videoField];
  const stillField = name + '_still_path';
  const hasStill = !!full[stillField];
  const [stillSecs, setStillSecs] = useState(full[name + '_still_sec'] || 5);
  return (
    <div className="card card-pad" style={{ marginBottom: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          {(isVideo || full[pathField] || hasStill) && <button className="btn sm" onClick={() => onClearSlot(name)}>Clear</button>}
          <span className="badge" style={{ color: (isVideo || full[pathField] || hasStill) ? 'var(--ok)' : 'var(--text-4)' }}>{isVideo ? 'video' : (full[pathField] ? (hasStill ? 'audio + image' : 'audio') : (hasStill ? 'image' : 'empty'))}</span>
        </div>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <input type="file" onChange={(e) => onUpload(name, e.target.files[0])} title="Upload any file — audio, image, or video" style={{ fontSize: 12, maxWidth: 220 }} />
        {onUseAsset && assets.length > 0 && (
          <select value="" onChange={(e) => { if (e.target.value) onUseAsset(Number(e.target.value), name); }} style={{ ...inputStyle, width: 220 }}>
            <option value="">Client asset…</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{(a.kind ? a.kind + ' · ' : '') + (a.filename || ('asset ' + a.id))}</option>)}
          </select>
        )}
        {hasStill && !isVideo && !full[pathField] && onStillSec && (
          <label className="mono" style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
            hold
            <input type="number" min="1" max="600" value={stillSecs}
              onChange={(e) => setStillSecs(e.target.value)}
              onBlur={() => onStillSec(name, Number(stillSecs) || 5)}
              style={{ ...inputStyle, width: 64 }} />
            sec
          </label>
        )}
        {audioOpts.length > 0 && (
          <>
            <span className="mono" style={{ color: 'var(--text-4)' }}>or synth:</span>
            <select defaultValue="" onChange={(e) => onSynth(name, e.target.value)} style={{ ...inputStyle, width: 200 }}>
              <option value="">—</option>
              {audioOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </>
        )}
        {busy === name && <span className="mono" style={{ color: 'var(--text-3)' }}>working…</span>}
      </div>
      {recordings.length > 0 && (
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span className="mono" style={{ color: 'var(--text-4)' }}>or client recording:</span>
          <select value={recPick} onChange={(e) => setRecPick(e.target.value)} style={{ ...inputStyle, width: 240 }}>
            <option value="">—</option>
            {recordings.map((r) => <option key={r.id} value={r.id}>take {String(r.id).slice(0, 8)} · {Math.round((r.bytes || 0) / 1024)}KB</option>)}
          </select>
          <button className="btn sm" onClick={() => { if (recPick) onUseRecording(name, recPick); }}>Use recording</button>
        </div>
      )}
      {avatarVideos.length > 0 && (
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span className="mono" style={{ color: 'var(--text-4)' }}>or avatar video:</span>
          <select value={vidPick} onChange={(e) => setVidPick(e.target.value)} style={{ ...inputStyle, width: 240 }}>
            <option value="">—</option>
            {avatarVideos.map((v) => <option key={v.id} value={v.url}>{(v.title || v.script || 'video').slice(0, 50)}</option>)}
          </select>
          <button className="btn sm" onClick={() => { if (vidPick) onUseVideo(name, vidPick); }}>Use video</button>
          {isVideo && <button className="btn sm" onClick={() => onClearVideo(name)}>Clear video</button>}
        </div>
      )}
    </div>
  );
}

function YourAvatars({ cid }) {
  const [avatars, setAvatars] = useState([]);
  const [orphans, setOrphans] = useState([]);
  const [purging, setPurging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openLooks, setOpenLooks] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (cid == null) { setLoading(false); return; }
    let live = true; setLoading(true);
    (async () => {
      try {
        const invRes = await api.listClientInvites(cid).catch(() => []);
        const rows = Array.isArray(invRes) ? invRes : (invRes && invRes.invites ? invRes.invites : []);
        const tokens = rows.map((r) => r.token).filter(Boolean);
        const nameByToken = {};
        for (const iv of rows) if (iv.token) nameByToken[iv.token] = iv.label || iv.client_email || null;
        const perToken = await Promise.all(tokens.map((t) => api.listAvatars(t).then((r) => r.avatars || []).catch(() => [])));
        // Masters still in R2 for this client. An avatar whose source recording
        // was deleted is an orphan: it no longer belongs in the pickable list and
        // still eats a HeyGen twin slot, so it is split out for cleanup.
        const recPerToken = await Promise.all(tokens.map((t) => api.listRecordings(t).then((r) => r.recordings || []).catch(() => [])));
        const recSet = new Set(recPerToken.flat().map((rr) => String(rr.id)));
        const seen = new Set(); const kept = []; const orphaned = [];
        for (const a of perToken.flat()) {
          if (!a || !a.heygen_avatar_id) continue;
          if (a.id != null && seen.has(a.id)) continue;
          if (a.id != null) seen.add(a.id);
          const row = { ...a, _name: (a.invite_token && nameByToken[a.invite_token]) || a.name || 'Avatar', _token: a.invite_token || tokens[0] || null };
          if (a.recording_id != null && recSet.has(String(a.recording_id))) kept.push(row);
          else orphaned.push(row);
        }
        if (live) { setAvatars(kept); setOrphans(orphaned); }
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [cid, refreshKey]);

  const purgeOrphans = async () => {
    if (!orphans.length) return;
    if (!window.confirm(`Delete ${orphans.length} orphaned avatar${orphans.length === 1 ? '' : 's'} from HeyGen to free the twin cap? This cannot be undone.`)) return;
    setPurging(true);
    try {
      for (const o of orphans) { try { await api.deleteAvatar(o._token, o.id); } catch (e) { /* best-effort per HeyGen delete */ } }
      setRefreshKey((k) => k + 1);
    } finally { setPurging(false); }
  };

  return (
    <div style={{ marginTop: 28 }}>
      <div className="label" style={{ marginBottom: 12 }}>Your Avatars</div>
      {orphans.length > 0 && (
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>{orphans.length} orphaned {orphans.length === 1 ? 'avatar' : 'avatars'} (source recording deleted) still using HeyGen slots.</span>
          <button className="btn sm" disabled={purging} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={purgeOrphans}>
            <Icon name="close" size={12} /> {purging ? 'Cleaning up\u2026' : 'Clean up orphaned avatars'}
          </button>
        </div>
      )}
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-4)' }}>Loading avatars…</div>
      ) : avatars.length === 0 ? (
        <div className="mono" style={{ color: 'var(--text-4)' }}>No avatars recorded for this client yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {avatars.map((a) => (
            <div key={a.id} className="card card-pad" style={{ textAlign: 'center' }}>
              <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {a.thumbnail_url ? <img src={a.thumbnail_url} alt={a._name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="avatars" size={20} style={{ color: 'var(--text-4)' }} />}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a._name}</div>
              {a.heygen_group_id && (
                <button className="btn sm" style={{ marginTop: 6 }} onClick={() => setOpenLooks(openLooks === a.id ? null : a.id)}>
                  <Icon name="sliders" size={12} /> Looks
                </button>
              )}
              {openLooks === a.id && <LookPicker avatar={a} onSet={() => { setOpenLooks(null); setRefreshKey((k) => k + 1); }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EpisodeEditor({ cid, epId, onChange }) {
  const [full, setFull] = useState(null);
  const [outs, setOuts] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [recToken, setRecToken] = useState(null);
  const [twinVids, setTwinVids] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [waveform, setWaveform] = useState({ status: 'none', error: null });
  const [stitchJob, setStitchJob] = useState({ status: 'none', error: null });
  const [bust, setBust] = useState(Date.now());
  const [coverPrompt, setCoverPrompt] = useState('');
  const [coverProvider, setCoverProvider] = useState('openai');
  const [coverOverlay, setCoverOverlay] = useState('');
  const [coverAspect, setCoverAspect] = useState('1:1');
  const [introMusicPrompt, setIntroMusicPrompt] = useState('');
  const [musicPrompt, setMusicPrompt] = useState('');
  const [musicMode, setMusicMode] = useState('segment');
  const [assets, setAssets] = useState([]);
  const [airDate, setAirDate] = useState('');
  const [airTime, setAirTime] = useState('');

  const refresh = () => ep.full(cid, epId).then((f) => {
    setFull(f);
    if (f && f.music_mode) setMusicMode(f.music_mode);
    if (f) { setAirDate(f.air_date || ''); setAirTime(f.air_time || ''); }
  }).catch((e) => setErr(e.message));

  // Cover art + Outro card stay image-only, so they keep a filtered list. Every
  // other section takes the full `assets` list (any type) via a single dropdown.
  const isImgAsset = (a) => (a.kind === 'logo' || a.kind === 'background') || /\.(png|jpe?g|webp|gif)$/i.test(a.filename || '');
  const imageAssets = assets.filter(isImgAsset);
  // What a music slot currently holds, for its status badge (audio | video | image).
  const slotKind = (base) => !full ? '' : (full[base + '_video_path'] ? 'video' : (full[base + '_path'] ? 'audio' : (full[base + '_still_path'] ? 'image' : '')));
  const introMusicKind = slotKind('intro_music');
  const introMusicSet = !!introMusicKind;
  const musicKind = slotKind('music');
  const musicSet = !!musicKind;
  const applyAsset = async (assetId, slot) => {
    setBusy('asset'); setErr('');
    try { await ep.useAsset(cid, epId, assetId, slot); setBust(Date.now()); await refresh(); }
    catch (e) { setErr(e.message || 'Could not apply asset.'); }
    finally { setBusy(''); }
  };

  const approve = async () => {
    setBusy('approve'); setErr('');
    try { await ep.approve(cid, epId, 'approved'); await refresh(); }
    catch (e) { setErr(e.message || 'Could not approve.'); }
    finally { setBusy(''); }
  };
  const setFormat = async (fmt) => {
    setErr('');
    try { await ep.setMeta(cid, epId, { output_format: fmt }); await refresh(); }
    catch (e) { setErr(e.message || 'Could not set format.'); }
  };
  const saveAspect = async (asp) => {
    setErr('');
    try { await ep.setMeta(cid, epId, { output_aspect: asp }); await refresh(); }
    catch (e) { setErr(e.message || 'Could not set output shape.'); }
  };
  const saveAir = async () => {
    setBusy('air'); setErr('');
    try { await ep.setMeta(cid, epId, { airDate, airTime }); await refresh(); if (onChange) onChange(); }
    catch (e) { setErr(e.message || 'Could not save air date.'); }
    finally { setBusy(''); }
  };
  const verifyChanges = async () => {
    setBusy('verify'); setErr('');
    try { await ep.approve(cid, epId, 'changes_completed'); await refresh(); }
    catch (e) { setErr(e.message || 'Could not mark changes verified.'); }
    finally { setBusy(''); }
  };
  const sendToClient = async () => {
    setBusy('send'); setErr('');
    try {
      const to = window.prompt('Send this episode for approval to which email?\n(Leave blank to use the brief approval contact.)', '');
      if (to === null) { setBusy(''); return; }
      // Optional custom note included in the approval email. Cancelling this
      // prompt just sends without a note (only the email prompt aborts the send).
      const note = window.prompt('Add an optional note for the client — it is included in the approval email. Leave blank to skip.', '');
      const r = await ep.sendClient(cid, epId, to.trim() || undefined, (note || '').trim() || undefined);
      if (r.email && r.email.sent) alert('Sent to client.');
      else alert((r.email && r.email.error ? r.email.error + '\n\n' : '') + 'Review link: ' + r.review_link);
    } catch (e) { setErr(e.message || 'Could not send.'); }
    finally { setBusy(''); }
  };
  const addToPlanner = async () => {
    setBusy('planner'); setErr('');
    try { await sched.add(cid, { channel: 'episode', channel_name: 'Episode', title: full.title, status: 'draft', notes: 'From episode #' + epId }); alert('Added to planner.'); }
    catch (e) { setErr(e.message || 'Could not add to planner.'); }
    finally { setBusy(''); }
  };
  const startWaveform = async () => {
    setErr('');
    try {
      const r = await episodeWaveformStart(cid, epId);
      setWaveform({ status: r.status || 'pending', error: null });
    } catch (e) { setErr(e.message || 'Could not start waveform render.'); }
  };

  useEffect(() => {
    setErr('');
    refresh();
    ep.voiceOutputs(cid).then((o) => setOuts(Array.isArray(o) ? o : (o.outputs || []))).catch(() => setOuts([]));
    api.listAssets(cid).then((r) => setAssets(Array.isArray(r) ? r : (r && r.assets ? r.assets : []))).catch(() => setAssets([]));
    clientToken(cid).then((t) => {
      setRecToken(t);
      if (t) {
        rec.list(t).then((d) => setRecordings((d && d.recordings) || [])).catch(() => setRecordings([]));
        video.list(t).then((d) => setTwinVids(((d && d.videos) || []).filter((v) => v.status === 'ready' && v.url))).catch(() => setTwinVids([]));
      }
    }).catch(() => {});
    episodeWaveformStatus(cid, epId).then(setWaveform).catch(() => {});
    ep.stitchStatus(cid, epId).then(setStitchJob).catch(() => {});
  }, [cid, epId]);

  // Poll while a waveform render is in progress — this can take a while for a
  // long episode, so it runs as a background job rather than blocking a
  // single request/connection.
  useEffect(() => {
    if (waveform.status !== 'pending') return;
    const t = setInterval(() => {
      episodeWaveformStatus(cid, epId).then(setWaveform).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [waveform.status, cid, epId]);

  // Same for stitching — a long episode's video encode can take several
  // minutes, well past any request/proxy timeout, so it also runs as a
  // background job.
  useEffect(() => {
    if (stitchJob.status !== 'pending') return;
    const t = setInterval(() => {
      ep.stitchStatus(cid, epId).then((r) => {
        setStitchJob(r);
        if (r.status === 'done') { setBust(Date.now()); refresh(); onChange && onChange(); }
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [stitchJob.status, cid, epId]);

  const doUpload = async (slot, file) => {
    if (!file) return;
    setBusy(slot); setErr('');
    try { await ep.upload(cid, epId, slot, file); if (slot === 'music') await ep.musicMode(cid, epId, musicMode); await refresh(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const useSynth = async (slot, audioOutputId) => {
    if (!audioOutputId) return;
    setBusy(slot); setErr('');
    try { await ep.useAudio(cid, epId, slot, Number(audioOutputId)); await refresh(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const useRecording = async (slot, recordingId) => {
    if (!recToken) { setErr('No client token — create an invite first.'); return; }
    setBusy(slot); setErr('');
    try { await ep.useRecording(cid, epId, slot, recordingId, recToken); await refresh(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const genCover = async () => {
    setBusy('cover'); setErr('');
    try { await ep.genCover(cid, epId, { prompt: coverPrompt, provider: coverProvider, overlayText: coverOverlay, aspect: coverAspect }); setBust(Date.now()); await refresh(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const genIntroMusic = async () => {
    setBusy('intro_music'); setErr('');
    try { await ep.genIntroMusic(cid, epId, introMusicPrompt); await refresh(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const genMusic = async () => {
    setBusy('music'); setErr('');
    try { await ep.genMusic(cid, epId, { prompt: musicPrompt, mode: musicMode }); await refresh(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };
  const useVideo = async (slot, videoUrl) => {
    setBusy(slot); setErr('');
    try { await ep.useVideo(cid, epId, slot, videoUrl); await refresh(); }
    catch (e) { setErr(e.message || 'Could not attach video.'); } finally { setBusy(null); }
  };
  const [lightbox, setLightbox] = useState(false);
  const [outroText, setOutroText] = useState('');
  useEffect(() => { setOutroText(full?.outro_text || ''); }, [full?.outro_text]);
  const saveOutroText = async () => {
    setBusy('outro_text'); setErr('');
    try { await ep.outroText(cid, epId, outroText); await refresh(); }
    catch (e) { setErr(e.message || 'Could not save outro text.'); } finally { setBusy(null); }
  };
  const setStillSec = async (slot, seconds) => {
    setErr('');
    try { await ep.stillSec(cid, epId, slot, seconds); await refresh(); }
    catch (e) { setErr(e.message || 'Could not set image duration.'); }
  };
  const clearSlot = async (slot) => {
    if (!window.confirm('Clear this section?')) return;
    setBusy(slot); setErr('');
    try { await ep.clearSlot(cid, epId, slot); setBust(Date.now()); await refresh(); }
    catch (e) { setErr(e.message || 'Could not clear.'); } finally { setBusy(null); }
  };
  const clearVideo = async (slot) => {
    setBusy(slot); setErr('');
    try { await ep.clearVideo(cid, epId, slot); await refresh(); }
    catch (e) { setErr(e.message || 'Could not clear video.'); } finally { setBusy(null); }
  };

  const stitch = async () => {
    setErr('');
    try {
      const r = await ep.stitch(cid, epId);
      setStitchJob({ status: r.status || 'pending', error: null });
    } catch (e) { setErr(e.message); }
  };

  if (!full) return <div className="mono" style={{ color: 'var(--text-3)' }}>Loading episode…</div>;
  const audioOpts = outs.map((o) => ({ id: o.id, label: (o.text || '').slice(0, 40) || ('output ' + o.id) }));

  return (
    <div className="card card-pad">
      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 22, margin: '0 0 12px' }}>Producing: {epTitle(full)}</h2>
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}

      {/* Final format first — decides which renders run, so an audiogram never
          pays for a video render it will not use. */}
      <div className="card card-pad" style={{ marginBottom: 10 }}>
        <div className="label" style={{ marginBottom: 8 }}>FINAL FORMAT · choose before stitching</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {[['audiogram', 'Audiogram'], ['video', 'Video avatar'], ['audio', 'Audio only']].map(([k, lab]) => (
            <button key={k} className="btn sm" onClick={() => setFormat(k)}
              style={{
                background: (full.output_format || 'video') === k ? 'var(--surface-2)' : 'transparent',
                borderColor: (full.output_format || 'video') === k ? 'var(--accent)' : 'var(--border)',
                color: (full.output_format || 'video') === k ? 'var(--text)' : 'var(--text-2)',
              }}>{lab}</button>
          ))}
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)', alignSelf: 'center' }}>
            {(full.output_format || 'video') === 'audiogram' ? 'Stitches audio, then renders the waveform video automatically.'
              : (full.output_format || 'video') === 'audio' ? 'Stitches the podcast audio only.'
              : 'Stitches audio and the full avatar video.'}
          </span>
        </div>
        {(full.output_format || 'video') !== 'audio' && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div className="label" style={{ marginBottom: 8 }}>FORMAT · output shape</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {[['16:9', 'Horizontal', '1920×1080'], ['9:16', 'Vertical', '1080×1920'], ['1:1', 'Square', '1920×1920']].map(([k, lab, dim]) => (
                <button key={k} className="btn sm" onClick={() => saveAspect(k)}
                  style={{
                    background: (full.output_aspect || '16:9') === k ? 'var(--surface-2)' : 'transparent',
                    borderColor: (full.output_aspect || '16:9') === k ? 'var(--accent)' : 'var(--border)',
                    color: (full.output_aspect || '16:9') === k ? 'var(--text)' : 'var(--text-2)',
                  }}>{lab} <span className="mono" style={{ fontSize: 10, opacity: 0.7 }}>{dim}</span></button>
              ))}
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)', alignSelf: 'center' }}>Clips fill this shape; off-shape clips are cropped, not letterboxed.</span>
            </div>
          </div>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Cover art</div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            {imageAssets.length > 0 && (
              <select value="" onChange={(e) => { if (e.target.value) applyAsset(Number(e.target.value), 'cover'); }} style={{ ...inputStyle, width: 170 }}>
                <option value="">Brief asset…</option>
                {imageAssets.map((a) => <option key={a.id} value={a.id}>{(a.kind ? a.kind + ' · ' : '') + (a.filename || ('asset ' + a.id))}</option>)}
              </select>
            )}
            {full.cover_path && <button className="btn sm" onClick={() => clearSlot('cover')}>Clear</button>}
            <span className="badge" style={{ color: full.cover_path ? 'var(--ok)' : 'var(--text-4)' }}>{full.cover_path ? 'set' : 'none'}</span>
          </div>
        </div>
        {full.cover_path && (() => {
          const dims = { '1:1': [150, 150], '9:16': [120, 213], '16:9': [213, 120] }[coverAspect] || [150, 150];
          return <img src={ep.coverUrl(cid, epId) + '?b=' + bust} alt="cover" title="Click to view full size" onClick={() => setLightbox('cover')} style={{ cursor: 'zoom-in', width: dims[0], height: dims[1], objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', marginTop: 10 }} />;
        })()}
        <div className="row" style={{ gap: 6, marginTop: 10, alignItems: 'center' }}>
          <span className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>Aspect</span>
          {['1:1', '9:16', '16:9'].map((a) => (
            <button key={a} className={'btn sm' + (coverAspect === a ? ' primary' : '')} onClick={() => setCoverAspect(a)}>{a}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input value={coverPrompt} onChange={(e) => setCoverPrompt(e.target.value)} placeholder="Describe the cover (AI)" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
          <select value={coverProvider} onChange={(e) => setCoverProvider(e.target.value)} style={{ ...inputStyle, width: 150 }}>
            <option value="openai">OpenAI</option>
            <option value="imagen">Imagen</option>
            <option value="mock">Mock (free)</option>
          </select>
          <button className="btn sm" onClick={genCover} disabled={busy === 'cover'}><Icon name="sparkle" size={12} /> {busy === 'cover' ? 'Generating…' : 'Generate'}</button>
        </div>
        <input value={coverOverlay} onChange={(e) => setCoverOverlay(e.target.value)} placeholder="Optional title to overlay" style={{ ...inputStyle, marginTop: 8 }} />
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <input type="file" accept="image/*" onChange={(e) => doUpload('cover', e.target.files[0])} style={{ fontSize: 12, maxWidth: 220 }} />
        </div>
      </div>
      {lightbox && (
        <div onClick={() => setLightbox(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.8)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 200, cursor: 'zoom-out' }}>
          <img src={(lightbox === 'outro' ? ep.outroImageUrl(cid, epId) : ep.coverUrl(cid, epId)) + '?b=' + bust} alt="full size" style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 10, border: '1px solid var(--border)' }} />
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Intro music <span className="mono" style={{ color: 'var(--text-4)' }}>(plays first — audio, video, or image)</span></div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            {introMusicSet && <button className="btn sm" onClick={() => clearSlot('intro_music')}>Clear</button>}
            <span className="badge" style={{ color: introMusicSet ? 'var(--ok)' : 'var(--text-4)' }}>{introMusicSet ? introMusicKind : 'none'}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {assets.length > 0 && (
            <select value="" onChange={(e) => { if (e.target.value) applyAsset(Number(e.target.value), 'intro_music'); }} style={{ ...inputStyle, width: 200 }}>
              <option value="">Client asset…</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{(a.kind ? a.kind + ' · ' : '') + (a.filename || ('asset ' + a.id))}</option>)}
            </select>
          )}
          <input value={introMusicPrompt} onChange={(e) => setIntroMusicPrompt(e.target.value)} placeholder="Describe intro sting (AI)" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
          <button className="btn sm" onClick={genIntroMusic} disabled={busy === 'intro_music'}><Icon name="sparkle" size={12} /> Generate</button>
          <input type="file" onChange={(e) => doUpload('intro_music', e.target.files[0])} title="Upload any file — audio, image, or video" style={{ fontSize: 12, maxWidth: 200 }} />
        </div>
        {full.intro_music_path && <audio controls src={ep.slotUrl(cid, epId, 'intro_music') + '?b=' + bust} style={{ width: '100%', marginTop: 8 }} />}
        {!full.intro_music_path && introMusicSet && <div className="mono" style={{ color: 'var(--ok)', marginTop: 8 }}>● {introMusicKind} set</div>}
      </div>

      <SlotCard name="intro" label="Intro (VO)" pathField="intro_path" full={full} busy={busy} audioOpts={audioOpts} recordings={recordings} avatarVideos={twinVids} assets={assets} onUseAsset={applyAsset} onStillSec={setStillSec} onUpload={doUpload} onSynth={useSynth} onUseRecording={useRecording} onUseVideo={useVideo} onClearVideo={clearVideo} onClearSlot={clearSlot} />

      <div className="card card-pad" style={{ marginBottom: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Music</div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            {musicSet && <button className="btn sm" onClick={() => clearSlot('music')}>Clear</button>}
            <span className="badge" style={{ color: musicSet ? 'var(--ok)' : 'var(--text-4)' }}>{musicSet ? (musicKind + ' (' + (full.music_mode || 'segment') + ')') : 'none'}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <select value={musicMode} onChange={(e) => setMusicMode(e.target.value)} style={{ ...inputStyle, width: 240 }}>
            <option value="segment">Segment (before body)</option>
            <option value="bed">Bed (under narration)</option>
          </select>
          {assets.length > 0 && (
            <select value="" onChange={(e) => { if (e.target.value) applyAsset(Number(e.target.value), 'music'); }} style={{ ...inputStyle, width: 200 }}>
              <option value="">Client asset…</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{(a.kind ? a.kind + ' · ' : '') + (a.filename || ('asset ' + a.id))}</option>)}
            </select>
          )}
          <input value={musicPrompt} onChange={(e) => setMusicPrompt(e.target.value)} placeholder="Describe the music — mood, no artist names" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
          <button className="btn sm" onClick={genMusic} disabled={busy === 'music'}><Icon name="sparkle" size={12} /> Generate</button>
          <input type="file" onChange={(e) => doUpload('music', e.target.files[0])} title="Upload any file — audio, image, or video" style={{ fontSize: 12, maxWidth: 200 }} />
        </div>
        {full.music_path && <audio controls src={ep.slotUrl(cid, epId, 'music') + '?b=' + bust} style={{ width: '100%', marginTop: 8 }} />}
        {!full.music_path && musicSet && <div className="mono" style={{ color: 'var(--ok)', marginTop: 8 }}>● {musicKind} set</div>}
      </div>

      <SlotCard name="body" label="Main recording (required)" pathField="body_path" full={full} busy={busy} audioOpts={audioOpts} recordings={recordings} avatarVideos={twinVids} assets={assets} onUseAsset={applyAsset} onStillSec={setStillSec} onUpload={doUpload} onSynth={useSynth} onUseRecording={useRecording} onUseVideo={useVideo} onClearVideo={clearVideo} onClearSlot={clearSlot} />
      <SlotCard name="body2" label="Main recording — Part 2 (optional)" pathField="body2_path" full={full} busy={busy} audioOpts={audioOpts} recordings={recordings} avatarVideos={twinVids} assets={assets} onUseAsset={applyAsset} onStillSec={setStillSec} onUpload={doUpload} onSynth={useSynth} onUseRecording={useRecording} onUseVideo={useVideo} onClearVideo={clearVideo} onClearSlot={clearSlot} />
      <SlotCard name="body3" label="Main recording — Part 3 (optional)" pathField="body3_path" full={full} busy={busy} audioOpts={audioOpts} recordings={recordings} avatarVideos={twinVids} assets={assets} onUseAsset={applyAsset} onStillSec={setStillSec} onUpload={doUpload} onSynth={useSynth} onUseRecording={useRecording} onUseVideo={useVideo} onClearVideo={clearVideo} onClearSlot={clearSlot} />
      <SlotCard name="outro" label="Outro" pathField="outro_path" full={full} busy={busy} audioOpts={audioOpts} recordings={recordings} avatarVideos={twinVids} assets={assets} onUseAsset={applyAsset} onStillSec={setStillSec} onUpload={doUpload} onSynth={useSynth} onUseRecording={useRecording} onUseVideo={useVideo} onClearVideo={clearVideo} onClearSlot={clearSlot} />

      <div className="card card-pad" style={{ marginBottom: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Outro card <span className="mono" style={{ color: 'var(--text-4)' }}>(closing image + text, 3 sec at the end)</span></div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            {imageAssets.length > 0 && (
              <select value="" onChange={(e) => { if (e.target.value) applyAsset(Number(e.target.value), 'outro_image'); }} style={{ ...inputStyle, width: 170 }}>
                <option value="">Brief asset…</option>
                {imageAssets.map((a) => <option key={a.id} value={a.id}>{(a.kind ? a.kind + ' · ' : '') + (a.filename || ('asset ' + a.id))}</option>)}
              </select>
            )}
            {full.outro_image_path && <button className="btn sm" onClick={() => clearSlot('outro_image')}>Clear</button>}
            <span className="badge" style={{ color: full.outro_image_path ? 'var(--ok)' : 'var(--text-4)' }}>{full.outro_image_path ? 'set' : 'none'}</span>
          </div>
        </div>
        {full.outro_image_path && (
          <img src={ep.outroImageUrl(cid, epId) + '?b=' + bust} alt="outro card" title="Click to view full size" onClick={() => setLightbox('outro')} style={{ cursor: 'zoom-in', width: 150, height: 150, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', marginTop: 10 }} />
        )}
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <input type="file" accept="image/*" onChange={(e) => doUpload('outro_image', e.target.files[0])} style={{ fontSize: 12, maxWidth: 220 }} />
        </div>
        <textarea value={outroText} onChange={(e) => setOutroText(e.target.value)} maxLength={240}
          placeholder="Optional closing text — line breaks are kept"
          style={{ ...inputStyle, marginTop: 8, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} />
        <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
          <button className="btn sm" onClick={saveOutroText} disabled={busy === 'outro_text'}><Icon name="check" size={12} /> {busy === 'outro_text' ? 'Saving…' : 'Save text'}</button>
          <span className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>{outroText.length}/240</span>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <a className="btn" href={full.output_path ? (full.video_output_path ? ep.videoFileUrl(cid, epId) : ep.fileUrl(cid, epId)) : undefined}
          target="_blank" rel="noreferrer"
          onClick={(ev) => { if (!full.output_path) ev.preventDefault(); }}
          style={{ opacity: full.output_path ? 1 : 0.5, pointerEvents: full.output_path ? 'auto' : 'none' }}>
          <Icon name="play" size={13} /> Preview finished episode
        </a>
        <button className="btn primary" onClick={stitch} disabled={stitchJob.status === 'pending' || !full.body_path}>
          <Icon name="sparkle" size={13} /> {stitchJob.status === 'pending' ? 'Stitching… (can take a few minutes for a long episode)' : 'Stitch into finished episode'}
        </button>
      </div>
      {stitchJob.status === 'error' && <div className="mono" style={{ color: 'var(--accent)', marginTop: 6 }}>{stitchJob.error || 'Stitch failed.'}</div>}
      {!full.body_path && <div className="mono" style={{ color: 'var(--text-4)', marginTop: 6 }}>Set a body recording before stitching.</div>}

      {full.output_path && (
        <div style={{ marginTop: 12 }}>
          <span className="badge" style={{ color: 'var(--ok)' }}>✓ produced</span>
          {full.approval_status === 'approved' && <span className="badge" style={{ color: 'var(--ok)', marginLeft: 6 }}>approved</span>}
          {full.approval_status === 'changes_requested' && <span className="badge" style={{ color: 'var(--accent)', marginLeft: 6 }}>changes requested</span>}
          {full.approval_status === 'changes_completed' && <span className="badge" style={{ color: 'var(--warn)', marginLeft: 6 }}>changes verified</span>}
          {(full.approval_sent_at || full.approval_approved_at || full.changes_verified_at) && (
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
              {full.approval_sent_at ? 'sent ' + String(full.approval_sent_at).slice(0, 10) : ''}
              {full.approval_approved_at ? (full.approval_sent_at ? ' · ' : '') + 'approved ' + String(full.approval_approved_at).slice(0, 10) : ''}
              {full.changes_verified_at ? ((full.approval_sent_at || full.approval_approved_at) ? ' · ' : '') + 'verified ' + String(full.changes_verified_at).slice(0, 10) : ''}
            </div>
          )}
          {full.video_output_path && (
            <video controls src={ep.videoFileUrl(cid, epId) + '?b=' + bust}
              style={{ display: 'block', width: '100%', maxWidth: 480, maxHeight: '70vh', objectFit: 'contain', marginTop: 8, borderRadius: 8, background: '#000' }} />
          )}
          <audio controls src={ep.fileUrl(cid, epId) + '?b=' + bust} style={{ width: '100%', marginTop: 8 }} />
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            {full.video_output_path && <button className="btn sm" onClick={() => downloadWithPrompt(ep.videoFileUrl(cid, epId), (full.title || 'episode').replace(/[^\w-]+/g, '_') + '.mp4')}><Icon name="download" size={12} /> Download video</button>}
            <button className="btn sm" onClick={() => downloadWithPrompt(ep.fileUrl(cid, epId), (full.title || 'episode').replace(/[^\w-]+/g, '_') + '.mp3')}><Icon name="download" size={12} /> Download audio</button>
            {waveform.status === 'ready' ? (
              <>
                <button className="btn sm" onClick={() => downloadWithPrompt(episodeWaveformFileUrl(cid, epId), (full.title || 'episode').replace(/[^\w-]+/g, '_') + '-waveform.mp4')}><Icon name="download" size={12} /> Download waveform video</button>
                <button className="btn sm" onClick={startWaveform}><Icon name="mic" size={12} /> Re-render</button>
              </>
            ) : (
              <button className="btn sm" disabled={waveform.status === 'pending'} onClick={startWaveform}>
                <Icon name="mic" size={12} /> {waveform.status === 'pending' ? 'Rendering waveform… (can take a few minutes for a long episode)' : 'Waveform video'}
              </button>
            )}
            {waveform.status === 'error' && <span className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>{waveform.error || 'Waveform render failed.'}</span>}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn sm" disabled={busy === 'approve'} onClick={approve}><Icon name="check" size={12} /> {full.approval_status === 'approved' ? 'Approved' : 'Approve'}</button>
            {full.approval_status === 'changes_requested' && (
              <button className="btn sm" disabled={busy === 'verify'} onClick={verifyChanges} style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}><Icon name="check" size={12} /> Changes verified</button>
            )}
            <button className="btn sm" disabled={busy === 'send'} onClick={sendToClient}><Icon name="send" size={12} /> {busy === 'send' ? 'Sending…' : (full.approval_status === 'changes_completed' ? 'Resend to client' : 'Send to client')}</button>
            <button className="btn sm" disabled={busy === 'planner'} onClick={addToPlanner}><Icon name="history" size={12} /> Add to planner</button>
          </div>
          {/* Air date/time — record when the episode aired or was distributed. */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="label" style={{ marginBottom: 8 }}>AIR DATE</div>
            <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label className="col" style={{ gap: 4 }}><span className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>Date aired / distributed</span>
                <input type="date" value={airDate} onChange={(e) => setAirDate(e.target.value)} style={{ ...inputStyle, width: 170 }} /></label>
              <label className="col" style={{ gap: 4 }}><span className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>Time</span>
                <input type="time" value={airTime} onChange={(e) => setAirTime(e.target.value)} style={{ ...inputStyle, width: 130 }} /></label>
              <button className="btn sm" disabled={busy === 'air'} onClick={saveAir}><Icon name="check" size={12} /> {busy === 'air' ? 'Saving…' : 'Save air date'}</button>
              {(airDate || airTime) && <button className="btn sm" disabled={busy === 'air'} onClick={() => { setAirDate(''); setAirTime(''); }} title="Clear">✕</button>}
            </div>
            {(full.air_date || full.air_time) && (
              <div className="mono" style={{ color: 'var(--ok)', fontSize: 11, marginTop: 6 }}>Aired {fmtAired(full.air_date, full.air_time)}</div>
            )}
          </div>
        </div>
      )}

      <YourAvatars cid={cid} />
    </div>
  );
}

// Prefix the linked script's episode number to the title (E1 - …). If the title
// already carries an E# prefix (baked in by castTitleFor upstream), leave it be.
function epTitle(e) {
  const t = (e && e.title) || 'Untitled episode';
  if (/^E\d+\s*[-–]/i.test(t.trim())) return t;
  if (e && e.episode_number != null && String(e.episode_number).trim() !== '') {
    return `E${String(e.episode_number).trim()} - ${t}`;
  }
  return t;
}

function EpRow({ cid, e, active, onOpen, onRemove, onArchive }) {
  return (
    <div className="card" onClick={onOpen}
      style={{ padding: 10, cursor: 'pointer', border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'), background: active ? 'var(--surface-2)' : 'var(--surface)' }}>
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {e.hasCover ? <img src={ep.coverUrl(cid, e.id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="play" size={16} style={{ color: 'var(--text-4)' }} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {e.job_number ? <span className="mono" style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 4px', marginRight: 5 }}>Job {e.job_number}</span> : null}
            {epTitle(e)}
          </div>
          <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>
            {String(e.created_at || '').slice(0, 10)} · {e.status || 'draft'}{e.hasOutput ? ' · produced' : ''}
          </div>
          {(e.air_date || e.air_time) && (
            <div className="mono" style={{ color: 'var(--ok)', fontSize: 11, marginTop: 2 }}>
              <Icon name="check" size={10} /> Aired {fmtAired(e.air_date, e.air_time)}
            </div>
          )}
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }} onClick={(ev) => ev.stopPropagation()}>
        <button className="btn sm" onClick={onOpen}>{active ? 'Close' : 'Open'}</button>
        {e.hasOutput && <button className="btn sm" onClick={() => downloadWithPrompt(ep.videoFileUrl(cid, e.id), (e.title || 'episode').replace(/[^\w-]+/g, '_') + '.mp4')}><Icon name="download" size={12} /> Video</button>}
        {e.hasOutput && <button className="btn sm" onClick={() => downloadWithPrompt(ep.fileUrl(cid, e.id), (e.title || 'episode').replace(/[^\w-]+/g, '_') + '.mp3')}><Icon name="download" size={12} /> Audio</button>}
        {onArchive && <button className="btn sm" onClick={onArchive} title="Download a .zip backup (media + manifest), then delete"><Icon name="download" size={12} /> Archive</button>}
        <button className="btn sm" style={{ color: 'var(--accent)' }} onClick={onRemove}><Icon name="close" size={12} /> Delete</button>
      </div>
    </div>
  );
}

function EpisodesView({ activeClientId, episodeRequest, onEpisodeRequestConsumed, onBackToStudio }) {
  const cid = activeClientId;
  const [list, setList] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveLog, setArchiveLog] = useState([]);
  const [showArchiveLog, setShowArchiveLog] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [newJob, setNewJob] = useState('');
  const [newScriptId, setNewScriptId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [approvedScripts, setApprovedScripts] = useState([]);
  useEffect(() => {
    if (activeClientId == null) { setApprovedScripts([]); return; }
    api.listScripts(activeClientId)
      .then((r) => {
        const rows = Array.isArray(r) ? r : (r && r.scripts ? r.scripts : []);
        setApprovedScripts(rows.filter((s) => s.status === 'approved' || (s.approval_status || '').startsWith('approved') || s.approval_status === 'in_production'));
      })
      .catch(() => setApprovedScripts([]));
  }, [activeClientId]);

  const load = () => {
    if (cid == null) { setLoading(false); return Promise.resolve(); }
    setLoading(true); setErr('');
    return Promise.all([
      ep.list(cid).then((r) => setList(Array.isArray(r) ? r : (r.episodes || []))),
      sched.list(cid).then((r) => setSchedule(Array.isArray(r) ? r : (r.schedule || []))).catch(() => setSchedule([])),
    ])
      .catch((e) => setErr(e.message || 'Could not load episodes.')).finally(() => setLoading(false));
  };
  const loadArchiveLog = () => {
    if (cid == null) { setArchiveLog([]); return; }
    ep.archiveLog(cid).then((r) => setArchiveLog(Array.isArray(r) ? r : (r.log || []))).catch(() => setArchiveLog([]));
  };
  useEffect(() => { setOpenId(null); load(); loadArchiveLog(); }, [cid]);

  // A "Create episode" click from the Recordings tab hands us a clip to preload
  // into a fresh episode's body slot (recording master or rendered avatar clip).
  useEffect(() => {
    if (!episodeRequest || cid == null) return;
    // Deep-open from the alerts inbox: just open an existing episode, don't create.
    if (episodeRequest.openId != null) {
      setOpenId(episodeRequest.openId);
      if (onEpisodeRequestConsumed) onEpisodeRequestConsumed();
      return;
    }
    let cancelled = false;
    (async () => {
      setErr('');
      try {
        const title = (episodeRequest.title || 'New episode').slice(0, 120);
        const e = await ep.create(cid, title);
        if (episodeRequest.kind === 'video' && episodeRequest.videoUrl) {
          await ep.useVideo(cid, e.id, 'body', episodeRequest.videoUrl);
        } else if (episodeRequest.kind === 'recording' && episodeRequest.recordingId) {
          await ep.useRecording(cid, e.id, 'body', episodeRequest.recordingId, episodeRequest.token);
        }
        if (cancelled) return;
        await load();
        setOpenId(e.id);
      } catch (err) {
        if (!cancelled) setErr(err.message || 'Could not start an episode from that clip.');
      } finally {
        if (onEpisodeRequestConsumed) onEpisodeRequestConsumed();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [episodeRequest, cid]);

  const create = async () => {
    if (!newTitle.trim()) { setErr('Title needed'); return; }
    setCreating(true); setErr('');
    try { const e = await ep.create(cid, newTitle.trim(), newTopic.trim() || undefined, newJob.trim() || undefined, newScriptId); setNewTitle(''); setNewTopic(''); setNewJob(''); setNewScriptId(null); await load(); setOpenId(e.id); }
    catch (e) { setErr(e.message || 'Could not create episode.'); } finally { setCreating(false); }
  };
  const remove = async (id) => {
    if (!window.confirm('Delete this episode and its files?')) return;
    try { await ep.del(cid, id); if (openId === id) setOpenId(null); await load(); }
    catch (e) { setErr(e.message || 'Could not delete.'); }
  };
  // Archive = download a .zip (media + manifest) FIRST, then offer to delete.
  // Two steps so nothing is purged before the backup exists.
  const archive = async (e) => {
    setErr('');
    try {
      const n = await buildArchiveZip({
        zipName: `episode-${e.id}-${(e.title || 'episode').replace(/[^\w-]+/g, '_')}.zip`,
        files: [
          e.hasVideo && { url: ep.videoFileUrl(cid, e.id), name: 'video.mp4' },
          e.hasOutput && { url: ep.fileUrl(cid, e.id), name: 'audio.mp3' },
          e.hasCover && { url: ep.coverUrl(cid, e.id), name: 'cover.jpg' },
        ].filter(Boolean),
        manifest: { type: 'episode', ...e, archivedAt: new Date().toISOString() },
      });
      if (!window.confirm(`Archive .zip downloaded (${n} file${n === 1 ? '' : 's'} + manifest). Delete this episode and its files permanently now? Make sure the download finished first.`)) return;
      await ep.archive(cid, e.id); if (openId === e.id) setOpenId(null); await load(); loadArchiveLog();
    } catch (err) { setErr('Archive failed — nothing was deleted: ' + (err.message || err)); }
  };

  // An episode is "past" once every schedule row planned for it (it can have
  // more than one — e.g. one per distribution channel) has a scheduled_for in
  // the past. No schedule rows at all, or any row still in the future or
  // undated, means it isn't past yet.
  const now = Date.now();
  const isEpisodePast = (epId) => {
    const rows = schedule.filter((s) => s.episode_id === epId);
    if (!rows.length) return false;
    return rows.every((s) => s.scheduled_for && new Date(s.scheduled_for).getTime() <= now);
  };

  // Group by topic. Episodes with no topic (started from a raw clip, or a
  // manually-typed title with no script picked) never auto-archive — there's
  // no topic to retire them under.
  const { activeList, archivedGroups } = React.useMemo(() => {
    const groups = new Map();
    const untouched = [];
    for (const e of list) {
      const t = (e.topic && e.topic.trim()) || '';
      if (!t) { untouched.push(e); continue; }
      const key = t.toLowerCase();
      if (!groups.has(key)) groups.set(key, { topic: t, items: [] });
      groups.get(key).items.push(e);
    }
    const active = [...untouched];
    const archived = [];
    for (const g of groups.values()) {
      if (g.items.length > 0 && g.items.every((e) => isEpisodePast(e.id))) {
        archived.push(g);
      } else {
        active.push(...g.items);
      }
    }
    active.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return { activeList: active, archivedGroups: archived };
    // eslint-disable-next-line
  }, [list, schedule]);

  if (cid == null) {
    return (
      <div className="v-pad">
        <div className="card card-pad" style={{ borderStyle: 'dashed' }}>
          <div className="label" style={{ marginBottom: 6 }}>EPISODES</div>
          <div className="mono" style={{ color: 'var(--text-3)' }}>Select a client first — episodes are produced per client.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100%', minHeight: 0 }}>
      {/* —— center: new episode + open episode workspace —— */}
      <div style={{ overflow: 'auto', padding: 'var(--pad)' }}>
      {onBackToStudio && <button className="btn sm" style={{ marginBottom: 10 }} onClick={onBackToStudio}><Icon name="arrow-l" size={12} /> Studio</button>}
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 10 }}>NEW EPISODE</div>
        <div className="row" style={{ gap: 8 }}>
          {approvedScripts.length > 0 && (
            <select value="" onChange={(e) => {
              const s = approvedScripts.find((x) => String(x.id) === e.target.value);
              if (!s) return;
              setNewTitle(scriptEpLabel(s));
              setNewTopic((s.topic && s.topic.trim()) || '');
              setNewJob(s.job_number || '');
              setNewScriptId(s.id);
            }} style={{ ...inputStyle, maxWidth: 240 }}>
              <option value="">Approved scripts…</option>
              {approvedScripts.map((s) => (
                <option key={s.id} value={s.id}>{scriptEpLabel(s)}</option>
              ))}
            </select>
          )}
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Episode title" style={{ ...inputStyle, flex: 1 }} />
          <input value={newJob} onChange={(e) => setNewJob(e.target.value)} placeholder="Job #" style={{ ...inputStyle, maxWidth: 90 }} />
          <button className="btn primary" onClick={create} disabled={creating}><Icon name="plus" size={13} /> {creating ? 'Creating…' : 'Create episode'}</button>
        </div>
      </div>

      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}

      {openId != null ? (
        <EpisodeEditor cid={cid} epId={openId} onChange={load} />
      ) : (
        <div className="card card-pad" style={{ borderStyle: 'dashed' }}>
          <div className="mono" style={{ color: 'var(--text-3)' }}>Select an episode from the list on the right to open it here — or create a new one above.</div>
        </div>
      )}
      </div>

      {/* —— right rail: episodes, most recent first —— */}
      <div style={{ borderLeft: '1px solid var(--border)', padding: 'var(--pad)', overflow: 'auto' }}>
        <div className="label" style={{ marginBottom: 10 }}>EPISODES</div>
        {loading ? (
          <div className="mono" style={{ color: 'var(--text-3)' }}>Loading…</div>
        ) : list.length === 0 ? (
          <div className="mono" style={{ color: 'var(--text-3)' }}>No episodes yet.</div>
        ) : activeList.length === 0 ? (
          <div className="mono" style={{ color: 'var(--text-3)' }}>No active episodes — see Archive below.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeList.map((e) => (
              <EpRow key={e.id} cid={cid} e={e} active={openId === e.id}
                onOpen={() => setOpenId(openId === e.id ? null : e.id)} onRemove={() => remove(e.id)} onArchive={() => archive(e)} />
            ))}
          </div>
        )}

        {archivedGroups.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <button className="btn sm" onClick={() => setShowArchive((v) => !v)} style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>Archive / Past episodes ({archivedGroups.reduce((n, g) => n + g.items.length, 0)})</span>
              <Icon name="arrow-r" size={12} style={{ transform: showArchive ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            {showArchive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                {archivedGroups.map((g) => (
                  <div key={g.topic.toLowerCase()}>
                    <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase' }}>{g.topic}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {g.items.map((e) => (
                        <EpRow key={e.id} cid={cid} e={e} active={openId === e.id}
                          onOpen={() => setOpenId(openId === e.id ? null : e.id)} onRemove={() => remove(e.id)} onArchive={() => archive(e)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {archiveLog.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <button className="btn sm" onClick={() => setShowArchiveLog((v) => !v)} style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>Archived episodes log ({archiveLog.length})</span>
              <Icon name="arrow-r" size={12} style={{ transform: showArchiveLog ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            {showArchiveLog && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {archiveLog.map((a) => (
                  <div key={a.id} className="card" style={{ padding: 8, background: 'var(--surface)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.episode_number ? `E${String(a.episode_number).replace(/^E/i, '')} - ` : ''}{a.title || '(untitled)'}</div>
                    <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2 }}>
                      {a.job_number ? `Job ${a.job_number} · ` : ''}archived {String(a.archived_at || '').slice(0, 10)}{a.archived_by ? ' by ' + a.archived_by : ''}
                    </div>
                    {(a.air_date || a.air_time) && <div className="mono" style={{ color: 'var(--text-3)', fontSize: 11 }}>Aired {fmtAired(a.air_date, a.air_time)}</div>}
                    {a.topic && <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>{a.topic}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { EpisodesView };
