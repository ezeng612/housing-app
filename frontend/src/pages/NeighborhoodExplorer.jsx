import { useState } from 'react'
import { Search, MapPin, Star, TrendingUp, Users, Shield, TreePine, GraduationCap, Coffee } from 'lucide-react'
import './NeighborhoodExplorer.css'

const neighborhoods = [
  { id: 1, name: 'Riverside Heights', city: 'Austin, TX', score: 92, price: '$485K', trend: '+6.2%', population: '24,300', walk: 88, school: 9.1, safety: 87, parks: 12, cafes: 34, desc: 'A vibrant riverside community with tree-lined streets, acclaimed schools, and a booming restaurant scene.', tags: ['Family-friendly', 'Walkable', 'Top schools'] },
  { id: 2, name: 'Midtown Grove', city: 'Austin, TX', score: 87, price: '$612K', trend: '+4.8%', population: '18,900', walk: 94, school: 8.4, safety: 79, parks: 6, cafes: 67, desc: 'Urban core living with exceptional transit access, nightlife, and the best coffee-per-block ratio in the city.', tags: ['Urban', 'Transit-rich', 'Nightlife'] },
  { id: 3, name: 'Cedarwood Park', city: 'Austin, TX', score: 84, price: '$398K', trend: '+9.1%', population: '31,200', walk: 72, school: 8.8, safety: 91, parks: 19, cafes: 18, desc: 'Quiet, spacious, and rapidly appreciating. Cedar-lined streets, community parks, and top-rated elementary schools.', tags: ['Quiet', 'Appreciating', 'Green space'] },
  { id: 4, name: 'The Arts District', city: 'Austin, TX', score: 79, price: '$544K', trend: '+2.3%', population: '11,600', walk: 91, school: 7.2, safety: 68, parks: 4, cafes: 52, desc: 'Galleries, murals, and live music every weekend. A creative hub for young professionals and artists alike.', tags: ['Creative', 'Walkable', 'Culture'] },
  { id: 5, name: 'North Pines', city: 'Austin, TX', score: 76, price: '$342K', trend: '+11.4%', population: '28,700', walk: 61, school: 8.0, safety: 84, parks: 23, cafes: 11, desc: 'The fastest-appreciating neighborhood in the metro. Larger lots, newer builds, and easy highway access.', tags: ['Fast-growing', 'Affordable', 'New builds'] },
  { id: 6, name: 'Lake Terrace', city: 'Austin, TX', score: 95, price: '$820K', trend: '+3.7%', population: '9,400', walk: 76, school: 9.6, safety: 96, parks: 8, cafes: 22, desc: 'Premium lakeside living. Prestigious schools, low density, and the highest safety scores in the metro.', tags: ['Premium', 'Lakeside', 'Prestigious'] },
]

const metrics = [
  { key: 'walk',   label: 'Walk score',    icon: Coffee,       max: 100, unit: '' },
  { key: 'school', label: 'School rating', icon: GraduationCap, max: 10, unit: '/10' },
  { key: 'safety', label: 'Safety score',  icon: Shield,       max: 100, unit: '' },
  { key: 'parks',  label: 'Parks nearby',  icon: TreePine,     max: 30,  unit: '' },
]

function ScoreBar({ value, max, color = 'teal' }) {
  return (
    <div className="score-bar">
      <div className="score-bar__fill" style={{ width: `${(value / max) * 100}%`, background: color === 'amber' ? 'var(--amber-400)' : 'var(--teal-400)' }} />
    </div>
  )
}

export default function NeighborhoodExplorer() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(neighborhoods[0])
  const [sort, setSort] = useState('score')

  const filtered = neighborhoods
    .filter(n => n.name.toLowerCase().includes(query.toLowerCase()) || n.tags.some(t => t.toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => sort === 'score' ? b.score - a.score : sort === 'price' ? parseInt(b.price.replace(/\D/g, '')) - parseInt(a.price.replace(/\D/g, '')) : parseFloat(b.trend) - parseFloat(a.trend))

  return (
    <div className="explorer">
      <div className="explorer__sidebar">
        <div className="explorer__search-wrap">
          <Search size={16} className="explorer__search-icon" />
          <input
            className="explorer__search"
            placeholder="Search neighborhoods or tags…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="explorer__sort">
          {['score', 'price', 'trend'].map(s => (
            <button key={s} className={`sort-btn ${sort === s ? 'sort-btn--active' : ''}`} onClick={() => setSort(s)}>
              {s === 'score' ? 'Top rated' : s === 'price' ? 'Price' : 'Trending'}
            </button>
          ))}
        </div>
        <div className="explorer__list">
          {filtered.map(n => (
            <button key={n.id} className={`nbhd-card ${selected.id === n.id ? 'nbhd-card--active' : ''}`} onClick={() => setSelected(n)}>
              <div className="nbhd-card__top">
                <div>
                  <div className="nbhd-card__name">{n.name}</div>
                  <div className="nbhd-card__city"><MapPin size={11} /> {n.city}</div>
                </div>
                <div className="nbhd-card__score">{n.score}</div>
              </div>
              <div className="nbhd-card__bottom">
                <span className="nbhd-card__price">{n.price}</span>
                <span className="nbhd-card__trend">{n.trend}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="explorer__detail animate-fadeIn" key={selected.id}>
        <div className="detail__header">
          <div>
            <h1 className="detail__name">{selected.name}</h1>
            <p className="detail__city"><MapPin size={14} /> {selected.city}</p>
          </div>
          <div className="detail__score-badge">
            <Star size={14} fill="currentColor" />
            <span>{selected.score}</span>
          </div>
        </div>

        <div className="detail__tags">
          {selected.tags.map(t => <span key={t} className="tag">{t}</span>)}
        </div>

        <p className="detail__desc">{selected.desc}</p>

        <div className="detail__stats-grid">
          <div className="stat-card">
            <TrendingUp size={18} />
            <span className="stat-card__value">{selected.price}</span>
            <span className="stat-card__label">Median price</span>
          </div>
          <div className="stat-card stat-card--green">
            <TrendingUp size={18} />
            <span className="stat-card__value">{selected.trend}</span>
            <span className="stat-card__label">YoY change</span>
          </div>
          <div className="stat-card">
            <Users size={18} />
            <span className="stat-card__value">{selected.population}</span>
            <span className="stat-card__label">Population</span>
          </div>
          <div className="stat-card">
            <Coffee size={18} />
            <span className="stat-card__value">{selected.cafes}</span>
            <span className="stat-card__label">Cafes & dining</span>
          </div>
        </div>

        <div className="detail__metrics">
          {metrics.map(({ key, label, icon: Icon, max, unit }) => (
            <div key={key} className="metric-row">
              <div className="metric-row__label">
                <Icon size={14} />
                <span>{label}</span>
              </div>
              <ScoreBar value={selected[key]} max={max} />
              <span className="metric-row__value">{selected[key]}{unit}</span>
            </div>
          ))}
        </div>

        <div className="detail__map-placeholder">
          <MapPin size={28} strokeWidth={1} />
          <p>Interactive map will render here via Google Maps Platform API</p>
          <span>Requires Maps JavaScript API key in Secret Manager</span>
        </div>
      </div>
    </div>
  )
}
