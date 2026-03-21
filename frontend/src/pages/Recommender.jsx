import { useState } from 'react'
import { Sparkles, MapPin, Star, ArrowRight, Check } from 'lucide-react'
import './Recommender.css'

const allNeighborhoods = [
  { id: 1, name: 'Riverside Heights', city: 'Austin, TX', score: 92, price: '$485K', match: 97, tags: ['Family-friendly', 'Walkable', 'Top schools'], reason: 'Matches your school quality priority and walkability preference perfectly.', teal: true },
  { id: 2, name: 'Cedarwood Park',    city: 'Austin, TX', score: 84, price: '$398K', match: 91, tags: ['Quiet', 'Green space', 'Appreciating'], reason: 'Within your budget with excellent safety scores and 19 nearby parks.' },
  { id: 3, name: 'North Pines',       city: 'Austin, TX', score: 76, price: '$342K', match: 85, tags: ['Fast-growing', 'Affordable', 'New builds'], reason: 'Highest appreciation rate in the metro — aligns with your investment horizon.' },
  { id: 4, name: 'Lake Terrace',      city: 'Austin, TX', score: 95, price: '$820K', match: 74, tags: ['Premium', 'Lakeside', 'Top schools'], reason: 'Exceeds your budget but scores 9.6 on schools — worth exploring.' },
  { id: 5, name: 'Midtown Grove',     city: 'Austin, TX', score: 87, price: '$612K', match: 68, tags: ['Urban', 'Transit-rich', 'Nightlife'], reason: 'Strong transit access but slightly above budget and noisier than your preference.' },
]

const priorities = [
  { id: 'schools',    label: 'Top schools' },
  { id: 'safety',     label: 'Safety' },
  { id: 'walkable',   label: 'Walkability' },
  { id: 'transit',    label: 'Transit access' },
  { id: 'parks',      label: 'Parks & nature' },
  { id: 'nightlife',  label: 'Nightlife & dining' },
  { id: 'quiet',      label: 'Quiet streets' },
  { id: 'appreciate', label: 'Investment growth' },
]

export default function Recommender() {
  const [step, setStep] = useState(0)
  const [budget, setBudget] = useState(500)
  const [selected, setSelected] = useState(new Set(['schools', 'walkable', 'parks']))
  const [commute, setCommute] = useState('30')
  const [generated, setGenerated] = useState(false)
  const [loading, setLoading] = useState(false)

  const toggle = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const generate = () => {
    setLoading(true)
    setTimeout(() => { setLoading(false); setGenerated(true); setStep(3) }, 1400)
  }

  return (
    <div className="recommender">
      <div className="rec__left">
        <div className="rec__header">
          <Sparkles size={28} strokeWidth={1.5} className="rec__icon" />
          <h1>Personalized<br /><em>Picks</em></h1>
          <p>Tell us what matters most to you. We'll surface neighborhoods that genuinely fit your life — not just your budget.</p>
        </div>

        <div className="rec__steps">
          {[0, 1, 2].map(i => (
            <div key={i} className={`step-dot ${step >= i ? 'step-dot--active' : ''} ${step > i ? 'step-dot--done' : ''}`} onClick={() => setStep(i)} />
          ))}
        </div>

        {step === 0 && (
          <div className="rec__section animate-fadeUp">
            <div className="rec__section-title">What's your budget?</div>
            <div className="budget-display">${budget}K</div>
            <input type="range" min={200} max={1000} step={25} value={budget} onChange={e => setBudget(+e.target.value)} className="budget-slider" />
            <div className="budget-labels"><span>$200K</span><span>$1M+</span></div>
            <button className="next-btn" onClick={() => setStep(1)}>Next <ArrowRight size={15} /></button>
          </div>
        )}

        {step === 1 && (
          <div className="rec__section animate-fadeUp">
            <div className="rec__section-title">What matters most to you?</div>
            <div className="priorities-grid">
              {priorities.map(p => (
                <button key={p.id} className={`priority-btn ${selected.has(p.id) ? 'priority-btn--active' : ''}`} onClick={() => toggle(p.id)}>
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
            <div className="rec__section-title">Max commute time?</div>
            <div className="commute-opts">
              {['15', '30', '45', '60+'].map(t => (
                <button key={t} className={`commute-btn ${commute === t ? 'commute-btn--active' : ''}`} onClick={() => setCommute(t)}>
                  {t} min
                </button>
              ))}
            </div>
            <button className={`next-btn next-btn--generate ${loading ? 'next-btn--loading' : ''}`} onClick={generate} disabled={loading}>
              <Sparkles size={15} />
              {loading ? 'Finding matches…' : 'Find my neighborhoods'}
            </button>
          </div>
        )}

        {step === 3 && generated && (
          <div className="rec__summary animate-fadeUp">
            <div className="rec__section-title">Your preferences</div>
            <div className="summary-row"><span>Budget</span><strong>Up to ${budget}K</strong></div>
            <div className="summary-row"><span>Priorities</span><strong>{[...selected].map(id => priorities.find(p => p.id === id)?.label).join(', ')}</strong></div>
            <div className="summary-row"><span>Commute</span><strong>{commute} min max</strong></div>
            <button className="next-btn" style={{ marginTop: '1rem' }} onClick={() => setStep(0)}>Refine preferences</button>
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

        {generated && (
          <div className="rec__results animate-fadeIn">
            <div className="rec__results-header">
              <h2>Your top matches</h2>
              <span>{allNeighborhoods.length} neighborhoods · ranked by compatibility</span>
            </div>
            <div className="rec__list">
              {allNeighborhoods.map((n, i) => (
                <div key={n.id} className={`rec-card animate-fadeUp ${n.teal ? 'rec-card--top' : ''}`} style={{ animationDelay: `${i * 0.07}s` }}>
                  <div className="rec-card__match">
                    <div className="match-ring" style={{ '--pct': n.match }}>
                      <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--sand-200)" strokeWidth="2.5"/><circle cx="18" cy="18" r="15.5" fill="none" stroke={n.teal ? '#2a9d8f' : '#e9c46a'} strokeWidth="2.5" strokeDasharray={`${n.match * 0.974} 97.4`} strokeLinecap="round" transform="rotate(-90 18 18)"/></svg>
                      <span>{n.match}%</span>
                    </div>
                  </div>
                  <div className="rec-card__body">
                    <div className="rec-card__top">
                      <div>
                        <div className="rec-card__name">{n.name}</div>
                        <div className="rec-card__city"><MapPin size={11} /> {n.city}</div>
                      </div>
                      <div className="rec-card__meta">
                        <span className="rec-card__price">{n.price}</span>
                        <span className="rec-card__score"><Star size={11} fill="currentColor" /> {n.score}</span>
                      </div>
                    </div>
                    <p className="rec-card__reason">{n.reason}</p>
                    <div className="rec-card__tags">
                      {n.tags.map(t => <span key={t} className="tag">{t}</span>)}
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
