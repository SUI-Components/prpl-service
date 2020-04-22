const {ENV} = process.env
const puppeteer = require(ENV && ENV === 'dev' ? 'puppeteer' : 'puppeteer-core')
const chrome = require('chrome-aws-lambda')
const querystring = require('querystring')

const TARGET_CPU_RATE = 4

// https://stackoverflow.com/questions/23917074/javascript-flooring-number-to-order-of-magnitude
const convert = n => {
  var order = Math.floor(Math.log(n) / Math.LN10 + 0.000000001) // because float math sucks like that
  return Math.pow(10, order)
}

const strategies = {
  longestEvaluation: stats => {
    const statsByDuration = strategies.allEvaluations(stats)

    const [longest] = statsByDuration
    const order = convert(longest.dur)

    return statsByDuration.filter(event => convert(event.dur) === order)
  },
  allEvaluations: stats => {
    const statsByDuration = stats.traceEvents
      .filter(event => event.name === 'EvaluateScript')
      .filter(event => event.args.data.url.endsWith('js'))
      .map(event => {
        return {dur: event.dur / 1000, url: event.args.data.url}
      })
      .sort((a, b) => b.dur - a.dur)

    return statsByDuration
  }
}
async function prplFromURL({
  cdn,
  customHeaders,
  device,
  height,
  strategy = 'allEvaluations',
  url,
  userAgent,
  width
}) {
  try {
    // Setup a browser instance
    const browser = await puppeteer.launch({
      args: chrome.args,
      executablePath: await chrome.executablePath,
      headless: true
    })

    // Create a new page and navigate to it
    const page = await browser.newPage()

    await page.setViewport({width, height})
    await page.setUserAgent(userAgent)
    // customHeaders && (await page.setExtraHTTPHeaders(customHeaders))

    let client
    if (device === 'm') {
      // https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-core/lib/emulation.js#L107
      const conditions = {
        offline: false,
        latency: 150,
        downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8), // kbps
        uploadThroughput: Math.floor((750 * 1024 * 1024) / 8), // kbps
        connectionType: 'cellular3g'
      }
      client = await page.target().createCDPSession()
      await client.send('Emulation.setCPUThrottlingRate', {rate: TARGET_CPU_RATE}) // eslint-disable-line
      await client.send('Network.enable') // eslint-disable-line
      await client.send('Network.emulateNetworkConditions', conditions) // eslint-disable-line
    }

    await page.tracing.start({categories: ['devtools.timeline']})
    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 0
    })
    const buffer = await page.tracing.stop()

    if (client) {
      client.detach()
    }

    if (!response.ok()) {
      throw new Error(
        `Response status code for the url ${url} was ${response.status()}`
      )
    }
    const stats = JSON.parse(buffer.toString())

    await browser.close()

    let json = strategies[strategy](stats)
    json = !cdn ? json : json.filter(event => event.url.match(cdn))

    const resp = {
      customHeaders,
      device,
      height,
      hints: json,
      strategy,
      url,
      userAgent,
      width
    }

    console.log(resp)

    return JSON.stringify(resp)
  } catch (e) {
    throw new Error(e)
  }
}

const devices = {
  m: {
    userAgent:
      'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Mobile Safari/537.36',
    width: 360,
    height: 640
  },
  t: {
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1',
    width: 768,
    height: 1024
  },
  d: {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36',
    width: 1024,
    height: 768
  }
}

module.exports = async (req, res) => {
  const qs = querystring.parse(req.url.split('?')[1])
  const device = qs.device
  const url = qs.url
  const cdn = qs.cdn
  const strategy = qs.strategy
  const customHeaders = req.headers
  // get the deviceInfo depending on the device path used, by default is mobile
  const {width, height, userAgent} = devices[device] || devices.m

  try {
    const prpl = await prplFromURL({
      cdn,
      customHeaders,
      device,
      height,
      strategy,
      url,
      userAgent,
      width
    })

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    return res.end(prpl)
  } catch (error) {
    console.error(error) // eslint-disable-line
    res.statusCode = 400
    return res.end(error.toString())
  }
}
