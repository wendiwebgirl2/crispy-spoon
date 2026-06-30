import React, { useState, useEffect } from 'react'
import { listRecordings, recordingDownloadUrl, deleteRecording, listVideos, currentToken } from './api.js'
import { api } from './api.js'
import { Icon } from './shared.jsx'

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

function tokensFromInvites(res) {
  const rows = Array.isArray(res) ? res : (res && res.invites ? res.invites : []);
  return rows.map((r) => r && r.token).filter(Boolean);
}

function RecordingsView({ activeClientId }) {
  const [recordings, setRecordings] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [player, setPlayer] = useState(null);
  const [urlBusy, setUrlBusy] = useState(null);
  const [delBusy, setDelBusy] = useState(null);

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
      if (tokens.length === 0) tokens = [currentToken()];

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
        tokens.map((t) => listVideos(t).then((v) => v.videos || []).catch(() => []))
      );
      const vseen = new Set();
      const vmerged = [];
      for (const v of vids.flat()) {
        if (vseen.has(v.id)) continue;
        vseen.add(v.id);
        vmerged.push(v);
      }
      setVideos(vmerged);
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

  const remove = async (rec) => {
    const ok = window.confirm('Permanently delete this master? ' + takeName(rec.storage_key) + ' This cannot be undone.');
    if (!ok) return;
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

  const scopeLabel = activeClientId != null ? ('CLIENT ' + activeClientId) : ('TOKEN ' + currentToken());

  return (
    <div className="v-pad fade-in">
      <div className="label">RECORDINGS LIVE {scopeLabel}</div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, lineHeight: 1.1, margin: '6px 0 4px' }}>
        The <em>masters</em>, and what they became.
      </h1>
      <div className="mono" style={{ color: 'var(--text-3)' }}>
        Consented captures stored in R2.
      </div>

      {err && (
        <div className="card card-pad" style={{ marginTop: 16, borderColor: 'var(--accent)' }}>
          <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>
        </div>
      )}

      <div className="label" style={{ marginTop: 24, marginBottom: 10 }}>R2 MASTERS</div>
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>Loading...</div>
      ) : recordings.length === 0 ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>
          {activeClientId != null ? 'No recordings for this client yet.' : 'No recordings for this token yet.'}
        </div>
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
                    {fmtBytes(rec.bytes)} {rec.mime_type || ''} {rec.storage_provider || 'r2'}
                  </div>
                </div>
                <span className="badge">{rec.status || 'uploaded'}</span>
                <button className="btn sm" onClick={() => play(rec)} disabled={urlBusy === rec.id}>
                  <Icon name="play" size={13} />
                  {urlBusy === rec.id ? 'Loading...' : (player && player.id === rec.id ? 'Reload' : 'Play')}
                </button>
                <button className="icon-btn" title="Delete master" onClick={() => remove(rec)} disabled={delBusy === rec.id} style={{ color: 'var(--accent)' }}>
                  {delBusy === rec.id ? '...' : 'X'}
                </button>
              </div>
              {player && player.id === rec.id && (
                <video src={player.url} controls autoPlay style={{ width: '100%', borderRadius: 'var(--r-sm)', background: '#000', maxHeight: 420 }} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="label" style={{ marginTop: 28, marginBottom: 10 }}>HEYGEN RENDERS</div>
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>Loading...</div>
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
                  {v.status}{v.progress != null ? ' ' + v.progress + '%' : ''}
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
