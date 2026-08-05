// src/api.js — single source of truth for backend access.
//
// Everything that talks to the backend goes through here. Two reasons:
//   1. ONE place holds the base URL. When the avatar/record backend later
//      moves off Railway (e.g. onto cast.cuecreative.com), you change ONE
//      line below and the whole dashboard follows. No component edits.
//   2. ONE place resolves the token. Today this is the demo invitation token;
//      when operator OAuth lands, you replace `currentToken()` with the
//      authenticated session and nothing else in the UI has to change.

// ---- Backend base URL -------------------------------------------------------
// The Railway API that serves consent / recordings / avatar-video routes.
// MIGRATION POINT: change this single string to repoint the whole app.
export const API_BASE = "https://cue-caster-api-production.up.railway.app";

// ---- Token resolution (dev/testing phase, pre-auth) -------------------------
// Default demo invitation token. Open the bare dashboard and it "just works".
export const DEFAULT_TOKEN = "TESTTOKEN123";

// Returns ?token=... from the URL if present, else the default.
// Lets you test a different client's data without editing code:
//   https://your-dashboard/?token=SOMEOTHERTOKEN
// When OAuth arrives, this is the one function that changes.
export function currentToken() {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get("token") || DEFAULT_TOKEN;
  } catch {
    return DEFAULT_TOKEN;
  }
}

// ---- Low-level fetch helpers ------------------------------------------------
// Thin wrappers that prefix API_BASE, parse JSON, and throw on API-level
// failure ({ ok: false }) so callers can try/catch uniformly.

async function parse(resp) {
  let data;
  try {
    data = await resp.json();
  } catch {
    throw new Error(`HTTP ${resp.status} (no JSON body)`);
  }
  if (!resp.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${resp.status}`);
  }
  return data;
}

export async function apiGet(path) {
  const resp = await fetch(API_BASE + path, { method: "GET" });
  return parse(resp);
}

export async function apiPostJson(path, body) {
  const resp = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parse(resp);
}

// For multipart uploads (e.g. recordings). Pass a FormData instance;
// the browser sets the multipart boundary header itself.
export async function apiPostForm(path, formData) {
  const resp = await fetch(API_BASE + path, { method: "POST", body: formData });
  return parse(resp);
}

export async function apiDelete(path) {
  const resp = await fetch(API_BASE + path, { method: "DELETE" });
  return parse(resp);
}

// ---- Domain calls: avatar videos (Studio) -----------------------------------
// These mirror the routes proven out by studio.html.

// List generated videos for the current token's client. The backend self-heals
// (re-polls HeyGen) on each call, so polling this is what completes renders.
export function listVideos(token = currentToken()) {
  return apiGet("/api/videos/" + encodeURIComponent(token));
}

// Kick off a new HeyGen render from a script.
export function generateVideo(script, { token = currentToken(), title, avatarId, caption, background, aspectRatio, backgroundAssetId } = {}) {
  return apiPostJson("/api/videos/generate", { token, script, title, avatar_id: avatarId, caption: !!caption, background: background || null, aspect_ratio: aspectRatio || null, background_asset_id: backgroundAssetId || null });
}

// ---- Domain calls: consent + recordings (Onboarding) ------------------------
// Wired in the onboarding slice; defined here so all backend access lives
// in one file.

export function getConsent(token = currentToken()) {
  return apiGet("/api/consent/" + encodeURIComponent(token));
}

export function postConsent(signedName, token = currentToken()) {
  return apiPostJson("/api/consent", { token, signed_name: signedName });
}

export function uploadRecording(blob, { token = currentToken(), filename = "take.webm" } = {}) {
  const form = new FormData();
  form.append("token", token);
  form.append("video", blob, filename);
  return apiPostForm("/api/recordings", form);
}

// List the R2 masters for a token's client (the read-back route).
// Build a HeyGen twin from an uploaded recording. Nothing in the dashboard
// called this before, so there was no way to build a twin from the UI at all.
export function createAvatarFromRecording(token, recordingId, name) {
  return apiPostJson("/api/avatars/create-from-recording", { token, recording_id: recordingId, name: name || null });
}

export function listRecordings(token = currentToken()) {
  return apiGet("/api/recordings/" + encodeURIComponent(token));
}

// Get a short-lived signed download URL for one recording master.
export function recordingDownloadUrl(recordingId, token = currentToken()) {
  return apiGet(
    "/api/recordings/" + encodeURIComponent(token) +
    "/" + encodeURIComponent(recordingId) + "/url"
  );
}

// Permanently delete a recording master (R2 object + DB row).
export function deleteRecording(recordingId, token = currentToken()) {
  return apiDelete(
    "/api/recordings/" + encodeURIComponent(token) +
    "/" + encodeURIComponent(recordingId)
  );
}

// Delete a generated video (avatar clip).
export function deleteVideo(videoId, token = currentToken()) {
  return apiDelete(
    "/api/videos/" + encodeURIComponent(token) +
    "/" + encodeURIComponent(videoId)
  );
}

// Rename a generated video (avatar clip).
export function renameVideo(videoId, title, token = currentToken()) {
  return apiPostJson(
    "/api/videos/" + encodeURIComponent(token) +
    "/" + encodeURIComponent(videoId) + "/rename",
    { title }
  );
}

// Extract an MP3 from a rendered video URL (same-origin tools endpoint).
export async function castAudioBlob(videoUrl) {
  const resp = await fetch("/api/tools/audio-from-url", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: videoUrl }),
  });
  if (!resp.ok) {
    let msg = "audio extract failed";
    try { const j = await resp.json(); msg = j.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return resp.blob();
}

// Render an audiogram (frequency-bar waveform) video from a cast video URL.
export async function castWaveformBlob(mediaUrl, coverUrl) {
  const resp = await fetch("/api/tools/waveform-from-url", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaUrl, coverUrl }),
  });
  if (!resp.ok) {
    let msg = "waveform render failed";
    try { const j = await resp.json(); msg = j.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return resp.blob();
}

// Start a background waveform render (returns immediately — poll episodeWaveformStatus for completion).
export async function episodeWaveformStart(cid, epId) {
  const resp = await fetch(`/api/clients/${cid}/episodes/${epId}/waveform`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  let data = {};
  try { data = await resp.json(); } catch { /* ignore */ }
  if (!resp.ok) throw new Error(data.error || "Could not start waveform render.");
  return data;
}

// Poll the background waveform job. Returns { status: 'none'|'pending'|'ready'|'error', error }.
export async function episodeWaveformStatus(cid, epId) {
  const resp = await fetch(`/api/clients/${cid}/episodes/${epId}/waveform`, { credentials: "same-origin" });
  let data = {};
  try { data = await resp.json(); } catch { /* ignore */ }
  if (!resp.ok) throw new Error(data.error || "Could not check waveform status.");
  return data;
}

// Direct, repeatable download URL for the finished waveform video.
export function episodeWaveformFileUrl(cid, epId) {
  return `/api/clients/${cid}/episodes/${epId}/waveform/file`;
}

// Replace the face image for a recording's avatar and rebuild it (voice kept).
export function refaceRecording(recordingId, file, token = currentToken()) {
  const form = new FormData();
  form.append("image", file, (file && file.name) || "face.jpg");
  return apiPostForm(
    "/api/recordings/" + encodeURIComponent(token) +
    "/" + encodeURIComponent(recordingId) + "/reface",
    form
  );
}

// ============================================================================
// VoiceCast API (same-origin) — clients, brief, scripts.
//
// Separate from the Railway backend above. The dashboard is served from
// cast.cuecreative.com, SAME ORIGIN as this VoiceCast /api, so the auth cookie
// rides along automatically and there is no CORS. This is where clients,
// briefs, and Claude script generation live (Hetzner box, not Railway).
// ============================================================================

const VC_BASE = "/api";

async function vcReq(pathname, opts = {}) {
  let res;
  try {
    res = await fetch(VC_BASE + pathname, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
  } catch {
    throw new Error("Network error — could not reach the API.");
  }
  if (res.status === 401) {
    // session expired or not signed in — bounce to the login page
    window.location.href = "/login.html";
    throw new Error("Not authenticated");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  listClients: () => vcReq("/clients"),
  listAvatars: (token) => apiGet("/api/avatars/" + encodeURIComponent(token)),
  listAvatarLooks: (token, groupId) => apiGet("/api/avatars/" + encodeURIComponent(token) + "/looks?group_id=" + encodeURIComponent(groupId)),
  setAvatarLook: (token, avatarId, heygenAvatarId, imageUrl) => apiPostJson("/api/avatars/" + encodeURIComponent(token) + "/set-look", { avatar_id: avatarId, heygen_avatar_id: heygenAvatarId, image_url: imageUrl || null }),
  getClient: (id) => vcReq(`/clients/${id}`),
  createClient: (payload) => vcReq("/clients", { method: "POST", body: JSON.stringify(payload) }),
  renameClient: (id, payload) => vcReq(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteClient: (id) => vcReq(`/clients/${id}`, { method: "DELETE" }),
  getBrief: (id) => vcReq(`/clients/${id}/brief`),
  putBrief: (id, payload) => vcReq(`/clients/${id}/brief`, { method: "PUT", body: JSON.stringify(payload) }),
  verifyBriefQA: (id, name) => vcReq(`/clients/${id}/brief/qa`, { method: "PUT", body: JSON.stringify({ name }) }),
  listTopics: (id) => vcReq(`/clients/${id}/topics`),
  addTopic: (id, text, jobNumber) => vcReq(`/clients/${id}/topics`, { method: "POST", body: JSON.stringify({ text, job_number: jobNumber || null }) }),
  updateTopic: (id, tid, text, jobNumber) => vcReq(`/clients/${id}/topics/${tid}`, { method: "PUT", body: JSON.stringify(jobNumber === undefined ? { text } : { text, job_number: jobNumber || null }) }),
  deleteTopic: (id, tid) => vcReq(`/clients/${id}/topics/${tid}`, { method: "DELETE" }),
  listClientInvites: (id) => vcReq(`/clients/${id}/invites`),
  // Cast approval workflow. Railway owns the cast; voicecast owns whether it
  // has been approved, keyed on the Railway video id.
  listCasts: (id) => vcReq(`/clients/${id}/casts`),
  castUpsert: (id, railwayVideoId, title, jobNumber, scriptId) =>
    vcReq(`/clients/${id}/casts/upsert`, { method: "POST", body: JSON.stringify({ railwayVideoId, title, jobNumber, scriptId }) }),
  alerts: () => vcReq('/alerts'),
  listChanges: () => vcReq('/alerts/changes'),
  billingOverview: (qs = '') => vcReq('/billing/overview' + qs),
  setCastApproval: (id, railwayVideoId, status, title) =>
    vcReq(`/clients/${id}/casts/approval`, { method: "POST", body: JSON.stringify({ railwayVideoId, status, title }) }),
  sendCastForReview: (id, railwayVideoId, title, email) =>
    vcReq(`/clients/${id}/casts/send`, { method: "POST", body: JSON.stringify({ railwayVideoId, title, email }) }),
  addCastToPlanner: (id, railwayVideoId, title, scheduledFor) =>
    vcReq(`/clients/${id}/casts/planner`, { method: "POST", body: JSON.stringify({ railwayVideoId, title, scheduledFor }) }),
  listAllInvites: () => vcReq(`/invites`),
  listCredentials: (id) => vcReq(`/clients/${id}/credentials`),
  addCredential: (id, payload) => vcReq(`/clients/${id}/credentials`, { method: "POST", body: JSON.stringify(payload) }),
  updateCredential: (id, credId, payload) => vcReq(`/clients/${id}/credentials/${credId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCredential: (id, credId) => vcReq(`/clients/${id}/credentials/${credId}`, { method: "DELETE" }),
  listAssets: (id) => vcReq(`/clients/${id}/assets`),
  deleteAsset: (id, assetId) => vcReq(`/clients/${id}/assets/${assetId}`, { method: "DELETE" }),
  assetFileUrl: (id, assetId) => `${VC_BASE}/clients/${id}/assets/${assetId}/file`,
  uploadAsset: async (id, kind, file) => {
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);
    const res = await fetch(`${VC_BASE}/clients/${id}/assets`, { method: "POST", credentials: "same-origin", body: fd });
    if (!res.ok) { let e; try { e = (await res.json()).error; } catch { /* ignore */ } throw new Error(e || `Upload failed (${res.status})`); }
    return res.json();
  },
  revealCredential: (id, credId) => vcReq(`/clients/${id}/credentials/${credId}/reveal`),
  getPodcastFeed: (id) => vcReq(`/clients/${id}/podcast-feed`),
  putPodcastFeed: (id, payload) => vcReq(`/clients/${id}/podcast-feed`, { method: "PUT", body: JSON.stringify(payload) }),
  getDistribution: (id) => vcReq(`/clients/${id}/distribution`),
  putDistribution: (id, payload) => vcReq(`/clients/${id}/distribution`, { method: "PUT", body: JSON.stringify(payload) }),
  createInvite: (id, payload) => vcReq(`/clients/${id}/invites`, { method: "POST", body: JSON.stringify(payload) }),
  deleteInvite: (clientId, inviteId) => vcReq(`/clients/${clientId}/invites/${inviteId}`, { method: "DELETE" }),
  channels: (id) => vcReq(`/clients/${id}/scripts/channels`),
  listScripts: (id) => vcReq(`/clients/${id}/scripts`),
  generate: (id, payload) => vcReq(`/clients/${id}/scripts/generate`, { method: "POST", body: JSON.stringify(payload) }),
  manual: (id, payload) => vcReq(`/clients/${id}/scripts/manual`, { method: "POST", body: JSON.stringify(payload) }),
  updateScript: (id, sid, payload) => vcReq(`/clients/${id}/scripts/${sid}`, { method: "PUT", body: JSON.stringify(payload) }),
  renameScriptTopic: (id, from, to) => vcReq(`/clients/${id}/scripts/topic/rename`, { method: "POST", body: JSON.stringify({ from, to }) }),
  deleteScript: (id, sid) => vcReq(`/clients/${id}/scripts/${sid}`, { method: "DELETE" }),
  sendScriptApproval: (id, sid, email) => vcReq(`/clients/${id}/scripts/${sid}/send-approval`, { method: "POST", body: JSON.stringify(email ? { email } : {}) }),
  reviseScript: (id, sid, instruction) => vcReq(`/clients/${id}/scripts/${sid}/revise`, { method: "POST", body: JSON.stringify({ instruction }) }),
};
