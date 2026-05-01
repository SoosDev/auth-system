import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { rateLimit } from '../rate-limit/rate-limit.middleware.js'
import { changePassword } from '../auth/auth.service.js'

export async function usersRouter(app: FastifyInstance) {
  app.get('/me', {
    preHandler: [authenticate, rateLimit({ key: 'user', limit: 100, window: 60 })]
  }, async (request, reply) => {
    return reply.send({ user: request.user })
  })

  app.post('/me/change-password', { preHandler: [authenticate] }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string }
    try {
      await changePassword(request.user!.userId, currentPassword, newPassword)
      return reply.send({ message: 'Password changed. All sessions have been revoked.' })
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message })
      throw err
    }
  })

  app.get('/admin/dashboard', {
    preHandler: [authenticate, requireRole('admin')]
  }, async (request, reply) => {
    return reply.send({ message: 'Welcome, admin.', user: request.user })
  })
}
