# cue:cast video scripts — verification basis & flags

**Written:** 2026-09-30 · **Covers:** everything confirmed shipped *and* deployed as of the
2026-09-18 deploy.

---

## 1. What "deployed" means here, and how it was verified

The dashboard is a **prebuilt bundle committed into `voicecast/public/assets/`** — pushing
crispy-spoon source alone does not change what the server serves. So "deployed" was checked
at the bundle level, not the commit level:

| Check | Result |
|---|---|
| crispy-spoon (`cue-caster`) `main` vs `origin/main` | in sync — `24a3c22` |
| voicecast `main` vs `origin/main` | in sync — `84c7fd0` ("Rebuild dashboard bundle: portal onboarding, YouTube connect, approval method") |
| cue-caster-api `main` vs `origin/main` | in sync — `698f849` (Railway auto-deploys on push) |
| `crispy-spoon/dist/index.html` vs `voicecast/public/index.html` | identical — both reference `index-BvClIuQj.js` / `index-CJVq5-oN.css` |
| Bundle bytes: `dist/assets/index-BvClIuQj.js` vs `public/assets/index-BvClIuQj.js` | identical SHA-1 `6f46b659…` |

Corroborated by the handoff docs: the **2026-09-17** handoff records "all three repos'
`main` branches are deployed — voicecast VPS confirmed `active`, Railway confirmed live,
dashboard bundle confirmed serving the matching hash. No open deploy gaps." The
**2026-09-18** handoff (Parts 1 and 2) records both as deployed with the UI confirmed
visible live.

Everything in the three scripts was additionally read out of the live source
(`src/App.jsx`, `studio.jsx`, `episodes.jsx`, `scripts.jsx`, `brief.jsx`, `portal.jsx`,
`planner.jsx`, `invitations.jsx`, `settings.jsx`, `report.jsx`, `billing.jsx`,
`task-status.jsx`, plus `voicecast/src/routes` and `src/lib`) — not from the docs alone.

---

## 2. ⚠️ Flags — cannot confirm shipped + deployed, deliberately kept OUT of the voiceover

| # | Item | Status | Where it's referenced |
|---|---|---|---|
| 1 | **Transistor podcast publishing** | Code is live (`lib/transistor.js`, `publishTransistor`, `podcastFeed.js`, Planner "Transistor (podcast)" channel). But `CUECAST-START-HERE.md` §6 states Slice 9 is "code pushed but **NOT server-configured** — needs `TRANSISTOR_API_KEY` + per-client show IDs," and no later handoff records it being configured. **Server env not verifiable from here.** | Podcast publishing is described generically ("your podcast host") — Transistor is never named on screen or in VO. |
| 2 | **YouTube connect via Upload-Post** | Deployed, UI confirmed visible. But the 09-18 handoff states it is **UNVERIFIED against the live API** — Upload-Post's docs disagree on the generate-JWT field name, and the only outstanding item is "one real end-to-end connect test." | Kept in the full walkthrough. Marked **HOLD** in the client-facing script — see script 3, scene 5. Run the live test before that video ships. |
| 3 | **Volume boost** (audio `+dB` dropdown, "Boost +6dB" cast download) | **Built, then deliberately commented out** (`studio.jsx:1055`, `:1395`) because an episode mixing an ElevenLabs intro with a HeyGen body ends up boosted on one part only. Routes still exist. | Excluded entirely. |
| 4 | **Approval method on the Studio cast card** | Stored in the DB, shown on scripts history and the episode header — **not yet rendered on the cast card**. | VO says "scripts and episodes," never "everywhere." |
| 5 | **Voice-only invites → casting in the client's own voice** | The `Voice only` invite mode records and uploads fine, but the downstream ElevenLabs clone path is **parked and unfinished** (the take uploads as `audio/webm`, untested against ElevenLabs' container rules). | Excluded. The walkthrough says the client records once on camera. |
| 6 | **`eleven_v3` auto-routing + new voice settings** | Deployed, but **never exercised against the live ElevenLabs API** (no key in either build environment, carried open from 09-10 through 09-17). | Expression tags are described as an authoring control, not as a guaranteed audio outcome. |
| 7 | **Manager/editor self-scoping on Task Status** | Shipped, but **never verified with a real non-admin login** (carried open from 09-10). | Roles are mentioned; per-role scoping claims are not. |
| 8 | **Slice 6** — episodes multi-delete + captions burned from script text | **Not built.** | Excluded. |
| 9 | **Fish inline-expression for HeyGen video casts** | Proposal doc only (`cuecast-scope-fish-inline-expression.md`). **Not built.** | Excluded. |
| 10 | **Staff view of what a client changed in the portal** | Listed as "not built (ideas)" in the 09-18 handoff. | Excluded. |

---

## 3. Two things worth fixing before these videos are recorded

1. **`voicecast/docs/cuecast-handoff-2026-09-18.md` has an uncommitted working-copy edit.**
   That edit is what flips Part 2's status line from "BUILT + tested locally, NOT yet
   committed/deployed" to "committed … and deployed; UI confirmed visible" — and it is the
   basis on which portal Onboarding, YouTube connect and the approval-method modal are
   treated as live in these scripts. The code and bundle independently confirm it, but the
   doc itself should be committed so the record isn't ambiguous.

2. **The client portal's own Help page is stale.** `portal.jsx` `Help()` lists six sections
   (Needs Approval, In Production, Past Episodes, Avatars, Topic Suggestions, Account) but
   the menu now has nine — **Onboarding** and **Agreement** are missing from the help copy.
   Script 3 walks a client through Onboarding, so the Help page should be updated to match
   or it will read as out of date to anyone who follows the video.

3. **`docs/cuecast-overview-and-stack.md` is significantly stale** (last updated
   2026-07-21) and its "Known blockers" list predates the users/roles system, the client
   portal, Task Status, the Invitations page and avatar looks. It was **not** used as a
   source of truth here — flagged so it isn't mistaken for current.

---

## 4. Brand spec (all three scripts)

| Token | Value | Use |
|---|---|---|
| Brick red | `#9c1b1f` | Primary accent — lower-thirds, key words, button highlights, end card |
| Wood | `#3a2114` | Backgrounds, title cards, letterbox bars |
| Type | **Helvetica Neue** | Medium for titles, Light for body/lower-thirds, all-caps + letterspacing for labels |
| Lockup | `cue:creative` / `cue:cast` | Always lowercase, colon, no space — in prose and on screen |

Screen recordings: 1920×1080, browser chrome cropped, cursor highlight on, dashboard at
100% zoom. Never show a real client's contact details, credentials, or approval email
addresses — use a demo client throughout.
