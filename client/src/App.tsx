import { useState } from 'react'
import { login, refreshTokens, getMe, getSessions, logout, logoutAll, revokeSession } from './api'

interface Session {
  id: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  expiresAt: string
}

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [activeSessions, setActiveSessions] = useState<Session[]>([])
  const [error, setError] = useState('')
  const [log, setLog] = useState<string[]>([])

  function addLog(msg: string) {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])
  }

  async function refreshSessionList(token: string) {
    const sessionsData = await getSessions(token)
    setActiveSessions(sessionsData.sessions)
  }

  async function handleLogin() {
    try {
      const data = await login(email, password)
      setAccessToken(data.accessToken)
      setRefreshToken(data.refreshToken)
      setCurrentSessionId(data.sessionId)
      const meData = await getMe(data.accessToken)
      setUser(meData.user)
      await refreshSessionList(data.accessToken)
      setError('')
      addLog(`Logged in. Session ID: ${data.sessionId}`)
    } catch {
      setError('Login failed.')
    }
  }

  async function handleRefresh() {
    if (!refreshToken) return
    try {
      const data = await refreshTokens(refreshToken)
      setAccessToken(data.accessToken)
      setRefreshToken(data.refreshToken)
      await refreshSessionList(data.accessToken)
      addLog('Tokens refreshed. Old refresh token is now invalid.')
    } catch {
      addLog('Refresh failed — session may be revoked.')
      setError('Refresh failed.')
    }
  }

  async function handleRevokeSession(sessionId: string) {
    if (!accessToken) return
    try {
      await revokeSession(accessToken, sessionId)
      addLog(`Session ${sessionId.slice(0, 8)}… revoked.`)
      if (sessionId === currentSessionId) {
        setAccessToken(null); setRefreshToken(null); setUser(null); setActiveSessions([])
      } else {
        await refreshSessionList(accessToken)
      }
    } catch {
      addLog(`Failed to revoke session ${sessionId.slice(0, 8)}…`)
    }
  }

  async function handleLogout() {
    if (!accessToken) return
    await logout(accessToken)
    addLog('Logged out. Current session revoked.')
    setAccessToken(null); setRefreshToken(null); setUser(null); setActiveSessions([])
  }

  async function handleLogoutAll() {
    if (!accessToken) return
    await logoutAll(accessToken)
    addLog('All sessions revoked. Access token also immediately invalid (liveness check).')
    setAccessToken(null); setRefreshToken(null); setUser(null); setActiveSessions([])
  }

  if (!user) {
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 400 }}>
        <h1>Auth System</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={handleLogin}>Login</button>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    )
  }

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 700 }}>
      <h1>Logged in</h1>
      <p><strong>User ID:</strong> {user.userId}</p>
      <p><strong>Roles:</strong> {user.roles.join(', ')}</p>
      <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#666' }}>
        Current session: {currentSessionId}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button onClick={handleRefresh}>Refresh Tokens</button>
        <button onClick={handleLogout}>Logout This Device</button>
        <button onClick={handleLogoutAll}>Logout All Devices</button>
      </div>

      <h2>Active Sessions ({activeSessions.length})</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th>Session ID</th>
            <th>Device</th>
            <th>IP</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {activeSessions.map(s => (
            <tr key={s.id} style={{ background: s.id === currentSessionId ? '#f0f8ff' : undefined }}>
              <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                {s.id.slice(0, 8)}…
                {s.id === currentSessionId && <strong> (this device)</strong>}
              </td>
              <td>{s.userAgent?.slice(0, 40) ?? 'Unknown'}</td>
              <td>{s.ipAddress ?? '—'}</td>
              <td>{new Date(s.createdAt).toLocaleString()}</td>
              <td>
                <button onClick={() => handleRevokeSession(s.id)} style={{ fontSize: 11 }}>
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Token Lifecycle Log</h2>
      <ul style={{ fontFamily: 'monospace', fontSize: 12 }}>
        {log.map((entry, i) => <li key={i}>{entry}</li>)}
      </ul>
    </div>
  )
}
