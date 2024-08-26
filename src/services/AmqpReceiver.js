const amqpClientConnect = require("../lib/amqpServer");
let channelWrapper = null;

module.exports = {
  async init(colas, amqpReceiverAdapter, loggerRoot = null) {
    const amqpConn = await amqpClientConnect(loggerRoot);

    if (!loggerRoot) {
      loggerRoot = console;
      // console.warn escribe a pm2 logs
      loggerRoot.debug = console.warn;
      loggerRoot.fatal = console.warn;
    }

    if (channelWrapper) {
      loggerRoot.debug("FATAL: Solo usar un channel para recibir");
      return; // Asegúrate de no proceder si el canal ya está establecido
    }

    channelWrapper = amqpConn.createChannel({
      name: "channel-receiver",
      setup: async (ch) => {
        loggerRoot.debug("CREANDO CHANNEL PARA CONSUMIR");

        try {
          // Corregido para manejar y devolver promesas correctamente
          return Promise.all(
            Object.keys(colas).map(async (queueName) => {
              const cola = colas[queueName];
              const options = cola.options;
              const prefetch = cola.prefetch || 1;

              // Uso correcto de promesas sin envolver en una nueva promesa innecesariamente
              await ch.assertQueue(queueName, options);
              if (
                options.arguments &&
                options.arguments["x-dead-letter-routing-key"] &&
                options.arguments["x-dead-letter-exchange"]
              ) {
                const rk = options.arguments["x-dead-letter-routing-key"];
                const exc = options.arguments["x-dead-letter-exchange"];

                loggerRoot.debug(`Creando dead exchange: ${exc}.dl`);
                await ch.assertExchange(exc, "direct", { durable: true });

                loggerRoot.debug(`Creando dead letter: ${queueName}.dl`);
                await ch.assertQueue(`${queueName}.dl`, { durable: true });

                loggerRoot.debug(`Binding dead letter: ${queueName}.dl`);
                await ch.bindQueue(`${queueName}.dl`, exc, rk);
              }

              ch.prefetch(prefetch);
              amqpReceiverAdapter(ch, queueName, cola);
              loggerRoot.debug(`COLA CONSUMO ${queueName}`);
            })
          ); // end Promise.all
        } catch (error) {
          loggerRoot.error(`Error al configurar las colas: ${error.message}`);
        }
      },
    });

    // Espera a que el canal esté conectado antes de resolver
    await channelWrapper.waitForConnect();
    loggerRoot.debug("CHANNEL PARA CONSUMIR LISTO");
  },
};
