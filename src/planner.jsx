// components/planner.jsx — Planner tab (placeholder)
//
// Per UNIFIED_ARCHITECTURE.md, the Planner combines two facets:
//   A) production status (pipeline): draft → script → voice → avatar →
//      stitched → scheduled → published
//   B) schedule (timeline): 14-day channel lanes; one episode can appear on
//      multiple lanes because it yields multiple exports (audio→podcast,
//      video→socials).
// This is the nav-slice placeholder. The real board is a later slice (after
// the Episodes tab and the video export pipeline exist). Kept intentionally
// simple and honest so it doesn't look broken or imply features that aren't
// wired yet.

import React from 'react'
import { Icon } from './shared.jsx'

const STAGES = [
  { id: 'draft',     label: 'Draft' },
  { id: 'script',    label: 'Script ready' },
  { id: 'voice',     label: 'Voice done' },
  { id: 'avatar',    label: 'Avatar done' },
  { id: 'stitched',  label: 'Stitched' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
];

const CHANNELS = [
  { id: 'podcast',  label: 'Podcast',  hint: 'audio export' },
  { id: 'ig',       label: 'Instagram', hint: 'avatar video' },
  { id: 'linkedin', label: 'LinkedIn',  hint: 'avatar video' },
  { id: 'x',        label: 'X',         hint: 'avatar video' },
];

const PlannerView = () => (
  <div className="fade-in" style={{ maxWidth: 920, margin: '0 auto', padding: 'var(--pad)' }}>
    <div className="label" style={{ marginBottom: 12 }}>PLANNER</div>
    <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 38, letterSpacing: '-0.01em', margin: '0 0 8px' }}>
      Plan, produce, <em style={{ color: 'var(--accent)' }}>publish</em>.
    </h1>
    <p style={{ color: 'var(--text-3)', maxWidth: 560, marginBottom: 32 }}>
      One board for both halves of the workflow: where each episode is in
      production, and where it's scheduled to go. An episode can publish to
      several channels at once — its audio to the podcast, its avatar video to
      socials — so it appears on multiple lanes.
    </p>

    {/* Facet A preview — production pipeline */}
    <div style={{ marginBottom: 28 }}>
      <div className="label" style={{ marginBottom: 12 }}>PRODUCTION STATUS</div>
      <div className="row" style={{ gap: 0, flexWrap: 'wrap' }}>
        {STAGES.map((s, i) => (
          <React.Fragment key={s.id}>
            <div style={{
              padding: '8px 14px', borderRadius: 999,
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              fontSize: 12.5, color: 'var(--text-2)', whiteSpace: 'nowrap'
            }}>{s.label}</div>
            {i < STAGES.length - 1 && (
              <div style={{ width: 18, height: 1, background: 'var(--border)', alignSelf: 'center' }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>

    {/* Facet B preview — channel lanes */}
    <div style={{ marginBottom: 28 }}>
      <div className="label" style={{ marginBottom: 12 }}>SCHEDULE · CHANNEL LANES</div>
      <div className="col" style={{ gap: 8 }}>
        {CHANNELS.map(c => (
          <div key={c.id} className="row" style={{
            justifyContent: 'space-between', padding: '12px 16px',
            border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
            background: 'var(--surface)'
          }}>
            <span style={{ fontSize: 13.5 }}>{c.label}</span>
            <span className="mono">{c.hint}</span>
          </div>
        ))}
      </div>
    </div>

    <div style={{
      padding: 18, border: '1px dashed var(--border-strong)',
      borderRadius: 'var(--r-md)', background: 'var(--surface-2)',
      display: 'flex', gap: 12, alignItems: 'center'
    }}>
      <Icon name="history" size={18} style={{ color: 'var(--accent)' }} />
      <div>
        <div style={{ fontSize: 13.5, marginBottom: 2 }}>Board coming next</div>
        <div className="mono">Wired once the Episodes tab and exports exist — episodes will populate the stages above and drop onto these lanes by publish date.</div>
      </div>
    </div>
  </div>
);

export { PlannerView };
