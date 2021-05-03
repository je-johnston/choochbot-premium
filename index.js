const axios = require('axios');
const cheerio = require('cheerio');
const Papa = require('papaparse');
const fs = require('fs');

let config = {};
let startedAt, currentProgressPct, currentProgressEth, activeWorkers, hashrate, walletBalanceEth, 
currentSharePrice, walletBalanceUSD, ethUSDPrice, slowGas, stdGas, fastGas, rapidGas;
let progressSinceLastExecution = 0;
let progressDelta = 0;
let historicalData = [];

const CONFIG_FILE = process.env.CONFIG_FILE || 'config.json';
const HIST_FILE = process.env.HIST_FILE || 'historicaldata.csv';
const MAX_HIST_DATA = process.env.MAX_HIST_DATA || 1000;

async function main() {
  startedAt = new Date().toString();
  console.log(`Beginning execution at: ${startedAt}`);

  //Load the config values from JSON.
  await loadConfig();

  //Build out the current data set.
  await buildCurrentDataset();

  //Load historical data from local file storage.
  await loadHistoricalData();

  //Build computed properties.
  await buildComputedProps();

  //Write current data to local file storage.
  await writeCurrentData();

  //Output data to discord.
  await outputToDiscord();


}

/**
 * Wrapper 
 */
async function buildCurrentDataset() {
  await buildEthermine();
  await buildGasData();
  await buildWalletBalance();
}

/**
 * Hits the ethermine endpoint to get current miner statistics.
 */
async function buildEthermine() {
  let endpoint = `https://api.ethermine.org/miner/${config.WALLET}/dashboard`
  let res = await axios.get(endpoint);
  let currentStats = res.data.data.currentStatistics;
  activeWorkers = currentStats.activeWorkers;

  //Values from the ethermine API need to be rounded off.
  //@todo -> Sloppy.
  hashrate = (currentStats.currentHashrate / 1000000).toFixed(2);
  currentProgressPct = (currentStats.unpaid / 1000000000000000).toFixed(2);
  currentProgressEth = (currentStats.unpaid / 1000000000000000000).toFixed(5);
}

/**
 * Hits the gas endpoint to get the current gas values.
 */
async function buildGasData() {
  let endpoint = `https://www.gasnow.org/api/v3/gas/price?utm_source=:xx`;
  let res = await axios.get(endpoint);
  //Round off the values.
  rapidGas = (res.data.data.rapid / 1000000000).toPrecision(2);
  fastGas = (res.data.data.fast / 1000000000).toPrecision(2);
  stdGas = (res.data.data.standard / 1000000000).toPrecision(2);
  slowGas = (res.data.data.slow / 1000000000).toPrecision(2);
}

/**
 * Hits EthExplorer API to get wallet balance and Eth -> USD Rates.
 */
async function buildWalletBalance() {
  let endpoint = `http://api.ethplorer.io/getAddressInfo/${config.WALLET}?apiKey=freekey`
  let res = await axios.get(endpoint);
  walletBalanceEth = res.data.ETH.balance.toFixed(5);
  ethUSDPrice = res.data.ETH.price.rate.toFixed(2);
  walletBalanceUSD = (walletBalanceEth * ethUSDPrice).toFixed(2);
  currentSharePrice = (walletBalanceUSD / 5).toFixed(2);
}

/**
 * Loads sensitive config values from JSON.
 * @returns 
 */
async function loadConfig() {
  let rawData = fs.readFileSync(`${__dirname}/${CONFIG_FILE}`, 'utf-8');
  config = JSON.parse(rawData);
}

/**
 * Loads historical data from local file storage.
 */
async function loadHistoricalData() {
  let file = fs.readFileSync(HIST_FILE, 'utf-8');
  let histData = Papa.parse(file, { header: true });
  historicalData = histData.data;
}

/**
 * Writes the current data to the CSV file.
 */
async function writeCurrentData() {
  //Make sure we don't fill up my HDD.
  if (historicalData.length >= MAX_HIST_DATA) {
    //@todo -> Write to archive?
    historicalData.shift();
  }

  historicalData.push({
    'timestamp': startedAt,
    'hashrate': hashrate,
    'walletBalanceEth': walletBalanceEth,
    'walletBalanceUSD': walletBalanceUSD,
    'progresspct': currentProgressPct,
    'progresseth': currentProgressEth,
    'progressSinceLastExecution': progressSinceLastExecution
  });
  let outputCSV = Papa.unparse(historicalData, { header: true });
  fs.writeFileSync(HIST_FILE, outputCSV);
}

/**
 * Takes the data, formats it, and outputs to discord.
 */
async function outputToDiscord() {
  let data = {
    "username": "Choochbot Premium",
    "embeds": [
      {
        "title": "Ethermine Dashboard",
        "url": `https://ethermine.org/miners/${config.WALLET}/dashboard`,
        //"color": 15258703,
        "fields": [
          {
            "name": "Current progress",
            "value": `${currentProgressPct}%`,
            "inline": true
          },
          {
            "name": "Active workers",
            "value": `${activeWorkers}`,
            "inline": true
          },
          {
            "name": "Current hashrate",
            "value": `${hashrate} MH/s`,
            "inline": true
          },
          {
            "name": "Wallet Balance (ETH / USD)",
            "value": `${walletBalanceEth} / $${walletBalanceUSD}`,
            "inline": true
          },
          {
            "name": "Payout per Choocher",
            "value": `$${currentSharePrice}`,
            "inline": true
          },
          {
            "name": "Gas Rates",
            "value": `${rapidGas} / ${fastGas} / ${stdGas} / ${slowGas}`,
            "inline": true
          },
          {
            "name": "Current Eth Price",
            "value": `$${ethUSDPrice}`,
            "inline": true
          }
        ],
      }
    ]
  };

  if (progressSinceLastExecution > 0) {
    data.embeds[0].fields.push({
      "name": "Progress since last execution",
      "value": `${progressSinceLastExecution}% (${progressDelta})`,
      "inline": true
    })
  }

  await axios.post(config.DISCORD_ENDPOINT_PROD, data);
}

/**
 * Determine how much of a percentage gain/loss we've had over the last interval.
 */
async function buildComputedProps() {
  if (historicalData.length > 0) {
    //Get where we were at with the last execution.
    let lastProgress = historicalData[historicalData.length - 1].progresspct;
    //Get the delta
    progressSinceLastExecution = (Number(currentProgressPct) - Number(lastProgress)).toPrecision(1);
    
    let lastDelta = historicalData[historicalData.length - 1].progressSinceLastExecution;
    progressDelta = (progressSinceLastExecution - lastDelta).toPrecision(1);
  }
}

main().then(res => {
  console.log(`Finished with: ${res}`);;
}).catch(e => {
  console.log(`Found error: ${JSON.stringify(e.message)}`);
  //@todo -> Notification
})