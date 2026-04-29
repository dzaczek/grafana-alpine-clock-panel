# Alpine Clock Panel for Grafana

<p align="center">
  <img src="./src/img/logo.svg" alt="Alpine Clock Panel logo" width="160" />
</p>

The most geeky clock panel ever built for Grafana.

Alpine Clock Panel is a watch-inspired panel plugin with deep visual control: from hand geometry and counterweights, through dial shapes, numerals, and bezel markings, all the way to metric-driven complications, segmented gauges, transparent mechanical movement, and chronograph-style subdials.

If you want to build your own clock instead of choosing from a fixed widget, this plugin is for you.

## Why this plugin exists

- Build anything from a minimal studio clock to a dense mechanical watch face.
- Tune almost every visible element directly from the Grafana panel editor.
- Mix pure timekeeping with dashboard data by using subdials, a global metric hand, value windows, segmented gauges, and mechanical cutaway styles.
- Use the included showcase dashboard as a design catalog and starting point for your own presets.

## Highlights

- 8 dial shapes: `round`, `oval-h`, `oval-v`, `square`, `rect-h`, `rect-v`, `hex-flat`, `hex-point`
- 14 hand shapes: `rect`, `taper`, `lozenge`, `pointer`, `sword`, `dauphine`, `breguet`, `alpha`, `syringe`, `arrow`, `baton`, `leaf`, `skeleton`, `spade`
- Arabic, Roman, circled Arabic, and circled Roman hour numerals
- Fully configurable bezel with 12/24/60 scales, ticks, rotation, fonts, and ring placement
- Stop-to-go seconds, smooth sweep, per-hand bounce, dynamic sun shadows, and timezone support
- Day window, date window, rolling date strip, and up to 4 configurable subdials
- Global metric hand with arcs, thresholds, value windows, scale rings, segmented gauge overlays, and mechanical gauge styling
- Transparent dial / skeleton movement mode with animated wheels, bridges, jewels, and escapement-inspired motion
- 150+ ready-to-preview showcase examples provisioned for local Grafana

## Configuration coverage

The panel currently exposes more than **220 editor options**.

- Time source and stop-to-go timing
- Dial size, shape, gradients, border, and transparency behavior
- Bezel numbers, fonts, ticks, offsets, thickness, and border
- Hour, minute, and second indices, including numeral styles
- Hour, minute, and second hand geometry, motion, counterweights, and bounce
- Center cap, virtual sun, and dynamic shadows
- Day window, date window, and rolling date strip
- 4 subdials with analog or digital rendering and query-driven thresholds
- Global metric hand, arc fill, thresholds, value windows, and scale ring
- Segmented global metric gauge with labels, rim, sparkline, and split value
- Skeleton movement rendering and movement-style parameters

For the exhaustive option reference, see [docs/CONFIGURATION.md](./docs/CONFIGURATION.md).

## Requirements

| Dependency | Version |
|---|---|
| Grafana | `>=12.3.0` |
| Node.js | `>=22` |
| npm | `>=10` |

## Local development

### Install dependencies

```bash
npm install
```

### Start frontend watch mode

```bash
npm run dev
```

### Start Grafana locally

```bash
npm run server
```

Then open `http://localhost:3000`.

### Validation

```bash
npm run typecheck
npm run lint
npm run test:ci
npm run build
```

## Release and versioning

This repository follows **Semantic Versioning** (`MAJOR.MINOR.PATCH`), which matches Grafana plugin metadata expectations for `plugin.json` and release packaging.

Recommended release flow:

```bash
npm version patch   # or minor / major
git push origin main --follow-tags
```

Important details:

- Release tags must use the `v*` pattern, for example `v1.2.0`.
- The GitHub release workflow packages the plugin from the versioned tag.
- The plugin metadata uses a SemVer version in `plugin.json`, as recommended by Grafana Plugin Tools.
- CI already validates build, lint, tests, packaging, and metadata compatibility.

Reference:

- Grafana plugin metadata: https://grafana.com/developers/plugin-tools/reference/plugin-json
- Grafana packaging guide: https://grafana.com/developers/plugin-tools/publish-a-plugin/package-a-plugin
- Grafana publishing best practices: https://grafana.com/developers/plugin-tools/publish-a-plugin/publishing-best-practices

## Publishing notes

- The plugin is designed to be packaged and signed with Grafana Plugin Tools workflows.
- `plugin.json` contains catalog-facing metadata such as description, keywords, links, logos, and SemVer placeholders.
- Before publishing to the Grafana catalog, add real screenshots to `src/plugin.json` if you want a richer catalog presentation.

## Project structure

```text
alpine-clock-panel/
├── src/
│   ├── module.ts
│   ├── types.ts
│   ├── timezones.ts
│   ├── components/
│   │   └── AlpineClockPanel.tsx
│   └── img/
│       └── logo.svg
├── docs/
│   └── CONFIGURATION.md
├── provisioning/
├── .github/workflows/
├── .config/
└── dist/
```

## Contributing

Ideas, bug reports, and feature requests are welcome.

- Repository: https://github.com/dzaczek/grafana-alpine-clock-panel
- Issues: https://github.com/dzaczek/grafana-alpine-clock-panel/issues

If you have an idea for a new complication, dial style, mechanical behavior, or data-driven watch feature, open an issue on GitHub.

## License

[Apache 2.0](./LICENSE)
