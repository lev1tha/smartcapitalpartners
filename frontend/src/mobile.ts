/**
 * Нативная оболочка (Capacitor). Вызывается до монтирования React.
 * В приложении сайт не нужен — сразу открываем CRM (/admin).
 */
export function initMobile(): void {
  if (typeof window === 'undefined') return
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  if (!cap?.isNativePlatform?.()) return
  document.documentElement.classList.add('is-native')
  if (!window.location.pathname.startsWith('/admin')) {
    window.history.replaceState(null, '', '/admin')
  }
}
