import React, { useState, useEffect } from 'react'
import { Icon } from './shared.jsx'
import { api } from './api.js'

// Billing — running per-client totals bucketed by provider (HeyGen, OpenAI,
// Claude, ElevenLabs), priced from the shared rate sheet on the backend.
const COLS = [
  { k: 'heygen', label: 'HeyGen' },
  { k: 'openai', label: 'OpenAI' },
  { k: 'claude', label: 'Claude' },
  { k: 'elevenlabs', label: 'ElevenLabs' },
];

export function BillingView() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = () => {
    const q = [];
    if (from) q.push('from=' + from);
    if (to) q.push('to=' + to);
    api.billingOverview(q.length ? '?' + q.join('&') : '')
      .then(setData)
      .catch((e) => setErr(e.message || 'Could not load billing.'));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const money = (n) => '$' + (Number(n) || 0).toFixed(2);
  const clients = data?.clients || [];
  const grand = clients.reduce((a, c) => a + (c.total || 0), 0);

  return (
    <div className="v-pad fade-in">
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div className="label">RUNNING TOTALS · BY CLIENT · BY PROVIDER</div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: 6, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 12 }} />
            <span className="mono" style={{ color: 'var(--text-4)' }}>to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: 6, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 12 }} />
            <button className="btn sm" onClick={load}>Apply</button>
          </div>
        </div>
        {err && <div className="mono" style={{ color: 'var(--accent)', marginTop: 8 }}>{err}</div>}
        {!data && !err && <div className="mono" style={{ color: 'var(--text-4)', marginTop: 8 }}>Loading…</div>}
        {data && (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Client</th>
                  {COLS.map((c) => <th key={c.k} style={{ ...thStyle, textAlign: 'right' }}>{c.label}</th>)}
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Billable</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={tdStyle}><strong>{c.name}</strong></td>
                    {COLS.map((col) => (
                      <td key={col.k} style={{ ...tdStyle, textAlign: 'right' }} title={(c.events?.[col.k] || 0) + ' events'}>
                        {money(c.costs?.[col.k])}
                        <span className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}> ({c.events?.[col.k] || 0})</span>
                      </td>
                    ))}
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{money(c.total)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--ok)' }}>{money(c.billable)}</td>
                    <td style={tdStyle}>
                      <a className="btn sm" href={`/api/clients/${c.id}/billing/csv${from || to ? '?' + [from && 'from=' + from, to && 'to=' + to].filter(Boolean).join('&') : ''}`}>
                        <Icon name="download" size={12} /> CSV
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
              {clients.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>All clients</td>
                    {COLS.map((col) => (
                      <td key={col.k} style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                        {money(clients.reduce((a, c) => a + (c.costs?.[col.k] || 0), 0))}
                      </td>
                    ))}
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{money(grand)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--ok)' }}>{money(clients.reduce((a, c) => a + (c.billable || 0), 0))}</td>
                    <td style={tdStyle}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 10 }}>
          Numbers in parentheses are event counts. Costs use the rate sheet (Settings). HeyGen render counts accrue from the day render logging went live; earlier HeyGen usage predates logging.
        </div>
      </div>
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' };
const tdStyle = { padding: '8px 10px' };
