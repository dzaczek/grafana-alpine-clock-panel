# Changelog

All notable changes to this project should be documented in this file.

The format follows Keep a Changelog and the project uses Semantic Versioning.

## 1.4.0 (2026-05-09)

### Added

- Chapter ring option — decorative inner ring between dial and bezel for station clocks
- Grand Central Terminal dashboard (New York, cream dial, brass bezel, spade hands)
- Big Ben dashboard (London, Victorian Gothic, iron bezel, opal glass, sword hands)
- World Exchanges dashboard — 14 trading floor clocks across global timezones
- 108-clock categorized showcase across 9 themes (Retro, Modern, Cyberpunk, Fantasy, Rich, Metrics, Sport, Rails, Airplane)
- 5 thematic dashboards: Racing Chronograph, Diver's Bezel, Flieger Type A, Bauhaus, Grand Complication
- `gmShowHand` toggle for independent control of global metric hand visibility
- `gmSmoothDuration` slider (0.1–60s) controlling GM hand animation speed
- Smooth animation for subdial analog hands (exponential decay, 0.3s time constant)
- Descriptions for all 274 panel options in the Grafana config UI

### Changed

- Global Metric category split into 4 subcategories: main, Indicator, Readout, Gauge
- Mechanical Movement moved after Virtual Sun (advanced visuals group)
- Category names: "Hour/Minute/Second indices" → "Hour/Minute/Second marks"
- Second hand counterweight position default changed from 65 to -23
- SVG radial gradient `r` increased from 70% to 85% (Chrome rendering fix)
- All dashboard JSONs cleaned of forced counterweight/bounce overrides (534 removed)

### Fixed

- `smoothSecondHand` dead control removed (second hand is always smooth)
- Element collisions resolved on Full-Featured Metrics Clock and all themed dashboards
- GM hand animation — was ignoring `gmSmooth`, now uses exponential decay
- Subdial hands — were jumping, now animate smoothly
- Sun indicator disabled on Large Clock with Shadow dashboard

### Removed

- Unused `HandOptions` interface from types

## 1.3.0 (2026-05-07)

### Added

- Smooth animation for global metric hand (exponential decay interpolation)
- `gmSmoothDuration` option controlling GM hand transition time
- Smooth animation for subdial analog hands

### Fixed

- `gmSmooth` was registered in UI but ignored by the renderer
- Duplicate animation loop performance issue

## 1.2.0 (2026-04-29)

### Added

- Extended publishing-ready README and a full configuration reference in `docs/CONFIGURATION.md`
- Catalog-oriented plugin metadata links and a stronger marketplace description
- Release and SemVer guidance aligned with Grafana packaging workflows

### Changed

- Synchronized repository version metadata to `1.2.0`
- Refined documentation wording for local development, publishing, and contribution flow

## 1.1.0 (2026-04-12)

### Added

- Timezone support with `moment-timezone`
- Configurable date and time display options
- Second-hand animation toggle
- Showcase dashboard in provisioning
- Custom color options for clock elements

## 1.0.0

Initial release.
