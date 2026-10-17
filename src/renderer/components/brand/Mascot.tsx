import type { JSX } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export type MascotState = 'idle' | 'thinking' | 'replying' | 'working' | 'needs-you' | 'done' | 'asleep' | 'stuck'
export type MascotSize = 16 | 20 | 22 | 24 | 28 | 40 | 56

export const MASCOT_STATE_LABEL: Record<MascotState, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  replying: 'Replying',
  working: 'Working',
  'needs-you': 'Needs you',
  done: 'Done',
  asleep: 'Asleep',
  stuck: 'Stuck',
}

const BODY = 'M8 38 C 8 21, 19 11, 32 11 C 45 11, 56 21, 56 38 C 56 49, 47 54, 32 54 C 17 54, 8 49, 8 38 Z'
const FONT = '-apple-system, system-ui, sans-serif'

function Body() {
  return <path className="body" d={BODY} />
}

function Eye({ x, y, rx = 3, ry = 4.6 }: { x: number; y: number; rx?: number; ry?: number }) {
  return <ellipse className="eye" cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(-7 ${x} ${y})`} />
}

function Idle() {
  return (
    <>
      <Body />
      <g className="eyes">
        <Eye x={26} y={36} />
        <Eye x={39} y={35} />
      </g>
    </>
  )
}

function Thinking() {
  return (
    <>
      <g transform="translate(-1 5) scale(0.9)">
        <Body />
        <g className="eyes">
          <Eye x={27} y={33} />
          <Eye x={40} y={32} />
        </g>
      </g>
      <g className="dots">
        <circle className="accent" cx={50} cy={15} r={2.6} />
        <circle className="accent" cx={55} cy={8.5} r={3.3} opacity={0.7} />
        <circle className="accent" cx={59.5} cy={3} r={1.9} opacity={0.4} />
      </g>
    </>
  )
}

function Replying() {
  return (
    <>
      <g transform="translate(-2 6) scale(0.82)">
        <Body />
        <g className="eyes">
          <Eye x={26} y={36} />
          <Eye x={39} y={35} />
        </g>
      </g>
      <g className="dots">
        <circle className="body" cx={50} cy={42} r={2.6} />
        <circle className="body" cx={56} cy={42} r={2.6} opacity={0.6} />
        <circle className="body" cx={62} cy={42} r={2.6} opacity={0.3} />
      </g>
    </>
  )
}

function Working() {
  return (
    <>
      <circle className="ring-track" cx={32} cy={33} r={30} fill="none" strokeWidth={3} />
      <path className="ring" d="M32 3 A30 30 0 0 1 61 26" fill="none" strokeWidth={3} strokeLinecap="round" />
      <g transform="translate(7 8) scale(0.78)">
        <Body />
        <g className="eyes">
          <Eye x={31} y={36} />
          <Eye x={44} y={35} />
        </g>
      </g>
    </>
  )
}

function NeedsYou() {
  return (
    <>
      <Body />
      <g className="eyes">
        <Eye x={26} y={36} rx={3.8} ry={5.6} />
        <Eye x={39} y={35} rx={3.8} ry={5.6} />
      </g>
      <circle className="alert" cx={52} cy={14} r={6} strokeWidth={2.5} />
    </>
  )
}

function Done() {
  return (
    <>
      <Body />
      <path
        className="stroke-eye"
        d="M21 38.5 q5 -7 10 0 M34 37.5 q5 -7 10 0"
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </>
  )
}

function Asleep() {
  return (
    <>
      <g transform="translate(0 9) scale(1 0.82)">
        <Body />
      </g>
      <path
        className="stroke-eye"
        d="M21 41.5 l9 -1 M34 40.5 l9 -1"
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <text className="mark" x={50} y={16} fontSize={10} fontWeight={600} fontFamily={FONT}>
        z
      </text>
    </>
  )
}

function Stuck() {
  return (
    <>
      <Body />
      <g className="eyes">
        <Eye x={26} y={40} />
        <Eye x={39} y={39} />
      </g>
      <circle className="eye ink-stroke" cx={53} cy={13} r={7} strokeWidth={2} />
      <text className="body" x={53} y={17} fontSize={10} fontWeight={700} textAnchor="middle" fontFamily={FONT}>
        ?
      </text>
    </>
  )
}

const POSES: Record<MascotState, () => JSX.Element> = {
  idle: Idle,
  thinking: Thinking,
  replying: Replying,
  working: Working,
  'needs-you': NeedsYou,
  done: Done,
  asleep: Asleep,
  stuck: Stuck,
}

export function Mascot({ state, size, label }: { state: MascotState; size: MascotSize; label?: string }) {
  const reduced = useReducedMotion()
  const pose: MascotState = reduced ? 'idle' : state
  const Pose = POSES[pose]
  const svg = (
    <svg
      className="dg-mascot"
      role="img"
      aria-label={label ?? `Assistant, ${MASCOT_STATE_LABEL[state].toLowerCase()}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      data-state={state}
      data-pose={pose}
    >
      <Pose />
    </svg>
  )
  if (!reduced || state === 'idle') return svg
  return (
    <>
      {svg}
      <span className="dango-mascot__state" aria-hidden="true">
        {MASCOT_STATE_LABEL[state]}
      </span>
    </>
  )
}
