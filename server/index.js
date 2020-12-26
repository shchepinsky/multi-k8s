const keys = require('./keys.js')
const pg = require('pg')
const redis = require('redis')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const app = express()

function assertAssigned ([key, value]) {
  if (value === undefined) {
    console.error(`Missing env var key: ${key}`)
    return true
  }
}

async function redisSetup () {
  return new Promise((resolve, reject) => {
    const redisConf = {
      host: keys.redisHost,
      port: keys.redisPort,
      retry_strategy: () => 1000,
    }
    const redisClient = redis.createClient(redisConf)

    redisClient.on_error((err) => {
      console.error(`Server: on_error connecting to redis at ${redisConf.host}:${redisConf.port} \n` + err.message)
      reject(err)
    })

    redisClient.on('connect', () => {
      console.log(`Server: redis connected at ${redisConf.host}:${redisConf.port}`)
      resolve(redisClient)
    })

    redisClient.on('error', (err) => {
      console.error(`Server: error connecting to redis at ${redisConf.host}:${redisConf.port} \n` + err.message)
      reject(err)
    })
  })
}

async function pgSetup () {
  return new Promise(async (resolve, reject) => {
    const pgClient = new pg.Client({
      user: keys.pgUser,
      host: keys.pgHost,
      database: keys.pgDatabase,
      password: keys.pgPassword,
      port: keys.pgPort,
    })

    pgClient.on('error', (err) => {
      console.error('Lost PG connection')
      reject(err)
    })

    pgClient.on('connect', () => {
      console.info('@@ DEBUG')

      console.log(`Postgres connected: ${keys.pgHost}:${keys.pgPort}`)
      pgClient
        .query('CREATE TABLE IF NOT EXISTS values (number INT)')
        .then(() => resolve(pgClient))
        .catch((err) => {
          console.error(err)
          reject(err)
        })
    })

    await pgClient.connect()
  })
}

async function main () {
  if (Object.entries(keys).some(assertAssigned)) {
    process.exit(-1)
  }

  app.use(cors())
  app.use(bodyParser.json())

  // Postgres client setup
  const pgClient = await pgSetup()

  // Redis client setup
  const redisClient = await redisSetup()
  const redisPublisher = redisClient.duplicate()

  // Express route handlers
  app.get('/', (req, res) => {
    res.send('hi')
  })

  app.get('/values/all', async (req, res) => {
    const values = await pgClient.query('SELECT * FROM values')

    res.send(values.rows)
  })

  app.get('/values/current', (req, res) => {
    redisClient.hgetall('values', (err, values) => {
      if (err) {
        res.status(500).send(err)
        return err
      }

      res.send(values)
    })
  })

  app.post('/values', async (req, res) => {
    const index = req.body.index
    if (parseInt(index) > 40) {
      return res.status(422).send('Index too high')
    }

    redisClient.hset('values', index, 'Nothing yet')
    redisPublisher.publish('insert', index)

    pgClient.query(
      'INSERT INTO values(number) VALUES($1)',
      [index]
    )

    res.send({ working: true })
  })

  const server = await app.listen(5000)
  server.on('error', (e) => console.error(e))
}

main()
  .then(() => {
    console.log('Server listening')
  })
  .catch((e) => {
    console.error(e)
    process.exit(-1)
  })