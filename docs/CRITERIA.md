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
| **PAC** | `SUM(human_seconds) + 0.7 * SUM(ai_seconds)` - active coding time |
| **SHO** | `SUM(human_lines) + 0.7 * SUM(ai_lines)` - output/lines written |
| **PAS** | `distinct(project) + distinct(language)` - breadth |
| **DRI** | `distinct(editor) + distinct(os)` - tool versatility |
| **DEF** | `days_active / days_tracked` - consistency ratio |
| **PHY** | 60% `longest_streak` + 40% `MAX(project_seconds)`, each percentile-ranked separately then blended - stamina (day-streak endurance + sustained project commitment) |

A day only counts toward DEF/PHY at **40+ active minutes**
(`total_seconds >= 2400`), not just nonzero.

## Percentile -> rating

Each attribute's raw value is ranked as a percentile against every other
user in the cohort (0 = worst, 1 = best; ties get an averaged rank), then
rescaled:

```
rating = round(55 + percentile * (99 - 55))
```

**Overall** = average of the 6 already-rescaled ratings, rounded.

## Card type (priority cascade, first match wins)

1. **Icon** - champion (most rank-1 days, `leaderboard_history_season_N`,
   metric=total) of **2+ past seasons**
2. **White Icon** - all 6 attributes >= **90**
3. **Legend/Hero** - #1 by overall in the cohort, right now
4. **Featured Red** - `day_streak` or `week_streak` > **5**
5. **Base Gold** - overall >= **75**
6. **Base Silver** - everyone else

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
