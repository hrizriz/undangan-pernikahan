// Dev: kosong = same-origin lewat proxy Vite (HP di WiFi bisa pakai http://<IP>:5173 tanpa set env).
const base =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : 'http://127.0.0.1:8081')

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const b = base.replace(/\/$/, '')
  return b ? `${b}${p}` : p
}

export async function apiFetch(
  path: string,
  init?: RequestInit & { token?: string | null },
): Promise<Response> {
  const { token, headers, ...rest } = init ?? {}
  const h = new Headers(headers)
  h.set('Accept', 'application/json')
  if (token) {
    h.set('Authorization', `Bearer ${token}`)
  }
  return fetch(apiUrl(path), { ...rest, headers: h })
}
