const { retry } = require('../lib/retry')
const { env } = require('../lib/env')
const mailer = require('nodemailer')
const smtp = require('nodemailer-smtp-transport')

let transportEmail

async function emailer(messageObj) {
  if (!transportEmail) {
    const user = env.emailer.user
    const pass = env.emailer.pass
    transportEmail = mailer.createTransport(
      smtp({
        host: 'in-v3.mailjet.com',
        port: 25,
        auth: { user, pass }
      })
    )
  }
  await transportEmail.sendMail(messageObj)
}

module.exports = {
  send: (logger, messageObj) => {
    return new Promise((resolve, reject) => {
      retry(emailer, messageObj, {
        times: 5,
        interval: (retryCount) => {
          const inter = 50 * Math.pow(2, retryCount)
          const m = `Reintento count: ${retryCount}, int:${inter}`
          logger.info(m)
          return inter
        }
      })
        .then((response) => resolve(response))
        .catch((error) => reject(error))
    })
  }
}
