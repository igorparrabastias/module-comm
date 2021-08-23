/* eslint-disable promise/always-return */
import AmqpSender from '../AmqpSender'
const { closeAmqpConn } = require('../../lib/amqpServer')
const AmqpReceiver = require('../AmqpReceiver')

const axios = require('axios')
const MockAdapter = require('axios-mock-adapter')

/**
 * Aplicando mock a instancia common de axios!
 * Se veran afectados todas las llamadas. Esto obliga a simular mocks en todos
 * los tests.
 */
const mockAxios = new MockAdapter(axios)

const EventEmitter = require('events').EventEmitter
const controlEmitter = new EventEmitter()

const uuidv1 = require('uuid/v1')

const colas = {
  'task.test.q': {
    options: {
      durable: true
    },
    forwardUrls: '/final-endpoint',
    prefetch: 1
  }
}

const bodyMessageToTest = {
  queueName: 'task.test.q',
  routingKey: 'task.test.q',
  headers: {
    'x-tracer-user-id': 3,
    'x-tracer-session-id': uuidv1()
  },
  payload: {
    foo: 'bar' // Aqui no testeamos contenido
  }
}

/**
 * Ver si hace ack, nack, requeue (esto siempre consume el mensaje,
 * luego no se puede analizar que pasó con el mensaje, por que desaparece)
 *
 * Si hace requeue y es nack ver si quedó en dlx
 * Si no hace requeue y es nack ver que no quedó en dlx
 * Para analizar dlx hay que consumir ultimo mensaje en cola dead.letter.queue
 *
 * Es delicado testear colas en prod, ya que pueden causar loops infinitos
 * al hacer caer la conn. Como tenemos autolevantamiento de conn se pueden
 * causar estos loops infinitos.
 */

describe('Api de Desencolación', () => {
  let receiver, sender

  beforeAll(async () => {
    // const desencolador = new Desencolador({axios})
    // receiver = await new AmqpReceiver({desencolador})
    // sender = await new AmqpSender()
  })

  afterAll(() => {
    // Siempre cerrar, para evitar cuelgue de jest
    closeAmqpConn()
  })

  it.only('Desencolar mensajes desde colas', async () => {
    expect.assertions(1)

    mockAxios.onPost('/final-endpoint').reply(200)

    // Set promesa antes de todo para que escuche des de ya el evento "consuming"
    const result = new Promise(function (resolve, reject) {
      controlEmitter.on('consuming', ({ op }) => {
        if (op === 'ack') {
          return resolve(true)
        }
        reject(new Error())
      })
    })

    const onMessage = (queuePayload) => {
      const dataEnCola = JSON.parse(queuePayload.content.toString())
      console.warn({ dataEnCola }) // Contiene {payload, headers}

      const op = 'ack'
      controlEmitter.emit('consuming', { op, queuePayload })
    }

    const queueName = 'task.test.q'

    function receiverAdapter(ch, queueName, cola) {
      console.warn({ cola })
      return ch.consume(queueName, onMessage, {
        noAck: false
      })
    }

    await AmqpSender.init(colas)
    await AmqpReceiver.init(colas, receiverAdapter)

    // Enviamos mensaje a cola
    await AmqpSender.sendToQueue(queueName, { testendo: 'esto' })

    await result.then((r) => {
      console.warn('Desencolado OK')
      expect(r).toBe(true)
    })
  })

  it('Mensajes rechazado en api remota (simulando status 400), ver si quedó en dlx.', async () => {
    // expect.assertions(1)

    mockAxios.onPost('/final-endpoint').reply(400)
    const desencolador = new Desencolador({ axios })
    receiver = await new AmqpReceiver({ desencolador })

    // Set promesa antes de todo para que escuche desde ya
    // evento consuming
    const result = new Promise(function (resolve, reject) {
      controlEmitter.on('consuming', ({ op }) => {
        if (op === 'nack') {
          return resolve(true)
        }
        reject(new Error())
      })
    })

    await receiver.loadColas(colas)

    // Esto es lo estamos testeando
    await receiver.initListenig(controlEmitter)

    const body = bodyMessageToTest

    // Enviamos mensaje a cola
    const config = new QueueConfig(body)
    await sender.execute(config)

    await result.then((r) => {
      console.warn('Mensajes rechazado en api remota, ver si quedó en dlx.')
      expect(r).toBe(true)
    })
  })

  /**
   * Si limpio la cola antes de testear puedo analizar siempre el ultimo mensaje,
   * si no tengo que leer hasta encontrar un token dado
   */
})

function setup() {
  const axiosOK = {
    post: jest.fn(() => {
      return {
        status: 200
      }
    })
  }

  return { axiosOK }
}
