import { FastifyInstance } from 'fastify'
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas.js'
import { registerUser, loginUser, refreshSession, logoutSession, revokeAllUserSessions } from './auth.service.js'
import { authenticate } from '../../middleware/authenticate.js'
import { rateLimit } from '../rate-limit/rate-limit.middleware.js'

function handleError(err: any, reply: any) {
  if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message })
  throw err
}

export async function authRouter(app: FastifyInstance) {
  app.post('/auth/register', { schema: registerSchema }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }
    try {
      await registerUser(email, password)
      return reply.status(201).send({ message: 'User registered successfully' })
    } catch (err) { return handleError(err, reply) }
  })

  app.post('/auth/login', {
    schema: loginSchema,
    preHandler: [rateLimit({ key: 'ip', limit: 5, window: 60 })],
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }
    try {
      const tokens = await loginUser(email, password, request.headers['user-agent'], request.ip)
      return reply.send(tokens)
    } catch (err) { return handleError(err, reply) }
  })

  app.post('/auth/refresh', { schema: refreshSchema }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string }
    try {
      const tokens = await refreshSession(refreshToken)
      return reply.send(tokens)
    } catch (err) { return handleError(err, reply) }
  })

  app.post('/auth/logout', { preHandler: [authenticate] }, async (request, reply) => {
    await logoutSession(request.user!.sessionId)
    return reply.send({ message: 'Logged out successfully' })
  })

  app.post('/auth/logout-all', {
    preHandler: [authenticate, rateLimit({ key: 'ip', limit: 20, window: 60 })],
  }, async (request, reply) => {
    await revokeAllUserSessions(request.user!.userId)
    return reply.send({ message: 'All sessions revoked' })
  })
}
