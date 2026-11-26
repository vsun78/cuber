import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box, History, Keyboard, Link2, MousePointer2, Pause, Play, RotateCcw, Shuffle, SkipForward, SlidersHorizontal, Undo2, X,
} from 'lucide-react'
import CubeView from './CubeView.jsx'
import { expandCornerTwist, makeCornerTwist, readCornerTwist } from './corner-twist.js'
import { FACES, findPieceRoute, getCorners, inverseMove, isSolved, makeCube, pieceKind, TURN_DURATION, turnCube } from './cube.js'
import { applyLinkedTurn, findLinkedTurn, getLinkedHomeSlot, LINKED_TURNS, scrambleLinkedCore, slotName, solveLinkedCore } from './linked-core.js'

const faceEntries = Object.entries(FACES)
const modeDuration = 640

function freshSession() {
  return { pieces: makeCube(), moves: [], turn: null }
}

function applyMove(session, move, core, undo = false) {
  const specialTurn = Object.hasOwn(LINKED_TURNS, move) || readCornerTwist(move)
  return {
    pieces: specialTurn ? applyLinkedTurn(session.pieces, move) : turnCube(session.pieces, move),
    moves: undo ? session.moves.slice(0, -1) : [...session.moves, move],
    turn: { move, core, before: specialTurn ? session.pieces : null, id: (session.turn?.id ?? 0) + 1 },
  }
}

function undoMove(move) {
  const twist = readCornerTwist(move)
  if (twist) return makeCornerTwist(twist.first, twist.second, -twist.direction)
  return Object.hasOwn(LINKED_TURNS, move) ? move : inverseMove(move)
}

function newLinkedSession() {
  const moves = scrambleLinkedCore()
  return { pieces: moves.reduce(applyLinkedTurn, makeCube()), moves, turn: null }
}

function Notation({ move }) {
  const twist = readCornerTwist(move)
  if (twist) return `${slotName(twist.first)} ${twist.direction === 1 ? '↻' : '↺'}`
  return move.replace("'", '′')
}

function requestCoreSolution(pieces, signal) {
  const worker = new Worker(new URL('./core-solver.worker.js', import.meta.url), { type: 'module' })
  return new Promise((resolve, reject) => {
    function finish(callback, result) {
      worker.terminate()
      signal.removeEventListener('abort', abort)
      callback(result)
    }
    function abort() {
      finish(reject, signal.reason)
    }

    signal.addEventListener('abort', abort, { once: true })
    worker.onmessage = ({ data }) => data.error ? finish(reject, new Error(data.error)) : finish(resolve, data)
    worker.onerror = () => finish(reject, new Error('Cuber could not start the core solver.'))
    worker.postMessage(pieces)
  })
}

function Shortcuts({ dialog }) {
  return (
    <dialog ref={dialog} className="shortcuts" aria-labelledby="shortcuts-title">
      <div className="dialog-heading">
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <form method="dialog">
          <button className="icon-button" type="submit" aria-label="Close shortcuts"><X size={20} /></button>
        </form>
      </div>
      <dl>
        <div><dt>Orbit the view left / right</dt><dd><kbd>Q</kbd><kbd>E</kbd></dd></div>
        <div><dt>Turn a face clockwise</dt><dd>{faceEntries.map(([face]) => <kbd key={face}>{face}</kbd>)}</dd></div>
        <div><dt>Turn a face counterclockwise</dt><dd><kbd>Shift</kbd> + a face key</dd></div>
        <div><dt>Swap a numbered pair in Linked Core</dt><dd><kbd>1</kbd>–<kbd>7</kbd></dd></div>
        <div><dt>Browse pieces in the viewport</dt><dd><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></dd></div>
        <div><dt>Select a piece or its destination</dt><dd><kbd>Enter</kbd> / <kbd>Space</kbd></dd></div>
        <div><dt>Clear the current selection</dt><dd><kbd>Esc</kbd></dd></div>
        <div><dt>Undo the last turn</dt><dd><kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Z</kbd></dd></div>
      </dl>
    </dialog>
  )
}

function LinkedControls({ cornersHome, locked, onTurn }) {
  return (
    <section className="turn-panel" aria-labelledby="linked-title">
      <h3 id="linked-title" className="linked-heading">Linked swaps <span>{cornersHome}/8 solved</span></h3>
      <p className="linked-hint">Each swap moves two corners and their paired edges.</p>
      <div className="linked-buttons">
        {Object.entries(LINKED_TURNS).map(([id, { corners, edges }]) => (
          <button key={id} type="button" className="button link-button" disabled={locked}
            aria-label={`Swap ${corners.join(' and ')} with edges ${edges.join(' and ')}`}
            aria-keyshortcuts={id} onClick={() => onTurn(id)}>
            <kbd>{id}</kbd><span>{corners.join(' ↔ ')}</span><small>{edges.join(' ↔ ')}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const [classicSession, setClassicSession] = useState(freshSession)
  const [linkedSession, setLinkedSession] = useState(null)
  const [linkedCore, setLinkedCore] = useState(true)
  const [classicCore, setClassicCore] = useState(false)
  const [linked, setLinked] = useState(false)
  const session = linked ? linkedSession : classicSession
  const setSession = linked ? setLinkedSession : setClassicSession
  const core = linked ? linkedCore : classicCore
  const viewSize = core ? 2 : 3
  const [pending, setPending] = useState('')
  const [playback, setPlayback] = useState(null)
  const [selected, setSelected] = useState(null)
  const [viewAngle, setViewAngle] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(null)
  const dialog = useRef(null)
  const corners = getCorners(session.pieces)
  const coreSolved = isSolved(corners)
  const cubeSolved = isSolved(session.pieces)
  const solved = core ? coreSolved : cubeSolved
  const solution = playback?.kind === 'solve' ? playback : null
  const solutionActive = Boolean(solution && solution.index < solution.moves.length)
  const moving = playback?.kind === 'piece'
  const turnsDisabled = Boolean(pending || solutionActive || moving || transitioning)
  const restingStatus = linked ? (cubeSolved ? 'Both solved' : 'Linked unsolved')
    : core ? (coreSolved ? 'Core solved' : 'Core unsolved')
    : cubeSolved ? 'Solved' : coreSolved ? 'Corners solved' : 'Unsolved'
  const status = moving ? 'Moving piece' : solutionActive ? (solution.playing ? 'Solving' : 'Paused') : restingStatus
  const selectedPiece = selected === null ? null : session.pieces[selected]
  const twistPartner = selectedPiece && pieceKind(selectedPiece) === 'corner' ? selectedPiece.position.map((axis) => -axis) : null
  const cornersHome = linked ? corners.filter((piece) => isSolved([piece])).length : 0
  const edgesToSolve = !cubeSolved && coreSolved ? session.pieces
    .filter((piece) => pieceKind(piece) === 'edge' && !isSolved([piece])).length : 0

  const orbitView = useCallback((direction) => setViewAngle((angle) => angle + direction * 45), [])

  const manualTurn = useCallback((move) => {
    if (turnsDisabled || request.current || (!readCornerTwist(move) && linked !== Object.hasOwn(LINKED_TURNS, move))) return
    setPlayback(null)
    setError('')
    setSession((current) => applyMove(current, move, core))
  }, [core, linked, setSession, turnsDisabled])

  const undo = useCallback(() => {
    if (turnsDisabled || request.current || !session.moves.length) return
    setPlayback(null)
    setError('')
    setSession((current) => {
      const lastMove = current.moves.at(-1)
      return lastMove ? applyMove(current, undoMove(lastMove), core, true) : current
    })
  }, [core, session.moves.length, setSession, turnsDisabled])

  useEffect(() => {
    function handleKey(event) {
      if (dialog.current?.open || event.altKey || event.repeat) return
      const key = event.key.toUpperCase()
      if (key === 'ESCAPE' && !turnsDisabled) setSelected(null)
      if (event.ctrlKey || event.metaKey) {
        if (key === 'Z' && !event.shiftKey && !turnsDisabled) {
          event.preventDefault()
          undo()
        }
        return
      }
      if (key === 'Q' || key === 'E') {
        event.preventDefault()
        orbitView(key === 'Q' ? -1 : 1)
      } else if (linked && Object.hasOwn(LINKED_TURNS, key)) {
        event.preventDefault()
        manualTurn(key)
      } else if (!linked && Object.hasOwn(FACES, key)) {
        event.preventDefault()
        manualTurn(`${key}${event.shiftKey ? "'" : ''}`)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [linked, manualTurn, orbitView, turnsDisabled, undo])

  const advancePlayback = useCallback(() => {
    const move = playback?.moves[playback.index]
    if (!move) return
    setSession((current) => applyMove(current, move, core))
    setPlayback({ ...playback, index: playback.index + 1 })
  }, [core, playback, setSession])

  useEffect(() => {
    if ((!solutionActive && !moving) || !playback.playing) return
    const delay = playback.index === 0 ? 80 : TURN_DURATION + 48
    const timer = window.setTimeout(() => {
      if (playback.index < playback.moves.length) {
        advancePlayback()
      } else {
        setSelected(null)
        setPlayback(null)
      }
    }, delay)
    return () => window.clearTimeout(timer)
  }, [advancePlayback, moving, playback, solutionActive])

  useEffect(() => {
    if (!transitioning) return
    const timer = window.setTimeout(() => setTransitioning(false), modeDuration)
    return () => window.clearTimeout(timer)
  }, [transitioning])

  function toggleCore() {
    if (turnsDisabled || request.current) return
    setSelected(null)
    setPlayback(null)
    if (linked) setLinkedCore(!core)
    else setClassicCore(!core)
    setTransitioning(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }

  function selectPuzzle(isLinked) {
    if (turnsDisabled || request.current || linked === isLinked) return
    if (isLinked && !linkedSession) setLinkedSession(newLinkedSession())
    setLinked(isLinked)
    setSelected(null)
    setPlayback(null)
    setError('')
  }

  function pickPiece(index) {
    if (turnsDisabled || request.current) return
    const target = session.pieces[index]
    if (index === selected) {
      setSelected(null)
    } else if (!selectedPiece || pieceKind(selectedPiece) !== pieceKind(target)) {
      setSelected(index)
    } else if (linked) {
      const move = findLinkedTurn(selectedPiece.position, target.position)
      if (move) {
        manualTurn(move)
        setSelected(null)
      } else {
        setSelected(index)
      }
    } else {
      const moves = findPieceRoute(selectedPiece.position, target.position)
      if (moves?.length) setPlayback({ kind: 'piece', moves, index: 0, playing: true })
    }
  }

  function reset() {
    request.current?.abort()
    request.current = null
    setSession(freshSession())
    setPlayback(null)
    setSelected(null)
    setTransitioning(false)
    setPending('')
    setError('')
  }

  async function runAction(action) {
    if (request.current) return
    if (linked) {
      setSelected(null)
      if (action === 'scramble') {
        setSession(newLinkedSession())
        setPlayback(null)
      } else {
        setPlayback({ kind: 'solve', moves: solveLinkedCore(session.pieces), index: 0, playing: true })
      }
      return
    }
    const controller = new AbortController()
    request.current = controller
    setPending(action)
    setError('')
    setSelected(null)
    const solvingCore = core && action === 'solve'

    try {
      let data
      if (solvingCore) {
        data = await requestCoreSolution(corners, controller.signal)
      } else {
        const response = await fetch('/api/cube.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action === 'solve' ? { action, moves: session.moves.flatMap(expandCornerTwist) } : { action }),
          signal: controller.signal,
        })
        data = await response.json()
        if (!response.ok) throw new Error(data.error)
      }
      if (request.current !== controller) return

      if (action === 'scramble') {
        const pieces = data.moves.reduce(turnCube, makeCube())
        setSession({ pieces, moves: data.moves, turn: null })
        setPlayback(null)
      } else {
        setPlayback({ kind: 'solve', moves: data.moves, index: 0, playing: true })
      }
    } catch {
      if (!controller.signal.aborted) setError(solvingCore ? 'Cuber could not find a core solution. Try again.'
        : 'The cube server could not complete the request. Try again.')
    } finally {
      if (request.current === controller) {
        request.current = null
        setPending('')
      }
    }
  }

  const moves = solution?.moves ?? session.moves
  const lastPage = Math.max(0, moves.length - 20)
  const start = solution ? Math.min(lastPage, Math.max(0, solution.index - 4)) : lastPage
  const visibleMoves = moves.slice(start, start + 20)

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand">
            <h1><Box size={17} strokeWidth={1.8} aria-hidden="true" />Cuber</h1>
            <span className="puzzle-size">{viewSize} × {viewSize} × {viewSize}</span>
          </div>
          <button className="button shortcuts-button" type="button" aria-label="Keyboard shortcuts"
            onClick={() => dialog.current.showModal()}>
            <Keyboard size={17} aria-hidden="true" /><span>Shortcuts</span>
          </button>
        </div>
      </header>

      <main className="page">
        <div className="simulator">
          <CubeView pieces={session.pieces} turn={session.turn} status={status} selected={selected}
            linked={linked} viewAngle={viewAngle} onOrbit={orbitView}
            core={core} transitioning={transitioning} modeDuration={modeDuration}
            edgesToSolve={edgesToSolve} onToggleCore={toggleCore} twistPartner={twistPartner}
            onTwist={(direction) => manualTurn(makeCornerTwist(selectedPiece.position, twistPartner, direction))}
            locked={turnsDisabled} moving={moving} onPick={pickPiece} onClear={() => setSelected(null)} />

          <aside className="control-rail" aria-label="Simulator controls">
            <div className="dock-heading"><h2 id="actions-title"><SlidersHorizontal size={16} aria-hidden="true" /> Controls</h2></div>
            <section className="actions" aria-labelledby="actions-title">
              <div className="puzzle-picker" role="group" aria-label="Puzzle type">
                <button className="button" type="button" aria-pressed={!linked} disabled={turnsDisabled}
                  onClick={() => selectPuzzle(false)}>Classic</button>
                <button className="button" type="button" aria-pressed={linked} disabled={turnsDisabled}
                  onClick={() => selectPuzzle(true)}><Link2 size={14} aria-hidden="true" /> Linked</button>
              </div>
              <div className="action-row">
                <button className="button" type="button" disabled={turnsDisabled}
                  onClick={() => runAction('scramble')}>
                  <Shuffle size={17} aria-hidden="true" />{pending === 'scramble' ? 'Scrambling…' : 'Scramble'}
                </button>
                {solutionActive ? (
                  <button className="button primary" type="button"
                    onClick={() => setPlayback({ ...solution, playing: !solution.playing })}>
                    {solution.playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
                    {solution.playing ? 'Pause' : 'Resume'}
                  </button>
                ) : (
                  <button className="button primary" type="button" disabled={turnsDisabled || solved}
                    onClick={() => runAction('solve')}>
                    <Play size={16} aria-hidden="true" />{pending === 'solve' ? 'Preparing…' : linked ? 'Solve both' : core ? 'Solve core' : 'Solve'}
                  </button>
                )}
              </div>
              <div className="sub-actions">
                <button className="text-button" type="button" disabled={turnsDisabled || !session.moves.length} onClick={undo}>
                  <Undo2 size={16} aria-hidden="true" />Undo
                </button>
                <button className="text-button" type="button" onClick={reset}>
                  <RotateCcw size={15} aria-hidden="true" />Reset cube
                </button>
                {solutionActive && !solution.playing && (
                  <button className="text-button step-button" type="button" onClick={advancePlayback}>
                    <SkipForward size={15} aria-hidden="true" />Step
                  </button>
                )}
              </div>
              {error && <p className="error" role="alert">{error}</p>}
            </section>

            {linked ? <LinkedControls cornersHome={cornersHome} locked={turnsDisabled} onTurn={manualTurn} /> : <section className="turn-panel" aria-labelledby="turns-title">
              <h3 id="turns-title">Face turns</h3>
              <table className="turn-table">
                <thead><tr>
                  <th scope="col">Face</th>
                  <th scope="col">Clockwise</th>
                  <th scope="col">Inverse</th>
                </tr></thead>
                <tbody>
                  {faceEntries.map(([letter, face]) => (
                    <tr key={letter}>
                      <th scope="row"><span className="face-label"><span className="face-swatch" style={{ '--face-color': face.color }} />{face.name}</span></th>
                      {[letter, inverseMove(letter)].map((move) => (
                        <td key={move}>
                          <button className="turn-button" type="button" disabled={turnsDisabled}
                            aria-label={`Turn ${face.name.toLowerCase()} ${move === letter ? 'clockwise' : 'counterclockwise'}`}
                            onClick={(event) => manualTurn(event.shiftKey ? inverseMove(letter) : move)}><Notation move={move} /></button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="turn-hint"><kbd>Shift</kbd> + face key to turn in reverse</p>
            </section>}

            <section className="selection-panel" aria-labelledby="selection-title">
              <h3 id="selection-title"><MousePointer2 size={14} aria-hidden="true" /> Selected piece</h3>
              {selectedPiece ? (
                <>
                  <p className="selected-kind">{pieceKind(selectedPiece)}</p>
                  {linked && <p className="linked-slot">Slot <code>{slotName(selectedPiece.position)}</code> · Home <code>{getLinkedHomeSlot(selectedPiece)}</code></p>}
                  <ul className="selected-colors" aria-label="Sticker colors">
                    {Object.values(selectedPiece.stickers).map((face) => (
                      <li key={face}><span className="face-swatch" style={{ '--face-color': FACES[face].color }} />{FACES[face].colorName}</li>
                    ))}
                  </ul>
                </>
              ) : <p className="selection-empty">No piece selected.</p>}
            </section>
          </aside>

          <section className="history-panel" aria-labelledby="history-title">
            <div className="dock-heading">
              <h2 id="history-title"><History size={16} aria-hidden="true" />{solution ? (linked ? 'Linked solution' : core ? 'Core solution' : 'Solution') : 'Move history'}</h2>
              <span className="move-count">{solution ? `${solution.index} / ${moves.length}` : `${moves.length} ${moves.length === 1 ? 'move' : 'moves'}`}</span>
            </div>
            <div className="sequence">
              {solution && <progress aria-label="Solution progress" value={solution.index} max={moves.length} />}
              {visibleMoves.length ? (
                <ol className="move-list" aria-label={solution ? 'Solution sequence' : 'Latest turns'} start={start + 1}>
                  {visibleMoves.map((move, index) => {
                    const step = start + index
                    return <li key={step} className={solution && step < solution.index ? 'played' : ''}
                      aria-current={step === solution?.index ? 'step' : undefined}><Notation move={move} /></li>
                  })}
                </ol>
              ) : (
                <p className="history-empty">No moves recorded.</p>
              )}
            </div>
          </section>
        </div>
      </main>
      <Shortcuts dialog={dialog} />
    </>
  )
}
