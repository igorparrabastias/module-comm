const amqpClientConnect = require('../lib/amqpServer')
let channelWrapper = null

module.exports = {
  async init(colas, amqpReceiverAdapter, loggerRoot = null) {
    const amqpConn = await amqpClientConnect(loggerRoot)

    if (!loggerRoot) {
      loggerRoot = console
      // console.warn escribe a pm2 logs
      loggerRoot.debug = console.warn
      loggerRoot.fatal = console.warn
    }

    await new Promise((resolve) => {
      if (channelWrapper) {
        loggerRoot.debug('FATAL: Solo usar un channel para recibir')
        return
      }

      channelWrapper = amqpConn.createChannel({
        name: 'channel-receiver',
        setup: async (ch) => {
          loggerRoot.debug('CREANDO CHANNEL PARA CONSUMIR')

          await Promise.all(
            Object.keys(colas).map(async (queueName) => {
              // Configurar cola
              const cola = colas[queueName]
              const options = cola.options
              const prefetch = cola.prefetch || 1

              await new Promise((resolve) => {
                ch.assertQueue(queueName, options)
                  .then(async () => {
                    if (
                      options.arguments &&
                      options.arguments['x-dead-letter-routing-key'] &&
                      options.arguments['x-dead-letter-exchange']
                    ) {
                      const rk = options.arguments['x-dead-letter-routing-key']
                      const exc = options.arguments['x-dead-letter-exchange']

                      loggerRoot.debug(`Creando dead exchange: ${exc}.dl`)
                      await ch.assertExchange(exc, 'direct', { durable: true })

                      // Crear su respectivo dead-letter
                      loggerRoot.debug(`Creando dead letter: ${queueName}.dl`)
                      await ch.assertQueue(`${queueName}.dl`, {
                        durable: true
                      })

                      loggerRoot.debug(`Binding dead letter: ${queueName}.dl`)
                      await ch.bindQueue(rk, exc, rk)
                    }
                  })
                  .then(() => {
                    ch.prefetch(prefetch)
                    amqpReceiverAdapter(ch, queueName, cola)
                  })
                  .then(() => {
                    loggerRoot.debug(`COLA CONSUMO ${queueName}`)
                    resolve()
                  })
              })
            })
          ) // end Promise.all
        }
      })

      channelWrapper.waitForConnect().then(function () {
        loggerRoot.debug('CHANEL PARA CONSUMIR LISTO')
        resolve()
      })
    })
  }
}
