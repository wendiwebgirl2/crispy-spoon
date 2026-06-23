// components/avatar-detail.jsx — single-avatar detail page
// Wrapped in IIFE so helper names (KV, SectionHeader, Bullet, RenderTile, ConvoRow,
// FullTimeline, MiniTimeline, HeroMetric, EVENT_LABEL, EVENT_TONE, eventColor, etc.)
// don't collide with same-named helpers in sibling component files.

import React from 'react'
import {
  AVATARS,
  GENERATED_VIDEOS,
  CONVERSATIONS,
  INVITATIONS,
  clientFor,
  briefFor,
  repoForClient
} from './data.jsx'
import { AvatarTile, Icon, StatusBadge, paletteForId } from './shared.jsx'

const AvatarDetailView = ({ avatarId, onBack, onChat, onGenerate, onEditBrief, onResend }) => {
  const avatar = AVATARS.find(a => a.id === avatarId);
  if (!avatar) {
    return (
      <div className="v-pad fade-in" style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
        <div style={{ fontFamily: 'var(--f-display)', fontSize: 28, fontStyle: 'italic', marginBottom: 8 }}>not found</div>
        <button className="btn" onClick={onBack}>Back to avatars</button>
      </div>
    );
  }

  const client = clientFor(avatar);
  const brief = briefFor(avatar);
  const renders = GENERATED_VIDEOS.filter(v => v.avatarId === avatar.id);
  const convos = CONVERSATIONS.filter(c => c.avatarId === avatar.id);
  const invitation = INVITATIONS.find(i => i.avatarId === avatar.id);
  const [tab, setTab] = React.useState('overview');

  const TABS = [
    { id: 'overview',      label: 'Overview' },
    { id: 'renders',       label: 'Renders',       count: renders.length },
    { id: 'conversations', label: 'Conversations', count: convos.length },
    { id: 'brief',         label: 'Brief' },
    { id: 'training',      label: 'Training history' },
  ];

  return (
    <div className="v-pad fade-in" style={{ paddingBottom: 80 }}>
      {/* —— breadcrumb / back —— */}
      <div className="row" style={{ marginBottom: 18, gap: 8 }}>
        <button className="btn ghost sm" onClick={onBack} style={{ paddingLeft: 6 }}>
          <Icon name="arrow-l" size={14} /> Avatars
        </button>
        <span className="mono" style={{ color: 'var(--text-4)' }}>/</span>
        <span className="mono" style={{ color: 'var(--text-2)' }}>{avatar.contact}</span>
        <div style={{ flex: 1 }} />
        <button className="btn sm" title="Previous avatar"><Icon name="arrow-l" size={12} /></button>
        <button className="btn sm" title="Next avatar"><Icon name="arrow-r" size={12} /></button>
      </div>

      {/* —— hero —— */}
      <AvatarHero avatar={avatar} client={client} brief={brief}
        onChat={() => onChat(avatar)}
        onGenerate={() => onGenerate(avatar)}
        onEditBrief={() => onEditBrief && onEditBrief(avatar)}
      />

      {/* —— tabs —— */}
      <div style={{
        marginTop: 28, marginBottom: 22,
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 4
      }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 14px 12px',
              background: 'transparent',
              border: 0,
              borderBottom: '2px solid ' + (tab === t.id ? 'var(--maroon)' : 'transparent'),
              color: tab === t.id ? 'var(--text)' : 'var(--text-3)',
              fontSize: 13.5,
              fontWeight: tab === t.id ? 500 : 400,
              cursor: 'pointer',
              marginBottom: '-1px',
              display: 'inline-flex', alignItems: 'center', gap: 8
            }}>
            {t.label}
            {t.count != null && (
              <span className="mono" style={{
                fontSize: 10.5,
                color: 'var(--text-4)',
                background: 'var(--surface-2)',
                padding: '1px 6px', borderRadius: 4
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* —— tab body —— */}
      {tab === 'overview' && (
        <OverviewTab avatar={avatar} client={client} brief={brief}
          renders={renders} convos={convos} invitation={invitation}
          onChat={() => onChat(avatar)} onGoToTab={setTab} />
      )}
      {tab === 'renders' && <RendersTab avatar={avatar} renders={renders} onGenerate={() => onGenerate(avatar)} />}
      {tab === 'conversations' && <ConversationsTab avatar={avatar} convos={convos} onChat={() => onChat(avatar)} />}
      {tab === 'brief' && <BriefTab brief={brief} client={client} onEdit={() => onEditBrief && onEditBrief(avatar)} />}
      {tab === 'training' && <TrainingTab avatar={avatar} invitation={invitation} onResend={() => onResend && onResend(avatar)} />}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
 * Hero — poster + identity + headline stats + actions
 * ──────────────────────────────────────────────────────────── */
const AvatarHero = ({ avatar, client, brief, onChat, onGenerate, onEditBrief }) => {
  const isReady = avatar.status === 'ready';
  const isTraining = avatar.status === 'training';

  return (
    <div className="card" style={{ overflow: 'hidden', display: 'grid', gridTemplateColumns: '320px 1fr' }}>
      {/* poster */}
      <div style={{ position: 'relative', aspectRatio: '4/5', minHeight: 320 }}>
        <AvatarTile avatar={avatar} size="lg" playing={isReady} />
        {isReady && (
          <button onClick={onChat} className="icon-btn"
            style={{
              position: 'absolute', bottom: 14, right: 14,
              width: 52, height: 52,
              background: 'rgba(30,35,48,0.7)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff'
            }} title="Chat with avatar">
            <Icon name="play" size={18} />
          </button>
        )}
        {isTraining && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            padding: '12px 14px',
            background: 'linear-gradient(180deg, transparent, rgba(30,35,48,0.85))',
            color: '#fff'
          }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="mono" style={{ color: '#fff', opacity: 0.85 }}>TRAINING</span>
              <span className="mono" style={{ color: 'var(--gold)' }}>{avatar.progress}%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${avatar.progress}%`, background: 'var(--gold)' }} />
            </div>
          </div>
        )}
      </div>

      {/* identity + stats */}
      <div style={{ padding: 28, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="row" style={{ marginBottom: 8, gap: 10 }}>
          <span className="mono" style={{ color: 'var(--maroon)' }}>{client.companyName.toUpperCase()}</span>
          <span className="mono" style={{ color: 'var(--text-4)' }}>·</span>
          <span className="mono">{client.role}</span>
          <div style={{ flex: 1 }} />
          <StatusBadge status={avatar.status} progress={avatar.progress} />
        </div>

        <h1 style={{
          fontFamily: 'var(--f-display)',
          fontSize: 44,
          lineHeight: 1.05,
          letterSpacing: '-0.015em',
          margin: '4px 0 4px',
          color: 'var(--text)',
          textWrap: 'pretty'
        }}>
          {avatar.contact}
        </h1>
        <div style={{ fontFamily: 'var(--f-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--text-3)', marginBottom: 22 }}>
          {avatar.name.split('—')[1]?.trim() || avatar.name}
        </div>

        {/* metric strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0,
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          padding: '14px 0',
          marginBottom: 22
        }}>
          <HeroMetric label="Videos" value={avatar.videosGenerated} sub="generated" />
          <HeroMetric label="Minutes" value={avatar.minutesUsed} sub="rendered" />
          <HeroMetric label="Languages" value={(avatar.languages && avatar.languages.length) || '—'} sub={(avatar.languages || []).join(' · ') || 'none yet'} />
          <HeroMetric label="Last gen" value={avatar.lastGen} sub={avatar.heygenId ? 'HeyGen ' + avatar.heygenId.slice(0,8) : 'not provisioned'} mono />
        </div>

        {/* action row */}
        <div className="row" style={{ gap: 8, marginTop: 'auto' }}>
          {isReady && (
            <>
              <button className="btn primary" onClick={onChat}>
                <Icon name="chat" size={14} stroke={2} /> Chat with {avatar.contact.split(' ')[0]}
              </button>
              <button className="btn gold" onClick={onGenerate}>
                <Icon name="sparkle" size={14} stroke={2} /> Generate video
              </button>
            </>
          )}
          {isTraining && (
            <button className="btn primary" disabled style={{ opacity: 0.7, cursor: 'not-allowed' }}>
              <Icon name="history" size={14} /> Training — ETA ~{Math.max(1, Math.round((100 - avatar.progress) / 8))}h
            </button>
          )}
          {avatar.status === 'consent' && (
            <button className="btn primary" onClick={onEditBrief}>
              <Icon name="send" size={14} /> Resend invitation
            </button>
          )}
          <button className="btn" onClick={onEditBrief}>
            <Icon name="doc" size={14} /> Edit brief
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn ghost" title="More actions"><Icon name="more" size={16} /></button>
        </div>
      </div>
    </div>
  );
};

const HeroMetric = ({ label, value, sub, mono }) => (
  <div style={{ padding: '0 20px', borderRight: '1px solid var(--border)' }}>
    <div className="label" style={{ marginBottom: 4 }}>{label}</div>
    <div style={{
      fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.01em',
      color: 'var(--text)',
      fontFamily: mono ? 'var(--f-mono)' : 'var(--f-sans)',
      fontWeight: mono ? 400 : 500
    }}>{value}</div>
    <div className="mono" style={{ marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
  </div>
);

/* ────────────────────────────────────────────────────────────
 * OVERVIEW
 * ──────────────────────────────────────────────────────────── */
const OverviewTab = ({ avatar, client, brief, renders, convos, invitation, onChat, onGoToTab }) => {
  const recentRender = renders[0];
  const recentConvo = convos[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--gap)' }}>
      {/* left column */}
      <div className="col">
        {/* Performance card */}
        <div className="card card-pad">
          <SectionHeader title="Performance" sub="last 30 days" />
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'center' }}>
            <UsageChart avatar={avatar} />
            <div className="col" style={{ gap: 14 }}>
              <Bullet label="Avg. render time" value="3m 12s" />
              <Bullet label="Avg. duration" value="1m 24s" />
              <Bullet label="Cost / video" value="$0.18" sub="HeyGen credits" />
              <Bullet label="Reuse rate" value="34%" sub="scripts edited & re-rendered" />
            </div>
          </div>
        </div>

        {/* Recent renders strip */}
        <div className="card">
          <div style={{ padding: '18px 22px 8px' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <SectionHeader title="Recent renders" sub={`${renders.length} total`} inline />
              <button className="btn sm ghost" onClick={() => onGoToTab('renders')}>
                See all <Icon name="arrow-r" size={12} />
              </button>
            </div>
          </div>
          {renders.length ? (
            <div style={{ padding: '0 14px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {renders.slice(0, 3).map(r => <RenderTile key={r.id} render={r} avatar={avatar} compact />)}
            </div>
          ) : (
            <EmptyRow label="No renders yet" cta="Generate first video" onCta={() => onGoToTab('renders')} />
          )}
        </div>

        {/* Conversations preview */}
        <div className="card">
          <div style={{ padding: '18px 22px 8px' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <SectionHeader title="Conversations" sub={`${convos.length} threads`} inline />
              <button className="btn sm ghost" onClick={() => onGoToTab('conversations')}>
                See all <Icon name="arrow-r" size={12} />
              </button>
            </div>
          </div>
          {convos.length ? (
            <div style={{ padding: '0 22px 18px' }}>
              {convos.slice(0, 3).map(c => <ConvoRow key={c.id} convo={c} onOpen={onChat} />)}
            </div>
          ) : (
            <EmptyRow label="No conversations yet" cta="Start chatting" onCta={onChat} />
          )}
        </div>
      </div>

      {/* right column */}
      <div className="col">
        {/* Identity card */}
        <div className="card card-pad">
          <SectionHeader title="Identity" />
          <KV label="Avatar ID" value={avatar.id} mono />
          <KV label="HeyGen ID"  value={avatar.heygenId || '—'} mono />
          <KV label="Voice"      value={avatar.voice || 'not cloned'} mono />
          <KV label="Languages"  value={(avatar.languages || []).join(', ') || '—'} />
          <KV label="Created"    value={avatar.createdAt} mono />
        </div>

        {/* Client card */}
        <div className="card card-pad">
          <SectionHeader title="Client" />
          <div className="row" style={{ marginBottom: 14, gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 6,
              background: paletteForId(avatar.id).bg, color: paletteForId(avatar.id).tag,
              display: 'grid', placeItems: 'center',
              fontFamily: 'DM Sans', fontWeight: 600, fontSize: 14
            }}>
              {client.contact.split(' ').map(p => p[0]).slice(0,2).join('')}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{client.contact}</div>
              <div className="mono">{client.role}</div>
            </div>
          </div>
          <KV label="Company" value={client.companyName} />
          <KV label="Email"   value={client.email} mono />
          {brief.phone && <KV label="Phone" value={brief.phone} mono />}
          {brief.website && <KV label="Web" value={brief.website} mono />}
        </div>

        {/* Status / timeline */}
        {invitation && (
          <div className="card card-pad">
            <SectionHeader title="Provenance" />
            <div className="col" style={{ gap: 10 }}>
              <MiniTimeline events={invitation.timeline.slice(-4)} />
              <button className="btn ghost sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
                onClick={() => onGoToTab('training')}>
                Full history <Icon name="arrow-r" size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* —— small reusable pieces —— */
const SectionHeader = ({ title, sub, inline }) => (
  <div style={{ marginBottom: inline ? 0 : 16 }}>
    <div style={{ fontFamily: 'var(--f-display)', fontSize: 22, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
      {title}
    </div>
    {sub && <div className="mono" style={{ marginTop: 4 }}>{sub}</div>}
  </div>
);

const KV = ({ label, value, mono }) => (
  <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0', gap: 12, fontSize: 13, alignItems: 'baseline' }}>
    <span className="mono" style={{ color: 'var(--text-3)' }}>{label}</span>
    <span style={{
      color: 'var(--text)',
      fontFamily: mono ? 'var(--f-mono)' : 'var(--f-sans)',
      fontSize: mono ? 12 : 13,
      textAlign: 'right',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%'
    }}>{value}</span>
  </div>
);

const Bullet = ({ label, value, sub }) => (
  <div>
    <div className="mono">{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
      <span style={{ fontFamily: 'var(--f-display)', fontSize: 26, letterSpacing: '-0.01em', color: 'var(--text)' }}>{value}</span>
      {sub && <span className="mono">{sub}</span>}
    </div>
  </div>
);

const EmptyRow = ({ label, cta, onCta }) => (
  <div style={{ padding: '24px 22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)' }}>
    <span className="mono">{label}</span>
    {cta && <button className="btn sm" onClick={onCta}>{cta} <Icon name="arrow-r" size={12} /></button>}
  </div>
);

/* —— Usage chart — small SVG bar series —— */
const UsageChart = ({ avatar }) => {
  // deterministic pseudo-series from avatar id
  const seed = avatar.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const days = Array.from({ length: 30 }, (_, i) => {
    const r = Math.sin((seed + i * 7) * 0.7) * 0.5 + 0.5;
    const r2 = Math.sin((seed + i * 3) * 1.3) * 0.5 + 0.5;
    return Math.max(0.05, Math.round((r * 0.7 + r2 * 0.3) * 100) / 100);
  });
  const W = 360, H = 130, P = 8, BAR_W = (W - P * 2) / days.length;
  const max = Math.max(...days);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* axis line */}
      <line x1={P} y1={H - 14} x2={W - P} y2={H - 14} stroke="var(--border)" strokeWidth="1" />
      {days.map((d, i) => {
        const h = (d / max) * (H - 28);
        const x = P + i * BAR_W + 1;
        const y = H - 14 - h;
        return (
          <rect key={i} x={x} y={y} width={BAR_W - 2} height={h}
            fill={i === days.length - 1 ? 'var(--maroon)' : (i % 7 === 0 ? 'var(--gold)' : 'var(--p-navy)')}
            opacity={i === days.length - 1 ? 1 : 0.55} rx="1" />
        );
      })}
      {/* labels */}
      <text x={P} y={H - 2} fontSize="9" fill="var(--text-4)" fontFamily="var(--f-mono)">30D AGO</text>
      <text x={W - P} y={H - 2} fontSize="9" fill="var(--text-4)" fontFamily="var(--f-mono)" textAnchor="end">TODAY</text>
    </svg>
  );
};

/* ────────────────────────────────────────────────────────────
 * RENDERS TAB
 * ──────────────────────────────────────────────────────────── */
const RendersTab = ({ avatar, renders, onGenerate }) => {
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <SectionHeader title="All renders" sub={`${renders.length} videos`} inline />
        <button className="btn primary" onClick={onGenerate}>
          <Icon name="sparkle" size={14} stroke={2} /> New render
        </button>
      </div>
      {renders.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)' }}>
          {renders.map(r => <RenderTile key={r.id} render={r} avatar={avatar} />)}
        </div>
      ) : (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, fontStyle: 'italic', color: 'var(--text-3)' }}>
            Nothing rendered yet.
          </div>
          <div className="mono" style={{ marginTop: 6, marginBottom: 18 }}>cast your first script into a video</div>
          <button className="btn primary" onClick={onGenerate}>
            <Icon name="sparkle" size={14} /> Generate first video
          </button>
        </div>
      )}
    </div>
  );
};

const RenderTile = ({ render, avatar, compact }) => {
  const rendering = render.status === 'rendering';
  const queued = render.status === 'queued';
  return (
    <div className="card" style={{ overflow: 'hidden', cursor: 'pointer', transition: 'border-color 200ms' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--maroon)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div style={{ aspectRatio: '16/9', position: 'relative' }}>
        <AvatarTile avatar={avatar} />
        {!rendering && !queued && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'grid', placeItems: 'center'
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 999,
              background: 'rgba(30,35,48,0.7)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'grid', placeItems: 'center', color: '#fff'
            }}>
              <Icon name="play" size={14} />
            </div>
          </div>
        )}
        {render.duration && render.duration !== '—' && (
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            fontFamily: 'var(--f-mono)', fontSize: 10.5, color: '#fff',
            background: 'rgba(30,35,48,0.8)', padding: '2px 6px', borderRadius: 3
          }}>{render.duration}</div>
        )}
        {rendering && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,35,48,0.55)', display: 'grid', placeItems: 'center', color: '#fff' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="mono" style={{ color: 'var(--gold)', marginBottom: 8 }}>RENDERING · {render.progress}%</div>
              <div style={{ width: 140, height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${render.progress}%`, background: 'var(--gold)' }} />
              </div>
            </div>
          </div>
        )}
        {queued && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,35,48,0.55)', display: 'grid', placeItems: 'center', color: '#fff' }}>
            <span className="mono">QUEUED</span>
          </div>
        )}
      </div>
      <div style={{ padding: compact ? '10px 12px' : '14px 16px' }}>
        <div style={{ fontSize: compact ? 13 : 14, lineHeight: 1.3, marginBottom: 4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {render.title}
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="mono">{render.createdAt}</span>
          <StatusBadge status={render.status} />
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
 * CONVERSATIONS TAB
 * ──────────────────────────────────────────────────────────── */
const ConversationsTab = ({ avatar, convos, onChat }) => (
  <div>
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
      <SectionHeader title="All threads" sub={`${convos.length} conversations with ${avatar.contact.split(' ')[0]}`} inline />
      <button className="btn primary" onClick={onChat}>
        <Icon name="plus" size={14} /> New thread
      </button>
    </div>
    {convos.length ? (
      <div className="card">
        {convos.map((c, i) => (
          <div key={c.id} style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <ConvoRow convo={c} onOpen={onChat} expanded />
          </div>
        ))}
      </div>
    ) : (
      <div className="card card-pad" style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, fontStyle: 'italic', color: 'var(--text-3)' }}>
          No conversations yet.
        </div>
        <div className="mono" style={{ marginTop: 6, marginBottom: 18 }}>chat with {avatar.contact.split(' ')[0]} — they answer in their voice</div>
        <button className="btn primary" onClick={onChat}>
          <Icon name="chat" size={14} /> Start a thread
        </button>
      </div>
    )}
  </div>
);

const ConvoRow = ({ convo, onOpen, expanded }) => (
  <button onClick={onOpen} style={{
    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
    padding: expanded ? '14px 22px' : '10px 0',
    background: 'transparent', border: 0, textAlign: 'left', cursor: 'pointer',
    color: 'inherit', font: 'inherit',
    transition: 'background 120ms'
  }}
    onMouseEnter={e => expanded && (e.currentTarget.style.background = 'var(--surface-2)')}
    onMouseLeave={e => expanded && (e.currentTarget.style.background = 'transparent')}>
    <Icon name="chat" size={14} style={{ color: 'var(--text-3)' }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{convo.title}</div>
      <div className="mono" style={{ marginTop: 2 }}>{convo.messages} messages · {convo.updated}</div>
    </div>
    <Icon name="arrow-r" size={14} style={{ color: 'var(--text-4)' }} />
  </button>
);

/* ────────────────────────────────────────────────────────────
 * BRIEF TAB
 * ──────────────────────────────────────────────────────────── */
const RepoField = ({ label, value }) => (
  <div>
    <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 13, lineHeight: 1.6, color: value ? 'var(--text)' : 'var(--text-4)', whiteSpace: 'pre-line' }}>
      {value || '— not yet collected'}
    </div>
  </div>
);

const BriefTab = ({ brief, client, onEdit }) => {
  const repo = repoForClient(client.id);
  const SOCIAL_KEYS = ['facebook','instagram','youtube','podcast','website'];
  const SOCIAL_LABELS = {
    facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', podcast: 'Podcast', website: 'Website'
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)' }}>
      <div className="card card-pad">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
          <SectionHeader title="Phone · Address · Mail · Web" sub={brief.updatedAt ? `updated ${brief.updatedAt}` : 'not yet collected'} inline />
          <button className="btn sm" onClick={onEdit}><Icon name="doc" size={12} /> Edit</button>
        </div>
        <div className="col" style={{ gap: 4 }}>
          <KV label="Phone" value={brief.phone || '—'} mono />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', gap: 12, fontSize: 13, alignItems: 'flex-start' }}>
            <span className="mono" style={{ color: 'var(--text-3)' }}>Address</span>
            <span style={{ whiteSpace: 'pre-line', textAlign: 'right', fontSize: 13, color: 'var(--text)' }}>{brief.address || '—'}</span>
          </div>
          <KV label="Email" value={brief.mail || client.email} mono />
          <KV label="Website" value={brief.website || '—'} mono />
        </div>
      </div>

      <div className="card card-pad">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
          <SectionHeader title="Channels" sub="vaulted = credentials on file" inline />
          <button className="btn sm" onClick={onEdit}><Icon name="shield" size={12} /> Manage</button>
        </div>
        <div className="col" style={{ gap: 2 }}>
          {SOCIAL_KEYS.map(k => {
            const s = brief.socials[k];
            const has = s && s.handle;
            return (
              <div key={k} className="row" style={{ padding: '8px 0', borderBottom: '1px dashed var(--border)', gap: 12 }}>
                <span style={{ width: 80, fontSize: 12, color: 'var(--text-3)' }}>{SOCIAL_LABELS[k]}</span>
                <span style={{ flex: 1, fontFamily: has ? 'var(--f-mono)' : 'var(--f-sans)', fontSize: 12, color: has ? 'var(--text)' : 'var(--text-4)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {has ? s.handle : '— not connected'}
                </span>
                {has && (
                  s.vaulted
                    ? <span className="badge ok"><span className="dot" />vaulted</span>
                    : <span className="badge warn"><span className="dot" />handle only</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* business repository — client-level, drives script generation (merged from studio) */}
      <div className="card card-pad" style={{ gridColumn: '1 / -1' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
          <SectionHeader title="Positioning · Audience · Tone" sub="business repository — what script generation reads from" inline />
          <button className="btn sm" onClick={onEdit}><Icon name="doc" size={12} /> Edit</button>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <RepoField label="Positioning" value={repo.positioning} />
          <RepoField label="Audience" value={repo.audience} />
          <RepoField label="Brand tone" value={repo.tone} />
          <RepoField label="Notes" value={repo.notes} />
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
 * TRAINING / HISTORY
 * ──────────────────────────────────────────────────────────── */
const TrainingTab = ({ avatar, invitation, onResend }) => {
  if (!invitation) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, fontStyle: 'italic', color: 'var(--text-3)' }}>
          On-site recording.
        </div>
        <div className="mono" style={{ marginTop: 6 }}>this avatar was recorded in person — no invitation timeline</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 'var(--gap)' }}>
      <div className="card card-pad">
        <SectionHeader title="Provenance timeline" sub={`from invitation sent ${invitation.sentAt}`} />
        <FullTimeline events={invitation.timeline} />
      </div>
      <div className="col">
        <div className="card card-pad">
          <SectionHeader title="Invitation" />
          <KV label="Sent to" value={invitation.recipient.email} mono />
          <KV label="Channel" value={invitation.channel} />
          <KV label="Sender" value={invitation.sender} />
          <KV label="Expires" value={invitation.expiresAt} mono />
          <div style={{
            marginTop: 14, padding: 14, borderRadius: 6,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontStyle: 'italic', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5
          }}>
            "{invitation.note}"
          </div>
        </div>
        <div className="card card-pad">
          <SectionHeader title="Re-train" />
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 14px' }}>
            Send a fresh recording invitation. Existing renders and conversations stay intact; the avatar's voice and likeness will be retrained from new footage.
          </p>
          <button className="btn" onClick={onResend}>
            <Icon name="send" size={14} /> Send new invitation
          </button>
        </div>
      </div>
    </div>
  );
};

const EVENT_LABEL = {
  sent: 'Invitation sent',
  delivered: 'Delivered',
  opened: 'Opened',
  clicked: 'Link clicked',
  started: 'Started recording',
  recording: 'Recording in progress',
  submitted: 'Footage submitted',
  consented: 'Consent signed',
  training: 'Training started',
  completed: 'Avatar ready',
  expired: 'Invitation expired',
  bounced: 'Email bounced',
  declined: 'Declined',
};

const EVENT_TONE = {
  sent: 'neutral', delivered: 'neutral', opened: 'info', clicked: 'info',
  started: 'info', recording: 'info', submitted: 'warn', consented: 'warn',
  training: 'training', completed: 'ok',
  expired: 'err', bounced: 'err', declined: 'err'
};

const eventColor = (tone) => ({
  neutral: 'var(--text-3)', info: 'var(--p-navy)', warn: 'var(--gold-2)',
  training: 'var(--maroon)', ok: 'var(--ok)', err: 'var(--err)'
}[tone] || 'var(--text-3)');

const FullTimeline = ({ events }) => (
  <div style={{ position: 'relative', paddingLeft: 22 }}>
    <div style={{ position: 'absolute', left: 6, top: 4, bottom: 4, width: 1, background: 'var(--border)' }} />
    {events.map((e, i) => {
      const tone = EVENT_TONE[e.event] || 'neutral';
      const color = eventColor(tone);
      const isLast = i === events.length - 1;
      return (
        <div key={i} style={{ position: 'relative', paddingBottom: isLast ? 0 : 22 }}>
          <div style={{
            position: 'absolute', left: -22, top: 4,
            width: 13, height: 13, borderRadius: 999,
            background: 'var(--surface)',
            border: `2px solid ${color}`,
            boxShadow: isLast ? `0 0 0 4px color-mix(in srgb, ${color} 15%, transparent)` : 'none'
          }} />
          <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
            {EVENT_LABEL[e.event] || e.event}
          </div>
          <div className="mono" style={{ marginTop: 3 }}>
            {e.at}{e.channel ? ` · ${e.channel}` : ''}{e.detail ? ` · ${e.detail}` : ''}
          </div>
        </div>
      );
    })}
  </div>
);

const MiniTimeline = ({ events }) => (
  <div style={{ position: 'relative', paddingLeft: 18 }}>
    <div style={{ position: 'absolute', left: 4, top: 4, bottom: 4, width: 1, background: 'var(--border)' }} />
    {events.map((e, i) => {
      const color = eventColor(EVENT_TONE[e.event]);
      return (
        <div key={i} style={{ position: 'relative', paddingBottom: i === events.length - 1 ? 0 : 12 }}>
          <div style={{
            position: 'absolute', left: -18, top: 4,
            width: 9, height: 9, borderRadius: 999,
            background: color
          }} />
          <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{EVENT_LABEL[e.event] || e.event}</div>
          <div className="mono" style={{ fontSize: 10.5 }}>{e.at}</div>
        </div>
      );
    })}
  </div>
);


export { AvatarDetailView };

