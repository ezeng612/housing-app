import { useNavigate } from 'react-router-dom'
import { Map, TrendingUp, LayoutDashboard, Sparkles, ArrowRight } from 'lucide-react'
import './Landing.css'

const features = [
  { icon: Map, label: 'Neighborhood Explorer', desc: 'Dive deep into any neighborhood — schools, walkability, crime trends, and local amenities at a glance.', to: '/explore', color: 'teal' },
  { icon: TrendingUp, label: 'Market Predictor', desc: 'AI-powered valuation estimates trained on millions of comparable sales across every zip code.', to: '/predict', color: 'amber' },
  { icon: LayoutDashboard, label: 'Market Dashboard', desc: 'Live charts tracking price trends, inventory levels, days on market, and affordability indices.', to: '/dashboard', color: 'coral' },
  { icon: Sparkles, label: 'Personalized Picks', desc: 'Tell us what matters to you — we surface neighborhoods that match your lifestyle, not just your budget.', to: '/recommend', color: 'sand' },
]

export default function Landing() {
  const navigate = useNavigate()
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero__grid" aria-hidden="true">
          {Array.from({ length: 80 }).map((_, i) => <div key={i} className="hero__cell" />)}
        </div>
        <div className="hero__content animate-fadeUp">
          <p className="hero__eyebrow">Housing intelligence platform</p>
          <h1 className="hero__title">Find where<br /><em>you</em> belong.</h1>
          <p className="hero__sub">Data-driven insights on every neighborhood, market, and property — so your next move is your best one.</p>
          <div className="hero__actions">
            <button className="btn btn--primary" onClick={() => navigate('/explore')}>
              Start exploring <ArrowRight size={16} />
            </button>
            <button className="btn btn--ghost" onClick={() => navigate('/dashboard')}>
              View market data
            </button>
          </div>
        </div>
        <div className="hero__stat-strip animate-fadeIn" style={{ animationDelay: '0.3s' }}>
          {[['2.4M+', 'Properties tracked'], ['340', 'Metro areas'], ['98%', 'Valuation accuracy'], ['Real-time', 'Market data']].map(([n, l]) => (
            <div key={l} className="stat">
              <span className="stat__num">{n}</span>
              <span className="stat__label">{l}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="features">
        <div className="features__header">
          <h2>Everything you need to<br />make a confident move</h2>
        </div>
        <div className="features__grid">
          {features.map(({ icon: Icon, label, desc, to, color }, i) => (
            <button
              key={label}
              className={`feature-card feature-card--${color} animate-fadeUp`}
              style={{ animationDelay: `${i * 0.08}s` }}
              onClick={() => navigate(to)}
            >
              <div className="feature-card__icon"><Icon size={22} strokeWidth={1.5} /></div>
              <h3>{label}</h3>
              <p>{desc}</p>
              <span className="feature-card__arrow"><ArrowRight size={16} /></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
