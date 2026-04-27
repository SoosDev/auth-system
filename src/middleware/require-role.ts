import { FastifyRequest, FastifyReply } from 'fastify'

export function requireRole(role: string) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({ error: 'Not authenticated' })
    }
    if (!request.user.roles.includes(role)) {
      return reply.status(403).send({ error: `Requires role: ${role}` })
    }
  }
}
