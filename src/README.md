# Alpine Clock Panel

<p align="center">
  <img src="https://raw.githubusercontent.com/dzaczek/grafana-alpine-clock-panel/main/src/img/logo.svg" alt="Alpine Clock Panel logo" width="160" />
</p>

Alpine Clock Panel is a configurable analog clock plugin for Grafana with watch-inspired styling, timezone support, metric-driven complications, and rich visual customization.

## Highlights

- Configurable dial shapes, gradients, bezels, tick marks, numerals, and hand styles
- Timezone-aware rendering with optional dashboard time synchronization
- Stop-to-go second hand, animated bounce, and dynamic hand shadows
- Date/day windows, rolling date strip, four subdials, and a global metric hand
- Showcase dashboard with multiple design presets and TestData scenarios

## Requirements

- Grafana 12.3.0 or newer
- Node.js version from the repository `.nvmrc` for local development

## Getting started

1. Install dependencies with `npm install`.
2. Start development mode with `npm run dev`.
3. Start Grafana locally with `npm run server`.
4. Open `http://localhost:3000` and add the Alpine Clock Panel to a dashboard.

## Documentation

- Repository and full setup guide: https://github.com/dzaczek/grafana-alpine-clock-panel
- Local showcase dashboard: `provisioning/dashboards/showcase.json`

## Contributing

Issues and pull requests are welcome in the GitHub repository:
https://github.com/dzaczek/grafana-alpine-clock-panel
