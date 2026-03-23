import { useState, useEffect } from 'react'
import { Search, MapPin, Star, TrendingUp, Users, Shield, TreePine, GraduationCap, Coffee, Loader } from 'lucide-react'
import { neighborhoodApi } from '../api/client'
import './NeighborhoodExplorer.css'

function ScoreBar({ value, max, color = 'teal' }) {
  if (!value) return <div className="score-bar"><div className="score-bar__fill" style={{ width: '0%' }} /></div>
  return (
    <div className="score-bar">
      <div className="score-bar__fill" style={{
        width: `${Math.min(100, (value / max) * 100)}%`,
        background: color === 'amber' ? 'var(--amber-400)' : 'var(--teal-400)'
      }} />
    </div>
  )
}

function fmt(n) {
  if (!n) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(n)
}

export default function NeighborhoodExplorer() {
  const [query,       setQuery]       = useState('')
  const [state,       setState]       = useState('TX')
  const [sort,        setSort]        = useState('zhvi_sfr')
  const [neighborhoods, setNeighborhoods] = useState([])
  const [selected,    setSelected]    = useState(null)
  const [history,     setHistory]     = useState([])
  const [loading,     setLoading]     = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    loadNeighborhoods()
  }, [state])

  async function loadNeighborhoods() {
    setLoading(true)
    setError(null)
    try {
      const params = { limit: 30 }
      if (state) params.state = state
      if (query) params.q    = query
      const data = await neighborhoodApi.search(params)
      const sorted = sortResults(data.results || [], sort)
      setNeighborhoods(sorted)
      if (sorted.length > 0 && !selected) {
        selectNeighborhood(sorted[0])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function selectNeighborhood(nbhd) {
    setSelected(nbhd)
    setDetailLoading(true)
    try {
      const hist = await neighborhoodApi.getPriceHistory(nbhd.zip_code, 24)
      setHistory(hist.history || [])
    } catch {
      setHistory([])
    } finally {
      setDetailLoading(false)
    }
  }

  function sortResults(results, sortKey) {
    return [...results].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))
  }

  function handleSort(s) {
    setSort(s)
    setNeighborhoods(prev => sortResults(prev, s))
  }

  function handleSearch(e) {
    e.preventDefault()
    loadNeighborhoods()
  }

  return (
    <div className="explorer">
      <div className="explorer__sidebar">
        <form onSubmit={handleSearch} className="explorer__search-wrap">
          <Search size={16} className="explorer__search-icon" />
          <input
            className="explorer__search"
            placeholder="Search city or zip code…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </form>

        <div className="explorer__filters">
          <select
            value={state}
            onChange={e => { setState(e.target.value); setSelected(null) }}
            style={{ fontSize: '13px', padding: '6px 10px', borderRadius: '8px' }}
          >
            <option value="">All states</option>
            {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
              'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
              'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
              'VA','WA','WV','WI','WY'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="explorer__sort">
          {[
            { key: 'zhvi_sfr',        label: 'Home value' },
            { key: 'median_income',   label: 'Income' },
            { key: 'education_index', label: 'Education' },
          ].map(s => (
            <button
              key={s.key}
              className={`sort-btn ${sort === s.key ? 'sort-btn--active' : ''}`}
              onClick={() => handleSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="explorer__list">
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader size={24} className="spin" style={{ color: 'var(--teal-400)' }} />
            </div>
          )}
          {error && (
            <div style={{ padding: '1rem', color: 'var(--coral-400)', fontSize: '13px' }}>
              Error: {error}
            </div>
          )}
          {!loading && neighborhoods.map(n => (
            <button
              key={n.zip_code}
              className={`nbhd-card ${selected?.zip_code === n.zip_code ? 'nbhd-card--active' : ''}`}
              onClick={() => selectNeighborhood(n)}
            >
              <div className="nbhd-card__top">
                <div>
                  <div className="nbhd-card__name">{n.city || n.zip_code}</div>
                  <div className="nbhd-card__city">
                    <MapPin size={11} /> {n.zip_code} · {n.state}
                  </div>
                </div>
                <div className="nbhd-card__score">
                  {n.education_index ? n.education_index.toFixed(0) : '–'}
                </div>
              </div>
              <div className="nbhd-card__bottom">
                <span className="nbhd-card__price">{fmt(n.zhvi_sfr)}</span>
                <span className="nbhd-card__trend">
                  {n.metro_area ? n.metro_area.split(',')[0] : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="explorer__detail">
        {!selected && !loading && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--sand-400)', flexDirection: 'column', gap: '1rem'
          }}>
            <MapPin size={40} strokeWidth={1} />
            <p>Select a neighborhood from the list</p>
          </div>
        )}

        {selected && (
          <div className="animate-fadeIn" key={selected.zip_code}>
            <div className="detail__header">
              <div>
                <h1 className="detail__name">{selected.city || selected.zip_code}</h1>
                <p className="detail__city">
                  <MapPin size={14} /> {selected.zip_code} · {selected.state} · {selected.metro_area}
                </p>
              </div>
              <div className="detail__score-badge">
                <Star size={14} fill="currentColor" />
                <span>{selected.education_index?.toFixed(0) || '–'}</span>
              </div>
            </div>

            <div className="detail__stats-grid">
              <div className="stat-card">
                <TrendingUp size={18} />
                <span className="stat-card__value">{fmt(selected.zhvi_sfr)}</span>
                <span className="stat-card__label">Home value (ZHVI)</span>
              </div>
              <div className="stat-card">
                <TrendingUp size={18} />
                <span className="stat-card__value">{fmt(selected.zori_rent)}</span>
                <span className="stat-card__label">Monthly rent</span>
              </div>
              <div className="stat-card">
                <Users size={18} />
                <span className="stat-card__value">{fmt(selected.median_income)}</span>
                <span className="stat-card__label">Median income</span>
              </div>
              <div className="stat-card">
                <Coffee size={18} />
                <span className="stat-card__value">{selected.total_schools || '–'}</span>
                <span className="stat-card__label">Total schools</span>
              </div>
            </div>

            <div className="detail__metrics">
              {[
                { label: 'Education index', icon: GraduationCap, value: selected.education_index, max: 100 },
                { label: 'Academic score',  icon: GraduationCap, value: selected.academic_score,  max: 100 },
                { label: 'Owner occupied',  icon: Shield,        value: selected.owner_occupied_pct, max: 100 },
              ].map(({ label, icon: Icon, value, max }) => (
                <div key={label} className="metric-row">
                  <div className="metric-row__label">
                    <Icon size={14} />
                    <span>{label}</span>
                  </div>
                  <ScoreBar value={value} max={max} />
                  <span className="metric-row__value">
                    {value != null ? value.toFixed(1) : 'N/A'}
                  </span>
                </div>
              ))}
            </div>

            {history.length > 0 && (
              <div className="detail__history">
                <div className="comps-header">Price history (24 months)</div>
                <div className="history-grid">
                  {history.slice(-6).map((h, i) => (
                    <div key={i} className="history-item">
                      <span className="history-item__date">
                        {new Date(h.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                      </span>
                      <span className="history-item__value">{fmt(h.zhvi_sfr)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="detail__map-placeholder">
              <MapPin size={28} strokeWidth={1} />
              <p>Interactive map renders here via Google Maps Platform API</p>
              <span>Requires Maps JavaScript API key in Secret Manager</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}