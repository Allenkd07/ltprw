const RADIUS = 4

interface BarProps {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
}

/** Bar with only its data end rounded, anchored square on the zero line (works for negatives). */
export function RoundedBar({ x = 0, y = 0, width = 0, height = 0, fill = 'var(--bar-error)' }: BarProps) {
  const top = Math.min(y, y + height)
  const h = Math.abs(height)
  const r = Math.min(RADIUS, h, width / 2)
  const down = height < 0 // Recharts gives negative height for bars below zero
  const d = down
    ? `M${x},${top} h${width} v${h - r} q0,${r} -${r},${r} h-${width - 2 * r} q-${r},0 -${r},-${r} Z`
    : `M${x},${top + h} v-${h - r} q0,-${r} ${r},-${r} h${width - 2 * r} q${r},0 ${r},${r} v${h - r} Z`
  return <path d={d} fill={fill} />
}
