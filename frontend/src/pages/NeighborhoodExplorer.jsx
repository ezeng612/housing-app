import { useState, useEffect } from 'react'
import {
  Search, MapPin, Star, TrendingUp, Users,
  Shield, GraduationCap, Wind, TreePine,
  Loader, SlidersHorizontal, Info
} from 'lucide-react'
import { neighborhoodApi } from '../api/client'
import './NeighborhoodExplorer.css'

const SORT_OPTIONS = [
  { key: 'value_score',           label: 'Best value' },
  { key: 'affordability_score',   label: 'Most affordable' },
  { key: 'safety_index',          label: 'Safest' },
  { key: 'air_quality_index',     label: 'Best air quality' },
  { key: 'natural_amenity_score', label: 'Best amenities' },
  { key: 'education_index',       label: 'Best schools' },
  { key: 'zhvi_sfr',              label: 'Home value' },
  { key: 'median_income',         label: 'Income' },
]

const VALUE_TIERS = [
  { key: '',            label: 'All tiers' },
  { key: 'Hidden gem',  label: 'Hidden gems' },
  { key: 'Great value', label: 'Great value' },
  { key: 'Fair market', label: 'Fair market' },
  { key: 'Premium',     label: 'Premium' },
  { key: 'Overpriced',  label: 'Overpriced' },
]

const POP_CLASSES = [
  { key: '',           label: 'All sizes' },
  { key: 'urban',      label: 'Urban (50K+)' },
  { key: 'suburban',   label: 'Suburban (10K-50K)' },
  { key: 'small_town', label: 'Small town (2.5K-10K)' },
  { key: 'rural',      label: 'Rural (<2.5K)' },
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
  { label: 'Value score', desc: 'Composite score (0-100) combining affordability (25%), safety (20%), education (20%), air quality (15%), natural amenities (12%), and market tier (8%). Higher = better overall value.' },
  { label: 'Affordability score', desc: 'How affordable homes are relative to local median income. 100 minus the price-to-income ratio scaled to 0-100. Higher = more affordable.' },
  { label: 'Price-to-income ratio', desc: 'Median home value divided by median household income. Under 3x is affordable, 3-5x is moderate, above 8x is expensive.' },
  { label: 'Safety index', desc: 'Composite of violent and property crime rates per 100K residents from FBI Crime Data. Normalized to 0-100 where 100 = safest.' },
  { label: 'Air quality index', desc: 'Based on EPA Annual AQI county data. Converted to 0-100 scale where 100 = cleanest air. AQI under 50 (Good) scores 75-100.' },
  { label: 'Natural amenity score', desc: 'USDA Natural Amenities Scale measuring climate, topography, and water features. Converted from 1-7 rank to 0-100 score.' },
  { label: 'Education index', desc: 'Composite of SEDA academic achievement scores (Stanford Education Data Archive) and school availability per zip code.' },
  { label: 'Home value (ZHVI)', desc: 'Zillow Home Value Index — smoothed, seasonally adjusted estimate for single-family homes. Updated monthly.' },
  { label: 'Monthly rent (ZORI)', desc: 'Zillow Observed Rent Index — average asking rent across all home types. Updated monthly.' },
  { label: 'Median income', desc: 'Median household income from US Census Bureau ACS 5-Year Estimates (2024).' },
]

function ScoreBar({ value, max = 100, color = '#2a9d8f' }) {
  if (!value) return (
    <div className="score-bar">
      <div className="score-bar__fill" style={{ width: '0%' }} />
    </div>
  )
  return (
    <div className="score-bar">
      <div className="score-bar__fill" style={{
        width: `${Math.min(100, (value / max) * 100)}%`,
        background: color
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

function fmtPop(n) {
  if (!n) return 'N/A'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString()
}

function TierBadge({ tier }) {
  if (!tier || tier === 'Unknown') return null
  const colors = TIER_COLORS[tier] || TIER_COLORS['Unknown']
  return (
    <span style={{
      fontSize: '11px', padding: '3px 10px',
      borderRadius: '99px', fontWeight: 500,
      background: colors.bg, color: colors.text, flexShrink: 0,
    }}>
      {tier}
    </span>
  )
}

function PopBadge({ cls }) {
  if (!cls) return null
  const map = {
    urban:      { label: 'Urban',      bg: '#e6f1fb', text: '#185fa5' },
    suburban:   { label: 'Suburban',   bg: '#eeedfe', text: '#534ab7' },
    small_town: { label: 'Small town', bg: '#faeeda', text: '#854f0b' },
    rural:      { label: 'Rural',      bg: '#eaf3de', text: '#3b6d11' },
  }
  const c = map[cls] || map.rural
  return (
    <span style={{
      fontSize: '11px', padding: '3px 8px',
      borderRadius: '99px', fontWeight: 500,
      background: c.bg, color: c.text, flexShrink: 0,
    }}>
      {c.label}
    </span>
  )
}

export default function NeighborhoodExplorer() {
  const [query,         setQuery]         = useState('')
  const [state,         setState]         = useState('TX')
  const [sortBy,        setSortBy]        = useState('value_score')
  const [valueTier,     setValueTier]     = useState('')
  const [popClass,      setPopClass]      = useState('suburban')
  const [maxBudget,     setMaxBudget]     = useState('')
  const [minSafety,     setMinSafety]     = useState('')
  const [minAirQuality, setMinAirQuality] = useState('')
  const [showFilters,   setShowFilters]   = useState(false)
  const [showMetrics,   setShowMetrics]   = useState(false)
  const [neighborhoods, setNeighborhoods] = useState([])
  const [selected,      setSelected]      = useState(null)
  const [history,       setHistory]       = useState([])
  const [loading,       setLoading]       = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error,         setError]         = useState(null)

  useEffect(() => { loadNeighborhoods() }, [state, sortBy, valueTier, popClass])

  async function loadNeighborhoods() {
    setLoading(true)
    setError(null)
    try {
      const params = { limit: 30, sort_by: sortBy }
      if (state)         params.state      = state
      if (query)         params.q          = query
      if (maxBudget)     params.max_budget = parseFloat(maxBudget) * 1000
      if (valueTier)     params.value_tier = valueTier
      if (popClass)      params.pop_class  = popClass
      if (minSafety)     params.min_safety = parseFloat(minSafety)
      if (minAirQuality) params.min_air_quality = parseFloat(minAirQuality)
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
                <label style={{ fontSize: '11px', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Area type
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                  {POP_CLASSES.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPopClass(p.key)}
                      style={{
                        padding: '4px 10px', borderRadius: '99px', fontSize: '11px',
                        fontWeight: 500, cursor: 'pointer',
                        background: popClass === p.key ? 'var(--sand-900)' : 'transparent',
                        color: popClass === p.key ? '#fff' : 'var(--sand-600)',
                        border: '1px solid var(--sand-200)',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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

              <div>
                <label style={{ fontSize: '11px', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Min safety (0-100)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 60"
                    value={minSafety}
                    onChange={e => setMinSafety(e.target.value)}
                    style={{ marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Min air quality
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 50"
                    value={minAirQuality}
                    onChange={e => setMinAirQuality(e.target.value)}
                    style={{ marginTop: '4px' }}
                  />
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
          <label style={{ fontSize: '11px', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <TierBadge tier={n.value_tier} />
                  <PopBadge cls={n.pop_density_class} />
                </div>
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

            {/* Coverage notice */}
            <div style={{
              background: 'var(--sand-100)', border: '1px solid var(--sand-200)',
              borderRadius: 'var(--border-radius-md)', padding: '10px 14px',
              marginBottom: '1.25rem', fontSize: '12px',
              color: 'var(--sand-600)', lineHeight: '1.6'
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
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <TierBadge tier={selected.value_tier} />
                  <PopBadge cls={selected.pop_density_class} />
                  {selected.total_population && (
                    <span style={{ fontSize: '11px', color: 'var(--sand-400)' }}>
                      Pop. {fmtPop(selected.total_population)}
                    </span>
                  )}
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
                <span className="stat-card__label">Home value</span>
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
                <TrendingUp size={18} />
                <span className="stat-card__value">
                  {selected.price_to_income_ratio?.toFixed(1) || 'N/A'}x
                </span>
                <span className="stat-card__label">Price-to-income</span>
              </div>
            </div>

            {/* Quality of life scores */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '10px', marginBottom: '1.5rem'
            }}>
              {[
                { label: 'Value score',      value: selected.value_score,           icon: Star,          color: '#2a9d8f' },
                { label: 'Affordability',    value: selected.affordability_score,   icon: TrendingUp,    color: '#2a9d8f' },
                { label: 'Safety',           value: selected.safety_index,          icon: Shield,        color: '#639922' },
                { label: 'Air quality',      value: selected.air_quality_index,     icon: Wind,          color: '#185fa5' },
                { label: 'Education',        value: selected.education_index,       icon: GraduationCap, color: '#534ab7' },
                { label: 'Natural amenities',value: selected.natural_amenity_score, icon: TreePine,      color: '#3b6d11' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} style={{
                  padding: '12px 14px',
                  background: 'var(--sand-50)',
                  borderRadius: 'var(--border-radius-md)',
                  border: '1px solid var(--sand-100)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Icon size={13} style={{ color }} />
                    <span style={{ fontSize: '11px', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {label}
                    </span>
                  </div>
                  <div style={{ fontSize: '20px', fontFamily: 'var(--font-display)', color: 'var(--sand-900)', marginBottom: '4px' }}>
                    {value != null ? value.toFixed(1) : 'N/A'}
                  </div>
                  <ScoreBar value={value} color={color} />
                </div>
              ))}
            </div>

            {/* Crime detail */}
            {selected.safety_index != null && (
              <div style={{
                padding: '14px 16px', marginBottom: '1.5rem',
                background: 'var(--sand-50)', borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--sand-100)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sand-600)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Crime detail (per 100K residents)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--sand-400)' }}>Violent crime rate</div>
                    <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--sand-900)' }}>
                      {selected.violent_crime_rate?.toFixed(1) || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--sand-400)' }}>Property crime rate</div>
                    <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--sand-900)' }}>
                      {selected.property_crime_rate?.toFixed(1) || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Air quality detail */}
            {selected.median_aqi != null && (
              <div style={{
                padding: '14px 16px', marginBottom: '1.5rem',
                background: 'var(--sand-50)', borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--sand-100)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sand-600)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Air quality detail
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--sand-400)' }}>Median AQI</div>
                    <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--sand-900)' }}>
                      {selected.median_aqi?.toFixed(0) || 'N/A'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--sand-400)', marginTop: '2px' }}>
                      {selected.median_aqi <= 50 ? 'Good' : selected.median_aqi <= 100 ? 'Moderate' : 'Unhealthy'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--sand-400)' }}>Air quality score</div>
                    <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--sand-900)' }}>
                      {selected.air_quality_index?.toFixed(1) || 'N/A'}/100
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Price history */}
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
                <Info size={13} />
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
                      marginBottom: '10px', paddingBottom: '10px',
                      borderBottom: '1px solid var(--sand-100)'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sand-800)', marginBottom: '3px' }}>
                        {label}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--sand-600)', lineHeight: '1.6' }}>
                        {desc}
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: '11px', color: 'var(--sand-400)', marginTop: '4px' }}>
                    Data sources: Zillow Research · US Census ACS · Stanford SEDA · NCES · FBI Crime Data · EPA AQI · USDA Natural Amenities
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