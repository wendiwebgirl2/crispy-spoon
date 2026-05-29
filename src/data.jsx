// components/data.jsx — seed data (clients, avatars, conversations, videos)

const CLIENTS = [
  { id: 'cl_1', companyName: 'Halberd Capital',     contact: 'Amelia Okonkwo',  role: 'Managing Partner',     email: 'amelia@halberd.cap' },
  { id: 'cl_2', companyName: 'North Field Realty',  contact: 'Diego Marín',     role: 'Founder',              email: 'diego@northfield.re' },
  { id: 'cl_3', companyName: 'Pellet Health',       contact: 'Dr. Saanvi Rao',  role: 'Chief Medical Officer', email: 'saanvi@pellethealth.com' },
  { id: 'cl_4', companyName: 'Brae Coaching',       contact: 'Jonah Brae',      role: 'Head Coach',           email: 'jonah@brae.co' },
  { id: 'cl_5', companyName: 'Lumen Estates',       contact: 'Mira Tan',        role: 'Principal Broker',     email: 'mira@lumenestates.com' },
  { id: 'cl_6', companyName: 'Vellum & Co.',        contact: 'Hugo Wendlandt',  role: 'CEO',                  email: 'hugo@vellumco.com' },
];

const AVATARS = [
  { id: 'av_amelia',  heygenId: 'dt_4Q9X2KpL',  clientId: 'cl_1', name: 'Amelia — Quarterly Brief',  status: 'ready',    progress: 100, createdAt: '2026-04-12', minutesUsed: 47, lastGen: '2d ago',  videosGenerated: 23, contact: 'Amelia Okonkwo', voice: 'en-US-amelia-v3', languages: ['EN','ES','FR'] },
  { id: 'av_diego',   heygenId: 'dt_8K1mPxQ7',  clientId: 'cl_2', name: 'Diego — Listing Walkthrough', status: 'ready',  progress: 100, createdAt: '2026-04-28', minutesUsed: 18, lastGen: '6h ago',  videosGenerated: 14, contact: 'Diego Marín', voice: 'en-US-diego-v2', languages: ['EN','ES'] },
  { id: 'av_saanvi',  heygenId: 'dt_2W7nRzY1',  clientId: 'cl_3', name: 'Dr. Rao — Patient Education', status: 'training', progress: 67, createdAt: '2026-05-22', minutesUsed: 0,  lastGen: '—',       videosGenerated: 0,  contact: 'Saanvi Rao', voice: 'en-US-saanvi-v1', languages: ['EN','HI'] },
  { id: 'av_jonah',   heygenId: 'dt_5H3kJfR9',  clientId: 'cl_4', name: 'Jonah — Daily Cue',           status: 'ready',    progress: 100, createdAt: '2026-03-08', minutesUsed: 64, lastGen: 'today',   videosGenerated: 41, contact: 'Jonah Brae', voice: 'en-US-jonah-v4', languages: ['EN'] },
  { id: 'av_mira',    heygenId: null,           clientId: 'cl_5', name: 'Mira — Open House Intro',     status: 'consent',  progress: 0,   createdAt: '2026-05-25', minutesUsed: 0,  lastGen: '—',       videosGenerated: 0,  contact: 'Mira Tan', voice: null, languages: [] },
  { id: 'av_hugo',    heygenId: 'dt_1B4xCvN8',  clientId: 'cl_6', name: 'Hugo — Founder Notes',        status: 'ready',    progress: 100, createdAt: '2026-02-14', minutesUsed: 92, lastGen: '4d ago',  videosGenerated: 67, contact: 'Hugo Wendlandt', voice: 'en-US-hugo-v2', languages: ['EN','DE'] },
];

// PAMW + social channels collected at invitation time — keyed by avatar id.
const BRIEFS = {
  av_amelia: {
    phone:   '+1 (415) 555-0142',
    address: '600 California St, Floor 12\nSan Francisco, CA 94108',
    mail:    'amelia@halberd.cap',
    website: 'halberd.cap',
    socials: {
      facebook:  { handle: '@halberdcapital', vaulted: true },
      instagram: { handle: '@halberd.capital', vaulted: false },
      youtube:   { handle: '@HalberdCapital', vaulted: true },
      podcast:   { handle: 'Halberd Brief · RSS', vaulted: true },
      website:   { handle: 'halberd.cap · WordPress', vaulted: true },
    },
    updatedAt: '2026-04-10',
  },
  av_diego: {
    phone:   '+1 (305) 555-0218',
    address: '1450 Brickell Ave, Suite 1900\nMiami, FL 33131',
    mail:    'diego@northfield.re',
    website: 'northfield.re',
    socials: {
      facebook:  { handle: '@northfieldrealty', vaulted: true },
      instagram: { handle: '@diego.sells.miami', vaulted: true },
      youtube:   { handle: '@NorthFieldWalks', vaulted: false },
      podcast:   { handle: '', vaulted: false },
      website:   { handle: 'northfield.re · Webflow', vaulted: true },
    },
    updatedAt: '2026-04-26',
  },
  av_jonah: {
    phone:   '+1 (646) 555-0901',
    address: '88 Bleecker St, Floor 3\nNew York, NY 10012',
    mail:    'jonah@brae.co',
    website: 'brae.co',
    socials: {
      facebook:  { handle: '', vaulted: false },
      instagram: { handle: '@brae.coaching', vaulted: true },
      youtube:   { handle: '@JonahBrae', vaulted: true },
      podcast:   { handle: 'The Daily Cue', vaulted: true },
      website:   { handle: 'brae.co · Ghost', vaulted: true },
    },
    updatedAt: '2026-03-06',
  },
  av_hugo: {
    phone:   '+49 30 1234 5678',
    address: 'Torstraße 142\n10119 Berlin, Germany',
    mail:    'hugo@vellumco.com',
    website: 'vellumco.com',
    socials: {
      facebook:  { handle: '', vaulted: false },
      instagram: { handle: '@vellum.co', vaulted: true },
      youtube:   { handle: '@VellumCo', vaulted: true },
      podcast:   { handle: 'Founder Notes', vaulted: true },
      website:   { handle: 'vellumco.com · custom', vaulted: false },
    },
    updatedAt: '2026-02-12',
  },
  av_saanvi: {
    phone:   '+1 (212) 555-0193',
    address: '350 Park Ave South, Floor 4\nNew York, NY 10010',
    mail:    'saanvi@pellethealth.com',
    website: 'pellethealth.com',
    socials: {
      facebook:  { handle: '@pellethealth', vaulted: false },
      instagram: { handle: '@pellet.health', vaulted: false },
      youtube:   { handle: '', vaulted: false },
      podcast:   { handle: '', vaulted: false },
      website:   { handle: 'pellethealth.com · WordPress', vaulted: true },
    },
    updatedAt: '2026-05-22',
  },
  av_mira: { phone: '', address: '', mail: '', website: '', socials: {}, updatedAt: null },
};

const briefFor = (avatar) => BRIEFS[avatar.id] || { phone: '', address: '', mail: '', website: '', socials: {}, updatedAt: null };

// Lookup helpers
const clientFor = (avatar) => CLIENTS.find(c => c.id === avatar.clientId);

// Sample chat — Amelia (the LLM responding *as* her digital twin)
const SAMPLE_CHAT = [
  { role: 'user', text: 'Hey Amelia — what should I tell the limited partners about Q2?' },
  { role: 'avatar', text: "Lead with conviction on the energy transition thesis. Q2 net IRR moved from 11.4 to 13.1, and the Halberd-V exits in March cleared at 2.3x — that's the headline. Frame the macro chop as a buying window, not a defensive posture.", videoLen: '0:24' },
  { role: 'user', text: 'Should I mention the Bridgewell deal?' },
  { role: 'avatar', text: "Mention it but don't pre-announce. Say we're in advanced diligence on a category-defining infra play — that's enough to set the table without tripping disclosure. I'll do a focused LP letter once we sign the term sheet.", videoLen: '0:19' },
];

const CONVERSATIONS = [
  { id: 'cv_1', avatarId: 'av_amelia', title: 'Q2 LP positioning',         updated: '2 hours ago', messages: 8 },
  { id: 'cv_2', avatarId: 'av_amelia', title: 'Bridgewell diligence memo', updated: 'yesterday',   messages: 14 },
  { id: 'cv_3', avatarId: 'av_jonah',  title: 'Tuesday cue — discipline',  updated: 'yesterday',   messages: 4 },
  { id: 'cv_4', avatarId: 'av_diego',  title: 'Cedar Ridge listing',       updated: '3 days ago',  messages: 22 },
  { id: 'cv_5', avatarId: 'av_hugo',   title: 'Q4 founder letter',         updated: '5 days ago',  messages: 11 },
];

const GENERATED_VIDEOS = [
  { id: 'gv_1', avatarId: 'av_jonah',  title: 'Tuesday cue — discipline over motivation', status: 'ready',      duration: '0:48', createdAt: '4h ago' },
  { id: 'gv_2', avatarId: 'av_amelia', title: 'LP update — Q2 positioning',                status: 'ready',      duration: '2:12', createdAt: 'today' },
  { id: 'gv_3', avatarId: 'av_diego',  title: 'Cedar Ridge — 412 sqft walkthrough',        status: 'rendering',  duration: '1:34', createdAt: 'just now', progress: 71 },
  { id: 'gv_4', avatarId: 'av_hugo',   title: 'Vellum FY26 strategy preview',              status: 'ready',      duration: '3:08', createdAt: '2d ago' },
  { id: 'gv_5', avatarId: 'av_jonah',  title: 'Habit stacking — week 14',                  status: 'ready',      duration: '1:02', createdAt: '2d ago' },
  { id: 'gv_6', avatarId: 'av_amelia', title: 'Bridgewell — initial LP teaser',            status: 'queued',     duration: '—',    createdAt: 'just now' },
];

/* —— INVITATIONS ——
 * An "invitation" is the notification sent to a client asking them to record
 * footage for their digital twin. Each carries a timeline of timestamped
 * events that track the client's progress from notification → ready.
 *
 * status flow: sent → opened → started → recording → submitted → consented → training → completed
 * (or branches: expired, bounced, declined)
 */
const INVITATIONS = [
  {
    id: 'inv_amelia',
    recipient: { name: 'Amelia Okonkwo', email: 'amelia@halberd.cap', company: 'Halberd Capital', phone: '+1 (415) 555-0142' },
    channel: 'email',
    status: 'completed',
    sentAt: '2026-04-10 09:14',
    expiresAt: '2026-04-17',
    avatarId: 'av_amelia',
    sender: 'Studio admin',
    note: "Hi Amelia — we're ready to set up your digital twin for the Q2 LP cycle. The recording takes 2 minutes; you can do it from your laptop.",
    timeline: [
      { event: 'sent',       at: '2026-04-10 09:14', channel: 'email', detail: 'amelia@halberd.cap' },
      { event: 'delivered',  at: '2026-04-10 09:14', detail: 'SMTP 250' },
      { event: 'opened',     at: '2026-04-10 11:02', detail: 'macOS · Apple Mail' },
      { event: 'clicked',    at: '2026-04-10 11:02' },
      { event: 'started',    at: '2026-04-10 11:03', detail: 'permissions granted' },
      { event: 'submitted',  at: '2026-04-10 11:07', detail: '01:58 footage' },
      { event: 'consented',  at: '2026-04-10 11:08', detail: 'signed: Amelia Okonkwo' },
      { event: 'training',   at: '2026-04-10 11:09' },
      { event: 'completed',  at: '2026-04-12 06:42' },
    ],
  },
  {
    id: 'inv_saanvi',
    recipient: { name: 'Dr. Saanvi Rao', email: 'saanvi@pellethealth.com', company: 'Pellet Health', phone: '+1 (212) 555-0193' },
    channel: 'email',
    status: 'training',
    sentAt: '2026-05-20 14:30',
    expiresAt: '2026-05-27',
    avatarId: 'av_saanvi',
    sender: 'Studio admin',
    note: "Dr. Rao — looking forward to building your patient-education avatar. Recording takes 2 minutes; quiet room with even light works best.",
    timeline: [
      { event: 'sent',       at: '2026-05-20 14:30', channel: 'email', detail: 'saanvi@pellethealth.com' },
      { event: 'delivered',  at: '2026-05-20 14:30', detail: 'SMTP 250' },
      { event: 'opened',     at: '2026-05-21 08:18', detail: 'iOS · Mail' },
      { event: 'opened',     at: '2026-05-22 09:42', detail: 'macOS · Chrome' },
      { event: 'clicked',    at: '2026-05-22 09:43' },
      { event: 'started',    at: '2026-05-22 09:44' },
      { event: 'submitted',  at: '2026-05-22 09:51', detail: '02:14 footage' },
      { event: 'consented',  at: '2026-05-22 09:53', detail: 'signed: Saanvi Rao, MD' },
      { event: 'training',   at: '2026-05-22 09:54', detail: '67% complete' },
    ],
  },
  {
    id: 'inv_mira',
    recipient: { name: 'Mira Tan', email: 'mira@lumenestates.com', company: 'Lumen Estates', phone: '+1 (305) 555-0218' },
    channel: 'email+sms',
    status: 'opened',
    sentAt: '2026-05-25 10:00',
    expiresAt: '2026-06-01',
    avatarId: 'av_mira',
    sender: 'Studio admin',
    note: "Mira — quick one. Open House season is coming. Let's get your digital twin set up so we can produce listing intros at scale.",
    timeline: [
      { event: 'sent',       at: '2026-05-25 10:00', channel: 'email', detail: 'mira@lumenestates.com' },
      { event: 'sent',       at: '2026-05-25 10:00', channel: 'sms',   detail: '+1 (305) ••• 0218' },
      { event: 'delivered',  at: '2026-05-25 10:00' },
      { event: 'opened',     at: '2026-05-26 17:32', detail: 'iOS · Mail' },
    ],
  },
  {
    id: 'inv_priya',
    recipient: { name: 'Priya Naidu', email: 'priya@orchidlabs.bio', company: 'Orchid Labs', phone: '+1 (617) 555-0337' },
    channel: 'email',
    status: 'sent',
    sentAt: '2026-05-26 16:45',
    expiresAt: '2026-06-02',
    avatarId: null,
    sender: 'Studio admin',
    note: "Hi Priya — kicking off the Orchid Labs avatar program. Recording your twin is the first step. Two minutes, your laptop.",
    timeline: [
      { event: 'sent',       at: '2026-05-26 16:45', channel: 'email', detail: 'priya@orchidlabs.bio' },
      { event: 'delivered',  at: '2026-05-26 16:45', detail: 'SMTP 250' },
    ],
  },
  {
    id: 'inv_kwame',
    recipient: { name: 'Kwame Adusei', email: 'kwame@cascade.fin', company: 'Cascade Finance', phone: '+44 20 7946 0023' },
    channel: 'email',
    status: 'expired',
    sentAt: '2026-05-12 11:00',
    expiresAt: '2026-05-19',
    avatarId: null,
    sender: 'Studio admin',
    note: "Kwame — re-sending. We have a slot next week for the FY26 LP video. Two minutes of footage.",
    timeline: [
      { event: 'sent',       at: '2026-05-12 11:00', channel: 'email', detail: 'kwame@cascade.fin' },
      { event: 'delivered',  at: '2026-05-12 11:00' },
      { event: 'opened',     at: '2026-05-13 07:30', detail: 'macOS · Outlook' },
      { event: 'expired',    at: '2026-05-19 11:00' },
    ],
  },
  {
    id: 'inv_lila',
    recipient: { name: 'Lila Marchetti', email: 'lila@notedwell.co', company: 'Notedwell', phone: '+1 (646) 555-0419' },
    channel: 'email',
    status: 'bounced',
    sentAt: '2026-05-26 09:20',
    expiresAt: '2026-06-02',
    avatarId: null,
    sender: 'Studio admin',
    note: "Lila — let's set up your avatar before the next product launch.",
    timeline: [
      { event: 'sent',     at: '2026-05-26 09:20', channel: 'email', detail: 'lila@notedwell.co' },
      { event: 'bounced',  at: '2026-05-26 09:20', detail: '550 5.1.1 mailbox unavailable' },
    ],
  },
];

// status → label/color
const INV_STATUS = {
  sent:       { label: 'Sent',       tone: 'neutral', step: 1 },
  opened:     { label: 'Opened',     tone: 'info',    step: 2 },
  started:    { label: 'Started',    tone: 'info',    step: 3 },
  recording:  { label: 'Recording',  tone: 'info',    step: 4 },
  submitted:  { label: 'Submitted',  tone: 'warn',    step: 5 },
  consented:  { label: 'Consented',  tone: 'warn',    step: 6 },
  training:   { label: 'Training',   tone: 'training',step: 7 },
  completed:  { label: 'Completed',  tone: 'ok',      step: 8 },
  expired:    { label: 'Expired',    tone: 'err',     step: 0 },
  bounced:    { label: 'Bounced',    tone: 'err',     step: 0 },
  declined:   { label: 'Declined',   tone: 'err',     step: 0 },
};


export {
  CLIENTS,
  AVATARS,
  clientFor,
  SAMPLE_CHAT,
  CONVERSATIONS,
  GENERATED_VIDEOS,
  INVITATIONS,
  INV_STATUS,
  BRIEFS,
  briefFor
};