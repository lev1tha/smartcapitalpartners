import { createContext, useContext } from 'react'

/** Тип сущности, которую можно открыть по ссылке из уведомления, поиска или связанной карточки. */
export type EntityType = 'task' | 'deal' | 'client' | 'document' | 'submission' | 'section'

export type Navigate = (type: EntityType, id: string) => void

export const NavCtx = createContext<Navigate>(() => {})
export const useNav = () => useContext(NavCtx)

/** Разделы CRM. Порядок — порядок в меню. */
export type Section =
  | 'dashboard' | 'tasks' | 'deals' | 'clients' | 'docs'
  | 'marketing' | 'smm' | 'accounting' | 'calendar' | 'submissions' | 'catalog' | 'ideas' | 'users' | 'settings'

export const SECTION_OF: Record<Exclude<EntityType, 'section'>, Section> = {
  task: 'tasks', deal: 'deals', client: 'clients', document: 'docs', submission: 'submissions',
}
