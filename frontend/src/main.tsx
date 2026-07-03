import { ViteReactSSG } from 'vite-react-ssg'
import './styles/tokens.css'
import { routes } from './App'

export const createRoot = ViteReactSSG({ routes })
