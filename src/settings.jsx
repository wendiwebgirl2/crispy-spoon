// components/settings.jsx — Workspace brand kit / API settings

import React from 'react'
import { Wordmark } from './shared.jsx'

const SettingsView = () => {
  return (
    <div className="v-pad fade-in" style={{ maxWidth: 920, margin: '0 auto' }}>
      <div className="label" style={{ marginBottom: 10 }}>WORKSPACE</div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 38, letterSpacing: '-0.01em', margin: '0 0 36px' }}>
        Brand kit & <em style={{ color: 'var(--accent)' }}>integrations</em>.
      </h1>

      <Section title="White-label">
        <Row k="Portal subdomain" v={<code className="mono" style={{ color: 'var(--text-2)' }}>portal.cuecreative.com</code>} />
        <Row k="Custom domain"    v={<span style={{ color: 'var(--text-3)' }}>Add a CNAME →</span>} />
        <Row k="Brand color"      v={<div className="row"><span style={{ width: 18, height: 18, background: 'var(--maroon)', borderRadius: 4 }} /> <code className="mono">#8B1F1F</code></div>} />
        <Row k="Wordmark"         v={<Wordmark size={18} />} />
      </Section>

      <Section title="HeyGen integration">
        <Row k="API key"          v={
          <div className="row" style={{ gap: 8 }}>
            <code className="mono" style={{ color: 'var(--text-2)' }}>sk_V2_hgu_••••••••••••••••••••••••••6X</code>
            <span className="badge ok" style={{ fontSize: 10 }}><span className="dot" />stored server-side</span>
          </div>
        } />
        <Row k="MCP endpoint"     v={<code className="mono">https://mcp.heygen.com/v1/sse</code>} />
        <Row k="Webhook"          v={<code className="mono">https://api.cuecreative.com/heygen/webhook</code>} />
        <Row k="Tools enabled"    v={<div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {['create_digital_twin', 'create_avatar_consent', 'generate_video', 'list_avatars'].map(t =>
            <span key={t} className="badge" style={{ fontSize: 10 }}>{t}</span>)}
        </div>} />
      </Section>

      <Section title="LLM">
        <Row k="Model"            v={<code className="mono">claude-haiku-4-5</code>} />
        <Row k="System prompt"    v={<span style={{ color: 'var(--text-3)' }}>Per-avatar (4 configured)</span>} />
        <Row k="Memory"           v={<span>Retrieval over uploaded knowledge sources</span>} />
      </Section>

      <Section title="Usage this cycle">
        <Row k="Avatars trained"  v={<span>2 / 10</span>} />
        <Row k="Render minutes"   v={<span>221 / 600</span>} />
        <Row k="Chat messages"    v={<span>1,847</span>} />
        <Row k="Cycle resets"     v={<span style={{ color: 'var(--text-3)' }}>June 12, 2026</span>} />
      </Section>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="card" style={{ marginBottom: 16, padding: 0 }}>
    <div className="label" style={{ padding: '16px 20px 12px' }}>{title}</div>
    <div className="hairline" />
    <div style={{ padding: '6px 20px 12px' }}>{children}</div>
  </div>
);

const Row = ({ k, v }) => (
  <div className="row" style={{
    padding: '14px 0', borderBottom: '1px solid var(--border)',
    justifyContent: 'space-between'
  }}>
    <span style={{ fontSize: 13.5, color: 'var(--text-2)' }}>{k}</span>
    <span style={{ fontSize: 13 }}>{v}</span>
  </div>
);


export { SettingsView };