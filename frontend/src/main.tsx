import { ViteReactSSG } from 'vite-react-ssg'
import './styles/tokens.css'
import { routes } from './App'
import { initMobile } from './mobile'

initMobile()

export const createRoot = ViteReactSSG({ routes })
