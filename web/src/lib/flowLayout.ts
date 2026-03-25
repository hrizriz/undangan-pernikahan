import type { FlowLayout, FlowNodePosition } from '../types'

export const FLOW_DEFAULT_X = 280
export const FLOW_DEFAULT_Y = 48

export function defaultFlowLayout(count: number): FlowNodePosition[] {
  return Array.from({ length: count }, (_, i) => ({
    x: i * FLOW_DEFAULT_X,
    y: FLOW_DEFAULT_Y,
  }))
}

/** Pakai layout tersimpan bila panjang cocok dengan jumlah slide; jika tidak, grid default. */
export function mergeFlowLayoutFromSettings(count: number, layout?: FlowLayout | null): FlowNodePosition[] {
  const nodes = layout?.nodes
  if (!Array.isArray(nodes) || nodes.length !== count) {
    return defaultFlowLayout(count)
  }
  return nodes.map((p, i) => {
    let x = typeof p?.x === 'number' && Number.isFinite(p.x) ? p.x : i * FLOW_DEFAULT_X
    let y = typeof p?.y === 'number' && Number.isFinite(p.y) ? p.y : FLOW_DEFAULT_Y
    if (Math.abs(x) > 12000 || Math.abs(y) > 12000) {
      x = i * FLOW_DEFAULT_X
      y = FLOW_DEFAULT_Y
    }
    return { x, y }
  })
}
