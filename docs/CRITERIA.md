# FUT card criteria - current state

Snapshot of exactly what's implemented right now in `worker/database.ts`.
For the full design rationale, see `docs/FUT_CARD_DESIGN.md` - this doc is
just "what the numbers are today," kept short and current.

(History note: a `fix: swap sho and pac` commit briefly swapped what PAC
and SHO measure, but that read backwards from standard FIFA convention -
"pace" mapping to line-count didn't make sense - so it was reverted. The
table below is the original, standard-convention mapping: PAC = pace/time,
SHO = shooting/output.)

## The 6 attributes

| Stat | Raw metric (before percentile ranking) |
|---|---|
| **PAC** | `human_seconds + 0.7 × ai_seconds` - active coding time |
| **SHO** | `human_lines + 0.3 × ai_lines` - output/lines written (AI lines count for little - agents emit them far faster than humans) |
| **PAS** | projects + languages with **30+ minutes** - meaningful breadth |
| **DRI** | editors + OSs with **30+ minutes** - real tool versatility |
| **DEF** | `days_active / days_tracked` - consistency ratio |
| **PHY** | 60% `longest_streak` + 40% average of top-2 `project_seconds`, each percentile-ranked separately then blended - stamina (day-streak endurance + sustained project commitment) |

A day only counts toward DEF/PHY at **40+ active minutes**
(`total_seconds >= 2400`), not just nonzero.

A project/language/editor/OS only counts toward PAS/DRI breadth at **30+
minutes** (`seconds(name) >= 1800`) - you actually used it. A 10-second
experiment in another editor no longer scores the same as daily-driving it,
and opening a repo in 5 editors for a minute each gains nothing.

## Percentile -> rating

Each attribute's raw value is ranked as a percentile against every other
user in the cohort (0 = worst, 1 = best; ties get an averaged rank), then
rescaled:

```
rating = round(55 + percentile * (99 - 55))
```

**Overall** = average of the 6 already-rescaled ratings, rounded.

## Card type - who gets what, and when

Evaluated fresh on **every card computation** (gallery load, profile view -
cached for 60s), **per scope** (season vs career can give different types).
First match in the cascade wins - a user matching several rules gets the
highest one only:

| # | Card | Who gets it | When it can first appear |
|---|---|---|---|
| 1 | **White Icon** | **All 6 attributes >= 90 AND reigning champion AND 2+ titles** - the crowned legend; absorbs the Icon slot, so no separate Icon exists that season | Season 3 (needs title history; extraordinarily rare by construction) |
| 2 | **Icon** | **Reigning champion** - most daily wins last season | Season 2 (needs 1 archived season; exactly one holder at a time, unless absorbed by White Icon) |
| 3 | **Legend/Hero** | **#1 by overall** in the current cohort, right now | Always - exactly one holder, re-decided every computation |
| 4 | **On Form** (red) | **More than 24 hours coded in the trailing 7 days** (live, from daily totals) | Whenever someone puts in a 24h+ week |
| 5 | **Base Gold** | **Overall >= 75**, and none of the above | Anytime |
| 6 | **Base Silver** | **Everyone else** | Default tier |

Notes:

- **Hero always has exactly one holder** (ties broken by computation order);
  every other special tier can have zero, one, or several holders - or sit
  empty for months (Icon, White Icon). Empty is normal, not a bug.
- **Streaks are live**: Featured is won and lost as streaks cross the
  `> 5` line. A Featured holder whose streak drops to 5 falls back to
  Gold/Silver (or Hero) on the next computation.
- **Icon is historical**: it only changes at season resets, never
  mid-season. White Icon / Hero / Featured can change daily.
- **Scope matters**: a season-Hero and a career-Hero can be different
  people. Icon counts past-season championships, so it is identical in both
  scopes.
- **Progression hints** (`nextTier`): Silver cards show points to Gold
  (`75 - overall`); Gold cards show the gap to the current Hero. Special
  tiers are qualitatively different, not "more points away," so they get no
  hint - the gallery's "Who holds what" strip shows what to aim for instead.

### The season title race (Icon qualifier)

Each past season crowns one champion from its frozen
`leaderboard_history_season_N` table (daily rows, metric `total`):
whoever has the **most daily wins** (`rank = 1 AND value > 0`). Dead days
(everyone at zero) crown nobody. Ties broken by lower user id -
deterministic, no coin flips.

The previous season's champion is the reigning **Icon** - exactly one
holder, passing to each new winner at every reset. All-time greats
(2+ titles) have no separate tier; White Icon is the legend tier now.

Data used: frozen season tables only. No join dates, no windows, no
qualifier.

### Live season standings (dashboard drivers' table)

`GET /api/season/standings` serves the title race as it stands today,
computed over the live tables clamped to the current season. Columns:

- **Pos / Driver / Pts** - position and F1 points (25-18-15-12-10-8-6-4-2-1
  per daily rank).
- **P1 / P2 / P3** - daily wins / seconds / thirds (active days only).
- **DNF** - synced days in your own window with zero time (cron gaps you
  never synced don't count).
- **Avg** - points per own-window day, informational.

Ordered by wins (then Pts, active days, user id) - most daily wins takes
the crown if the season ended today.

## Position

Weighted blend of the 6 attributes, highest score wins:

| Position | Weighting |
|---|---|
| ST | SHO 45% - PAC 25% - DRI 15% - PHY 10% - PAS 5% |
| RW / LW | PAC 35% - DRI 30% - SHO 20% - PAS 15% |
| CAM | PAS 40% - DRI 30% - SHO 20% - PAC 10% |
| CM | PAS 30% - PHY 25% - DRI 20% - DEF 15% - PAC 10% |
| CDM | DEF 40% - PHY 30% - PAS 20% - DRI 10% |
| LM / RM | PAC 30% - PAS 30% - DRI 25% - DEF 15% |
| CB | DEF 55% - PHY 35% - PAC 10% |
| RB / LB | DEF 35% - PAC 30% - PHY 20% - PAS 15% |

**GK** overrides all of the above - always assigned to whoever has the
single **lowest overall** in the cohort.

Left/right pairs (RW/LW, LM/RM, RB/LB) always tie on our data; broken by a
deterministic hash of the user's id.

A striker (ST) is weighted toward SHO (output/scoring) with some PAC
(pace/speed) - standard striker logic, matching the original convention.

## Provisional

A card is `provisional: true` when either:

- the user has **fewer than 7 active days** (40+ min days) in the
  selected scope, or
- the whole cohort has **fewer than 4 users** with any data in that scope

## Scope

- **season** - only the live tables; the season-start clamp guarantees no
  data from before the current season leaks in.
- **career** - live tables + every archived `_season_N` table, queried
  separately per table and merged in JS (this D1/SQLite build caps
  `UNION ALL` at 5 terms, so a straight UNION approach breaks past ~5
  season resets).
