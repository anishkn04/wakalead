# FUT-style player cards - design

A FIFA Ultimate Team-style card per user: overall rating, 6 attributes
(PAC/SHO/PAS/DRI/DEF/PHY), and a tier (Bronze/Silver/Gold/Special). This is
the calculation design only - no code yet, for review before implementation
resumes.

## Core principle: relative, not absolute

Every number on the card comes from **where a person ranks against every
other user**, never a fixed bar. Two consequences, both intentional:

- A card's quality reflects standing within the group. A small or generally
  low-activity team still produces a full spread of Bronze-through-Special
  cards, because the curve is *always* relative to whoever's actually in
  the pool right now - there's no absolute hours target anyone has to hit.
- The whole system re-curves itself automatically as the team's overall
  activity level changes over time (more users, more/less activity) -
  nothing to retune.

## Core principle: AI-native, not AI-suppressed

This app is built for a team that uses AI as a normal part of coding, so
the card doesn't wall AI-assisted work off from "real" activity. Both
PAC (time) and SHO (output) count human + AI activity, with AI weighted
at 0.7x in each - directing an AI well is a real skill, just not quite
weighted as high as doing it yourself. Earlier versions of this design
excluded AI from PAC entirely (to guard against someone leaving an
autonomous agent running unattended); that's now handled honestly instead
as a known, unsolved limitation (see Gaming vectors below) rather than by
discounting AI-assisted time across the board.

The other four attributes are diversity counts or ratios by nature
(distinct projects/languages/editors/OS, days-active ratio, streak length)
- they don't measure human-vs-AI at all, so this distinction doesn't apply
to them.

## The 6 attributes

| Stat | Formula (before percentile ranking) | Rationale |
|---|---|---|
| **PAC** | `SUM(human_seconds) + 0.7 * SUM(ai_seconds)` | Active time, AI-assisted time counted at a discount |
| **SHO** | `SUM(human_lines) + 0.7 * SUM(ai_lines)` | Real output weighted highest; AI-assisted lines count for most of a human line (confirmed) |
| **PAS** | `distinct(project) + distinct(language)` | Breadth across contexts |
| **DRI** | `distinct(editor) + distinct(os)` | Tool versatility |
| **DEF** | `days_active / days_tracked` | Consistency ratio - can't be padded by one big session |
| **PHY** | 60% `longest_streak` + 40% `MAX(project_seconds)` (each percentile-ranked separately, then blended) | Stamina - both day-streak endurance and sustained commitment to one project |

`days_active` = distinct dates with `total_seconds > 0`. `days_tracked` =
distinct dates with any synced row at all (denominator for DEF).

Every raw value above is computed **per user**, across the whole cohort of
users with any data in scope, before the percentile step runs.

**PHY is a blend, not a single raw metric** - day-streak and single-project
seconds live on wildly different scales (small integer vs. potentially
huge), so they can't just be summed like PAS/DRI can. Instead each is
percentile-ranked against the cohort *independently*, then the two
percentiles are combined 60/40 (streak/project) before the one final
rescale into 0-99 - keeps both sub-metrics "relative, not absolute" on
their own terms before they're blended.

## Percentile -> 0-99 scale

For each of the 6 attributes independently:

1. Collect that raw metric for every user in the cohort.
2. Rank-order them. Tied values get the *same, averaged* rank (standard
   tie handling - nobody is arbitrarily favored by insertion order).
3. Convert rank position to a fractional percentile in `[0, 1]`, where `0`
   = worst in the cohort, `1` = best.
4. Rescale onto the card's 0-99 band **with a floor**, so the worst-ranked
   person still looks respectable instead of getting an embarrassing
   near-zero number:

   ```
   rating = round(55 + percentile * (99 - 55))
   ```

   Floor of 55 (confirmed) - the worst-in-cohort attribute still reads as
   solidly average, not "broken," the same way FIFA rarely rates anyone
   below the low 40s (we're a bit more generous, since a small team's
   "worst" performer is often still putting in real, legitimate work).
   **PHY uses its own higher floor of 65** instead of 55 - applied after
   the streak/project blend, so PHY specifically never drops below 65
   regardless of percentile.

`overall` = simple average of the 6 already-rescaled attribute ratings,
rounded. (Normalizing each attribute to the 0-99 band *first*, then
averaging, means one outlier raw metric can't skew the overall before the
curve evens it out.)

## Card design (6 templates, real FC card conventions)

Six actual card templates: Base Gold, Base Silver, Icon, Legend/Hero,
White Icon, Featured Red. Each represents a genuinely *different kind* of
achievement, not just "higher overall = fancier card" - assigned as a
priority cascade, first match wins (one person, one card):

1. **Icon** - proven, sustained greatness across *history*: has been that
   season's champion (see below) in **2+ past seasons**. Rarest tier -
   requires winning more than once, a single great season isn't enough.
   Unreachable until real season resets have actually happened (see
   Production rollout below).
2. **White Icon** - current all-around mastery: **all 6 attributes ≥ 90**
   in the selected scope. Different kind of rare than Icon - no season
   history needed, but every single dimension has to be elite at once.
   Someone with a high overall from being lopsided (huge PAC/SHO, mediocre
   elsewhere) never qualifies here, only a true all-rounder does.
3. **Legend/Hero** - currently **#1 by overall** in the cohort right now,
   but hasn't earned Icon status yet. "Best right now" vs. Icon's "proven
   across history."
4. **Featured Red** - currently on a hot streak (`day_streak` or
   `week_streak` > 5), but not the outright #1 (would already be
   Legend/Hero otherwise). Time-limited - disappears the moment the streak
   breaks, matching FIFA's in-form promo cards.
5. **Base Gold** - overall ≥ 75, nothing more dramatic going on.
6. **Base Silver** - everyone else (overall < 75). The 55 floor already
   keeps this respectable, so no separate Bronze template is needed.

### Determining a past season's "champion" (for Icon)

Reuses data already archived, no new computation needed: whoever had the
most `rank = 1` days in that season's `leaderboard_history_season_N` table
(metric = total) is that season's champion.

### Production rollout caveat

Production currently has zero season resets - `season_resets` is empty,
so it's implicitly "season 1" with no history. This needs no special-case
code, it falls out of the existing design automatically:

- Season and career scope are identical right now (career's archive-table
  UNION loop runs zero times when `currentSeason = 1`).
- Icon is simply unreachable until the first real reset happens in
  production, then becomes earnable from that point forward. Nobody
  having an Icon card during early rollout is correct, not a bug.

## Position assignment (real FC position codes)

Real FC positions, not made-up role names: **ST, RW, LW, CAM, CM, CDM, LM,
RM, CB, RB, LB, GK**. Each outfield position is a *weighted blend* of all
6 attributes (matching how FIFA/FC itself computes position suitability -
not just "whichever stat is highest"):

| Position | Weighting |
|---|---|
| ST | SHO 45% · PAC 25% · DRI 15% · PHY 10% · PAS 5% |
| RW / LW | PAC 35% · DRI 30% · SHO 20% · PAS 15% |
| CAM | PAS 40% · DRI 30% · SHO 20% · PAC 10% |
| CM | PAS 30% · PHY 25% · DRI 20% · DEF 15% · PAC 10% |
| CDM | DEF 40% · PHY 30% · PAS 20% · DRI 10% |
| LM / RM | PAC 30% · PAS 30% · DRI 25% · DEF 15% |
| CB | DEF 55% · PHY 35% · PAC 10% |
| RB / LB | DEF 35% · PAC 30% · PHY 20% · PAS 15% |

A person's position = whichever of these 8 formulas scores highest for
them.

**GK is the exception, and is assigned rather than scored**: none of our 6
attributes represent goalkeeping skill, so instead of a formula, **GK
always goes to whoever has the single lowest overall in the cohort** for
the selected scope - matching a real team only carrying one keeper. This
overrides the weighted-formula assignment entirely for that one person.

**Left/right pairs (RW/LW, LM/RM, RB/LB) are mirror-image formulas** -
nothing in our data distinguishes "which side," so a person scores
identically on both sides of a pair. Tie broken by a deterministic hash of
their user ID - consistent every time their card is viewed, purely
cosmetic variety, not a real signal.

## Minimum sample size - provisional cards

A card is marked `provisional: true` (instead of hiding it or refusing to
compute it - same idea as a chess engine's provisional rating for a new
player) when **either**:

- that user has fewer than **7 days_active** in the selected scope, or
- the whole cohort has fewer than **4 users** with any data in that scope
  (percentile ranking is close to meaningless below that - see Known edge
  cases below).

The frontend would dim the card / show a "provisional" label rather than
presenting the number as fully meaningful.

Provisional users still count in everyone else's percentile pool (removing
them would shrink the cohort and distort other people's ranks based on an
arbitrary status change) - provisional only affects how *their own* card
is displayed. The cohort-size gate affects everyone's card at once, since
it's a property of the whole pool, not any one person.

## Two scopes: season vs career (toggle on the card)

- **Season**: only the live tables (`daily_stats`, `user_stat_breakdown`).
  Since the season-start clamp already guarantees these never hold data
  from before the current season, no extra filtering is needed - a season
  card automatically resets in step with the season-reset feature.
- **Career**: the live tables **UNION**ed with every archived
  `<table>_season_N` table, back to season 1. A streak that happens to
  span a season-reset boundary still counts as continuous here (a reset
  doesn't skip any real calendar days - it only affects the *current
  season's* leaderboard ranking) - so a career card can show a longer PHY
  streak than any single season card ever could.

Table names in that UNION are built from `season_number`, which only ever
comes from our own `resetSeason()`/`getCurrentSeason()` - integers we
generate ourselves, never user input, so no injection risk despite the
dynamic FROM clause.

## Known edge cases

- **Single-user (or very small) cohort**: percentile ranking degenerates -
  with one user, they're trivially "100th percentile" on everything,
  producing a maxed-out card that isn't really meaningful yet. **Decided:**
  the provisional flag now also gates on cohort size (< 4 users with any
  data), not just personal days_active - see Provisional cards above.
- **Ties**: handled by averaged rank, as described above - not expected to
  be visually confusing at small scale, but worth knowing two people with
  identical raw metrics get identical attribute scores.
- **A user who joined mid-season/mid-career**: naturally scores on
  whatever data they have; no special-casing needed beyond the existing
  provisional gate.

## Gaming vectors / caveats

Worth being honest about what this system can't defend against before
building it, so nobody's surprised later. Split into what's WakaTime's own
tracking behavior (outside our control entirely) vs. what's specific to
our own formulas (things we could actually tighten).

### WakaTime-level - we have no visibility or control here

- **AFK padding via the heartbeat timeout.** This is the big one, and
  nothing in our formulas closes it. WakaTime doesn't track continuous
  activity - it converts sparse heartbeats into "duration" using a
  timeout window (user-configurable, up to a few hours on some plans).
  Send one trivial keystroke every ~14 minutes while actually AFK
  (meeting, coffee, browsing) and WakaTime counts the *entire gap* as
  active coding time, inflating `human_seconds` directly - and since PAC
  now counts human time at full weight (this app doesn't discount AI, so
  it was never discounting idle time either), this flows straight into
  PAC with no defense. We only ever see WakaTime's pre-aggregated
  `summaries` duration, not raw heartbeats, so we can't see this happening
  even if we wanted to check. Unsolved, and not specific to us - every
  WakaTime-based leaderboard shares this ceiling.
- **Scripted/fake heartbeats.** There are known ways to ping WakaTime's
  heartbeat endpoint on a timer without coding at all - a small script
  that just phones in "still coding" periodically. Indistinguishable from
  real activity in the data we can see; worse than AFK padding since it
  requires no editor open at all.
- **Manually pasting AI output defeats the AI/human split entirely.**
  WakaTime only tags lines as AI-generated when the editor integration
  itself reports it (Copilot, Cursor, an instrumented Claude Code plugin,
  etc.). Copy-pasting output from a plain ChatGPT tab, or using any AI
  tool WakaTime's plugin doesn't recognize, shows up as 100% human
  keystrokes - full credit on PAC/SHO for work that wasn't manually
  written, with nothing on our end able to tell the difference.
- **OAuth token/session sharing.** Nothing technical stops someone from
  handing their access token to a friend so activity gets attributed to
  the "wrong" account. Inherent to any self-reported system that trusts
  whoever holds the credential - not fixable at our layer.

### Our own formula choices - things we could tighten

- **DEF and PHY only require `total_seconds > 0` to count a day as
  active.** A single trivial heartbeat a day - just enough to register as
  nonzero - cheaply sustains a perfect DEF ratio and an unbroken PHY
  streak, without any real work most days. Possible fix: require a
  minimum threshold (e.g. 5+ active minutes) for a day to count toward
  DEF/PHY, not just nonzero.
- **PAS/DRI diversity counts reward trivial breadth over real breadth.**
  Someone could create a handful of one-line throwaway files across
  several languages, or briefly touch several editors/machines, purely to
  inflate distinct-project/language/editor/OS counts - the metric can't
  tell "genuinely worked across five real projects" from "made five empty
  files to pad the number."
- **SHO (line count) inherits the general "lines changed" gaming problem**
  every LOC-based metric has - large low-value diffs (reformatting,
  duplicated boilerplate, mass whitespace changes, or straight
  copy-pasted code with real understanding) count the same as meaningful
  changes. Well-known industry-wide limitation, not specific to us, but
  still a real way to inflate this specific number.

  We can't reliably distinguish "pasted and barely understood" from
  "genuinely slow, thoughtful work" with `summaries`-level data alone (no
  visibility into paste-sized diffs vs incremental typing - that needs raw
  `heartbeats`/`durations`, which we don't pull). **Decided: no dedicated
  nerf mechanism for now** (neither an admin-tagged excluded-projects list
  nor a per-user manual discount) - relying instead on the multi-attribute
  design's natural self-correction: someone with inflated PAC/SHO but weak
  PAS/DRI (no real breadth) already produces a lopsided card, not an
  automatic top rating, without any special-casing. Revisit if that proves
  insufficient once real cards are visible.
- **Multi-machine padding of DRI.** Since distinct machine/editor count
  feeds DRI, quickly touching several devices (even trivially) inflates
  "versatility" without representing real tool skill.

### Governance / trust, not technical exploits

- **Admin power over resets and backfills.** Whoever holds admin can
  trigger `/api/admin/reset-season` or backfill a specific date - both
  legitimate tools, but both directly affect competitive standing
  (streaks, season totals). Worth having this be a "we trust whoever's
  admin" assumption stated explicitly, not something the card system
  itself can guard against.

### What's realistically fixable vs. not

The WakaTime-level items (AFK timeout, fake heartbeats, pasted AI output)
aren't solvable without pulling raw `heartbeats`/`durations` data and
cross-checking heartbeat density against claimed duration - a much bigger
lift (per `WAKATIME_API_EVAL.md`, that endpoint may also be plan-gated,
and is the highest-volume one to rate-limit against). Realistic take: this
system measures *what WakaTime reports*, same ceiling every WakaTime-based
leaderboard has - not a promise of perfectly cheat-proof numbers.

The "our own formula" items, though, are cheap to close now, before
launch: a minimum-minutes threshold for DEF/PHY instead of nonzero is a
one-line change and meaningfully raises the bar on the cheapest padding
vector available.

## Open questions before implementation resumes

1. ~~Confirm the attribute formulas and the AI-line discount weight~~ -
   **decided: 0.7x** (`human_lines + 0.7 * ai_lines`, feeds SHO).
2. ~~Confirm the floor and card assignment~~ - **decided: floor = 55**;
   superseded by the full 6-card cascade above (Icon/White Icon/
   Legend-Hero/Featured Red/Base Gold/Base Silver) rather than a simple
   4-tier system - Base Gold/Silver still use 75 as the cutoff between
   them.
3. ~~Decide on the small-cohort edge case~~ - **decided: yes**, provisional
   also triggers when cohort size < 4 users with any data.
4. ~~Decide the "nerf" mechanism for high-volume/low-quality activity~~ -
   **decided: neither** (no excluded-projects list, no per-user override)
   - relying on the multi-attribute design's natural self-correction.
5. ~~Decide positions and the 6-card assignment logic~~ - **decided**: see
   Card design and Position assignment sections above (real FC position
   codes, weighted formulas, GK = lowest overall, Icon/Hero/Featured Red
   cascade, hash-based left/right tiebreak).
6. **Still open:** the visual card design/component itself (layout, art
   direction) - this doc is calculations and assignment logic only. Given
   you're building the 6 card templates yourself, does that mean you want
   to build the card component too (I'd just build the data endpoint), or
   do you want me to implement the actual card UI against your templates?
7. ~~Confirm Featured Red's "hot streak" threshold~~ - **decided:
   `day_streak` or `week_streak` > 5**.
8. ~~Confirm minimum-active-minutes threshold for DEF/PHY~~ - **decided:
   40 minutes** (`total_seconds >= 2400`) instead of just `> 0`.
9. ~~Visual card templates~~ - **provided**: `export/` folder, one shared
   `.pitch-card` structure + 6 skin classes. Confirmed mapping:
   Icon -> `.card-black`, Legend/Hero -> `.card-purple`,
   White Icon -> `.card-white`, Featured Red -> `.card-red`,
   Base Gold -> `.card-gold`, Base Silver -> `.card-silver`.
10. Add a "how this card was made" legend at the end of the card page,
    explaining the methodology in plain language for viewers (not the
    full internal doc - a short, honest summary: relative ranking, what
    each stat means, season vs career, provisional status).

All decisions now made - moving to implementation.
