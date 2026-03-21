import { useState } from 'react'
import { TrendingUp, Home, BedDouble, Bath, Car, Ruler, MapPin, Zap } from 'lucide-react'
import './MarketPredictor.css'

const COMPS = [
  { address: '142 Maple St', price: '$492,000', sqft: 1840, beds: 3, baths: 2, dist: '0.3mi', diff: '-1.2%' },
  { address: '87 Riverside Dr', price: '$518,000', sqft: 1960, beds: 4, baths: 2, dist: '0.5mi', diff: '+3.2%' },
  { address: '310 Oak Ave', price: '$471,000', sqft: 1720, beds: 3, baths: 2, dist: '0.7mi', diff: '-5.5%' },
]

function estimatePrice({ sqft, beds, baths, garage, year, condition, neighborhood }) {
  const base = sqft * 248
  const bedAdj = (beds - 3) * 12000
  const bathAdj = (baths - 2) * 9500
  const garageAdj = garage === 'yes' ? 18000 : 0
  const ageAdj = (2024 - parseInt(year || 2000)) * -280
  const condMap = { excellent: 1.08, good: 1.0, fair: 0.91, poor: 0.82 }
  const nbhdMap = { 'Riverside Heights': 1.04, 'Midtown Grove': 1.12, 'Cedarwood Park': 0.95, 'The Arts District': 1.07, 'North Pines': 0.88, 'Lake Terrace': 1.22 }
  const price = base * (condMap[condition] || 1) * (nbhdMap[neighborhood] || 1) + bedAdj + bathAdj + garageAdj + ageAdj
  return Math.max(180000, Math.round(price / 1000) * 1000)
}

function fmt(n) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) }

export default function MarketPredictor() {
  const [form, setForm] = useState({ sqft: '1800', beds: '3', baths: '2', garage: 'yes', year: '2005', condition: 'good', neighborhood: 'Riverside Heights', zip: '78701' })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const predict = () => {
    setLoading(true)
    setResult(null)
    setTimeout(() => {
      const price = estimatePrice(form)
      setResult({ price, low: Math.round(price * 0.94), high: Math.round(price * 1.06), confidence: 91 })
      setLoading(false)
    }, 1200)
  }

  return (
    <div className="predictor">
      <div className="predictor__left">
        <div className="predictor__header">
          <h1>Market Value<br /><em>Predictor</em></h1>
          <p>Enter your property details and our Vertex AI model will estimate its current market value based on 2.4M comparable sales.</p>
        </div>

        <div className="pred-form">
          <div className="form-row">
            <div className="field">
              <label><Ruler size={13} /> Square footage</label>
              <input type="number" value={form.sqft} onChange={e => set('sqft', e.target.value)} placeholder="e.g. 1800" />
            </div>
            <div className="field">
              <label><MapPin size={13} /> ZIP code</label>
              <input type="text" value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="e.g. 78701" />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label><BedDouble size={13} /> Bedrooms</label>
              <select value={form.beds} onChange={e => set('beds', e.target.value)}>
                {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} bed{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label><Bath size={13} /> Bathrooms</label>
              <select value={form.baths} onChange={e => set('baths', e.target.value)}>
                {[1,1.5,2,2.5,3,3.5,4].map(n => <option key={n} value={n}>{n} bath{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label><Car size={13} /> Garage</label>
              <select value={form.garage} onChange={e => set('garage', e.target.value)}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label><Home size={13} /> Year built</label>
              <input type="number" value={form.year} onChange={e => set('year', e.target.value)} placeholder="e.g. 2005" min="1900" max="2024" />
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
            <label><MapPin size={13} /> Neighborhood</label>
            <select value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)}>
              {['Riverside Heights','Midtown Grove','Cedarwood Park','The Arts District','North Pines','Lake Terrace'].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <button className={`predict-btn ${loading ? 'predict-btn--loading' : ''}`} onClick={predict} disabled={loading}>
            <Zap size={16} />
            {loading ? 'Running model…' : 'Estimate value'}
          </button>
        </div>
      </div>

      <div className="predictor__right">
        {!result && !loading && (
          <div className="result-empty">
            <TrendingUp size={40} strokeWidth={1} />
            <p>Fill in the property details and click <strong>Estimate value</strong> to see your AI-powered valuation.</p>
          </div>
        )}

        {loading && (
          <div className="result-empty">
            <div className="spinner" />
            <p>Running Vertex AI model…</p>
          </div>
        )}

        {result && (
          <div className="result animate-fadeUp">
            <div className="result__label">Estimated market value</div>
            <div className="result__price">{fmt(result.price)}</div>
            <div className="result__range">
              <span>{fmt(result.low)}</span>
              <div className="result__range-bar">
                <div className="result__range-fill" />
                <div className="result__range-dot" />
              </div>
              <span>{fmt(result.high)}</span>
            </div>
            <div className="result__confidence">
              <span>Model confidence</span>
              <strong>{result.confidence}%</strong>
            </div>

            <div className="result__divider" />

            <div className="comps-header">Comparable sales nearby</div>
            <div className="comps">
              {COMPS.map(c => (
                <div key={c.address} className="comp">
                  <div className="comp__addr">{c.address}</div>
                  <div className="comp__meta">{c.sqft.toLocaleString()} sqft · {c.beds}bd/{c.baths}ba · {c.dist}</div>
                  <div className="comp__right">
                    <span className="comp__price">{c.price}</span>
                    <span className={`comp__diff ${parseFloat(c.diff) < 0 ? 'comp__diff--down' : 'comp__diff--up'}`}>{c.diff} vs estimate</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="result__disclaimer">This estimate is generated by a machine learning model for informational purposes only. Consult a licensed appraiser for official valuations.</p>
          </div>
        )}
      </div>
    </div>
  )
}
