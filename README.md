# liqMapParser

A CLI toolset for fetching, parsing, and visualizing liquidation heatmaps from CoinAnk.

## Features

- Fetch real-time liquidation heatmap data via CoinAnk API
- Export data to CSV
- Generate interactive HTML plots with Plotly
- Selenium-based viewer to capture the same API response directly from the webpage

## Prerequisites

- Node.js (>= 14.x)
- npm (>= 6.x)

## Installation

```bash
npm install
```

## Usage

### CLI: liqMapParser.js

```bash
# Export CSV
node liqMapParser.js --mode csv --csv-file data.csv --json-file response.json

# Generate HTML heatmap
node liqMapParser.js --mode plot --html-file heatmap.html
```

Options:
- `-m`, `--mode`     : `csv` or `plot` (default: `plot`)
- `-c`, `--csv-file` : output CSV filename (default: `liq_heatmap.csv`)
- `-j`, `--json-file`: save raw API JSON (default: `response.json`)
- `-o`, `--html-file`: output HTML filename (default: `heatmap.html`)

### Selenium Viewer: selenium_coinank_viewer.js

```bash
node selenium_coinank_viewer.js [options]
```

Options:
- `-c`, `--csv`     : export captured heatmap data as CSV (optional path; default: `liq_heatmap.csv`)
- `-h`, `--headless`: run Chrome in headless mode

#### Examples

```bash
# Launch browser, capture JSON, print to console
node selenium_coinank_viewer.js

# Capture JSON and export to default CSV
node selenium_coinank_viewer.js --csv

# Headless capture and export to custom CSV
node selenium_coinank_viewer.js -c mydata.csv -h
```

## Project Structure

```
├── liqMapParser.js           # API-based CSV/HTML export script
├── selenium_coinank_viewer.js# Selenium script to capture webpage API response
├── package.json              # Project metadata and dependencies
├── .gitignore                # Ignored files for Git
└── README.md                 # Project documentation
```
