import { useState } from 'react'
import { TrendingUp, Home, BedDouble, Bath, Car, Ruler, MapPin, Zap, Loader } from 'lucide-react'
import { predictorApi } from '../api/client'
import './MarketPredictor.css'

function fmt(n) {
  if (!n) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(n)
}

export default function MarketPredictor() {
  const [form, setForm] = useState({
    zip_code: '78701', sqft: '1800', bedrooms: '3', bathrooms: '2',
    garage: true, year_built: '2005', condition: 'good',
    property_type: 'single_family', stories: '1'
  })
  const [result,     setResult]     = useState(null)
  const [comps,      setComps]      = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function predict() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload = {
        zip_code:      form.zip_code,
        sqft:          parseFloat(form.sqft),
        bedrooms:      parseInt(form.bedrooms),
        bathrooms:     parseFloat(form.bathrooms),
        year_built:    parseInt(form.year_built),
        condition:     form.condition,
        property_type: form.property_type,
        garage:        form.garage,
        stories:       parseInt(form.stories),
      }
      const [prediction, comparables] = await Promise.all([
        predictorApi.predict(payload),
        predictorApi.getComparables(form.zip_code, 3),
      ])
      setResult(prediction)
      setComps(comparables.comparables || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="predictor">
      <div className="predictor__left">
        <div className="predictor__header">
          <h1>Market Value<br /><em>Predictor</em></h1>
          <p>Enter your property details and our model will estimate its current market value using real ZHVI data from your zip code.</p>
        </div>

        <div className="pred-form">
          <div className="form-row">
            <div className="field">
              <label><MapPin size={13} /> ZIP code</label>
              <input type="text" value={form.zip_code} onChange={e => set('zip_code', e.target.value)} placeholder="e.g. 78701" />
            </div>
            <div className="field">
              <label><Ruler size={13} /> Square footage</label>
              <input type="number" value={form.sqft} onChange={e => set('sqft', e.target.value)} placeholder="e.g. 1800" />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label><BedDouble size={13} /> Bedrooms</label>
              <select value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)}>
                {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} bed{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label><Bath size={13} /> Bathrooms</label>
              <select value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)}>
                {[1,1.5,2,2.5,3,3.5,4].map(n => <option key={n} value={n}>{n} bath{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label><Car size={13} /> Garage</label>
              <select value={form.garage} onChange={e => set('garage', e.target.value === 'true')}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label><Home size={13} /> Year built</label>
              <input type="number" value={form.year_built} onChange={e => set('year_built', e.target.value)} placeholder="e.g. 2005" />
            </div>
            <div className="field">
              <label>Condition</label>
              <select value={form.condition} onChange={e => set('condition', e.target.value)}>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Property type</label>
            <select value={form.property_type} onChange={e => set('property_type', e.target.value)}>
              <option value="single_family">Single family</option>
              <option value="condo">Condo / co-op</option>
              <option value="townhouse">Townhouse</option>
            </select>
          </div>

          <button
            className={`predict-btn ${loading ? 'predict-btn--loading' : ''}`}
            onClick={predict}
            disabled={loading}
          >
            {loading ? <Loader size={16} className="spin" /> : <Zap size={16} />}
            {loading ? 'Running model…' : 'Estimate value'}
          </button>

          {error && (
            <div style={{ color: 'var(--coral-400)', fontSize: '13px', marginTop: '8px' }}>
              Error: {error}
            </div>
          )}
        </div>
      </div>

      <div className="predictor__right">
        {!result && !loading && (
          <div className="result-empty">
            <TrendingUp size={40} strokeWidth={1} />
            <p>Fill in the property details and click Estimate value to see your AI-powered valuation.</p>
          </div>
        )}

        {loading && (
          <div className="result-empty">
            <Loader size={36} className="spin" style={{ color: 'var(--teal-400)' }} />
            <p>Querying BigQuery for neighborhood data…</p>
          </div>
        )}

        {result && (
          <div className="result animate-fadeUp">
            <div className="result__label">Estimated market value</div>
            <div className="result__price">{fmt(result.estimated_value)}</div>

            <div className="result__range">
              <span>{fmt(result.low_estimate)}</span>
              <div className="result__range-bar">
                <div className="result__range-fill" />
                <div className="result__range-dot" />
              </div>
              <span>{fmt(result.high_estimate)}</span>
            </div>

            <div className="result__confidence">
              <span>Model confidence</span>
              <strong>{result.confidence}%</strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1.5rem' }}>
              {[
                ['Price per sqft',   `$${result.price_per_sqft?.toFixed(0)}`],
                ['City',             result.city || 'N/A'],
                ['Metro area',       result.metro_area?.split(',')[0] || 'N/A'],
                ['Median income',    fmt(result.neighborhood_data?.median_income)],
                ['Education index',  result.neighborhood_data?.education_index?.toFixed(1) || 'N/A'],
                ['Owner occupied',   result.neighborhood_data?.owner_occupied_pct ? `${result.neighborhood_data.owner_occupied_pct}%` : 'N/A'],
              ].map(([label, value]) => (
                <div key={label} style={{
                  padding: '10px 14px', background: 'var(--sand-50)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--sand-100)'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--sand-400)', marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--sand-800)' }}>{value}</div>
                </div>
              ))}
            </div>

            {comps.length > 0 && (
              <>
                <div className="result__divider" />
                <div className="comps-header">Comparable zip codes nearby</div>
                <div className="comps">
                  {comps.map(c => (
                    <div key={c.zip_code} className="comp">
                      <div>
                        <div className="comp__addr">{c.city}, {c.state} ({c.zip_code})</div>
                        <div className="comp__meta">Education: {c.education_index?.toFixed(1) || 'N/A'}</div>
                      </div>
                      <div className="comp__right">
                        <span className="comp__price">{fmt(c.zhvi_sfr)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <p className="result__disclaimer">
              This estimate uses real ZHVI data from Zillow Research via BigQuery.
              It is for informational purposes only — consult a licensed appraiser for official valuations.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}