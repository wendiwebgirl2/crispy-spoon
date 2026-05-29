import React from 'react'
import { Icon, CueLogo, Wordmark } from './shared.jsx'
import { AVATARS, INVITATIONS, CONVERSATIONS, GENERATED_VIDEOS } from './data.jsx'
import { AvatarsView } from './avatars.jsx'
import { AvatarDetailView } from './avatar-detail.jsx'
import { InvitationsView } from './invitations.jsx'
import { ConversationsView } from './conversations.jsx'
import StudioView from './studio.jsx'
import { OnboardingView } from './onboarding.jsx'
import { SettingsView } from './settings.jsx'

const NAV = [
  { id: 'avatars',       label: 'Avatars',       icon: 'avatars',  countKey: 'avatars' },
  { id: 'invitations',   label: 'Invitations',   icon: 'send',     countKey: 'invitations' },
  { id: 'conversations', label: 'Conversations', icon: 'chat',     countKey: 'conversations' },
  { id: 'studio',        label: 'Studio',        icon: 'studio',   countKey: 'rendering' },
  { id: 'onboarding',    label: 'Record on-site', icon: 'mic' },
  { id: 'settings',      label: 'Settings',      icon: 'settings' },
];

const HEADER_TITLES = {
  avatars:       { title: 'Avatars',       sub: 'your client roster of digital twins' },
  'avatar-detail': { title: 'Avatar',      sub: 'identity · renders · conversations · brief' },
  invitations:   { title: 'Invitations',   sub: 'notifications sent to clients — live status' },
  conversations: { title: 'Conversations', sub: 'chat with your avatars — they answer in their voice' },
  studio:        { title: 'Studio',        sub: 'cast a script into a HeyGen render' },
  onboarding:    { title: 'On-site record', sub: 'record an avatar in person, no email needed' },
  settings:      { title: 'Settings',      sub: 'workspace · branding · integrations' },
};

function App() {
  const [view, setView] = React.useState('avatars');
  const [chatAvatarId, setChatAvatarId] = React.useState('av_amelia');
  const [detailAvatarId, setDetailAvatarId] = React.useState(null);

  const counts = {
    avatars:       AVATARS.length,
    invitations:   INVITATIONS.filter(i => ['sent','opened','started','recording','submitted','consented','training'].includes(i.status)).length,
    conversations: CONVERSATIONS.length,
    rendering:     GENERATED_VIDEOS.filter(v => v.status === 'rendering' || v.status === 'queued').length,
  };

  const detailAvatar = detailAvatarId ? AVATARS.find(a => a.id === detailAvatarId) : null;
  const hd = (view === 'avatar-detail' && detailAvatar)
    ? { title: detailAvatar.contact, sub: detailAvatar.id }
    : HEADER_TITLES[view] || HEADER_TITLES.avatars;

  const openAvatar = (avatar) => {
    setDetailAvatarId(avatar.id);
    setChatAvatarId(avatar.id);
    setView('avatar-detail');
  };

  const openChat = (avatar) => {
    setChatAvatarId(avatar.id);
    setView('conversations');
  };

  return (
    <div className="shell">
      {/* —— sidebar —— */}
      <aside className="side">
        <div className="side-brand">
          <CueLogo size={32} />
          <Wordmark tagline={true} />
        </div>

        <div className="side-section">WORKSPACE</div>
        <nav className="side-nav">
          {NAV.map(n => (
            <button
              key={n.id}
              className={'nav-item' + (view === n.id ? ' active' : '')}
              onClick={() => setView(n.id)}
              title={n.label}
            >
              <Icon
                name={n.icon}
                size={16}
                stroke={1.6}
                className="nav-icon"
                style={{ color: view === n.id ? 'var(--accent)' : 'var(--text-3)' }}
              />
              <span>{n.label}</span>
              {n.countKey != null && counts[n.countKey] != null && (
                <span className="nav-count">{counts[n.countKey]}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="side-section">SHORTCUTS</div>
        <div className="side-nav">
          <button className="nav-item" onClick={() => setView('onboarding')}>
            <Icon name="plus" size={16} className="nav-icon" />
            <span>New avatar</span>
            <span className="nav-count" style={{ background: 'transparent' }}>⌘N</span>
          </button>
          <button className="nav-item" onClick={() => setView('studio')}>
            <Icon name="sparkle" size={16} className="nav-icon" />
            <span>Quick render</span>
            <span className="nav-count" style={{ background: 'transparent' }}>⌘G</span>
          </button>
          <button className="nav-item">
            <Icon name="history" size={16} className="nav-icon" />
            <span>Activity</span>
          </button>
        </div>

        <div className="side-foot">
          <div className="side-avatar">A</div>
          <div className="side-foot-meta">
            <div className="name">Studio admin</div>
            <div className="role">cuecreative.com</div>
          </div>
          <button className="icon-btn" style={{ width: 26, height: 26 }} title="Account">
            <Icon name="more" size={14} />
          </button>
        </div>
      </aside>

      {/* —— main —— */}
      <main className="main" style={{ gridTemplateRows: '4px calc(var(--hd-h) - 4px) 1fr' }}>
        <div className="wood" style={{ height: 4 }} />
        <header className="hd">
          <div>
            <div className="hd-title">{hd.title}</div>
            <div className="mono">{hd.sub}</div>
          </div>
          <div className="hd-spacer" />
          <div className="hd-search">
            <Icon name="search" size={14} />
            <input placeholder="Search avatars, videos, scripts…" />
            <span className="hd-kbd">⌘K</span>
          </div>
          <button className="icon-btn" title="Activity"><Icon name="history" size={16} /></button>
          <button className="btn primary" onClick={() => setView('invitations')}>
            <Icon name="send" size={14} stroke={2.2} />
            New invitation
          </button>
        </header>

        <section className="view" key={view + (view === 'avatar-detail' ? ':' + detailAvatarId : '')}>
          {view === 'avatars' && (
            <AvatarsView
              onOpenAvatar={openAvatar}
              onAddNew={() => setView('invitations')}
              onChat={openChat}
            />
          )}
          {view === 'avatar-detail' && (
            <AvatarDetailView
              avatarId={detailAvatarId}
              onBack={() => setView('avatars')}
              onChat={openChat}
              onGenerate={(av) => { setChatAvatarId(av.id); setView('studio'); }}
              onEditBrief={() => setView('settings')}
              onResend={() => setView('invitations')}
            />
          )}
          {view === 'invitations' && <InvitationsView onOpenAvatar={openAvatar} />}
          {view === 'conversations' && <ConversationsView initialAvatarId={chatAvatarId} />}
          {view === 'studio' && <StudioView />}
          {view === 'onboarding' && (
            <OnboardingView
              onDone={() => setView('avatars')}
              onCancel={() => setView('avatars')}
            />
          )}
          {view === 'settings' && <SettingsView />}
        </section>
      </main>
    </div>
  );
}

export default App
