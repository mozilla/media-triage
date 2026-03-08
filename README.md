# Graphics and Media Triage — Functionality

## Overview

A single-page dashboard used by Mozilla's Graphics, Media Playback, and Web Conferencing teams to track incoming Bugzilla bugs organized by weekly triage duty slots. Each engineer who is assigned a triage week sees a card on the page showing how many unreviewed bugs were filed during their slot.

---

## Teams

The site supports three teams, selected via a dropdown and reflected in the `team` URL parameter:

| Team selector value | Display name | Bugzilla components |
|---|---|---|
| `media` | Media Playback | Audio/Video, Audio/Video: cubeb, GMP, MediaStreamGraph, Playback, Recording, Web Audio, Web Codecs |
| `webrtc` | Web Conferencing | WebRTC, WebRTC: Audio/Video, WebRTC: Networking, WebRTC: Signaling |
| `graphics` | Graphics | Graphics, Canvas2D, CanvasWebGL, Color Management, Image Blocking, ImageLib, Layers, Text, WebGPU, WebRender |

If no `team` parameter is present in the URL, the page redirects to the current year with `team=media` as the default.

---

## ICS Calendar Integration

Each team's triage rotation is defined by an iCalendar (`.ics`) file stored in `js/`:

- `js/media.ics` — Media Playback rotation
- `js/webrtc.ics` — Web Conferencing rotation
- `js/graphics.ics` — Graphics rotation

### How calendar events map to triage buckets

Each `VEVENT` in the file represents one triage duty slot. The site reads:

- **`SUMMARY`** — the engineer's name (after stripping labels like "playback triage", "WebRTC Triage", "[Incoming Triage]")
- **`DTSTART`** / **`DTEND`** — the start and end dates of the slot (spanning 8 days to align with Bugzilla's date-range query semantics)

Events with a `RRULE` (recurring rule) are expanded automatically up to 3 years into the future using the rule's `INTERVAL` and `FREQ=WEEKLY` values.

Events from before 2022 are ignored.

---

## Page Layout

### Header

Displays the Firefox logo, the team name and year, and a persistent announcement reminding triagers to set `SEVERITY` on all bugs and pointing to team-specific triage tracking bugs (`webrtc-triage`, `media-triage`, `graphics-triage` in Bugzilla) and UpdateBot documentation.

### Controls bar

- **Team dropdown** — switches between Media Playback, Web Conferencing, and Graphics. Changing the selection reloads the page with the new `team` URL parameter.
- **Refresh button** — re-fetches the ICS file and Bugzilla data without a full page reload.
- **Settings button** — opens the settings dialog. The button shows a visual alert indicator when no Bugzilla API key is configured.

### Triage bucket cards

One card is rendered per calendar event for the selected year. Each card shows:

- **Engineer name** (from the ICS `SUMMARY`)
- **Date range** (formatted as "Mon DD – Mon DD")
- **Bug count** — a clickable number that opens a Bugzilla search filtered to bugs filed in that slot. Displayed as a grayed-out bullet (•) when the count is zero.
- **"B" sub-indicator** — shown alongside the bug count when bugs are present; links to Bugzilla bugs with no `Severity` set.
- **UpdateBot count (UB)** — a separate count of bugs filed by `update-bot@bmo.tld` during that slot, shown only when non-zero.

Future buckets (slots whose start date is after today) are displayed with grayed-out text.

### Year footer

Links to the previous year, current year, and next year, preserving the active `team` parameter. The currently selected year is highlighted.

### Progress bar

Shown while Bugzilla data is loading; hidden automatically when the request completes.

### Error area

Displays Bugzilla API error messages (e.g., authentication failures). Duplicate error messages are suppressed.

---

## Bugzilla Queries

### Bug query criteria

For each triage slot, the site queries the Bugzilla REST API (`https://bugzilla.mozilla.org/rest/bug`) for bugs that match **all** of the following:

- Filed in the relevant team's Bugzilla components
- `bug_status` is one of: `UNCONFIRMED`, `NEW`, `ASSIGNED`, `REOPENED`
- Assigned to `nobody@mozilla.org` (i.e., unclaimed)
- Does not have the `meta` keyword
- `bug_severity` is `--` (not yet set)
- `bug_type` is `defect`
- `creation_time` falls within the slot's date range

### UpdateBot query criteria

A parallel query finds bugs filed by `update-bot@bmo.tld` during the same date range, using the same status, component, severity, and keyword filters, but matching on `reporter` instead of `bug_type`.

### Single bulk request

Rather than one request per bucket, the site issues **two** requests that cover the entire year at once (one for regular bugs, one for UpdateBot bugs). Bug counts per bucket are then computed client-side by comparing each bug's `creation_time` against each slot's date range.

### Fields retrieved

To minimize payload size, only the following fields are requested: `last_change_time`, `creation_time`, `summary`, `id`, `flags`, `severity`, `priority`, `assigned_to`.

---

## Settings

Accessed via the Settings button; stored in `localStorage` (or `sessionStorage` if persistence is disabled).

| Setting | Description |
|---|---|
| **Bugzilla API Key** | Passed as `X-Bugzilla-api-key` HTTP header on all Bugzilla REST requests. Required for accessing security-sensitive or restricted bugs. Keys are managed on the user's [Bugzilla API Key Administration](https://bugzilla.mozilla.org/userprefs.cgi?tab=apikey) page. |
| **Persist settings** | When checked (default), settings including the API key are saved in `localStorage` and survive browser restarts. When unchecked, `sessionStorage` is used instead. |

---

## URL Parameters

| Parameter | Values | Description |
|---|---|---|
| `team` | `media`, `webrtc`, `graphics` | Selects which team's ICS file and Bugzilla components to use. Required; defaults to `media` if missing. |
| `year` | Four-digit year (e.g., `2026`) | Selects which year's triage slots to display. Defaults to the current year. |

Example: `index.html?year=2026&team=media`

---

## Configuration (`js/triage.json`)

Centralizes all URLs and query parameters:

- `BUGZILLA_URL` / `BUGZILLA_REST_URL` — Bugzilla endpoints
- `graphics_ics`, `media_ics`, `webrtc_ics` — paths to the three ICS files
- `graphics_components`, `media_components`, `webrtc_components` — URL-encoded Bugzilla component lists
- `generic_bugzilla_search_template` — base query parameter array used for all searches
- `additional_bugzilla_search_params` — defect-type filter appended to regular queries
- `additional_updatebot_search_params` — reporter filter appended to UpdateBot queries
- `include_fields` — restricts fields returned by the Bugzilla REST API

---

## File Structure

```
index.html              Main page
css/triage.css          Styles
js/
  triage.js             Main application logic (ICS loading, rendering, Bugzilla queries)
  utils.js              ICS parsing, URL/query building, settings, storage utilities
  triage.json           Configuration (URLs, components, query templates)
  media.ics             Media Playback triage rotation calendar
  webrtc.ics            Web Conferencing triage rotation calendar
  graphics.ics          Graphics triage rotation calendar
  libs/
    ical.js             iCalendar parser
    jquery-1.12.0.min.js
    jquery-cross-origin.min.js
    purl-2.3.1/purl.js  URL parameter parser
images/                 Firefox logo, favicon, gradient backgrounds
fonts/MozTT-Medium.ttf  Mozilla typeface
```
