const retryable = require('async/retryable')

const retry = (
  procedure,
  params,
  opts = {
    times: 5,
    interval: 100
  }
) => {
  return new Promise((resolve, reject) => {
    let i = 0

    const apiMethod = async (callback) => {
      if (i > 0) {
        console.warn(`Intento ${++i} de ${procedure.name}`, { params, opts })
      }
      try {
        const result = await procedure(params)
        callback(null, result)
      } catch (e) {
        callback(e)
      }
    }

    const londonCalling = retryable(opts, (callback) => apiMethod(callback))

    londonCalling((e, result) => {
      if (e) {
        return reject(e)
      }
      resolve(result)
    })
  })
}

module.exports = {
  retry: retry
}
