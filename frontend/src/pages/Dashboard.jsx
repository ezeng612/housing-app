import { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Loader } from 'lucide-react'
import { dashboardApi } from '../api/client'
import './Dashboard.css'

function fmt(n) {
  if (!n) return 'N/A'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: n >= 1000000 ? 'compact' : 'standard', maximumFractionDigits: 0 }).format(n)
}

const PIE_COLORS = ['#2a9d8f', '#e9c46a', '#e76f51', '#8c7660', '#5dc9a5']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="chart-tooltip__row">
          <span style={{ color: p.color }}>{p.name}</span>
          <strong>{typeof p.value === 'number' ? fmt(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [kpis, setKpis] = useState(null)
  const [trends, setTrends] = useState([])
  const [metros, setMetros] = useState([])
  const [distribution, setDistribution] = useState([])
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState('')
  const [months, setMonths] = useState(24)

  useEffect(() => { loadAll() }, [state, months])

  async function loadAll() {
    setLoading(true)
    try {
      const params = {}
      if (state) params.state = state
      const [kpiData, trendData, metroData, distData] = await Promise.all([
        dashboardApi.getKpis(params),
        dashboardApi.getPriceTrends({ ...params, months }),
        dashboardApi.getMetros({ ...params, limit: 10 }),
        dashboardApi.getValueDistribution(params),
      ])
      setKpis(kpiData)
      setTrends(trendData.trends || [])
      setMetros(metroData.metros || [])
      setDistribution(distData.distribution || [])
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard__topbar">
        <div>
          <h1>Market Dashboard</h1>
          <p>Real data from Zillow Research via BigQuery</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select value={state} onChange={e => setState(e.target.value)} style={{ fontSize: '13px', padding: '6px 10px', borderRadius: '8px' }}>
            <option value="">All states</option>
            {['CA','TX','NY','FL','WA','CO','IL','MA','AZ','GA'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="range-tabs">
            {[{ label: '12m', value: 12 }, { label: '24m', value: 24 }, { label: '3y', value: 36 }, { label: '5y', value: 60 }].map(r => (
              <button key={r.value} className={`range-tab ${months === r.value ? 'range-tab--active' : ''}`} onClick={() => setMonths(r.value)}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Loader size={36} className="spin" style={{ color: 'var(--teal-400)' }} />
        </div>
      ) : (
        <>
          <div className="kpi-grid">
            {kpis && [
              { label: 'Avg home value', value: fmt(kpis.avg_home_value) },
              { label: 'Avg median income', value: fmt(kpis.avg_median_income) },
              { label: 'Avg education index', value: kpis.avg_education_index?.toFixed(1) },
              { label: 'Total zip codes', value: kpis.total_zip_codes?.toLocaleString() },
            ].map(k => (
              <div key={k.label} className="kpi-card">
                <span className="kpi-card__label">{k.label}</span>
                <span className="kpi-card__value">{k.value}</span>
              </div>
            ))}
          </div>

          <div className="charts-grid">
            <div className="chart-card chart-card--wide">
              <div className="chart-card__header">
                <span>Home value trend (ZHVI)</span>
                <span className="chart-subtitle">Average across all zip codes</span>
              </div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trends} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="10%" stopColor="#2a9d8f" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2a9d8f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#f2ede4" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#8c7660' }} axisLine={false} tickLine={false} tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
                    <YAxis tick={{ fontSize: 11, fill: '#8c7660' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="avg_zhvi_sfr" name="Avg home value" stroke="#2a9d8f" strokeWidth={2} fill="url(#tealGrad)" dot={false} activeDot={{ r: 4, fill: '#2a9d8f' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card__header">
                <span>Price distribution</span>
                <span className="chart-subtitle">Zip codes by value range</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', height: 220 }}>
                <ResponsiveContainer width={200} height={220}>
                  <PieChart>
                    <Pie data={distribution} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="zip_count" paddingAngle={3}>
                      {distribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => `${v.toLocaleString()} zips`} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  {distribution.map((d, i) => (
                    <div key={d.price_range} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--sand-600)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{d.price_range}</span>
                      <strong style={{ color: 'var(--sand-900)' }}>{d.zip_count?.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card__header">
                <span>Top metros by home value</span>
                <span className="chart-subtitle">Average ZHVI</span>
              </div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={metros.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#f2ede4" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#8c7660' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                    <YAxis type="category" dataKey="metro_area" tick={{ fontSize: 10, fill: '#8c7660' }} axisLine={false} tickLine={false} width={90} tickFormatter={v => v?.split(',')[0]?.substring(0, 12) || v} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avg_home_value" name="Avg home value" fill="#e9c46a" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card chart-card--wide">
              <div className="chart-card__header">
                <span>Rent trend (ZORI)</span>
                <span className="chart-subtitle">Average monthly rent across zip codes</span>
              </div>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={trends} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#f2ede4" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#8c7660' }} axisLine={false} tickLine={false} tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
                    <YAxis tick={{ fontSize: 11, fill: '#8c7660' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(0)}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="avg_rent" name="Avg rent" stroke="#e76f51" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
