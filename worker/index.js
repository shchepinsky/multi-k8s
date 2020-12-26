const keys = require('./keys')
const redis = require('redis')

function assertAssigned ([key, value]) {
  if (value === undefined) {
    console.error(`Missing env var key: ${key}`)
    return true
  }
}

async function setupRedis() {
  return new Promise( (resolve, reject) => {
    const client = redis.createClient({
      host: keys.redisHost,
      port: keys.redisPort,
      retry_strategy: () => 1000
    })

    client.on('connect', () => {
      console.log(`Worker: redis connected at ${keys.redisHost}:${keys.redisPort}`)
      resolve(client)
    })

    client.on('error', (err) => {
      console.error(`Worker: error connecting to redis at ${keys.redisHost}:${keys.redisPort} \n` + err.message)
      reject(err)
    })
  })
}

async function main () {
  if (Object.entries(keys).some(assertAssigned)) {
    process.exit(-1)
  }

  const redisClient = await setupRedis()

  const sub = redisClient.duplicate()

  function fib (index) {
    if (index < 2) {
      return 1
    }

    return fib(index - 1) + fib(index - 2)
  }

  sub.on('message', (channel, message) => {
    const index = parseInt(message)
    redisClient.hset('values', message, fib(index))
  })

  sub.subscribe('insert')
}

main().catch((e) => {
  console.error(e)
  process.exit(-1)
})