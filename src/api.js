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

// ---- Domain calls: avatar videos (Studio) -----------------------------------
// These mirror the routes proven out by studio.html.

// List generated videos for the current token's client. The backend self-heals
// (re-polls HeyGen) on each call, so polling this is what completes renders.
export function listVideos(token = currentToken()) {
  return apiGet("/api/videos/" + encodeURIComponent(token));
}

// Kick off a new HeyGen render from a script.
export function generateVideo(script, { token = currentToken(), title } = {}) {
  return apiPostJson("/api/videos/generate", { token, script, title });
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
  getBrief: (id) => vcReq(`/clients/${id}/brief`),
  channels: (id) => vcReq(`/clients/${id}/scripts/channels`),
  listScripts: (id) => vcReq(`/clients/${id}/scripts`),
  generate: (id, payload) => vcReq(`/clients/${id}/scripts/generate`, { method: "POST", body: JSON.stringify(payload) }),
  manual: (id, payload) => vcReq(`/clients/${id}/scripts/manual`, { method: "POST", body: JSON.stringify(payload) }),
  updateScript: (id, sid, payload) => vcReq(`/clients/${id}/scripts/${sid}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteScript: (id, sid) => vcReq(`/clients/${id}/scripts/${sid}`, { method: "DELETE" }),
};
