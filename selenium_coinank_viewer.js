const { Builder } = require('selenium-webdriver');
const { Options } = require('selenium-webdriver/chrome');
const minimist = require('minimist');
const { writeFile } = require('fs').promises;

// Parse CLI arguments
//  --csv, -c      export to CSV (optional path or default filename)
//  --headless, -h run Chrome in headless mode
const argv = minimist(process.argv.slice(2), {
  alias: { c: 'csv', h: 'headless' },
  boolean: ['headless'],
  string: ['csv'],
  default: { csv: null, headless: false }
});
const csvFilePath = argv.csv != null
  ? (argv.csv === true ? 'liq_heatmap.csv' : argv.csv)
  : null;
const headless = argv.headless;

const TARGET_URL = 'https://coinank.com/liqHeatMapChart/suiusdt/1d';
const INITIAL_WAIT_MS = 5 * 1000;
const TOTAL_STAY_MS = 10 * 1000;

/**
 * Returns the JavaScript snippet to inject into the page
 * for capturing the liquidation heatmap API response.
 */
const getInjectionScript = () => {
  return `
    window._lastLiqHeatMapResponse = null;
    (function() {
      const targetEndpoint = '/api/liqMap/getLiqHeatMap';

      // Override fetch
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (args[0].includes(targetEndpoint)) {
          try {
            window._lastLiqHeatMapResponse = await response.clone().json();
          } catch {}
        }
        return response;
      };

      // Override XHR
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalOpen.call(this, method, url);
      };

      XMLHttpRequest.prototype.send = function(body) {
        this.addEventListener('load', () => {
          if (this._url && this._url.includes(targetEndpoint)) {
            try {
              window._lastLiqHeatMapResponse = JSON.parse(this.responseText);
            } catch {}
          }
        });
        return originalSend.call(this, body);
      };
    })();
  `;
}

/**
 * Initializes and returns a Chrome WebDriver instance with performance logging enabled.
 */
const createDriver = async () => {
  const options = new Options();
  options.setLoggingPrefs({ performance: 'ALL' });
  // Enable headless mode if requested
  if (headless) {
    options.addArguments('--headless');
  }

  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
}

/**
 * Injects the capture script at document start.
 */
const injectCaptureScript = async (driver) => {
  const script = getInjectionScript();
  await driver.sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', { source: script });
}

/**
 * Navigates the browser to the target URL and waits for the page title.
 */
const navigateToPage = async (driver, url) => {
  await driver.get(url);
  const title = await driver.getTitle();
  console.log(`Page title: "${title}"`);
}

/**
 * Waits for a given period (in milliseconds).
 */
const waitFor = async (driver, ms) => {
  await driver.sleep(ms);
}

/**
 * Retrieves the captured API response from the page context.
 */
const captureApiResponse = async (driver) => {
  const data = await driver.executeScript('return window._lastLiqHeatMapResponse;');
  return data;
}

/**
 * Gracefully quits the WebDriver instance.
 */
const quitDriver = async (driver) => {
  if (!driver) return;
  try {
    await driver.quit();
  } catch (err) {
    console.error('Error quitting WebDriver:', err);
  }
}

/**
 * Builds times and prices arrays from API data.
 */
const buildHeatmapMatrix = (heatmapData) => {
  const times = heatmapData.chartTimeArray.map(ts => new Date(ts));
  const prices = heatmapData.priceArray.map(p => parseFloat(p));
  return { times, prices };
};

/**
 * Exports API data into a CSV file matching liqMapParser.js format.
 */
const exportCsv = async (heatmapData, filePath) => {
  const { times, prices } = buildHeatmapMatrix(heatmapData);
  const header = 'time,price,value\n';
  const lines = heatmapData.data.map(([t_i, p_i, v]) => {
    const time = times[+t_i].toISOString();
    const price = prices[+p_i];
    return `${time},${price},${v}`;
  });
  await writeFile(filePath, header + lines.join('\n'), 'utf8');
  console.log(`CSV exported to ${filePath}`);
};

/**
 * Main orchestration function.
 */
const main = async () => {
  let driver;

  try {
    driver = await createDriver();
    await injectCaptureScript(driver);
    await navigateToPage(driver, TARGET_URL);

    console.log(`Waiting ${INITIAL_WAIT_MS / 1000}s for API calls...`);
    await waitFor(driver, INITIAL_WAIT_MS);

    const apiResponse = await captureApiResponse(driver);
    if (apiResponse && apiResponse.data && apiResponse.data.liqHeatMap) {
      const heatmapData = apiResponse.data.liqHeatMap;
      if (csvFilePath) {
        await exportCsv(heatmapData, csvFilePath);
      }
    } else {
      console.warn('No valid heatmap data found in API response.');
    }

    const remainingMs = TOTAL_STAY_MS - INITIAL_WAIT_MS;
    if (remainingMs > 0) {
      console.log(`Staying on page for ${remainingMs / 1000}s...`);
      await waitFor(driver, remainingMs);
    }
  } catch (err) {
    console.error('Script failed:', err);
    process.exitCode = 1;
  } finally {
    await quitDriver(driver);
  }
}

main();