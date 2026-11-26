import { useState } from 'react'
import { Box, Boxes, MousePointer2, RotateCcw, RotateCw, Scan, X } from 'lucide-react'
import { describeTurn, FACES, makeCube, pieceKind, TURN_DURATION } from './cube.js'
import { readCornerTwist } from './corner-twist.js'
import { findLinkedTurn, getLinkedHomeSlot, getLinkedPartner, slotName } from './linked-core.js'

const faces = Object.entries(FACES)
const pitch = -30
const radians = Math.PI / 180
const tilt = [Math.sin(pitch * radians), Math.cos(pitch * radians)]
const toScene = ([x, y, z]) => [x, -y, z]
const shellSlots = makeCube().filter((piece) => pieceKind(piece) !== 'corner').map(({ position }) => position.join(','))

function getParkingSlot(index, yaw) {
  const half = shellSlots.length / 2
  const side = index < half ? -1 : 1
  const angle = (index % half / (half - 1) - 0.5) * 108 * radians
  const radius = index % 2 === 0 ? 2.96 : 2.72
  const x = side * Math.cos(angle) * radius
  const y = Math.sin(angle) * 2.45
  const [sinY, cosY] = [Math.sin(yaw * radians), Math.cos(yaw * radians)]
  const [sinX, cosX] = tilt
  const depth = -sinX * y
  return [cosY * x - sinY * depth, cosX * y, sinY * x + cosY * depth]
}

function Piece({ piece, index, kind, selected, target, focused, locked, parking, linked, partner, swap, twist, onPick }) {
  const [x, y, z] = toScene(piece.position)
  const parked = Boolean(parking)
  const movable = kind === 'corner' || (kind === 'edge' && !parked && !linked)
  const colors = Object.values(piece.stickers).map((face) => FACES[face].colorName)
  const location = linked && movable ? ` at ${slotName(piece.position)}, home ${getLinkedHomeSlot(piece)}` : ''
  const [parkX, parkY, parkZ] = parking ?? []

  return (
    <div className="piece" id={`cubie-${index}`} style={{
      '--x': x, '--y': y, '--z': z, '--park-x': parkX, '--park-y': parkY, '--park-z': parkZ,
      '--twist-from': twist ? `${-twist * 120}deg` : undefined, ...swap,
    }}
      role={movable ? 'option' : undefined} aria-hidden={!movable || undefined}
      aria-label={movable ? `${colors.join(', ')} ${kind}${location}` : undefined}
      aria-selected={movable ? selected : undefined}
      data-kind={kind} data-parked={parked || undefined}
      data-partner={partner || undefined} data-swapping={Boolean(swap) || undefined} data-twisting={Boolean(twist) || undefined}
      data-picked={selected || undefined} data-target={target || undefined} data-focused={focused || undefined}
      data-pickable={movable && !locked || undefined} onClick={movable && !locked ? () => onPick(index) : undefined}>
      <div className="piece-body">
        {faces.map(([letter, face]) => (
          <div className="piece-face" key={letter} style={{ '--spin': face.spin }} aria-hidden="true">
            {piece.stickers[letter] && <span className="sticker" style={{ '--sticker': FACES[piece.stickers[letter]].color }} />}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CubeView({
  pieces, turn, status, selected, core, linked, viewAngle, transitioning, modeDuration, edgesToSolve,
  locked, moving, twistPartner, onTwist, onPick, onClear, onToggleCore, onOrbit,
}) {
  const [focused, setFocused] = useState(null)
  const activePiece = selected === null ? null : pieces[selected]
  const activeKind = activePiece && pieceKind(activePiece)
  const linkedPartner = linked && activePiece ? getLinkedPartner(activePiece.position) : null
  const yaw = -35 + viewAngle
  const parkedSlots = core ? shellSlots.map((_, index) => getParkingSlot(index, yaw)) : []

  function canTarget(piece) {
    if (!activePiece || pieceKind(piece) !== activeKind) return false
    return !linked || Boolean(findLinkedTurn(activePiece.position, piece.position))
  }

  const options = pieces.flatMap((piece, index) => {
    const kind = pieceKind(piece)
    const available = kind === 'corner' || (!core && !linked && kind === 'edge')
    return available && (!activePiece || index === selected || canTarget(piece)) ? [index] : []
  })
  const focusIndex = options.includes(focused) ? focused : options.at(-1)
  const turnDetails = turn && !turn.before ? describeTurn(turn.move) : null
  const twistDetails = readCornerTwist(turn?.move)
  const stationary = []
  const twisting = []

  function pick(index) {
    setFocused(index)
    onPick(index)
  }

  function navigate(event) {
    if (locked) return

    const current = options.indexOf(focusIndex)
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        setFocused(options[(current - 1 + options.length) % options.length])
        break
      case 'ArrowRight':
      case 'ArrowDown':
        setFocused(options[(current + 1) % options.length])
        break
      case 'Enter':
      case ' ':
        pick(focusIndex)
        break
      case 'Escape':
        onClear()
        break
      default:
        return
    }
    event.preventDefault()
  }

  pieces.forEach((piece, index) => {
    const kind = pieceKind(piece)
    const slot = slotName(piece.position)
    const positionKey = piece.position.join(',')
    const parking = parkedSlots[shellSlots.indexOf(positionKey)]
    const previous = turn?.before?.[index]?.position
    const origin = previous?.join(',')
    let swap
    if (origin && origin !== positionKey) {
      const initial = parking ? parkedSlots[shellSlots.indexOf(origin)] : toScene(previous)
      const final = parking ?? toScene(piece.position)
      swap = { '--swap-x': initial[0] - final[0], '--swap-y': initial[1] - final[1],
        '--swap-z': initial[2] - final[2], '--swap-arc': origin < positionKey ? 1 : -1 }
    }
    const twist = twistDetails && (positionKey === twistDetails.first.join(',') ? twistDetails.direction
      : positionKey === twistDetails.second.join(',') ? -twistDetails.direction : 0)
    const picked = index === selected
    const target = !picked && !locked && canTarget(piece)
    const element = <Piece key={swap || twist ? `${turn.id}-${index}` : index} piece={piece} index={index} kind={kind} onPick={pick}
      selected={picked} target={target} focused={index === focusIndex && !locked} locked={locked}
      parking={parking} linked={linked} partner={linkedPartner === slot} swap={swap} twist={twist} />
    const inLayer = turnDetails && (!turn.core || kind === 'corner') && piece.position[turnDetails.axis] === turnDetails.layer
    if (inLayer) twisting.push(element)
    else stationary.push(element)
  })

  let motionStyle
  if (turnDetails) {
    const { axis, layer, quarters } = turnDetails
    const spin = `rotate${'XYZ'[axis]}`
    const start = quarters * (axis === 1 ? -90 : 90)
    motionStyle = {
      '--start': `${spin}(${start}deg)`,
      '--mid': `${spin}(${start * 0.46}deg)`,
      '--end': `${spin}(0deg)`,
      '--lift-x': axis === 0 ? layer : 0,
      '--lift-y': axis === 1 ? -layer : 0,
      '--lift-z': axis === 2 ? layer : 0,
    }
  }

  const restingHint = linked ? (status === 'Both solved' ? 'The corners and edges are solved together.' : 'Select a corner or press 1–7 to swap a linked pair.')
    : core
    ? (edgesToSolve ? 'Reassemble to finish the edges.' : 'Select a corner or turn a face.')
    : (edgesToSolve ? `${edgesToSolve} ${edgesToSolve === 1 ? 'edge' : 'edges'} left to solve.` : 'Select an edge or corner to move it')
  const instruction = transitioning ? (core ? 'Revealing the corner core' : 'Reassembling the cube')
    : moving ? 'Moving selected piece' : locked ? 'Piece selection is unavailable' : activeKind
    ? (linked ? 'Pick a highlighted neighbor. Its paired edge will follow.' : `Pick a highlighted ${activeKind} as the destination`)
    : restingHint
  const ViewIcon = core ? Box : Boxes

  return (
    <section className="workspace" aria-label="Cube workspace"
      style={{ '--turn-duration': `${TURN_DURATION}ms`, '--mode-duration': `${modeDuration}ms` }}>
      <div className="dock-heading viewport-heading">
        <h2><Scan size={15} aria-hidden="true" /> {linked ? 'Linked Core' : core ? 'Core Mode' : 'Exploded view'}</h2>
        <div className="viewport-controls">
          <div className="cube-status" data-status={status} role="status"><span />{status}</div>
          <button className="button mode-button" type="button" disabled={locked} onClick={onToggleCore}>
            <ViewIcon size={15} aria-hidden="true" /> {core ? 'Reassemble' : 'Explode'}
          </button>
        </div>
      </div>

      <div className="cube-stage" tabIndex={0} role="listbox" aria-label={core ? '2 by 2 core corners' : 'Exploded cube pieces'}
        aria-describedby="piece-instructions" aria-activedescendant={`cubie-${focusIndex}`}
        aria-disabled={locked || undefined} data-view-size={core ? 2 : 3} data-core={core || undefined}
        data-transitioning={transitioning || undefined} onKeyDown={navigate}>
        <div className="cube-scene">
          <div className="cube-camera" style={{ transform: `rotateX(${pitch}deg) rotateY(${yaw}deg)`,
            '--tile-scale': core ? 1.16 : 1, '--grid-span': core ? 0.61 : 1.62 }}>
            {stationary}
            {turnDetails && <div className="turn-layer" key={turn.id} style={motionStyle}>{twisting}</div>}
          </div>
        </div>
      </div>

      <div className="viewport-bottom">
        <p id="piece-instructions" aria-live="polite"><MousePointer2 size={14} aria-hidden="true" />{instruction}</p>
        <div className="view-actions">
          {selected !== null && !locked && (
            <button className="text-button" type="button" onClick={onClear}><X size={14} aria-hidden="true" /> Clear selection</button>
          )}
          <div className="orbit-controls" role="group" aria-label="Orbit view">
            <button className="text-button orbit-button" type="button" aria-label="Orbit left" aria-keyshortcuts="Q" onClick={() => onOrbit(-1)}>
              <RotateCcw size={14} aria-hidden="true" /><kbd>Q</kbd>
            </button>
            <button className="text-button orbit-button" type="button" aria-label="Orbit right" aria-keyshortcuts="E" onClick={() => onOrbit(1)}>
              <RotateCw size={14} aria-hidden="true" /><kbd>E</kbd>
            </button>
          </div>
        </div>
      </div>
      {twistPartner && (
        <div className="corner-actions" role="group" aria-label="Twist selected corner">
          <span>Opposite twist at <code>{slotName(twistPartner)}</code></span>
          <button className="button" type="button" aria-label="Twist selected corner clockwise" disabled={locked} onClick={() => onTwist(1)}>
            <RotateCw size={14} aria-hidden="true" /> Clockwise
          </button>
          <button className="button" type="button" aria-label="Twist selected corner counterclockwise" disabled={locked} onClick={() => onTwist(-1)}>
            <RotateCcw size={14} aria-hidden="true" /> Counterclockwise
          </button>
        </div>
      )}
    </section>
  )
}
