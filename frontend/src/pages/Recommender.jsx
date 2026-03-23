import { useState } from 'react'
import { Sparkles, MapPin, Star, ArrowRight, Check, Loader } from 'lucide-react'
import { recommenderApi } from '../api/client'
import './Recommender.css'

const priorities = [
  { id: 'schools',   label: 'Top schools'      },
  { id: 'family',    label: 'Family friendly'  },
  { id: 'quiet',     label: 'Quiet streets'    },
  { id: 'walkable',  label: 'Walkability'      },
  { id: 'appreciate',label: 'Investment growth'},
  { id: 'affordable',label: 'Affordability'    },
  { id: 'nightlife', label: 'Nightlife & dining'},
  { id: 'transit',   label: 'Transit access'   },
]

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID',
  'IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE',
  'NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN',
  'TX','UT','VT','VA','WA','WV','WI','WY']

function fmt(n) {
  if (!n) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(n)
}

export default function Recommender() {
  const [step,     setStep]     = useState(0)
  const [budget,   setBudget]   = useState(600)
  const [minBudget,setMinBudget]= useState(300)
  const [selected, setSelected] = useState(new Set(['schools', 'family']))
  const [state,    setState]    = useState('TX')
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [generated,setGenerated]= useState(false)

  const toggle = id => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const prefs = {
        max_budget:       budget * 1000,
        min_budget:       minBudget * 1000,
        priorities:       [...selected],
        state:            state || undefined,
        prefer_ownership: true,
      }
      const data = await recommenderApi.recommend(prefs, 8)
      setResults(data.results || [])
      setGenerated(true)
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="recommender">
      <div className="rec__left">
        <div className="rec__header">
          <Sparkles size={28} strokeWidth={1.5} className="rec__icon" />
          <h1>Personalized<br /><em>Picks</em></h1>
          <p>Tell us what matters most and we'll surface neighborhoods that genuinely fit your life.</p>
        </div>

        <div className="rec__steps">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`step-dot ${step >= i ? 'step-dot--active' : ''} ${step > i ? 'step-dot--done' : ''}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="rec__section animate-fadeUp">
            <div className="rec__section-title">What's your budget range?</div>
            <div className="budget-display">${minBudget}K – ${budget}K</div>
            <div style={{ fontSize: '12px', color: 'var(--sand-400)', marginBottom: '8px' }}>Max budget</div>
            <input type="range" min={200} max={2000} step={25} value={budget}
              onChange={e => setBudget(+e.target.value)} className="budget-slider" />
            <div style={{ fontSize: '12px', color: 'var(--sand-400)', margin: '8px 0' }}>Min budget</div>
            <input type="range" min={100} max={budget} step={25} value={minBudget}
              onChange={e => setMinBudget(+e.target.value)} className="budget-slider" />
            <div className="budget-labels"><span>$100K</span><span>$2M+</span></div>
            <button className="next-btn" onClick={() => setStep(1)}>Next <ArrowRight size={15} /></button>
          </div>
        )}

        {step === 1 && (
          <div className="rec__section animate-fadeUp">
            <div className="rec__section-title">What matters most?</div>
            <div className="priorities-grid">
              {priorities.map(p => (
                <button
                  key={p.id}
                  className={`priority-btn ${selected.has(p.id) ? 'priority-btn--active' : ''}`}
                  onClick={() => toggle(p.id)}
                >
                  {selected.has(p.id) && <Check size={12} />}
                  {p.label}
                </button>
              ))}
            </div>
            <button className="next-btn" onClick={() => setStep(2)}>Next <ArrowRight size={15} /></button>
          </div>
        )}

        {step === 2 && (
          <div className="rec__section animate-fadeUp">
            <div className="rec__section-title">Which state?</div>
            <select
              value={state}
              onChange={e => setState(e.target.value)}
              style={{ marginBottom: '1rem', fontSize: '14px' }}
            >
              <option value="">Any state</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {error && (
              <div style={{ color: 'var(--coral-400)', fontSize: '13px', marginBottom: '8px' }}>
                Error: {error}
              </div>
            )}
            <button
              className={`next-btn next-btn--generate ${loading ? 'next-btn--loading' : ''}`}
              onClick={generate}
              disabled={loading}
            >
              {loading ? <Loader size={15} className="spin" /> : <Sparkles size={15} />}
              {loading ? 'Finding matches…' : 'Find my neighborhoods'}
            </button>
          </div>
        )}

        {step === 3 && generated && (
          <div className="rec__summary animate-fadeUp">
            <div className="rec__section-title">Your preferences</div>
            <div className="summary-row"><span>Budget</span><strong>${minBudget}K – ${budget}K</strong></div>
            <div className="summary-row"><span>Priorities</span><strong>{[...selected].join(', ')}</strong></div>
            <div className="summary-row"><span>State</span><strong>{state || 'Any'}</strong></div>
            <div className="summary-row"><span>Results</span><strong>{results.length} neighborhoods</strong></div>
            <button className="next-btn" style={{ marginTop: '1rem' }} onClick={() => setStep(0)}>
              Refine preferences
            </button>
          </div>
        )}
      </div>

      <div className="rec__right">
        {!generated && (
          <div className="rec__empty">
            <Sparkles size={40} strokeWidth={1} />
            <p>Complete the preferences on the left to see your personalized neighborhood matches.</p>
          </div>
        )}

        {generated && results.length === 0 && (
          <div className="rec__empty">
            <MapPin size={40} strokeWidth={1} />
            <p>No neighborhoods found matching your criteria. Try adjusting your budget or state filter.</p>
          </div>
        )}

        {generated && results.length > 0 && (
          <div className="rec__results animate-fadeIn">
            <div className="rec__results-header">
              <h2>Your top matches</h2>
              <span>{results.length} neighborhoods · ranked by compatibility</span>
            </div>
            <div className="rec__list">
              {results.map((n, i) => (
                <div
                  key={n.zip_code}
                  className={`rec-card animate-fadeUp ${i === 0 ? 'rec-card--top' : ''}`}
                  style={{ animationDelay: `${i * 0.07}s` }}
                >
                  <div className="rec-card__match">
                    <div className="match-ring">
                      <svg viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--sand-200)" strokeWidth="2.5"/>
                        <circle cx="18" cy="18" r="15.5" fill="none"
                          stroke={i === 0 ? '#2a9d8f' : '#e9c46a'}
                          strokeWidth="2.5"
                          strokeDasharray={`${n.match_score * 0.974} 97.4`}
                          strokeLinecap="round"
                          transform="rotate(-90 18 18)"
                        />
                      </svg>
                      <span>{n.match_score?.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="rec-card__body">
                    <div className="rec-card__top">
                      <div>
                        <div className="rec-card__name">{n.city || n.zip_code}</div>
                        <div className="rec-card__city">
                          <MapPin size={11} /> {n.zip_code} · {n.state}
                        </div>
                      </div>
                      <div className="rec-card__meta">
                        <span className="rec-card__price">{fmt(n.zhvi_sfr)}</span>
                        <span className="rec-card__score">
                          <Star size={11} fill="currentColor" />
                          {n.education_index?.toFixed(0) || '–'}
                        </span>
                      </div>
                    </div>
                    <p className="rec-card__reason">{n.reason}</p>
                    <div className="rec-card__tags">
                      {n.metro_area && (
                        <span className="tag">{n.metro_area.split(',')[0]}</span>
                      )}
                      {n.median_income && (
                        <span className="tag">Income: {fmt(n.median_income)}</span>
                      )}
                      {n.education_index && (
                        <span className="tag">Education: {n.education_index.toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}