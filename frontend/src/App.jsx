import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Map, TrendingUp, LayoutDashboard, Sparkles, Home } from 'lucide-react'
import NeighborhoodExplorer from './pages/NeighborhoodExplorer.jsx'
import MarketPredictor from './pages/MarketPredictor.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Recommender from './pages/Recommender.jsx'
import Landing from './pages/Landing.jsx'
import './App.css'

const navItems = [
  { to: '/explore',   label: 'Explorer',  icon: Map },
  { to: '/predict',   label: 'Predictor', icon: TrendingUp },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/recommend', label: 'For You',   icon: Sparkles },
]

function Nav() {
  const loc = useLocation()
  const isHome = loc.pathname === '/'
  return (
    <nav className={`nav ${isHome ? 'nav--home' : ''}`}>
      <NavLink to="/" className="nav__brand">
        <Home size={18} strokeWidth={1.5} />
        <span>Dwellr</span>
      </NavLink>
      <div className="nav__links">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}>
            <Icon size={15} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
      <button className="nav__cta">Sign in</button>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<NeighborhoodExplorer />} />
          <Route path="/predict" element={<MarketPredictor />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/recommend" element={<Recommender />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
