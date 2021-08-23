const { env } = require('./env')
const amqp = require('amqp-connection-manager')
const amqpHost = env['amqp-host']

// No se puede exportar en commonJs (es null)
let amqpConn = null

function amqpClientConnect(loggerRoot) {
  if (!loggerRoot) {
    loggerRoot = console
    // console.warn escribe a pm2 logs
    loggerRoot.debug = console.warn
    loggerRoot.fatal = console.warn
  }

  return new Promise((resolve, reject) => {
    if (amqpConn !== null) {
      if (amqpConn.isConnected()) {
        loggerRoot.debug('Devolviendo conneccion amqp ya iniciada')
        return resolve(amqpConn)
      }
    } else {
      loggerRoot.debug('Iniciando nueva conneccion amqp')
    }

    // Devuelve singleton. Se conecta ahora.
    amqpConn = amqp.connect(amqpHost)

    // Emitted whenever we successfully connect to a broker.
    amqpConn.on('connect', function (a, b) {
      loggerRoot.debug('CLIENTE AMQP CONECTADO')
      resolve(amqpConn)
    })

    // Emitted whenever we disconnect from a broker.
    amqpConn.on('disconnect', function (params) {
      const error = params.err
      if (error.includes && error.includes('PRECONDITION_FAILED')) {
        /**
         * This error results in the channel that was used for the declaration being
         * forcibly closed by RabbitMQ. If the program subsequently tries to
         * communicate with RabbitMQ using the same channel without re-opening it then
         * Bunny will raise a Bunny::ChannelAlreadyClosed error. In order to continue
         * communications in the same program after such an error, a different channel
         * would have to be used.
         *
         * TODO: Sacar cola de lista de colas para evitar siguientes errores en
         * presente instancia de app.
         * Luego habria quer reparar cola.
         */
        loggerRoot.fatal('Sacar cola de lista de colas !', error)
      }
      loggerRoot.fatal('CLIENTE AMQP DESCONECTADO, error.stack:', error.stack)
    })
  })
}

module.exports = amqpClientConnect
