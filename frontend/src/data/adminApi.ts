const TOKEN_KEY = 'scp_admin_token'

export const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

type Result = { status: number; ok: boolean; json: any }

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

  const res = await fetch(path, { method, headers, body: payload })
  const json = await res.json().catch(() => null)
  return { status: res.status, ok: res.ok, json }
}
