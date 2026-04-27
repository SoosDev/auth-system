import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
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
