import 'server-only'

export function isAgentRequestAuthorized(req: Request) {
  const expected = process.env.AGENT_INTERNAL_TOKEN ?? ''
  if (!expected) return false

  const bearer = req.headers.get('authorization') ?? ''
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : req.headers.get('x-agent-token') ?? ''
  return token === expected
}
