# PAGLAWIG — Featured Shipwreck Sites

An interactive, bilingual (English / Cebuano) web application for the museum's
shipwreck-section kiosk. Visitors pick a historical period, explore a map of the
Philippines, and tap a location to read its story and view its photographs.

Built from the supplied design package: *Story board for Interactive Section_MUCHD.pdf*,
*Texts for Interactive Section.docx*, the per-site text PDFs, the site photos, the
period artwork, the colour palette and the Museo typeface family.

---

## Running it

**No build step and no server required.** Open `index.html` in any modern browser
(Chrome, Edge, Firefox, Safari). All map geometry and text are inlined as JS, so the
app also runs from a USB stick or an offline kiosk machine.

If you prefer to serve it over the network:

```bash
# from this folder
python -m http.server 8000
# then visit http://localhost:8000
```

Designed for touch: large tap targets, drag-to-pan, pinch/wheel zoom, swipeable
photo lightbox, and full keyboard support (Enter/Space on pins, arrows/Escape in the
lightbox).

---

## What the visitor can do

| Action | Result |
| --- | --- |
| Tap a period chip, legend button or card | Map filters to that period's sites; panel shows the period story and its shipwrecks |
| Tap a pin on the map | Panel opens that site: location, discovery year, full text, photo gallery |
| **Start the guided tour** | A curated six-wreck route with a framing line at each stop |
| Search "All shipwrecks" | Finds any of the 19 sites by name, location or period |
| Tap a photograph | Full-screen lightbox; **pinch, scroll or double-tap to zoom into the artifact** |
| `EN` / `CEB` | Switches every piece of interface and body text to Cebuano |
| Drag / wheel / pinch | Pan and zoom the map (pins stay finger-sized at every zoom level) |
| Speaker button | Mutes or restores the underwater ambience |
| Home button or breadcrumb | Step back up to the full map |

**The overview map starts with no pins on it.** Nothing is marked until a period is
chosen, so the first screen is a clean map and a clear choice to make; the pins
then appear for that period only. (Pin Editor is the exception — it always shows
all 19 so they can be repositioned.)

Because the overview shows no pins, the home panel also carries an **All shipwrecks**
finder: a search box plus all 19 sites grouped by period, so a visitor who cannot
settle on a period, or who knows a wreck but not its century, still has a way in.

Every visible pin keeps a visible name label. Labels are placed by trying a ring of
candidate positions around each pin and taking the first that clears the other
pins and labels, and there is no zoom cut-off — names never disappear when you
zoom. Hovering a pin shows its name and period in a tooltip anchored directly above
it, which tracks the pin as the map moves.

### Kiosk idle behaviour

The screen is built to run unattended:

| After no input… | The screen does |
| --- | --- |
| First load | Shows the PAGLAWIG title card until someone touches it |
| 90 seconds | Drops any open wreck or period and returns to the clean Home screen |
| 2.5 minutes | Starts the attract loop, cycling through the 19 wrecks every 9s |
| Any touch | Leaves attract mode immediately and re-arms the timer |

Timings are tunable from the URL without touching the code, which is handy when the
exhibit needs different behaviour:

```
index.html?idle=60000&attract=120000&hold=6000
#   ^ no input before reset   ^ no input before attract   ^ seconds per wreck
```

None of this runs in Pin Editor mode (`?edit=1`), so the maintenance view never
resets itself mid-adjustment.

### Reading the map, and why there is a rail

The Philippines is a portrait shape and the map pane is landscape. Fitting the
country's *height* uses only about half the pane's width, so roughly half the map
would be empty sea. Zooming does not help: the 19 wrecks span 5.95–15.62°N and
116.9–121.85°E, and that cluster is even *more* portrait than the country.

So the dead space became a **left instrument rail** rather than a smaller map:

| Rail contents | Purpose |
| --- | --- |
| Four period buttons | Vertical stack, one per century, each with its vessel icon |
| Jump to a wreck | Searches all 19 sites from any view, not just Home |
| Compass rose | Kept in one place rather than floating over the water |
| Live scale bar | Real ground distance for the current zoom and latitude |

The map keeps the whole country visible at ~700px, and the reclaimed width goes to
the text panel, where long-form prose is capped at a readable measure (~70
characters) instead of running the full panel width.

Below 1180px the rail is hidden and the legend, compass and scale move **back onto
the map**. The same three elements are relocated, never duplicated, so there is no
second copy to fall out of sync; `placeInstruments()` handles this on load and on
resize.

### Century icons

Each period carries a vessel icon, so you can tell the century before reading the
label. The sequence is chronological and each vessel is the one actually associated
with that period of Philippine maritime trade:

| Period | Vessel | Why |
| --- | --- | --- |
| 13th Century | **Balangay** | Pre-colonial outrigger, with the amas float and its booms |
| 15th Century | **Chinese junk** | Battened lugsails dominate regional trade |
| 16th–17th Century | **Spanish galleon** | Square sails on yards, high stern castle |
| 18th–19th Century | **Steamship** | The East Indiaman and steam transition, with smoke |

They are filled paths on a shared 64×40 grid coloured with `currentColor`, so each
picks up its period colour automatically. They appear in the rail buttons, the
period cards (with the vessel name spelled out beneath), and the period pill on each
wreck. At the smallest size — 26px in a legend chip — they still read as distinct
silhouettes, and every use sits beside a text label, so the icon reinforces the
meaning rather than carrying it.

To change them, edit `PERIOD_ICON` in `js/app.js`; the keys are the period ids
(`c13`, `c15`, `c16`, `c18`).

### The guided tour

Attract mode is automatic cycling; the tour is **authored**. It runs through six
wrecks along the porcelain trade — Breaker Reef, Pandanan, San Isidro, San Jose,
Nuestra Señora Dela Vida and San Diego — with a short framing line at each stop and
a dot row to jump around.

The tour deliberately keeps the panel and drives the map, so a visitor is never
stranded mid-route: "Next stop" always has somewhere to go, and the last stop's
button ends the tour instead of dead-ending. Tapping the pin on the map still opens
the full site text for that stop. The route lives in the `TOUR` object in `js/app.js`
— edit the `stops` array to change it; entries are validated against real site ids
at runtime, so a typo simply disables the tour rather than breaking it.

### Photographs

`assets/photos/thumbs/` holds two generated sizes per image:

| File | Size | Used for |
| --- | --- | --- |
| `<name>.jpg` | 480px, ~29 KB | gallery tiles |
| `hi_<name>.jpg` | 1280px, ~131 KB | lightbox and site hero |

The originals average 208 KB, so a gallery tile was pulling a quarter-megabyte file
to paint a postage stamp; tiles are now about **7× lighter**. Both are `loading="lazy"`
and `decoding="async"`. If the thumbs folder is ever missing, the app detects the
failed load and falls back to the originals automatically, so a stale copy of the
folder still works. Regenerate with any image tool, or delete the folder to run on
originals.

**The lightbox zooms.** These are photographs of porcelain, coins and ceramics, so
the point is seeing the decoration: scroll, pinch or double-tap zooms to 6×, drags
pan while zoomed, and swipe-to-next is suppressed while zoomed so it never fights
the pan. Below 1× the cursor shows a magnifier, above it a grab hand.

**Captions are derived, never invented.** The caption line shows period, place and
discovery year, all taken from `data.js`. A rights line appears *only* if a site
has a `credit` field:

```json
{ "id": "san-diego", "credit": "Hilti Foundation, photo Frédéric Osada" }
```

Until the museum fills those in, nothing is claimed about authorship. Note that
only the three `san-diego` images carry usable credit information in their original
filenames; the other filenames use opaque codes (`gf`, `fo`, `fp`) whose expansion
is not recorded anywhere in the source material, so they are deliberately left
unattributed rather than guessed at.

### Colour and accessibility

The four period colours used to be four near-identical navies (`#201b4f`,
`#2f5d8a`, `#1d6f8f`, `#3b4a6b`) — indistinguishable as dots. They are now a
chronological lightness ramp with varied hue:

| Period | Colour |
| --- | --- |
| 13th Century | `#101c3c` deep navy |
| 15th Century | `#0c3f47` deep teal |
| 16th–17th Century | `#332a63` indigo |
| 18th–19th Century | `#4b4566` slate violet |

The ramp was chosen by measuring contrast against both sea colours
(`#a8d3ef`, `#8dc6e8`) under normal vision, deuteranopia, protanopia and tritanopia.
**The old palette actually failed WCAG 1.4.11 at 2.87:1 under tritanopia; the new one
holds 3.65:1 in the worst case.** Lightness is the channel that survives colour
blindness, which is why the ramp varies lightness first and hue second.

Accessibility elsewhere: all touch targets are at least 48px, body text is 15.5px,
every animation respects `prefers-reduced-motion`, and the lightbox has full
keyboard support (arrows, Escape).

### Kiosk mode

Add `?kiosk=1` for exhibit deployment:

- Requests fullscreen **from a user gesture** (browsers reject it otherwise, and the
  rejection is not catchable), and restores it if a visitor presses Escape
- Hides the pointer after 4 seconds of stillness, since a cursor left on an exhibit
  screen reads as broken

Full URL options, all optional and combinable:

```
index.html?kiosk=1&idle=60000&attract=120000&hold=6000&edit=1
```

### Sound

`js/ambience.js` synthesises the underwater bed at runtime — brown noise through a
slowly moving low-pass, plus a faint high shimmer. It is generated rather than
shipped, so there are no audio files to load or lose, and the exhibit stays fully
offline. Browsers require a gesture before audio may start, so it begins on the
visitor's first touch and the speaker button mutes it.

**Narration is not included and cannot be faked.** Per-site spoken commentary needs
a voice actor and a Cebuano translation; that is a content dependency, not a code
one. The ambience module is a natural place to hang it later if recordings arrive.

### Usage log (for curators)

Every wreck opened, every photograph viewed, and each language toggle is counted in
`localStorage` under `paglawig.usage.v1`. Nothing leaves the device.

Open Pin Editor and press **Export usage CSV** to download per-site open counts,
photo views, session totals and the English/Cebuano split. It is deliberately in the
editor rather than the visitor-facing UI, so nobody can trigger it by accident.

Reset it by clearing site data for `file://` in the kiosk browser.

### A note on map animation

Pins are drawn in a screen-space overlay positioned from the map transform, so
anything that moves the map without re-rendering that overlay every frame will
leave the pins visibly floating off the coastline. All camera moves therefore run
through `flyTo()` in `js/app.js`, which steps the transform per animation frame.
The earlier CSS-transition approach desynced pins by up to 207 px on the way back
to the overview map.

A CSS `transform` also overrides an SVG element's `transform` **attribute**, so
every ship is split across two nodes: an outer `<g>` that carries the map position
as an attribute, and an inner `<g>` that carries the CSS animation. Merging them
silently parks the ship at the map's top-left corner.

19 shipwrecks across 4 periods:

- **13th Century Maritime Trade** — Breaker Reef, Investigator Shoal, San Antonio
- **15th Century Maritime Trade** — Pandanan, Santa Cruz, Lena Shoal
- **16th–17th Century CE: Early Historical Period** — San Isidro, Royal Captain Junk,
  Española, Gujangan, Puerto Galera, San Jose Galleon, Nuestra Señora Dela Vida, San Diego
- **18th–19th Century CE: Late Historical Period** — Griffin, Reindeer, Royal Captain,
  Guay Point, Tagbita

---

## Files

```
index.html            markup + view templates
css/app.css           all styling, design tokens, responsive + reduced-motion rules
js/data.js            all exhibition content (periods, sites, bilingual text, photo lists)
js/mapdata.js         Philippines vector geometry (land + 118 province boundaries)
js/app.js             map engine, routing, rendering, pin editor
js/water.js           marine-snow particle field (canvas)
js/ambience.js        synthesised underwater ambience (no audio files)
assets/fonts/         Museo, Museo Sans, Aorell (self-hosted, no external requests)
assets/photos/        119 site photographs, progressive JPEG, max 1500px
assets/graphics/      art-*.jpg = illustrations cropped from the period panels
                      period-*.jpg = the full source period panels (reference only, unused)
assets/data/          photos.json — build manifest (not loaded at runtime)
js/pins.js            shared pin positions written by the Pin Editor
```

### About the map

The supplied map PDFs have their labels and pins burned into the artwork, so they
cannot be made interactive. Instead the base map is drawn as **vector paths**
(Natural Earth 1:10m administrative boundaries, 118 provinces) styled to match the
museum's original cartography exactly:

- land `#FAF4E4`, coastline `#3E86BE`, sea `#A8D3EF`, province borders `#B9AFA0`

This means the map stays razor-sharp at any zoom, and each pin is positioned from
real latitude/longitude rather than traced by hand.

### Design tokens

Colours come from the supplied `Color Pallette .png`:

| Token | Hex | Use |
| --- | --- | --- |
| `--navy` | `#201b4f` | headers, primary text, pin (13th C.) |
| `--slate` | `#65727e` | secondary text |
| `--sky` | `#79b6e3` | sea, accents, highlights |
| `--land` | `#faf4e4` | landmass fill |

Type: **Museo** (display), **Museo Sans** (interface), **Aorell** (italic accents),
all self-hosted from `assets/fonts/`.

---

## Pin Editor (correcting the map positions)

The supplied site descriptions don't give exact coordinates, so every pin position is
editable in the browser — no code required.

**Enter edit mode** either way:

- open `index.html?edit=1`, or
- press **Ctrl+Shift+E** (Esc or the ✕ leaves it)

There is no visible button, so visitors on a public kiosk never stumble into it.

**What you get:**

- **Drag any pin** to its true position — it follows the cursor exactly
- **Live coordinate readout** under the map, and a crosshair on the selected pin
- **Exact values** — type latitude / longitude straight into the panel if you have
  them from a chart, excavation report or GPS
- **Arrow keys nudge** the selected pin by one pixel; hold **Shift** for ten
  (zooming in first makes this very fine)
- Every one of the 19 labels stays visible, so nothing hides behind a cluster
- The map tints purple and the legend/period cards dim, so it is obvious you are in
  maintenance mode

**How positions are stored**

Positions resolve in this order:

1. `localStorage` — saved automatically on this device as you drag
2. `js/pins.js` — the shared file, committed with the project
3. `js/data.js` — the built-in default

To roll a correction out to every kiosk, click **Save pins.js** in the editor, then
copy the downloaded `pins.js` over `js/pins.js`. **Reset pin** reverts one site;
**Reset all** clears this device's overrides.

Changes made on the kiosk's own browser are not written to the file automatically —
the export step is what makes them permanent and shared.

---

## Water effects

The map sits in the sea, so it behaves like water:

| Effect | What it does |
| --- | --- |
| **Marine snow** | ~50–150 soft white specks drifting downward with a gentle sway, the way particulate matter hangs in real dive footage |
| **Caustic light** | Slow soft light shimmer drifting across the sea |
| **Swell** | The sea very gently breathes in brightness |
| **Ghost ships** | Three small wrecks each pick a **random** site, set out from open water, sail across to that pin, then list, roll over and slip below the surface trailing bubbles |
| **Wreck at the pin** | Tap any pin and a ship sails in and goes down right on that location — plays for every one of the 19 sites |
| **Sonar ping** | Three rings sweep outward from a wreck when you select it — a nod to how the sites were actually found |
| **Bubbles** | Small bubbles rise from the selected wreck |

The ghost ships only appear on the overview map — they are hidden whenever a site
panel is open, when zoomed in, and in Pin Editor mode — so they never compete with
what a visitor is trying to read. The wreck that plays on tap lasts about three
seconds, sinks onto the pin and fades out completely.

**How the random targeting works**

Every wreck has a pre-computed *seaward approach* in `js/seaborn.js` — a start
point out at sea from which the wreck can be reached **without the sailing path
crossing any land**. All 19 were verified against the coastline geometry, so a
hull never sails over an island no matter which wreck it picks.

On each loop a ship draws a new target from the wrecks that are currently
eligible. A site is skipped if it is off screen, hidden by the active period
filter, already open in the panel, or already claimed by another ship — so no two
ships ever converge on the same wreck, and no ship sails to one the visitor can't
see. A ship also won't pick the same wreck twice in a row.

Measured over 8 cycles the three ships reached 6, 7 and 8 distinct wrecks, and
every arrival landed on its pin.

To change the number of ships, or how long a run takes, edit the `GHOSTS` list at
the top of `js/app.js` (count) and `animation:ghostSink 34s` in `css/app.css`
(duration). The sailing distance is recomputed automatically at every zoom level.

The particles live in *map* coordinates, not screen coordinates, so they pan and
zoom with the map instead of sliding over the interface — and because they sit
beneath the landmass, they only ever show in open water.

All of it is tuned for a kiosk: the caustic layer is painted once and only
transformed, so it costs no repaints. Measured 53 fps in software-rendered
headless Chromium, so a real touchscreen will sit comfortably at 60.

If a visitor has **reduced motion** enabled, the drift, caustics, sonar and bubbles
switch off and a single static frame of particles is drawn instead. The water
effects are also wrapped so that, if they ever fail, the exhibit still runs.

---

## Editing content

Everything a curator is likely to change lives in `js/data.js`.

**Change a site's text, photos or position:**

```js
{
  "id": "tagbita",
  "period": "c18",
  "name": "Tagbita",
  "lat": 10.62, "lon": 118.92,          // drives the pin position on the map
  "title":      { "en": "...", "ceb": "..." },
  "location":   { "en": "Sitio Tagbita in Rizal, Palawan", "ceb": "..." },
  "discovery":  { "en": "Discovery: 2003", "ceb": "Nakaplagan: 2003" },
  "body": { "en": ["paragraph", "paragraph"], "ceb": ["paragraph"] },
  "photos": ["assets/photos/tagbita--tagbita-shipwreck-tea.jpg"]
}
```

- `period` must match a period `id` (`c13`, `c15`, `c16`, `c18`).
- `lat`/`lon` are decimal degrees; the map reprojects them automatically.
- The prefix before the colon in `discovery` is stripped and re-labelled per language.
- Photos are listed in display order — the first one is also the hero image.
- UI strings (button labels, "Photographs", hints) are inline in `js/app.js` and switch
  on the `lang` variable.

**Add a photograph:** drop the file into `assets/photos/` and add its path to that
site's `photos` array. Any JPEG/PNG works; roughly 1500px on the long edge is ideal.

**Add a site:** copy an existing entry, give it a new `id`, and add the `id` to the
matching period's `sites` array. The pin, map placement, filters, list and breadcrumb
are all derived from the data.

### Sites that had no photo folder

Seven sites were supplied as text only: San Antonio, Gujangan, Puerto Galera,
Nuestra Señora Dela Vida, Reindeer, Royal Captain and Guay Point. Their photographs
were recovered from images embedded in the per-site `*Text.pdf` panels, so all 19
sites now have a gallery.

If a site's photographs are ever replaced by an empty list, the site falls back to
the period illustration as its hero with a short "photographs not yet available"
note, so nothing renders broken.

---

## Notes and limitations

- **Pin positions still need a pass from you.** The built-in coordinates were
  transcribed from the site descriptions, so treat them as a starting point. Three
  (San Antonio, Reindeer, Nuestra Señora Dela Vida) originally landed *inland*, which
  is impossible for wrecks recorded 34–45 m below the surface; those have been moved
  to the nearest seaward point and now sit in water. Please confirm all 19 with the
  Pin Editor above — Investigator Shoal, Royal Captain Junk and Royal Captain sit over
  the Kalayaan Group of Islands, which the base map draws as open water.
- **All 19 sites now have photographs.** The seven sites with no photo folder
  (San Antonio, Gujangan, Guay Point, Nuestra Señora Dela Vida, Puerto
  Galera, Reindeer, Royal Captain) were sourced from images embedded in their
  per-site `*Text.pdf` panels. Two of those panels reuse the same photograph, so
  Gujangan and Reindeer each include an identical jar image; swap in
  site-specific photographs when available.
- **Residual access.** Sources describe the San Isidro hull as similar to *garay*,
  *parao* and *barangay*; those are written in the source text but not linked to
  separate map locations.
- `prefers-reduced-motion` is respected; animations are disabled for visitors who
  have that setting enabled.