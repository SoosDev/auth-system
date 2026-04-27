import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { authRouter } from './modules/auth/auth.router.js'
import 'dotenv/config'

export function buildServer() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  })

  app.register(cors, {
    origin: process.env.NODE_ENV === 'production' ? ['https://yourdomain.com'] : true,
    credentials: true,
  })

  app.register(cookie)

  if (process.env.NODE_ENV !== 'test') {
    app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    })
  }

  app.register(authRouter)

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}

if (process.env.NODE_ENV !== 'test') {
  const app = buildServer()
  const port = Number(process.env.PORT ?? 3000)
  app.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) { app.log.error(err); process.exit(1) }
  })
}
