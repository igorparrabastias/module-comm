const { env } = require('../lib/env')
const amqpClientConnect = require('../lib/amqpServer')
let channelWrapper = null

module.exports = {
  sendToQueue: async (queueName, { payload, headers }, logger = null) => {
    let data = {}
    if (headers) {
      data = { payload, headers }
    } else {
      data = { payload }
    }

    await channelWrapper
      .sendToQueue(queueName, data, { persistent: true })
      .then(() => {
        if (logger) {
          logger.info(`SENT OK A COLA AMQP: ${queueName}`, data)
        }
      })
      .catch((e) => {
        throw e
      })
  },

  async init(colas, loggerRoot = null) {
    const amqpConn = await amqpClientConnect(loggerRoot)
    if (loggerRoot) {
      loggerRoot.debug(
        `Amqp write on ${env['amqp-host']} in ${env.NODE_ENV} mode.`
      )
    }
    await new Promise((resolve) => {
      if (channelWrapper) {
        loggerRoot.debug('WARNING: Solo usar un channel para enviar')
        resolve()
        return
      }

      channelWrapper = amqpConn.createChannel({
        name: 'channel-sender',
        json: true,
        setup: async (channel) => {
          loggerRoot.debug('CREANDO CHANNEL PARA ENVIAR')

          await Promise.all(
            Object.keys(colas).map(async (queueName) => {
              const q = colas[queueName]
              const options = q.options
              await new Promise((resolve) => {
                channel.assertQueue(queueName, options).then(() => {
                  loggerRoot.debug(`COLA ENVIO ${queueName}`)
                  resolve()
                })
              })
            })
          ) // end Promise.all
        }
      })

      channelWrapper.waitForConnect().then(function () {
        loggerRoot.debug('CHANEL PARA ENVIAR LISTO')
        resolve()
      })
    })
  }
}
