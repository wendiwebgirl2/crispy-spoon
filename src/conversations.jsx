// components/conversations.jsx — Avatar-forward LLM chat

import React from 'react'
import { AvatarTile, Icon, EqualizerBars } from './shared.jsx'
import { AVATARS, CONVERSATIONS, SAMPLE_CHAT, clientFor, briefFor } from './data.jsx'

const ConversationsView = ({ initialAvatarId }) => {
  const [activeAvatarId, setActiveAvatarId] = React.useState(initialAvatarId || 'av_amelia');
  const [activeConv, setActiveConv] = React.useState('cv_1');
  const [messages, setMessages] = React.useState(SAMPLE_CHAT);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);

  React.useEffect(() => {
    // Reset chat to the canonical sample for Amelia; otherwise show a starter.
    if (activeAvatarId === 'av_amelia') {
      setMessages(SAMPLE_CHAT);
    } else {
      const av = AVATARS.find(a => a.id === activeAvatarId);
      setMessages([{ role: 'system', text: `New conversation with ${av?.contact || 'avatar'}. Type a prompt to begin.` }]);
    }
  }, [activeAvatarId]);

  const avatar = AVATARS.find(a => a.id === activeAvatarId);
  const readyAvatars = AVATARS.filter(a => a.status === 'ready');

  const send = () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', text: input };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setSending(true);
    setTimeout(() => {
      const reply = {
        role: 'avatar',
        text: generateReply(input, avatar),
        videoLen: `0:${15 + Math.floor(Math.random() * 20)}`
      };
      setMessages(m => [...m, reply]);
      setSending(false);
      setSpeaking(true);
      setTimeout(() => setSpeaking(false), 2400);
    }, 1100);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const transcriptRef = React.useRef(null);
  React.useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, sending]);

  return (
    <div className="fade-in" style={{
      display: 'grid',
      gridTemplateColumns: '260px 1.6fr 1fr',
      height: '100%',
      minHeight: 0
    }}>
      {/* —— left rail: avatar picker + conversation history —— */}
      <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '16px 16px 8px' }}>
          <div className="label" style={{ marginBottom: 10 }}>AVATAR</div>
          <div className="col" style={{ gap: 4 }}>
            {readyAvatars.map(av => (
              <button key={av.id}
                onClick={() => setActiveAvatarId(av.id)}
                className="row"
                style={{
                  padding: 8,
                  borderRadius: 'var(--r-sm)',
                  background: activeAvatarId === av.id ? 'var(--surface-2)' : 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  color: 'inherit'
                }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0 }}>
                  <AvatarTile avatar={av} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: activeAvatarId === av.id ? 'var(--text)' : 'var(--text-2)' }}>
                    {av.contact}
                  </div>
                  <div className="mono" style={{ fontSize: 10 }}>{clientFor(av).companyName}</div>
                </div>
                {activeAvatarId === av.id && <span style={{ width: 4, height: 16, background: 'var(--accent)', borderRadius: 2 }} />}
              </button>
            ))}
          </div>
        </div>

        <div className="hairline" style={{ margin: '12px 0' }} />

        <div style={{ padding: '0 16px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="label">CONVERSATIONS</div>
            <button className="icon-btn" style={{ width: 22, height: 22 }} title="New conversation">
              <Icon name="plus" size={12} />
            </button>
          </div>
        </div>

        <div style={{ padding: '0 8px', overflow: 'auto', flex: 1, minHeight: 0 }}>
          {CONVERSATIONS.filter(c => c.avatarId === activeAvatarId).map(c => (
            <button key={c.id}
              onClick={() => setActiveConv(c.id)}
              className="col"
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--r-sm)',
                background: activeConv === c.id ? 'var(--surface)' : 'transparent',
                border: 0,
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                color: 'inherit',
                gap: 4,
                marginBottom: 2
              }}>
              <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                {c.title}
              </div>
              <div className="mono">{c.updated} · {c.messages} msgs</div>
            </button>
          ))}
        </div>
      </div>

      {/* —— center: avatar video + transcript —— */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--border)' }}>
        {/* avatar tile */}
        <div style={{ padding: 'var(--pad)', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            aspectRatio: '16/9',
            borderRadius: 'var(--r-md)',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid var(--border)'
          }}>
            <AvatarTile avatar={avatar} playing={speaking} />

            {/* overlay: name + status */}
            <div style={{
              position: 'absolute', left: 16, bottom: 16,
              display: 'flex', flexDirection: 'column', gap: 4
            }}>
              <div style={{
                fontFamily: 'var(--f-display)',
                fontSize: 26, lineHeight: 1,
                color: '#fff', letterSpacing: '-0.01em',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)'
              }}>{avatar.contact}</div>
              <div className="mono" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {clientFor(avatar).companyName} · {clientFor(avatar).role}
              </div>
            </div>

            {/* speaking indicator — brand equalizer bars */}
            {speaking && (
              <div style={{
                position: 'absolute', right: 20, bottom: 20,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 8,
                backdropFilter: 'blur(8px)'
              }}>
                <EqualizerBars live={true} count={10} style={{ height: 22 }} />
              </div>
            )}

            {sending && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(30,35,48,0.4)', backdropFilter: 'blur(2px)' }}>
                <div className="row" style={{ background: 'rgba(30,35,48,0.8)', padding: '8px 14px', borderRadius: 999, color: '#f0b226', fontFamily: 'var(--f-mono)', fontSize: 11 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: 999,
                    border: '1.5px solid #f0b226', borderRightColor: 'transparent',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  rendering response
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* transcript */}
        <div ref={transcriptRef} style={{ flex: 1, overflow: 'auto', padding: 'var(--pad)' }}>
          <div className="col" style={{ gap: 18 }}>
            {messages.map((m, i) => (
              <Message key={i} message={m} avatar={avatar} />
            ))}
            {sending && (
              <div className="row" style={{ gap: 10, color: 'var(--text-3)' }}>
                <div style={{ width: 24, height: 24, borderRadius: 999, overflow: 'hidden' }}>
                  <AvatarTile avatar={avatar} />
                </div>
                <div className="mono">{avatar.contact.split(' ')[0]} is composing…</div>
              </div>
            )}
          </div>
        </div>

        {/* composer */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface)',
            padding: 10,
            transition: 'border-color 120ms'
          }}>
            <button className="icon-btn" title="Voice input"><Icon name="mic" size={16} /></button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder={`Message ${avatar.contact.split(' ')[0]}…`}
              style={{
                flex: 1, background: 'transparent', border: 0, color: 'var(--text)',
                outline: 'none', font: 'inherit', resize: 'none', padding: '4px 0',
                maxHeight: 120
              }}
            />
            <button className={input.trim() ? 'btn primary sm' : 'btn sm'} onClick={send} disabled={!input.trim()}>
              <Icon name="send" size={12} />
              Send
            </button>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <div className="mono">
              Powered by <span style={{ color: 'var(--text-2)' }}>Claude Haiku 4.5</span> · grounded in {avatar.contact}'s memos &amp; transcripts
            </div>
            <div className="mono">⌘↵ to send</div>
          </div>
        </div>
      </div>

      {/* —— right: context panel —— */}
      <div style={{ padding: 'var(--pad)', overflow: 'auto' }}>
        <div className="label" style={{ marginBottom: 16 }}>AVATAR CONTEXT</div>

        <div className="col" style={{ gap: 16, marginBottom: 24 }}>
          <KV k="HeyGen ID" v={<span className="mono" style={{ color: 'var(--text-2)' }}>{avatar.heygenId}</span>} />
          <KV k="Voice model" v={<span className="mono" style={{ color: 'var(--text-2)' }}>{avatar.voice}</span>} />
          <KV k="Languages" v={
            <div className="row" style={{ gap: 4 }}>
              {avatar.languages.map(l => <span key={l} className="badge" style={{ fontSize: 10, padding: '1px 6px' }}>{l}</span>)}
            </div>
          } />
          <KV k="Videos generated" v={<span>{avatar.videosGenerated}</span>} />
        </div>

        <BriefPanel avatar={avatar} />

        <div className="label" style={{ marginBottom: 12 }}>KNOWLEDGE BASE</div>
        <div className="col" style={{ gap: 8, marginBottom: 24 }}>
          {[
            { name: 'Q1 LP letter — clean.pdf',     size: '142 KB' },
            { name: 'Investment thesis v3.docx',    size: '88 KB' },
            { name: 'Bridgewell diligence notes',   size: '12 messages' },
            { name: 'Brand voice — sample memos',   size: '14 files' },
          ].map((f, i) => (
            <div key={i} className="row" style={{
              padding: 10,
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              background: 'var(--surface)'
            }}>
              <Icon name="doc" size={14} style={{ color: 'var(--text-3)' }} />
              <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
              <span className="mono">{f.size}</span>
            </div>
          ))}
          <button className="btn sm" style={{ justifyContent: 'center', borderStyle: 'dashed' }}>
            <Icon name="plus" size={11} /> Add source
          </button>
        </div>

        <div className="label" style={{ marginBottom: 12 }}>QUICK ACTIONS</div>
        <div className="col" style={{ gap: 6 }}>
          <QuickAction icon="studio"  label="Render last reply as video" />
          <QuickAction icon="lang"    label="Translate to Spanish" />
          <QuickAction icon="download" label="Export transcript" />
        </div>
      </div>
    </div>
  );
};

const KV = ({ k, v }) => (
  <div className="row" style={{ justifyContent: 'space-between', gap: 16 }}>
    <span className="label">{k}</span>
    <span style={{ fontSize: 12.5 }}>{v}</span>
  </div>
);

const QuickAction = ({ icon, label }) => (
  <button className="row" style={{
    padding: 10, borderRadius: 'var(--r-sm)',
    border: '1px solid var(--border)', background: 'var(--surface)',
    cursor: 'pointer', color: 'var(--text-2)', textAlign: 'left'
  }}>
    <Icon name={icon} size={14} />
    <span style={{ flex: 1, fontSize: 12.5 }}>{label}</span>
    <Icon name="arrow-r" size={12} />
  </button>
);

const Message = ({ message, avatar }) => {
  if (message.role === 'system') {
    return <div className="mono" style={{ textAlign: 'center', color: 'var(--text-4)', padding: '12px 0' }}>{message.text}</div>;
  }
  const isUser = message.role === 'user';
  return (
    <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 28, height: 28, borderRadius: 999, overflow: 'hidden', flexShrink: 0, marginTop: 2 }}>
        {isUser ? (
          <div style={{ width: '100%', height: '100%', background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-2)' }}>You</div>
        ) : (
          <AvatarTile avatar={avatar} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{isUser ? 'You' : avatar.contact}</span>
          {!isUser && message.videoLen && (
            <span className="mono" style={{ color: 'var(--maroon)' }}>● video · {message.videoLen}</span>
          )}
        </div>
        <div style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: isUser ? 'var(--text-2)' : 'var(--text)',
          maxWidth: 620,
          textWrap: 'pretty'
        }}>{message.text}</div>
      </div>
    </div>
  );
};

// extremely cheap simulated reply generator
function generateReply(prompt, avatar) {
  const name = avatar.contact.split(' ')[0];
  const flavor = {
    'av_amelia':  `Frame it through the thesis. ${name}'s lens: capital discipline, energy transition, conviction trades. The LP audience wants two-line clarity, not narrative.`,
    'av_diego':   `Lead with the room they'd live in, not the square footage. End with a hook for the open house Saturday.`,
    'av_jonah':   `Strip it down. One belief, one obstacle, one rep. That's the whole cue — don't pad it.`,
    'av_hugo':    `Be candid about the trade-off. Vellum's voice is "say the hard part out loud," then offer the path.`,
  }[avatar.id] || `I'd respond directly to that.`;
  return `${flavor} Want me to render it as a 30-second clip or hand it back as a script?`;
}

/* ============================================================
 * Brief panel — shows the PAMW info and social channels captured
 * at invitation time. Collapsible to keep the context rail tidy.
 * ============================================================ */
const BriefPanel = ({ avatar }) => {
  const brief = briefFor(avatar);
  const [open, setOpen] = React.useState(true);
  const pamFilled = ['phone','address','mail','website'].filter(k => brief[k]).length;
  const socials = Object.entries(brief.socials || {});
  const socialFilled = socials.filter(([_, d]) => d.handle).length;
  const empty = pamFilled === 0 && socialFilled === 0;

  const SOC = {
    facebook:  { mono: 'FB', color: '#1877F2', label: 'Facebook' },
    instagram: { mono: 'IG', color: '#E1306C', label: 'Instagram' },
    youtube:   { mono: 'YT', color: '#FF0000', label: 'YouTube' },
    podcast:   { mono: 'PC', color: '#8B1F1F', label: 'Podcast' },
    website:   { mono: 'WB', color: '#3B4E63', label: 'Website / Blog' },
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="row between" style={{ marginBottom: 12, alignItems: 'baseline' }}>
        <div className="label">CLIENT BRIEF</div>
        <button
          onClick={() => setOpen(o => !o)}
          className="icon-btn"
          style={{ width: 22, height: 22 }}
          title={open ? 'Collapse' : 'Expand'}
        >
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{open ? '▾' : '▸'}</span>
        </button>
      </div>

      {open && empty && (
        <div style={{
          padding: 16,
          border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--r-sm)',
          textAlign: 'center'
        }}>
          <div style={{ fontFamily: 'var(--f-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--text-3)', marginBottom: 4 }}>
            no brief on file
          </div>
          <div className="mono" style={{ color: 'var(--text-4)', marginBottom: 10 }}>
            collect PAMW + channels from {avatar.contact.split(' ')[0]}
          </div>
          <button className="btn sm" style={{ justifyContent: 'center' }}>
            <Icon name="plus" size={11} /> Add brief
          </button>
        </div>
      )}

      {open && !empty && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* PAMW row */}
          {pamFilled > 0 && (
            <div style={{ padding: 14, borderBottom: socialFilled ? '1px solid var(--border)' : 0 }}>
              <div className="row between" style={{ marginBottom: 10, alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--maroon)' }}>P · A · M · W</span>
                <span className="mono">{pamFilled}/4</span>
              </div>
              <div className="col" style={{ gap: 8 }}>
                {[
                  ['P', 'Phone',   brief.phone,   { mono: true }],
                  ['A', 'Address', brief.address, { multiline: true }],
                  ['M', 'Mail',    brief.mail,    { mono: true }],
                  ['W', 'Website', brief.website, { mono: true, link: true }],
                ].map(([letter, label, value, opts]) => value && (
                  <BriefLine key={letter} letter={letter} label={label} value={value} {...opts} />
                ))}
              </div>
            </div>
          )}

          {/* socials row */}
          {socialFilled > 0 && (
            <div style={{ padding: 14 }}>
              <div className="row between" style={{ marginBottom: 10, alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--maroon)' }}>CHANNELS</span>
                <span className="mono">{socialFilled} active</span>
              </div>
              <div className="col" style={{ gap: 6 }}>
                {socials.map(([key, d]) => {
                  if (!d.handle) return null;
                  const m = SOC[key];
                  return (
                    <div key={key} className="row" style={{ gap: 8, fontSize: 12 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 4,
                        background: m.color, color: '#fff',
                        display: 'grid', placeItems: 'center',
                        fontFamily: 'var(--f-mono)', fontSize: 9, fontWeight: 600,
                        flexShrink: 0
                      }}>{m.mono}</div>
                      <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.handle}
                      </div>
                      {d.vaulted && (
                        <span title="credentials vaulted" style={{
                          color: 'var(--ok)',
                          display: 'inline-flex', alignItems: 'center',
                          flexShrink: 0
                        }}>
                          <Icon name="shield" size={11} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* footer */}
          <div style={{
            padding: '8px 14px',
            background: 'var(--surface-2)',
            borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span className="mono" style={{ color: 'var(--text-4)' }}>
              updated {brief.updatedAt || '—'}
            </span>
            <button className="btn ghost" style={{ height: 24, padding: '0 8px', fontSize: 11 }}>
              <Icon name="settings" size={10} /> Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const BriefLine = ({ letter, label, value, mono, multiline, link }) => (
  <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
    <div style={{
      width: 18, height: 18, flexShrink: 0,
      borderRadius: 3,
      background: 'color-mix(in srgb, var(--maroon) 8%, white)',
      border: '1px solid color-mix(in srgb, var(--maroon) 25%, transparent)',
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--f-display)', fontSize: 11, fontStyle: 'italic',
      color: 'var(--maroon)', lineHeight: 1,
      marginTop: 2
    }}>{letter}</div>
    <div style={{ flex: '0 0 54px', fontSize: 10.5, color: 'var(--text-3)', paddingTop: 3 }}>{label}</div>
    <div style={{
      flex: 1, minWidth: 0,
      fontFamily: mono ? 'var(--f-mono)' : 'var(--f-sans)',
      fontSize: mono ? 11 : 12,
      color: link ? 'var(--maroon)' : 'var(--text-2)',
      whiteSpace: multiline ? 'pre-wrap' : 'normal',
      lineHeight: 1.45
    }}>
      {value}
    </div>
  </div>
);


export { ConversationsView };