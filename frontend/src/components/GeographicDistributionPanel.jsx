import React, { useMemo, useRef, useState } from 'react'
import { scaleQuantile } from 'd3-scale'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { STATE_FIPS_TO_CODE } from './usStateFips'

const US_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'
const EMPTY_FILL = '#e5e7eb'
const STROKE_COLOR = '#f8fafc'
const COLOR_RANGE = [
  'rgba(37, 99, 235, 0.16)',
  'rgba(37, 99, 235, 0.28)',
  'rgba(37, 99, 235, 0.42)',
  'rgba(59, 130, 246, 0.58)',
  'rgba(249, 115, 22, 0.78)',
  '#b91c1c'
]
const ESTIMATE_DISCLAIMER = 'Estimated geographic distribution: state names are extracted from free-text complaint descriptions, covering roughly 60–70% of complaints since not all complainants mention their location.'

function formatCount(count) {
  return `${count} complaint${count === 1 ? '' : 's'}`
}

export default function GeographicDistributionPanel({ stateData, loading, error }) {
  const containerRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  const countsByCode = useMemo(() => {
    return new Map(stateData.map((item) => [item.stateCode, item]))
  }, [stateData])

  const counts = useMemo(() => stateData.map((item) => item.count), [stateData])
  const maxCount = useMemo(() => Math.max(...counts, 0), [counts])
  const topStates = useMemo(() => stateData.slice(0, 10), [stateData])

  const colorScale = useMemo(() => {
    if (!counts.length) return null
    return scaleQuantile().domain(counts).range(COLOR_RANGE)
  }, [counts])

  function positionTooltip(event, stateName, count) {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return

    setTooltip({
      left: event.clientX - bounds.left + 16,
      top: event.clientY - bounds.top + 16,
      label: `${stateName}: ${formatCount(count)}`
    })
  }

  function clearTooltip() {
    setTooltip(null)
  }

  function getFill(count) {
    if (!count || !colorScale) return EMPTY_FILL
    return colorScale(count)
  }

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>Geographic Distribution</h2>
          <p className="muted section-note">{ESTIMATE_DISCLAIMER}</p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state-panel">
          <p className="muted empty-state">Loading geographic distribution...</p>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="empty-state-panel">
          <p className="muted empty-state">{error}</p>
        </div>
      ) : null}

      {!loading && !error && !stateData.length ? (
        <div className="empty-state-panel">
          <p className="muted empty-state">No geographic distribution could be estimated from the complaint summaries for this vehicle.</p>
        </div>
      ) : null}

      {!loading && !error && stateData.length ? (
        <div ref={containerRef} className="geo-distribution-layout">
          <div className="geo-map-panel">
            <ComposableMap projection="geoAlbersUsa" className="geo-map">
              <Geographies geography={US_ATLAS_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const code = STATE_FIPS_TO_CODE[String(geo.id).padStart(2, '0')]
                    const stateEntry = code ? countsByCode.get(code) : null
                    const count = stateEntry?.count || 0
                    const stateName = stateEntry?.state || geo.properties.name

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={getFill(count)}
                        stroke={STROKE_COLOR}
                        strokeWidth={0.8}
                        onMouseEnter={(event) => positionTooltip(event, stateName, count)}
                        onMouseMove={(event) => positionTooltip(event, stateName, count)}
                        onMouseLeave={clearTooltip}
                        style={{
                          default: { outline: 'none' },
                          hover: { fill: getFill(count), outline: 'none', opacity: 0.92 },
                          pressed: { outline: 'none' }
                        }}
                      />
                    )
                  })
                }
              </Geographies>
            </ComposableMap>

            {tooltip ? (
              <div
                className="geo-tooltip"
                style={{
                  left: tooltip.left,
                  top: tooltip.top
                }}
              >
                {tooltip.label}
              </div>
            ) : null}
          </div>

          <div className="geo-ranking-panel">
            <div className="geo-ranking-head">
              <h3>Top 10 States</h3>
              <span className="muted">{formatCount(maxCount)} peak</span>
            </div>

            <div className="geo-ranking-list">
              {topStates.map((item, index) => {
                const width = maxCount ? (item.count / maxCount) * 100 : 0

                return (
                  <div key={item.stateCode} className="geo-ranking-item">
                    <div className="geo-ranking-meta">
                      <span className="geo-ranking-rank">{index + 1}</span>
                      <div className="geo-ranking-copy">
                        <strong>{item.state}</strong>
                        <span className="muted">{formatCount(item.count)}</span>
                      </div>
                      <strong>{item.count}</strong>
                    </div>
                    <div className="geo-progress-track">
                      <div className="geo-progress-fill" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
