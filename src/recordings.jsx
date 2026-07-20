import React, { useState, useEffect } from 'react'
import { listRecordings, recordingDownloadUrl, deleteRecording, listVideos, deleteVideo, renameVideo, refaceRecording, currentToken } from './api.js'
import { api } from './api.js'
import { Icon } from './shared.jsx'
import { LookPicker } from './brief.jsx'

function fmtBytes(b) {
  if (!b && b !== 0) return '-';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1024 / 1024).toFixed(2) + ' MB';
}

function takeName(storageKey) {
  if (!storageKey) return '';
  const parts = String(storageKey).split('/');
  return parts[parts.length - 1] || storageKey;
}

function fmtDate(s) {
  if (!s) return '';
  return String(s).slice(0, 10);
}

function tokensFromInvites(res) {
  const rows = Array.isArray(res) ? res : (res && res.invites ? res.invites : []);
  return rows.map((r) => r && r.token).filter(Boolean);
}

// Square thumbnail with graceful fallback to an icon when no image is available
// (signed URLs are best-effort, so the object may not exist).
function Thumb({ url, icon = 'cam', size = 52 }) {
  const [broken, setBroken] = useState(false);
  const box = { width: size, height: size, borderRadius: 'var(--r-sm)', flex: '0 0 auto', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
  if (url && !broken) {
    return <div style={box}><img src={url} alt="" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>;
  }
  return <div style={box}><Icon name={icon} size={20} style={{ color: 'var(--text-4)' }} /></div>;
}

function RecordingsView({ activeClientId, onCreateEpisode }) {
  const [recordings, setRecordings] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [player, setPlayer] = useState(null);
  const [urlBusy, setUrlBusy] = useState(null);
  const [delBusy, setDelBusy] = useState(null);
  const [detailId, setDetailId] = useState(null);   // expanded avatar-clip detail
  const [draftTitle, setDraftTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatars, setAvatars] = useState([]);
  const [refaceBusy, setRefaceBusy] = useState(null);
  const refaceInput = React.useRef(null);
  const refaceTarget = React.useRef(null);

  const load = async () => {
    setErr('');
    setLoading(true);
    try {
      let tokens = [];
      if (activeClientId != null) {
        try {
          tokens = tokensFromInvites(await api.listClientInvites(activeClientId));
        } catch (e) {
          setErr(e.message || 'Could not load invites.');
        }
      }
      if (activeClientId == null && tokens.length === 0) tokens = [currentToken()];

      const perToken = await Promise.all(
        tokens.map((t) =>
          listRecordings(t)
            .then((r) => (r.recordings || []).map((rec) => ({ ...rec, _token: t })))
            .catch(() => [])
        )
      );
      const seen = new Set();
      const merged = [];
      for (const rec of perToken.flat()) {
        if (seen.has(rec.id)) continue;
        seen.add(rec.id);
        merged.push(rec);
      }
      setRecordings(merged);

      const vids = await Promise.all(
        tokens.map((t) => listVideos(t).then((v) => (v.videos || []).map((x) => ({ ...x, _token: t }))).catch(() => []))
      );
      const vseen = new Set();
      const vmerged = [];
      for (const v of vids.flat()) {
        if (vseen.has(v.id)) continue;
        vseen.add(v.id);
        vmerged.push(v);
      }
      setVideos(vmerged);

      const avs = await Promise.all(
        tokens.map((t) => api.listAvatars(t).then((r) => (r.avatars || []).map((a) => ({ ...a, _token: t }))).catch(() => []))
      );
      const aseen = new Set();
      const amerged = [];
      for (const a of avs.flat()) {
        if (!a || (a.id != null && aseen.has(a.id))) continue;
        if (a.id != null) aseen.add(a.id);
        amerged.push(a);
      }
      setAvatars(amerged);
    } catch (e) {
      setErr(e.message || 'Could not load recordings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeClientId]);

  const play = async (rec) => {
    setUrlBusy(rec.id); setErr('');
    try {
      const res = await recordingDownloadUrl(rec.id, rec._token || currentToken());
      setPlayer({ id: rec.id, url: res.url });
    } catch (e) {
      setErr(e.message || 'Could not get a playback URL.');
    } finally {
      setUrlBusy(null);
    }
  };

  const downloadMaster = async (rec) => {
    setUrlBusy(rec.id); setErr('');
    try {
      const res = await recordingDownloadUrl(rec.id, rec._token || currentToken());
      window.open(res.url, '_blank', 'noopener');
    } catch (e) {
      setErr(e.message || 'Could not get a download URL.');
    } finally {
      setUrlBusy(null);
    }
  };

  const removeMaster = async (rec) => {
    const label = rec.signed_name || takeName(rec.storage_key);
    if (!window.confirm('Permanently delete this master? ' + label + '\nThis cannot be undone.')) return;
    setDelBusy(rec.id); setErr('');
    try {
      await deleteRecording(rec.id, rec._token || currentToken());
      if (player && player.id === rec.id) setPlayer(null);
      await load();
    } catch (e) {
      setErr(e.message || 'Could not delete the recording.');
    } finally {
      setDelBusy(null);
    }
  };

  const removeClip = async (v) => {
    if (!window.confirm('Delete this avatar clip? ' + (v.title || 'Untitled') + '\nThis cannot be undone.')) return;
    setDelBusy(v.id); setErr('');
    try {
      await deleteVideo(v.id, v._token || currentToken());
      await load();
    } catch (e) {
      setErr(e.message || 'Could not delete the clip.');
    } finally {
      setDelBusy(null);
    }
  };

  const openDetail = (v) => {
    if (detailId === v.id) { setDetailId(null); return; }
    setDetailId(v.id);
    setDraftTitle(v.title || '');
  };

  const saveTitle = async (v) => {
    if (!draftTitle.trim()) return;
    setSaving(true); setErr('');
    try {
      await renameVideo(v.id, draftTitle.trim(), v._token || currentToken());
      await load();
    } catch (e) {
      setErr(e.message || 'Could not rename the clip.');
    } finally {
      setSaving(false);
    }
  };

  // The avatar a clip was rendered from — matched on the recording/invitation
  // pair the Railway list endpoint returns on both rows.
  const avatarForClip = (v) => avatars.find((a) =>
    a.recording_id != null && a.recording_id === v.recording_id &&
    (v.invitation_id == null || a.invitation_id === v.invitation_id)
  ) || null;

  const pickReface = (rec) => {
    refaceTarget.current = rec;
    if (refaceInput.current) { refaceInput.current.value = ''; refaceInput.current.click(); }
  };
  const onRefaceFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    const rec = refaceTarget.current;
    if (!file || !rec) return;
    setRefaceBusy(rec.id); setErr('');
    try {
      await refaceRecording(rec.id, file, rec._token || currentToken());
      await load();
    } catch (err) {
      setErr(err.message || 'Could not update the avatar image.');
    } finally {
      setRefaceBusy(null);
      refaceTarget.current = null;
    }
  };

  const makeEpisodeFromMaster = (rec) => {
    if (!onCreateEpisode) return;
    onCreateEpisode({ kind: 'recording', recordingId: rec.id, token: rec._token || currentToken(), title: (rec.signed_name || 'Episode') + ' — ' + fmtDate(new Date().toISOString()) });
  };
  const makeEpisodeFromClip = (v) => {
    if (!onCreateEpisode) return;
    onCreateEpisode({ kind: 'video', videoUrl: v.url, title: (v.title || 'Episode') });
  };

  const scopeLabel = activeClientId != null ? ('CLIENT ' + activeClientId) : ('TOKEN ' + currentToken());
  const btn = { };

  return (
    <div className="v-pad fade-in">
      <input ref={refaceInput} type="file" accept="image/*" onChange={onRefaceFile} style={{ display: 'none' }} />
      <div className="label">RECORDINGS LIVE {scopeLabel}</div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, lineHeight: 1.1, margin: '6px 0 4px' }}>
        The <em>masters</em>, and what they became.
      </h1>
      <div className="mono" style={{ color: 'var(--text-3)' }}>
        Consented captures stored in R2, and the avatar clips rendered from them.
      </div>

      {err && (
        <div className="card card-pad" style={{ marginTop: 16, borderColor: 'var(--accent)' }}>
          <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>
        </div>
      )}

      {/* AVATAR CLIPS (renders) — on top */}
      <div className="label" style={{ marginTop: 24, marginBottom: 10 }}>AVATAR CLIPS</div>
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>Loading…</div>
      ) : videos.length === 0 ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>No avatar clips yet.</div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {videos.map((v) => {
            const open = detailId === v.id;
            const av = open ? avatarForClip(v) : null;
            return (
            <div key={v.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Thumb url={v.thumbnail_url} icon="studio" />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.title || 'Untitled render'}</div>
                  <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2 }}>
                    {fmtDate(v.created_at)} · {v.status}{v.progress != null && v.status !== 'ready' ? ' ' + v.progress + '%' : ''}
                  </div>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {v.status === 'ready' && v.url && (
                    <a className="btn sm" href={v.url} target="_blank" rel="noreferrer"><Icon name="download" size={13} /> Download</a>
                  )}
                  <button className="btn sm" onClick={() => makeEpisodeFromClip(v)} disabled={v.status !== 'ready' || !v.url}><Icon name="plus" size={13} /> Create episode</button>
                  <button className={'btn sm' + (open ? ' primary' : '')} onClick={() => openDetail(v)}><Icon name="sliders" size={13} /> {open ? 'Close' : 'Edit'}</button>
                  <button className="btn sm" style={{ color: 'var(--accent)' }} disabled={delBusy === v.id} onClick={() => removeClip(v)}><Icon name="close" size={13} /> {delBusy === v.id ? '…' : 'Delete'}</button>
                </div>
              </div>

              {open && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1fr)', gap: 16 }}>
                  <div className="col" style={{ gap: 10 }}>
                    <div className="label">CLIP</div>
                    {v.status === 'ready' && v.url ? (
                      <video src={v.url} controls style={{ width: '100%', borderRadius: 'var(--r-sm)', background: '#000', maxHeight: 300 }} />
                    ) : (
                      <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>
                        {v.status === 'failed' ? (v.failure_reason || 'Render failed.') : 'Still rendering — no playable file yet.'}
                      </div>
                    )}
                    <div className="col" style={{ gap: 6 }}>
                      <div className="label">TITLE</div>
                      <div className="row" style={{ gap: 8 }}>
                        <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveTitle(v)}
                          style={{ flex: 1, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 14, padding: '8px 10px' }} />
                        <button className="btn sm" onClick={() => saveTitle(v)} disabled={saving || !draftTitle.trim()}>
                          <Icon name="check" size={13} /> {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                    <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, lineHeight: 1.7 }}>
                      Created {fmtDate(v.created_at)}<br />
                      Status {v.status}{v.progress != null ? ' · ' + v.progress + '%' : ''}<br />
                      {v.heygen_video_id ? 'HeyGen ' + v.heygen_video_id : 'No HeyGen id on this row'}
                    </div>
                  </div>

                  <div className="col" style={{ gap: 10 }}>
                    <div className="label">AVATAR</div>
                    {!av ? (
                      <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>
                        Could not match this clip to an avatar on file.
                      </div>
                    ) : (
                      <>
                        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                          <Thumb url={av.thumbnail_url} icon="avatars" size={64} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{av.name || 'Avatar'}</div>
                            <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2 }}>
                              {av.status || 'ready'}{av.voice_id ? ' · voice cloned' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>
                          Pick the look this avatar renders with. Changing it does not touch the cloned voice.
                        </div>
                        <LookPicker avatar={av} onSet={() => load()} />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* R2 MASTERS — under the avatar clips */}
      <div className="label" style={{ marginTop: 28, marginBottom: 10 }}>R2 MASTERS</div>
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>Loading…</div>
      ) : recordings.length === 0 ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>
          {activeClientId != null ? 'No recordings for this client yet.' : 'No recordings for this token yet.'}
        </div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {recordings.map((rec) => (
            <div key={rec.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Thumb url={rec.thumbnail_url} icon="cam" />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {rec.signed_name || takeName(rec.storage_key)}
                  </div>
                  <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2 }}>
                    {fmtBytes(rec.bytes)} · {rec.mime_type || ''} · {rec.storage_provider || 'r2'}
                  </div>
                </div>
                <span className="badge">{rec.status || 'uploaded'}</span>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn sm" onClick={() => play(rec)} disabled={urlBusy === rec.id}>
                    <Icon name="play" size={13} /> {urlBusy === rec.id ? '…' : (player && player.id === rec.id ? 'Reload' : 'Play')}
                  </button>
                  <button className="btn sm" onClick={() => downloadMaster(rec)} disabled={urlBusy === rec.id}><Icon name="download" size={13} /> Download</button>
                  <button className="btn sm" onClick={() => makeEpisodeFromMaster(rec)}><Icon name="plus" size={13} /> Create episode</button>
                  <button className="btn sm" onClick={() => pickReface(rec)} disabled={refaceBusy === rec.id}><Icon name="cam" size={13} /> {refaceBusy === rec.id ? 'Rebuilding…' : 'Edit image'}</button>
                  <button className="btn sm" style={{ color: 'var(--accent)' }} onClick={() => removeMaster(rec)} disabled={delBusy === rec.id}><Icon name="close" size={13} /> {delBusy === rec.id ? '…' : 'Delete'}</button>
                </div>
              </div>
              {player && player.id === rec.id && (
                <video src={player.url} controls autoPlay style={{ width: '100%', borderRadius: 'var(--r-sm)', background: '#000', maxHeight: 420 }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { RecordingsView }
