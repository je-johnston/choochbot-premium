const axios = require('axios');

let currentProgressPct, activeWorkers, hashrate, walletBalanceEth, 
currentSharePrice, walletBalanceUSD, ethUSDPrice, slowGas, stdGas, fastGas, rapidGas;
let progressSinceLastExecution = 0;
let progressDelta = 0;

const WALLET = process.env.WALLET || '';
const ENDPOINT = process.env.ENDPOINT || '';
const NUM_CHOOCHERS = process.env.NUM_CHOOCHERS || 3;

exports.handler = async (event) => {
  console.log(`Beginning execution at: ${new Date()}`);

  if(!WALLET) {
    throw new Error(`Wallet env undefined`);
  }

  if(!ENDPOINT) {
    throw new Error(`Endpoint env undefined`)
  }

  //Build out the current data set.
  await buildDataset();

  //Output data to discord.
  await outputToDiscord();
}

/**
 * Wrapper 
 */
async function buildDataset() {
  await buildEthermine();
  await buildGasData();
  await buildWalletBalance();
}

/**
 * Hits the ethermine endpoint to get current miner statistics.
 */
async function buildEthermine() {
  let endpoint = `https://api.ethermine.org/miner/${WALLET}/dashboard`
  let res = await axios.get(endpoint);
  let currentStats = res.data.data.currentStatistics;
  activeWorkers = currentStats.activeWorkers;

  //Values from the ethermine API need to be rounded off.
  //@todo -> Sloppy.
  hashrate = (currentStats.currentHashrate / 1000000).toFixed(2);
  currentProgressPct = (currentStats.unpaid / 2000000000000000).toFixed(2);
  currentProgressEth = (currentStats.unpaid / 2000000000000000000).toFixed(5);
}

/**
 * Hits the gas endpoint to get the current gas values.
 */
async function buildGasData() {
  try {
  let endpoint = `https://etherchain.org/api/gasnow`;
  
  let res = await axios.get(endpoint);
  //Round off the values.
  rapidGas = (res.data.data.rapid / 1000000000).toPrecision(3);
  fastGas = (res.data.data.fast / 1000000000).toPrecision(3);
  stdGas = (res.data.data.standard / 1000000000).toPrecision(3);
  slowGas = (res.data.data.slow / 1000000000).toPrecision(3);
  } catch(e) {
    rapidGas = 'error';
    fastGas = 'error';
    stdGas = 'error';
    slowGas = 'error';
  }

}

/**
 * Hits EthExplorer API to get wallet balance and Eth -> USD Rates.
 */
async function buildWalletBalance() {
  let endpoint = `http://api.ethplorer.io/getAddressInfo/${WALLET}?apiKey=freekey`
  let res = await axios.get(endpoint);
  walletBalanceEth = res.data.ETH.balance.toFixed(5);
  ethUSDPrice = res.data.ETH.price.rate.toFixed(2);
  walletBalanceUSD = (walletBalanceEth * ethUSDPrice).toFixed(2);
  currentSharePrice = (walletBalanceUSD / NUM_CHOOCHERS).toFixed(2);
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
        "url": `https://ethermine.org/miners/${WALLET}/dashboard`,
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

  await axios.post(ENDPOINT, data);
}


this.handler().then(res => {
  console.log(res)
})
