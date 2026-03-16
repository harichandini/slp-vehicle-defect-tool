import React, { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, ResponsiveContainer, Legend } from 'recharts'

const API = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const GEOGRAPHY_UNAVAILABLE_MESSAGE = 'Geographic complaint detail is not available for this vehicle in the current dataset.'
const SEVERITY_LABELS = [
  { key: 'crash', label: 'Crash' },
  { key: 'fire', label: 'Fire' },
  { key: 'injury', label: 'Injury' },
  { key: 'stall', label: 'Stall' },
  { key: 'transmission', label: 'Transmission' }
]
const YEAR_OPTIONS = Array.from({ length: 26 }, (_, index) => String(new Date().getFullYear() - index))
const CURATED_MAKES = [
  'Acura',
  'Alfa Romeo',
  'Audi',
  'BMW',
  'Buick',
  'Cadillac',
  'Chevrolet',
  'Chrysler',
  'Dodge',
  'FIAT',
  'Ford',
  'Genesis',
  'GMC',
  'Honda',
  'Hyundai',
  'INFINITI',
  'Jaguar',
  'Jeep',
  'Kia',
  'Land Rover',
  'Lexus',
  'Lincoln',
  'Mazda',
  'Mercedes-Benz',
  'MINI',
  'Mitsubishi',
  'Nissan',
  'Porsche',
  'Ram',
  'Subaru',
  'Tesla',
  'Toyota',
  'Volkswagen',
  'Volvo'
]

function getCaseStrengthLabel(score) {
  if (score >= 67) return 'High'
  if (score >= 34) return 'Medium'
  return 'Low'
}

async function readJson(response) {
  const json = await response.json()
  if (!response.ok) {
    throw new Error(json.detail || 'Request failed')
  }
  return json
}

export default function App() {
  const [searchMode, setSearchMode] = useState('vin')
  const [form, setForm] = useState({
    vin: '',
    make: '',
    year: '',
    model: '',
    symptom: 'transmission slipping'
  })
  const [data, setData] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modelOptions, setModelOptions] = useState([])
  const [modelsLoading, setModelsLoading] = useState(false)

  const recalls = useMemo(() => (Array.isArray(data?.recalls) ? data.recalls : []), [data])
  const complaints = useMemo(() => (Array.isArray(data?.complaints) ? data.complaints : []), [data])
  const defectPatterns = useMemo(() => (Array.isArray(data?.defect_patterns) ? data.defect_patterns : []), [data])

  useEffect(() => {
    let ignore = false

    async function loadModels() {
      if (!form.make || !form.year) {
        setModelOptions([])
        return
      }

      setModelsLoading(true)
      try {
        const params = new URLSearchParams({
          make: form.make,
          year: form.year
        })
        const json = await readJson(await fetch(`${API}/metadata/models?${params.toString()}`))
        if (!ignore) {
          setModelOptions(json.models || [])
        }
      } catch (e) {
        if (!ignore) {
          setModelOptions([])
          setError(e.message)
        }
      } finally {
        if (!ignore) {
          setModelsLoading(false)
        }
      }
    }

    loadModels()

    return () => {
      ignore = true
    }
  }, [form.make, form.year])

  const makeOptions = useMemo(() => CURATED_MAKES, [])

  const trendData = useMemo(() => {
    if (!data?.trend) return []
    return Object.entries(data.trend)
      .map(([year, metrics]) => {
        const yearlyMetrics = typeof metrics === 'number' ? { complaints: metrics } : (metrics || {})
        return {
          year,
          complaints: yearlyMetrics.complaints || 0,
          recalls: yearlyMetrics.recalls || 0,
          injuries: yearlyMetrics.injuries || 0,
          fires: yearlyMetrics.fires || 0,
          crashes: yearlyMetrics.crashes || 0
        }
      })
      .sort((a, b) => Number(a.year) - Number(b.year))
  }, [data])

  const geography = useMemo(() => {
    if (!data?.geography || typeof data.geography !== 'object' || Array.isArray(data.geography)) {
      return {
        state_counts: {},
        region_counts: {},
        classification: 'Unknown',
        summary: GEOGRAPHY_UNAVAILABLE_MESSAGE
      }
    }

    if ('state_counts' in data.geography || 'region_counts' in data.geography || 'classification' in data.geography || 'summary' in data.geography) {
      return {
        state_counts: data.geography.state_counts || {},
        region_counts: data.geography.region_counts || {},
        classification: data.geography.classification || 'Unknown',
        summary: data.geography.summary || GEOGRAPHY_UNAVAILABLE_MESSAGE
      }
    }

    return {
      state_counts: data.geography,
      region_counts: {},
      classification: 'Unknown',
      summary: GEOGRAPHY_UNAVAILABLE_MESSAGE
    }
  }, [data])

  const geoData = useMemo(() => {
    return Object.entries(geography.state_counts)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [geography])

  const regionData = useMemo(() => {
    return Object.entries(geography.region_counts)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
  }, [geography])

  const severityData = useMemo(() => {
    return SEVERITY_LABELS.map(({ key, label }) => ({
      key,
      label,
      count: data?.severity?.[key] || 0
    }))
  }, [data])

  const totalSeveritySignals = useMemo(() => {
    return severityData.reduce((sum, item) => sum + item.count, 0)
  }, [severityData])

  const maxComponentCount = useMemo(() => {
    if (!defectPatterns.length) return 0
    return Math.max(...defectPatterns.map(([, count]) => count))
  }, [defectPatterns])

  const caseStrength = useMemo(() => {
    if (!data) {
      return {
        score: 0,
        label: 'Low',
        explanation: 'Based on 0 recalls, 0 complaints, and 0 crash, injury, or fire signals, this vehicle shows a Low case-strength pattern.'
      }
    }

    const recallCount = data.recall_count || 0
    const complaintCount = data.complaint_count || 0
    const crashCount = data.severity?.crash || 0
    const injuryCount = data.severity?.injury || 0
    const fireCount = data.severity?.fire || 0

    const recallPoints = Math.min(recallCount * 10, 25)
    const complaintPoints = Math.min(Math.round((Math.min(complaintCount, 250) / 250) * 35), 35)
    const severityPoints = Math.min((crashCount * 4) + (injuryCount * 5) + (fireCount * 6), 40)
    const severeSignalCount = crashCount + injuryCount + fireCount
    const score = Math.min(recallPoints + complaintPoints + severityPoints, 100)
    const label = getCaseStrengthLabel(score)

    return {
      score,
      label,
      explanation: `Based on ${recallCount} recalls, ${complaintCount} complaints, and ${severeSignalCount} crash, injury, or fire signals, this vehicle shows a ${label} case-strength pattern.`
    }
  }, [data])

  function updateForm(field, value) {
    setError('')
    setForm((current) => {
      if (field === 'make') {
        return { ...current, make: value, model: '' }
      }
      if (field === 'year') {
        return { ...current, year: value, model: '' }
      }
      return { ...current, [field]: value }
    })
  }

  async function fetchVehicle() {
    setLoading(true)
    setError('')
    setSearchResults([])

    try {
      let response

      if (searchMode === 'vin') {
        if (!form.vin.trim()) {
          throw new Error('Enter a VIN to search by VIN.')
        }
        response = await fetch(`${API}/api/vehicle?vin=${encodeURIComponent(form.vin.trim())}`)
      } else {
        if (!form.make) {
          throw new Error('Select a make to search by vehicle.')
        }
        if (!form.year) {
          throw new Error('Select a year to search by vehicle.')
        }
        if (!form.model) {
          throw new Error('Select a model to search by vehicle.')
        }

        const params = new URLSearchParams({
          make: form.make,
          model: form.model,
          year: form.year
        })
        response = await fetch(`${API}/vehicle-search?${params.toString()}`)
      }

      const json = await readJson(response)
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function runSearch() {
    try {
      const params = new URLSearchParams({
        query: form.symptom,
        make: data?.vehicle?.make || form.make,
        model: data?.vehicle?.model || form.model,
        year: data?.vehicle?.year || form.year,
        limit: '5'
      })
      const json = await readJson(await fetch(`${API}/api/search?${params.toString()}`))
      setSearchResults(json.results)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="page">
      <header>
        <h1>SLP Vehicle Defect Tool</h1>
        <p>VIN lookup, recalls, complaint patterns, severity indicators, symptom search, and geographic context.</p>
      </header>

      <section className="card controls">
        <div className="mode-toggle" role="tablist" aria-label="Search modes">
          <button
            type="button"
            className={`mode-toggle-button${searchMode === 'vin' ? ' active' : ''}`}
            onClick={() => {
              setSearchMode('vin')
              setError('')
            }}
          >
            Search by VIN
          </button>
          <button
            type="button"
            className={`mode-toggle-button${searchMode === 'vehicle' ? ' active' : ''}`}
            onClick={() => {
              setSearchMode('vehicle')
              setError('')
            }}
          >
            Search by Vehicle
          </button>
        </div>

        {searchMode === 'vin' ? (
          <div className="single-field">
            <input
              placeholder="Enter VIN"
              value={form.vin}
              onChange={(e) => updateForm('vin', e.target.value)}
            />
          </div>
        ) : (
          <div className="grid vehicle-grid">
            <select value={form.make} onChange={(e) => updateForm('make', e.target.value)}>
              <option value="">Select Make</option>
              {makeOptions.map((make) => (
                <option key={make} value={make}>{make}</option>
              ))}
            </select>

            <select value={form.year} onChange={(e) => updateForm('year', e.target.value)}>
              <option value="">Select Year</option>
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <select value={form.model} onChange={(e) => updateForm('model', e.target.value)} disabled={!form.make || !form.year || modelsLoading}>
              <option value="">
                {modelsLoading ? 'Loading models...' : 'Select Model'}
              </option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
        )}

        <button onClick={fetchVehicle} disabled={loading}>
          {loading ? 'Loading...' : searchMode === 'vin' ? 'Search by VIN' : 'Search by Vehicle'}
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      {data && (
        <>
          <section className="card result-hero">
            <div>
              <p className="eyebrow">Vehicle snapshot</p>
              <h2>{data.vehicle.year} {data.vehicle.make} {data.vehicle.model}</h2>
              <p className="muted">
                {data.vehicle.vin ? `VIN: ${data.vehicle.vin}` : 'Search by make, model, and year'}
                {data.vehicle.trim ? ` | Trim: ${data.vehicle.trim}` : ''}
                {data.vehicle.engine ? ` | Engine: ${data.vehicle.engine}` : ''}
              </p>
            </div>
            <div className="hero-metrics">
              <div className="metric-tile">
                <span className="metric-value">{data.complaint_count}</span>
                <span className="metric-label">Complaints</span>
              </div>
              <div className="metric-tile">
                <span className="metric-value">{data.recall_count}</span>
                <span className="metric-label">Recalls</span>
              </div>
              <div className="metric-tile">
                <span className="metric-value">{totalSeveritySignals}</span>
                <span className="metric-label">Severity flags</span>
              </div>
            </div>
          </section>

          <section className="stats">
            <div className="card stat-card">
              <p className="eyebrow">Complaint volume</p>
              <p className="stat-value">{data.complaint_count}</p>
              <p className="muted">Total complaints returned for this vehicle.</p>
            </div>
            <div className="card stat-card">
              <p className="eyebrow">Recall campaigns</p>
              <p className="stat-value">{data.recall_count}</p>
              <p className="muted">Official manufacturer or NHTSA recall records.</p>
            </div>
            <div className="card stat-card">
              <p className="eyebrow">Top component</p>
              <p className="stat-value stat-value-text">{defectPatterns[0]?.[0] || 'None found'}</p>
              <p className="muted">{defectPatterns[0]?.[1] || 0} complaints in the leading component bucket.</p>
            </div>
            <div className="card stat-card">
              <p className="eyebrow">Severity summary</p>
              <p className="stat-value">{totalSeveritySignals}</p>
              <p className="muted">Crash, fire, injury, stall, and transmission signals.</p>
            </div>
          </section>

          {data.message && (
            <section className="card empty-banner">
              <p>{data.message}</p>
            </section>
          )}

          <section className="card score-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Case strength score</p>
                <h2>{caseStrength.score} / 100</h2>
                <p className={`score-label score-label-${caseStrength.label.toLowerCase()}`}>{caseStrength.label}</p>
              </div>
              <div className="score-ring">
                <span>{caseStrength.score}</span>
              </div>
            </div>
            <p className="score-copy">{caseStrength.explanation}</p>
          </section>

          <section className="two-col">
            <div className="card">
              <div className="section-head">
                <div>
                  <h2>Severity indicators</h2>
                  <p className="muted">Keyword-based signals found in complaint narratives.</p>
                </div>
              </div>
              <div className="severity-grid">
                {severityData.map((item) => (
                  <div key={item.key} className={`severity-chip${item.count ? ' active' : ''}`}>
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="section-head">
                <div>
                  <h2>Top components</h2>
                  <p className="muted">Most frequently cited complaint components.</p>
                </div>
              </div>
              {defectPatterns.length ? (
                <div className="component-list">
                  {defectPatterns.map(([component, count]) => (
                    <div key={component} className="component-row">
                      <div className="component-meta">
                        <strong>{component}</strong>
                        <span className="muted">{count} complaints</span>
                      </div>
                      <div className="component-bar">
                        <div
                          className="component-fill"
                          style={{ width: `${maxComponentCount ? (count / maxComponentCount) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted empty-state">No defect patterns found.</p>
              )}
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <h2>Recall campaigns</h2>
                <p className="muted">Official recall records associated with this vehicle.</p>
              </div>
            </div>
            {recalls.length ? (
              <div className="recall-list">
                {recalls.map((recall) => (
                  <article key={recall.NHTSACampaignNumber} className="recall-item">
                    <div className="recall-header">
                      <div>
                        <strong>{recall.NHTSACampaignNumber}</strong>
                        <span className="badge">{recall.Component || 'Unknown component'}</span>
                      </div>
                      <span className="muted">{recall.ReportReceivedDate || 'Unknown date'}</span>
                    </div>
                    <p>{recall.Summary || 'No recall summary provided.'}</p>
                    <p className="muted">Consequence: {recall.Consequence || 'Not provided.'}</p>
                    <p className="muted">Remedy: {recall.Remedy || 'Not provided.'}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted empty-state">No recalls found.</p>
            )}
          </section>

          <section className="two-col">
            <div className="card">
              <h2>Vehicle Defect Trends by Year</h2>
              {trendData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="complaints" name="Complaints" stroke="#111827" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="recalls" name="Recalls" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="injuries" name="Injuries" stroke="#dc2626" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="fires" name="Fires" stroke="#ea580c" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="crashes" name="Crashes" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="muted empty-state">No yearly trend data available.</p>
              )}
            </div>

            <div className="card geography-card">
              <div className="section-head">
                <div>
                  <h2>Geographic Pattern</h2>
                  {geoData.length ? (
                    <p className="muted section-note">{geography.summary}</p>
                  ) : null}
                </div>
                {geoData.length ? (
                  <span className={`geo-badge geo-badge-${geography.classification.toLowerCase()}`}>
                    {geography.classification}
                  </span>
                ) : null}
              </div>
              {geoData.length ? (
                <>
                  {regionData.length ? (
                    <div className="region-list">
                      {regionData.map(({ region, count }) => (
                        <div key={region} className="region-chip">
                          <strong>{region}</strong>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={geoData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="state" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="empty-state-panel">
                  <p className="muted empty-state">{GEOGRAPHY_UNAVAILABLE_MESSAGE}</p>
                </div>
              )}
            </div>
          </section>

          <section className="two-col">
            <div className="card">
              <h2>Symptom search</h2>
              <div className="search-box">
                <input
                  placeholder="Search complaint symptoms"
                  value={form.symptom}
                  onChange={(e) => updateForm('symptom', e.target.value)}
                />
                <button onClick={runSearch}>Search</button>
              </div>
              {searchResults.length ? (
                <div className="results">
                  {searchResults.map((item, idx) => (
                    <article key={idx} className="result-item">
                      <strong>{item.component}</strong>
                      <div className="muted">Score: {item.score} | {item.date || 'Unknown date'} | {item.state || 'Unknown state'}</div>
                      <p>{item.summary}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted empty-state">No complaints found.</p>
              )}
            </div>

            <section className="card">
              <h2>Recent complaint excerpts</h2>
              {complaints.length ? (
                complaints.slice(0, 10).map((c, idx) => (
                  <article key={idx} className="result-item">
                    <strong>{c.component || 'Unknown component'}</strong>
                    <div className="muted">{c.date || 'Unknown date'} | {c.state || 'Unknown state'} | Tags: {c.tags?.join(', ') || 'none'}</div>
                    <p>{c.summary || 'No summary available.'}</p>
                  </article>
                ))
              ) : (
                <p className="muted empty-state">No complaints found.</p>
              )}
            </section>
          </section>
        </>
      )}
    </div>
  )
}
