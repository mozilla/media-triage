# Plan: ICS Calendar Analysis and Summary

## Goal

Given an exported `.ics` file (Google Calendar format), produce a structured markdown summary covering calendar metadata, event statistics, active recurring events, historical cruft, and notable observations.

---

## Step 1: Inspect the raw file

**What:** Get a feel for file size, encoding, and top-level structure before parsing anything.

**How:**
- Count total lines and VEVENT blocks.
- Read the first ~30 lines to confirm the file is valid iCalendar (`BEGIN:VCALENDAR`, `VERSION:2.0`, etc.) and identify any Google-specific extension properties.

**Outputs:**
- Total line count
- Total `BEGIN:VEVENT` count
- Calendar-level properties: `X-WR-CALNAME`, `X-WR-CALDESC`, `X-WR-TIMEZONE`, `PRODID`, `METHOD`

---

## Step 2: Extract and classify every VEVENT block

**What:** Split the file into individual VEVENT blocks and tag each one with a classification.

**Classification logic** (applied in order — first match wins):

| Class | Condition |
|---|---|
| `active-recurring` | Has `RRULE`, no `UNTIL=`, no `COUNT=` |
| `expired-recurring` | Has `RRULE` with `UNTIL=` in the past, or `COUNT=` |
| `one-time-future` | No `RRULE`, `DTSTART` > today |
| `one-time-past` | No `RRULE`, `DTSTART` ≤ today |
| `cancelled` | `STATUS:CANCELLED` (regardless of other fields) |

**How:**
- Parse each block as a dict of property → value(s).
- For `RRULE`, extract `UNTIL` and `COUNT` sub-fields.
- Parse `DTSTART` as a date (strip time/timezone suffix; handle `VALUE=DATE` form).
- Compare `UNTIL` and `DTSTART` against today's date.

**Outputs:**
- A list of (block, class) pairs for all 552 events

---

## Step 3: Drill into active recurring events

**What:** For the `active-recurring` set, extract the fields needed for the summary table and compute next-occurrence dates.

**Fields to extract per event:**
- `SUMMARY`
- `DTSTART` (seed date)
- `RRULE` — specifically `INTERVAL` and `BYDAY`
- `ATTENDEE` values (collect all unique addresses)

**Next-occurrence calculation:**
- Start from `DTSTART`.
- Add `INTERVAL` weeks repeatedly until the result is strictly after today.

**Outputs:**
- Table: SUMMARY | DTSTART | Next occurrence
- Rotation track detected from `INTERVAL` value (9 → Media Triage, 7 → WebRTC Triage)

---

## Step 4: Drill into old cruft

**What:** Sub-classify the 536 non-active events into named buckets that tell the story of how the calendar evolved.

**Sub-classification logic:**

| Bucket | Condition |
|---|---|
| Pre-2021 daily round-robin slots | No `RRULE`, `DTSTART` < 2021-01-01, summary matches `<name> - triage` or `<name> triage` |
| One-time past with `RECURRENCE-ID` | No `RRULE`, has `RECURRENCE-ID` |
| One-time past (other) | No `RRULE`, no `RECURRENCE-ID`, `DTSTART` ≤ today |
| Expired recurring — by track | Has `RRULE` with past `UNTIL`; bucket by keywords in `SUMMARY`: `WebRTC`, `Playback`, `Audio`, `Video`, `Media` |

**Outputs:**
- Count per bucket
- Date range and member list for the pre-2021 round-robin bucket
- Cycle-length evolution notes for the expired WebRTC series

---

## Step 5: Collect notable observations

**What:** Surface anything surprising or worth flagging that falls out of the above analysis.

**Checks to run:**
- Typos in `SUMMARY` fields of active events (e.g., string distance against expected pattern)
- Count of unique `ATTENDEE` addresses across all events
- Count of events carrying `ORGANIZER`
- Count of events carrying `RECURRENCE-ID`
- Count of events with `STATUS:CANCELLED`
- Count of future one-time events (should be 0 for a pure rotation calendar)

---

## Step 6: Write `analysis.md`

**What:** Assemble all outputs into a single structured markdown file.

**Sections:**
1. Calendar Metadata (table)
2. Summary Statistics (table)
3. Active Recurring Events (two sub-tables, one per rotation track)
4. Old Cruft (summary table + per-bucket prose)
5. Notable Observations (numbered list)

**Output file:** `analysis.md` in the working directory.

---

## Verification

After writing, read the file back and confirm:
- All section headers present
- Row counts in tables match computed values
- No truncation or encoding artifacts
