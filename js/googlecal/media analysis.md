# ICS Calendar Analysis: `goog.ics`

## Calendar Metadata

| Field | Value |
|---|---|
| File | `goog.ics` |
| Calendar name (`X-WR-CALNAME`) | `Media Triage` |
| Description (`X-WR-CALDESC`) | `Media's team rotating triage duty` |
| Timezone (`X-WR-TIMEZONE`) | `America/Los_Angeles` |
| Producer | Google Calendar |
| Method | `PUBLISH` |

---

## Summary Statistics

| Category | Count |
|---|---|
| Total VEVENT blocks | 552 |
| Total file lines | 12,886 |
| **Live — recurring, no UNTIL, no COUNT** | **16** |
| Recurring — expired (UNTIL in the past) | 63 |
| One-time past events (no RRULE, DTSTART ≤ 2026-02-21) | 473 |
| One-time future events (no RRULE, DTSTART > 2026-02-21) | 0 |
| Cancelled events (STATUS:CANCELLED) | 0 |
| **Old cruft total** | **536** |

---

## Active Recurring Events (16 total)

All active events are Saturday all-day events with no UNTIL or COUNT (indefinite). They fall into two rotation tracks.

### Media Triage — every 9 weeks on Saturday (9 people)

`RRULE:FREQ=WEEKLY;WKST=SU;INTERVAL=9;BYDAY=SA`

| SUMMARY | DTSTART | Next occurrence after 2026-02-21 |
|---|---|---|
| Paul Media Triage | 2024-02-03 | 2026-02-28 |
| Chun-Min Media Triage | 2024-08-17 | 2026-03-07 |
| John Media Triage | 2025-03-01 | 2026-03-14 |
| Andrew Media Triage | 2024-02-24 | 2026-03-21 |
| Alastor Media Triage | 2023-12-30 | 2026-03-28 |
| Jim Media Triage | 2024-01-06 | 2026-04-04 |
| Mathew Media Tirage *(typo — see observations)* | 2024-01-13 | 2026-04-11 |
| Karl Media Triage | 2025-12-13 | 2026-04-18 |
| Ashley Media Triage | 2024-01-27 | 2026-04-25 |

### WebRTC Triage — every 7 weeks on Saturday (7 people)

`RRULE:FREQ=WEEKLY;WKST=SU;INTERVAL=7;BYDAY=SA`

| SUMMARY | DTSTART | Next occurrence after 2026-02-21 |
|---|---|---|
| Michael WebRTC Triage | 2024-01-06 | 2026-02-28 |
| Jim WebRTC Triage | 2024-01-13 | 2026-03-07 |
| Nico WebRTC Triage | 2024-12-28 | 2026-03-14 |
| Andreas WebRTC Triage | 2024-01-27 | 2026-03-21 |
| Daniel WebRTC Triage | 2024-02-03 | 2026-03-28 |
| Byron WebRTC Triage | 2024-02-10 | 2026-04-04 |
| Jan-Ivar WebRTC Triage | 2023-12-30 | 2026-04-11 |

---

## Old Cruft (536 events)

| Sub-category | Count |
|---|---|
| Pre-2021 daily round-robin triage slots (2018-06-19 – 2020-06-22) | 407 |
| One-time past events (RECURRENCE-ID exceptions and stragglers, 2020–2025) | 66 |
| Expired recurring WebRTC triage series | 31 |
| Expired recurring Playback triage series | 14 |
| Expired recurring Media triage series | 12 |
| Expired recurring Audio triage series | 4 |
| Expired recurring Video triage meeting | 2 |
| **Total** | **536** |

### Sub-category details

**Pre-2021 daily slots (407):** Individually-encoded all-day events named `<person> - triage` or `<person> triage`, one per person per day in a round-robin across 16 people: `pehrsons`, `padenot`, `achronop`, `alwu`, `mjf`, `ng`, `jhlin`, `bwc`, `jib`, `dminor`, `drno`, `bryce`, `jya`, `karlt`, `kinetik`, `chunmin`. Date range: 2018-06-19 to 2020-06-22.

**One-time past events (66):** 27 carry `RECURRENCE-ID` (modified exceptions to recurring series — e.g., swap pairs like Byron/Jan-Ivar on 2024-07-06/07-13), plus remaining one-off past entries from 2020–2025.

**Expired recurring WebRTC series (31):** Multiple overlapping RRULE series with explicit UNTIL dates in the past. Cycle lengths evolved from 4-week to 5-week to 7-week as people joined/left.

**Expired recurring Playback series (14):** Round-robin playback triage rotation ~2020–2023, typically every 5 or 8 weeks on Monday or Saturday.

**Expired recurring Audio series (4):** Short daily triage series from January 2020, each UNTIL within a few days of DTSTART (likely covering absences): `padenot`, `achronop`, `kinetik`, `karlt`.

**Expired recurring Media series (12):** Predecessor series to the currently active Media Triage rotation, each with an UNTIL now in the past.

**Expired recurring Video triage meeting (2):** Weekly Tuesday recurring meeting series, both fully expired (2020-01-14 to 2020-09-22).

---

## Notable Observations

1. **97% of the file is dead weight.** Only 16 of 552 events are live; the remaining 536 are historical artifacts from 2018–2024.

2. **Typo in an active event.** "Mathew Media **Tirage**" should be "Mathew Media **Triage**" — the misspelling is baked into the `SUMMARY` field of an indefinitely-recurring event (DTSTART 2024-01-13).

3. **All attendees are `@mozilla.com` addresses.** 23 unique attendees appear across the file. The shared Google Group calendar address (`mozilla.com_ovr8sdlln71kenc5nb43mo514o@group.calendar.google.com`) appears on 46 events as a Google Calendar artifact.

4. **Zero cancelled events.** All 552 events carry `STATUS:CONFIRMED`.

5. **Zero future one-time events.** The calendar is purely a recurring-duty rotation with no ad-hoc entries.

6. **Historical evolution across four generations spanning 2018 to present:**
   - **Gen 1 (2018–2020):** Daily individual round-robin slots, 16 people, all encoded as separate VEVENT blocks.
   - **Gen 2 (2020–2023):** Separate Audio / Playback / Video triage team rotations using short-interval RRULE series.
   - **Gen 3 (2021–2024):** WebRTC triage rotation, cycle lengths evolved from 4 → 5 → 7 weeks as membership changed.
   - **Gen 4 (2023–present):** Current unified Media (9-week) + WebRTC (7-week) rotating schedule.

7. **Only one ORGANIZER in the file:** the shared group calendar address, appearing on 97 events. The remaining 455 have no ORGANIZER field (typical for directly-entered shared calendar entries).

8. **27 events carry RECURRENCE-ID**, indicating modified exceptions — e.g., swap pairs like Byron/Jan-Ivar on 2024-07-06 and 2024-07-13.
