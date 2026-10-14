# cue:cast — Your Client Portal

**Use:** sent with the portal welcome email · embedded on the portal login page
**Runtime:** ~1:02 · **VO:** ~155 words at ~150 wpm
**Audience:** the client, on their phone, the first time they log in
**Scope:** client portal only. Only features confirmed shipped **and** deployed as of
2026-09-18 — see `00-verification-and-flags.md`

**Brand:** brick red `#9c1b1f` · wood `#3a2114` · Helvetica Neue · lockup `cue:cast`
**Tone:** warm, second person, no jargon. Never say "cast," "render," "twin," or "stitch."

---

| # | Time | Visual | Voiceover |
|---|---|---|---|
| 1 | 0:00–0:08 | Portal login on a phone, held in hand. Logging in. The portal menu slides in. Brick-red lower-third: YOUR PORTAL. | This is your cue:cast portal. Everything we're making for you lives here, and it works on your phone. |
| 2 | 0:08–0:22 | Needs Approval. A script card and a video card. Tap Approve on one. Tap Request changes on the other, type a short note, send. | **Needs Approval** is the only page you have to visit. Anything waiting on you shows up here. Read it, then approve it — or tap Request changes and tell us what to fix in your own words. That note comes straight to us. |
| 3 | 0:22–0:34 | In Production list, then Past Episodes — tap play on a finished episode, then the download button. | **In Production** shows what you've approved and we're building now. **Past Episodes** is everything finished — play it right here, or download it to use anywhere you like. |
| 4 | 0:34–0:44 | Avatars: the avatar identity with its thumbnail, tap "Change look," pick a different look. Then Topic Suggestions — type an idea, tap Add. | **Avatars** is where you see yourself — and switch which look we film you in. And under **Topic Suggestions**, drop in any idea you want us to cover. It goes straight into our planning. |
| 5 | 0:44–0:54 | Onboarding: the five-step checklist, contact details, accounts list. *(Hold the YouTube beat — see note.)* | **Onboarding** keeps your details and your accounts in one place. Fill in what you can, and the checklist tracks what's left. Your passwords are stored encrypted — even we can't read them back. |
| 6 | 0:54–1:02 | Agreement page, then Account with the question form. End on a wood card, brick-red rule, `cue:cast` over `cue:creative`. | Your signed agreement is under **Agreement**, and if you ever need us, there's a question form on **Account**. That's it. We'll take it from here. |

---

## ⚠️ HOLD — scene 5, the YouTube beat

The portal's **Connect YouTube** button and its live connected status are deployed and
visible. But the connection itself has **never been tested end to end against the live
Upload-Post API** — that single test is the one outstanding item on the 2026-09-18 handoff,
and the field name the API expects is still unconfirmed.

**Do not film or voice the YouTube connect step until that test passes.** Scene 5 as
written above deliberately leaves it out, so the script is shootable today as-is.

Once the live test passes, extend scene 5 by ~4 seconds (runtime goes to ~1:06) and use:

> …Fill in what you can, and the checklist tracks what's left. There's a one-tap button to
> connect your YouTube channel, so we can publish for you. And your passwords are stored
> encrypted — even we can't read them back.

Visual for the added beat: tap **Connect YouTube**, cut to the status flipping to connected.

---

## Production notes

- **Shoot vertical or in a phone frame.** Clients open this on a phone; the portal stacks
  to a single scrolling column below 720px. A desktop recording undersells it.
- **Demo client account only.** Never show a real client's contact details, account list,
  agreement, or approval history.
- **Scene 2 carries the video.** If a client only watches eight seconds, they should come
  away knowing Needs Approval is the page that matters.
- **Don't promise turnaround times or publishing schedules in VO** — none of that is set in
  the product.
- **Update the portal's own Help page before this ships.** It currently lists six sections;
  the menu has nine, and **Onboarding** and **Agreement** — both covered in this video — are
  missing from the help copy. A client who follows the video and then opens Help will find
  it contradicts what they just watched.
