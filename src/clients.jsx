// components/clients.jsx — Clients view (clients → avatars → episodes)

import React from 'react'
import { CLIENTS, AVATARS, GENERATED_VIDEOS, avatarsForClient, episodesForAvatar } from './data.jsx'
import { AvatarTile, Icon, StatusBadge } from './shared.jsx'

const ClientsView = ({ onOpenAvatar, onAddNew, onChat }) => {
  const [filter, setFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');

  const q = query.trim().toLowerCase();

  // an avatar shows if it passes the status filter AND the search (search hits
  // either the client fields or the avatar fields)
  const matchAvatar = (client, av) => {
    if (filter !== 'all' && av.status !== filter) return false;
    if (q) {
      const hay = `${client.companyName} ${client.contact} ${av.name} ${av.contact}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  // build client groups, dropping any client with no matching avatars
  const groups = CLIENTS
    .map((client) => ({ client, avatars: avatarsForClient(client.id).filter((av) => matchAvatar(client, av)) }))
    .filter((g) => g.avatars.length > 0);

  const counts = {
    all:      AVATARS.length,
    ready:    AVATARS.filter((a) => a.status === 'ready').length,
    training: AVATARS.filter((a) => a.status === 'training').length,
    consent:  AVATARS.filter((a) => a.status === 'consent').length,
  };

  return (
    <div className="v-pad fade-in">
      {/* hero strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--gap)', marginBottom: 28 }}>
        <div className="card" style={{ padding: 28, position: 'relative', overflow: 'hidden', minHeight: 240 }}>
          <div className="label" style={{ marginBottom: 12, color: 'var(--maroon)', fontSize: '12px' }}>WORKSPACE · CUE:CREATIVE</div>
          <h1 style={{
            lineHeight: 1.05,
            margin: '4px 0 8px',
            letterSpacing: '-0.015em',
            maxWidth: 460,
            textWrap: 'pretty',
            color: 'var(--text)', fontFamily: 'sans-serif', fontSize: '36px'
          }}>
            {CLIENTS.length} clients, <em style={{ color: 'var(--maroon)' }}>each a digital twin</em>.<br />
            <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Grouped by who they belong to.</span>
          </h1>
          <div className="row" style={{ marginTop: 20, gap: 8 }}>
            <button className="btn primary" onClick={onAddNew} style={{ fontSize: '16px' }}>
              <Icon name="plus" size={14} stroke={2.2} />
              New client
            </button>
            <button className="btn" style={{ fontSize: '16px' }}>
              <Icon name="upload" size={14} />
              Bulk import
            </button>
          </div>
          {/* decorative monospaced telemetry — at the foot of the card */}
          <div className="row" style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid var(--border)',
            fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--text-4)',
            gap: 20, flexWrap: 'wrap'
          }}>
            <div>CUE:ENGINE · v2</div>
            <div>STATUS · <span style={{ color: 'var(--ok)' }}>● operational</span></div>
            <div>RENDER_QUEUE · 3</div>
          </div>
        </div>

        <div className="col" style={{ gap: 'var(--gap)' }}>
          <StatBlock label="Clients" value={String(CLIENTS.length)} delta="top-level accounts" />
          <StatBlock label="Avatars" value={String(AVATARS.length)} delta="digital twins on file" />
          <StatBlock label="Episodes" value={String(GENERATED_VIDEOS.length)} delta="across all avatars" />
        </div>
      </div>

      {/* filter + search */}
      <div className="row" style={{ marginBottom: 18, justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 4 }}>
          {[
          ['all', 'All'],
          ['ready', 'Ready'],
          ['training', 'Training'],
          ['consent', 'Awaiting consent']].
          map(([k, label]) =>
          <button key={k}
          onClick={() => setFilter(k)}
          className="btn"
          style={{
            background: filter === k ? 'var(--surface)' : 'transparent',
            borderColor: filter === k ? 'var(--maroon)' : 'transparent',
            color: filter === k ? 'var(--maroon)' : 'var(--text-2)',
            boxShadow: 'none'
          }}>
              {label}
              <span className="mono" style={{ color: filter === k ? 'var(--maroon)' : 'var(--text-3)' }}>
                {counts[k]}
              </span>
            </button>
          )}
        </div>
        <div className="hd-search" style={{ width: 240 }}>
          <Icon name="search" size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients or avatars…" />
        </div>
      </div>

      {/* client groups */}
      <div className="col" style={{ gap: 'var(--gap)' }}>
        {groups.map(({ client, avatars }) =>
          <ClientGroup key={client.id} client={client} avatars={avatars} onOpenAvatar={onOpenAvatar} onChat={onChat} />
        )}
      </div>

      {groups.length === 0 &&
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontFamily: 'var(--f-display)', fontSize: 28, fontStyle: 'italic', marginBottom: 8 }}>nothing here</div>
          <div className="mono">no clients match "{query || filter}"</div>
        </div>
      }
    </div>);

};

const StatBlock = ({ label, value, delta }) =>
<div className="card" style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: "\"DM Sans\"" }}>
    <div className="label">{label}</div>
    <div style={{ fontSize: 36, lineHeight: 1, letterSpacing: '-0.01em', marginTop: 8, fontFamily: "\"DM Sans\"" }}>{value}</div>
    <div className="mono" style={{ marginTop: 6 }}>{delta}</div>
  </div>;


const ClientGroup = ({ client, avatars, onOpenAvatar, onChat }) => {
  const episodeTotal = avatars.reduce((n, av) => n + episodesForAvatar(av.id).length, 0);
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* client header — the top-level entity */}
      <div className="row" style={{
        justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '18px 20px', borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <div style={{ fontSize: 20, letterSpacing: '-0.01em', lineHeight: 1.2, fontFamily: "\"DM Sans\"" }}>
            {client.companyName}
          </div>
          <div className="mono" style={{ marginTop: 4 }}>{client.contact} · {client.role}</div>
        </div>
        <div className="row" style={{ gap: 16, fontSize: 12, color: 'var(--text-3)' }}>
          <span>{avatars.length} avatar{avatars.length === 1 ? '' : 's'}</span>
          <span className="mono">{episodeTotal} episode{episodeTotal === 1 ? '' : 's'}</span>
        </div>
      </div>

      {/* nested avatars */}
      <div className="col" style={{ padding: '6px 0' }}>
        {avatars.map((av) =>
          <AvatarRow key={av.id} avatar={av} onOpen={() => onOpenAvatar(av)} onChat={() => onChat(av)} />
        )}
      </div>
    </div>);

};


const AvatarRow = ({ avatar, onOpen, onChat }) => {
  const episodes = episodesForAvatar(avatar.id).length;
  const isReady = avatar.status === 'ready';
  return (
    <div
      onClick={onOpen}
      className="row"
      style={{ gap: 14, padding: '12px 20px', cursor: 'pointer', transition: 'background 160ms ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      {/* thumbnail */}
      <div style={{ width: 44, height: 55, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
        <AvatarTile avatar={avatar} />
      </div>
      {/* name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, letterSpacing: '-0.01em', lineHeight: 1.2, fontFamily: "\"DM Sans\"", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {avatar.name}
        </div>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 10, marginTop: 3, fontSize: 12, color: 'var(--text-3)' }}>
          <span>{episodes} episode{episodes === 1 ? '' : 's'}</span>
          <span className="mono">{avatar.minutesUsed}m · {avatar.lastGen}</span>
        </div>
      </div>
      {/* status */}
      <StatusBadge status={avatar.status} progress={avatar.progress} />
      {/* open / chat */}
      {isReady &&
        <button
          onClick={(e) => { e.stopPropagation(); onChat(); }}
          className="icon-btn"
          style={{ width: 34, height: 34 }}
          title="Open avatar">
          <Icon name="play" size={13} />
        </button>
      }
    </div>);

};


export { ClientsView };
