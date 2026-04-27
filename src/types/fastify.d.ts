import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string
      sessionId: string
      roles: string[]
    }
  }
}
