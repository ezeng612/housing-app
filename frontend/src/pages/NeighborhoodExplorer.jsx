import { useState, useEffect, useRef } from 'react'
import {
  Search, MapPin, Star, TrendingUp, Users,
  Shield, GraduationCap, Wind, TreePine,
  Loader, Info, ChevronRight, Home, SlidersHorizontal
} from 'lucide-react'
import { neighborhoodApi } from '../api/client'
import NeighborhoodMap from '../components/NeighborhoodMap'
import './NeighborhoodExplorer.css'

const SORT_OPTIONS = [
  { key: 'value_score',           label: 'Best value' },
  { key: 'affordability_score',   label: 'Most affordable' },
  { key: 'safety_index',          label: 'Safest' },
  { key: 'air_quality_index',     label: 'Best air quality' },
  { key: 'natural_amenity_score', label: 'Best amenities' },
  { key: 'education_index',       label: 'Best schools' },
  { key: 'zhvi_sfr',              label: 'Highest value' },
  { key: 'price_to_income_ratio', label: 'Most affordable (PTI)' },
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
  { label: 'Value score',           desc: 'Composite score (0-100) combining affordability (25%), safety (20%), education (20%), air quality (15%), natural amenities (12%), and market tier (8%).' },
  { label: 'Affordability score',   desc: 'How affordable homes are relative to local median income. 100 minus the price-to-income ratio scaled to 0-100.' },
  { label: 'Price-to-income ratio', desc: 'Median home value divided by median household income. Under 3x is affordable, 3-5x is moderate, above 8x is expensive.' },
  { label: 'Safety index',          desc: 'Composite of violent and property crime rates per 100K residents from FBI Crime Data. 100 = safest.' },
  { label: 'Air quality index',     desc: 'Based on EPA Annual AQI county data. 100 = cleanest air. AQI under 50 scores 75-100.' },
  { label: 'Natural amenity score', desc: 'USDA Natural Amenities Scale — climate, topography, and water features. Converted from 1-7 rank to 0-100.' },
  { label: 'Education index',       desc: 'Composite of SEDA academic achievement scores and school availability per zip code.' },
  { label: 'Home value (ZHVI)',     desc: 'Zillow Home Value Index — smoothed, seasonally adjusted estimate for single-family homes.' },
  { label: 'Monthly rent (ZORI)',   desc: 'Zillow Observed Rent Index — average asking rent across all home types.' },
  { label: 'Median income',         desc: 'Median household income from US Census Bureau ACS 5-Year Estimates (2024).' },
]

function fmt(n) {
  if (!n) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(n)
}

function fmtPop(n) {
  if (!n) return 'N/A'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString()
}

function ScoreBar({ value, max = 100, color = '#2a9d8f' }) {
  return (
    <div className="score-bar">
      <div className="score-bar__fill" style={{
        width: `${Math.min(100, ((value || 0) / max) * 100)}%`,
        background: color
      }} />
    </div>
  )
}

function TierBadge({ tier }) {
  if (!tier || tier === 'Unknown') return null
  const colors = TIER_COLORS[tier] || TIER_COLORS['Unknown']
  return (
    <span style={{
      fontSize: '11px', padding: '3px 10px', borderRadius: '99px',
      fontWeight: 500, background: colors.bg, color: colors.text, flexShrink: 0,
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
      fontSize: '11px', padding: '3px 8px', borderRadius: '99px',
      fontWeight: 500, background: c.bg, color: c.text, flexShrink: 0,
    }}>
      {c.label}
    </span>
  )
}

export default function NeighborhoodExplorer() {
  const [query,           setQuery]           = useState('')
  const [suggestions,     setSuggestions]     = useState([])
  const [searchMode,      setSearchMode]      = useState(null)
  const [selectedCity,    setSelectedCity]    = useState(null)
  const [cityStats,       setCityStats]       = useState(null)
  const [sortBy,          setSortBy]          = useState('value_score')
  const [neighborhoods,   setNeighborhoods]   = useState([])
  const [selected,        setSelected]        = useState(null)
  const [history,         setHistory]         = useState([])
  const [loading,         setLoading]         = useState(false)
  const [searchLoading,   setSearchLoading]   = useState(false)
  const [showMetrics,     setShowMetrics]     = useState(false)
  const [error,           setError]           = useState(null)
  const debounceRef = useRef(null)

  // Debounced search — detects zip vs city
  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([])
      return
    }
    // Zip code — 5 digits
    if (/^\d{5}$/.test(query.trim())) {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => handleZipSearch(query.trim()), 300)
      return
    }
    // City search
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const data = await neighborhoodApi.searchCities(query)
        setSuggestions(data.cities || [])
      } catch {
        setSuggestions([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }, [query])

  // Reload when sort changes for city mode
  useEffect(() => {
    if (selectedCity && searchMode === 'city') {
      loadCityNeighborhoods(selectedCity)
    }
  }, [sortBy])

  async function handleZipSearch(zip) {
    setSearchLoading(true)
    setError(null)
    setSuggestions([])
    setSearchMode('zip')
    try {
      const data = await neighborhoodApi.getNeighborhood(zip)
      if (data) {
        setNeighborhoods([data])
        setCityStats(null)
        setSelectedCity(null)
        await selectNeighborhood(data)
      }
    } catch {
      setError(`Zip code ${zip} not found`)
      setNeighborhoods([])
    } finally {
      setSearchLoading(false)
    }
  }

  async function loadCityNeighborhoods(city) {
    setLoading(true)
    setError(null)
    try {
      const data = await neighborhoodApi.getCityNeighborhoods(
        city.city, city.state, sortBy
      )
      setNeighborhoods(data.neighborhoods || [])
      setCityStats({
        zip_count:       data.zip_count,
        avg_home_value:  data.avg_home_value,
        avg_value_score: data.avg_value_score,
        min_home_value:  data.min_home_value,
        max_home_value:  data.max_home_value,
      })
      if (data.neighborhoods?.length > 0) {
        await selectNeighborhood(data.neighborhoods[0])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function selectNeighborhood(nbhd) {
    setSelected(nbhd)
    try {
      const hist = await neighborhoodApi.getPriceHistory(nbhd.zip_code, 24)
      setHistory(hist.history || [])
    } catch {
      setHistory([])
    }
  }

  function handleCitySelect(city) {
    setSelectedCity(city)
    setSearchMode('city')
    setQuery(`${city.city}, ${city.state}`)
    setSuggestions([])
    setSelected(null)
    loadCityNeighborhoods(city)
  }

  function handleClear() {
    setQuery('')
    setSuggestions([])
    setSearchMode(null)
    setSelectedCity(null)
    setCityStats(null)
    setNeighborhoods([])
    setSelected(null)
    setHistory([])
    setError(null)
  }

  return (
    <div className="explorer">

      {/* ── Sidebar ── */}
      <div className="explorer__sidebar">

        {/* Search */}
        <div className="explorer__search-wrap" style={{ position: 'relative' }}>
          <Search size={16} className="explorer__search-icon" />
          <input
            className="explorer__search"
            placeholder="City name or 5-digit zip code…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {searchLoading && (
            <Loader size={14} className="spin" style={{
              position: 'absolute', right: '12px', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--teal-400)'
            }} />
          )}
          {query && !searchLoading && (
            <button
              onClick={handleClear}
              style={{
                position: 'absolute', right: '12px', top: '50%',
                transform: 'translateY(-50%)', background: 'none',
                border: 'none', cursor: 'pointer', color: 'var(--sand-400)',
                fontSize: '16px', lineHeight: 1, padding: 0
              }}
            >×</button>
          )}

          {/* Autocomplete dropdown */}
          {suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: '#fff', border: '1px solid var(--sand-200)',
              borderRadius: 'var(--border-radius-md)', zIndex: 100,
              boxShadow: 'var(--shadow-md)', overflow: 'hidden', marginTop: '4px'
            }}>
              {suggestions.map((c, i) => (
                <button
                  key={i}
                  onClick={() => handleCitySelect(c)}
                  style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', width: '100%',
                    padding: '10px 14px', background: 'transparent',
                    border: 'none',
                    borderBottom: i < suggestions.length - 1
                      ? '1px solid var(--sand-100)' : 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--sand-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sand-900)' }}>
                      {c.city}, {c.state}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--sand-400)' }}>
                      {c.zip_count} zip code{c.zip_count !== 1 ? 's' : ''} · avg {fmt(c.avg_home_value)}
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--sand-400)', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* City stats banner */}
        {cityStats && selectedCity && (
          <div style={{
            padding: '12px 16px', background: 'var(--sand-100)',
            borderBottom: '1px solid var(--sand-200)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sand-900)', marginBottom: '6px' }}>
              {selectedCity.city}, {selectedCity.state}
              <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--sand-400)', marginLeft: '6px' }}>
                Top {cityStats.zip_count} zip codes
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[
                ['Avg home value', fmt(cityStats.avg_home_value)],
                ['Price range',    `${fmt(cityStats.min_home_value)} – ${fmt(cityStats.max_home_value)}`],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: '10px', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sand-800)' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sort dropdown */}
        {neighborhoods.length > 0 && (
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
        )}

        {/* Neighborhood list */}
        <div className="explorer__list">
          {!query && !loading && (
            <div style={{
              padding: '2rem 1rem', textAlign: 'center',
              color: 'var(--sand-400)', fontSize: '13px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '0.75rem'
            }}>
              <Home size={32} strokeWidth={1} style={{ opacity: 0.4 }} />
              <p style={{ margin: 0 }}>Search a city or zip code</p>
              <p style={{ margin: 0, fontSize: '11px', opacity: 0.7 }}>
                e.g. "Austin", "Newark NJ", or "78701"
              </p>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader size={24} className="spin" style={{ color: 'var(--teal-400)' }} />
            </div>
          )}

          {error && (
            <div style={{ padding: '1rem', color: 'var(--coral-400)', fontSize: '13px' }}>
              {error}
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
                  <div className="nbhd-card__name">
                    {searchMode === 'city' ? n.zip_code : (n.city || n.zip_code)}
                  </div>
                  <div className="nbhd-card__city">
                    <MapPin size={11} />
                    {searchMode === 'city' ? n.state : `${n.zip_code} · ${n.state}`}
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

      {/* ── Map ── */}
      <div className="explorer__map">
        {neighborhoods.length > 0 ? (
          <NeighborhoodMap
            neighborhoods={neighborhoods}
            selected={selected}
            onSelect={selectNeighborhood}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '1rem',
            color: 'var(--sand-300)', background: 'var(--sand-50)'
          }}>
            <MapPin size={40} strokeWidth={1} style={{ opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: '13px' }}>Search a city to see it on the map</p>
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      <div className="explorer__detail">
        {!selected && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--sand-400)',
            flexDirection: 'column', gap: '1rem'
          }}>
            <MapPin size={40} strokeWidth={1} />
            <p style={{ margin: 0 }}>
              {neighborhoods.length > 0
                ? 'Select a neighborhood from the list'
                : 'Search for a city or zip code to get started'}
            </p>
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
              Zillow ZHVI data. All metrics reflect zip code level aggregates, not individual properties.
            </div>

            {/* Header */}
            <div className="detail__header">
              <div>
                <h1 className="detail__name">
                  {selected.city || selected.zip_code}
                  {selected.city && (
                    <span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--sand-400)', marginLeft: '8px' }}>
                      {selected.zip_code}
                    </span>
                  )}
                </h1>
                <p className="detail__city">
                  <MapPin size={14} /> {selected.state}
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

            {/* Quality scores */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '10px', marginBottom: '1.5rem'
            }}>
              {[
                { label: 'Value score',       value: selected.value_score,           icon: Star,          color: '#2a9d8f' },
                { label: 'Affordability',     value: selected.affordability_score,   icon: TrendingUp,    color: '#2a9d8f' },
                { label: 'Safety',            value: selected.safety_index,          icon: Shield,        color: '#639922' },
                { label: 'Air quality',       value: selected.air_quality_index,     icon: Wind,          color: '#185fa5' },
                { label: 'Education',         value: selected.education_index,       icon: GraduationCap, color: '#534ab7' },
                { label: 'Natural amenities', value: selected.natural_amenity_score, icon: TreePine,      color: '#3b6d11' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} style={{
                  padding: '12px 14px', background: 'var(--sand-50)',
                  borderRadius: 'var(--border-radius-md)', border: '1px solid var(--sand-100)'
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
                  fontSize: '12px', fontWeight: 500, color: 'var(--sand-600)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '0', marginBottom: showMetrics ? '12px' : '0'
                }}
              >
                <Info size={13} />
                {showMetrics ? 'Hide' : 'Show'} how we calculate these metrics
              </button>

              {showMetrics && (
                <div style={{
                  padding: '1.25rem', background: 'var(--sand-50)',
                  borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--sand-100)'
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

          </div>
        )}
      </div>
    </div>
  )
}