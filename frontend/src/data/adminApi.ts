const TOKEN_KEY = 'scp_admin_token'

/**
 * База API. В вебе — пусто (Vite проксирует /api → Django, в проде nginx).
 * В нативном приложении (Capacitor) страницы отдаются с https://localhost,
 * поэтому адрес сервера задаётся при сборке: VITE_API_URL=https://api.example.kg
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/** Абсолютная ссылка на файл из /uploads (в приложении — на сервер API). */
export const fileUrl = (path: string) => (path.startsWith('/') ? API_BASE + path : path)

export const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result = { status: number; ok: boolean; json: any }

/** Событие «сессия истекла»: Admin.tsx слушает и показывает экран входа. */
export const UNAUTHORIZED_EVENT = 'scp:unauthorized'

export async function adminApi(
  method: string,
  path: string,
  body?: unknown,
  isForm = false,
): Promise<Result> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload: BodyInit | undefined
  if (isForm) {
    payload = body as BodyInit
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  try {
    const res = await fetch(API_BASE + path, { method, headers, body: payload })
    const json = await res.json().catch(() => null)
    if (res.status === 401 && token && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    return { status: res.status, ok: res.ok, json }
  } catch {
    return { status: 0, ok: false, json: { error: 'Нет связи с сервером' } }
  }
}
