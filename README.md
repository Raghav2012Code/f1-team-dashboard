# Apex GP — F1 Race Desk

A single-page Formula 1 race strategy dashboard. It opens mid-race at Spa-Francorchamps on lap 28 of 44, with two cars, twenty cars circulating on the map, a tyre strategy to approve, and a race control channel that is suspiciously calm.

It is a **design and interaction exercise**, not a telemetry product. Every driver, lap time, gap and weather reading is fictional.

- **Stack:** HTML, CSS, and vanilla JavaScript. Nothing else.
- **Dependencies:** none. No build step, no `npm install`, no framework.
- **Size:** ~88 KB of code across five files, plus a 42 KB map asset.

---

## Run it in ten seconds

The project is static, so you have two options.

**Just open the file.** Double-click `index.html`, or drag it into a browser. It works straight off the filesystem — the scripts are plain `<script>` tags, not ES modules, so there's no CORS or server requirement.

**Or serve it locally** if you prefer clean URLs and proper caching:

```bash
git clone https://github.com/Raghav2012Code/f1-team-dashboard.git
cd f1-team-dashboard

python -m http.server 8000     # then open http://localhost:8000
```

The only feature that needs a network connection is the circuit selector, which hot-links official track diagrams from Formula1.com. Everything else — including the built-in Spa map — is bundled in the repo.

There is nothing to build and nothing to install. Any static host (GitHub Pages, Vercel, Netlify, S3) will serve it as-is.

---

## What you'll see

| Panel | What's on it |
| --- | --- |
| **Race strip** | Session status, lap counter, progress bar, live countdown to the race distance, and an `ADVANCE LAP` button. |
| **Driver cards** | Mara Voss (#27, P4, on mediums) and Eli Navarro (#63, P7, on softs) — position, gap ahead, last lap, tyre age, personal best. Click one to highlight that car on the map. |
| **Weather card** | Air and track temperature, rain probability, wind, and an asphalt state readout — per circuit. |
| **Track map** | The real Spa layout with an interactive SVG overlay: twenty cars moving along the racing line, nineteen tappable turn markers, sector key, and per-corner engineer notes. |
| **Circuit selector** | Swap the map for any of 23 official 2026 season circuits. The cars keep circulating along that circuit's mapped racing line. |
| **Strategy desk** | Tyre stint bars per driver (completed and planned), the pit window, a live laps-until-stop counter, and a one-click toggle between Plan A and Plan B. |
| **Race control** | Current flag state, an expandable incident report, and safety car / VSC / penalty status. |
| **Race picture** | A chart with three tabs — lap time, race position, and sector pace. Hand-drawn SVG, no charting library. |
| **Sector split** | Per-driver sector times with personal-best highlighting, best-in-sector deltas, and a written insight. |

---

## Things to try

The dashboard is built to be poked at, so give it a minute:

1. **Watch the clock.** The race advances on its own, one lap per ~107 seconds of real time at Spa, faster on shorter circuits. The tyre ages, the pit window countdown, the two lap badges and the progress bar all move with it. Hit `ADVANCE LAP` to skip ahead. At the final lap the chequered flag drops and the controls lock.
2. **Read a corner.** Click any of the 19 turn markers on the Spa map — or tab to one and press Enter. Each one has an engineer's note. `RESET VIEW` clears your selection.
3. **Swap the circuit.** Change the dropdown from *Spa · live race* to Suzuka, Monza, Interlagos, anywhere. The whole desk follows: map, race distance, lap clock, weather, sector names, the headline's corner name, and the field's pace. Monaco runs 78 laps, Las Vegas 50, and the race restarts on the new circuit.
4. **Change the plan.** The `✓` on the strategy desk flips the strategy between Plan A and Plan B. The stint bars, the pit window text and the plan badge all react.
5. **Switch drivers.** Click a driver card. The other car's marker dims on the map so you can follow one at a time.
6. **Cycle the charts.** Lap time, position and sector pace are three different readings of the same ten laps.
7. **Enter focus mode.** The `◎` button in the top bar dims the analytics, weather and race control panels and highlights the map and strategy desk. The `☰` button is a mobile navigation drawer.
8. **Resize the window.** The layout reflows at 1050px, 720px and 400px.

---

## How the map works

The track map is two layers stacked on top of each other:

- **A base image** of the circuit — either the bundled `assets/spa-francorchamps-map.svg`, or an official diagram hot-linked from Formula1.com.
- **An SVG overlay** in the same coordinate space. It holds a single invisible `<path>` describing the racing line, plus a group per car.

Each car is an SVG `<g>` containing an `<animateMotion>` element with an `<mpath>` reference to that path. The per-car `dur` is derived from that driver's lap time (scaled down by 3× so a lap takes about 36 seconds instead of nearly two minutes), and each car starts at a negative `begin` offset so the field is spread around the circuit instead of nose-to-tail. `rotate="auto"` turns each car to face the direction of travel.

Switching circuits swaps the path's `d` attribute and the overlay's `viewBox` to match the new image's natural dimensions, then rebuilds every car's motion element. That's the whole animation system — no canvas, no physics, no tweening library.

---

## Project structure

```
index.html                     Markup, panel structure, the Spa turn markers
styles.css                     The entire theme and layout (shipped minified)
script.js                      Race clock, map animation, charts, all interactions
circuits-data.js               23 circuits: name, length, laps, map URL, event URL
circuit-routes.js              Traced racing-line paths, keyed by circuit slug
assets/spa-francorchamps-map.svg   Bundled Spa layout, 19 turns + sector markings
```

The two data files are plain globals — `OFFICIAL_F1_CIRCUITS` and `OFFICIAL_CIRCUIT_ROUTES` — read directly by `script.js`. Adding a circuit means adding an entry to both, keyed by the same slug.

### What is real and what is invented

`circuits-data.js` mixes both on purpose, and it is worth knowing which is which:

| Field | Status |
| --- | --- |
| `name`, `length`, `laps`, `date` | Real, from the published 2026 calendar |
| `mapUrl`, `eventUrl` | Real, served by Formula1.com |
| `lapBase` | **Invented.** A plausible race lap per circuit, used for the clock, car speed and sector scaling |
| `sectors`, `corner` | Real circuit features |
| `weather` | **Invented.** Plausible conditions for that venue in that month — not a live feed |

Two 2026 quirks are baked in and easy to trip over:

- **The Bahrain GP is at Sepang.** The April race at Sakhir was cancelled, so Malaysia hosts the "Gulf Air Bahrain Grand Prix in Malaysia" in October: 56 laps of the 5.543 km Sepang circuit. The `bahrain` slug carries Sepang's venue, length, lap count and map. There is no 2026 race at Sakhir.
- **There is no Saudi Arabian GP.** Jeddah was cancelled alongside Bahrain and not replaced, which is why the calendar has 23 rounds and not 24.

---

## Tech stack

- **HTML5** — semantic structure, `aria` labelling on the interactive controls.
- **CSS3** — CSS Grid and Flexbox, custom properties for the whole palette, no framework.
- **Vanilla JavaScript (ES6+)** — `requestAnimationFrame` race loop, event delegation, direct DOM and SVG construction.
- **SVG** — track overlay, car motion paths, and the charts (drawn as `<polyline>` with a hand-rolled scale).

### Design tokens

The entire theme lives in `:root` in `styles.css`:

| Token | Value | Role |
| --- | --- | --- |
| `--ink` | `#10191c` | Page background |
| `--panel` / `--panel-raised` | `#172327` / `#1c2a2e` | Card surfaces |
| `--line` | `#304146` | Borders and rules |
| `--paper` | `#f1f1e9` | Primary text |
| `--muted` | `#94a4a2` | Secondary text |
| `--lime` | `#d5f169` | Accent — live states, team Voss, focus highlights |
| `--red` | `#ff735f` | Alerts, team Navarro |
| `--cyan` | `#72c9bc` | Sector three |

Type is a system stack throughout: a condensed display face for headings (`Arial Narrow` / `Impact`), a system sans for body, and a monospace for all numerics and labels. **No web fonts are requested**, so the page renders instantly and works offline.

---

## Accessibility and responsiveness

- Turn markers are `role="button"`, focusable, and respond to Enter and Space.
- Chart tabs use `role="tablist"` with correct `aria-selected` state.
- Toasts announce through an `aria-live="polite"` status region.
- Car markers carry per-driver `aria-label`s and SVG `<title>` tooltips.
- `prefers-reduced-motion: reduce` disables transitions, animations and smooth scrolling globally.

---

## Data and asset credits

**All racing data in this project is fictional.** Apex GP is not a real team. The drivers, teams, lap times, gaps, tyre ages, weather readings and race control events are invented for the demo. Do not cite anything here as real Formula 1 telemetry.

Track artwork is real and credited:

- **Spa-Francorchamps** — `assets/spa-francorchamps-map.svg` is derived from
  [2022 F1 CourseLayout Belgium](https://commons.wikimedia.org/wiki/File:2022_F1_CourseLayout_Belgium.svg)
  by ごひょううべこ, licensed **CC BY-SA 4.0**. The attribution line under the map is part of the licence and must stay in place if you redistribute this project.
- **All other circuits** — official 2026 diagrams served by Formula1.com and displayed with their original markings. The traced racing lines in `circuit-routes.js` are derived from those diagrams and used here for demonstration.

Formula 1, the FIA and the circuit names used in this project are trademarks of their respective owners. This is an unofficial, non-commercial project with no affiliation.

---

## Contributing

Small, focused pull requests are welcome — a corner note, a new circuit, a bug in the lap maths.

A few things worth knowing before you edit:

- **`styles.css` is minified.** It's a single flattened file. Reformat it in your editor before making structural changes, and don't commit a whitespace-only reformat on its own — it makes reviews impossible.
- **The race clock is driven by real time.** `elapsedSeconds` accumulates from `requestAnimationFrame` deltas, capped at 100ms per frame to survive tab throttling. Lap maths depends on that cap.
- **A new circuit needs two entries.** `circuits-data.js` for metadata, `circuit-routes.js` for the racing line. A missing route makes the selector fall back to Spa with a toast. Keep the slug lists in step — a slug in one file and not the other is a silent failure.
- **The sector table has to stay honest.** The purple cell must be the faster of the two rows, and the "best in sector" footer must name whoever actually holds it. The margins live in `winnerMargins` in `script.js`.
- **The time cap is derived, not configured.** It is `laps × lapBase`, so the clock and the lap counter always reach zero together. Don't reintroduce a fixed cap.
- **Preserve the CC BY-SA attribution** on the Spa map if you touch that panel.

---

## License

The code is released under the [MIT License](LICENSE) — see `LICENSE` for the full text.

The MIT license covers the code in this repository. It does **not** cover the third-party assets in `assets/`, which keep their own terms: the Spa diagram is CC BY-SA 4.0 and must retain its attribution, and the official Formula1.com diagrams are served hot from their CDN and are trademarks of Formula One Licensing BV.
