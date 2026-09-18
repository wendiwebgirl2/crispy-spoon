// dashboard-api.js — same-origin VoiceCast episodes/schedule + Railway HeyGen video.
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
  create: (cid, title, topic, jobNumber, scriptId) => post(`/api/clients/${cid}/episodes`, { title, topic, job_number: jobNumber || null, script_id: scriptId || null }),
  full: (cid, id) => get(`/api/clients/${cid}/episodes/${id}/full`),
  del: (cid, id) => del(`/api/clients/${cid}/episodes/${id}`),
  upload: (cid, id, slot, file) => { const f = new FormData(); f.append('slot', slot); f.append('file', file); return postForm(`/api/clients/${cid}/episodes/${id}/upload`, f); },
  useAudio: (cid, id, slot, audioOutputId) => post(`/api/clients/${cid}/episodes/${id}/use-audio`, { slot, audioOutputId }),
  stillSec: (cid, id, slot, seconds) => put(`/api/clients/${cid}/episodes/${id}/still-sec`, { slot, seconds }),
  useRecording: (cid, id, slot, recordingId, token) => post(`/api/clients/${cid}/episodes/${id}/use-recording`, { slot, recordingId, token }),
  genCover: (cid, id, body) => post(`/api/clients/${cid}/episodes/${id}/cover/generate`, body),
  genMusic: (cid, id, body) => post(`/api/clients/${cid}/episodes/${id}/music/generate`, body),
  musicMode: (cid, id, mode) => put(`/api/clients/${cid}/episodes/${id}/music/mode`, { mode }),
  genIntroMusic: (cid, id, prompt) => post(`/api/clients/${cid}/episodes/${id}/intro-music/generate`, { prompt }),
  genOutroMusic: (cid, id, prompt) => post(`/api/clients/${cid}/episodes/${id}/outro-music/generate`, { prompt }),
  stitch: (cid, id) => post(`/api/clients/${cid}/episodes/${id}/stitch`, {}),
  stitchStatus: (cid, id) => get(`/api/clients/${cid}/episodes/${id}/stitch`),
  useVideo: (cid, id, slot, videoUrl, label) => post(`/api/clients/${cid}/episodes/${id}/use-video`, { slot, videoUrl, label }),
  clearVideo: (cid, id, slot) => post(`/api/clients/${cid}/episodes/${id}/clear-video`, { slot }),
  clearSlot: (cid, id, slot) => post(`/api/clients/${cid}/episodes/${id}/clear-slot`, { slot }),
  outroText: (cid, id, text) => put(`/api/clients/${cid}/episodes/${id}/outro-text`, { text }),
  outroImageUrl: (cid, id) => `/api/clients/${cid}/episodes/${id}/slot-file/outro_image`,
  videoFileUrl: (cid, id) => `/api/clients/${cid}/episodes/${id}/video`,
  fileUrl: (cid, id) => `/api/clients/${cid}/episodes/${id}/file`,
  slotUrl: (cid, id, slot) => `/api/clients/${cid}/episodes/${id}/slot/${slot}`,
  useAsset: (cid, id, assetId, slot) => post(`/api/clients/${cid}/episodes/${id}/use-asset`, { assetId, slot }),
  setBodyCutaway: (cid, id, assetId, startSec) => post(`/api/clients/${cid}/episodes/${id}/body-cutaway`, { assetId, startSec }),
  clearBodyCutaway: (cid, id) => post(`/api/clients/${cid}/episodes/${id}/body-cutaway/clear`, {}),
  approve: (cid, id, status) => post(`/api/clients/${cid}/episodes/${id}/approval`, { status }),
  sendClient: (cid, id, email, note) => post(`/api/clients/${cid}/episodes/${id}/send-client`, { ...(email ? { email } : {}), ...(note ? { note } : {}) }),
  coverUrl: (cid, id) => `/api/clients/${cid}/episodes/${id}/cover`,
  uploadPodcastImage: (cid, id, file) => { const f = new FormData(); f.append('file', file); return postForm(`/api/clients/${cid}/episodes/${id}/podcast-image`, f); },
  clearPodcastImage: (cid, id) => del(`/api/clients/${cid}/episodes/${id}/podcast-image`),
  podcastImageUrl: (cid, id) => `/api/clients/${cid}/episodes/${id}/podcast-image`,
  voiceOutputs: (cid) => get(`/api/clients/${cid}/voice/outputs`),
  setMeta: (cid, id, body) => put(`/api/clients/${cid}/episodes/${id}/meta`, body),
  archive: (cid, id) => post(`/api/clients/${cid}/episodes/${id}/archive`, {}),
  archiveLog: (cid) => get(`/api/clients/${cid}/episodes/archive-log`),
  publish: (cid, id, platforms, scheduleId) => post(`/api/clients/${cid}/episodes/${id}/publish`, { platforms, scheduleId }),
  publishTransistor: (cid, id, scheduleId) => post(`/api/clients/${cid}/episodes/${id}/publish-transistor`, { scheduleId }),
};

// ElevenLabs voice synthesis (audio-only casting — cheaper than a HeyGen video).
export const voice = {
  profiles: (cid) => get(`/api/clients/${cid}/voice/profiles`),
  synthesize: (cid, profileId, text, gainDb) => post(`/api/clients/${cid}/voice/synthesize`, { profileId, text, ...(gainDb ? { gain_db: gainDb } : {}) }),
  outputs: (cid) => get(`/api/clients/${cid}/voice/outputs`),
  outputUrl: (cid, outId) => `/api/clients/${cid}/voice/outputs/${outId}/file`,
  createProfile: (cid, label, clipFile, recordingId) => { const f = new FormData(); f.append('label', label); f.append('clip', clipFile); if (recordingId) f.append('recording_id', String(recordingId)); return postForm(`/api/clients/${cid}/voice/profiles`, f); },
};

export const rec = {
  list: (token) => get(`${RAILWAY}/api/recordings/${encodeURIComponent(token)}`),
};

export const sched = {
  list: (cid) => get(`/api/clients/${cid}/schedule`),
  add: (cid, body) => post(`/api/clients/${cid}/schedule`, body),
  advance: (cid, sid, status) => put(`/api/clients/${cid}/schedule/${sid}`, { status }),
  update: (cid, sid, body) => put(`/api/clients/${cid}/schedule/${sid}`, body),
  del: (cid, sid) => del(`/api/clients/${cid}/schedule/${sid}`),
  channels: () => get(`/api/clients/0/scripts/channels`),
  approvedScripts: (cid) => get(`/api/clients/${cid}/scripts`),
};

// Episode Log — weeks/airings computed from the schedule + deadline-ladder
// status. The ladder itself is a global editable default (see ladder.js on
// the server), mounted per-client like the consent-text settings route.
export const episodeLog = {
  get: (cid) => get(`/api/clients/${cid}/episode-log`),
  getLadder: (cid) => get(`/api/clients/${cid}/episode-log/ladder`),
  putLadder: (cid, ladder) => put(`/api/clients/${cid}/episode-log/ladder`, { ladder }),
};

export async function clientToken(cid) {
  // Fallback used when a client has no (client-facing) invites on file.
  // Hits the durable, invite-independent studio token instead of the same
  // invites list that was just found empty — a deleted/expired invite must
  // never be able to hide a client's ready avatar. See voicecast's
  // studioToken.js route + `studio_tokens` table.
  const res = await get(`/api/clients/${cid}/studio-token`).catch(() => null);
  return res && res.token ? res.token : null;
}

export const video = {
  generate: (token, script, title) => post(`${RAILWAY}/api/videos/generate`, { token, script, title }),
  list: (token) => get(`${RAILWAY}/api/videos/${encodeURIComponent(token)}`),
};
