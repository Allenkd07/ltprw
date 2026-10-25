export type PanelView = 'chart' | 'table'

interface Props {
  view: PanelView
  onChange: (view: PanelView) => void
  /** What the panel shows, for screen readers: "Wind generation: show as chart / table". */
  label: string
}

/** Chart | Table toggle for a panel's header. */
export function ViewSwitch({ view, onChange, label }: Props) {
  return (
    <div className="view-switch" role="group" aria-label={`${label}: show as`}>
      <button type="button" aria-pressed={view === 'chart'} onClick={() => onChange('chart')}>
        Chart
      </button>
      <button type="button" aria-pressed={view === 'table'} onClick={() => onChange('table')}>
        Table
      </button>
    </div>
  )
}
