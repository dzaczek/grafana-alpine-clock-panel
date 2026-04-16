# Alpine Clock Panel for Grafana

A fully configurable **analog clock panel plugin** for Grafana. Designed to look like a real watch — every visual detail is adjustable from the panel editor.

## Features

### Clock face
- **8 dial shapes**: round, horizontal/vertical oval, square, horizontal/vertical rectangle, flat-top hexagon, pointy hexagon
- **Gradient fills**: solid, linear gradient, or radial gradient with configurable stops
- **Bezel** (outer ring) with custom numbers (`12h`, `24h`, `60`, `60-all`), ticks, rotation offset, and font controls
- **Hour / minute / second tick marks** with independent colors, lengths, widths, and optional 3-D sun-shadow elevation
- **Hour numbers** with configurable font family, size, color, and radial distance

### Hands
- **14 hand shapes**: rect, taper, lozenge, pointer, sword, dauphine, breguet, alpha, syringe, arrow, baton, leaf, skeleton, spade
- **Per-hand counterweight** with 5 shapes: none, circle, square, diamond, ring
- **Smooth-sweep** option (continuous vs. tick-step motion) per hand
- **Bounce animation** — damped harmonic oscillation on each tick; configurable amplitude, damping, and frequency per hand
- **Center cap** with configurable size and color

### Stop-to-go second hand
The second hand can be configured to pause and then sweep quickly to catch up — mimicking the mechanism found in precision Swiss movements. The sweep duration and pause duration are both configurable in milliseconds.

### Time source
- **Timezone selector** — any IANA timezone from the bundled `moment-timezone` database
- **Dashboard time range** — optionally use the Grafana panel query time instead of the local clock

### Virtual sun & hand shadows
A virtual sun orbits the dial and casts dynamic SVG shadows from each hand, simulating a real light source. Control the shadow color, opacity, blur, and minimum/maximum shadow distances. Night behavior is configurable: hide, fade, or keep shadows.

### Date / day windows
- **Day-of-week window** — shows the full day name (Monday), short (Mon), or 2-letter (Mo); supports curved arc layout
- **Date window** — shows the day-of-month number; supports curved arc layout
- Both windows are fully configurable: position, size, colors, font, corner radius

### Subdials (×4)
Up to four independent subdials can be placed anywhere on the face. Each subdial can show:
- **Analog** — gauge hand with ticks and optional numbers
- **Digital** — numeric readout
- Bound to any Grafana query field with reducer (last, mean, min, max, sum, …)
- Linear scale and offset transform
- Threshold coloring (value, background, or both) with two configurable thresholds
- Optional label with configurable position and style

### Global metric hand
A full-face gauge overlay driven by query data. Features:
- Configurable sweep geometry (start angle, sweep span)
- Same hand shapes and counterweight options as the clock hands
- Fill arc between min and current value with optional threshold-color bands
- Scale ring with tick marks and numeric labels around the dial
- Value display options: floating window, center readout, or counterweight display

### Rolling date strip
A scrolling strip showing surrounding dates, with the current date highlighted — like a perpetual calendar complication.

## Requirements

| Dependency | Version |
|---|---|
| Grafana | ≥ 12.3.0 |
| Node.js | see `.nvmrc` |

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Develop (watch mode)

```bash
npm run dev
```

### 3. Run Grafana locally via Docker

```bash
npm run server
```

Open [http://localhost:3000](http://localhost:3000) — the plugin is provisioned automatically.

### 4. Production build

```bash
npm run build
```

Output goes to `dist/`. Copy the `dist/` folder to your Grafana plugin directory (e.g. `/var/lib/grafana/plugins/dzaczek-alpineclock-panel/`).

### 5. Tests

```bash
# Unit tests (Jest, watch mode)
npm run test

# Unit tests (CI, single run)
npm run test:ci

# E2E tests (Playwright — requires `npm run server` first)
npm run e2e
```

### 6. Lint

```bash
npm run lint
npm run lint:fix
```

## Signing & publishing

To distribute the plugin through the Grafana catalog the plugin must be signed.

1. Create a [Grafana Cloud account](https://grafana.com/signup).
2. Confirm that your Grafana Cloud account slug matches the plugin ID prefix (`dzaczek`).
3. Create a Grafana Cloud API key with the `PluginPublisher` role.
4. Add the key as a repository secret named `GRAFANA_API_KEY`.
5. Push a version tag to trigger the release workflow:

```bash
npm version minor   # or major / patch
git push origin main --follow-tags
```

The bundled [release workflow](./.github/workflows/release.yml) will sign and package the plugin automatically.

## Project structure

```
alpine-clock-panel/
├── src/
│   ├── module.ts              # Plugin entry point & panel options registry
│   ├── types.ts               # TypeScript types for all panel options
│   ├── timezones.ts           # IANA timezone list
│   ├── components/
│   │   └── AlpineClockPanel.tsx  # Main SVG rendering component
│   └── img/
│       └── logo.svg
├── provisioning/              # Auto-provisioned Grafana datasource & dashboard
├── .config/                   # Managed by @grafana/create-plugin — do not edit
├── dist/                      # Build output (git-ignored)
└── docker-compose.yaml        # Local dev environment
```

## License

[Apache 2.0](./LICENSE)
