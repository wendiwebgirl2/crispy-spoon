import React, { useState, useEffect, useRef } from 'react'
import { Icon } from './shared.jsx'
import { ep, video, rec, clientToken } from './dashboard-api.js'

const inputStyle = {
  background: 'var(--surface-2)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
  fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px',
  boxSizing: 'border-box', width: '100%',
};

function SlotCard({ name, label, pathField, full, busy, audioOpts, recordings = [], onUpload, onSynth, onUseRecording }) {
  const [recPick, setRecPick] = useState('');
  return (
    <div className="card card-pad" style={{ marginBottom: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
        <span className="badge" style={{ color: full[pathField] ? 'var(--ok)' : 'var(--text-4)' }}>{full[pathField] ? 'set' : 'empty'}</span>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <input type="file" accept="audio/*" onChange={(e) => onUpload(name, e.target.files[0])} style={{ fontSize: 12, maxWidth: 220 }} />
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
    </div>
  );
}

function VideoCard({ cid, title }) {
  const [token, setToken] = useState(null);
  const [tokenErr, setTokenErr] = useState('');
  const [script, setScript] = useState('');
  const [videos, setVideos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    let alive = true;
    clientToken(cid).then((t) => { if (alive) { setToken(t); if (!t) setTokenErr('No invite/token for this client yet — create an invite first.'); } });
    return () => { alive = false; if (pollRef.current) clearInterval(pollRef.current); };
  }, [cid]);

  const poll = (tok) => {
    const t = tok || token;
    if (!t) return;
    if (pollRef.current) clearInterval(pollRef.current);
    const tick = () => video.list(t).then((d) => {
      const vids = d.videos || [];
      setVideos(vids);
      if (!vids.some((v) => v.status !== 'ready' && v.status !== 'failed')) { clearInterval(pollRef.current); pollRef.current = null; }
    }).catch(() => {});
    tick();
    pollRef.current = setInterval(tick, 4000);
  };

  useEffect(() => { if (token) poll(token); }, [token]);

  const generate = async () => {
    if (!script.trim()) { setErr('Enter a script for the avatar.'); return; }
    if (!token) { setErr('No client token — create an invite first.'); return; }
    setBusy(true); setErr('');
    try { await video.generate(token, script.trim(), title || 'Episode'); poll(token); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="card card-pad" style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>Video version <span className="mono" style={{ color: 'var(--text-4)' }}>HeyGen avatar (stock)</span></div>
      {tokenErr && <div className="mono" style={{ color: 'var(--text-3)', marginTop: 8 }}>{tokenErr}</div>}
      <textarea value={script} onChange={(e) => setScript(e.target.value)} placeholder="Script for the avatar to speak…" style={{ ...inputStyle, minHeight: 80, marginTop: 8, fontFamily: 'var(--f-sans)' }} />
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn primary" onClick={generate} disabled={busy || !token}><Icon name="sparkle" size={13} /> {busy ? 'Sending…' : 'Generate video'}</button>
        <button className="btn sm" onClick={() => poll(token)} disabled={!token}>Refresh</button>
      </div>
      {err && <div className="mono" style={{ color: 'var(--accent)', marginTop: 8 }}>{err}</div>}
      <div className="col" style={{ gap: 8, marginTop: 10 }}>
        {videos.length === 0 ? (
          <div className="mono" style={{ color: 'var(--text-4)' }}>No videos yet.</div>
        ) : videos.map((v) => (
          <div key={v.id} className="card card-pad">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{(v.title || v.script || '').slice(0, 80)}</div>
              <span className="badge" style={{ color: v.status === 'ready' ? 'var(--ok)' : (v.status === 'failed' ? 'var(--accent)' : 'var(--text-2)') }}>{v.status === 'ready' ? 'ready' : (v.status === 'failed' ? 'failed' : 'rendering')}</span>
            </div>
            {v.status === 'ready' && v.url && <video controls src={v.url} style={{ width: '100%', marginTop: 8, borderRadius: 8, background: '#000' }} />}
            {v.status === 'failed' && v.failure_reason && <div className="mono" style={{ color: 'var(--text-3)', marginTop: 6 }}>{v.failure_reason}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function EpisodeEditor({ cid, epId, onChange }) {
  const [full, setFull] = useState(null);
  const [outs, setOuts] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [recToken, setRecToken] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [bust, setBust] = useState(Date.now());
  const [coverPrompt, setCoverPrompt] = useState('');
  const [coverProvider, setCoverProvider] = useState('openai');
  const [coverOverlay, setCoverOverlay] = useState('');
  const [introMusicPrompt, setIntroMusicPrompt] = useState('');
  const [musicPrompt, setMusicPrompt] = useState('');
  const [musicMode, setMusicMode] = useState('segment');

  const refresh = () => ep.full(cid, epId).then((f) => { setFull(f); if (f && f.music_mode) setMusicMode(f.music_mode); }).catch((e) => setErr(e.message));

  useEffect(() => {
    setErr('');
    refresh();
    ep.voiceOutputs(cid).then((o) => setOuts(Array.isArray(o) ? o : (o.outputs || []))).catch(() => setOuts([]));
    clientToken(cid).then((t) => { setRecToken(t); if (t) rec.list(t).then((d) => setRecordings((d && d.recordings) || [])).catch(() => setRecordings([])); }).catch(() => {});
  }, [cid, epId]);

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
    try { await ep.genCover(cid, epId, { prompt: coverPrompt, provider: coverProvider, overlayText: coverOverlay }); setBust(Date.now()); await refresh(); }
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
  const stitch = async () => {
    setBusy('stitch'); setErr('');
    try { await ep.stitch(cid, epId); setBust(Date.now()); await refresh(); onChange && onChange(); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  if (!full) return <div className="mono" style={{ color: 'var(--text-3)' }}>Loading episode…</div>;
  const audioOpts = outs.map((o) => ({ id: o.id, label: (o.text || '').slice(0, 40) || ('output ' + o.id) }));

  return (
    <div className="card card-pad">
      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 22, margin: '0 0 12px' }}>Producing: {full.title}</h2>
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}

      <div className="card card-pad" style={{ marginBottom: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Cover art</div>
          <span className="badge" style={{ color: full.cover_path ? 'var(--ok)' : 'var(--text-4)' }}>{full.cover_path ? 'set' : 'none'}</span>
        </div>
        {full.cover_path && <img src={ep.coverUrl(cid, epId) + '?b=' + bust} alt="cover" style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', marginTop: 10 }} />}
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

      <div className="card card-pad" style={{ marginBottom: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Intro music <span className="mono" style={{ color: 'var(--text-4)' }}>(plays first)</span></div>
          <span className="badge" style={{ color: full.intro_music_path ? 'var(--ok)' : 'var(--text-4)' }}>{full.intro_music_path ? 'set' : 'none'}</span>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input value={introMusicPrompt} onChange={(e) => setIntroMusicPrompt(e.target.value)} placeholder="Describe intro sting" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
          <button className="btn sm" onClick={genIntroMusic} disabled={busy === 'intro_music'}><Icon name="sparkle" size={12} /> Generate</button>
          <input type="file" accept="audio/*" onChange={(e) => doUpload('intro_music', e.target.files[0])} style={{ fontSize: 12, maxWidth: 200 }} />
        </div>
      </div>

      <SlotCard name="intro" label="Intro (VO)" pathField="intro_path" full={full} busy={busy} audioOpts={audioOpts} recordings={recordings} onUpload={doUpload} onSynth={useSynth} onUseRecording={useRecording} />

      <div className="card card-pad" style={{ marginBottom: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Music</div>
          <span className="badge" style={{ color: full.music_path ? 'var(--ok)' : 'var(--text-4)' }}>{full.music_path ? ('set (' + (full.music_mode || 'segment') + ')') : 'none'}</span>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <select value={musicMode} onChange={(e) => setMusicMode(e.target.value)} style={{ ...inputStyle, width: 240 }}>
            <option value="segment">Segment (before body)</option>
            <option value="bed">Bed (under narration)</option>
          </select>
          <input value={musicPrompt} onChange={(e) => setMusicPrompt(e.target.value)} placeholder="Describe the music — mood, no artist names" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
          <button className="btn sm" onClick={genMusic} disabled={busy === 'music'}><Icon name="sparkle" size={12} /> Generate</button>
          <input type="file" accept="audio/*" onChange={(e) => doUpload('music', e.target.files[0])} style={{ fontSize: 12, maxWidth: 200 }} />
        </div>
      </div>

      <SlotCard name="body" label="Main recording (required)" pathField="body_path" full={full} busy={busy} audioOpts={audioOpts} recordings={recordings} onUpload={doUpload} onSynth={useSynth} onUseRecording={useRecording} />
      <SlotCard name="outro" label="Outro" pathField="outro_path" full={full} busy={busy} audioOpts={audioOpts} recordings={recordings} onUpload={doUpload} onSynth={useSynth} onUseRecording={useRecording} />

      <button className="btn primary" onClick={stitch} disabled={busy === 'stitch' || !full.body_path} style={{ marginTop: 6 }}>
        <Icon name="sparkle" size={13} /> {busy === 'stitch' ? 'Stitching…' : 'Stitch into finished episode'}
      </button>
      {!full.body_path && <div className="mono" style={{ color: 'var(--text-4)', marginTop: 6 }}>Set a body recording before stitching.</div>}

      {full.output_path && (
        <div style={{ marginTop: 12 }}>
          <span className="badge" style={{ color: 'var(--ok)' }}>✓ produced</span>
          <audio controls src={ep.fileUrl(cid, epId) + '?b=' + bust} style={{ width: '100%', marginTop: 8 }} />
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <a className="btn sm" href={ep.fileUrl(cid, epId)} target="_blank" rel="noreferrer"><Icon name="download" size={12} /> Download audio</a>
          </div>
        </div>
      )}

      <VideoCard cid={cid} title={full.title} />
    </div>
  );
}

function EpisodesView({ activeClientId }) {
  const cid = activeClientId;
  const [list, setList] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    if (cid == null) { setLoading(false); return Promise.resolve(); }
    setLoading(true); setErr('');
    return ep.list(cid).then((r) => setList(Array.isArray(r) ? r : (r.episodes || [])))
      .catch((e) => setErr(e.message || 'Could not load episodes.')).finally(() => setLoading(false));
  };
  useEffect(() => { setOpenId(null); load(); }, [cid]);

  const create = async () => {
    if (!newTitle.trim()) { setErr('Title needed'); return; }
    setCreating(true); setErr('');
    try { const e = await ep.create(cid, newTitle.trim()); setNewTitle(''); await load(); setOpenId(e.id); }
    catch (e) { setErr(e.message || 'Could not create episode.'); } finally { setCreating(false); }
  };
  const remove = async (id) => {
    if (!window.confirm('Delete this episode and its files?')) return;
    try { await ep.del(cid, id); if (openId === id) setOpenId(null); await load(); }
    catch (e) { setErr(e.message || 'Could not delete.'); }
  };

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
    <div className="v-pad fade-in">
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 10 }}>NEW EPISODE</div>
        <div className="row" style={{ gap: 8 }}>
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Episode title" style={{ ...inputStyle, flex: 1 }} />
          <button className="btn primary" onClick={create} disabled={creating}><Icon name="plus" size={13} /> {creating ? 'Creating…' : 'Create episode'}</button>
        </div>
      </div>

      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}

      {loading ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>Loading episodes…</div>
      ) : list.length === 0 ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>No episodes yet.</div>
      ) : (
        <div className="col" style={{ gap: 8, marginBottom: 16 }}>
          {list.map((e) => (
            <div key={e.id} className="card card-pad row" style={{ gap: 12, alignItems: 'center' }}>
              <Icon name="play" size={16} style={{ color: 'var(--text-3)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</div>
                <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2 }}>{String(e.created_at || '').slice(0, 10)}{e.hasOutput ? ' · produced' : ''}</div>
              </div>
              <span className="badge" style={{ color: e.status === 'done' ? 'var(--ok)' : 'var(--text-2)' }}>{e.status || 'draft'}</span>
              <button className="btn sm" onClick={() => setOpenId(openId === e.id ? null : e.id)}>{openId === e.id ? 'Close' : 'Open'}</button>
              <button className="btn sm" onClick={() => remove(e.id)}><Icon name="more" size={13} /> Delete</button>
            </div>
          ))}
        </div>
      )}

      {openId != null && <EpisodeEditor cid={cid} epId={openId} onChange={load} />}
    </div>
  );
}

export { EpisodesView };
