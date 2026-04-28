import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:3000' })

export async function register(email: string, password: string) {
  return api.post('/auth/register', { email, password })
}

export async function login(email: string, password: string) {
  const res = await api.post<{ accessToken: string; refreshToken: string; sessionId: string }>('/auth/login', { email, password })
  return res.data
}

export async function refreshTokens(refreshToken: string) {
  const res = await api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken })
  return res.data
}

export async function getMe(accessToken: string) {
  const res = await api.get('/me', { headers: { Authorization: `Bearer ${accessToken}` } })
  return res.data
}

export async function getSessions(accessToken: string) {
  const res = await api.get('/sessions', { headers: { Authorization: `Bearer ${accessToken}` } })
  return res.data
}

export async function logout(accessToken: string) {
  return api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${accessToken}` } })
}

export async function logoutAll(accessToken: string) {
  return api.post('/auth/logout-all', {}, { headers: { Authorization: `Bearer ${accessToken}` } })
}

export async function revokeSession(accessToken: string, sessionId: string) {
  return api.delete(`/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
}
