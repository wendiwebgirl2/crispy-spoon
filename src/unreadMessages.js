import React from 'react'
import { api } from './api.js'

const POLL_MS = 60 * 1000;

// Unread messages for the signed-in user, shared by the pop-up and the sidebar
// row so both poll once and agree. refreshMessages() re-checks immediately.
const unread = { rows: null, subs: new Set(), timer: null };
export function refreshMessages() {
  return api.myNotifications()
    .then((rows) => { unread.rows = Array.isArray(rows) ? rows : []; unread.subs.forEach((f) => f(unread.rows)); })
    .catch(() => {});
}
export function useUnreadMessages() {
  const [rows, setRows] = React.useState(unread.rows || []);
  React.useEffect(() => {
    unread.subs.add(setRows);
    if (!unread.timer) { refreshMessages(); unread.timer = setInterval(refreshMessages, POLL_MS); }
    return () => {
      unread.subs.delete(setRows);
      if (!unread.subs.size) { clearInterval(unread.timer); unread.timer = null; }
    };
  }, []);
  return rows;
}
