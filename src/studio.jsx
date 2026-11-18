// components/studio.jsx — Studio: client → destination → type decision flow,
// then either an avatar-video render or full episode assembly (cover, intro
// music, intro/body/outro, music bed/segment, stitch) — mirrors the
// cast.cuecreative.com Episodes tab.

import React from 'react'
import { api, generateVideo, previewCastAudio, listVideos, deleteVideo, renameVideo, castAudioBlob, castWaveformBlob, castBoostedVideoBlob, listRecordings, createAvatarFromRecording, recordingDownloadUrl, hedraModels, engineName, hedraBody, hedraPrepare, hedraAvatars, hedraVoices, hedraFrameUrl, createHedraAvatar } from './api.js'
import { clientToken, voice, ep } from './dashboard-api.js'
import { fmtStamp, AvatarTile, Icon, StatusBadge, downloadWithPrompt, saveBlobWithPrompt, ExpressionTags, SendReviewModal, buildMotionPrompt, uploadMany } from './shared.jsx'
import { EpisodesView, scriptEpLabel } from './episodes.jsx'
import { LookPicker, AssetsSection, VoiceSettings } from './brief.jsx'
import { NewLookPanel } from './talent.jsx'
import { PromptLibrary } from './prompt-library.jsx'

const SCENES = [
  { id: 'plain',     label: 'Plain', desc: 'No background.' },
  { id: 'office',    label: 'Office', desc: 'Neutral office.' },
  { id: 'studio',    label: 'Studio', desc: 'Branded set.' },
  { id: 'outdoor',   label: 'Outdoor', desc: 'Natural light.' },
];

const DEFAULT_SCRIPT = "Hi! I'm excited you're here. This is a preview of the voice for your character—take a quick listen.";

// Delivery presets map to a HeyGen motion_prompt (natural-language gesture +
// expression guidance). 'calm' = empty so the backend keeps its teeth-safe default.
const DELIVERY_PROMPTS = {
  calm: '',
  warm: 'warm, friendly delivery with a natural smile; relaxed and engaged; gentle head movement',
  energetic: 'upbeat, energetic delivery; lively hand gestures and animated facial expression; confident and dynamic',
  laughing: 'joyful, laughing delivery; genuine laughter and a big warm smile; playful and animated',
  serious: 'serious, authoritative delivery; composed and confident; steady gaze with minimal smiling',
};
const HEDRA_CALM_TEXT = 'calm, measured delivery; steady and composed; subtle natural movement';
const DELIVERY_LABELS = { calm: 'Calm', warm: 'Warm', energetic: 'Energetic', laughing: 'Laughing', serious: 'Serious' };

// Cast timestamp in the operator's local 12-hour time; falls back to the raw
// value if it can't be parsed. engineLabel maps stored engine -> display name.
const fmtWhen = (v) => {
  if (!v) return '';
  let d = new Date(v);
  if (isNaN(d.getTime())) d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
};
// Create a Hedra photo avatar: a photo (frame from a recording, an upload, or
// an existing avatar's look) + a voice (one the client has, or cloned from a
// recording). Hedra's API has no avatar object, so this is all it needs.
function NewHedraAvatar({ token, avatars, selStyle, onCreated }) {
  const [name, setName] = React.useState('');
  const [src, setSrc] = React.useState('recording');
  const [recs, setRecs] = React.useState([]);
  const [recId, setRecId] = React.useState('');
  const [t, setT] = React.useState(3);
  const [dur, setDur] = React.useState(null);
  const [frame, setFrame] = React.useState(null);
  const [frameErr, setFrameErr] = React.useState('');
  const [file, setFile] = React.useState(null);
  const [fromAv, setFromAv] = React.useState('');
  const [voices, setVoices] = React.useState([]);
  const [voice, setVoice] = React.useState('');
  const [cloneRec, setCloneRec] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const full = { ...selStyle, width: '100%', boxSizing: 'border-box', marginBottom: 8 };

  React.useEffect(() => {
    listRecordings(token).then((r) => {
      const rows = Array.isArray(r) ? r : (r.recordings || []);
      setRecs(rows); if (rows[0]) { setRecId(String(rows[0].id)); setCloneRec(String(rows[0].id)); }
    }).catch(() => setRecs([]));
    hedraVoices(token).then((r) => { const v = r.voices || []; setVoices(v); setVoice(v[0] ? v[0].voice_id : 'clone'); }).catch(() => setVoices([]));
  }, [token]);

  // Frame preview, fetched a moment after the slider stops moving.
  React.useEffect(() => {
    if (src !== 'recording' || !recId) return undefined;
    const h = setTimeout(async () => {
      setFrameErr('');
      try {
        const r = await fetch(hedraFrameUrl(token, recId, t));
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'No frame'); }
        const secs = Number(r.headers.get('X-Recording-Seconds')); if (secs) setDur(secs);
        const url = URL.createObjectURL(await r.blob());
        setFrame((old) => { if (old) URL.revokeObjectURL(old); return url; });
      } catch (e) { setFrame(null); setFrameErr(e.message); }
    }, 400);
    return () => clearTimeout(h);
  }, [src, recId, t, token]);

  const lookAvatars = avatars.filter((a) => !a._talent && !a._unbuilt && (a.heygen_avatar_id || a._hedra));
  const recLabel = (r) => (r.signed_name || r.title || 'Recording') + (r.uploaded_at || r.created_at ? ' · ' + String(r.uploaded_at || r.created_at).slice(0, 10) : '');
  const canSave = !busy && name.trim() && (src === 'upload' ? file : src === 'recording' ? recId : fromAv) && (voice === 'clone' ? cloneRec : voice);

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const r = await createHedraAvatar({
        token, name: name.trim(),
        recording_id: src === 'recording' ? recId : '', t: src === 'recording' ? t : '',
        from_avatar_id: src === 'avatar' ? fromAv : '',
        voice_id: voice !== 'clone' ? voice : '', clone_voice_recording_id: voice === 'clone' ? cloneRec : '',
      }, src === 'upload' ? file : null);
      onCreated && onCreated(r.avatar);
    } catch (e) { setErr(e.message || 'Could not create the avatar.'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }}>
      <div className="label" style={{ marginBottom: 6 }}>NAME</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane - patio look" style={full} />

      <div className="label" style={{ marginBottom: 6 }}>PHOTO</div>
      <select value={src} onChange={(e) => setSrc(e.target.value)} style={full}>
        <option value="recording">Frame from a recording</option>
        <option value="upload">Upload a photo</option>
        <option value="avatar">Use an existing avatar's look</option>
      </select>
      {src === 'recording' && (recs.length === 0
        ? <div className="mono" style={{ fontSize: 11, marginBottom: 8 }}>No recordings for this client.</div>
        : (
          <>
            <select value={recId} onChange={(e) => { setRecId(e.target.value); setT(3); setDur(null); }} style={full}>
              {recs.map((r) => <option key={r.id} value={r.id}>{recLabel(r)}</option>)}
            </select>
            <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input type="range" min="0" max={Math.max(1, Math.floor((dur || 30) - 0.5))} step="0.5" value={t} onChange={(e) => setT(Number(e.target.value))} style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 11, minWidth: 54, textAlign: 'right' }}>{t.toFixed(1)}s{dur ? ' / ' + Math.floor(dur) + 's' : ''}</span>
            </div>
            {frame && <img src={frame} alt="frame" style={{ width: '100%', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', marginBottom: 8 }} />}
            {frameErr && <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>{frameErr}</div>}
          </>
        ))}
      {src === 'upload' && (
        <>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} style={{ fontSize: 12, marginBottom: 8 }} />
          {file && <img src={URL.createObjectURL(file)} alt="upload" style={{ width: '100%', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', marginBottom: 8 }} />}
        </>
      )}
      {src === 'avatar' && (
        <select value={fromAv} onChange={(e) => setFromAv(e.target.value)} style={full}>
          <option value="">Choose an avatar…</option>
          {lookAvatars.map((a) => <option key={a.id} value={a.id}>{a._invite || a.name || a.contact}{a._hedra ? ' (Hedra)' : ''}</option>)}
        </select>
      )}

      <div className="label" style={{ marginBottom: 6 }}>VOICE</div>
      <select value={voice} onChange={(e) => setVoice(e.target.value)} style={full}>
        {voices.map((v) => <option key={v.voice_id} value={v.voice_id}>{v.name} ({v.source === 'heygen' ? 'HeyGen voice' : 'ElevenLabs'})</option>)}
        <option value="clone">Clone a new voice from a recording (ElevenLabs)</option>
      </select>
      {voice === 'clone' && (recs.length
        ? <select value={cloneRec} onChange={(e) => setCloneRec(e.target.value)} style={full}>{recs.map((r) => <option key={r.id} value={r.id}>{recLabel(r)}</option>)}</select>
        : <div className="mono" style={{ fontSize: 11, marginBottom: 8 }}>No recordings to clone from.</div>)}

      {err && <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>{err}</div>}
      <button className="btn primary sm" disabled={!canSave} onClick={save} style={{ opacity: canSave ? 1 : 0.5 }}>
        {busy ? 'Creating…' : 'Create Hedra photo avatar'}
      </button>
    </div>
  );
}

// One labelled setting in the Studio right column (module level so typing in
// a field inside it never remounts the input).
const RailField = ({ label, hint, children }) => (
  <div style={{ marginBottom: 16 }}>
    <div className="label" style={{ marginBottom: 6 }}>{label}</div>
    {children}
    {hint ? <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 5, lineHeight: 1.5 }}>{hint}</div> : null}
  </div>
);
const engineLabel = (e, hedraModel) => (e === 'hedra' ? 'Hedra' + (hedraModel ? ' · ' + hedraModel : '') : engineName(e));

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

const StudioView = ({ onNavigate, castRequest, onCastConsumed, activeClientId, onSelectClient, openStep }) => {
  // —— decision flow ——
  const [step, setStep] = React.useState(openStep || 'home');   // home | assets | client | destination | type | render
  const [clientId, setClientId] = React.useState(null);
  // Local approval state for casts, keyed on the Railway video id.
  const [castMeta, setCastMeta] = React.useState({});
  // Must stay above the `if (!clientId) return` guard - see the note on
  // refreshCastMeta below. Hooks declared after it change the hook count
  // between renders and blank the page.
  const [buildingTwin, setBuildingTwin] = React.useState(false);
  const [cloningVoice, setCloningVoice] = React.useState(false);
  const [sendCast, setSendCast] = React.useState(null);      // cast being sent to the client for preview (opens the modal)
  const [sendingCast, setSendingCast] = React.useState(false);
  const [stitchRequest, setStitchRequest] = React.useState(null);     // cast handed to Episode assembly (same rule)

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
  const editCastScriptRef = React.useRef(null);
  const [editCastAspect, setEditCastAspect] = React.useState('16:9');
  const [recasting, setRecasting] = React.useState(false);
  const [voiceProfiles, setVoiceProfiles] = React.useState([]);
  const [voiceProfileId, setVoiceProfileId] = React.useState('');
  const [volumeBoost, setVolumeBoost] = React.useState(0);   // dB, ElevenLabs audio casts only — 0 = untouched
  const [audioOutputs, setAudioOutputs] = React.useState([]);
  const [synthing, setSynthing] = React.useState(false);
  const [audioErr, setAudioErr] = React.useState('');
  const [destination, setDestination] = React.useState('download');
  const [contentType, setContentType] = React.useState('file');
  const [renderMode, setRenderMode] = React.useState('video');   // video | assembly

  // —— render step (video) ——
  const [avatarId, setAvatarId] = React.useState(null);
  // New-look generator for the selected client avatar (hooks stay above the early returns).
  const [newLookOpen, setNewLookOpen] = React.useState(false);
  const [lookNonce, setLookNonce] = React.useState(0);
  const [script, setScript] = React.useState(DEFAULT_SCRIPT);
  const scriptRef = React.useRef(null);
  const [castTitle, setCastTitle] = React.useState('');
  const [castJobNumber, setCastJobNumber] = React.useState('');
  const [castScriptId, setCastScriptId] = React.useState(null);
  // Channel of the script sent over from Scripts ('shortform', 'longform', ...).
  // A shortform is locked to 9:16 so it can't be cast (and paid for) horizontal.
  const [castChannel, setCastChannel] = React.useState(null);
  const lockVertical = castChannel === 'shortform';
  const [scene, setScene] = React.useState('studio');
  const [language, setLanguage] = React.useState('EN');
  const [aspectRatio, setAspectRatio] = React.useState('16:9');
  const [engine, setEngine] = React.useState('auto');  // 'auto' | 'avatar_v' | 'avatar_iv' | 'avatar_iii' | 'hedra:<model>'
  // Hedra engine: shown only when the render server has it switched on.
  const [hedra, setHedra] = React.useState({ enabled: false, models: [] });
  const [hedraRes, setHedraRes] = React.useState('1080p');
  React.useEffect(() => { hedraModels().then((h) => setHedra({ enabled: !!h.enabled, models: h.models || [] })); }, []);
  const isHedra = String(engine).startsWith('hedra:');
  const hedraModel = isHedra ? hedra.models.find((m) => m.id === engine.slice(6)) : null;
  const hOpt = (hedraModel && hedraModel.options) || {};
  // Hedra-only settings (each shown only if the chosen model's API accepts it).
  const [hedraDirection, setHedraDirection] = React.useState('');
  const [hedraQuality, setHedraQuality] = React.useState('');
  const [voiceFor, setVoiceFor] = React.useState(null);        // avatar whose ElevenLabs settings are open
  const [hedraDuration, setHedraDuration] = React.useState('');
  const [focusX, setFocusX] = React.useState(0.5);
  const [focusY, setFocusY] = React.useState(0.5);
  const [speakerPoint, setSpeakerPoint] = React.useState(null);
  const [hedraPrep, setHedraPrep] = React.useState(null);      // { prepared_id, price, photo, request }
  const [hedraPrepBusy, setHedraPrepBusy] = React.useState(false);
  const [hedraPrepErr, setHedraPrepErr] = React.useState('');
  const [newHedraOpen, setNewHedraOpen] = React.useState(false);
  // Prompt text for a cast. HeyGen: the standing guidance + the Delivery text.
  // Hedra: ONLY the Delivery text (Calm's text is spelled out, since Calm adds
  // nothing for HeyGen) - nothing hidden; the pre-render check shows it all.
  const promptFor = (deliveryText) => (isHedra ? (deliveryText || HEDRA_CALM_TEXT) : buildMotionPrompt(deliveryText));
  const selStyle = { padding: '7px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13 };
  const hedraFields = (extra = {}) => hedraBody({
    direction: hedraDirection.trim(), quality: hOpt.quality ? (hedraQuality || hOpt.quality[0]) : null,
    speakerPoint: hOpt.speaker_point ? speakerPoint : null, durationS: hOpt.duration_max_ms ? hedraDuration : null,
    focusX, focusY, ...extra,
  });
  // Pre-render check (credit safety): Generate/Recast open this instead of
  // rendering. take = the full-script voice preview; checks gate the Render button.
  const [preflight, setPreflight] = React.useState(null);   // { kind: 'cast' | 'recast', script, avatarId, aspect }
  const [take, setTake] = React.useState(null);              // { url, source, script, avatarId }
  const [takeBusy, setTakeBusy] = React.useState(false);
  const [takeErr, setTakeErr] = React.useState('');
  const [checks, setChecks] = React.useState({ voice: false, look: false, final: false });
  const [expressiveness, setExpressiveness] = React.useState('low');  // 'low' | 'medium' | 'high'
  const [delivery, setDelivery] = React.useState('calm');
  const [customMotion, setCustomMotion] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const genLock = React.useRef(false);   // synchronous guard against overlapping generate() calls (mirrors scripts.jsx)
  const [queue, setQueue] = React.useState([]);
  const [zoom, setZoom] = React.useState(false);   // cast-preview full-size lightbox

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

  // If the selected avatar for an audio cast is a recording that already has
  // a cloned voice profile, use that voice automatically — otherwise
  // voiceProfileId defaults to whichever profile loaded first, which is how a
  // cast could come back in the wrong voice.
  React.useEffect(() => {
    if (castType !== 'audio' || !avatarId) return;
    const sel = avatars.find((a) => a.id === avatarId);
    const recordingId = sel && (sel._recordingId || sel.recording_id);
    if (!recordingId) return;
    const linked = voiceProfiles.find((p) => p.recording_id && String(p.recording_id) === String(recordingId));
    if (linked && String(voiceProfileId) !== String(linked.id)) setVoiceProfileId(String(linked.id));
  }, [castType, avatarId, avatars, voiceProfiles]);

  // —— background picker (color / brand image / gradient / video) ——
  const [bgMode, setBgMode] = React.useState('none');
  const [gradFrom, setGradFrom] = React.useState('#141428');
  const [gradTo, setGradTo] = React.useState('#4a4a6a');
  const [gradDir, setGradDir] = React.useState('to bottom');
  const [bgBusy, setBgBusy] = React.useState('');
  const reloadBgAssets = () => (activeClientId ? api.listAssets(activeClientId).then((r) => setBgAssets((Array.isArray(r) ? r : []).filter((a) => a.kind === 'background'))).catch(() => {}) : Promise.resolve());
  const pickBgColor = (c) => { setBackgroundColor(c); setBackgroundAssetId(null); };
  const pickBgAsset = (id) => { setBackgroundAssetId(id); setBackgroundColor(null); };
  const clearBg = () => { setBackgroundColor(null); setBackgroundAssetId(null); };
  const uploadBg = async (file) => {
    if (!file || !activeClientId) return;
    setBgBusy('upload');
    try { const a = await api.uploadAsset(activeClientId, 'background', file); await reloadBgAssets(); const nid = a && (a.id || (a.asset && a.asset.id)); if (nid) pickBgAsset(nid); }
    catch (e) { console.warn('background upload failed:', e); } finally { setBgBusy(''); }
  };
  const makeGradient = async () => {
    if (!activeClientId) return;
    setBgBusy('gradient');
    try {
      const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
      const ctx = cv.getContext('2d');
      const pts = gradDir === 'to right' ? [0, 0, cv.width, 0] : gradDir === 'to bottom right' ? [0, 0, cv.width, cv.height] : [0, 0, 0, cv.height];
      const g = ctx.createLinearGradient(pts[0], pts[1], pts[2], pts[3]);
      g.addColorStop(0, gradFrom); g.addColorStop(1, gradTo);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
      const file = new File([blob], `gradient-${Date.now()}.png`, { type: 'image/png' });
      const a = await api.uploadAsset(activeClientId, 'background', file); await reloadBgAssets();
      const nid = a && (a.id || (a.asset && a.asset.id)); if (nid) pickBgAsset(nid);
    } catch (e) { console.warn('gradient generate failed:', e); } finally { setBgBusy(''); }
  };

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

      const perTokenFull = await Promise.all(
        tokens.map((t) => api.listAvatars(t).catch(() => ({})))
      );
      const perToken = perTokenFull.map((r) => (r && r.avatars) || []);
      // Shared talent library (generic AI announcers/voiceovers) — castable for
      // every client; the render engine returns it with each client's list.
      // Take it from the first token that answered, so one dead invite can't hide
      // talent from a client who has no twin of their own.
      const talentIdx = perTokenFull.findIndex((r) => r && Array.isArray(r.talent));
      const talentList = talentIdx >= 0 ? perTokenFull[talentIdx].talent : [];
      const talentToken = talentIdx >= 0 ? tokens[talentIdx] : (tokens[0] || null);
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
      for (const t of talentList) {
        list.push({ ...normalizeAvatar(t), _talent: true, _voiceOnly: false, _token: talentToken, _invite: t.name });
      }
      // Hedra photo avatars (photo + voice, nothing at HeyGen). Only on servers
      // with Hedra; a 404 just means none.
      const hedraLists = await Promise.all(tokens.map((t) => hedraAvatars(t).then((r) => ({ t, rows: r.avatars || [] })).catch(() => ({ t, rows: [] }))));
      for (const { t, rows } of hedraLists) {
        for (const a of rows) {
          if (seen.has(a.id)) continue;
          seen.add(a.id);
          list.push({ ...a, contact: a.name, languages: [], status: 'ready', _hedra: true, _voiceOnly: false, _token: t, _invite: a.name });
        }
      }
      // Recordings whose twin has not been built yet. Without these the Cast
      // page shows nothing for a client who has recorded but has no avatar -
      // which is every voice-only take, and every take before its twin exists.
      try {
        // A recording counts as "built" only if it has an avatar with a real
        // HeyGen id. A broken avatar row (e.g. voice clone failed, heygen id
        // null) must NOT hide the recording — otherwise the take vanishes with
        // no way to rebuild it.
        const builtFrom = new Set(
          list.filter((a) => a.heygen_avatar_id).map((a) => a.recording_id).filter(Boolean).map(String)
        );
        const results = await Promise.all(
          tokens.map((t) => listRecordings(t)
            .then((r) => ({ ok: true, rows: (Array.isArray(r) ? r : (r.recordings || [])).map((rec) => ({ ...rec, _token: t })) }))
            .catch(() => ({ ok: false, rows: [] })))
        );
        const perTokenRecs = results.map((r) => r.rows);
        const allFetchesOk = results.every((r) => r.ok);

        // Deleting a recording deletes its avatar server-side now, but older
        // orphans can remain. Drop an avatar whose source recording is gone —
        // but scope this PER TOKEN: only prune avatars belonging to a token
        // whose recordings fetch actually succeeded, so one token's network
        // failure can neither strand deleted avatars nor hide a live recording.
        const okByToken = {};
        results.forEach((r, i) => { okByToken[tokens[i]] = r.ok; });
        const liveRecIdsByToken = {};
        results.forEach((r, i) => {
          if (r.ok) liveRecIdsByToken[tokens[i]] = new Set(r.rows.map((rec) => String(rec.id)));
        });
        for (let i = list.length - 1; i >= 0; i--) {
          const a = list[i];
          if (a.recording_id == null) continue;
          const tk = a._token;
          // Only prune if we have a trustworthy live-recording set for this
          // avatar's own token.
          if (tk && okByToken[tk] && liveRecIdsByToken[tk] && !liveRecIdsByToken[tk].has(String(a.recording_id))) {
            list.splice(i, 1);
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
    if (castRequest.title != null) setCastTitle(castRequest.title);
    setCastJobNumber(castRequest.jobNumber || '');
    setCastScriptId(castRequest.scriptId || null);
    setCastChannel(castRequest.channel || null);
    if (castRequest.channel === 'shortform') setAspectRatio('9:16');
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
    setAspectRatio(lockVertical ? '9:16' : t.ar);
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
      { id: 'publish-status', label: 'Publish status', desc: "What's on air now & what's in production", icon: 'chart', go: () => onNavigate?.('publish-status') },
      { id: 'scripts',    label: 'Scripts',       desc: 'Write & manage client scripts',      icon: 'doc',     go: () => onNavigate?.('scripts') },
      { id: 'recordings', label: 'Recordings',    desc: 'Client masters & cue:cast renders',  icon: 'play',    go: () => onNavigate?.('recordings') },
      { id: 'cast',       label: 'Cast a script', desc: 'Quick-render an avatar video',        icon: 'sparkle', go: () => { if (activeClientId) selectClientInline(activeClientId); setStep('render'); } },
      { id: 'assets',     label: 'Assets',        desc: 'Logos, music, backgrounds & fonts',  icon: 'upload',  go: () => setStep('assets') },
      { id: 'montage',    label: 'Montage',       desc: 'Slideshow video from images + music', icon: 'play',    go: () => setStep('montage') },
      { id: 'planner',    label: 'Planner',       desc: 'Approved episodes ready to publish', icon: 'history', go: () => onNavigate?.('planner') },
      { id: 'episodes',   label: 'Episodes',      desc: 'Stitch audio + video episodes',      icon: 'studio',  go: () => onNavigate?.('episodes') },
      { id: 'episode-log', label: 'Episode Log',  desc: 'Week/episode/air date & deadline status', icon: 'history', go: () => onNavigate?.('episode-log') },
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

  if (step === 'montage') {
    return (
      <div className="fade-in" style={{ padding: 'var(--pad)', overflow: 'auto', height: '100%' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn sm" onClick={() => onNavigate('clients')}><Icon name="arrow-l" size={12} /> Clients</button>
          <button className="btn sm" onClick={() => setStep('home')}><Icon name="arrow-l" size={12} /> Studio</button>
        </div>
        <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, letterSpacing: '-0.01em', margin: '18px 0 4px' }}>Montage</h1>
        <div className="mono" style={{ color: 'var(--text-4)', marginBottom: 4 }}>Build a slideshow video from product images, uploads, or AI-generated art — with music and motion.</div>
        {activeClientId != null
          ? <MontageBuilder clientId={activeClientId} />
          : <div className="mono" style={{ color: 'var(--text-3)', marginTop: 16 }}>Pick a client first to build a montage.</div>}
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
        <div className="mono" style={{ color: 'var(--text-4)', marginBottom: 4 }}>Shared library of logos, backgrounds, music, and fonts for stitching.</div>
        {activeClientId != null
          ? <AssetsSection clientId={activeClientId} />
          : <div className="mono" style={{ color: 'var(--text-3)', marginTop: 16 }}>Pick a client first to manage their assets.</div>}
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
  // Hedra: rough price = Hedra's published per-second rate (from the model's
  // price text) x estimated length. The exact price is in the pre-render check.
  const hedraEst = (() => {
    if (!isHedra) return null;
    const rates = hOpt.price_rates || [];
    if (!rates.length) return null;
    const res = hOpt.resolutions && hOpt.resolutions.length
      ? (hOpt.resolutions.includes(hedraRes) ? hedraRes : hOpt.resolutions[hOpt.resolutions.length - 1]) : null;
    const q = String(hedraQuality || (hOpt.quality && hOpt.quality[0]) || '').toLowerCase();
    const fits = rates.filter((r) => !r.quality || !q || r.quality === q);
    const rate = (res && fits.find((r) => r.resolutions.includes(res))) || (fits.length === 1 ? fits[0] : null);
    if (!rate) return null;
    const secs = estSeconds + 1.5; // the voice track ends with a 1.5 s hold
    return { cost: (Math.ceil(secs) * rate.usd_per_second).toFixed(2), res: res || rate.resolutions[0], perSec: rate.usd_per_second };
  })();
  const canGenerate = !generating && !!script.trim() && !!avatar && avatar.status === 'ready' && !avatar._unbuilt;

  const reloadQueue = async () => {
    if (!token) return;
    try { const v = await listVideos(token); setQueue(v.videos || []); } catch { /* ignore */ }
    refreshCastMeta();
  };
  // Send a cast to the client to preview: emails them the cast review link.
  // Called by the modal's Send with the entered email + note.
  const doSendCast = async (email, note) => {
    if (!sendCast) return;
    setSendingCast(true);
    try {
      const r = await api.sendCastForReview(clientId, sendCast.id, sendCast.title || null, email || undefined, note || undefined);
      setSendCast(null);
      if (r && r.email && r.email.sent) {
        window.alert('Preview link sent.');
      } else {
        window.alert('Saved, but the email did not send: '
          + ((r && r.email && r.email.error) || 'unknown')
          + (r && r.review_link ? '\n\nLink: ' + r.review_link : ''));
      }
      await refreshCastMeta();
    } catch (e) { window.alert('Could not send: ' + e.message); }
    finally { setSendingCast(false); }
  };
  // Casts aren't sent for approval (the episode group was approved on its
  // script) - they go straight to stitching. Opens Episode assembly with the
  // cast as the body, linked to its script so it groups under the episode #.
  const stitchCast = async (v) => {
    const m = castMeta[v.id] || {};
    let s = null;
    if (m.script_id) {
      try {
        const r = await api.listScripts(clientId);
        const rows = Array.isArray(r) ? r : (r && r.scripts ? r.scripts : []);
        s = rows.find((x) => x.id === m.script_id) || null;
      } catch { /* fall back to the cast title */ }
    }
    try {
      const eps = await ep.list(clientId);
      const list = Array.isArray(eps) ? eps : (eps && eps.episodes) || [];
      const existing = s && list.find((e) => e.script_id === s.id);
      if (existing) {
        if (window.confirm(`"${existing.title}" already exists for this script. Use this cast as its body?\n\nOK = replace the body with this cast. Cancel = just open it.`)) {
          await ep.useVideo(clientId, existing.id, 'body', v.url, v.title || undefined);
        }
        setStitchRequest({ openId: existing.id });
        setRenderMode('assembly');
        return;
      }
    } catch { /* if the lookup fails, start a new episode below */ }
    setStitchRequest({
      kind: 'video', videoUrl: v.url,
      title: s ? scriptEpLabel(s) : (v.title || 'Episode'),
      topic: (s && s.topic && s.topic.trim()) || undefined,
      jobNumber: (s && s.job_number) || m.job_number || undefined,
      scriptId: s ? s.id : null,
    });
    setRenderMode('assembly');
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
      const created = await voice.createProfile(clientId, label, file, recordingId);
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
      const recastPromptText = customMotion.trim() || DELIVERY_PROMPTS[delivery];
      await generateVideo(editCastScript.trim(), {
        token,
        title: (editCastTitle.trim() || editCast.title || 'Untitled').replace(/(?:\s*\(recast\))+\s*$/i, '') + ' (recast)',
        avatarId: editCast.avatar_id || undefined,
        aspectRatio: editCastAspect,
        engine,
        resolution: isHedra ? hedraRes : undefined,
        hedra: isHedra ? hedraFields({ preparedId: hedraPrep && hedraPrep.prepared_id }) : undefined,
        expressiveness,
        motionPrompt: promptFor(recastPromptText),
        deliveryLabel: customMotion.trim() ? 'Custom' : (DELIVERY_LABELS[delivery] || delivery),
        deliveryPrompt: recastPromptText || null,
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
      await saveBlobWithPrompt(blob, ((v.title || 'cast').replace(/[^\w-]+/g, '_')).slice(0, 40) + '.mp3');
    } catch (e) { alert(e.message || 'Could not extract audio'); }
  };
  const downloadWaveform = async (v) => {
    if (!v.url) return;
    try {
      const blob = await castWaveformBlob(v.url, v.thumbnail_url || '');
      await saveBlobWithPrompt(blob, ((v.title || 'cast').replace(/[^\w-]+/g, '_')).slice(0, 40) + '-waveform.mp4');
    } catch (e) { alert(e.message || 'Could not render waveform'); }
  };
  // A separate boosted download — HeyGen owns the voice on a video cast, so
  // there's no gain control at render time; this downloads a copy with the
  // audio boosted, leaving the original cast untouched.
  const downloadBoosted = async (v) => {
    if (!v.url) return;
    try {
      const blob = await castBoostedVideoBlob(v.url, 6);
      await saveBlobWithPrompt(blob, ((v.title || 'cast').replace(/[^\w-]+/g, '_')).slice(0, 40) + '-boosted.mp4');
    } catch (e) { alert(e.message || 'Could not boost the volume'); }
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
      await voice.synthesize(clientId, Number(voiceProfileId), script.trim(), volumeBoost || undefined);
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
    if (genLock.current) return;   // block overlapping re-fires (double/triple click) before state disables the button
    genLock.current = true;
    setGenerating(true);
    try {
      const before = new Set(queue.map((q) => q.id));
      const deliveryPromptText = customMotion.trim() || DELIVERY_PROMPTS[delivery];
      const bgAsset = backgroundAssetId ? (bgAssets.find((a) => a.id === backgroundAssetId) || null) : null;
      await generateVideo(script, {
        token, title: castTitle.trim() || script.slice(0, 60), avatarId, caption,
        background: (!backgroundAssetId && backgroundColor) ? { type: 'color', value: backgroundColor } : null,
        aspectRatio: lockVertical ? '9:16' : aspectRatio, backgroundAssetId, engine, expressiveness,
        resolution: isHedra ? hedraRes : undefined,
        hedra: isHedra ? hedraFields({ preparedId: hedraPrep && hedraPrep.prepared_id }) : undefined,
        motionPrompt: promptFor(deliveryPromptText),
        deliveryLabel: customMotion.trim() ? 'Custom' : (DELIVERY_LABELS[delivery] || delivery),
        deliveryPrompt: deliveryPromptText || null,
        backgroundFile: bgAsset ? bgAsset.filename : (backgroundColor ? `Color ${backgroundColor}` : null),
      });
      const v = await listVideos(token).catch(() => ({ videos: [] }));
      setQueue(v.videos || []);
      // Register the job number on the newly created cast's local mirror so it
      // carries forward to approvals, episodes, and the planner. Always register
      // the cast (even with no job #) so every render is mirrored locally and
      // logged for billing — HeyGen usage is recorded on this upsert.
      {
        const fresh = (v.videos || []).find((x) => !before.has(x.id));
        if (fresh) {
          try {
            await api.castUpsert(clientId, fresh.id, castTitle.trim() || undefined, castJobNumber.trim() || undefined, castScriptId);
            const rows = await api.listCasts(clientId).catch(() => []);
            const byId = {};
            (Array.isArray(rows) ? rows : []).forEach((c) => { byId[c.railway_video_id] = c; });
            setCastMeta(byId);
          } catch { /* mirror registration is best-effort */ }
        }
      }
    } catch (e) {
      console.error('generate failed:', e.message);
      alert(e.message || 'Cast failed — the video could not be generated.');
    } finally {
      setGenerating(false);
      genLock.current = false;
    }
  };

  // —— pre-render check ——
  // HeyGen's credit-safety habit, built in: hear the full script, check the
  // look, and confirm everything is final before a single credit is spent.
  const openPreflight = (kind) => {
    const pScript = (kind === 'recast' ? editCastScript : script).trim();
    if (!pScript) return;
    setChecks({ voice: false, look: false, final: false });
    setTakeErr('');
    const pf = { kind, script: pScript, avatarId: kind === 'recast' ? (editCast && editCast.avatar_id) || null : avatarId, aspect: kind === 'recast' ? editCastAspect : (lockVertical ? '9:16' : aspectRatio) };
    setPreflight(pf);
    setHedraPrep(null); setSpeakerPoint(null);
    if (isHedra) loadHedraPrep(pf);
  };
  // Hedra: the exact cropped photo + Hedra's own price for this cast (free).
  const loadHedraPrep = async (pf = preflight) => {
    if (!pf || !token || !isHedra) return;
    setHedraPrepBusy(true); setHedraPrepErr(''); setHedraPrep(null);
    try {
      const deliveryText = customMotion.trim() || DELIVERY_PROMPTS[delivery];
      const r = await hedraPrepare({
        token, script: pf.script, avatar_id: pf.avatarId, engine, aspect_ratio: pf.aspect, resolution: hedraRes,
        motion_prompt: promptFor(deliveryText), ...hedraFields(),
      });
      setHedraPrep(r);
    } catch (e) { setHedraPrepErr(e.message || 'Could not get the Hedra price.'); }
    finally { setHedraPrepBusy(false); }
  };
  const takeFresh = !!(take && preflight && take.script === preflight.script && take.avatarId === preflight.avatarId);
  const loadTake = async () => {
    if (!preflight || !token) return;
    setTakeBusy(true); setTakeErr('');
    try {
      const r = await previewCastAudio(token, preflight.script, preflight.avatarId);
      if (take && take.url) URL.revokeObjectURL(take.url);
      setTake({ ...r, script: preflight.script, avatarId: preflight.avatarId });
    } catch (e) { setTakeErr(e.message || 'Could not preview the voice.'); }
    finally { setTakeBusy(false); }
  };
  const confirmRender = () => {
    const kind = preflight && preflight.kind;
    setPreflight(null);
    if (kind === 'recast') recastVideo(); else generate();
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
    setAspectRatio(lockVertical ? '9:16' : opt.ar);
    setRenderMode(opt.assembly ? 'assembly' : 'video');
  };

  return (
    <div className="fade-in" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* top bar: breadcrumb + mode toggle */}
      <div className="row" style={{ justifyContent: 'space-between', padding: '10px var(--pad)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {client && (
            <span className="row" style={{ gap: 6, padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13 }}>
              <Icon name="avatars" size={13} style={{ color: 'var(--accent)' }} /> {client.name}
            </span>
          )}
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
        ? <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}><EpisodesView activeClientId={clientId} episodeRequest={stitchRequest} onEpisodeRequestConsumed={() => setStitchRequest(null)} /></div>
        : (
          <div className="rail-320" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', flex: 1, minHeight: 0 }}>
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
                  </div>
                </div>
                <div
                  onClick={() => { if (avatar && (avatar.image_url || avatar.thumbnail_url)) setZoom(true); }}
                  style={{
                  aspectRatio: aspectRatio === '16:9' ? '16/9' : (aspectRatio === '9:16' ? '9/16' : '1/1'),
                  maxHeight: 480,
                  margin: '0 auto',
                  position: 'relative',
                  background: '#0a0a0a',
                  display: 'grid', placeItems: 'center',
                  cursor: (avatar && (avatar.image_url || avatar.thumbnail_url)) ? 'zoom-in' : 'default',
                  // Sized off a 480px cap (was 320 — too small to actually judge
                  // framing/cropping at a glance, the whole point of this preview).
                  // width:100% here made the box full-width but capped-short, which
                  // cropped the avatar (object-fit: cover) — the "too short" preview.
                  // AvatarTile's fit="auto" (below) now handles orientation mismatch
                  // itself, so this no longer needs a narrow width to avoid cropping.
                  width: aspectRatio === '9:16' ? 270 : (aspectRatio === '1:1' ? 480 : 'min(100%, 853px)')
                }}>
                  <AvatarTile avatar={avatar} fit="auto" />
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

              {zoom && avatar && (avatar.image_url || avatar.thumbnail_url) && (
                <div onClick={() => setZoom(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.85)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 200, cursor: 'zoom-out' }}>
                  <img src={avatar.image_url || avatar.thumbnail_url} alt="avatar full size" style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 10, border: '1px solid var(--border)', objectFit: 'contain' }} />
                </div>
              )}

              {/* cast title */}
              <div style={{ marginBottom: 16 }}>
                <span className="label">CAST TITLE</span>
                <input
                  className="textarea"
                  value={castTitle}
                  onChange={(e) => setCastTitle(e.target.value)}
                  placeholder="Carried over from the script — edit if you like"
                  style={{ minHeight: 0, height: 40, fontSize: 14, marginTop: 8 }}
                />
              </div>

              {/* script editor */}
              <div style={{ marginBottom: 24 }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="label">SCRIPT</span>
                  <span className="mono">{wordCount} words · ~{estSeconds}s · {isHedra ? (hedraEst ? '~$' + hedraEst.cost : 'Hedra price before paying') : '$' + estCost}</span>
                </div>
                <textarea
                  ref={scriptRef}
                  className="textarea"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={8}
                  placeholder="Paste or write the script you want the avatar to deliver…"
                  style={{ fontSize: 15, fontFamily: 'var(--f-display)', lineHeight: 1.5, letterSpacing: '0', minHeight: 180 }}
                />
                <ExpressionTags value={script} onChange={setScript} textareaRef={scriptRef} />
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
                          <button className="btn sm" onClick={() => downloadWithPrompt(voice.outputUrl(clientId, o.id), 'voice-' + o.id + '.mp3')}><Icon name="download" size={12} /> Download audio</button>
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
                      // onBoost disabled for now — see the Volume dropdown comment above.
                      // onBoost={() => downloadBoosted(v)}
                      onStitch={() => stitchCast(v)} onSend={() => setSendCast(v)} />
                  ))}
                </div>
              )}
            </div>
            <SendReviewModal open={!!sendCast} title={sendCast ? (sendCast.title || '') : ''} busy={sendingCast} onSend={doSendCast} onClose={() => setSendCast(null)} />


            {editCast && (
              <div onClick={() => setEditCast(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.55)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 100 }}>
                <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: 'min(640px, 96vw)', maxHeight: '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="label">EDIT CAST</div>
                    <button className="btn sm" onClick={() => setEditCast(null)}>Close</button>
                  </div>
                  <input value={editCastTitle} onChange={(e) => setEditCastTitle(e.target.value)} placeholder="Cast title"
                    style={{ padding: 10, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 14 }} />
                  {editCast.script != null ? (
                    <textarea ref={editCastScriptRef} value={editCastScript} onChange={(e) => setEditCastScript(e.target.value)}
                      style={{ flex: 1, minHeight: 260, resize: 'vertical', padding: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 14, lineHeight: 1.6 }} />
                  ) : (
                    <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>No script stored for this cast (older render).</div>
                  )}
                  <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>{editCastScript.length} characters</div>
                  <ExpressionTags value={editCastScript} onChange={setEditCastScript} textareaRef={editCastScriptRef} />
                  <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>Recast format</span>
                    {['16:9', '9:16', '1:1'].map((a) => {
                      const disabled = a === '1:1' && engine === 'avatar_v';
                      return (
                      <button key={a} disabled={disabled} title={disabled ? 'Avatar V does not support square (1:1)' : undefined}
                        style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                        className={'btn sm' + (editCastAspect === a ? ' primary' : '')} onClick={() => setEditCastAspect(a)}>{a}</button>
                      );
                    })}
                  </div>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn sm" onClick={saveCastEdit}>Save title</button>
                    <button className="btn primary sm" disabled={recasting || !editCastScript.trim()} onClick={() => openPreflight('recast')}><Icon name="sparkle" size={12} /> {recasting ? 'Recasting…' : 'Recast'}</button>
                  </div>
                </div>
              </div>
            )}
            {preflight && (() => {
              const pAv = avatars.find((a) => a.id === preflight.avatarId) || avatar;
              const img = pAv && (pAv.image_url || pAv.thumbnail_url);
              const pWords = preflight.script.split(/\s+/).filter(Boolean).length;
              const pSecs = Math.max(5, Math.round(pWords / 2.5));
              const bgText = backgroundAssetId ? 'Background image' : (backgroundColor ? `Color ${backgroundColor}` : 'Default background');
              const ready = checks.voice && checks.look && checks.final;
              const check = (k, label, disabled) => (
                <label className="row" style={{ gap: 8, alignItems: 'flex-start', fontSize: 13, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
                  <input type="checkbox" checked={checks[k]} disabled={disabled} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))} style={{ marginTop: 2 }} />
                  <span>{label}</span>
                </label>
              );
              return (
                <div onClick={() => setPreflight(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.6)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 150 }}>
                  <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: 'min(620px, 96vw)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="label">PRE-RENDER CHECK</div>
                      <button className="btn sm" onClick={() => setPreflight(null)}>Back to edit</button>
                    </div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
                      Nothing is spent until you press Render. Fix anything that's off first, so credits only go on the final draft.
                    </div>

                    <div className="col" style={{ gap: 8 }}>
                      <div className="label">1 · LISTEN TO THE FULL SCRIPT</div>
                      {takeFresh
                        ? <audio src={take.url} controls style={{ width: '100%' }} />
                        : <button className="btn sm" onClick={loadTake} disabled={takeBusy} style={{ alignSelf: 'flex-start' }}>
                            <Icon name="play" size={12} /> {takeBusy ? 'Preparing audio…' : 'Play full script'}
                          </button>}
                      {takeErr && <div className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>{takeErr}</div>}
                      {takeFresh && (
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>
                          {take.source === 'heygen'
                            ? 'HeyGen free voice preview - close to the render voice.'
                            : 'This exact take is reused by the render - the video says what you hear.'}
                        </div>
                      )}
                      {check('voice', 'Pauses, pacing and pronunciation sound right', !takeFresh)}
                    </div>

                    <div className="col" style={{ gap: 8 }}>
                      <div className="label">2 · CHECK THE LOOK</div>
                      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                        {img && !isHedra && <img src={img} alt="avatar look" style={{ width: 160, maxHeight: 200, objectFit: 'contain', background: '#0a0a0a', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }} />}
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <span className="badge">{engineName(engine, hedra.models) || 'Auto engine'}</span>
                          <span className="badge">{preflight.aspect}</span>
                          {isHedra && <span className="badge">{hedraRes}</span>}
                          {preflight.kind === 'cast' && !isHedra && <span className="badge">{bgText}</span>}
                          {preflight.kind === 'cast' && !isHedra && <span className="badge">{caption ? 'Captions on' : 'No captions'}</span>}
                          {engine !== 'avatar_iii' && <span className="badge">{customMotion.trim() ? 'Custom delivery' : (DELIVERY_LABELS[delivery] || delivery)}</span>}
                          {engine !== 'avatar_iii' && engine !== 'avatar_v' && !isHedra && <span className="badge">Expressiveness {expressiveness}</span>}
                        </div>
                      </div>
                      {isHedra && (
                        <div className="col" style={{ gap: 8 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            This is the exact photo Hedra will animate, cropped to {preflight.aspect}. Background and captions don't apply.
                            {hOpt.speaker_point ? ' Click the face that should speak if there is more than one person.' : ''}
                          </div>
                          {hedraPrepBusy && <div className="mono" style={{ fontSize: 12 }}>Preparing photo and voice, asking Hedra for the price…</div>}
                          {hedraPrepErr && <div className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{hedraPrepErr}</div>}
                          {hedraPrep && hedraPrep.photo && (
                            <div style={{ position: 'relative', alignSelf: 'flex-start', cursor: hOpt.speaker_point ? 'crosshair' : 'default' }}
                              onClick={(e) => {
                                if (!hOpt.speaker_point) return;
                                const r = e.currentTarget.getBoundingClientRect();
                                setSpeakerPoint([+((e.clientX - r.left) / r.width).toFixed(3), +((e.clientY - r.top) / r.height).toFixed(3)]);
                              }}>
                              <img src={hedraPrep.photo} alt="photo Hedra will animate" style={{ display: 'block', maxWidth: 260, maxHeight: 260, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }} />
                              {speakerPoint && <div style={{ position: 'absolute', left: `calc(${speakerPoint[0] * 100}% - 7px)`, top: `calc(${speakerPoint[1] * 100}% - 7px)`, width: 14, height: 14, borderRadius: '50%', border: '2px solid #fff', background: 'var(--accent)' }} />}
                            </div>
                          )}
                          {hedraPrep && hedraPrep.request && (
                            <div style={{ fontSize: 12 }}>
                              <div className="mono" style={{ fontSize: 11, marginBottom: 4 }}>EXACT PROMPT SENT TO HEDRA</div>
                              <div style={{ whiteSpace: 'pre-wrap', padding: 8, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}>
                                {hedraPrep.request.prompt || '(none - this model takes no prompt)'}
                              </div>
                            </div>
                          )}
                          <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
                            <span className="mono" style={{ fontSize: 11 }}>Crop</span>
                            <select value={focusX} onChange={(e) => { setFocusX(Number(e.target.value)); setHedraPrep(null); setSpeakerPoint(null); }} style={selStyle}>
                              <option value={0}>Left</option><option value={0.25}>Left of centre</option><option value={0.5}>Centre</option><option value={0.75}>Right of centre</option><option value={1}>Right</option>
                            </select>
                            <select value={focusY} onChange={(e) => { setFocusY(Number(e.target.value)); setHedraPrep(null); setSpeakerPoint(null); }} style={selStyle}>
                              <option value={0}>Top</option><option value={0.5}>Middle</option><option value={1}>Bottom</option>
                            </select>
                            <button className="btn sm" disabled={hedraPrepBusy} onClick={() => loadHedraPrep()}>Update photo + price</button>
                            {speakerPoint && <button className="btn sm" onClick={() => setSpeakerPoint(null)}>Clear speaker point</button>}
                          </div>
                        </div>
                      )}
                      {engine !== 'avatar_iii' && !isHedra && (
                        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--text-3)' }}>
                          <span>Jewelry or accessories flickering in past renders? Avatar III keeps them steady.</span>
                          <button className="btn sm" onClick={() => setEngine('avatar_iii')}>Use Avatar III</button>
                        </div>
                      )}
                      {check('look', 'Framing, background and engine are right for this avatar')}
                    </div>

                    <div className="col" style={{ gap: 8 }}>
                      <div className="label">3 · CONFIRM IT'S FINAL</div>
                      {check('final', 'Script, layout and voice are final - this is the draft I want to pay for')}
                    </div>

                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span className="mono" style={{ fontSize: 12 }}>
                        {isHedra
                          ? (hedraPrep && hedraPrep.price ? `Hedra price: $${Number(hedraPrep.price.cost).toFixed(2)} ${hedraPrep.price.currency || ''} · ${hedraPrep.request && hedraPrep.request.resolution ? hedraPrep.request.resolution : ''}` : 'Hedra price: waiting…')
                          : `~${pSecs}s · ${pWords} words · est. $${(pSecs * 0.04).toFixed(2)}`}
                      </span>
                      <button className="btn primary" disabled={!ready || (isHedra && !hedraPrep)} onClick={confirmRender} style={{ opacity: (ready && (!isHedra || hedraPrep)) ? 1 : 0.5 }}>
                        <Icon name="sparkle" size={12} /> Render - spends credits
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* —— right rail: settings —— */}
            <div className="rail-aside-320" style={{ borderLeft: '1px solid var(--border)', padding: 'var(--pad)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
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
                    if (av) {
                      setAvatarId(av.id); if (av._token) setToken(av._token);
                      // A Hedra photo avatar can only render on Hedra.
                      if (av._hedra && !String(engine).startsWith('hedra:') && hedra.models[0]) setEngine('hedra:' + hedra.models[0].id);
                    }
                  }}
                  style={{
                    width: '100%', marginBottom: 22, padding: '10px 12px',
                    borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13, cursor: 'pointer'
                  }}>
                  <option value="" disabled>Select an avatar…</option>
                  {readyAvatars.some((av) => av._talent) && (
                    <optgroup label="Talent library (generic AI talent)">
                      {readyAvatars.filter((av) => av._talent).map((av) => (
                        <option key={av.id} value={av.id}>{av._invite}{av.voice_name ? ' · ' + av.voice_name : ''}</option>
                      ))}
                    </optgroup>
                  )}
                  {readyAvatars.some((av) => av._hedra) && (
                    <optgroup label="Hedra photo avatars">
                      {readyAvatars.filter((av) => av._hedra).map((av) => (
                        <option key={av.id} value={av.id}>{av.name}{av.created_at ? ' · ' + String(av.created_at).slice(0, 10) : ''}</option>
                      ))}
                    </optgroup>
                  )}
                  {readyAvatars.filter((av) => !av._talent && !av._hedra).map((av) => (
                    <option key={av.id} value={av.id} disabled={av._voiceOnly && !av._unbuilt && castType !== 'audio'}>
                      {(av._invite || av.contact)
                        + (av.created_at ? ' · ' + String(av.created_at).slice(0, 10) : '')
                        + (av._unbuilt ? ' · twin not built yet' : (av._voiceOnly ? ' · voice only' : ''))}
                    </option>
                  ))}
                </select>
              )}
              {castType === 'video' && hedra.enabled && token && (
                <div style={{ marginTop: -12, marginBottom: 16 }}>
                  <button className="btn sm" onClick={() => setNewHedraOpen((v) => !v)}>
                    <Icon name="sparkle" size={12} /> {newHedraOpen ? 'Close' : 'New Hedra photo avatar'}
                  </button>
                  {newHedraOpen && (
                    <NewHedraAvatar token={token} avatars={readyAvatars} selStyle={selStyle}
                      onCreated={async (a) => { setNewHedraOpen(false); await loadClient(clientId); if (a && a.id) { setAvatarId(a.id); if (!String(engine).startsWith('hedra:') && hedra.models[0]) setEngine('hedra:' + hedra.models[0].id); } }} />
                  )}
                </div>
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
                  const recordingId = sel._recordingId || sel.recording_id;
                  const linked = voiceProfiles.find((p) => p.recording_id && String(p.recording_id) === String(recordingId));
                  if (linked) {
                    return (
                      <div style={{ marginBottom: 22 }}>
                        <div className="mono" style={{ color: 'var(--ok)', fontSize: 12, marginBottom: 8 }}>
                          Voice ready — “{linked.label}” (below) was cloned from this recording.
                        </div>
                        <button className="btn sm" disabled={cloningVoice} onClick={() => useRecordingAsVoice(sel)}>
                          <Icon name="mic" size={12} /> {cloningVoice ? 'Cloning…' : 'Re-clone from this recording'}
                        </button>
                      </div>
                    );
                  }
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
                // ElevenLabs voice settings for this avatar (saved on the avatar,
                // used by every cast - HeyGen and Hedra). Talent voices live in the
                // talent library; HeyGen voices have no settings.
                const sel = readyAvatars.find((a) => a.id === avatarId);
                if (!sel || sel._talent || sel._unbuilt || !sel.voice_id || /^[0-9a-f]{32}$/i.test(String(sel.voice_id))) return null;
                const n = (v, d) => (v == null ? d : Number(v));
                const model = Number(sel.voice_v3) === 4 ? 'v4' : sel.voice_v3 ? 'v3' : 'v2';
                return (
                  <div style={{ marginBottom: 16 }}>
                    <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="btn sm" onClick={() => setVoiceFor({ ...sel, _name: sel._invite || sel.contact })}>
                        <Icon name="mic" size={12} /> Voice settings
                      </button>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        {model} · stab {n(sel.voice_stability, 0.5).toFixed(2)} · sim {n(sel.voice_similarity, 0.75).toFixed(2)} · style {n(sel.voice_style, 0).toFixed(2)} · speed {n(sel.voice_speed, 1).toFixed(2)}{sel.voice_speaker_boost === 0 ? ' · boost off' : ''}
                      </span>
                    </div>
                  </div>
                );
              })()}
              {voiceFor && (
                <VoiceSettings avatar={voiceFor} onClose={() => setVoiceFor(null)}
                  onSaved={(saved) => {
                    // Show the new settings here and drop any price check made with
                    // the old voice track (the server also refuses to reuse it).
                    setAvatars((list) => list.map((a) => (a.id === voiceFor.id ? { ...a, ...saved } : a)));
                    setVoiceFor((v) => (v ? { ...v, ...saved } : v));
                    setHedraPrep(null);
                  }} />
              )}
              {avatarId && (() => {
                const sel = readyAvatars.find((a) => a.id === avatarId);
                if (!sel || !sel.heygen_group_id) return null;
                if (sel._talent) {
                  return (
                    <div className="mono" style={{ marginBottom: 22, fontSize: 12, color: 'var(--text-3)' }}>
                      Talent library avatar · voice {sel.voice_name || 'set in Talent'} · change its look or voice on the Talent page.
                    </div>
                  );
                }
                return (
                  <div style={{ marginBottom: 22 }}>
                    <div className="label" style={{ marginBottom: 8 }}>LOOK</div>
                    <LookPicker key={sel.id + ':' + lookNonce} avatar={sel} onSet={() => loadClient(clientId)} />
                    <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setNewLookOpen((v) => !v)}>
                      <Icon name="sparkle" size={12} /> {newLookOpen ? 'Hide new look' : 'New look'}
                    </button>
                    {newLookOpen && (
                      <NewLookPanel groupId={sel.heygen_group_id} baseLookId={sel.heygen_avatar_id} defaultName={(sel._invite || sel.contact || 'Avatar') + ' — new look'}
                        onCreated={() => setTimeout(() => setLookNonce((n) => n + 1), 1500)} onClose={() => setNewLookOpen(false)} />
                    )}
                  </div>
                );
              })()}

              {(() => {
                const selAv = readyAvatars.find((a) => a.id === avatarId);
                const hedraOnlyAvatar = !!(selAv && selAv._hedra);
                const full = { ...selStyle, width: '100%' };
                const aspects = ['16:9', '9:16', '1:1'].filter((r) =>
                  !(r === '1:1' && engine === 'avatar_v') && !(lockVertical && r !== '9:16') &&
                  !(isHedra && hOpt.aspect_ratios && !hOpt.aspect_ratios.includes(r)));
                const resolutions = (hOpt.resolutions || ['540p', '720p', '1080p']);
                const engineHint = isHedra
                  ? `${hedraModel ? hedraModel.note + '. ' : ''}Animates the avatar's photo with the same voice track; you'll see the exact photo and Hedra's price before paying.`
                  : engine === 'avatar_v' ? 'Preserves the photo\u2019s teeth/structure; minimal expression. No 1:1.'
                  : engine === 'avatar_iv' ? 'More expressive; photo twins can show the wide-smile glitch.'
                  : engine === 'avatar_iii' ? 'Steadiest: accessories stay put. Ignores Expressiveness and Delivery.'
                  : 'Avatar V for photo twins (falls back to IV), Avatar IV for stock avatars.';
                return (
                  <>
                    <RailField label="RENDER ENGINE" hint={engineHint}>
                      <select value={engine} style={full} onChange={(e) => {
                        const v = e.target.value; setEngine(v); setHedraPrep(null); setSpeakerPoint(null);
                        if (v === 'avatar_v' && aspectRatio === '1:1') setAspectRatio('16:9');
                      }}>
                        <optgroup label="HeyGen">
                          {[['auto', 'Auto'], ['avatar_v', 'Avatar V'], ['avatar_iv', 'Avatar IV'], ['avatar_iii', 'Avatar III']].map(([k, t]) => (
                            <option key={k} value={k} disabled={hedraOnlyAvatar}>{t}{hedraOnlyAvatar ? ' (not for Hedra photo avatars)' : ''}</option>
                          ))}
                        </optgroup>
                        {hedra.enabled && hedra.models.length > 0 && (
                          <optgroup label="Hedra">
                            {hedra.models.map((m) => <option key={m.id} value={'hedra:' + m.id}>{m.label}{m.longform ? '' : ' (shortforms only)'}</option>)}
                          </optgroup>
                        )}
                      </select>
                    </RailField>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <RailField label="ASPECT RATIO" hint={lockVertical ? 'Shortforms always 9:16.' : null}>
                        <select value={aspects.includes(aspectRatio) ? aspectRatio : (aspects[0] || '16:9')} style={full}
                          onChange={(e) => { setAspectRatio(e.target.value); setHedraPrep(null); }}>
                          {aspects.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </RailField>
                      {isHedra ? (
                        <RailField label="RESOLUTION">
                          <select value={resolutions.includes(hedraRes) ? hedraRes : resolutions[resolutions.length - 1]} style={full}
                            onChange={(e) => { setHedraRes(e.target.value); setHedraPrep(null); }}>
                            {resolutions.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </RailField>
                      ) : (
                        <RailField label="CAPTIONS">
                          <select value={caption ? 'on' : 'off'} style={full} onChange={(e) => setCaption(e.target.value === 'on')}>
                            <option value="off">Off</option>
                            <option value="on">Burn-in captions</option>
                          </select>
                        </RailField>
                      )}
                    </div>

                    {isHedra && (hOpt.quality || hOpt.duration_max_ms) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {hOpt.quality && (
                          <RailField label="QUALITY">
                            <select value={hedraQuality || hOpt.quality[0]} style={full} onChange={(e) => { setHedraQuality(e.target.value); setHedraPrep(null); }}>
                              {hOpt.quality.map((q) => <option key={q} value={q}>{q[0].toUpperCase() + q.slice(1)}</option>)}
                            </select>
                          </RailField>
                        )}
                        {hOpt.duration_max_ms && (
                          <RailField label="LENGTH (SECONDS)">
                            <input type="number" min="1" max={Math.floor(hOpt.duration_max_ms / 1000)} value={hedraDuration} placeholder="Match the voice"
                              onChange={(e) => { setHedraDuration(e.target.value); setHedraPrep(null); }} style={{ ...full, boxSizing: 'border-box' }} />
                          </RailField>
                        )}
                      </div>
                    )}

                    {!isHedra && (
                      <RailField label="BACKGROUND">
                        <select value={bgMode} style={{ ...full, marginBottom: bgMode === 'none' ? 0 : 10 }}
                          onChange={(e) => { const m = e.target.value; setBgMode(m); if (m === 'none') clearBg(); }}>
                          {[['none', 'None'], ['color', 'Color'], ['image', 'Image'], ['gradient', 'Gradient'], ['video', 'Video']].map(([m, lbl]) => <option key={m} value={m}>{lbl}</option>)}
                        </select>
              {bgMode === 'color' && (
                <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 22 }}>
                  <input type="color" value={backgroundColor || '#141428'} onChange={(e) => pickBgColor(e.target.value)} style={{ width: 44, height: 32, padding: 0, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }} />
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{backgroundColor || 'pick a color'}</span>
                </div>
              )}
              {bgMode === 'image' && (
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginBottom: 8 }}>
                    {bgAssets.filter((a) => !(a.mime || '').startsWith('video/')).map((a) => (
                      <button key={a.id} onClick={() => pickBgAsset(a.id)} title={a.filename}
                        style={{ padding: 0, height: 52, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: 'var(--surface-2)', border: backgroundAssetId === a.id ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
                        <img src={api.assetFileUrl(activeClientId, a.id)} alt={a.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </button>
                    ))}
                  </div>
                  <label className="btn sm" style={{ cursor: 'pointer' }}>
                    <Icon name="upload" size={12} /> {bgBusy === 'upload' ? 'Uploading…' : 'Upload image'}
                    <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && uploadBg(e.target.files[0])} />
                  </label>
                </div>
              )}
              {bgMode === 'gradient' && (
                <div style={{ marginBottom: 22 }}>
                  <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                    <input type="color" value={gradFrom} onChange={(e) => setGradFrom(e.target.value)} style={{ width: 36, height: 30, padding: 0, border: '1px solid var(--border)', borderRadius: 6 }} />
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>→</span>
                    <input type="color" value={gradTo} onChange={(e) => setGradTo(e.target.value)} style={{ width: 36, height: 30, padding: 0, border: '1px solid var(--border)', borderRadius: 6 }} />
                    <select value={gradDir} onChange={(e) => setGradDir(e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }}>
                      <option value="to bottom">↓ Vertical</option>
                      <option value="to right">→ Horizontal</option>
                      <option value="to bottom right">↘ Diagonal</option>
                    </select>
                  </div>
                  <div style={{ height: 40, borderRadius: 6, marginBottom: 8, border: '1px solid var(--border)', background: `linear-gradient(${gradDir}, ${gradFrom}, ${gradTo})` }} />
                  <button className="btn sm" onClick={makeGradient} disabled={bgBusy === 'gradient'}>{bgBusy === 'gradient' ? 'Generating…' : 'Use this gradient'}</button>
                </div>
              )}
              {bgMode === 'video' && (
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginBottom: 8 }}>
                    {bgAssets.filter((a) => (a.mime || '').startsWith('video/')).map((a) => (
                      <button key={a.id} onClick={() => pickBgAsset(a.id)} title={a.filename}
                        style={{ padding: 0, height: 52, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: 'var(--surface-2)', border: backgroundAssetId === a.id ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
                        <video src={api.assetFileUrl(activeClientId, a.id)} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </button>
                    ))}
                  </div>
                  <label className="btn sm" style={{ cursor: 'pointer' }}>
                    <Icon name="upload" size={12} /> {bgBusy === 'upload' ? 'Uploading…' : 'Upload video'}
                    <input type="file" accept="video/*" hidden onChange={(e) => e.target.files[0] && uploadBg(e.target.files[0])} />
                  </label>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 6 }}>Plays as a looping background behind the avatar.</div>
                </div>
              )}
                      </RailField>
                    )}

                    {!isHedra && engine !== 'avatar_v' && engine !== 'avatar_iii' && (
                      <RailField label="EXPRESSIVENESS" hint="Avatar IV only. Higher = more animated gestures and face.">
                        <select value={expressiveness} style={full} onChange={(e) => setExpressiveness(e.target.value)}>
                          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                        </select>
                      </RailField>
                    )}

                    {engine !== 'avatar_iii' && (
                      <RailField label="DELIVERY" hint={isHedra ? `Sent to Hedra exactly as: "${customMotion.trim() || DELIVERY_PROMPTS[delivery] || HEDRA_CALM_TEXT}"` : 'Drives gestures + expression on Avatar IV and V. On Avatar V a big laugh can bring back the wide-smile glitch.'}>
                        <select value={customMotion.trim() ? 'custom' : delivery} style={{ ...full, marginBottom: 6 }}
                          onChange={(e) => { if (e.target.value !== 'custom') { setDelivery(e.target.value); setCustomMotion(''); } setHedraPrep(null); }}>
                          {[['calm', 'Calm'], ['warm', 'Warm'], ['energetic', 'Energetic'], ['laughing', 'Laughing'], ['serious', 'Serious']].map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                          {customMotion.trim() && <option value="custom">Custom (typed below)</option>}
                        </select>
                        <input className="textarea" value={customMotion} onChange={(e) => { setCustomMotion(e.target.value); setHedraPrep(null); }}
                          placeholder="Custom delivery, overrides the preset"
                          style={{ minHeight: 0, height: 34, fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                        <PromptLibrary token={token} engineKind={isHedra ? 'hedra' : 'heygen'} value={customMotion} selStyle={selStyle}
                          onPick={(t) => { setCustomMotion(t); setHedraPrep(null); }} />
                      </RailField>
                    )}

                    {isHedra && (
                      <RailField label="HEDRA DIRECTION" hint={`Added after the Delivery text. This and Delivery are the only prompt Hedra gets.${hOpt.prompt_max ? ' Max ' + hOpt.prompt_max.toLocaleString() + ' characters in total.' : ''}`}>
                        <textarea className="textarea" value={hedraDirection} onChange={(e) => { setHedraDirection(e.target.value); setHedraPrep(null); }}
                          placeholder="e.g. slow push-in, warm smile at the end, leans toward camera on the key point"
                          style={{ minHeight: 70, fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                        <PromptLibrary token={token} engineKind="hedra" value={hedraDirection} selStyle={selStyle}
                          onPick={(t) => { setHedraDirection(t); setHedraPrep(null); }} />
                      </RailField>
                    )}

                    {avatar && avatar.languages && avatar.languages.length > 0 && (
                      <RailField label="LANGUAGE">
                        <select value={language} style={full} onChange={(e) => setLanguage(e.target.value)}>
                          {avatar.languages.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </RailField>
                    )}

                    {!isHedra && (
                      <a href="https://app.heygen.com/avatars" target="_blank" rel="noopener noreferrer" className="btn sm"
                        style={{ marginBottom: 16, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                        <Icon name="globe" size={13} /> HeyGen dashboard
                      </a>
                    )}
                  </>
                );
              })()}

              <div style={{ marginTop: 'auto' }} />

              <div style={{
                padding: 14,
                background: 'var(--surface-2)',
                borderRadius: 'var(--r-md)',
                marginBottom: 12,
                border: '1px solid var(--border)'
              }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="mono">{isHedra ? 'Hedra price' : 'Estimated cost'}</span>
                  <span style={{ fontFamily: 'var(--f-display)', fontSize: isHedra && !hedraEst ? 14 : 24 }}>{isHedra ? (hedraEst ? '~$' + hedraEst.cost : 'shown before you pay') : '$' + estCost}</span>
                </div>
                <div className="mono">{isHedra
                  ? (hedraEst
                    ? `~${estSeconds}s · ${wordCount} words · ${hedraEst.res} at ${(hedraEst.perSec * 100).toFixed(2).replace(/\.?0+$/, '')}¢/s (Hedra's rate) · length is a guess; exact price in the pre-render check`
                    : `~${estSeconds}s · ${wordCount} words · exact price from Hedra in the pre-render check`)
                  : `${estSeconds}s · ${wordCount} words · charged on completion`}</div>
              </div>

              {castType === 'video' ? (
                <button className="btn primary lg" onClick={() => openPreflight('cast')} disabled={!canGenerate}
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
                    <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>Voice</span>
                      <select value={voiceProfileId} onChange={(e) => setVoiceProfileId(e.target.value)}
                        style={{ flex: 1, minWidth: 120, padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13 }}>
                        {voiceProfiles.map((p) => <option key={p.id} value={p.id}>{p.label || ('Voice ' + p.id)}</option>)}
                      </select>
                      {/* Volume boost disabled for now — inconsistent results across
                          engines (boosts an ElevenLabs audio cast but not a HeyGen
                          video main), not worth chasing for one voice right now.
                      <span className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }} title="Post-process gain applied to the rendered audio — leave at Normal unless the take comes back quiet.">Volume</span>
                      <select value={volumeBoost} onChange={(e) => setVolumeBoost(Number(e.target.value))}
                        style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13 }}>
                        <option value={0}>Normal</option>
                        <option value={3}>+3dB</option>
                        <option value={6}>+6dB (boost)</option>
                        <option value={9}>+9dB</option>
                        <option value={12}>+12dB (max)</option>
                      </select>
                      */}
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
          {stitching ? <>Stitching…</> : <><Icon name="sparkle" size={14} /> STITCH DA BITCH</>}
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

const CastCard = ({ video, avatars = [], meta, onRename, onEdit, onDelete, onDownloadAudio, onWaveform, onBoost, onStitch, onSend }) => {
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
            color: meta.approval_status.startsWith('approved') ? 'var(--ok)'
              : meta.approval_status === 'changes_requested' ? 'var(--accent)' : 'var(--text-4)',
          }}>{meta.approval_status === 'approved_with_changes' ? 'approved w/ changes' : meta.approval_status.replace(/_/g, ' ')}</span>
        )}
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meta && meta.job_number ? <span className="mono" style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', marginRight: 6 }}>Job {meta.job_number}</span> : null}
          {video.title || 'Untitled cast'}
        </div>
        {engineLabel(video.engine_used, video.provider_model) ? (
          <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>{engineLabel(video.engine_used, video.provider_model)}</div>
        ) : null}
        {(video.delivery_label || video.delivery_prompt) && (
          <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4 }}>
            Delivery: {video.delivery_label || 'Custom'}{video.delivery_prompt ? ` — ${video.delivery_prompt}` : ''}
          </div>
        )}
        {video.expressiveness && (
          <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>
            Expressiveness: {video.expressiveness.charAt(0).toUpperCase() + video.expressiveness.slice(1)}
          </div>
        )}
        {video.background_file && (
          <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4 }}>
            File: {video.background_file}
          </div>
        )}
        <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>
          {fmtWhen(video.created_at || video.createdAt)} · {ready ? 'ready' : (video.status || 'rendering')}
        </div>
        {meta && (meta.approval_sent_at || meta.approval_approved_at || meta.changes_verified_at) && (
          <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>
            {meta.approval_sent_at ? 'sent ' + String(meta.approval_sent_at).slice(0, 10) : ''}
            {meta.approval_approved_at ? (meta.approval_sent_at ? ' · ' : '') + 'approved ' + fmtStamp(meta.approval_approved_at) : ''}
            {meta.changes_verified_at ? ((meta.approval_sent_at || meta.approval_approved_at) ? ' · ' : '') + 'changes verified ' + fmtStamp(meta.changes_verified_at) : ''}
          </div>
        )}
        {video.status === 'rendering' && (
          <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${video.progress || 0}%`, height: '100%', background: 'var(--accent)', transition: 'width 200ms linear' }} />
          </div>
        )}
        {video.status === 'failed' && <div className="mono" style={{ color: 'var(--accent)', fontSize: 11 }}>{video.failure_reason || 'render failed'}</div>}
        {meta && meta.approval_comment && (meta.approval_status === 'changes_requested' || meta.approval_status === 'approved_with_changes') && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--surface-2)', borderRadius: 6, padding: '6px 8px' }}>
            <strong>Client notes:</strong> {meta.approval_comment}
          </div>
        )}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          {ready && <a className="btn sm" href={video.url} download target="_blank" rel="noopener noreferrer"><Icon name="download" size={12} /> Video</a>}
          {ready && <button className="btn sm" onClick={onDownloadAudio}><Icon name="mic" size={12} /> Audio</button>}
          {ready && <button className="btn sm" onClick={onWaveform}><Icon name="sliders" size={12} /> Waveform</button>}
          {ready && onBoost && <button className="btn sm" onClick={onBoost} title="Download a copy with the audio boosted +6dB — the original cast is untouched"><Icon name="sparkle" size={12} /> Boost +6dB</button>}
          <button className="btn sm" onClick={onEdit || onRename}><Icon name="sliders" size={12} /> Edit</button>
          <button className="btn sm" style={{ color: 'var(--accent)' }} onClick={onDelete}><Icon name="close" size={12} /> Delete</button>
        </div>
        {ready && (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {onStitch && <button className="btn sm primary" onClick={onStitch}><Icon name="studio" size={12} /> Stitch an episode</button>}
            {onSend && <button className="btn sm" onClick={onSend}><Icon name="send" size={12} /> {(meta || {}).approval_sent_at ? 'Resend for preview' : 'Send for preview'}</button>}
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
            <span className="mono">{fmtWhen(video.created_at || video.createdAt)}</span>
            {engineLabel(video.engine_used, video.provider_model) ? <><span className="mono">·</span><span className="mono">{engineLabel(video.engine_used, video.provider_model)}</span></> : null}
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


// ————————————————————————————————————————————————————————————————
// MONTAGE BUILDER — ordered images (asset library / upload / AI) rendered into
// a Ken Burns + crossfade slideshow video with an optional music bed. The
// result is saved to the client's Assets (kind: video), so it downloads here
// AND can be dropped into an episode via the Episodes "use asset" flow.
// ————————————————————————————————————————————————————————————————
function MontageBuilder({ clientId }) {
  const [assets, setAssets] = React.useState([]);
  const [items, setItems] = React.useState([]);          // {type:'asset',assetId,name} | {type:'ai',prompt}
  const [aspect, setAspect] = React.useState('16:9');
  const [perImageSec, setPerImageSec] = React.useState(3.5);
  const [transitionSec, setTransitionSec] = React.useState(0.7);
  const [kenBurns, setKenBurns] = React.useState(true);
  const [musicAssetId, setMusicAssetId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProg, setUploadProg] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [result, setResult] = React.useState(null);

  const load = () => api.listAssets(clientId).then((r) => setAssets(Array.isArray(r) ? r : [])).catch(() => setAssets([]));
  React.useEffect(() => { if (clientId != null) load(); }, [clientId]);

  const isImage = (a) => (a.mime || '').startsWith('image/') || ['logo', 'background'].includes(a.kind);
  const isAudio = (a) => (a.mime || '').startsWith('audio/') || ['music', 'audio'].includes(a.kind);
  // Montage images uploaded from an episode's Episode assets panel carry its
  // episode number; the library can narrow to one episode (newest by default).
  const epNums = [...new Set(assets.filter((a) => a.kind === 'montage' && a.episode_number).map((a) => String(a.episode_number)))]
    .sort((a, b) => (Number(b) || 0) - (Number(a) || 0));
  const [epFilter, setEpFilter] = React.useState(null);
  const epSel = epFilter ?? (epNums[0] || 'all');
  const imageAssets = assets.filter(isImage).filter((a) => !/^template_/.test(a.kind || '') && a.kind !== 'thumb')
    .filter((a) => epSel === 'all' || String(a.episode_number || '') === epSel);
  const musicAssets = assets.filter(isAudio);

  const addAsset = (a) => setItems((x) => [...x, { type: 'asset', assetId: a.id, name: a.filename }]);
  const addAi = () => { const p = aiPrompt.trim(); if (!p) return; setItems((x) => [...x, { type: 'ai', prompt: p }]); setAiPrompt(''); };
  const removeItem = (i) => setItems((x) => x.filter((_, k) => k !== i));
  const move = (i, d) => setItems((x) => { const n = [...x]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });

  // Several images at once: uploaded one request at a time, then added to the
  // montage in the order they were chosen. A failed file is named in the error
  // and the rest still go in.
  const onUpload = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = '';
    if (!files.length) return;
    setUploading(true); setErr('');
    const isAudioFile = (f) => (f.type || '').startsWith('audio/');
    const { ok, failed } = await uploadMany(files, (f) => api.uploadAsset(clientId, isAudioFile(f) ? 'music' : 'background', f), setUploadProg);
    await load();
    for (const { file, result } of ok) { if (!isAudioFile(file) && result) addAsset(result); }
    setUploadProg(null);
    if (failed.length) setErr(`${failed.length} of ${files.length} failed: ` + failed.map((f) => `${f.name} (${f.error})`).join('; '));
    setUploading(false);
  };

  const render = async () => {
    if (!items.length) { setErr('Add at least one image.'); return; }
    setBusy(true); setErr(''); setResult(null);
    try {
      const r = await api.renderMontage(clientId, {
        title: title.trim() || undefined, aspect,
        perImageSec: Number(perImageSec), transitionSec: Number(transitionSec),
        kenBurns, musicAssetId: musicAssetId || undefined, items,
      });
      setResult(r.asset); await load();
    } catch (ex) { setErr(ex.message || 'Render failed'); }
    finally { setBusy(false); }
  };

  const est = items.length ? Math.max(0, items.length * Number(perImageSec) - Math.max(0, items.length - 1) * Number(transitionSec)) : 0;
  const fld = { height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13 };

  return (
    <div className="rail-320" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 'var(--gap)', marginTop: 20, alignItems: 'start' }}>
      {/* LEFT — the ordered montage + ways to add to it */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card card-pad">
          <div className="label" style={{ marginBottom: 10 }}>MONTAGE &middot; {items.length} {items.length === 1 ? 'image' : 'images'} &middot; ~{est.toFixed(1)}s</div>
          {items.length === 0
            ? <div className="mono" style={{ color: 'var(--text-4)' }}>Nothing added yet. Pick from the library, upload, or generate with AI below.</div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((it, i) => (
                  <div key={i} className="card" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="badge">{i + 1}</span>
                    <div style={{ width: 54, height: 40, borderRadius: 6, overflow: 'hidden', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      {it.type === 'asset'
                        ? <img src={api.assetFileUrl(clientId, it.assetId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Icon name="sparkle" size={16} style={{ color: 'var(--accent)' }} />}
                    </div>
                    <div className="mono" style={{ fontSize: 12, flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                      {it.type === 'asset' ? it.name : <>AI: {it.prompt}</>}
                    </div>
                    <button className="icon-btn" title="Up" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="arrow-l" size={12} style={{ transform: 'rotate(90deg)' }} /></button>
                    <button className="icon-btn" title="Down" disabled={i === items.length - 1} onClick={() => move(i, 1)}><Icon name="arrow-l" size={12} style={{ transform: 'rotate(-90deg)' }} /></button>
                    <button className="icon-btn" title="Remove" onClick={() => removeItem(i)}><Icon name="close" size={12} /></button>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* AI image */}
        <div className="card card-pad">
          <div className="label" style={{ marginBottom: 8 }}>ADD AI IMAGE</div>
          <div className="row" style={{ gap: 8 }}>
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g. sleek product on a marble surface, soft studio light"
              onKeyDown={(e) => { if (e.key === 'Enter') addAi(); }} style={{ ...fld, flex: 1 }} />
            <button className="btn sm" onClick={addAi} disabled={!aiPrompt.trim()}><Icon name="sparkle" size={13} /> Add</button>
          </div>
          <div className="mono" style={{ color: 'var(--text-4)', marginTop: 6, fontSize: 11 }}>Generated with OpenAI at render time.</div>
        </div>

        {/* From library */}
        <div className="card card-pad">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <div className="label">FROM LIBRARY</div>
              {epNums.length > 0 && (
                <select value={epSel} onChange={(e) => setEpFilter(e.target.value)} style={{ ...fld, height: 28, fontSize: 12 }}>
                  {epNums.map((n) => <option key={n} value={n}>E{n} montage images</option>)}
                  <option value="all">All images</option>
                </select>
              )}
            </div>
            <label className="btn sm" style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
              <Icon name="upload" size={13} /> {uploading ? (uploadProg && uploadProg.total > 1 ? `Uploading ${Math.min(uploadProg.done + 1, uploadProg.total)} of ${uploadProg.total}…` : 'Uploading…') : 'Upload images'}
              <input type="file" accept="image/*" multiple onChange={onUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
          </div>
          {imageAssets.length === 0
            ? <div className="mono" style={{ color: 'var(--text-4)' }}>No image assets yet — upload above.</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
                {imageAssets.map((a) => (
                  <button key={a.id} className="card" onClick={() => addAsset(a)} title={'Add ' + a.filename}
                    style={{ padding: 6, cursor: 'pointer', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ height: 60, borderRadius: 6, overflow: 'hidden', background: 'var(--surface-2)' }}>
                      <img src={api.assetFileUrl(clientId, a.id)} alt={a.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div className="mono" style={{ fontSize: 10, lineHeight: 1.3, wordBreak: 'break-word' }}>{a.filename}</div>
                  </button>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* RIGHT — settings + render + result */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 0 }}>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="label">SETTINGS</div>
          <div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>TITLE</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Montage" style={{ ...fld, width: '100%' }} />
          </div>
          <div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>ASPECT</div>
            <div className="row" style={{ gap: 6 }}>
              {['16:9', '1:1', '9:16'].map((a) => (
                <button key={a} className="btn sm" onClick={() => setAspect(a)}
                  style={{ flex: 1, background: aspect === a ? 'var(--surface-2)' : 'transparent', borderColor: aspect === a ? 'var(--border-strong)' : 'var(--border)' }}>{a}</button>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>SEC / IMAGE</div>
              <input type="number" min="1.5" step="0.5" value={perImageSec} onChange={(e) => setPerImageSec(e.target.value)} style={{ ...fld, width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>CROSSFADE</div>
              <input type="number" min="0.2" step="0.1" value={transitionSec} onChange={(e) => setTransitionSec(e.target.value)} style={{ ...fld, width: '100%' }} />
            </div>
          </div>
          <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={kenBurns} onChange={(e) => setKenBurns(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Ken Burns motion (slow zoom)</span>
          </label>
          <div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>MUSIC BED (optional)</div>
            <select value={musicAssetId} onChange={(e) => setMusicAssetId(e.target.value)} style={{ ...fld, width: '100%' }}>
              <option value="">No music</option>
              {musicAssets.map((a) => <option key={a.id} value={a.id}>{a.filename}</option>)}
            </select>
          </div>
          <button className="btn" onClick={render} disabled={busy || !items.length}>
            <Icon name="play" size={14} /> {busy ? 'Rendering…' : 'Render montage'}
          </button>
          {err && <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>}
          {busy && <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>AI images + video render can take up to a minute.</div>}
        </div>

        {result && (
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="label">RESULT</div>
            <video controls src={api.assetFileUrl(clientId, result.id)} style={{ width: '100%', borderRadius: 8, background: '#000' }} />
            <div className="row" style={{ gap: 8 }}>
              <a className="btn sm" href={api.assetFileUrl(clientId, result.id)} download target="_blank" rel="noopener noreferrer"><Icon name="download" size={13} /> Download</a>
            </div>
            <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>Saved to Assets — you can drop it into an episode from the Episodes tab.</div>
          </div>
        )}
      </div>
    </div>
  );
}

