import React from 'react'

// Highlight-and-note review, shared by the client portal (select text, attach a
// note) and the staff edit screen (find the highlighted passage again).
// Notes: { id, part, start, end, quote, note } where start/end are character
// offsets into that part's displayed text.

const markStyle = { background: '#ffe08a', color: 'inherit', borderBottom: '2px solid var(--accent)', borderRadius: 2, cursor: 'pointer', padding: '0 1px' };

// Find where a client's highlighted quote sits in the stored script body. The
// client saw the body with production markup stripped ([pause], <break>), so an
// exact match can fail; fall back to a pattern that skips tags between words.
export function locateQuote(body, quote) {
  const text = String(body || ''), q = String(quote || '').trim();
  if (!q) return null;
  const exact = text.indexOf(q);
  if (exact >= 0) return [exact, exact + q.length];
  const tag = '(?:\\s|\\[[^\\]\\n]{1,60}\\]|<break\\b[^>]*?\\/?>)*';
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  try {
    const m = new RegExp(words.map(esc).join(tag.replace('*', '+')), 'i').exec(text);
    if (m) return [m.index, m.index + m[0].length];
  } catch { /* fall through */ }
  return null;
}

// Body text with the given [start,end,n] ranges wrapped in numbered <mark>s (read-only).
export function HighlightedText({ text, ranges, onPick }) {
  const list = (ranges || []).filter((r) => r && r[0] >= 0).sort((a, b) => a[0] - b[0]);
  const out = []; let pos = 0;
  list.forEach((r, i) => {
    if (r[0] < pos) return;
    if (r[0] > pos) out.push(text.slice(pos, r[0]));
    out.push(<mark key={i} className="cc-hl" data-n={r[2]} style={markStyle} onClick={onPick ? () => onPick(r[2]) : undefined}>{text.slice(r[0], r[1])}</mark>);
    pos = r[1];
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.55)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 300 };

export function AnnotatableText({ parts, notes, onChange, maxHeight = 260 }) {
  const refs = React.useRef([]);
  const [sel, setSel] = React.useState(null);      // current selection { part, start, end, quote, x, y }
  const [dlg, setDlg] = React.useState(null);      // { id|null, quote, part,start,end, text }
  const timer = React.useRef(null);
  const order = notes.slice().sort((a, b) => a.part - b.part || a.start - b.start);
  const numOf = (n) => order.indexOf(n) + 1;

  const read = React.useCallback(() => {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return null;
    const range = s.getRangeAt(0);
    let idx = refs.current.findIndex((el) => el && el.contains(range.startContainer));
    if (idx < 0) idx = refs.current.findIndex((el) => el && el.contains(range.endContainer));
    if (idx < 0) return null;
    const el = refs.current[idx], body = parts[idx].body, r = range.cloneRange();
    if (!el.contains(r.startContainer)) r.setStart(el, 0);
    if (!el.contains(r.endContainer)) r.setEnd(el, el.childNodes.length);
    const pre = document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
    let start = pre.toString().length, end = start + r.toString().length;
    while (start < end && /\s/.test(body[start])) start++;
    while (end > start && /\s/.test(body[end - 1])) end--;
    if (end - start < 2) return null;
    if (notes.some((n) => n.part === idx && start < n.end && end > n.start)) return null;
    const rect = range.getBoundingClientRect();
    const y = rect.top - 46 > 8 ? rect.top - 46 : rect.bottom + 10;
    return { part: idx, start, end, quote: body.slice(start, end), x: Math.max(8, Math.min(window.innerWidth - 118, rect.left + rect.width / 2 - 55)), y };
  }, [parts, notes]);

  React.useEffect(() => {
    const onSel = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setSel(read()), 120); };
    document.addEventListener('selectionchange', onSel);
    return () => { document.removeEventListener('selectionchange', onSel); clearTimeout(timer.current); };
  }, [read]);

  const openNew = () => { if (!sel) return; setDlg({ id: null, ...sel, text: '' }); setSel(null); window.getSelection()?.removeAllRanges(); };
  const openEdit = (n) => setDlg({ id: n.id, part: n.part, start: n.start, end: n.end, quote: n.quote, text: n.note });
  const save = () => {
    const text = dlg.text.trim(); if (!text) return;
    if (dlg.id != null) onChange(notes.map((n) => (n.id === dlg.id ? { ...n, note: text } : n)));
    else onChange([...notes, { id: Date.now() + Math.random(), part: dlg.part, start: dlg.start, end: dlg.end, quote: dlg.quote, note: text }]);
    setDlg(null);
  };

  return (
    <div>
      {parts.map((p, i) => (
        <div key={i} style={{ marginTop: i ? 12 : 0 }}>
          {parts.length > 1 && <div className="mono" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>{p.label}</div>}
          <div ref={(el) => { refs.current[i] = el; }} className="mono"
            style={{ whiteSpace: 'pre-wrap', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.7, maxHeight, overflow: 'auto', userSelect: 'text', WebkitUserSelect: 'text', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <HighlightedText text={p.body} ranges={order.filter((n) => n.part === i).map((n) => [n.start, n.end, numOf(n)])} onPick={(num) => openEdit(order[num - 1])} />
          </div>
        </div>
      ))}
      {sel && (
        <button type="button" className="btn sm primary" onPointerDown={(e) => { e.preventDefault(); openNew(); }}
          style={{ position: 'fixed', left: sel.x, top: sel.y, zIndex: 250, borderRadius: 999, boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}>+ Add note</button>
      )}
      {order.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>YOUR NOTES</div>
          {order.map((n, k) => (
            <div key={n.id} className="row" style={{ gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, alignItems: 'flex-start' }}>
              <span style={{ flex: '0 0 20px', height: 20, borderRadius: 10, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', marginTop: 1 }}>{k + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', borderLeft: '3px solid #ffe08a', paddingLeft: 8, marginBottom: 3 }}>
                  {parts.length > 1 ? parts[n.part].label + ': ' : ''}“{n.quote.length > 140 ? n.quote.slice(0, 140) + '…' : n.quote}”
                </div>
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{n.note}</div>
                <div className="row" style={{ gap: 12, marginTop: 4 }}>
                  <a style={{ fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => openEdit(n)}>Edit</a>
                  <a style={{ fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onChange(notes.filter((x) => x.id !== n.id))}>Remove</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {dlg && (
        <div style={overlayStyle} onClick={() => setDlg(null)}>
          <div className="card card-pad" onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, 96vw)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="label">{dlg.id != null ? 'EDIT YOUR NOTE' : 'NOTE ON THIS PASSAGE'}</div>
            <div className="mono" style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', borderLeft: '3px solid #ffe08a', paddingLeft: 10, maxHeight: 96, overflow: 'auto', whiteSpace: 'pre-wrap' }}>“{dlg.quote}”</div>
            <textarea autoFocus value={dlg.text} onChange={(e) => setDlg({ ...dlg, text: e.target.value })} placeholder="What should change here?" rows={4}
              style={{ width: '100%', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '10px 12px', resize: 'vertical' }} />
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn sm" onClick={() => setDlg(null)}>Cancel</button>
              <button className="btn sm primary" disabled={!dlg.text.trim()} onClick={save}>Save note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
