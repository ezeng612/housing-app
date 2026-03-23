import { useState, useEffect } from 'react'
import {
  Search, MapPin, Star, TrendingUp, Users,
  Shield, GraduationCap, Coffee, Loader, SlidersHorizontal
} from 'lucide-react'
import { neighborhoodApi } from '../api/client'
import './NeighborhoodExplorer.css'

const SORT_OPTIONS = [
  { key: 'value_score',         label: 'Best value' },
  { key: 'affordability_score', label: 'Most affordable' },
  { key: 'zhvi_sfr',            label: 'Home value' },
  { key: 'education_index',     label: 'Education' },
  { key: 'median_income',       label: 'Income' },
]

const VALUE_TIERS = [
  { key: '',            label: 'All' },
  { key: 'Hidden gem',  label: 'Hidden gems' },
  { key: 'Great value', label: 'Great value' },
  { key: 'Fair market', label: 'Fair market' },
  { key: 'Premium',     label: 'Premium' },
  { key: 'Overpriced',  label: 'Overpriced' },
]

const TIER_COLORS = {
  'Hidden gem':  { bg: '#e1f5ee', text: '#0f6e56' },
  'Great value': { bg: '#eaf3de', text: '#3b6d11' },
  'Fair market': { bg: '#faeeda', text: '#854f0b' },
  'Premium':     { bg: '#faece7', text: '#993c1d' },
  'Overpriced':  { bg: '#fcebeb', text: '#a32d2d' },
  'Unknown':     { bg: '#f1efe8', text: '#5f5e5a' },
}

const METRICS_EXPLAINED = [
  {
    label: 'Value score',
    desc: 'Composite score (0-100) combining education quality (30%), affordability relative to income (35%), homeownership stability (20%), and market tier (15%). Higher = better overall value.'
  },
  {
    label: 'Affordability score',
    desc: 'Measures how affordable homes are relative to local median income. Calculated as 100 minus the price-to-income ratio scaled to a 0-100 range. Higher = more affordable.'
  },
  {
    label: 'Price-to-income ratio',
    desc: 'Median home value divided by median household income. Under 3x is affordable, 3-5x is moderate, above 8x is expensive. Lower is better for buyers.'
  },
  {
    label: 'Education index',
    desc: 'Composite of SEDA academic achievement scores (Stanford Education Data Archive) and school availability per zip code. Scale 0-100.'
  },
  {
    label: 'Value tier',
    desc: 'Hidden gem: price-to-income < 3x with strong schools. Great value: < 5x with good schools. Fair market: < 8x. Premium: < 12x. Overpriced: > 12x.'
  },
  {
    label: 'Home value (ZHVI)',
    desc: 'Zillow Home Value Index — smoothed, seasonally adjusted estimate of typical home values for single-family homes. Updated monthly from Zillow Research.'
  },
  {
    label: 'Monthly rent (ZORI)',
    desc: 'Zillow Observed Rent Index — average asking rent across all home types. Updated monthly from Zillow Research.'
  },
  {
    label: 'Median income',
    desc: 'Median household income from US Census Bureau American Community Survey 5-Year Estimates (2024).'
  },
]

function ScoreBar({ value, max = 100 }) {
  if (!value) return (
    <div className="score-bar">
      <div className="score-bar__fill" style={{ width: '0%' }} />
    </div>
  )
  return (
    <div className="score-bar">
      <div className="score-bar__fill" style={{
        width: `${Math.min(100, (value / max) * 100)}%`,
        background: 'var(--teal-400)'
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

function TierBadge({ tier }) {
  if (!tier || tier === 'Unknown') return null
  const colors = TIER_COLORS[tier] || TIER_COLORS['Unknown']
  return (
    <span style={{
      fontSize: '11px', padding: '3px 10px',
      borderRadius: '99px', fontWeight: 500,
      background: colors.bg, color: colors.text,
      flexShrink: 0,
    }}>
      {tier}
    </span>
  )
}

export default function NeighborhoodExplorer() {
  const [query,         setQuery]         = useState('')
  const [state,         setState]         = useState('TX')
  const [sortBy,        setSortBy]        = useState('value_score')
  const [valueTier,     setValueTier]     = useState('')
  const [maxBudget,     setMaxBudget]     = useState('')
  const [showFilters,   setShowFilters]   = useState(false)
  const [showMetrics,   setShowMetrics]   = useState(false)
  const [neighborhoods, setNeighborhoods] = useState([])
  const [selected,      setSelected]      = useState(null)
  const [history,       setHistory]       = useState([])
  const [loading,       setLoading]       = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error,         setError]         = useState(null)

  useEffect(() => { loadNeighborhoods() }, [state, sortBy, valueTier])

  async function loadNeighborhoods() {
    setLoading(true)
    setError(null)
    try {
      const params = { limit: 30, sort_by: sortBy }
      if (state)     params.state      = state
      if (query)     params.q          = query
      if (maxBudget) params.max_budget = parseFloat(maxBudget) * 1000
      if (valueTier) params.value_tier = valueTier
      const data = await neighborhoodApi.search(params)
      setNeighborhoods(data.results || [])
      if (data.results?.length > 0 && !selected) {
        selectNeighborhood(data.results[0])
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

  function handleSearch(e) {
    e.preventDefault()
    loadNeighborhoods()
  }

  return (
    <div className="explorer">

      {/* ── Sidebar ── */}
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={state}
              onChange={e => { setState(e.target.value); setSelected(null) }}
              style={{ flex: 1, fontSize: '13px', padding: '6px 10px', borderRadius: '8px' }}
            >
              <option value="">All states</option>
              {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
                'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
                'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
                'VA','WA','WV','WI','WY'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowFilters(f => !f)}
              style={{
                padding: '6px 10px', borderRadius: '8px', fontSize: '12px',
                background: showFilters ? 'var(--sand-900)' : 'transparent',
                color: showFilters ? '#fff' : 'var(--sand-600)',
                border: '1px solid var(--sand-200)',
                display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
              }}
            >
              <SlidersHorizontal size={13} />
              Filters
            </button>
          </div>

          {showFilters && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{
                  fontSize: '11px', color: 'var(--sand-400)',
                  textTransform: 'uppercase', letterSpacing: '0.06em'
                }}>
                  Max budget ($K)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 500 for $500K"
                  value={maxBudget}
                  onChange={e => setMaxBudget(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{
                  fontSize: '11px', color: 'var(--sand-400)',
                  textTransform: 'uppercase', letterSpacing: '0.06em'
                }}>
                  Value tier
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                  {VALUE_TIERS.map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setValueTier(t.key)}
                      style={{
                        padding: '4px 10px', borderRadius: '99px', fontSize: '11px',
                        fontWeight: 500, cursor: 'pointer',
                        background: valueTier === t.key ? 'var(--sand-900)' : 'transparent',
                        color: valueTier === t.key ? '#fff' : 'var(--sand-600)',
                        border: '1px solid var(--sand-200)',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={loadNeighborhoods}
                style={{
                  padding: '8px', borderRadius: '8px', fontSize: '13px',
                  background: 'var(--teal-400)', color: '#fff',
                  border: 'none', cursor: 'pointer', fontWeight: 500
                }}
              >
                Apply filters
              </button>
            </div>
          )}
        </div>

        <div className="explorer__sort">
          <label style={{
            fontSize: '11px', color: 'var(--sand-400)',
            textTransform: 'uppercase', letterSpacing: '0.06em'
          }}>
            Sort by
          </label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ fontSize: '13px', padding: '6px 10px', borderRadius: '8px', width: '100%' }}
          >
            {SORT_OPTIONS.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
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
                <div style={{ minWidth: 0 }}>
                  <div className="nbhd-card__name">{n.city || n.zip_code}</div>
                  <div className="nbhd-card__city">
                    <MapPin size={11} /> {n.zip_code} · {n.state}
                  </div>
                </div>
                <div className="nbhd-card__score">
                  {n.value_score ? n.value_score.toFixed(0) : '–'}
                </div>
              </div>
              <div className="nbhd-card__bottom">
                <span className="nbhd-card__price">{fmt(n.zhvi_sfr)}</span>
                <TierBadge tier={n.value_tier} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Detail panel ── */}
      <div className="explorer__detail">
        {!selected && !loading && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--sand-400)',
            flexDirection: 'column', gap: '1rem'
          }}>
            <MapPin size={40} strokeWidth={1} />
            <p>Select a neighborhood from the list</p>
          </div>
        )}

        {selected && (
          <div className="animate-fadeIn" key={selected.zip_code}>

            {/* Metro coverage notice */}
            <div style={{
              background: 'var(--sand-100)',
              border: '1px solid var(--sand-200)',
              borderRadius: 'var(--border-radius-md)',
              padding: '10px 14px',
              marginBottom: '1.25rem',
              fontSize: '12px',
              color: 'var(--sand-600)',
              lineHeight: '1.6'
            }}>
              Data covers <strong>metropolitan and suburban zip codes</strong> with available
              Zillow ZHVI data. Rural areas may have limited coverage. All metrics reflect
              zip code level aggregates, not individual properties.
            </div>

            {/* Header */}
            <div className="detail__header">
              <div>
                <h1 className="detail__name">{selected.city || selected.zip_code}</h1>
                <p className="detail__city">
                  <MapPin size={14} /> {selected.zip_code} · {selected.state}
                  {selected.metro_area ? ` · ${selected.metro_area.split(',')[0]}` : ''}
                </p>
                <div style={{ marginTop: '8px' }}>
                  <TierBadge tier={selected.value_tier} />
                </div>
              </div>
              <div className="detail__score-badge">
                <Star size={14} fill="currentColor" />
                <span>{selected.value_score?.toFixed(0) || '–'}</span>
              </div>
            </div>

            {/* KPI cards */}
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
                <span className="stat-card__value">
                  {selected.price_to_income_ratio?.toFixed(1) || 'N/A'}x
                </span>
                <span className="stat-card__label">Price-to-income</span>
              </div>
            </div>

            {/* Score bars */}
            <div className="detail__metrics">
              {[
                { label: 'Value score',     icon: Star,          value: selected.value_score },
                { label: 'Affordability',   icon: TrendingUp,    value: selected.affordability_score },
                { label: 'Education index', icon: GraduationCap, value: selected.education_index },
                { label: 'Owner occupied',  icon: Shield,        value: selected.owner_occupied_pct },
              ].map(({ label, icon: Icon, value }) => (
                <div key={label} className="metric-row">
                  <div className="metric-row__label">
                    <Icon size={14} />
                    <span>{label}</span>
                  </div>
                  <ScoreBar value={value} />
                  <span className="metric-row__value">
                    {value != null ? value.toFixed(1) : 'N/A'}
                  </span>
                </div>
              ))}
            </div>

            {/* Price history */}
            {history.length > 0 && (
              <div className="detail__history">
                <div className="comps-header">Price history (24 months)</div>
                <div className="history-grid">
                  {history.slice(-6).map((h, i) => (
                    <div key={i} className="history-item">
                      <span className="history-item__date">
                        {new Date(h.date).toLocaleDateString('en-US', {
                          month: 'short', year: '2-digit'
                        })}
                      </span>
                      <span className="history-item__value">{fmt(h.zhvi_sfr)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metrics explanation */}
            <div style={{ marginBottom: '2rem' }}>
              <button
                type="button"
                onClick={() => setShowMetrics(m => !m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '12px', fontWeight: 500,
                  color: 'var(--sand-600)', background: 'transparent',
                  border: 'none', cursor: 'pointer', padding: '0',
                  marginBottom: showMetrics ? '12px' : '0'
                }}
              >
                <SlidersHorizontal size={13} />
                {showMetrics ? 'Hide' : 'Show'} how we calculate these metrics
              </button>

              {showMetrics && (
                <div style={{
                  padding: '1.25rem',
                  background: 'var(--sand-50)',
                  borderRadius: 'var(--border-radius-lg)',
                  border: '1px solid var(--sand-100)'
                }}>
                  {METRICS_EXPLAINED.map(({ label, desc }) => (
                    <div key={label} style={{
                      marginBottom: '10px',
                      paddingBottom: '10px',
                      borderBottom: '1px solid var(--sand-100)'
                    }}>
                      <div style={{
                        fontSize: '13px', fontWeight: 500,
                        color: 'var(--sand-800)', marginBottom: '3px'
                      }}>
                        {label}
                      </div>
                      <div style={{
                        fontSize: '12px', color: 'var(--sand-600)', lineHeight: '1.6'
                      }}>
                        {desc}
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: '11px', color: 'var(--sand-400)', marginTop: '4px' }}>
                    Data sources: Zillow Research · US Census ACS · Stanford SEDA · NCES Common Core of Data
                  </div>
                </div>
              )}
            </div>

            {/* Map placeholder */}
            <div className="detail__map-placeholder">
              <MapPin size={28} strokeWidth={1} />
              <p>Interactive map coming soon via Mapbox</p>
              <span>Will show zip code boundaries and nearby neighborhoods</span>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}