import { useState } from 'react'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import './Dashboard.css'

const priceHistory = [
  { month: 'Jan', median: 410, volume: 342 },
  { month: 'Feb', median: 418, volume: 298 },
  { month: 'Mar', median: 425, volume: 401 },
  { month: 'Apr', median: 438, volume: 456 },
  { month: 'May', median: 451, volume: 512 },
  { month: 'Jun', median: 468, volume: 489 },
  { month: 'Jul', median: 472, volume: 431 },
  { month: 'Aug', median: 465, volume: 398 },
  { month: 'Sep', median: 471, volume: 362 },
  { month: 'Oct', median: 483, volume: 310 },
  { month: 'Nov', median: 491, volume: 287 },
  { month: 'Dec', median: 498, volume: 268 },
]

const domData = [
  { nbhd: 'Lake Terrace', days: 11 },
  { nbhd: 'Midtown', days: 14 },
  { nbhd: 'Riverside', days: 18 },
  { nbhd: 'Arts Dist.', days: 22 },
  { nbhd: 'Cedarwood', days: 24 },
  { nbhd: 'N. Pines', days: 31 },
]

const typeData = [
  { name: 'Single family', value: 58, color: '#2a9d8f' },
  { name: 'Condo / co-op', value: 24, color: '#e9c46a' },
  { name: 'Townhouse', value: 12, color: '#e76f51' },
  { name: 'Multi-family', value: 6, color: '#8c7660' },
]

const affordData = [
  { year: '2019', index: 112 }, { year: '2020', index: 108 }, { year: '2021', index: 94 },
  { year: '2022', index: 78 }, { year: '2023', index: 71 }, { year: '2024', index: 69 },
]

const kpis = [
  { label: 'Median price', value: '$498K', change: '+6.2%', up: true },
  { label: 'Active listings', value: '1,847', change: '-12.4%', up: false },
  { label: 'Avg days on market', value: '19', change: '-3 days', up: true },
  { label: 'Sale-to-list ratio', value: '103%', change: '+1.4pp', up: true },
]

const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="chart-tooltip__row">
          <span style={{ color: p.color }}>{p.name}</span>
          <strong>{prefix}{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{suffix}</strong>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [range, setRange] = useState('12m')

  return (
    <div className="dashboard">
      <div className="dashboard__topbar">
        <div>
          <h1>Market Dashboard</h1>
          <p>Austin Metro · Updated daily from MLS feed</p>
        </div>
        <div className="range-tabs">
          {['3m', '6m', '12m', '2y'].map(r => (
            <button key={r} className={`range-tab ${range === r ? 'range-tab--active' : ''}`} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
      </div>

      <div className="kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className="kpi-card">
            <span className="kpi-card__label">{k.label}</span>
            <span className="kpi-card__value">{k.value}</span>
            <span className={`kpi-card__change ${k.up ? 'kpi-card__change--up' : 'kpi-card__change--down'}`}>{k.change} YoY</span>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-card chart-card--wide">
          <div className="chart-card__header">
            <span>Median sale price</span>
            <span className="chart-subtitle">$000s · Austin Metro</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={priceHistory} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="10%" stopColor="#2a9d8f" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2a9d8f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f2ede4" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8c7660' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8c7660' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}K`} />
              <Tooltip content={<CustomTooltip prefix="$" suffix="K" />} />
              <Area type="monotone" dataKey="median" name="Median price" stroke="#2a9d8f" strokeWidth={2} fill="url(#tealGrad)" dot={false} activeDot={{ r: 4, fill: '#2a9d8f' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <span>Property types</span>
            <span className="chart-subtitle">% of sales</span>
          </div>
          <div className="pie-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                  {typeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              {typeData.map(d => (
                <div key={d.name} className="pie-legend__item">
                  <span style={{ background: d.color }} className="pie-legend__dot" />
                  <span>{d.name}</span>
                  <strong>{d.value}%</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <span>Days on market</span>
            <span className="chart-subtitle">By neighborhood</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={domData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f2ede4" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8c7660' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nbhd" tick={{ fontSize: 11, fill: '#8c7660' }} axisLine={false} tickLine={false} width={70} />
              <Tooltip content={<CustomTooltip suffix=" days" />} />
              <Bar dataKey="days" name="Avg DOM" fill="#e9c46a" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card chart-card--wide">
          <div className="chart-card__header">
            <span>Affordability index</span>
            <span className="chart-subtitle">100 = historically affordable · lower = less affordable</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={affordData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#f2ede4" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#8c7660' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8c7660' }} axisLine={false} tickLine={false} domain={[60, 120]} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="index" name="Affordability" stroke="#e76f51" strokeWidth={2} dot={{ r: 4, fill: '#e76f51' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
