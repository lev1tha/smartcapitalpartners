import type { RouteRecord } from 'vite-react-ssg'
import './styles/mfpro.css'
import Layout from './components/Layout'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import CatalogDetail from './pages/CatalogDetail'
import Quiz from './pages/Quiz'
import Turnkey from './pages/Turnkey'
import Taxes from './pages/Taxes'
import Franchises from './pages/Franchises'
import FranchiseDetail from './pages/FranchiseDetail'
import Investments from './pages/Investments'
import InvestmentDetail from './pages/InvestmentDetail'
import ReadyBusiness from './pages/ReadyBusiness'
import ReadyDetail from './pages/ReadyDetail'
import Admin from './pages/Admin'
import { businessModels } from './data/catalog'
import { franchises, investments, readyBusinesses } from './data/offerings'

export const routes: RouteRecord[] = [
  {
    path: '/',
    element: <Layout />,
    entry: 'src/components/Layout.tsx',
    children: [
      { index: true, element: <Home /> },
      { path: 'catalog', element: <Catalog /> },
      {
        path: 'catalog/:id',
        element: <CatalogDetail />,
        getStaticPaths: () => businessModels.map((m) => `catalog/${m.id}`),
      },
      { path: 'turnkey', element: <Turnkey /> },
      { path: 'taxes', element: <Taxes /> },
      { path: 'test', element: <Quiz /> },
      { path: 'franchises', element: <Franchises /> },
      {
        path: 'franchises/:id',
        element: <FranchiseDetail />,
        getStaticPaths: () => franchises.map((f) => `franchises/${f.id}`),
      },
      { path: 'investments', element: <Investments /> },
      {
        path: 'investments/:id',
        element: <InvestmentDetail />,
        getStaticPaths: () => investments.map((p) => `investments/${p.id}`),
      },
      { path: 'ready', element: <ReadyBusiness /> },
      {
        path: 'ready/:id',
        element: <ReadyDetail />,
        getStaticPaths: () => readyBusinesses.map((b) => `ready/${b.id}`),
      },
    ],
  },
  // Админка — отдельно, без публичного хедера/футера, без индексации.
  { path: '/admin', element: <Admin /> },
]
