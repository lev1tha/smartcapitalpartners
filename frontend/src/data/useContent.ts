import { useEffect, useState } from 'react'

/**
 * Живой контент: возвращает seed сразу (для SSG/первой отрисовки),
 * затем подменяет данными из бэкенда (карточки из админки появляются сразу).
 */
export function useContent<T>(type: string, seed: T[]): T[] {
  const [items, setItems] = useState<T[]>(seed)

  useEffect(() => {
    let alive = true
    fetch(`/api/content?type=${type}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && Array.isArray(d.items) && d.items.length) {
          setItems(d.items as T[])
        }
      })
      .catch(() => {
        /* бэкенд недоступен — остаёмся на seed */
      })
    return () => {
      alive = false
    }
  }, [type])

  return items
}
