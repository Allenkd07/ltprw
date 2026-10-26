import './Skeleton.css'

/** One grey placeholder block; the parent's layout decides where it sits. */
function Bone({ w = '100%', h }: { w?: string; h: number }) {
  return <span className="skel" style={{ width: w, height: h }} />
}

function ChartBone({ plot }: { plot: number }) {
  return (
    <div className="chart" aria-hidden="true">
      <Bone w="40%" h={18} />
      <Bone h={plot} />
    </div>
  )
}

/** Announces loading once; the bones themselves are hidden from screen readers. */
function Status({ label }: { label: string }) {
  return <span className="skel-sr">{label}</span>
}

function Headline() {
  return (
    <div className="fv__headline" aria-hidden="true">
      <Bone w="28%" h={18} />
      <Bone w="78%" h={44} />
      <Bone w="46%" h={44} />
    </div>
  )
}

function Figures({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i}>
      <Bone w="50%" h={14} />
      <Bone w="70%" h={32} />
      <Bone w="90%" h={12} />
    </div>
  ))
}

/** Daily view body, shaped like the real one so nothing jumps when data arrives. */
export function ForecastSkeleton() {
  return (
    <div className="fv__body skel-wrap" role="status">
      <Status label="Loading the forecast for this day…" />
      <Headline />
      <div className="fv__grid" aria-hidden="true">
        <div className="fv__charts">
          <ChartBone plot={320} />
          <ChartBone plot={180} />
        </div>
        <div className="fv__summary">
          <dl className="skel-dl">
            <Figures count={4} />
          </dl>
        </div>
      </div>
    </div>
  )
}

/** January view body: headline, figure tiles and the first question. */
export function AccuracySkeleton() {
  return (
    <div className="fv__body skel-wrap" role="status">
      <Status label="Loading January accuracy…" />
      <Headline />
      <dl className="av__stats skel-dl" aria-hidden="true">
        <Figures count={4} />
      </dl>
      <div className="av__chapter" aria-hidden="true">
        <div className="av__lede">
          <Bone w="85%" h={30} />
          <Bone h={14} />
          <Bone w="80%" h={14} />
        </div>
        <div className="av__figure">
          <ChartBone plot={220} />
        </div>
      </div>
    </div>
  )
}

/** Whole view, decision band included, for before the app's metadata has loaded. */
export function ViewSkeleton({ view }: { view: 'forecast' | 'accuracy' }) {
  return (
    <div className="fv">
      <div className={`deck ${view === 'forecast' ? 'fv__controls' : 'av__controls'} skel-wrap`} aria-hidden="true">
        {view === 'forecast' && (
          <div className="fv__day">
            <Bone w="45%" h={18} />
            <Bone h={40} />
          </div>
        )}
        <div className="skel-stack">
          <Bone w="20%" h={22} />
          <Bone w="60%" h={14} />
          <Bone h={56} />
        </div>
      </div>
      {view === 'forecast' ? <ForecastSkeleton /> : <AccuracySkeleton />}
    </div>
  )
}
