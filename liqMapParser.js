#!/usr/bin/env node

// Usage:
//   npm install minimist
//   node liqMapParser.js --mode csv                            # export CSV
//   node liqMapParser.js --mode plot --html-file heatmap.html  # generate HTML plot

const { readFile, writeFile } = require('fs').promises;
const minimist = require('minimist');

const BASE_URL = 'https://api.coinank.com/api/liqMap/getLiqHeatMap?exchangeName=Binance&symbol=BTCUSDT&interval=3d';

const parseArgs = () => {
  const argv = minimist(process.argv.slice(2), {
    string: ['mode', 'csv-file', 'json-file', 'html-file'],
    default: {
      mode: 'plot',
      'csv-file': 'liq_heatmap.csv',
      'html-file': 'heatmap.html',
      'json-file': 'response.json'
    },
    alias: { m: 'mode', c: 'csv-file', j: 'json-file', o: 'html-file' }
  });
  if (!['plot', 'csv'].includes(argv.mode)) {
    console.error("Invalid mode. Use 'plot' or 'csv'.");
    process.exit(1);
  }
  return argv;
}

/**
 * Load and parse JSON file asynchronously.
 */
const loadData = async (jsonFile) => {
  try {
    const raw = await readFile(jsonFile, 'utf8');
    const resp = JSON.parse(raw);
    return resp.data.liqHeatMap;
  } catch (err) {
    console.error(`Failed to load or parse '${jsonFile}':`, err.message);
    process.exit(1);
  }
};

const requestLiquidationHeatmap = async (exchangeName, symbol, interval) => {
  const url = `${BASE_URL}`;
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-encoding': 'gzip, deflate, br, zstd',
    'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'client': 'web',
    'coinank-apikey': 'LWIzMWUtYzU0Ny1kMjk5LWI2ZDA3Yjc2MzFhYmEyYzkwM2NjfDI4NTg0NTg0ODAwOTMzNDc=',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    'token': '',
    'web-version': '101'
  };
  const response = await fetch(url, { headers });
  const data = await response.json();
  return data;
}



const buildHeatmapMatrix = (heatmapData) => {
  const times = heatmapData.chartTimeArray.map(ts => new Date(ts));
  const prices = heatmapData.priceArray.map(p => parseFloat(p));
  const liquidationVolume = Array.from({ length: times.length }, () => Array(prices.length).fill(0));

  for (const [t_i, p_i, v] of heatmapData.data) {
    liquidationVolume[+t_i][+p_i] = +v;
  }
  return { times, prices, liquidationVolume };
}

const exportCSV = async (heatmapData, times, prices, outputFile) => {
  const header = 'time,price,value\n';
  const lines = heatmapData.data.map(([t_i, p_i, v]) => {
    const time = times[+t_i].toISOString();
    const price = prices[+p_i];
    return `${time},${price},${v}`;
  });
  await writeFile(outputFile, header + lines.join('\n'), 'utf8');
  console.log(`Exported CSV to ${outputFile}`);
}

const generateHTML = async (times, prices, liquidationVolume, maxVal, htmlFile) => {
  const Zt = prices.map((_, pi) => times.map((_, ti) => liquidationVolume[ti][pi]));
  const data = {
    z: Zt,
    x: times.map(t => t.toISOString()),
    y: prices
  };
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
  <title>Liquidation Heatmap</title>
</head>
<body>
  <div id="heatmap" style="width:100%;height:600px;"></div>
  <script>
    const trace = {
      z: ${JSON.stringify(data.z)},
      x: ${JSON.stringify(data.x)},
      y: ${JSON.stringify(data.y)},
      type: 'heatmap',
      colorscale: 'Inferno',
      zmax: ${maxVal},
      zmin: 0
    };
    const layout = {
      title: 'Liquidation Heatmap (5 min bins, 25-unit ticks)',
      xaxis: { title: 'Time' },
      yaxis: { title: 'Price' },
      width: 1200,
      height: 600
    };
    Plotly.newPlot('heatmap', [trace], layout);
  </script>
</body>
</html>`;
  await writeFile(htmlFile, html, 'utf8');
  console.log(`Generated HTML heatmap at ${htmlFile}`);
}

/**
 * Entry point of the CLI.
 */
const main = async () => {
  const args = parseArgs();
  // const heatmapData = await loadData(args['json-file']);

  const heatmapData = await requestLiquidationHeatmap('Binance', 'BTCUSDT', '3d');

  console.log(heatmapData);

  const { times, prices, liquidationVolume } = buildHeatmapMatrix(heatmapData);
  if (args.mode === 'csv') {
    await exportCSV(heatmapData, times, prices, args['csv-file']);
  } else {
    await generateHTML(times, prices, liquidationVolume, heatmapData.maxLiqValue, args['html-file']);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
