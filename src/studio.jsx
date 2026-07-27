// components/studio.jsx — Studio: client → destination → type decision flow,
// then either an avatar-video render or full episode assembly (cover, intro
// music, intro/body/outro, music bed/segment, stitch) — mirrors the
// cast.cuecreative.com Episodes tab.

import React from 'react'
import { api, generateVideo, listVideos, deleteVideo, renameVideo, castAudioBlob, castWaveformBlob, listRecordings, createAvatarFromRecording, recordingDownloadUrl } from './api.js'
import { clientToken, voice } from './dashboard-api.js'
import { AvatarTile, Icon, StatusBadge } from './shared.jsx'
import { EpisodesView } from './episodes.jsx'
import { LookPicker } from './brief.jsx'

const SCENES = [
  { id: 'plain',     label: 'Plain', desc: 'No background.' },
  { id: 'office',    label: 'Office', desc: 'Neutral office.' },
  { id: 'studio',    label: 'Studio', desc: 'Branded set.' },
  { id: 'outdoor',   label: 'Outdoor', desc: 'Natural light.' },
];

const DEFAULT_SCRIPT = "Hi! I'm excited you're here. This is a preview of the voice for your character—take a quick listen.";

// destination = where the finished piece goes. types = valid content shapes per
// destination (each presets an aspect ratio). 'download' is always available so a
// client with no connected channels is never a dead end.
const DESTINATIONS = {
  podcast:   { label: 'Podcast',          icon: 'mic',      types: [{ id: 'episode', label: 'Podcast episode', ar: '1:1' }] },
  youtube:   { label: 'YouTube',          icon: 'play',     types: [{ id: 'long', label: 'Video', ar: '16:9' }, { id: 'short', label: 'Short', ar: '9:16' }] },
  instagram: { label: 'Instagram',        icon: 'cam',      types: [{ id: 'reel', label: 'Reel', ar: '9:16' }, { id: 'post', label: 'Feed video', ar: '1:1' }] },
  facebook:  { label: 'Facebook',         icon: 'cam',      types: [{ id: 'post', label: 'Video post', ar: '16:9' }] },
  website:   { label: 'Website / Blog',   icon: 'doc',      types: [{ id: 'embed', label: 'Embedded video', ar: '16:9' }] },
  download:  { label: 'Direct / download', icon: 'download', types: [{ id: 'file', label: 'Video file', ar: '16:9' }] },
};
const CHANNEL_ORDER = ['podcast', 'youtube', 'instagram', 'facebook', 'website'];

const STEPS = [
  { id: 'client',      n: 1, label: 'Client' },
  { id: 'destination', n: 2, label: 'Destination' },
  { id: 'type',        n: 3, label: 'Type' },
];

const StudioView = ({ onNavigate, castRequest, onCastConsumed, activeClientId, onSelectClient }) => {
  // —— decision flow ——
  const [step, setStep] = React.useState('home');   // home | assets | client | destination | type | render
  const [clientId, setClientId] = React.useState(null);
  // Local approval state for casts, keyed on the Railway video id.
  const [castMeta, setCastMeta] = React.useState({});
  // Must stay above the `if (!clientId) return` guard - see the note on
  // refreshCastMeta below. Hooks declared after it change the hook count
  // between renders and blank the page.
  const [buildingTwin, setBuildingTwin] = React.useState(false);
  const [cloningVoice, setCloningVoice] = React.useState(false);

  // Approval state lives in voicecast, keyed on the Railway video id.
  // These hooks must stay above the `if (!clientId) return` early return below:
  // declaring them after it changes the hook count between renders and React
  // throws, blanking the page the moment a client is selected.
  const refreshCastMeta = React.useCallback(async () => {
    if (clientId == null) return;
    try {
      const rows = await api.listCasts(clientId);
      const byId = {};
      (Array.isArray(rows) ? rows : []).forEach((c) => { byId[c.railway_video_id] = c; });
      setCastMeta(byId);
    } catch { /* approval state is additive - never block the cast list */ }
  }, [clientId]);

  React.useEffect(() => { refreshCastMeta(); }, [refreshCastMeta]);
  const [castType, setCastType] = React.useState('video');   // 'video' (HeyGen) | 'audio' (ElevenLabs)
  const [editCast, setEditCast] = React.useState(null);
  const [editCastTitle, setEditCastTitle] = React.useState('');
  const [editCastScript, setEditCastScript] = React.useState('');
  const [editCastAspect, setEditCastAspect] = React.useState('16:9');
  const [recasting, setRecasting] = React.useState(false);
  const [voiceProfiles, setVoiceProfiles] = React.useState([]);
  const [voiceProfileId, setVoiceProfileId] = React.useState('');
  const [audioOutputs, setAudioOutputs] = React.useState([]);
  const [synthing, setSynthing] = React.useState(false);
  const [audioErr, setAudioErr] = React.useState('');
  const [destination, setDestination] = React.useState('download');
  const [contentType, setContentType] = React.useState('file');
  const [renderMode, setRenderMode] = React.useState('video');   // video | assembly

  // —— render step (video) ——
  const [avatarId, setAvatarId] = React.useState(null);
  const [script, setScript] = React.useState(DEFAULT_SCRIPT);
  const [scene, setScene] = React.useState('studio');
  const [language, setLanguage] = React.useState('EN');
  const [aspectRatio, setAspectRatio] = React.useState('16:9');
  const [generating, setGenerating] = React.useState(false);
  const [queue, setQueue] = React.useState([]);

  // —— live data ——
  const [clients, setClients] = React.useState([]);
  const [avatars, setAvatars] = React.useState([]);   // for the selected client
  const [brief, setBrief] = React.useState(null);
  const [credentials, setCredentials] = React.useState([]);
  const [outputKey, setOutputKey] = React.useState('download');
  const [caption, setCaption] = React.useState(false);
  const [backgroundColor, setBackgroundColor] = React.useState(null);
  const [backgroundAssetId, setBackgroundAssetId] = React.useState(null);
  const [bgAssets, setBgAssets] = React.useState([]);
  const [token, setToken] = React.useState(null);

  React.useEffect(() => {
    api.listClients().then(setClients).catch(() => setClients([]));
  }, []);

  const normalizeAvatar = (a) => ({
    ...a,
    contact: a.name || 'Avatar',
    languages: Array.isArray(a.languages) ? a.languages : [],
    // render is proven to work while HeyGen is still 'processing', so a real
    // heygen_avatar_id counts as castable.
    status: a.heygen_avatar_id ? 'ready' : (a.status || 'processing'),
  });

  const loadClient = async (id) => {
    setAvatars([]); setBrief(null); setToken(null); setQueue([]);
    try {
      // Collect every invitation token for this client. Tokens can resolve to
      // different (mirrored) backend client records, so avatars recorded under
      // one invite may live under a different record than another. Fetch avatars
      // for each token and merge, otherwise some of the client's avatars go
      // missing from the list.
      const inviteName = {};
      const tokens = [];
      try {
        const res = await api.listClientInvites(id);
        const rows = Array.isArray(res) ? res : (res && res.invites ? res.invites : []);
        for (const iv of rows) {
          if (!iv || !iv.token) continue;
          tokens.push(iv.token);
          inviteName[iv.token] = iv.label || iv.client_email || null;
        }
      } catch { /* fall back to the ambient token below */ }

      if (tokens.length === 0) {
        const tok = await clientToken(id);
        if (tok) tokens.push(tok);
      }
      setToken(tokens[0] || null);

      // audio-only casting uses the client's ElevenLabs voice profiles
      voice.profiles(id).then((p) => {
        const rows = Array.isArray(p) ? p : [];
        setVoiceProfiles(rows);
        setVoiceProfileId(rows[0] ? String(rows[0].id) : '');
      }).catch(() => { setVoiceProfiles([]); setVoiceProfileId(''); });
      voice.outputs(id).then((o) => setAudioOutputs(Array.isArray(o) ? o : [])).catch(() => setAudioOutputs([]));

      const perToken = await Promise.all(
        tokens.map((t) => api.listAvatars(t).then((r) => r.avatars || []).catch(() => []))
      );
      const seen = new Set();
      const list = [];
      for (const a of perToken.flat()) {
        if (!a) continue;
        // A voice-only recording has no HeyGen twin. Keep it in the list rather
        // than dropping it, flagged so the picker can show it as unavailable for
        // video - otherwise the recording simply vanishes with no explanation.
        const voiceOnly = !a.heygen_avatar_id;
        if (a.id != null && seen.has(a.id)) continue;     // dedupe across tokens
        if (a.id != null) seen.add(a.id);
        list.push({
          ...normalizeAvatar(a),
          _voiceOnly: voiceOnly,
          _token: a.invite_token || tokens[0] || null,
          _invite: (a.invite_token && inviteName[a.invite_token]) || a.name || null,
        });
      }
      // Recordings whose twin has not been built yet. Without these the Cast
      // page shows nothing for a client who has recorded but has no avatar -
      // which is every voice-only take, and every take before its twin exists.
      try {
        const builtFrom = new Set(list.map((a) => a.recording_id).filter(Boolean).map(String));
        const results = await Promise.all(
          tokens.map((t) => listRecordings(t)
            .then((r) => ({ ok: true, rows: (Array.isArray(r) ? r : (r.recordings || [])).map((rec) => ({ ...rec, _token: t })) }))
            .catch(() => ({ ok: false, rows: [] })))
        );
        const perTokenRecs = results.map((r) => r.rows);
        const allFetchesOk = results.every((r) => r.ok);

        // Deleting a recording does not delete the avatar built from it, so the
        // twin lingers in the picker pointing at a file that no longer exists.
        // Drop those - but only when every recordings fetch succeeded, so a
        // network blip cannot wipe the list.
        if (allFetchesOk) {
          const liveRecIds = new Set(perTokenRecs.flat().map((rec) => String(rec.id)));
          for (let i = list.length - 1; i >= 0; i--) {
            const a = list[i];
            if (a.recording_id != null && !liveRecIds.has(String(a.recording_id))) list.splice(i, 1);
          }
        }

        const recSeen = new Set();
        for (const rec of perTokenRecs.flat()) {
          if (!rec || rec.id == null) continue;
          if (builtFrom.has(String(rec.id))) continue;
          if (recSeen.has(String(rec.id))) continue;
          recSeen.add(String(rec.id));
          list.push({
            id: 'rec_' + rec.id,
            _recordingId: rec.id,
            _unbuilt: true,
            _token: rec._token || tokens[0] || null,
            _invite: rec.signed_name || rec.title || 'Recording',
            contact: rec.signed_name || 'Recording',
            name: rec.signed_name || 'Recording',
            status: 'unbuilt',
            languages: [],
            heygen_avatar_id: null,
            progress: 0,
            created_at: rec.uploaded_at || rec.created_at || null,
          });
        }
      } catch { /* recordings are additive - never block the avatar list */ }

      setAvatars(list);
    } catch { /* no token / no avatars yet */ }
    api.getBrief(id).then(setBrief).catch(() => setBrief(null));
    api.listCredentials(id).then((r) => setCredentials(Array.isArray(r) ? r : (r && r.credentials ? r.credentials : []))).catch(() => setCredentials([]));
    api.listAssets(id).then((r) => setBgAssets((Array.isArray(r) ? r : []).filter((a) => a.kind === 'background'))).catch(() => setBgAssets([]));
  };

  // Load previous casts as soon as a client/token is available, so opening the
  // cast window shows what's already been rendered (not just this session's).
  React.useEffect(() => {
    if (!token) { setQueue([]); return; }
    listVideos(token).then((v) => setQueue(v.videos || [])).catch(() => {});
  }, [token]);

  // Live-refresh recent renders while any video is still rendering.
  React.useEffect(() => {
    if (!token) return;
    const active = queue.some((v) => v.status && v.status !== 'ready' && v.status !== 'failed');
    if (!active) return;
    const t = setInterval(() => {
      listVideos(token).then((v) => setQueue(v.videos || [])).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [token, queue]);

  const client = clientId ? clients.find(c => c.id === clientId) : null;
  const clientAvatars = avatars;
  const primaryAvatar = clientAvatars[0] || null;

  // Land-directly-on-cast: pick/switch client inline (no destination/type walk)
  // and auto-select the first avatar so the cast UI is immediately usable.
  const selectClientInline = (id) => {
    setClientId(id);
    setAvatarId(null);
    loadClient(id);
  };

  // Open the cast window from elsewhere in the app. Two callers: "Cast this
  // script" sends a body to preload, and "Cast a script" on the Recordings tab
  // sends only a clientId. Guarding on body would make the second do nothing at
  // all, so only a castRequest is required here.
  React.useEffect(() => {
    if (!castRequest) return;
    setStep('render');
    if (castRequest.clientId != null) selectClientInline(castRequest.clientId);
    if (castRequest.body != null) setScript(castRequest.body);
    if (onCastConsumed) onCastConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castRequest]);
  React.useEffect(() => {
    if (!avatarId && avatars.length > 0) {
      const first = avatars[0];
      setAvatarId(first.id);
      if (first._token) setToken(first._token);
    }
  }, [avatars]);   // eslint-disable-line react-hooks/exhaustive-deps

  const pickClient = (id) => {
    setClientId(id);
    setDestination(null);
    setContentType(null);
    setStep('destination');
    loadClient(id);
  };
  const pickDestination = (k) => {
    setDestination(k);
    setContentType(null);
    setStep('type');
  };
  const chooseType = (t) => {
    setContentType(t.id);
    setAspectRatio(t.ar);
    // podcast episodes open straight into assembly; everything else into video
    setRenderMode(t.id === 'episode' || destination === 'podcast' ? 'assembly' : 'video');
    const readyHere = clientAvatars.filter(a => a.status === 'ready');
    const a = readyHere[0] || primaryAvatar;
    if (a) {
      setAvatarId(a.id);
      if (a._token) setToken(a._token);
      setLanguage((a.languages && a.languages[0]) || 'EN');
    }
    setStep('render');
  };
  const startOver = () => {
    setStep('client');
    setClientId(null);
    setDestination(null);
    setContentType(null);
  };

  /* ──────────────── STEP 1 · CLIENT ──────────────── */
  if (step === 'home') {
    const cards = [
      { id: 'scripts',    label: 'Scripts',       desc: 'Write & manage client scripts',      icon: 'doc',     go: () => onNavigate?.('scripts') },
      { id: 'recordings', label: 'Recordings',    desc: 'Client masters & cue:cast renders',  icon: 'play',    go: () => onNavigate?.('recordings') },
      { id: 'cast',       label: 'Cast a script', desc: 'Quick-render an avatar video',        icon: 'sparkle', go: () => setStep('render') },
      { id: 'assets',     label: 'Assets',        desc: 'Logos, music, backgrounds & fonts',  icon: 'upload',  go: () => setStep('assets') },
      { id: 'planner',    label: 'Planner',       desc: 'Approved episodes ready to publish', icon: 'history', go: () => onNavigate?.('planner') },
      { id: 'episodes',   label: 'Episodes',      desc: 'Stitch audio + video episodes',      icon: 'studio',  go: () => onNavigate?.('episodes') },
    ];
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)', overflow: 'auto', height: '100%' }}>
        <button className="btn sm" onClick={() => onNavigate('clients')}><Icon name="arrow-l" size={12} /> Clients</button>
        <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, letterSpacing: '-0.01em', margin: '18px 0 4px' }}>
          <em style={{ color: 'var(--accent)' }}>Studio</em>
        </h1>
        <div className="mono" style={{ marginBottom: 14 }}>Everything for producing an episode &mdash; pick where you want to work.</div>
        <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 24 }}>
          <span className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>Client</span>
          <select value={activeClientId || ''} onChange={(e) => onSelectClient && onSelectClient(Number(e.target.value) || null)}
            style={{ padding: '7px 10px', borderRadius: 'var(--r-sm)', border: '1px solid ' + (activeClientId ? 'var(--border)' : 'var(--accent)'), background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13, minWidth: 220 }}>
            <option value="">Which client…?</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {!activeClientId && <span className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>Pick a client so every studio page opens ready to work.</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)' }}>
          {cards.map(c => (
            <button key={c.id} className="card card-pad" onClick={c.go}
              style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
              <Icon name={c.icon} size={20} style={{ color: 'var(--accent)' }} />
              <div style={{ fontSize: 18, fontFamily: '"DM Sans"', letterSpacing: '-0.01em' }}>{c.label}</div>
              <div className="mono" style={{ color: 'var(--text-4)' }}>{c.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'assets') {
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)', overflow: 'auto', height: '100%' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn sm" onClick={() => onNavigate('clients')}><Icon name="arrow-l" size={12} /> Clients</button>
          <button className="btn sm" onClick={() => setStep('home')}><Icon name="arrow-l" size={12} /> Studio</button>
        </div>
        <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, letterSpacing: '-0.01em', margin: '18px 0 4px' }}>Assets</h1>
        <div className="mono" style={{ color: 'var(--text-4)' }}>A shared library of logos, music, backgrounds, and fonts for stitching &mdash; coming soon.</div>
      </div>
    );
  }

  if (step === 'client') {
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)', overflow: 'auto', height: '100%' }}>
        <Stepper current="client" />
        <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, letterSpacing: '-0.01em', margin: '18px 0 4px' }}>
          Which <em style={{ color: 'var(--accent)' }}>client</em> are we casting for?
        </h1>
        <div className="mono" style={{ marginBottom: 24 }}>Pick the client, then where it's going and what shape it takes.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--gap)' }}>
          {clients.length === 0 && (
            <div className="mono" style={{ gridColumn: '1 / -1', color: 'var(--text-4)' }}>No clients yet.</div>
          )}
          {clients.map(c => (
            <button key={c.id} className="card card-pad" onClick={() => pickClient(c.id)}
              style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 18, fontFamily: '"DM Sans"', letterSpacing: '-0.01em' }}>{c.name}</div>
              <div className="mono" style={{ color: 'var(--text-4)', marginTop: 2 }}>
                {c.created_at ? `added ${String(c.created_at).slice(0, 10)}` : `id ${c.id}`}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ──────────────── STEP 2 · DESTINATION ──────────────── */
  if (step === 'destination') {
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)', overflow: 'auto', height: '100%' }}>
        <Stepper current="destination" />
        <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, letterSpacing: '-0.01em', margin: '18px 0 4px' }}>
          Where does this go for <em style={{ color: 'var(--accent)' }}>{client.companyName}</em>?
        </h1>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 24 }}>
          <span className="mono">Connected channels come from the client's brief.</span>
          <button className="btn sm" onClick={() => setStep('client')}><Icon name="more" size={12} /> Change client</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)' }}>
          {CHANNEL_ORDER.map(k => {
            const meta = DESTINATIONS[k];
            const s = brief && brief.socials ? brief.socials[k] : null;
            const connected = !!(s && s.handle);
            return (
              <button key={k} disabled={!connected} onClick={() => connected && pickDestination(k)}
                className="card card-pad"
                style={{
                  textAlign: 'left', color: 'inherit',
                  cursor: connected ? 'pointer' : 'not-allowed',
                  opacity: connected ? 1 : 0.5,
                  display: 'flex', flexDirection: 'column', gap: 8
                }}>
                <Icon name={meta.icon} size={18} style={{ color: connected ? 'var(--accent)' : 'var(--text-4)' }} />
                <div style={{ fontSize: 15, fontFamily: '"DM Sans"' }}>{meta.label}</div>
                <div className="mono" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {connected ? s.handle : 'not connected'}
                </div>
              </button>
            );
          })}
          <button onClick={() => pickDestination('download')} className="card card-pad"
            style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Icon name="download" size={18} style={{ color: 'var(--accent)' }} />
            <div style={{ fontSize: 15, fontFamily: '"DM Sans"' }}>{DESTINATIONS.download.label}</div>
            <div className="mono">no channel needed</div>
          </button>
        </div>
      </div>
    );
  }

  /* ──────────────── STEP 3 · TYPE ──────────────── */
  if (step === 'type') {
    const types = DESTINATIONS[destination].types;
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)', overflow: 'auto', height: '100%' }}>
        <Stepper current="type" />
        <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, letterSpacing: '-0.01em', margin: '18px 0 4px' }}>
          What <em style={{ color: 'var(--accent)' }}>type</em> for {DESTINATIONS[destination].label}?
        </h1>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 24 }}>
          <span className="mono">Sets the format and aspect ratio for the render.</span>
          <button className="btn sm" onClick={() => setStep('destination')}><Icon name="more" size={12} /> Change destination</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--gap)' }}>
          {types.map(t => (
            <button key={t.id} onClick={() => chooseType(t)} className="card card-pad"
              style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontFamily: '"DM Sans"' }}>{t.label}</div>
                <div className="mono" style={{ marginTop: 4 }}>{DESTINATIONS[destination].label}</div>
              </div>
              <span className="badge"><Icon name="cam" size={11} /> {t.ar}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ──────────────── RENDER STEP ──────────────── */
  if (!clientId) {
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)', overflow: 'auto', height: '100%' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn sm" onClick={() => onNavigate('clients')}><Icon name="arrow-l" size={12} /> Clients</button>
          <button className="btn sm" onClick={() => setStep('home')}><Icon name="arrow-l" size={12} /> Studio</button>
        </div>
        <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, letterSpacing: '-0.01em', margin: '18px 0 8px' }}>
          Cast a <em style={{ color: 'var(--accent)' }}>script</em>
        </h1>
        <div className="mono" style={{ marginBottom: 16 }}>Choose a client to cast for.</div>
        <select value="" onChange={(e) => { const c = clients.find(x => String(x.id) === e.target.value); if (c) selectClientInline(c.id); }}
          style={{ width: '100%', maxWidth: 360, padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 14, cursor: 'pointer' }}>
          <option value="" disabled>Select a client…</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    );
  }
  const avatar = (avatarId ? avatars.find(a => a.id === avatarId) : null) || null;
  const typeLabel = (DESTINATIONS[destination].types.find(t => t.id === contentType) || {}).label || '';

  if (!avatar) {
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)' }}>
        <div className="mono" style={{ marginBottom: 16 }}>This client has no avatar to cast yet.</div>
        <button className="btn" onClick={startOver}><Icon name="more" size={12} /> Start over</button>
      </div>
    );
  }

  const readyAvatars = clientAvatars;   // client-scoped; non-ready shown disabled
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estSeconds = Math.max(5, Math.round(wordCount / 2.5));
  const estCost = (estSeconds * 0.04).toFixed(2);
  const canGenerate = !generating && !!script.trim() && !!avatar && avatar.status === 'ready' && !avatar._unbuilt;

  const reloadQueue = async () => {
    if (!token) return;
    try { const v = await listVideos(token); setQueue(v.videos || []); } catch { /* ignore */ }
    refreshCastMeta();
  };
  const approveCast = async (v) => {
    try {
      await api.setCastApproval(clientId, v.id, 'approved', v.title || null);
      await refreshCastMeta();
    } catch (e) { window.alert('Could not approve: ' + e.message); }
  };

  const sendCastForReview = async (v) => {
    const to = window.prompt('Send this cast for review to which email?\n(Leave blank to use the brief approval contact.)', '');
    if (to === null) return;
    try {
      const r = await api.sendCastForReview(clientId, v.id, v.title || null, to.trim() || undefined);
      if (r && r.email && r.email.sent) {
        window.alert('Review link sent.');
      } else {
        window.alert('Marked pending, but the email did not send: '
          + ((r && r.email && r.email.error) || 'unknown')
          + (r && r.review_link ? '\n\nLink: ' + r.review_link : ''));
      }
      await refreshCastMeta();
    } catch (e) { window.alert('Could not send: ' + e.message); }
  };

  const addCastToPlanner = async (v) => {
    const when = window.prompt('Schedule for which date? (YYYY-MM-DD, or leave blank to add as a draft)', '');
    if (when === null) return;
    try {
      await api.addCastToPlanner(clientId, v.id, v.title || null, when.trim() || undefined);
      window.alert(when.trim() ? 'Added to the Planner for ' + when.trim() + '.' : 'Added to the Planner as a draft.');
      await refreshCastMeta();
    } catch (e) { window.alert('Could not add to planner: ' + e.message); }
  };

  // Build a twin from a recording that does not have one yet.
  const buildTwin = async (sel) => {
    if (!sel || !sel._recordingId || !sel._token) return;
    setBuildingTwin(true);
    try {
      const r = await createAvatarFromRecording(sel._token, sel._recordingId, sel._invite || null);
      if (r && r.ok === false) throw new Error(r.error || 'build failed');
      window.alert('Twin build started. It will appear as an avatar once HeyGen finishes.');
      await loadClient(clientId);
    } catch (e) {
      window.alert('Could not build the twin: ' + e.message);
    } finally { setBuildingTwin(false); }
  };

  // The HeyGen voice clone is not what audio casts use - those synthesize
  // through ElevenLabs voice profiles, a separate list. Without this, an audio
  // cast falls back to whatever profile happens to be first, which is why a
  // recording could come back in somebody else's voice.
  const useRecordingAsVoice = async (sel) => {
    const recordingId = sel && (sel._recordingId || sel.recording_id);
    const tok = sel && sel._token;
    if (!recordingId || !tok) { window.alert('This entry has no recording to clone from.'); return; }
    setCloningVoice(true);
    try {
      const signed = await recordingDownloadUrl(recordingId, tok);
      const url = signed && (signed.url || signed.download_url || signed);
      if (!url || typeof url !== 'string') throw new Error('could not get a download link for the recording');
      const blob = await fetch(url).then((r) => {
        if (!r.ok) throw new Error('recording download failed: HTTP ' + r.status);
        return r.blob();
      });
      const label = (sel._invite || sel.contact || 'Recording') + ' voice';
      const file = new File([blob], 'take.webm', { type: blob.type || 'audio/webm' });
      const created = await voice.createProfile(clientId, label, file);
      const rows = await voice.profiles(clientId);
      setVoiceProfiles(Array.isArray(rows) ? rows : []);
      if (created && created.id != null) setVoiceProfileId(String(created.id));
      window.alert('Voice profile created. Audio casts for this client will now use it.');
    } catch (e) {
      window.alert('Could not clone the voice: ' + e.message);
    } finally { setCloningVoice(false); }
  };

  const openEditCast = (v) => {
    setEditCast(v);
    setEditCastTitle(v.title || '');
    setEditCastScript(v.script || '');
    setEditCastAspect('16:9');
  };
  const saveCastEdit = async () => {
    if (!editCast) return;
    try {
      if (editCastTitle.trim() && editCastTitle.trim() !== (editCast.title || '')) {
        await renameVideo(editCast.id, editCastTitle.trim(), token);
      }
      setEditCast(null); await reloadQueue();
    } catch (e) { alert(e.message || 'Save failed'); }
  };
  const recastVideo = async () => {
    if (!editCast || !editCastScript.trim()) { alert('Script is empty.'); return; }
    setRecasting(true);
    try {
      if (editCastTitle.trim() && editCastTitle.trim() !== (editCast.title || '')) {
        await renameVideo(editCast.id, editCastTitle.trim(), token).catch(() => {});
      }
      await generateVideo(editCastScript.trim(), {
        token,
        title: (editCastTitle.trim() || editCast.title || 'Untitled') + ' (recast)',
        avatarId: editCast.avatar_id || undefined,
        aspectRatio: editCastAspect,
      });
      setEditCast(null); await reloadQueue();
    } catch (e) { alert(e.message || 'Recast failed'); }
    finally { setRecasting(false); }
  };
  const renameCast = async (v) => {
    const next = window.prompt('Rename this cast', v.title || '');
    if (next == null || !next.trim()) return;
    try { await renameVideo(v.id, next.trim(), token); await reloadQueue(); } catch (e) { alert(e.message || 'Rename failed'); }
  };
  const deleteCast = async (v) => {
    if (!window.confirm('Delete this cast? ' + (v.title || 'Untitled') + '\nThis cannot be undone.')) return;
    try { await deleteVideo(v.id, token); await reloadQueue(); } catch (e) { alert(e.message || 'Delete failed'); }
  };
  const downloadAudio = async (v) => {
    if (!v.url) return;
    try {
      const blob = await castAudioBlob(v.url);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = ((v.title || 'cast').replace(/[^\w-]+/g, '_')).slice(0, 40) + '.mp3'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) { alert(e.message || 'Could not extract audio'); }
  };
  const downloadWaveform = async (v) => {
    if (!v.url) return;
    try {
      const blob = await castWaveformBlob(v.url, v.thumbnail_url || '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = ((v.title || 'cast').replace(/[^\w-]+/g, '_')).slice(0, 40) + '-waveform.mp4'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) { alert(e.message || 'Could not render waveform'); }
  };

  const reloadAudio = async () => {
    if (clientId == null) return;
    try { const o = await voice.outputs(clientId); setAudioOutputs(Array.isArray(o) ? o : []); } catch { /* ignore */ }
  };
  const castToAudio = async () => {
    if (!script.trim() || clientId == null) return;
    if (!voiceProfileId) { setAudioErr('Pick or create a voice for this client first.'); return; }
    setSynthing(true); setAudioErr('');
    try {
      await voice.synthesize(clientId, Number(voiceProfileId), script.trim());
      await reloadAudio();
    } catch (e) {
      setAudioErr(e.message || 'Could not synthesize audio.');
    } finally { setSynthing(false); }
  };
  const createVoiceFromClip = async (file) => {
    if (!file || clientId == null) return;
    setSynthing(true); setAudioErr('');
    try {
      await voice.createProfile(clientId, 'Voice ' + new Date().toISOString().slice(0, 10), file);
      const p = await voice.profiles(clientId);
      const rows = Array.isArray(p) ? p : [];
      setVoiceProfiles(rows);
      setVoiceProfileId(rows[0] ? String(rows[0].id) : '');
    } catch (e) {
      setAudioErr(e.message || 'Could not create the voice.');
    } finally { setSynthing(false); }
  };

  const generate = async () => {
    if (!script.trim() || !token) return;
    setGenerating(true);
    try {
      await generateVideo(script, { token, title: script.slice(0, 60), avatarId, caption, background: (!backgroundAssetId && backgroundColor) ? { type: 'color', value: backgroundColor } : null, aspectRatio, backgroundAssetId });
      const v = await listVideos(token).catch(() => ({ videos: [] }));
      setQueue(v.videos || []);
    } catch (e) {
      console.error('generate failed:', e.message);
      alert(e.message || 'Cast failed — the video could not be generated.');
    }
    setGenerating(false);
  };

  const ModeToggle = () => (
    <div className="row" style={{ gap: 4 }}>
      {[['video', 'Avatar video'], ['assembly', 'Episode assembly']].map(([m, label]) => (
        <button key={m} onClick={() => setRenderMode(m)} className="btn sm"
          style={{
            background: renderMode === m ? 'var(--surface-2)' : 'transparent',
            borderColor: renderMode === m ? 'var(--accent)' : 'var(--border)',
            color: renderMode === m ? 'var(--text)' : 'var(--text-2)'
          }}>{label}</button>
      ))}
    </div>
  );

  // Output options come from the client's distribution channels (the brief's
  // DISTRIBUTION card / credentials: podcast, socials, websites, other), plus a
  // direct download that's always available.
  const arForKind = (kind) => (kind === 'podcast' ? '1:1' : kind === 'social' ? '9:16' : '16:9');
  const outputOptions = (credentials || []).map((c) => ({
    key: `cred:${c.id}`,
    label: `${c.platform || c.kind || 'Channel'}${c.kind ? ' · ' + c.kind : ''}`,
    ar: arForKind(c.kind),
    assembly: c.kind === 'podcast',
  }));
  outputOptions.push({ key: 'download', label: 'Direct / download', ar: '16:9', assembly: false });
  const applyOutput = (key) => {
    const opt = outputOptions.find((o) => o.key === key);
    if (!opt) return;
    setOutputKey(key);
    setAspectRatio(opt.ar);
    setRenderMode(opt.assembly ? 'assembly' : 'video');
  };

  return (
    <div className="fade-in" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* top bar: breadcrumb + mode toggle */}
      <div className="row" style={{ justifyContent: 'space-between', padding: '10px var(--pad)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select value={clientId || ''} onChange={(e) => { const c = clients.find(x => String(x.id) === e.target.value); if (c) selectClientInline(c.id); }}
            style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={outputKey} onChange={(e) => applyOutput(e.target.value)}
            title="Output — from the client's brief"
            style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>
            {outputOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button className="btn sm" onClick={startOver}><Icon name="more" size={12} /> Start over</button>
          <div className="row" style={{ gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
            <button onClick={() => setCastType('video')} style={{ padding: '6px 12px', border: 'none', background: castType === 'video' ? 'var(--accent)' : 'transparent', color: castType === 'video' ? '#fff' : 'var(--text-2)', cursor: 'pointer', fontSize: 12 }}>Video</button>
            <button onClick={() => setCastType('audio')} style={{ padding: '6px 12px', border: 'none', background: castType === 'audio' ? 'var(--accent)' : 'transparent', color: castType === 'audio' ? '#fff' : 'var(--text-2)', cursor: 'pointer', fontSize: 12 }}>Audio only</button>
          </div>
        </div>
        <ModeToggle />
      </div>

      {renderMode === 'assembly'
        ? <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}><EpisodesView activeClientId={clientId} /></div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', flex: 1, minHeight: 0 }}>
            {/* —— center: script editor + queue —— */}
            <div style={{ overflow: 'auto', padding: 'var(--pad)' }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <div className="label">STUDIO · NEW RENDER</div>
                  <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 38, letterSpacing: '-0.01em', margin: '6px 0 0' }}>
                    Cast a <em style={{ color: 'var(--accent)' }}>script</em> into video.
                  </h1>
                </div>
              </div>

              {/* live preview tile */}
              <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
                <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', justifyContent: 'space-between' }}>
                  <div className="row">
                    <div style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden' }}>
                      <AvatarTile avatar={avatar} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13 }}>{avatar ? (avatar.contact || avatar._invite || '') : ''}</div>
                      <div className="mono">{client ? client.name : ''}</div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="badge"><Icon name="cam" size={11} /> {aspectRatio}</span>
                    <span className="badge"><Icon name="lang" size={11} /> {language}</span>
                    <span className="badge"><Icon name="studio" size={11} /> {SCENES.find(s => s.id === scene).label}</span>
                  </div>
                </div>
                <div style={{
                  aspectRatio: aspectRatio === '16:9' ? '16/9' : (aspectRatio === '9:16' ? '9/16' : '1/1'),
                  maxHeight: 320,
                  margin: '0 auto',
                  position: 'relative',
                  background: '#0a0a0a',
                  display: 'grid', placeItems: 'center',
                  width: aspectRatio === '9:16' ? 240 : (aspectRatio === '1:1' ? 320 : '100%')
                }}>
                  <AvatarTile avatar={avatar} />
                  <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                    <div style={{
                      background: 'rgba(0,0,0,0.6)',
                      backdropFilter: 'blur(8px)',
                      padding: '10px 14px',
                      borderRadius: 'var(--r-sm)',
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: '#fff',
                      maxHeight: 80, overflow: 'hidden',
                      textWrap: 'pretty'
                    }}>
                      {script.slice(0, 140)}{script.length > 140 && '…'}
                    </div>
                  </div>
                </div>
              </div>

              {/* script editor */}
              <div style={{ marginBottom: 24 }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="label">SCRIPT</span>
                  <span className="mono">{wordCount} words · ~{estSeconds}s · ${estCost}</span>
                </div>
                <textarea
                  className="textarea"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={8}
                  placeholder="Paste or write the script you want the avatar to deliver…"
                  style={{ fontSize: 15, fontFamily: 'var(--f-display)', lineHeight: 1.5, letterSpacing: '0', minHeight: 180 }}
                />
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  <button className="btn sm"><Icon name="sparkle" size={12} /> Refine with Claude</button>
                  <button className="btn sm"><Icon name="doc" size={12} /> Paste from doc</button>
                  <button className="btn sm"><Icon name="mic" size={12} /> Dictate</button>
                </div>
              </div>

              <div className="row" style={{ justifyContent: 'space-between', marginTop: 100, marginBottom: 16 }}>
                <div className="label">{castType === 'audio' ? 'PREVIOUS AUDIO CASTS' : 'PREVIOUS CASTS'}</div>
                <span className="mono">{castType === 'audio' ? audioOutputs.length : queue.length} {castType === 'audio' ? (audioOutputs.length === 1 ? 'clip' : 'clips') : (queue.length === 1 ? 'cast' : 'casts')}</span>
              </div>

              {castType === 'audio' ? (
                audioOutputs.length === 0 ? (
                  <div className="mono" style={{ color: 'var(--text-4)' }}>No audio casts yet for this client.</div>
                ) : (
                  <div className="col" style={{ gap: 10 }}>
                    {audioOutputs.map((o) => (
                      <div key={o.id} className="card card-pad">
                        <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginBottom: 6 }}>{String(o.created_at || '').slice(0, 10)} · {o.provider}</div>
                        <div style={{ fontSize: 13, marginBottom: 8 }}>{(o.text || '').slice(0, 120) || 'Audio clip'}</div>
                        <audio controls src={voice.outputUrl(clientId, o.id)} style={{ width: '100%' }} />
                        <div className="row" style={{ gap: 6, marginTop: 8 }}>
                          <a className="btn sm" href={voice.outputUrl(clientId, o.id)} download target="_blank" rel="noreferrer"><Icon name="download" size={12} /> Download audio</a>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : queue.length === 0 ? (
                <div className="mono" style={{ color: 'var(--text-4)' }}>No casts yet for this client.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {queue.map(v => (
                    <CastCard key={v.id} video={v} avatars={avatars} meta={castMeta[v.id]}
                      onRename={() => renameCast(v)} onEdit={() => openEditCast(v)} onDelete={() => deleteCast(v)} onDownloadAudio={() => downloadAudio(v)} onWaveform={() => downloadWaveform(v)}
                      onApprove={() => approveCast(v)} onSend={() => sendCastForReview(v)} onPlanner={() => addCastToPlanner(v)} />
                  ))}
                </div>
              )}
            </div>

            {editCast && (
              <div onClick={() => setEditCast(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.55)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 100 }}>
                <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: 'min(640px, 96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="label">EDIT CAST</div>
                    <button className="btn sm" onClick={() => setEditCast(null)}>Close</button>
                  </div>
                  <input value={editCastTitle} onChange={(e) => setEditCastTitle(e.target.value)} placeholder="Cast title"
                    style={{ padding: 10, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 14 }} />
                  {editCast.script != null ? (
                    <textarea value={editCastScript} onChange={(e) => setEditCastScript(e.target.value)}
                      style={{ flex: 1, minHeight: 260, resize: 'vertical', padding: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 14, lineHeight: 1.6 }} />
                  ) : (
                    <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>No script stored for this cast (older render).</div>
                  )}
                  <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>{editCastScript.length} characters</div>
                  <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>Recast format</span>
                    {['16:9', '9:16', '1:1'].map((a) => (
                      <button key={a} className={'btn sm' + (editCastAspect === a ? ' primary' : '')} onClick={() => setEditCastAspect(a)}>{a}</button>
                    ))}
                  </div>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn sm" onClick={saveCastEdit}>Save title</button>
                    <button className="btn primary sm" disabled={recasting || !editCastScript.trim()} onClick={recastVideo}><Icon name="sparkle" size={12} /> {recasting ? 'Recasting…' : 'Recast'}</button>
                  </div>
                </div>
              </div>
            )}
            {/* —— right rail: settings —— */}
            <div style={{ borderLeft: '1px solid var(--border)', padding: 'var(--pad)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div className="label">{castType === 'audio' ? 'RECORDING' : 'AVATAR'}</div>
                <button className="btn sm" onClick={() => loadClient(clientId)} title="Reload avatars and recordings">
                  <Icon name="history" size={12} /> Refresh
                </button>
              </div>
              {readyAvatars.length === 0 ? (
                <div className="mono" style={{ marginBottom: 22, color: 'var(--text-4)' }}>No recordings for this client yet.</div>
              ) : (
                <select
                  value={avatarId || ''}
                  onChange={(e) => {
                    const av = readyAvatars.find((a) => String(a.id) === e.target.value);
                    if (av) { setAvatarId(av.id); if (av._token) setToken(av._token); }
                  }}
                  style={{
                    width: '100%', marginBottom: 22, padding: '10px 12px',
                    borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13, cursor: 'pointer'
                  }}>
                  <option value="" disabled>Select an avatar…</option>
                  {readyAvatars.map((av) => (
                    <option key={av.id} value={av.id} disabled={av._voiceOnly && !av._unbuilt && castType !== 'audio'}>
                      {(av._invite || av.contact)
                        + (av.created_at ? ' · ' + String(av.created_at).slice(0, 10) : '')
                        + (av._unbuilt ? ' · twin not built yet' : (av._voiceOnly ? ' · voice only' : ''))}
                    </option>
                  ))}
                </select>
              )}
              {avatarId && (() => {
                const selUnbuilt = readyAvatars.find((a) => a.id === avatarId);
                if (selUnbuilt && selUnbuilt._unbuilt) {
                  return (
                    <div style={{ marginBottom: 22 }}>
                      <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12, marginBottom: 8 }}>
                        This recording has no twin yet. Build one before casting.
                      </div>
                      <button className="btn sm" disabled={buildingTwin} onClick={() => buildTwin(selUnbuilt)}>
                        <Icon name="sparkle" size={12} /> {buildingTwin ? 'Building…' : 'Build twin'}
                      </button>
                    </div>
                  );
                }
                const sel = selUnbuilt;
                if (!sel) return null;
                if (castType === 'audio' && (sel._recordingId || sel.recording_id)) {
                  return (
                    <div style={{ marginBottom: 22 }}>
                      <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12, marginBottom: 8 }}>
                        Audio casts use an ElevenLabs voice profile, not the HeyGen twin.
                        Clone this recording to cast in their own voice.
                      </div>
                      <button className="btn sm" disabled={cloningVoice} onClick={() => useRecordingAsVoice(sel)}>
                        <Icon name="mic" size={12} /> {cloningVoice ? 'Cloning…' : 'Use this recording as the voice'}
                      </button>
                    </div>
                  );
                }
                return (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0 }}>
                      <AvatarTile avatar={sel} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel._invite || sel.contact}</div>
                      <div className="mono">{sel.created_at ? String(sel.created_at).slice(0, 10) : 'ready'}</div>
                    </div>
                  </div>
                );
              })()}
              {avatarId && (() => {
                const sel = readyAvatars.find((a) => a.id === avatarId);
                if (!sel || !sel.heygen_group_id) return null;
                return (
                  <div style={{ marginBottom: 22 }}>
                    <div className="label" style={{ marginBottom: 8 }}>LOOK</div>
                    <LookPicker avatar={sel} onSet={() => loadClient(clientId)} />
                  </div>
                );
              })()}

              <a href="https://app.heygen.com/avatars" target="_blank" rel="noopener noreferrer" className="btn sm"
                style={{ marginBottom: 22, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="globe" size={13} /> Edit avatar in HeyGen
              </a>
              <div className="label" style={{ marginBottom: 10 }}>CAPTIONS</div>
              <button onClick={() => setCaption((v) => !v)} className="row"
                style={{ width: '100%', justifyContent: 'space-between', padding: 8, marginBottom: 22, borderRadius: 'var(--r-sm)',
                  background: caption ? 'var(--surface-2)' : 'transparent', border: '1px solid', borderColor: caption ? 'var(--border-strong)' : 'var(--border)',
                  cursor: 'pointer', color: 'inherit', textAlign: 'left' }}>
                <span style={{ fontSize: 13 }}>Burn-in captions</span>
                {caption ? <Icon name="check" size={14} style={{ color: 'var(--accent)' }} /> : <span className="mono" style={{ color: 'var(--text-4)' }}>off</span>}
              </button>
              <div className="label" style={{ marginBottom: 10 }}>SCENE</div>
              <div className="col" style={{ gap: 4, marginBottom: 22 }}>
                {SCENES.map(s => (
                  <button key={s.id} onClick={() => setScene(s.id)}
                    className="row"
                    style={{
                      padding: '8px 10px', borderRadius: 'var(--r-sm)',
                      background: scene === s.id ? 'var(--surface-2)' : 'transparent',
                      border: '1px solid', borderColor: scene === s.id ? 'var(--border-strong)' : 'transparent',
                      cursor: 'pointer', color: 'inherit'
                    }}>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 13 }}>{s.label}</div>
                      <div className="mono">{s.desc}</div>
                    </div>
                    {scene === s.id && <Icon name="check" size={14} style={{ color: 'var(--accent)' }} />}
                  </button>
                ))}
              </div>

              <div className="label" style={{ marginBottom: 10 }}>BACKGROUND</div>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <input type="color" value={backgroundColor || '#1a1a1a'} onChange={(e) => { setBackgroundColor(e.target.value); setBackgroundAssetId(null); }}
                  style={{ width: 40, height: 32, padding: 0, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', cursor: 'pointer' }} />
                {(backgroundColor || backgroundAssetId)
                  ? <button className="btn sm" onClick={() => { setBackgroundColor(null); setBackgroundAssetId(null); }}>Clear</button>
                  : <span className="mono" style={{ color: 'var(--text-4)' }}>none — avatar's own</span>}
              </div>
              {bgAssets.length > 0 && (
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
                  {bgAssets.map((a) => (
                    <button key={a.id} title={a.filename} onClick={() => { setBackgroundAssetId(a.id); setBackgroundColor(null); }}
                      style={{ padding: 0, width: 44, height: 44, borderRadius: 5, overflow: 'hidden', cursor: 'pointer', background: 'var(--surface-2)',
                        border: backgroundAssetId === a.id ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
                      <img src={api.assetFileUrl(clientId, a.id)} alt={a.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
              {bgAssets.length === 0 && <div style={{ marginBottom: 22 }} />}

              <div className="label" style={{ marginBottom: 10 }}>ASPECT RATIO</div>
              <div className="row" style={{ gap: 4, marginBottom: 22 }}>
                {['16:9', '9:16', '1:1'].map(r => (
                  <button key={r} onClick={() => setAspectRatio(r)} className="btn sm"
                    style={{
                      flex: 1, justifyContent: 'center',
                      background: aspectRatio === r ? 'var(--surface-2)' : 'transparent',
                      borderColor: aspectRatio === r ? 'var(--accent)' : 'var(--border)',
                      color: aspectRatio === r ? 'var(--text)' : 'var(--text-2)'
                    }}>{r}</button>
                ))}
              </div>

              <div className="label" style={{ marginBottom: 10 }}>LANGUAGE</div>
              <div className="row" style={{ gap: 4, marginBottom: 22, flexWrap: 'wrap' }}>
                {(avatar && avatar.languages && avatar.languages.length) ? avatar.languages.map(l => (
                  <button key={l} onClick={() => setLanguage(l)} className="btn sm"
                    style={{
                      background: language === l ? 'var(--surface-2)' : 'transparent',
                      borderColor: language === l ? 'var(--accent)' : 'var(--border)',
                      color: language === l ? 'var(--text)' : 'var(--text-2)'
                    }}>{l}</button>
                )) : <span className="mono">No language packs trained.</span>}
              </div>

              <div style={{ marginTop: 'auto' }} />

              <div style={{
                padding: 14,
                background: 'var(--surface-2)',
                borderRadius: 'var(--r-md)',
                marginBottom: 12,
                border: '1px solid var(--border)'
              }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="mono">Estimated cost</span>
                  <span style={{ fontFamily: 'var(--f-display)', fontSize: 24 }}>${estCost}</span>
                </div>
                <div className="mono">{estSeconds}s · {wordCount} words · charged on completion</div>
              </div>

              {castType === 'video' ? (
                <button className="btn primary lg" onClick={generate} disabled={!canGenerate}
                  style={{ justifyContent: 'center', opacity: canGenerate ? 1 : 0.5 }}>
                  {generating
                    ? <>Queueing…</>
                    : (avatar && avatar.status === 'ready'
                        ? <><Icon name="sparkle" size={14} /> Generate {typeLabel || 'video'}</>
                        : (avatar && avatar._unbuilt
                            ? <>Build the twin first</>
                            : <>Avatar still training</>))}
                </button>
              ) : (
                <div className="col" style={{ gap: 8 }}>
                  {voiceProfiles.length > 0 ? (
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>Voice</span>
                      <select value={voiceProfileId} onChange={(e) => setVoiceProfileId(e.target.value)}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13 }}>
                        {voiceProfiles.map((p) => <option key={p.id} value={p.id}>{p.label || ('Voice ' + p.id)}</option>)}
                      </select>
                    </div>
                  ) : (
                    <label className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      No ElevenLabs voice for this client yet — upload a short clip to create one:
                      <input type="file" accept="audio/*" disabled={synthing} onChange={(e) => createVoiceFromClip(e.target.files[0])} style={{ display: 'block', marginTop: 6, fontSize: 12 }} />
                    </label>
                  )}
                  {audioErr && <div className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>{audioErr}</div>}
                  <button className="btn primary lg" onClick={castToAudio} disabled={synthing || !script.trim() || !voiceProfileId}
                    style={{ justifyContent: 'center', opacity: (synthing || !script.trim() || !voiceProfileId) ? 0.5 : 1 }}>
                    {synthing ? <>Synthesizing…</> : <><Icon name="mic" size={14} /> Cast to audio</>}
                  </button>
                  <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>ElevenLabs voice · no character cap · far cheaper than a video render</div>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
 * EPISODE ASSEMBLY — cover, intro music, intro/body/outro, music
 * (segment|bed), stitch. Mirrors the cast.cuecreative.com Episodes tab.
 * ──────────────────────────────────────────────────────────── */
const PART_SLOTS = [
  { id: 'intro_music', label: 'Intro music', hint: 'plays first', kind: 'music', required: false },
  { id: 'intro',       label: 'Intro (VO)',  hint: 'spoken intro', kind: 'voice', required: false },
  { id: 'body',        label: 'Body',        hint: 'main recording', kind: 'voice', required: true },
  { id: 'outro',       label: 'Outro',       hint: 'spoken outro', kind: 'voice', required: false },
];

const EpisodeAssembly = ({ avatar, clientName }) => {
  const [title, setTitle] = React.useState('');
  const [cover, setCover] = React.useState(null);        // { via, label }
  const [coverPrompt, setCoverPrompt] = React.useState('');
  const [overlay, setOverlay] = React.useState('');
  const [slots, setSlots] = React.useState({});          // { slotId: { via, label } }
  const [music, setMusic] = React.useState(null);        // { via, label }
  const [musicMode, setMusicMode] = React.useState('segment');  // segment | bed
  const [bedLevel, setBedLevel] = React.useState(0.10);
  const [musicPrompt, setMusicPrompt] = React.useState('');
  const [episodes, setEpisodes] = React.useState([]);
  const [stitching, setStitching] = React.useState(false);

  const setSlot = (id, val) => setSlots(s => ({ ...s, [id]: val }));
  const hasBody = !!slots.body;

  const stitch = () => {
    if (!hasBody || stitching) return;
    setStitching(true);
    const ep = {
      id: 'ep_' + Date.now(),
      title: title.trim() || 'Untitled episode',
      status: 'rendering',
      progress: 0,
      createdAt: 'just now',
      mode: musicMode,
    };
    setEpisodes(e => [ep, ...e]);
    let p = 0;
    const t = setInterval(() => {
      p += 10;
      setEpisodes(e => e.map(x => x.id === ep.id ? { ...x, progress: Math.min(p, 100) } : x));
      if (p >= 100) {
        clearInterval(t);
        setEpisodes(e => e.map(x => x.id === ep.id ? { ...x, status: 'ready', progress: 100 } : x));
        setStitching(false);
      }
    }, 240);
  };

  // human-readable stitch order, reflecting what's actually set
  const order = [
    slots.intro_music && 'intro music',
    slots.intro && 'intro',
    (music && musicMode === 'segment') && 'segment music',
    hasBody ? (music && musicMode === 'bed' ? 'body (+ music bed)' : 'body') : 'body',
    slots.outro && 'outro',
  ].filter(Boolean).join('  →  ');

  return (
    <div style={{ overflow: 'auto', padding: 'var(--pad)', flex: 1, minHeight: 0 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="label">STUDIO · EPISODE ASSEMBLY</div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 34, letterSpacing: '-0.01em', margin: '6px 0 0' }}>
            Stitch an <em style={{ color: 'var(--accent)' }}>episode</em>.
          </h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden' }}><AvatarTile avatar={avatar} /></div>
          <div>
            <div style={{ fontSize: 13 }}>{avatar.contact}</div>
            <div className="mono">{clientName}</div>
          </div>
        </div>
      </div>

      {/* title */}
      <div style={{ marginBottom: 18 }}>
        <div className="label" style={{ marginBottom: 8 }}>EPISODE TITLE</div>
        <input className="textarea" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Daily Cue — discipline over motivation"
          style={{ minHeight: 0, height: 44, fontSize: 15, fontFamily: 'var(--f-display)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
        {/* cover art */}
        <div className="card card-pad">
          <div className="label" style={{ marginBottom: 12 }}>COVER ART</div>
          <div style={{ aspectRatio: '1/1', maxWidth: 160, borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', marginBottom: 12, border: '1px solid var(--border)' }}>
            {cover
              ? <div style={{ textAlign: 'center', padding: 12 }}><Icon name="studio" size={22} style={{ color: 'var(--accent)' }} /><div className="mono" style={{ marginTop: 6 }}>{cover.label}</div></div>
              : <span className="mono">no cover yet</span>}
          </div>
          <input className="textarea" value={coverPrompt} onChange={(e) => setCoverPrompt(e.target.value)}
            placeholder="Describe the cover (AI generate)…"
            style={{ minHeight: 0, height: 40, fontSize: 13, marginBottom: 8 }} />
          <input className="textarea" value={overlay} onChange={(e) => setOverlay(e.target.value)}
            placeholder="Overlay title (optional)"
            style={{ minHeight: 0, height: 36, fontSize: 13, marginBottom: 10 }} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm" onClick={() => setCover({ via: 'ai', label: 'AI cover' })}><Icon name="sparkle" size={12} /> Generate</button>
            <button className="btn sm" onClick={() => setCover({ via: 'upload', label: 'uploaded.jpg' })}><Icon name="upload" size={12} /> Upload</button>
          </div>
        </div>

        {/* music */}
        <div className="card card-pad">
          <div className="label" style={{ marginBottom: 12 }}>MUSIC</div>
          <div className="row" style={{ gap: 4, marginBottom: 12 }}>
            {[['segment', 'Segment'], ['bed', 'Bed']].map(([m, label]) => (
              <button key={m} onClick={() => setMusicMode(m)} className="btn sm"
                style={{
                  flex: 1, justifyContent: 'center',
                  background: musicMode === m ? 'var(--surface-2)' : 'transparent',
                  borderColor: musicMode === m ? 'var(--accent)' : 'var(--border)',
                  color: musicMode === m ? 'var(--text)' : 'var(--text-2)'
                }}>{label}</button>
            ))}
          </div>
          <div className="mono" style={{ marginBottom: 10 }}>
            {musicMode === 'segment' ? 'Plays as its own part before the body.' : 'Mixed under the body at low volume.'}
          </div>
          {musicMode === 'bed' && (
            <div style={{ marginBottom: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="mono">Bed level</span><span className="mono">{bedLevel.toFixed(2)}</span>
              </div>
              <input type="range" min="0.02" max="0.4" step="0.02" value={bedLevel}
                onChange={(e) => setBedLevel(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
          )}
          <input className="textarea" value={musicPrompt} onChange={(e) => setMusicPrompt(e.target.value)}
            placeholder="Describe style/mood — no artist names…"
            style={{ minHeight: 0, height: 40, fontSize: 13, marginBottom: 10 }} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm" onClick={() => setMusic({ via: 'ai', label: 'generated track' })}><Icon name="sparkle" size={12} /> Generate</button>
            <button className="btn sm" onClick={() => setMusic({ via: 'upload', label: 'uploaded.mp3' })}><Icon name="upload" size={12} /> Upload</button>
          </div>
          {music && <div className="mono" style={{ marginTop: 8, color: 'var(--ok)' }}>● {music.label}</div>}
        </div>
      </div>

      {/* audio parts */}
      <div className="card card-pad" style={{ marginBottom: 'var(--gap)' }}>
        <div className="label" style={{ marginBottom: 12 }}>AUDIO PARTS</div>
        <div className="col" style={{ gap: 2 }}>
          {PART_SLOTS.map(slot => {
            const val = slots[slot.id];
            return (
              <div key={slot.id} className="row" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)', gap: 12 }}>
                <div style={{ width: 120 }}>
                  <div style={{ fontSize: 13 }}>{slot.label}{slot.required && <span style={{ color: 'var(--accent)' }}> *</span>}</div>
                  <div className="mono">{slot.hint}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="mono" style={{ color: val ? 'var(--ok)' : 'var(--text-4)' }}>
                    {val ? `● ${val.label}` : 'empty'}
                  </span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => setSlot(slot.id, { via: 'upload', label: 'uploaded file' })}>
                    <Icon name="upload" size={12} /> Upload
                  </button>
                  {slot.kind === 'voice' && (
                    <button className="btn sm" onClick={() => setSlot(slot.id, { via: 'synth', label: `synth · ${avatar.contact.split(' ')[0]}` })}>
                      <Icon name="mic" size={12} /> Use synth
                    </button>
                  )}
                  {slot.kind === 'music' && (
                    <button className="btn sm" onClick={() => setSlot(slot.id, { via: 'ai', label: 'generated music' })}>
                      <Icon name="sparkle" size={12} /> Generate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* stitch */}
      <div className="card card-pad" style={{ marginBottom: 'var(--gap)' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="label">STITCH</div>
          <span className="mono">{musicMode} music</span>
        </div>
        <div className="mono" style={{ marginBottom: 14 }}>{order || 'add a body recording to begin'}</div>
        <button className="btn primary lg" onClick={stitch} disabled={!hasBody || stitching}
          style={{ justifyContent: 'center', opacity: (!hasBody || stitching) ? 0.5 : 1 }}>
          {stitching ? <>Stitching…</> : <><Icon name="sparkle" size={14} /> Stitch into finished episode</>}
        </button>
        {!hasBody && <div className="mono" style={{ marginTop: 8, color: 'var(--text-4)' }}>Body is required (* ) before stitching.</div>}
      </div>

      {/* finished episodes */}
      {episodes.length > 0 && (
        <>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="label">FINISHED EPISODES</div>
            <span className="mono">{episodes.length}</span>
          </div>
          <div className="col" style={{ gap: 10 }}>
            {episodes.map(ep => (
              <div key={ep.id} className="row" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
                  <Icon name={ep.status === 'ready' ? 'play' : 'studio'} size={16} style={{ color: ep.status === 'ready' ? 'var(--accent)' : 'var(--text-3)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ep.title}</div>
                  <div className="row" style={{ marginTop: 4 }}>
                    <span className="mono">{ep.mode} music</span><span className="mono">·</span><span className="mono">{ep.createdAt}</span>
                  </div>
                  {ep.status === 'rendering' && (
                    <div style={{ marginTop: 8, height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${ep.progress || 0}%`, height: '100%', background: 'var(--accent)', transition: 'width 200ms linear' }} />
                    </div>
                  )}
                </div>
                {ep.status === 'ready'
                  ? <button className="icon-btn" title="Download"><Icon name="download" size={14} /></button>
                  : <StatusBadge status="training" progress={ep.progress} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Stepper = ({ current }) => (
  <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
    {STEPS.map((s, i) => {
      const active = s.id === current;
      const done = STEPS.findIndex(x => x.id === current) > i;
      return (
        <React.Fragment key={s.id}>
          <div className="row" style={{ gap: 8, opacity: active || done ? 1 : 0.5 }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center',
              fontSize: 12, fontFamily: 'var(--f-mono)',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#fff' : 'var(--text-3)',
              border: '1px solid', borderColor: active ? 'var(--accent)' : 'var(--border)'
            }}>{s.n}</span>
            <span style={{ fontSize: 13, color: active ? 'var(--text)' : 'var(--text-3)' }}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && <span className="mono" style={{ color: 'var(--text-4)' }}>▸</span>}
        </React.Fragment>
      );
    })}
  </div>
);

const Crumb = ({ label, onClick }) => (
  <button onClick={onClick} className="btn sm"
    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
    {label}
  </button>
);

const CastCard = ({ video, avatars = [], meta, onRename, onEdit, onDelete, onDownloadAudio, onWaveform, onApprove, onSend, onPlanner }) => {
  const avatar = (avatars || []).find(a => a.id === video.avatarId) || { id: video.avatarId || 'na', contact: video.title || 'Avatar' };
  const ready = video.status === 'ready' && video.url;
  return (
    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ width: '100%', aspectRatio: '16/9', background: '#0a0a0a', overflow: 'hidden', position: 'relative' }}>
        {ready ? (
          <video controls src={video.url} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#0a0a0a' }} />
        ) : (
          <div style={{ width: '100%', height: '100%' }}><AvatarTile avatar={avatar} /></div>
        )}
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {meta && meta.approval_status && meta.approval_status !== 'none' && (
          <span className="mono" style={{
            fontSize: 11,
            color: meta.approval_status === 'approved' ? 'var(--ok)'
              : meta.approval_status === 'changes_requested' ? 'var(--accent)' : 'var(--text-4)',
          }}>{meta.approval_status.replace(/_/g, ' ')}</span>
        )}
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title || 'Untitled cast'}</div>
        <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>
          {video.createdAt || (video.created_at ? String(video.created_at).slice(0, 10) : '')} · {ready ? 'ready' : (video.status || 'rendering')}
        </div>
        {video.status === 'rendering' && (
          <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${video.progress || 0}%`, height: '100%', background: 'var(--accent)', transition: 'width 200ms linear' }} />
          </div>
        )}
        {video.status === 'failed' && <div className="mono" style={{ color: 'var(--accent)', fontSize: 11 }}>{video.failure_reason || 'render failed'}</div>}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          {ready && <a className="btn sm" href={video.url} download target="_blank" rel="noopener noreferrer"><Icon name="download" size={12} /> Video</a>}
          {ready && <button className="btn sm" onClick={onDownloadAudio}><Icon name="mic" size={12} /> Audio</button>}
          {ready && <button className="btn sm" onClick={onWaveform}><Icon name="sliders" size={12} /> Waveform</button>}
          <button className="btn sm" onClick={onEdit || onRename}><Icon name="sliders" size={12} /> Edit</button>
          <button className="btn sm" style={{ color: 'var(--accent)' }} onClick={onDelete}><Icon name="close" size={12} /> Delete</button>
        </div>
        {ready && (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {onApprove && (meta || {}).approval_status !== 'approved' && (
              <button className="btn sm" onClick={onApprove}><Icon name="check" size={12} /> Approve</button>
            )}
            {onSend && <button className="btn sm" onClick={onSend}><Icon name="send" size={12} /> Send for review</button>}
            {onPlanner && <button className="btn sm" onClick={onPlanner}><Icon name="history" size={12} /> Add to planner</button>}
          </div>
        )}
      </div>
    </div>
  );
};

const VideoRow = ({ video, avatars = [] }) => {
  const avatar = (avatars || []).find(a => a.id === video.avatarId)
    || { id: video.avatarId || 'na', contact: video.title || 'Avatar' };
  const ready = video.status === 'ready' && video.url;
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)',
      background: 'var(--surface)',
      overflow: 'hidden'
    }}>
      <div className="row" style={{ padding: 12, gap: 14 }}>
        {!ready && (
          <div style={{ width: 80, aspectRatio: '16/9', borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
            <AvatarTile avatar={avatar} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {video.title}
          </div>
          <div className="row" style={{ marginTop: 4 }}>
            <span className="mono">{(avatar.contact || '').split(' ')[0]}</span>
            {video.duration && <><span className="mono">·</span><span className="mono">{video.duration}</span></>}
            <span className="mono">·</span>
            <span className="mono">{video.createdAt || (video.created_at ? String(video.created_at).slice(0, 10) : '')}</span>
          </div>
          {video.status === 'rendering' && (
            <div style={{ marginTop: 8, height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${video.progress || 0}%`, height: '100%', background: 'var(--accent)', transition: 'width 200ms linear' }} />
            </div>
          )}
          {video.status === 'failed' && (
            <div className="mono" style={{ color: 'var(--accent)', marginTop: 6 }}>{video.failure_reason || 'render failed'}</div>
          )}
        </div>
        <div className="row" style={{ gap: 6 }}>
          {ready && (
            <>
              <a className="icon-btn" title="Download" href={video.url} download target="_blank" rel="noopener noreferrer"><Icon name="download" size={14} /></a>
              <button className="icon-btn" title="More"><Icon name="more" size={14} /></button>
            </>
          )}
        </div>
      </div>
      {ready && (
        <video
          controls
          src={video.url}
          style={{ display: 'block', width: '100%', maxHeight: 480, background: '#0a0a0a', objectFit: 'contain' }}
        />
      )}
    </div>
  );
};

export default StudioView;
