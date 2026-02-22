# Graphics - Triage Calendar Analysis

_Generated 2026-02-21 from `graphics.ics`_

---

## 1. Calendar Metadata

| Property | Value |
|---|---|
| `X-WR-CALNAME` | Graphics - Triage |
| `X-WR-TIMEZONE` | America/Denver |
| `X-WR-CALDESC` | Schedule for the new bugs triage... |
| `PRODID` | -//Google Inc//Google Calendar 70.9054//EN |
| `METHOD` | PUBLISH |

---

## 2. Summary Statistics

| Metric | Value |
|---|---|
| Total lines (folded) | 11,501 |
| Total VEVENT blocks | 507 |
| Date range | 2015-01-03 – 2026-10-02 |
| Past events (DTSTART ≤ today) | 475 |
| Future events (pre-scheduled) | 32 |
| Events with `RRULE` | 0 |
| Events with `STATUS:CANCELLED` | 0 |
| Events with `RECURRENCE-ID` | 0 |
| Unique attendee emails | 51 (50 humans + 1 calendar group address) |
| Events carrying `ORGANIZER` | 468 |
| Standard 7-day slot duration | 503 |
| Non-standard duration | 4 |

All 507 events are **one-time weekly triage slots** assigned to a single individual. There are no recurring-rule events of any kind.

---

## 3. Active Rotation

The current 14-week rotation cycle is pre-scheduled through 2026-10-02. Next assignment: **Jim Mathies**, week of 2026-02-27.

### 3a. Current Cycle (2026, 14 weeks)

| Position | Triager | Next slot |
|---|---|---|
| 1 | Jim Mathies | 2026-02-27 |
| 2 | Jamie Nicol | 2026-03-06 |
| 3 | Brad Werth | 2026-03-13 |
| 4 | Teo Tanasoaia | 2026-03-20 |
| 5 | Bob Hood | 2026-03-27 |
| 6 | Jeff Muizelaar | 2026-04-03 |
| 7 | Glenn Watson | 2026-04-10 |
| 8 | Nicolas Silva | 2026-04-17 |
| 9 | Lee Salzman | 2026-04-24 |
| 10 | Sotaro Ikeda | 2026-05-01 |
| 11 | Tim Nikkel | 2026-05-08 |
| 12 | Jim Blandy | 2026-05-15 |
| 13 | Ashley Hale | 2026-05-22 |
| 14 | Erich Gubler | 2026-05-29 |

### 3b. Rotation Change 2025 → 2026

The 2025 rotation had **15 members**. Kelsey Gilbert was present (2 slots in 2025) but does not appear in any of the 32 pre-scheduled 2026 events.

| Change | Person |
|---|---|
| Removed | Kelsey Gilbert |
| Added | _(none)_ |

---

## 4. Historical Slot Distribution

| Year | Slots | Unique triagers | Notes |
|---|---|---|---|
| 2015 | 52 | 15 | Calendar begins |
| 2016 | 53 | 19 | `Incoming triage - Name` format introduced |
| 2017 | 48 | 24 | Peak headcount; dual naming formats |
| 2018 | 52 | 14 | Consolidated roster |
| 2019 | 53 | 14 | 27 events lack `ORGANIZER` |
| 2020 | 52 | 16 | Jim Blandy, Jim Mathies, Bert Peers join |
| 2021 | 53 | 12 | Brad Werth joins; leaner roster |
| 2022 | 52 | 15 | `[Incoming Triage] Full Name` format only; Ashley Hale, Bob Hood, Glenn Watson, Kelsey Gilbert join |
| **2023** | **0** | **0** | **Complete gap — no events recorded** |
| **2024** | **0** | **0** | **Complete gap — no events recorded** |
| 2025 | 52 | 15 | Schedule resumes; Erich Gubler, Teo Tanasoaia join |
| 2026 | 40 | 14 | 8 past + 32 pre-scheduled; Kelsey Gilbert removed |

### All-time triage counts (canonical, top 20)

| Triager | Slots |
|---|---|
| Nicolas Silva | 37 |
| Sotaro Ikeda | 37 |
| Jeff Muizelaar | 36 |
| Lee Salzman | 35 |
| Tim Nikkel | 34 |
| Jamie Nicol | 33 |
| Andrew Osmond | 25 |
| Dzmitry Malyshau | 20 |
| Jeff Gilbert | 19 |
| Jim Blandy | 19 |
| Jim Mathies | 17 |
| Brad Werth | 16 |
| Miko Mynttinen | 15 |
| Milan | 12 |
| Bas | 12 |
| Bob Hood | 10 |
| David | 10 |
| Mason | 9 |
| Ashley Hale | 9 |
| Ryan | 9 |

---

## 5. Naming Convention Evolution

Three SUMMARY formats appear in the calendar:

| Format | Example | Events | Date range |
|---|---|---|---|
| `[Incoming Triage] Full Name` | `[Incoming Triage] Nicolas Silva` | 372 | 2015-01-03 – 2026-10-02 |
| `Incoming triage - ShortName` | `Incoming triage - Nicolas` | 125 | 2016-07-16 – 2019-01-19 |
| Capitalisation variants / other | `Incoming Triage - Lee` | 10 | 2017-11-25 – 2019-08-12 |

The bracket format `[Incoming Triage]` is the original (used from 2015) and the current standard. The `Incoming triage - Name` format was an alternate style used concurrently from mid-2016 to early 2019, then discontinued.

---

## 6. Notable Observations

1. **Complete 2023–2024 data gap.** The calendar contains zero events for calendar years 2023 and 2024. The schedule jumps from 2022-12-30 to 2025-01-03 — a 735-day gap covering two full triage years. All 507 events share a single `DTSTAMP` of `2025-12-15T160429Z`, indicating the entire file was regenerated or bulk-exported on one day in December 2025. The 2023–2024 triage assignments were likely managed elsewhere and were not included in this export.

2. **`[Incoming Triage] Jeff GilBert Peers`** (2019-08-31 and 2019-11-30). Two events merge the names of two separate triagers — Jeff Gilbert and Bert Peers — with a camel-case splice. Both appear correctly as distinct entries in other events. These are data-entry errors.

3. **Milan's 35-day slot** (2017-09-09 to 2017-10-14). `Incoming triage - Milan` has `DTEND` set 35 days after `DTSTART` instead of the standard 7. Likely a calendar editing mistake; Milan's other slots are all 7 days.

4. **Non-triage event in the calendar.** `Kris Taeleman in Toronto for Onboarding` (2019-08-12, 4 days) is the only event that is not a triage assignment. It was entered into the triage calendar, presumably for scheduling context.

5. **Two 6-day slots.** Brad Werth (2021-03-26) and Timothy Nikkel (2019-02-02) each have a slot that ends one day short of the standard 7-day window.

6. **39 events lack `ORGANIZER`.** These are concentrated in 2019 (27 events) and scattered across 2015–2018 (12 events). All events from 2020 onward carry an `ORGANIZER` field. Likely reflects a change in how the calendar was administered.

7. **Roster peaked in 2017 at 24 individuals**, then contracted sharply. Many early contributors (Bas, Benoit, Milan, Miko Mynttinen, Dzmitry Malyshau, Andrew Osmond, Jeff Gilbert, Alexis Beingessner, Miko Mynttinen) have since left the rotation. The roster has stabilised at 14–15 people since 2021.

8. **51 unique attendee email addresses** appear across all events. One is the calendar's own Google Group address (`mozilla.com_6059q0oha1t7ueamb52cs7vegk@group.calendar.google.com`), leaving 50 distinct human contributors on record.
