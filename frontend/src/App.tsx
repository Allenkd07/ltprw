import { useEffect, useState } from 'react'
import { getMeta, type Meta } from './api/client'
import { clockToMinutes } from './lib/format'
import { AccuracyView } from './pages/AccuracyView'
import { ForecastView } from './pages/ForecastView'
import './App.css'

type View = 'forecast' | 'accuracy'
type Theme = 'light' | 'dark'

const THEME_KEY = 'theme'

/** The saved choice (applied before paint by index.html), else the system setting. */
const initialTheme = (): Theme => {
  const saved = document.documentElement.dataset.theme
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <circle cx="12" cy="12" r="4.5" fill="currentColor" />
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </g>
  </svg>
)

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor" />
  </svg>
)

function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    setTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Storage blocked (e.g. private mode): the choice lasts for this visit only.
    }
  }
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The view is mirrored in the URL hash, so links like /#accuracy open it directly.
  const [view, setViewState] = useState<View>(() =>
    window.location.hash === '#accuracy' ? 'accuracy' : 'forecast',
  )
  const setView = (v: View) => {
    setViewState(v)
    window.history.replaceState(null, '', v === 'accuracy' ? '#accuracy' : window.location.pathname)
  }
  // Shared by both views, so the decision time carries over when switching.
  const [day, setDay] = useState<string | null>(null)
  const [cutoffMinutes, setCutoffMinutes] = useState<number | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    getMeta(ctrl.signal)
      .then((m) => {
        setMeta(m)
        setDay(m.delivery_start)
        setCutoffMinutes(clockToMinutes(m.default_cutoff))
      })
      .catch((e: Error) => e.name !== 'AbortError' && setError(e.message))
    return () => ctrl.abort()
  }, [])

  return (
    <div className="app">
      <header className="deck app__header">
        <div className="app__brand">
          <h1>Wind Forecast Monitor</h1>
          <p>GB national wind generation for day-ahead buying, January 2026. Times are UK time.</p>
        </div>
        <div className="app__tools">
          <nav className="app__nav" aria-label="Views">
            <button type="button" aria-pressed={view === 'forecast'} onClick={() => setView('forecast')}>
              Daily forecast
            </button>
            <button type="button" aria-pressed={view === 'accuracy'} onClick={() => setView('accuracy')}>
              January accuracy
            </button>
          </nav>
          <button
            type="button"
            className="app__theme"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      <main>
        {error && (
          <p role="alert">
            Couldn’t reach the backend: {error}. Start it with <code>uvicorn app.main:app</code> in{' '}
            <code>backend/</code>.
          </p>
        )}
        {meta && day && cutoffMinutes != null && view === 'forecast' && (
          <ForecastView
            meta={meta}
            day={day}
            onDayChange={setDay}
            cutoffMinutes={cutoffMinutes}
            onCutoffChange={setCutoffMinutes}
          />
        )}
        {meta && cutoffMinutes != null && view === 'accuracy' && (
          <AccuracyView
            meta={meta}
            cutoffMinutes={cutoffMinutes}
            onCutoffChange={setCutoffMinutes}
            onOpenDay={(d) => {
              setDay(d)
              setView('forecast')
              window.scrollTo({ top: 0 })
            }}
          />
        )}
      </main>
    </div>
  )
}

export default App
