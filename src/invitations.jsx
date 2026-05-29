// components/invitations.jsx — Client invitation system: dashboard, composer, email preview, client-side preview

import React from 'react'
import { Icon, CueLogo, EqualizerBars } from './shared.jsx'
import { INVITATIONS, INV_STATUS } from './data.jsx'

const InvitationsView = ({ initialMode = 'list', onOpenAvatar }) => {
  const [mode, setMode] = React.useState(initialMode); // 'list' | 'compose' | 'client-preview'
  const [selectedId, setSelectedId] = React.useState(null);
  const [previewInvId, setPreviewInvId] = React.useState('inv_amelia');

  if (mode === 'compose') return <ComposeView onClose={() => setMode('list')} onSent={(id) => {setSelectedId(id);setMode('list');}} />;
  if (mode === 'client-preview') return <ClientPreview invitationId={previewInvId} onClose={() => setMode('list')} />;

  return (
    <InvitationsList
      selectedId={selectedId}
      onSelect={setSelectedId}
      onCompose={() => setMode('compose')}
      onPreviewClient={(id) => {setPreviewInvId(id);setMode('client-preview');}}
      onOpenAvatar={onOpenAvatar} />);


};

/* ============================================================
 * Master list
 * ============================================================ */
const InvitationsList = ({ selectedId, onSelect, onCompose, onPreviewClient, onOpenAvatar }) => {
  const [filter, setFilter] = React.useState('all');

  const inFlight = ['sent', 'opened', 'started', 'recording', 'submitted', 'consented', 'training'];
  const failed = ['expired', 'bounced', 'declined'];

  const filtered = INVITATIONS.filter((i) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return i.status === 'sent';
    if (filter === 'inflight') return inFlight.includes(i.status);
    if (filter === 'completed') return i.status === 'completed';
    if (filter === 'failed') return failed.includes(i.status);
    return true;
  });

  const counts = {
    all: INVITATIONS.length,
    pending: INVITATIONS.filter((i) => i.status === 'sent').length,
    inflight: INVITATIONS.filter((i) => inFlight.includes(i.status)).length,
    completed: INVITATIONS.filter((i) => i.status === 'completed').length,
    failed: INVITATIONS.filter((i) => failed.includes(i.status)).length
  };

  return (
    <div className="v-pad fade-in">
      {/* hero */}
      <div className="row between" style={{ marginBottom: 28, alignItems: 'flex-end' }}>
        <div>
          <div className="label" style={{ marginBottom: 8, color: 'var(--maroon)' }}>NOTIFICATIONS</div>
          <h1 style={{ fontSize: 44, letterSpacing: '-0.01em', margin: '0 0 6px', lineHeight: 1.05, fontFamily: "\"DM Sans\"" }}>
            <em style={{ color: 'var(--maroon)' }}>Invitations</em> sent to clients.
          </h1>
          <p style={{ color: 'var(--text-3)', margin: 0, fontSize: 14 }}>
            Track every record-your-avatar notification — from delivered to digital twin.
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => onPreviewClient(filtered[0]?.id || 'inv_amelia')}>
            <Icon name="globe" size={14} />
            Preview as client
          </button>
          <button className="btn primary" onClick={onCompose}>
            <Icon name="send" size={14} />
            New invitation
          </button>
        </div>
      </div>

      {/* stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--gap)', marginBottom: 24 }}>
        <FunnelStat n={counts.all} label="Total sent" />
        <FunnelStat n={counts.pending} label="Awaiting client" tone="warn" />
        <FunnelStat n={counts.inflight} label="In flight" tone="info" />
        <FunnelStat n={counts.completed} label="Completed" tone="ok" />
        <FunnelStat n={counts.failed} label="Needs attention" tone="err" />
      </div>

      {/* filter tabs */}
      <div className="row" style={{ gap: 4, marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
        ['all', 'All'],
        ['pending', 'Awaiting client'],
        ['inflight', 'In flight'],
        ['completed', 'Completed'],
        ['failed', 'Needs attention']].
        map(([k, label]) =>
        <button key={k} onClick={() => setFilter(k)}
        style={{
          background: 'transparent',
          border: 0,
          padding: '10px 14px',
          cursor: 'pointer',
          color: filter === k ? 'var(--maroon)' : 'var(--text-2)',
          fontWeight: filter === k ? 600 : 400,
          fontSize: 13,
          borderBottom: '2px solid',
          borderBottomColor: filter === k ? 'var(--maroon)' : 'transparent',
          marginBottom: -1,
          display: 'inline-flex', alignItems: 'center', gap: 6
        }}>
            {label}
            <span className="mono" style={{ color: filter === k ? 'var(--maroon)' : 'var(--text-3)' }}>
              {counts[k]}
            </span>
          </button>
        )}
      </div>

      {/* list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* header row */}
        <div className="row" style={{
          padding: '12px 20px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)'
        }}>
          <div style={{ flex: '0 0 28%' }}>RECIPIENT</div>
          <div style={{ flex: '0 0 14%' }}>CHANNEL</div>
          <div style={{ flex: '0 0 14%' }}>SENT</div>
          <div style={{ flex: 1 }}>PROGRESS</div>
          <div style={{ flex: '0 0 120px', textAlign: 'right' }}>STATUS</div>
        </div>
        {filtered.map((inv) =>
        <InvitationRow key={inv.id}
        invitation={inv}
        expanded={selectedId === inv.id}
        onToggle={() => onSelect(selectedId === inv.id ? null : inv.id)}
        onPreviewClient={() => onPreviewClient(inv.id)}
        onOpenAvatar={onOpenAvatar} />

        )}
        {filtered.length === 0 &&
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 24, fontStyle: 'italic', marginBottom: 4 }}>nothing in flight</div>
            <div className="mono">no invitations match "{filter}"</div>
          </div>
        }
      </div>
    </div>);

};

const FunnelStat = ({ n, label, tone }) => {
  const c = tone === 'ok' ? 'var(--ok)' :
  tone === 'err' ? 'var(--err)' :
  tone === 'warn' ? 'var(--gold-2)' :
  tone === 'info' ? 'var(--p-navy)' :
  'var(--text)';
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: "\"DM Sans\"" }}>
      <div className="label">{label}</div>
      <div style={{ fontFamily: 'var(--f-display)', fontSize: 36, lineHeight: 1, marginTop: 8, color: c, letterSpacing: '-0.01em', height: "36px" }}>{n}</div>
    </div>);

};

const InvitationRow = ({ invitation, expanded, onToggle, onPreviewClient, onOpenAvatar }) => {
  const st = INV_STATUS[invitation.status];
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={onToggle} className="row" style={{
        width: '100%',
        padding: '14px 20px',
        background: expanded ? 'var(--surface-2)' : 'transparent',
        border: 0,
        cursor: 'pointer',
        textAlign: 'left',
        color: 'inherit',
        gap: 16,
        transition: 'background 120ms'
      }}>
        {/* recipient */}
        <div style={{ flex: '0 0 28%', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 999,
            background: 'var(--surface-3)',
            display: 'grid', placeItems: 'center',
            fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 11,
            color: 'var(--maroon)', flexShrink: 0
          }}>
            {invitation.recipient.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{invitation.recipient.name}</div>
            <div className="mono" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{invitation.recipient.company}</div>
          </div>
        </div>
        {/* channel */}
        <div style={{ flex: '0 0 14%' }}>
          <ChannelChips channel={invitation.channel} />
        </div>
        {/* sent */}
        <div style={{ flex: '0 0 14%' }}>
          <div style={{ fontSize: 12.5 }}>{relTime(invitation.sentAt)}</div>
          <div className="mono">{invitation.sentAt.split(' ')[0]}</div>
        </div>
        {/* progress bar */}
        <div style={{ flex: 1, maxWidth: 320 }}>
          <ProgressTrack status={invitation.status} />
        </div>
        {/* status */}
        <div style={{ flex: '0 0 120px', display: 'flex', justifyContent: 'flex-end' }}>
          <StatusPill tone={st.tone}>{st.label}</StatusPill>
        </div>
      </button>

      {/* expanded detail */}
      {expanded && <InvitationDetail invitation={invitation} onPreviewClient={onPreviewClient} onOpenAvatar={onOpenAvatar} />}
    </div>);

};

const ChannelChips = ({ channel }) => {
  const channels = channel.split('+');
  return (
    <div className="row" style={{ gap: 4 }}>
      {channels.map((c) =>
      <span key={c} className="badge" style={{ fontSize: 10, padding: '2px 6px' }}>
          {c === 'email' && <Icon name="send" size={10} />}
          {c === 'sms' && <Icon name="mic" size={10} />}
          {c === 'link' && <Icon name="globe" size={10} />}
          {c.toUpperCase()}
        </span>
      )}
    </div>);

};

const StatusPill = ({ children, tone }) => {
  const styles = {
    neutral: { bg: 'var(--surface-3)', fg: 'var(--text-2)', dot: 'var(--text-3)' },
    info: { bg: 'color-mix(in srgb, var(--p-navy) 10%, white)', fg: 'var(--p-navy)', dot: 'var(--p-navy)' },
    warn: { bg: 'color-mix(in srgb, var(--gold) 18%, white)', fg: 'var(--gold-2)', dot: 'var(--gold-2)' },
    training: { bg: 'color-mix(in srgb, var(--maroon) 10%, white)', fg: 'var(--maroon)', dot: 'var(--maroon)' },
    ok: { bg: 'color-mix(in srgb, var(--ok) 14%, white)', fg: 'var(--ok)', dot: 'var(--ok)' },
    err: { bg: 'color-mix(in srgb, var(--err) 12%, white)', fg: 'var(--err)', dot: 'var(--err)' }
  }[tone] || { bg: 'var(--surface-3)', fg: 'var(--text-2)', dot: 'var(--text-3)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 999,
      fontSize: 11.5, fontFamily: 'var(--f-mono)', fontWeight: 500,
      background: styles.bg, color: styles.fg,
      border: `1px solid color-mix(in srgb, ${styles.fg} 30%, transparent)`
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: styles.dot }} />
      {children}
    </span>);

};

const ProgressTrack = ({ status }) => {
  const steps = ['sent', 'opened', 'started', 'submitted', 'consented', 'training', 'completed'];
  const st = INV_STATUS[status];
  const isFailed = ['expired', 'bounced', 'declined'].includes(status);
  // map status to position; equivalent to step
  const stepMap = { sent: 0, opened: 1, started: 2, recording: 2, submitted: 3, consented: 4, training: 5, completed: 6 };
  const idx = stepMap[status] ?? -1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {steps.map((s, i) => {
        let bg;
        if (isFailed) bg = i === 0 ? 'var(--err)' : 'var(--surface-3)';else
        if (i < idx) bg = 'var(--maroon)';else
        if (i === idx && status === 'completed') bg = 'var(--ok)';else
        if (i === idx) bg = 'var(--gold)';else
        bg = 'var(--surface-3)';
        return (
          <div key={s} style={{
            flex: 1, height: 6, borderRadius: 2,
            background: bg,
            transition: 'background 200ms'
          }} title={s} />);

      })}
    </div>);

};

const relTime = (timestamp) => {
  // very rough relative time for demo
  const map = {
    '2026-04-10 09:14': '6 weeks ago',
    '2026-05-12 11:00': '2 weeks ago',
    '2026-05-20 14:30': '6 days ago',
    '2026-05-25 10:00': '2 days ago',
    '2026-05-26 09:20': 'yesterday',
    '2026-05-26 16:45': 'yesterday'
  };
  return map[timestamp] || timestamp;
};

/* ============================================================
 * Expanded invitation detail (inline beneath the row)
 * ============================================================ */
const InvitationDetail = ({ invitation, onPreviewClient, onOpenAvatar }) => {
  return (
    <div style={{ padding: 24, background: 'var(--surface-2)', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32 }}>
      {/* left — timeline + actions */}
      <div>
        <div className="label" style={{ marginBottom: 14 }}>EVENT TIMELINE</div>
        <div style={{ position: 'relative' }}>
          {/* spine */}
          <div style={{
            position: 'absolute', left: 7, top: 6, bottom: 6,
            width: 1, background: 'var(--border-strong)'
          }} />
          {invitation.timeline.map((ev, i) => {
            const isLast = i === invitation.timeline.length - 1;
            const tone = ev.event === 'bounced' || ev.event === 'expired' ? 'err' :
            ev.event === 'completed' ? 'ok' :
            ev.event === 'consented' || ev.event === 'training' ? 'maroon' :
            'gold';
            const dotColor = { err: 'var(--err)', ok: 'var(--ok)', maroon: 'var(--maroon)', gold: 'var(--gold)' }[tone];
            return (
              <div key={i} className="row" style={{ alignItems: 'flex-start', padding: '6px 0', gap: 14 }}>
                <div style={{
                  width: 15, height: 15, borderRadius: 999,
                  background: 'var(--bg)',
                  border: `2px solid ${dotColor}`,
                  marginTop: 3, flexShrink: 0,
                  boxShadow: isLast ? `0 0 0 4px color-mix(in srgb, ${dotColor} 20%, transparent)` : 'none'
                }} />
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500, textTransform: 'capitalize' }}>{ev.event}</span>
                    {ev.channel && <span className="badge" style={{ fontSize: 10, padding: '1px 6px' }}>{ev.channel.toUpperCase()}</span>}
                  </div>
                  <div className="mono" style={{ marginTop: 2 }}>{ev.at} {ev.detail && <span style={{ color: 'var(--text-2)' }}>· {ev.detail}</span>}</div>
                </div>
              </div>);

          })}
        </div>

        {/* actions */}
        <div className="row" style={{ gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
          {['sent', 'opened', 'expired'].includes(invitation.status) &&
          <button className="btn primary"><Icon name="send" size={13} /> Resend invitation</button>
          }
          {invitation.status === 'bounced' &&
          <button className="btn primary"><Icon name="settings" size={13} /> Fix email & resend</button>
          }
          <button className="btn" onClick={onPreviewClient}><Icon name="globe" size={13} /> Preview client view</button>
          <button className="btn"><Icon name="doc" size={13} /> Copy direct link</button>
          {invitation.avatarId && invitation.status === 'completed' &&
          <button className="btn" onClick={() => onOpenAvatar({ id: invitation.avatarId, status: 'ready' })}>
              <Icon name="arrow-r" size={13} /> Open avatar
            </button>
          }
          {!['completed', 'expired', 'bounced'].includes(invitation.status) &&
          <button className="btn ghost" style={{ color: 'var(--err)' }}>Cancel invitation</button>
          }
        </div>
      </div>

      {/* right — quick info card */}
      <div className="card" style={{ padding: 18, background: 'var(--surface)' }}>
        <div className="label" style={{ marginBottom: 12 }}>INVITATION DETAILS</div>
        <div className="col" style={{ gap: 10 }}>
          <KV2 k="To" v={<><strong style={{ color: 'var(--text)', fontWeight: 500 }}>{invitation.recipient.name}</strong> · <span className="mono">{invitation.recipient.email}</span></>} />
          <KV2 k="Company" v={invitation.recipient.company} />
          {invitation.channel.includes('sms') && <KV2 k="Phone" v={<span className="mono">{invitation.recipient.phone}</span>} />}
          <KV2 k="Sent by" v={invitation.sender} />
          <KV2 k="Sent at" v={<span className="mono">{invitation.sentAt}</span>} />
          <KV2 k="Expires" v={<span className="mono">{invitation.expiresAt}</span>} />
        </div>
        <div className="label" style={{ marginTop: 18, marginBottom: 8 }}>MESSAGE TO CLIENT</div>
        <div style={{
          background: 'var(--surface-2)',
          padding: 12,
          borderRadius: 'var(--r-sm)',
          fontSize: 12.5,
          color: 'var(--text-2)',
          fontStyle: 'italic',
          lineHeight: 1.5,
          border: '1px solid var(--border)'
        }}>"{invitation.note}"</div>
      </div>
    </div>);

};

const KV2 = ({ k, v }) =>
<div className="row" style={{ justifyContent: 'space-between', gap: 16, alignItems: 'baseline' }}>
    <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{k}</span>
    <span style={{ fontSize: 12.5, textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
  </div>;


/* ============================================================
 * Compose new invitation
 * ============================================================ */
const ComposeView = ({ onClose, onSent }) => {
  const [tab, setTab] = React.useState('invite'); // 'invite' | 'brief'
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [channel, setChannel] = React.useState('email');
  const [expiresDays, setExpiresDays] = React.useState(7);
  const [note, setNote] = React.useState("Hi — looking forward to setting up your digital twin. The recording takes about 2 minutes from your laptop. Open this link when you have a quiet moment and even light.");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  // PAMW = Phone / Address / Mail / Website
  const [pamPhone,   setPamPhone]   = React.useState('');
  const [pamAddress, setPamAddress] = React.useState('');
  const [pamMail,    setPamMail]    = React.useState('');
  const [pamWebsite, setPamWebsite] = React.useState('');

  // social & content channels — handle + (vaulted) credentials
  const [socials, setSocials] = React.useState({
    facebook:  { handle: '', user: '', pass: '', url: '' },
    instagram: { handle: '', user: '', pass: '', url: '' },
    youtube:   { handle: '', user: '', pass: '', url: '' },
    podcast:   { handle: '', user: '', pass: '', url: '', rss: '' },
    website:   { handle: '', user: '', pass: '', url: '', cms: '' },
  });
  const updateSocial = (key, field, value) =>
    setSocials(s => ({ ...s, [key]: { ...s[key], [field]: value } }));

  const canSend = name.trim() && (channel.includes('email') ? email.trim() : true) && (channel.includes('sms') ? phone.trim() : true);

  const send = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 1400);
  };

  if (sent) return <SentSuccess name={name} email={email} channel={channel} onDone={() => onSent('new')} />;

  const firstName = name.split(' ')[0] || 'Client';

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', minHeight: 0 }}>
      {/* left — form */}
      <div style={{ padding: 'var(--pad)', overflow: 'auto', borderRight: '1px solid var(--border)' }}>
        <button className="btn ghost" onClick={onClose} style={{ marginBottom: 16 }}>
          <Icon name="arrow-l" size={13} /> Back to invitations
        </button>
        <div className="label" style={{ marginBottom: 8, color: 'var(--maroon)' }}>NEW INVITATION</div>
        <h1 style={{ fontSize: 36, letterSpacing: '-0.01em', margin: '0 0 8px', lineHeight: 1.1, fontFamily: "\"DM Sans\"" }}>
          Send a <em style={{ color: 'var(--maroon)', fontFamily: "\"DM Sans\"" }}>record-your-avatar</em> link.
        </h1>
        <p style={{ color: 'var(--text-3)', maxWidth: 460, marginBottom: 20, fontSize: 14 }}>
          The client gets a notification with a one-time link. We track every step from delivered to digital twin.
        </p>

        {/* tab strip — Invitation / Client brief */}
        <div className="row" style={{ gap: 0, marginBottom: 22, borderBottom: '1px solid var(--border)' }}>
          {[
            ['invite', 'Invitation', 'send'],
            ['brief',  'Client brief', 'doc'],
          ].map(([k, label, icon]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: 'transparent',
              border: 0,
              padding: '10px 16px',
              cursor: 'pointer',
              color: tab === k ? 'var(--maroon)' : 'var(--text-2)',
              fontWeight: tab === k ? 600 : 400,
              fontSize: 13.5,
              borderBottom: '2px solid',
              borderBottomColor: tab === k ? 'var(--maroon)' : 'transparent',
              marginBottom: -1,
              display: 'inline-flex', alignItems: 'center', gap: 8
            }}>
              <Icon name={icon} size={13} />
              {label}
              {k === 'brief' && (pamPhone || pamAddress || pamMail || pamWebsite) && (
                <span className="mono" style={{ color: 'var(--ok)', fontSize: 10 }}>● filled</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'invite' && (
        <div className="col" style={{ gap: 14 }}>
          <Field2 label="Recipient name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amelia Okonkwo" />
          </Field2>
          <Field2 label="Company">
            <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Halberd Capital" />
          </Field2>

          <Field2 label="Channels" hint="how the notification reaches them">
            <div className="row" style={{ gap: 6 }}>
              {[
              { id: 'email', label: 'Email', icon: 'send' },
              { id: 'sms', label: 'SMS', icon: 'mic' },
              { id: 'email+sms', label: 'Email + SMS', icon: 'history' }].
              map((c) =>
              <button key={c.id} onClick={() => setChannel(c.id)}
              className="btn"
              style={{
                flex: 1, justifyContent: 'center',
                background: channel === c.id ? 'var(--surface-2)' : 'var(--surface)',
                borderColor: channel === c.id ? 'var(--maroon)' : 'var(--border-strong)',
                color: channel === c.id ? 'var(--maroon)' : 'var(--text-2)'
              }}>
                  <Icon name={c.icon} size={12} />
                  {c.label}
                </button>
              )}
            </div>
          </Field2>

          {channel.includes('email') &&
          <Field2 label="Email">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="amelia@halberd.cap" />
            </Field2>
          }
          {channel.includes('sms') &&
          <Field2 label="Mobile number">
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (415) 555-0142" />
            </Field2>
          }

          <Field2 label="Personal note" hint={`${note.length}/500`}>
            <textarea className="textarea" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} rows={5}
            style={{ minHeight: 110, fontFamily: 'var(--f-sans)' }}
            placeholder="A short message — it appears at the top of the email." />
          </Field2>

          <Field2 label="Link expires in" hint={`${expiresDays} days from send`}>
            <div className="row" style={{ gap: 6 }}>
              {[3, 7, 14, 30].map((d) =>
              <button key={d} onClick={() => setExpiresDays(d)} className="btn sm"
              style={{
                flex: 1, justifyContent: 'center',
                background: expiresDays === d ? 'var(--surface-2)' : 'transparent',
                borderColor: expiresDays === d ? 'var(--maroon)' : 'var(--border-strong)',
                color: expiresDays === d ? 'var(--maroon)' : 'var(--text-2)'
              }}>{d}d</button>
              )}
            </div>
          </Field2>

          <div className="hairline" style={{ margin: '8px 0' }} />

          <button className="btn primary lg" onClick={send} disabled={!canSend || sending}
          style={{ justifyContent: 'center', opacity: canSend && !sending ? 1 : 0.5 }}>
            {sending ? <>Sending…</> : <><Icon name="send" size={14} /> Send invitation</>}
          </button>
          <div className="mono" style={{ textAlign: 'center', color: 'var(--text-4)' }}>
            Tracked via webhook · auto-reminder at 48h
          </div>
        </div>
        )}

        {tab === 'brief' && (
          <ClientBrief
            firstName={name.split(' ')[0] || 'the client'}
            pamPhone={pamPhone}     setPamPhone={setPamPhone}
            pamAddress={pamAddress} setPamAddress={setPamAddress}
            pamMail={pamMail}       setPamMail={setPamMail}
            pamWebsite={pamWebsite} setPamWebsite={setPamWebsite}
            socials={socials} updateSocial={updateSocial}
            onContinue={() => setTab('invite')}
          />
        )}
      </div>

      {/* right — live preview */}
      <div style={{ background: 'var(--surface-2)', padding: 'var(--pad)', overflow: 'auto' }}>
        {tab === 'invite' && (
          <>
            <div className="label" style={{ marginBottom: 14 }}>LIVE PREVIEW · WHAT {firstName.toUpperCase()} RECEIVES</div>
            {channel.includes('email') &&
            <EmailPreview name={firstName} fullName={name || 'Client'} note={note} expiresDays={expiresDays} />
            }
            {channel.includes('sms') &&
            <div style={{ marginTop: 16 }}>
                <SmsPreview name={firstName} />
              </div>
            }
          </>
        )}
        {tab === 'brief' && (
          <BriefSummary
            firstName={firstName}
            company={company}
            pamPhone={pamPhone} pamAddress={pamAddress} pamMail={pamMail} pamWebsite={pamWebsite}
            socials={socials}
          />
        )}
      </div>
    </div>);

};

/* ============================================================
 * Client brief — PAMW (Phone / Address / Mail / Website) +
 * social and content channels. Captured per-invitation so the
 * client record is complete the moment they accept.
 * ============================================================ */
const ClientBrief = ({ firstName, pamPhone, setPamPhone, pamAddress, setPamAddress, pamMail, setPamMail, pamWebsite, setPamWebsite, socials, updateSocial, onContinue }) => {
  const fields = [pamPhone, pamAddress, pamMail, pamWebsite];
  const filled = fields.filter(s => s.trim().length > 0).length;

  return (
    <div className="col" style={{ gap: 20 }}>
      {/* PAMW block */}
      <div>
        <div className="row between" style={{ marginBottom: 8, alignItems: 'baseline' }}>
          <div className="label" style={{ color: 'var(--maroon)' }}>P · A · M · W</div>
          <div className="mono" style={{ color: filled === 4 ? 'var(--ok)' : 'var(--text-4)' }}>
            {filled}/4 complete
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 14px', lineHeight: 1.5 }}>
          Core contact details for {firstName === 'the client' ? 'this client' : firstName} — phone, mailing address, email, and website.
        </p>

        <div className="col" style={{ gap: 12 }}>
          <PAMWField letter="P" name="Phone" hint="mobile or office"
            value={pamPhone} onChange={setPamPhone}
            placeholder="+1 (415) 555-0142" />
          <PAMWField letter="A" name="Address" hint="mailing" multiline
            value={pamAddress} onChange={setPamAddress}
            placeholder="600 California St, Floor 12&#10;San Francisco, CA 94108" />
          <PAMWField letter="M" name="Mail" hint="primary email"
            value={pamMail} onChange={setPamMail}
            placeholder="amelia@halberd.cap" />
          <PAMWField letter="W" name="Website" hint="company URL"
            value={pamWebsite} onChange={setPamWebsite}
            placeholder="halberd.cap" />
        </div>
      </div>

      <div className="hairline" />

      {/* socials block */}
      <div>
        <div className="row between" style={{ marginBottom: 8, alignItems: 'baseline' }}>
          <div className="label" style={{ color: 'var(--maroon)' }}>CHANNELS &amp; CREDENTIALS</div>
          <div className="row" style={{ gap: 6, color: 'var(--ok)' }}>
            <Icon name="shield" size={11} />
            <span className="mono" style={{ color: 'var(--ok)' }}>encrypted vault</span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 14px', lineHeight: 1.5 }}>
          Where their content lives. Logins are encrypted at rest — only the publisher service decrypts at post time.
        </p>

        <div className="col" style={{ gap: 10 }}>
          <SocialBlock
            iconBg="#1877F2" mono="FB" label="Facebook" placeholderHandle="@halberdcapital"
            data={socials.facebook} update={(f, v) => updateSocial('facebook', f, v)} />
          <SocialBlock
            iconBg="#E1306C" mono="IG" label="Instagram" placeholderHandle="@halberd.capital"
            data={socials.instagram} update={(f, v) => updateSocial('instagram', f, v)} />
          <SocialBlock
            iconBg="#FF0000" mono="YT" label="YouTube" placeholderHandle="@HalberdCapital"
            data={socials.youtube} update={(f, v) => updateSocial('youtube', f, v)} />
          <SocialBlock
            iconBg="#8B1F1F" mono="PC" label="Podcast" placeholderHandle="Halberd Brief"
            data={socials.podcast} update={(f, v) => updateSocial('podcast', f, v)}
            extras={[{ key: 'rss', label: 'RSS feed URL', placeholder: 'https://feeds.simplecast.com/…' }]} />
          <SocialBlock
            iconBg="#3B4E63" mono="WB" label="Website / Blog" placeholderHandle="halberd.cap"
            urlOnly
            data={socials.website} update={(f, v) => updateSocial('website', f, v)}
            extras={[{ key: 'cms', label: 'CMS', placeholder: 'WordPress · Ghost · Webflow · custom' }]} />
        </div>
      </div>

      <div className="hairline" />

      <button className="btn primary lg" onClick={onContinue} style={{ justifyContent: 'center' }}>
        Save brief &amp; continue to invitation <Icon name="arrow-r" size={14} />
      </button>
      <div className="mono" style={{ textAlign: 'center', color: 'var(--text-4)' }}>
        Brief saves to the client record · revisable any time
      </div>
    </div>
  );
};

const PAMWField = ({ letter, name, hint, value, onChange, placeholder, multiline }) => (
  <div className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'stretch' }}>
    <div style={{
      width: 36, flexShrink: 0,
      background: 'color-mix(in srgb, var(--maroon) 8%, white)',
      border: '1px solid color-mix(in srgb, var(--maroon) 25%, transparent)',
      borderRadius: 'var(--r-sm)',
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--f-display)',
      fontSize: 24,
      fontStyle: 'italic',
      color: 'var(--maroon)',
      lineHeight: 1
    }}>{letter}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="row between" style={{ marginBottom: 4, alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{name}</span>
        <span className="mono" style={{ color: 'var(--text-4)' }}>{hint}</span>
      </div>
      {multiline ? (
        <textarea className="textarea" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ minHeight: 70, fontFamily: 'var(--f-sans)', fontSize: 13, border: '1px solid var(--border)' }} />
      ) : (
        <input className="input" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ fontSize: 13, border: '1px solid var(--border)' }} />
      )}
    </div>
  </div>
);

const SocialBlock = ({ iconBg, mono, label, placeholderHandle, data, update, extras = [], urlOnly = false }) => {
  const [open, setOpen] = React.useState(false);
  const hasCreds = data.user || data.pass;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="row" style={{ padding: 12, gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6,
          background: iconBg, color: '#fff',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 600,
          flexShrink: 0
        }}>{mono}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
          <input className="input"
            value={data.handle}
            onChange={e => update('handle', e.target.value)}
            placeholder={placeholderHandle}
            style={{ padding: '4px 0', border: 0, fontSize: 12.5, background: 'transparent', fontFamily: 'var(--f-mono)', color: 'var(--text-2)' }} />
        </div>
        {!urlOnly && (
          <button onClick={() => setOpen(o => !o)}
            className="btn sm"
            style={{
              background: hasCreds ? 'color-mix(in srgb, var(--ok) 14%, white)' : 'transparent',
              borderColor: hasCreds ? 'color-mix(in srgb, var(--ok) 40%, transparent)' : 'var(--border-strong)',
              color: hasCreds ? 'var(--ok)' : 'var(--text-2)',
              boxShadow: 'none'
            }}>
            <Icon name="shield" size={11} />
            {hasCreds ? 'Stored' : 'Add login'}
            <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? '▴' : '▾'}</span>
          </button>
        )}
      </div>

      {open && !urlOnly && (
        <div style={{ padding: 12, paddingTop: 0, background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <input className="input" value={data.user}
              onChange={e => update('user', e.target.value)}
              placeholder="Username or email"
              style={{ fontSize: 12.5 }} />
            <input className="input" type="password" value={data.pass}
              onChange={e => update('pass', e.target.value)}
              placeholder="Password"
              style={{ fontSize: 12.5 }} />
          </div>
          {extras.map(ex => (
            <input key={ex.key} className="input" value={data[ex.key] || ''}
              onChange={e => update(ex.key, e.target.value)}
              placeholder={ex.label + ' — ' + ex.placeholder}
              style={{ fontSize: 12.5, marginTop: 8 }} />
          ))}
          <div className="mono" style={{ marginTop: 8, color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="shield" size={10} />
            sealed at rest · revealed only at publish time
          </div>
        </div>
      )}

      {urlOnly && (
        <div style={{ padding: 12, paddingTop: 0 }}>
          <input className="input" value={data.url || ''}
            onChange={e => update('url', e.target.value)}
            placeholder="https://"
            style={{ fontSize: 12.5, marginTop: 4 }} />
          {extras.map(ex => (
            <input key={ex.key} className="input" value={data[ex.key] || ''}
              onChange={e => update(ex.key, e.target.value)}
              placeholder={ex.label + ' — ' + ex.placeholder}
              style={{ fontSize: 12.5, marginTop: 8 }} />
          ))}
        </div>
      )}
    </div>
  );
};

/* ============================================================
 * Brief summary — read-only preview pane for the brief tab.
 * Mirrors what shows up later on the avatar detail view.
 * ============================================================ */
const BriefSummary = ({ firstName, company, pamPhone, pamAddress, pamMail, pamWebsite, socials }) => {
  const allBrief = [pamPhone, pamAddress, pamMail, pamWebsite];
  const briefFilled = allBrief.filter(v => v && v.trim()).length;
  const socialEntries = Object.entries(socials);
  const socialFilled = socialEntries.filter(([_, d]) => d.handle || d.url || d.user).length;

  const empty = briefFilled === 0 && socialFilled === 0;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="label" style={{ marginBottom: 14 }}>BRIEF · PREVIEW · WHAT WE'LL STORE</div>

      {empty && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--f-display)', fontSize: 28, fontStyle: 'italic', color: 'var(--text-3)', marginBottom: 6 }}>
            empty brief
          </div>
          <div className="mono" style={{ color: 'var(--text-4)' }}>
            fill any field on the left to see it appear here
          </div>
        </div>
      )}

      {!empty && (
        <>
          {/* header card */}
          <div className="card" style={{ padding: 20, marginBottom: 14 }}>
            <div className="row" style={{ gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 999,
                background: 'color-mix(in srgb, var(--maroon) 10%, white)',
                border: '1px solid color-mix(in srgb, var(--maroon) 25%, transparent)',
                display: 'grid', placeItems: 'center',
                fontFamily: 'var(--f-display)', fontSize: 22, fontStyle: 'italic',
                color: 'var(--maroon)', flexShrink: 0
              }}>{firstName === 'Client' ? '?' : firstName[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-display)', fontSize: 22, lineHeight: 1.15, color: 'var(--text)' }}>
                  {firstName === 'Client' ? 'Unnamed client' : firstName}
                </div>
                <div className="mono">{company || 'no company set'} · brief draft</div>
              </div>
              <div className="badge" style={{ flexShrink: 0 }}>
                <span className="dot" style={{ background: briefFilled === 4 && socialFilled >= 3 ? 'var(--ok)' : 'var(--gold)' }} />
                {briefFilled === 4 && socialFilled >= 3 ? 'complete' : 'draft'}
              </div>
            </div>
          </div>

          {/* PAMW summary */}
          {briefFilled > 0 && (
            <div className="card" style={{ padding: 20, marginBottom: 14 }}>
              <div className="row between" style={{ marginBottom: 14, alignItems: 'baseline' }}>
                <div className="label" style={{ color: 'var(--maroon)' }}>P · A · M · W</div>
                <span className="mono">{briefFilled}/4 fields</span>
              </div>
              <div className="col" style={{ gap: 10 }}>
                <SummaryLine letter="P" label="Phone"   value={pamPhone} mono />
                <SummaryLine letter="A" label="Address" value={pamAddress} multiline />
                <SummaryLine letter="M" label="Mail"    value={pamMail} mono />
                <SummaryLine letter="W" label="Website" value={pamWebsite} mono link />
              </div>
            </div>
          )}

          {/* socials */}
          {socialFilled > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div className="row between" style={{ marginBottom: 14, alignItems: 'baseline' }}>
                <div className="label" style={{ color: 'var(--maroon)' }}>CHANNELS</div>
                <span className="mono">{socialFilled} of {socialEntries.length}</span>
              </div>
              <div className="col" style={{ gap: 8 }}>
                {socialEntries.map(([key, d]) => {
                  const filled = d.handle || d.url || d.user;
                  if (!filled) return null;
                  const meta = SOCIAL_META[key];
                  const hasCreds = d.user || d.pass;
                  return (
                    <div key={key} className="row" style={{ gap: 10, padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 5,
                        background: meta.color, color: '#fff',
                        display: 'grid', placeItems: 'center',
                        fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 600,
                        flexShrink: 0
                      }}>{meta.mono}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text)' }}>{meta.label}</div>
                        <div className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.handle || d.url || '—'}
                        </div>
                      </div>
                      {hasCreds && (
                        <span className="badge" style={{ fontSize: 10, color: 'var(--ok)', borderColor: 'color-mix(in srgb, var(--ok) 40%, transparent)', background: 'color-mix(in srgb, var(--ok) 12%, white)' }}>
                          <Icon name="shield" size={9} /> vaulted
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const SOCIAL_META = {
  facebook:  { mono: 'FB', color: '#1877F2', label: 'Facebook' },
  instagram: { mono: 'IG', color: '#E1306C', label: 'Instagram' },
  youtube:   { mono: 'YT', color: '#FF0000', label: 'YouTube' },
  podcast:   { mono: 'PC', color: '#8B1F1F', label: 'Podcast' },
  website:   { mono: 'WB', color: '#3B4E63', label: 'Website / Blog' },
};

const SummaryLine = ({ letter, label, value, mono, multiline, link }) => (
  <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
    <div style={{
      width: 24, height: 24, flexShrink: 0,
      borderRadius: 4,
      background: 'color-mix(in srgb, var(--maroon) 8%, white)',
      border: '1px solid color-mix(in srgb, var(--maroon) 25%, transparent)',
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--f-display)', fontSize: 14, fontStyle: 'italic',
      color: 'var(--maroon)', lineHeight: 1,
      marginTop: 1
    }}>{letter}</div>
    <div style={{ flex: '0 0 70px', fontSize: 11.5, color: 'var(--text-3)', paddingTop: 4 }}>{label}</div>
    <div style={{
      flex: 1, minWidth: 0,
      fontFamily: mono ? 'var(--f-mono)' : 'var(--f-sans)',
      fontSize: 12.5,
      color: value ? (link ? 'var(--maroon)' : 'var(--text)') : 'var(--text-4)',
      whiteSpace: multiline ? 'pre-wrap' : 'normal',
      lineHeight: 1.45
    }}>
      {value || <span style={{ fontStyle: 'italic' }}>—</span>}
    </div>
  </div>
);

const Field2 = ({ label, hint, children }) =>
<label style={{ display: 'block' }}>
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
      {hint && <span className="mono">{hint}</span>}
    </div>
    {children}
  </label>;

/* ============================================================
 * Email preview — what the client sees in their inbox
 * ============================================================ */
const EmailPreview = ({ name, fullName, note, expiresDays }) => {
  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      {/* email "envelope" — From/To/Subject */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md) var(--r-md) 0 0',
        padding: '14px 18px', borderBottom: 0
      }}>
        <EnvRow k="From" v={<><strong style={{ color: 'var(--text)', fontWeight: 500 }}>cue:creative studio</strong> &lt;<span className="mono">studio@cuecreative.com</span>&gt;</>} />
        <EnvRow k="To" v={<span className="mono">{fullName.toLowerCase().replace(/\s/g, '.')}@client.com</span>} />
        <EnvRow k="Subject" v={<strong style={{ color: 'var(--text)', fontWeight: 500 }}>Record your cue:creative avatar — about 2 minutes</strong>} />
      </div>

      {/* email body */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: '0 0 var(--r-md) var(--r-md)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-2)',
        fontFamily: '"DM Sans", system-ui, sans-serif',
        color: '#1e2330'
      }}>
        {/* wood header strip — brand touch */}
        <div className="wood" style={{ height: 8 }} />

        {/* logo header */}
        <div style={{ padding: '28px 36px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <CueLogo size={36} />
          <div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 17, color: '#8b1f1f', lineHeight: 1 }}>
              cue:creative
            </div>
            <div style={{ fontSize: 10, color: '#6e6757', marginTop: 3 }}>marketing and advertising</div>
          </div>
        </div>

        <div style={{ padding: '20px 36px 32px' }}>
          <h2 style={{
            fontFamily: 'Instrument Serif, serif',
            fontSize: 32,
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
            margin: '12px 0 14px',
            color: '#1e2330'
          }}>
            Hi {name},<br />
            <em style={{ color: '#8b1f1f' }}>let's record your avatar.</em>
          </h2>

          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#3b4e63', margin: '0 0 20px', whiteSpace: 'pre-wrap' }}>
            {note}
          </p>

          {/* CTA */}
          <a style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#8b1f1f', color: '#fff',
            padding: '14px 24px', borderRadius: 6,
            fontSize: 14, fontWeight: 600,
            textDecoration: 'none',
            marginBottom: 8
          }}>
            Record my avatar →
          </a>
          <div style={{ fontSize: 11, color: '#6e6757', marginBottom: 26, fontFamily: 'JetBrains Mono, monospace' }}>
            link expires in {expiresDays} days · one-time use
          </div>

          {/* what to expect */}
          <div style={{
            background: '#faf7f0',
            border: '1px solid #e2dccb',
            borderRadius: 8,
            padding: 18,
            marginBottom: 18
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#6e6757', marginBottom: 12
            }}>What to expect</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: '#3b4e63' }}>
              <li><strong style={{ color: '#1e2330' }}>2 minutes of footage</strong> from your laptop camera — even light, plain background.</li>
              <li><strong style={{ color: '#1e2330' }}>One signature</strong> on the likeness consent (HeyGen requires it).</li>
              <li><strong style={{ color: '#1e2330' }}>~24 hours</strong> while we train your twin.</li>
              <li><strong style={{ color: '#1e2330' }}>A private link</strong> from us when it's ready.</li>
            </ol>
          </div>

          {/* privacy reassurance */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, background: '#faf7f0', borderRadius: 6 }}>
            <div style={{ marginTop: 2 }}><Icon name="shield" size={14} stroke={1.8} style={{ color: '#8b1f1f' }} /></div>
            <div style={{ fontSize: 11.5, lineHeight: 1.5, color: '#6e6757' }}>
              Your footage and trained avatar belong to you. We delete both within 30 days of any consent withdrawal.
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{
          background: '#faf7f0',
          padding: '18px 36px',
          borderTop: '1px solid #e2dccb',
          textAlign: 'center'
        }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 14, color: '#8b1f1f', marginBottom: 2 }}>
            cue:creative
          </div>
          <div style={{ fontSize: 10, color: '#6e6757' }}>
            marketing and advertising · cuecreative.com
          </div>
        </div>
      </div>
    </div>);

};

const EnvRow = ({ k, v }) =>
<div className="row" style={{ gap: 12, padding: '3px 0' }}>
    <span style={{ flex: '0 0 56px', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--f-mono)' }}>{k}</span>
    <span style={{ fontSize: 12.5, color: 'var(--text-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{v}</span>
  </div>;


const SmsPreview = ({ name }) =>
<div style={{ maxWidth: 320, margin: '0 auto' }}>
    <div className="label" style={{ marginBottom: 8 }}>SMS PREVIEW</div>
    <div style={{
    background: '#1e2330',
    borderRadius: 24,
    padding: '20px 18px',
    color: '#fff'
  }}>
      <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6, fontFamily: 'var(--f-mono)' }}>cue:creative · just now</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
        Hi {name} — it's cue:creative. Time to record your digital avatar (2 min). Tap to start:{' '}
        <span style={{ color: '#f0b226', textDecoration: 'underline' }}>cuecreative.com/r/9k4f2a</span>
      </div>
    </div>
  </div>;


/* ============================================================
 * Sent success state
 * ============================================================ */
const SentSuccess = ({ name, email, channel, onDone }) => {
  const firstName = name.split(' ')[0] || 'Client';
  return (
    <div className="fade-in" style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 'var(--pad)' }}>
      <div className="card" style={{ padding: 48, maxWidth: 520, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999,
          background: 'color-mix(in srgb, var(--ok) 15%, white)',
          display: 'grid', placeItems: 'center',
          margin: '0 auto 20px',
          color: 'var(--ok)'
        }}>
          <Icon name="check" size={28} stroke={2.5} />
        </div>
        <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 32, margin: '0 0 8px' }}>
          Invitation <em style={{ color: 'var(--maroon)' }}>delivered</em>.
        </h2>
        <p style={{ color: 'var(--text-3)', margin: '0 0 24px', fontSize: 14 }}>
          We've notified {firstName} via {channel.replace('+', ' + ')}. You'll get a webhook when they open the link.
        </p>
        <div style={{
          background: 'var(--surface-2)', padding: 16, borderRadius: 'var(--r-md)',
          textAlign: 'left', marginBottom: 24, fontFamily: 'var(--f-mono)', fontSize: 11.5
        }}>
          <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--text-3)' }}>TO       </span> {email || name}</div>
          <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--text-3)' }}>CHANNEL  </span> {channel}</div>
          <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--text-3)' }}>LINK_ID  </span> 9k4f2a-{Date.now().toString(36)}</div>
          <div><span style={{ color: 'var(--text-3)' }}>STATUS   </span> <span style={{ color: 'var(--ok)' }}>● queued for SMTP</span></div>
        </div>
        <button className="btn primary lg" onClick={onDone} style={{ justifyContent: 'center', width: '100%' }}>
          Back to invitations <Icon name="arrow-r" size={14} />
        </button>
      </div>
    </div>);

};

/* ============================================================
 * Client recipient preview — what the client sees end-to-end
 * (email in inbox → email open → recording landing page)
 * ============================================================ */
const ClientPreview = ({ invitationId, onClose }) => {
  const inv = INVITATIONS.find((i) => i.id === invitationId) || INVITATIONS[0];
  const [stage, setStage] = React.useState('inbox'); // inbox | email | landing

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* top bar */}
      <div className="row" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', gap: 16 }}>
        <button className="btn ghost" onClick={onClose}>
          <Icon name="arrow-l" size={13} /> Back
        </button>
        <div className="row" style={{ gap: 0, border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', padding: 2 }}>
          {[
          ['inbox', 'Inbox'],
          ['email', 'Email open'],
          ['landing', 'Landing page']].
          map(([k, label]) =>
          <button key={k} onClick={() => setStage(k)} className="btn sm"
          style={{
            background: stage === k ? 'var(--maroon)' : 'transparent',
            color: stage === k ? '#fff' : 'var(--text-2)',
            borderColor: 'transparent',
            boxShadow: 'none'
          }}>{label}</button>
          )}
        </div>
        <div className="hd-spacer" style={{ flex: 1 }} />
        <div className="mono">
          previewing as <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{inv.recipient.name}</strong>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', background: 'var(--surface-2)', padding: 24 }}>
        {stage === 'inbox' && <InboxView inv={inv} onOpen={() => setStage('email')} />}
        {stage === 'email' && <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <EmailPreview name={inv.recipient.name.split(' ')[0]} fullName={inv.recipient.name} note={inv.note} expiresDays={7} />
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="btn" onClick={() => setStage('landing')}>
              Simulate click <Icon name="arrow-r" size={13} />
            </button>
          </div>
        </div>}
        {stage === 'landing' && <LandingPage inv={inv} />}
      </div>
    </div>);

};

const InboxView = ({ inv, onOpen }) =>
<div style={{ maxWidth: 720, margin: '0 auto', background: 'var(--surface)', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-2)' }}>
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between' }}>
      <div className="row" style={{ gap: 8 }}>
        <Icon name="send" size={14} />
        <span style={{ fontWeight: 500 }}>Inbox</span>
        <span className="mono">3 new</span>
      </div>
      <span className="mono">{inv.recipient.email}</span>
    </div>
    {/* the cue:creative email — highlighted */}
    <div style={{
    padding: '16px 18px',
    borderBottom: '1px solid var(--border)',
    background: 'color-mix(in srgb, var(--maroon) 6%, white)',
    cursor: 'pointer',
    borderLeft: '3px solid var(--maroon)'
  }} onClick={onOpen}>
      <div className="row between" style={{ marginBottom: 4 }}>
        <div className="row" style={{ gap: 8 }}>
          <CueLogo size={22} />
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>cue:creative studio</span>
          <span className="mono">just now</span>
        </div>
        <Icon name="sparkle" size={14} style={{ color: 'var(--gold-2)' }} />
      </div>
      <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>
        Record your cue:creative avatar — about 2 minutes
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        Hi {inv.recipient.name.split(' ')[0]}, let's record your avatar — {inv.note.slice(0, 80)}…
      </div>
    </div>
    {/* decoy inbox rows */}
    {[
  { from: 'Halberd LP Relations', subj: 'Re: Q2 reporting cadence', when: '11 min ago' },
  { from: 'Bridgewell deal room', subj: 'Updated diligence schedule', when: '1 hr' },
  { from: 'Calendly', subj: 'New booking: Thurs 2:00 PM', when: '3 hr' }].
  map((r, i) =>
  <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', opacity: 0.55 }}>
        <div className="row between" style={{ marginBottom: 2 }}>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{r.from}</div>
          <span className="mono">{r.when}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{r.subj}</div>
      </div>
  )}
  </div>;


const LandingPage = ({ inv }) =>
<div style={{ maxWidth: 920, margin: '0 auto', background: '#fff', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-2)', minHeight: 600 }}>
    {/* browser chrome (light) */}
    <div style={{ background: 'var(--surface-2)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        <span style={{ width: 11, height: 11, borderRadius: 999, background: '#FF6058' }} />
        <span style={{ width: 11, height: 11, borderRadius: 999, background: '#FFBC2E' }} />
        <span style={{ width: 11, height: 11, borderRadius: 999, background: '#28C840' }} />
      </div>
      <div style={{
      flex: 1, background: 'var(--surface)', padding: '4px 10px', borderRadius: 4,
      fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-3)',
      textAlign: 'center'
    }}>
        🔒 cuecreative.com/r/9k4f2a · 🟢 secure · one-time link
      </div>
    </div>

    {/* wood strip */}
    <div className="wood" style={{ height: 6 }} />

    {/* header */}
    <div style={{ padding: '24px 48px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
      <CueLogo size={40} />
      <div>
        <div style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: 19, color: '#8b1f1f', lineHeight: 1 }}>cue:creative</div>
        <div style={{ fontSize: 10.5, color: '#6e6757', marginTop: 3 }}>marketing and advertising</div>
      </div>
      <div style={{ flex: 1 }} />
      <span className="mono">Hi, {inv.recipient.name}</span>
    </div>

    {/* hero */}
    <div style={{ padding: '64px 48px 32px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 48, alignItems: 'center' }}>
      <div>
        <div className="label" style={{ marginBottom: 12, color: '#8b1f1f' }}>RECORDING SESSION · 2 MIN</div>
        <h1 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 56, lineHeight: 1.05, margin: '0 0 16px', letterSpacing: '-0.015em', color: '#1e2330', textWrap: 'pretty' }}>
          {inv.recipient.name.split(' ')[0]}, ready to <em style={{ color: '#8b1f1f' }}>record</em> your digital twin?
        </h1>
        <p style={{ color: '#3b4e63', fontSize: 15.5, lineHeight: 1.6, maxWidth: 460, marginBottom: 28 }}>
          We'll capture two minutes of footage from your laptop camera. After you sign the consent, we'll train your avatar and send you a private link to use it.
        </p>
        <button style={{
        background: '#8b1f1f', color: '#fff',
        border: 0, padding: '14px 24px',
        borderRadius: 6,
        fontSize: 15, fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: 'DM Sans, sans-serif'
      }}>
          <Icon name="cam" size={15} />
          Start recording
        </button>
        <div style={{ fontSize: 11, color: '#6e6757', marginTop: 12, fontFamily: 'JetBrains Mono, monospace' }}>
          camera + microphone permission required · ≈ 2 min
        </div>
      </div>
      <div style={{ height: 280 }}>
        <EqualizerBars variant="hero" />
      </div>
    </div>

    {/* what to expect */}
    <div style={{ padding: '0 48px 48px' }}>
      <div className="hairline" style={{ background: '#e2dccb', marginBottom: 32 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        {[
      { n: '01', t: 'Record', d: '2 minutes of footage from your laptop. Even light, plain background.' },
      { n: '02', t: 'Consent', d: 'Sign the likeness release. HeyGen requires it.' },
      { n: '03', t: 'Train', d: 'About 24 hours for your twin to come online.' },
      { n: '04', t: 'Cast', d: 'Receive a private link from cue:creative when ready.' }].
      map((s, i) =>
      <div key={i}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#8b1f1f', marginBottom: 8, fontWeight: 500 }}>{s.n}</div>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22, color: '#1e2330', marginBottom: 6, fontStyle: 'italic' }}>{s.t}</div>
            <div style={{ fontSize: 12.5, color: '#6e6757', lineHeight: 1.5 }}>{s.d}</div>
          </div>
      )}
      </div>
    </div>
  </div>;



export { InvitationsView };