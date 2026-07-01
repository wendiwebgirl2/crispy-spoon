// dashboard-api.js — same-origin VoiceCast episodes/schedule + Railway HeyGen video.
// Kept separate so api.js (its two coexisting clients) stays untouched.
const RAILWAY = 'https://cue-caster-api-production.up.railway.app';

async function j(res) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}
const get = (p) => fetch(p).then(j);
const post = (p, body) => fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(j);
const put = (p, body) => fetch(p, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(j);
const del = (p) => fetch(p, { method: 'DELETE' }).then(j);
const postForm = (p, form) => fetch(p, { method: 'POST', body: form }).then(j);

export const ep = {
  list: (cid) => get(`/api/clients/${cid}/episodes`),
  create: (cid, title) => post(`/api/clients/${cid}/episodes`, { title }),
  full: (cid, id) => get(`/api/clients/${cid}/episodes/${id}/full`),
  del: (cid, id) => del(`/api/clients/${cid}/episodes/${id}`),
  upload: (cid, id, slot, file) => { const f = new FormData(); f.append('slot', slot); f.append('file', file); return postForm(`/api/clients/${cid}/episodes/${id}/upload`, f); },
  useAudio: (cid, id, slot, audioOutputId) => post(`/api/clients/${cid}/episodes/${id}/use-audio`, { slot, audioOutputId }),
  genCover: (cid, id, body) => post(`/api/clients/${cid}/episodes/${id}/cover/generate`, body),
  genMusic: (cid, id, body) => post(`/api/clients/${cid}/episodes/${id}/music/generate`, body),
  musicMode: (cid, id, mode) => put(`/api/clients/${cid}/episodes/${id}/music/mode`, { mode }),
  genIntroMusic: (cid, id, prompt) => post(`/api/clients/${cid}/episodes/${id}/intro-music/generate`, { prompt }),
  stitch: (cid, id) => post(`/api/clients/${cid}/episodes/${id}/stitch`, {}),
  fileUrl: (cid, id) => `/api/clients/${cid}/episodes/${id}/file`,
  coverUrl: (cid, id) => `/api/clients/${cid}/episodes/${id}/cover`,
  voiceOutputs: (cid) => get(`/api/clients/${cid}/voice/outputs`),
};

export const sched = {
  list: (cid) => get(`/api/clients/${cid}/schedule`),
  add: (cid, body) => post(`/api/clients/${cid}/schedule`, body),
  advance: (cid, sid, status) => put(`/api/clients/${cid}/schedule/${sid}`, { status }),
  del: (cid, sid) => del(`/api/clients/${cid}/schedule/${sid}`),
  channels: () => get(`/api/clients/0/scripts/channels`),
  approvedScripts: (cid) => get(`/api/clients/${cid}/scripts`),
};

export async function clientToken(cid) {
  const invs = await get(`/api/clients/${cid}/invites`).catch(() => []);
  const rows = Array.isArray(invs) ? invs : (invs.invites || []);
  const row = rows.find((i) => i.status === 'pending') || rows[0];
  return row ? row.token : null;
}

export const video = {
  generate: (token, script, title) => post(`${RAILWAY}/api/videos/generate`, { token, script, title }),
  list: (token) => get(`${RAILWAY}/api/videos/${encodeURIComponent(token)}`),
};
