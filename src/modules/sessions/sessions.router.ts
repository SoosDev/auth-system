import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { rateLimit } from '../rate-limit/rate-limit.middleware.js'
import { getActiveSessions, revokeSession } from './sessions.service.js'

export async function sessionsRouter(app: FastifyInstance) {
  app.get('/sessions', {
    preHandler: [authenticate, rateLimit({ key: 'user', limit: 30, window: 60 })]
  }, async (request, reply) => {
    const result = await getActiveSessions(request.user!.userId)
    return reply.send({ sessions: result })
  })

  app.delete('/sessions/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await revokeSession(id, request.user!.userId)
      return reply.send({ message: 'Session revoked' })
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message })
      throw err
    }
  })
}
