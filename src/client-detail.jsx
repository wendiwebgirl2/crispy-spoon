import React from 'react'
import { Icon } from './shared.jsx'
import { BriefView } from './brief.jsx'

// Client workspace. The Brief is edited here; every other area has a single
// source elsewhere (Scripts / Invitations / Episodes views, and Studio for
// casts + assets). The buttons navigate to those pages with this client
// selected, so there are no duplicate inline copies to keep in sync.
const NAV = [
  { id: 'brief',       label: 'Brief',    icon: 'doc' },
  { id: 'invitations', label: 'Invites',  icon: 'send' },
  { id: 'scripts',     label: 'Scripts',  icon: 'doc' },
  { id: 'casts',       label: 'Casts',    icon: 'sparkle' },
  { id: 'episodes',    label: 'Episodes', icon: 'history' },
  { id: 'assets',      label: 'Assets',   icon: 'upload' },
];

function ClientDetailView({ client, onBack, onOpenStudio, onNavigate, onSendTopicToScripts }) {
  if (!client) {
    return (
      <div className="v-pad">
        <button className="btn sm" onClick={onBack}>← Back to clients</button>
        <div className="mono" style={{ color: 'var(--text-3)', marginTop: 12 }}>No client selected.</div>
      </div>
    );
  }

  const go = (id) => {
    if (id === 'brief') return;          // already showing the Brief
    if (onNavigate) onNavigate(id, client.id);
  };

  return (
    <div className="v-pad fade-in">
      <button className="btn sm" onClick={onBack} style={{ marginBottom: 14 }}>← Back to clients</button>

      <div className="label">CLIENT WORKSPACE · {client.id}</div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, lineHeight: 1.1, margin: '6px 0 16px' }}>
        {client.name}
      </h1>

      <div className="row" style={{ gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {NAV.map((t) => (
          <button key={t.id} className={'btn sm' + (t.id === 'brief' ? ' primary' : '')} onClick={() => go(t.id)}>
            <Icon name={t.icon} size={13} /> {t.label}
          </button>
        ))}
        {onOpenStudio && (
          <button className="btn sm" style={{ marginLeft: 'auto', borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={() => onOpenStudio(client.id)}>
            <Icon name="sparkle" size={13} /> Studio
          </button>
        )}
      </div>

      <BriefView clientId={client.id} onSendTopicToScripts={onSendTopicToScripts} />
    </div>
  );
}

export { ClientDetailView }
