// components/avatars.jsx — Avatar library view

import React from 'react'
import { AVATARS, clientFor } from './data.jsx'
import { AvatarTile, Icon, StatusBadge } from './shared.jsx'

const AvatarsView = ({ onOpenAvatar, onAddNew, onChat }) => {
  const [filter, setFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');

  const filtered = AVATARS.filter((a) => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (query && !(a.name.toLowerCase().includes(query.toLowerCase()) || a.contact.toLowerCase().includes(query.toLowerCase()))) return false;
    return true;
  });

  const counts = {
    all: AVATARS.length,
    ready: AVATARS.filter((a) => a.status === 'ready').length,
    training: AVATARS.filter((a) => a.status === 'training').length,
    consent: AVATARS.filter((a) => a.status === 'consent').length
  };

  return (
    <div className="v-pad fade-in">
      {/* hero strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--gap)', marginBottom: 28, fontFamily: "\"DM Sans\"", fontSize: "6px" }}>
        <div className="card" style={{ padding: 28, position: 'relative', overflow: 'hidden', minHeight: 240 }}>
          <div className="label" style={{ marginBottom: 12, color: 'var(--maroon)', fontSize: "12px" }}>WORKSPACE · CUE:CREATIVE</div>
          <h1 style={{


            lineHeight: 1.05,
            margin: '4px 0 8px',
            letterSpacing: '-0.015em',
            maxWidth: 460,
            textWrap: 'pretty',
            color: 'var(--text)', fontFamily: "sans-serif", fontSize: "36px"
          }}>
            Six client <em style={{ color: 'var(--maroon)', fontSize: "36px" }}>digital twins</em> on file.<br />
            <span style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: "36px" }}>One is training as we speak.</span>
          </h1>
          <div className="row" style={{ marginTop: 20, gap: 8 }}>
            <button className="btn primary" onClick={onAddNew} style={{ fontSize: "16px" }}>
              <Icon name="plus" size={14} stroke={2.2} />
              New avatar
            </button>
            <button className="btn" style={{ fontSize: "16px" }}>
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
          <StatBlock label="Avatars" value="6" delta="+1 this week" />
          <StatBlock label="Minutes generated" value="221" delta="this billing cycle" />
          <StatBlock label="Active clients" value="6 of 12" delta="50% utilization" />
        </div>
      </div>

      {/* filter bar */}
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search avatars…" />
        </div>
      </div>

      {/* grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--gap)'
      }}>
        {filtered.map((av) =>
        <AvatarCard key={av.id} avatar={av} onOpen={() => onOpenAvatar(av)} onChat={() => onChat(av)} />
        )}
      </div>

      {filtered.length === 0 &&
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontFamily: 'var(--f-display)', fontSize: 28, fontStyle: 'italic', marginBottom: 8 }}>nothing here</div>
          <div className="mono">no avatars match "{filter}"</div>
        </div>
      }
    </div>);

};

const StatBlock = ({ label, value, delta }) =>
<div className="card" style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: "\"DM Sans\"", fontSize: "12px" }}>
    <div className="label">{label}</div>
    <div style={{ fontSize: 36, lineHeight: 1, letterSpacing: '-0.01em', marginTop: 8, fontFamily: "\"DM Sans\"" }}>{value}</div>
    <div className="mono" style={{ marginTop: 6 }}>{delta}</div>
  </div>;


const AvatarCard = ({ avatar, onOpen, onChat }) => {
  const client = clientFor(avatar);
  const isReady = avatar.status === 'ready';
  return (
    <div className="card" style={{
      cursor: 'pointer',
      transition: 'transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease',
      display: 'flex', flexDirection: 'column'
    }}
    onClick={onOpen}
    onMouseEnter={(e) => {e.currentTarget.style.borderColor = 'var(--maroon)';e.currentTarget.style.transform = 'translateY(-2px)';e.currentTarget.style.boxShadow = 'var(--shadow-2)';}}
    onMouseLeave={(e) => {e.currentTarget.style.borderColor = 'var(--border)';e.currentTarget.style.transform = 'none';e.currentTarget.style.boxShadow = 'var(--shadow-1)';}}>
      {/* poster */}
      <div style={{ aspectRatio: '4/5', position: 'relative' }}>
        <AvatarTile avatar={avatar} />
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <StatusBadge status={avatar.status} progress={avatar.progress} />
        </div>
        {avatar.status === 'training' &&
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,0.2)' }}>
            <div style={{ height: '100%', width: `${avatar.progress}%`, background: 'var(--gold)' }} />
          </div>
        }
        {isReady &&
        <button
          onClick={(e) => {e.stopPropagation();onChat();}}
          className="icon-btn"
          style={{
            position: 'absolute', bottom: 12, right: 12,
            width: 40, height: 40,
            background: 'rgba(30,35,48,0.7)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff'
          }}
          title="Chat with avatar">
            <Icon name="play" size={14} />
          </button>
        }
      </div>
      {/* meta */}
      <div style={{ padding: 16 }}>
        <div className="mono" style={{ marginBottom: 4 }}>{client.companyName}</div>
        <div style={{ fontSize: 20, letterSpacing: '-0.01em', lineHeight: 1.2, marginBottom: 10, fontFamily: "\"DM Sans\"" }}>
          {avatar.contact}
        </div>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)' }}>
          <span>{avatar.videosGenerated} videos · {avatar.minutesUsed}m</span>
          <span className="mono">{avatar.lastGen}</span>
        </div>
      </div>
    </div>);

};


export { AvatarsView };