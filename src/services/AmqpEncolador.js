module.exports = {

  send (queueName, payload, axiosEncolador, tracers, logger) {

    const headers = {
      'x-tracer-session-id': tracers.sessionId,
      'x-tracer-user-id': tracers.userId,
      'x-tracer-systems': tracers.systems
    }

    logger.info(`A ENCOLADOR: ${queueName}`, {payload, headers})

    return axiosEncolador.post('queue', {queueName, payload, headers})
  }
}
