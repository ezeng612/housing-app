import { useRef, useEffect, useState, useCallback } from 'react'
import Map, { Marker, Popup, NavigationControl, ScaleControl } from 'react-map-gl'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const TIER_COLORS = {
  'Hidden gem':  '#0f6e56',
  'Great value': '#3b6d11',
  'Fair market': '#854f0b',
  'Premium':     '#993c1d',
  'Overpriced':  '#a32d2d',
  'Unknown':     '#5f5e5a',
}

function getMarkerColor(neighborhood) {
  return TIER_COLORS[neighborhood.value_tier] || TIER_COLORS['Unknown']
}

function getMarkerSize(neighborhood, isSelected) {
  if (isSelected) return 20
  if (neighborhood.value_score >= 70) return 14
  return 10
}

function fmt(n) {
  if (!n) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(n)
}

export default function NeighborhoodMap({
  neighborhoods,
  selected,
  onSelect,
  cityName,
}) {
  const [popupInfo,  setPopupInfo]  = useState(null)
  const [viewState,  setViewState]  = useState({
    longitude: -98.5795,
    latitude:  39.8283,
    zoom:      3.5,
  })

  // When neighborhoods change fit map to show all markers
  useEffect(() => {
    if (!neighborhoods?.length) return

    const withCoords = neighborhoods.filter(n => n.latitude && n.longitude)
    if (!withCoords.length) return

    if (withCoords.length === 1) {
      setViewState({
        longitude: withCoords[0].longitude,
        latitude:  withCoords[0].latitude,
        zoom:      11,
      })
      return
    }

    // Calculate bounding box
    const lngs = withCoords.map(n => n.longitude)
    const lats  = withCoords.map(n => n.latitude)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const centerLng = (minLng + maxLng) / 2
    const centerLat  = (minLat + maxLat) / 2

    // Estimate zoom from bounding box size
    const lngDiff = maxLng - minLng
    const latDiff  = maxLat - minLat
    const maxDiff  = Math.max(lngDiff, latDiff)
    let zoom = 10
    if (maxDiff > 10)  zoom = 5
    else if (maxDiff > 5)   zoom = 6
    else if (maxDiff > 2)   zoom = 7
    else if (maxDiff > 1)   zoom = 8
    else if (maxDiff > 0.5) zoom = 9
    else if (maxDiff > 0.2) zoom = 10
    else zoom = 11

    setViewState({ longitude: centerLng, latitude: centerLat, zoom })
  }, [neighborhoods])

  // Pan to selected neighborhood
  useEffect(() => {
    if (selected?.latitude && selected?.longitude) {
      setViewState(prev => ({
        ...prev,
        longitude: selected.longitude,
        latitude:  selected.latitude,
        zoom:      Math.max(prev.zoom, 11),
      }))
      setPopupInfo(selected)
    }
  }, [selected])

  const withCoords = neighborhoods?.filter(n => n.latitude && n.longitude) || []

  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 'var(--border-radius-lg)', overflow: 'hidden' }}>
      <Map
        {...viewState}
        onMove={e => setViewState(e.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
        onClick={() => setPopupInfo(null)}
      >
        <NavigationControl position="top-right" />
        <ScaleControl position="bottom-right" />

        {withCoords.map(n => {
          const isSelected = selected?.zip_code === n.zip_code
          const color      = getMarkerColor(n)
          const size       = getMarkerSize(n, isSelected)

          return (
            <Marker
              key={n.zip_code}
              longitude={n.longitude}
              latitude={n.latitude}
              anchor="center"
              onClick={e => {
                e.originalEvent.stopPropagation()
                setPopupInfo(n)
                onSelect(n)
              }}
            >
              <div
                style={{
                  width:        size,
                  height:       size,
                  borderRadius: '50%',
                  background:   color,
                  border:       isSelected ? '2px solid #fff' : '1.5px solid rgba(255,255,255,0.7)',
                  boxShadow:    isSelected
                    ? `0 0 0 3px ${color}, 0 2px 8px rgba(0,0,0,0.3)`
                    : '0 1px 4px rgba(0,0,0,0.2)',
                  cursor:       'pointer',
                  transition:   'all 0.15s',
                }}
              />
            </Marker>
          )
        })}

        {popupInfo && popupInfo.latitude && popupInfo.longitude && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            anchor="bottom"
            onClose={() => setPopupInfo(null)}
            closeButton={true}
            closeOnClick={false}
            maxWidth="240px"
            style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}
          >
            <div style={{ padding: '4px 2px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a1a', marginBottom: '2px' }}>
                {popupInfo.city || popupInfo.zip_code}
                <span style={{ fontWeight: 400, color: '#888', marginLeft: '4px', fontSize: '11px' }}>
                  {popupInfo.zip_code}
                </span>
              </div>

              <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px' }}>
                {popupInfo.state}
                {popupInfo.metro_area ? ` · ${popupInfo.metro_area.split(',')[0]}` : ''}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '6px' }}>
                {[
                  ['Home value',    fmt(popupInfo.zhvi_sfr)],
                  ['Rent',          fmt(popupInfo.zori_rent)],
                  ['Value score',   popupInfo.value_score?.toFixed(1) || 'N/A'],
                  ['Safety',        popupInfo.safety_index?.toFixed(1) || 'N/A'],
                  ['Education',     popupInfo.education_index?.toFixed(1) || 'N/A'],
                  ['Air quality',   popupInfo.air_quality_index?.toFixed(1) || 'N/A'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#1a1a1a' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {popupInfo.value_tier && popupInfo.value_tier !== 'Unknown' && (
                <div style={{
                  display: 'inline-block', fontSize: '10px', fontWeight: 500,
                  padding: '2px 8px', borderRadius: '99px',
                  background: popupInfo.value_tier === 'Hidden gem' ? '#e1f5ee' :
                              popupInfo.value_tier === 'Great value' ? '#eaf3de' :
                              popupInfo.value_tier === 'Fair market' ? '#faeeda' :
                              popupInfo.value_tier === 'Premium'     ? '#faece7' : '#fcebeb',
                  color: popupInfo.value_tier === 'Hidden gem' ? '#0f6e56' :
                         popupInfo.value_tier === 'Great value' ? '#3b6d11' :
                         popupInfo.value_tier === 'Fair market' ? '#854f0b' :
                         popupInfo.value_tier === 'Premium'     ? '#993c1d' : '#a32d2d',
                }}>
                  {popupInfo.value_tier}
                </div>
              )}

              <button
                onClick={() => onSelect(popupInfo)}
                style={{
                  display: 'block', width: '100%', marginTop: '8px',
                  padding: '5px', borderRadius: '6px', fontSize: '11px',
                  background: 'var(--teal-400, #2a9d8f)', color: '#fff',
                  border: 'none', cursor: 'pointer', fontWeight: 500,
                }}
              >
                View details →
              </button>
            </div>
          </Popup>
        )}
      </Map>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '32px', left: '10px',
        background: 'rgba(255,255,255,0.92)', borderRadius: '8px',
        padding: '8px 12px', fontSize: '10px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Value tier
        </div>
        {Object.entries(TIER_COLORS).filter(([k]) => k !== 'Unknown').map(([tier, color]) => (
          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ color: '#555' }}>{tier}</span>
          </div>
        ))}
      </div>
    </div>
  )
}