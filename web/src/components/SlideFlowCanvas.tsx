import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStoreApi,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { sanitizeTheme } from '../data/invitationTemplates'
import { getFlowBackgroundConfig } from '../lib/flowCanvasTheme'
import { FLOW_DEFAULT_X, FLOW_DEFAULT_Y } from '../lib/flowLayout'
import { SLIDE_TYPE_OPTIONS } from '../lib/slideTemplates'
import type { FlowDraftSlide, FlowNodePosition } from '../types'
import './slide-flow.css'

const nodeTypes = { slideNode: SlideNode }

function slideTypeLabel(slideType: string): string {
  return SLIDE_TYPE_OPTIONS.find((o) => o.type === slideType)?.label ?? slideType
}

function nodeLabel(d: FlowDraftSlide): string {
  const p = d.payload
  let t =
    typeof p.title === 'string'
      ? p.title
      : typeof p.heading === 'string'
        ? p.heading
        : typeof p.text === 'string'
          ? p.text
          : typeof p.label === 'string'
            ? p.label
            : ''
  if (!t.trim() && d.slide_type === 'couple') {
    const g = typeof p.groom_name === 'string' ? p.groom_name : ''
    const b = typeof p.bride_name === 'string' ? p.bride_name : ''
    t = [g, b].filter((x) => x.trim()).join(' & ')
  }
  const s = t.trim()
  if (s) return s.length > 42 ? `${s.slice(0, 40)}…` : s
  return slideTypeLabel(d.slide_type)
}

function buildEdges(drafts: FlowDraftSlide[]): Edge[] {
  const e: Edge[] = []
  for (let i = 0; i < drafts.length - 1; i++) {
    e.push({
      id: `e-${drafts[i].clientKey}-${drafts[i + 1].clientKey}`,
      source: drafts[i].clientKey,
      target: drafts[i + 1].clientKey,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    })
  }
  return e
}

function buildNodes(
  drafts: FlowDraftSlide[],
  selectedKey: string | null,
  positions: FlowNodePosition[],
): Node[] {
  return drafts.map((d, i) => ({
    id: d.clientKey,
    type: 'slideNode',
    position: positions[i] ?? { x: i * FLOW_DEFAULT_X, y: FLOW_DEFAULT_Y },
    selected: selectedKey === d.clientKey,
    data: {
      label: nodeLabel(d),
      slideTypeLabel: slideTypeLabel(d.slide_type),
      index: i,
    },
  }))
}

function SlideNode({ data, selected }: NodeProps) {
  const idx = typeof data.index === 'number' ? data.index : 0
  const label = typeof data.label === 'string' ? data.label : ''
  const st = typeof data.slideTypeLabel === 'string' ? data.slideTypeLabel : ''
  return (
    <>
      <Handle type="target" position={Position.Left} className="slide-flow-handle" />
      <div className={`slide-flow-node ${selected ? 'slide-flow-node--selected' : ''}`}>
        <div className="slide-flow-node__step">Alur #{idx + 1}</div>
        <div className="slide-flow-node__type">{st}</div>
        <div className="slide-flow-node__title">{label || '—'}</div>
      </div>
      <Handle type="source" position={Position.Right} className="slide-flow-handle" />
    </>
  )
}

/** Di dalam &lt;ReactFlow&gt; — memanggil fitView saat daftar slide (identitas) berubah. */
function FlowViewportSync({ syncKey }: { syncKey: string }) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (!syncKey) return
    const id = window.setTimeout(() => {
      fitView({ padding: 0.2, maxZoom: 1.15, minZoom: 0.08, duration: 280 })
    }, 80)
    return () => clearTimeout(id)
  }, [syncKey, fitView])

  return null
}

type InnerProps = {
  drafts: FlowDraftSlide[]
  positions: FlowNodePosition[]
  selectedKey: string | null
  onSelectKey: (clientKey: string | null) => void
  onReorder: (next: FlowDraftSlide[]) => void
  onPositionsChange: (next: FlowNodePosition[]) => void
  canvasTheme: ReturnType<typeof sanitizeTheme>
}

function FlowCanvasInner({
  drafts,
  positions,
  selectedKey,
  onSelectKey,
  onReorder,
  onPositionsChange,
  canvasTheme,
}: InnerProps) {
  const store = useStoreApi()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const prevKeysRef = useRef<string>('')

  const keysSig = useMemo(() => drafts.map((d) => d.clientKey).join('\0'), [drafts])

  const bg = useMemo(() => getFlowBackgroundConfig(canvasTheme), [canvasTheme])

  useEffect(() => {
    const keyChanged = keysSig !== prevKeysRef.current
    if (keyChanged) {
      prevKeysRef.current = keysSig
    }
    setNodes(buildNodes(drafts, selectedKey, positions))
    setEdges(buildEdges(drafts))
  }, [drafts, keysSig, selectedKey, positions, setNodes, setEdges])

  const getCurrentNodes = useCallback((): Node[] => {
    return store.getState().nodes.map((n) => ({ ...n }))
  }, [store])

  const onNodeDragStop = useCallback(() => {
    const current = getCurrentNodes()
    if (current.length === 0) {
      onPositionsChange([])
      return
    }
    if (current.length === 1) {
      const n = current[0]
      onPositionsChange([{ x: n.position.x, y: n.position.y }])
      return
    }

    const sortedByX = [...current].sort((a, b) => a.position.x - b.position.x)
    const orderIds = drafts.map((d) => d.clientKey)
    const sortedIds = sortedByX.map((n) => n.id)
    const orderChanged =
      sortedIds.length === orderIds.length && sortedIds.some((id, i) => id !== orderIds[i])

    if (orderChanged) {
      const newDrafts = sortedByX
        .map((n) => drafts.find((d) => d.clientKey === n.id))
        .filter((x): x is FlowDraftSlide => x != null)
      if (newDrafts.length !== drafts.length) return
      const newPositions = sortedByX.map((n) => ({
        x: n.position.x,
        y: n.position.y,
      }))
      onReorder(newDrafts)
      onPositionsChange(newPositions)
      return
    }

    const nextPos: FlowNodePosition[] = orderIds.map((id) => {
      const node = current.find((n) => n.id === id)
      return node
        ? { x: node.position.x, y: node.position.y }
        : { x: 0, y: FLOW_DEFAULT_Y }
    })
    onPositionsChange(nextPos)
  }, [drafts, getCurrentNodes, onReorder, onPositionsChange])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectKey(node.id)
    },
    [onSelectKey],
  )

  const onPaneClick = useCallback(() => {
    onSelectKey(null)
  }, [onSelectKey])

  return (
    <ReactFlow
      className={`dark slide-flow-rf slide-flow-rf--theme-${canvasTheme}`}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      selectNodesOnDrag={false}
      deleteKeyCode={null}
      panOnScroll
      zoomOnScroll
      zoomOnPinch
      minZoom={0.08}
      maxZoom={1.5}
      defaultEdgeOptions={{ type: 'smoothstep' }}
      proOptions={{ hideAttribution: true }}
    >
      <FlowViewportSync syncKey={keysSig} />
      <Background variant={bg.variant} gap={bg.gap} size={bg.size} color={bg.color} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeStrokeWidth={2}
        zoomable
        pannable
        style={{ background: '#1a222c' }}
        maskColor="rgba(15, 20, 25, 0.85)"
      />
    </ReactFlow>
  )
}

export type SlideFlowCanvasProps = {
  drafts: FlowDraftSlide[]
  positions: FlowNodePosition[]
  selectedKey: string | null
  onSelectKey: (clientKey: string | null) => void
  onReorder: (next: FlowDraftSlide[]) => void
  onPositionsChange: (next: FlowNodePosition[]) => void
  /** Tema halaman tamu — mengubah pola grid & latar kanvas. */
  theme?: string | null
}

export function SlideFlowCanvas({
  drafts,
  positions,
  selectedKey,
  onSelectKey,
  onReorder,
  onPositionsChange,
  theme,
}: SlideFlowCanvasProps) {
  const canvasTheme = sanitizeTheme(theme)
  return (
    <div className={`slide-flow-wrap slide-flow-wrap--theme-${canvasTheme}`}>
      <ReactFlowProvider>
        <FlowCanvasInner
          drafts={drafts}
          positions={positions}
          selectedKey={selectedKey}
          onSelectKey={onSelectKey}
          onReorder={onReorder}
          onPositionsChange={onPositionsChange}
          canvasTheme={canvasTheme}
        />
      </ReactFlowProvider>
    </div>
  )
}
