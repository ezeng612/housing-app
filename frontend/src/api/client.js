const NEIGHBORHOOD_API = import.meta.env.VITE_NEIGHBORHOOD_API || 'http://localhost:8080'
const PREDICTOR_API    = import.meta.env.VITE_PREDICTOR_API    || 'http://localhost:8081'
const DASHBOARD_API    = import.meta.env.VITE_DASHBOARD_API    || 'http://localhost:8082'
const RECOMMENDER_API  = import.meta.env.VITE_RECOMMENDER_API  || 'http://localhost:8083'

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// ── Neighborhood Explorer ──────────────────────────────────────────────────

export const neighborhoodApi = {
  search: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    )
    return fetchJSON(`${NEIGHBORHOOD_API}/neighborhoods/search?${query}`)
  },

  getByZip: (zipCode) =>
    fetchJSON(`${NEIGHBORHOOD_API}/neighborhoods/${zipCode}`),

  getPriceHistory: (zipCode, months = 24) =>
    fetchJSON(`${NEIGHBORHOOD_API}/neighborhoods/${zipCode}/price-history?months=${months}`),

  getTopByMetric: (metric, params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    )
    return fetchJSON(`${NEIGHBORHOOD_API}/neighborhoods/top/${metric}?${query}`)
  },

  getMetros: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    )
    return fetchJSON(`${NEIGHBORHOOD_API}/metros?${query}`)
  },
}

// ── Market Value Predictor ─────────────────────────────────────────────────

export const predictorApi = {
  predict: (propertyData) =>
    fetchJSON(`${PREDICTOR_API}/predict`, {
      method: 'POST',
      body:   JSON.stringify(propertyData),
    }),

  getComparables: (zipCode, radius = 5) =>
    fetchJSON(`${PREDICTOR_API}/predict/comparable/${zipCode}?radius=${radius}`),

  getMarketTrends: (zipCode, months = 12) =>
    fetchJSON(`${PREDICTOR_API}/market/trends/${zipCode}?months=${months}`),
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export const dashboardApi = {
  getKpis: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    )
    return fetchJSON(`${DASHBOARD_API}/dashboard/kpis?${query}`)
  },

  getPriceTrends: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    )
    return fetchJSON(`${DASHBOARD_API}/dashboard/price-trends?${query}`)
  },

  getMetros: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    )
    return fetchJSON(`${DASHBOARD_API}/dashboard/metros?${query}`)
  },

  getValueDistribution: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    )
    return fetchJSON(`${DASHBOARD_API}/dashboard/value-distribution?${query}`)
  },

  getAffordability: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    )
    return fetchJSON(`${DASHBOARD_API}/dashboard/affordability?${query}`)
  },

  getEducationVsValue: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    )
    return fetchJSON(`${DASHBOARD_API}/dashboard/education-vs-value?${query}`)
  },
}

// ── Recommender ───────────────────────────────────────────────────────────

export const recommenderApi = {
  recommend: (preferences, limit = 10) =>
    fetchJSON(`${RECOMMENDER_API}/recommend?limit=${limit}`, {
      method: 'POST',
      body:   JSON.stringify(preferences),
    }),

  findSimilar: (zipCode, params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    )
    return fetchJSON(`${RECOMMENDER_API}/recommend/similar/${zipCode}?${query}`)
  },

  getTopMetros: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    )
    return fetchJSON(`${RECOMMENDER_API}/recommend/top-metros?${query}`)
  },
}