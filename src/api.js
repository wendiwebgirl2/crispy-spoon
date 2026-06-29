// src/api.js — same-origin client for the VoiceCast API.
// The dashboard is served from cast.cuecreative.com, same origin as /api, so the
// auth cookie rides along automatically and there is no CORS to configure.

const BASE = '/api';

async function req(pathname, opts = {}) {
  let res;
  try {
    res = await fetch(BASE + pathname, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
  } catch {
    throw new Error('Network error — could not reach the API.');
  }
  if (res.status === 401) {
    // session expired or not signed in — bounce to the login page
    window.location.href = '/login.html';
    throw new Error('Not authenticated');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  listClients: () => req('/clients'),
  getBrief: (id) => req(`/clients/${id}/brief`),
  channels: (id) => req(`/clients/${id}/scripts/channels`),
  listScripts: (id) => req(`/clients/${id}/scripts`),
  generate: (id, payload) => req(`/clients/${id}/scripts/generate`, { method: 'POST', body: JSON.stringify(payload) }),
  manual: (id, payload) => req(`/clients/${id}/scripts/manual`, { method: 'POST', body: JSON.stringify(payload) }),
  updateScript: (id, sid, payload) => req(`/clients/${id}/scripts/${sid}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteScript: (id, sid) => req(`/clients/${id}/scripts/${sid}`, { method: 'DELETE' }),
};
