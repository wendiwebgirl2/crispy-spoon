import React, { useState, useEffect } from 'react'
import { listRecordings, recordingDownloadUrl, deleteRecording, listVideos, currentToken } from './api.js'
import { Icon } from './shared.jsx'

// Recordings view — the first dashboard screen onto the R2 masters and the
// HeyGen renders. Reads the Railway backend by token (currentToken(); override
// with ?token=… in the URL). Mapping VoiceCast clients ⇆ Railway tokens is a
// later slice; for now this lists by the active token.

function fmtBytes(b) {
  if (!b && b !== 0) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1024 / 1024).toFixed(2) + ' MB';
}

// Pull the take filename out of an r2://bucket/…/take-xxxx.webm key.
function takeName(storageKey) {
  if (!storageKey) return '';
  const parts = String(storageKey).split('/');
  return parts[parts.length - 1] || storageKey;
}

function RecordingsView() {
  const token = currentToken();
  const [recordings, setRecordings] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [player, setPlayer] = useState(null);   // { id, url }
  const [urlBusy, setUrlBusy] = useState(null);  // recording id being signed
  const [delBusy, setDelBusy] = useState(null);  // recording id being deleted

  const load = async () => {
    setErr('');
    setLoading(true);
    try {
      const [r, v] = await Promise.all([
        listRecordings(token).catch((e) => ({ recordings: [], _err: e.message })),
        listVideos(token).catch(() => ({ videos: [] })),
      ]);
      setRecordings(r.recordings || []);
      setVideos(v.videos || []);
      if (r._err) setErr(r._err);
    } catch (e) {
      setErr(e.message || 'Could not load recordings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const play = async (rec) => {
    setUrlBusy(rec.id); setErr('');
    try {
      const res = await recordingDownloadUrl(rec.id, token);
      setPlayer({ id: rec.id, url: res.url });
    } catch (e) {
      setErr(e.message || 'Could not get a playback URL.');
    } finally {
      setUrlBusy(null);
    }
  };

  const remove = async (rec) => {
    const ok = window.confirm(
      'Permanently delete this master?\n\n' + takeName(rec.storage_key) +
      '\n\nThis removes the original recording from R2 and cannot be undone. ' +
      'Any output built from it will lose its source.'
    );
    if (!ok) return;
    setDelBusy(rec.id); setErr('');
    try {
      await deleteRecording(rec.id, token);
      if (player?.id === rec.id) setPlayer(null);
      await load();
    } catch (e) {
      setErr(e.message || 'Could not delete the recording.');
    } finally {
      setDelBusy(null);
    }
  };

  return (
    <div className="v-pad fade-in">
      <div className="label">RECORDINGS · LIVE · TOKEN {token}</div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, lineHeight: 1.1, margin: '6px 0 4px' }}>
        The <em>masters</em>, and what they became.
      </h1>
      <div className="mono" style={{ color: 'var(--text-3)' }}>
        Consented captures stored in R2 — the source for every stitched output.
      </div>

      {err && (
        <div className="card card-pad" style={{ marginTop: 16, borderColor: 'var(--accent)' }}>
          <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>
        </div>
      )}

      {/* —— masters —— */}
      <div className="label" style={{ marginTop: 24, marginBottom: 10 }}>R2 MASTERS</div>
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>Loading…</div>
      ) : recordings.length === 0 ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>No recordings for this token yet.</div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {recordings.map((rec) => (
            <div key={rec.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                <Icon name="cam" size={18} style={{ color: 'var(--text-3)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {takeName(rec.storage_key)}
                  </div>
                  <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2 }}>
                    {fmtBytes(rec.bytes)} · {rec.mime_type || '—'} · {rec.storage_provider || 'r2'}
                  </div>
                </div>
                <span className="badge">{rec.status || 'uploaded'}</span>
                <button className="btn sm" onClick={() => play(rec)} disabled={urlBusy === rec.id}>
                  <Icon name="play" size={13} />
                  {urlBusy === rec.id ? 'Loading…' : (player?.id === rec.id ? 'Reload' : 'Play')}
                </button>
                <button
                  className="icon-btn"
                  title="Delete master"
                  onClick={() => remove(rec)}
                  disabled={delBusy === rec.id}
                  style={{ color: 'var(--accent)' }}
                >
                  {delBusy === rec.id ? '…' : '✕'}
                </button>
              </div>
              {player?.id === rec.id && (
                <video
                  src={player.url}
                  controls
                  autoPlay
                  style={{ width: '100%', borderRadius: 'var(--r-sm)', background: '#000', maxHeight: 420 }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* —— HeyGen renders —— */}
      <div className="label" style={{ marginTop: 28, marginBottom: 10 }}>HEYGEN RENDERS</div>
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>Loading…</div>
      ) : videos.length === 0 ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>No renders yet.</div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {videos.map((v) => (
            <div key={v.id} className="card card-pad row" style={{ gap: 12, alignItems: 'center' }}>
              <Icon name="studio" size={18} style={{ color: 'var(--text-3)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{v.title || 'Untitled render'}</div>
                <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2 }}>
                  {v.status}{v.progress != null ? ` · ${v.progress}%` : ''}
                </div>
              </div>
              {v.status === 'ready' && v.url && (
                <a className="btn sm" href={v.url} target="_blank" rel="noreferrer">
                  <Icon name="play" size={13} /> Open
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { RecordingsView }
