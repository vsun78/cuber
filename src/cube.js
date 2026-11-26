export const FACES = {
  U: { name: 'Up', axis: 1, layer: 1, color: '#e7e8e7', colorName: 'White', spin: 'rotateX(90deg)' },
  R: { name: 'Right', axis: 0, layer: 1, color: '#e14b49', colorName: 'Red', spin: 'rotateY(90deg)' },
  F: { name: 'Front', axis: 2, layer: 1, color: '#55b568', colorName: 'Green', spin: 'rotateY(0deg)' },
  D: { name: 'Down', axis: 1, layer: -1, color: '#e6bf3f', colorName: 'Yellow', spin: 'rotateX(-90deg)' },
  L: { name: 'Left', axis: 0, layer: -1, color: '#eb963d', colorName: 'Orange', spin: 'rotateY(-90deg)' },
  B: { name: 'Back', axis: 2, layer: -1, color: '#498cd8', colorName: 'Blue', spin: 'rotateY(180deg)' },
}

export const TURN_DURATION = 340

const faceEntries = Object.entries(FACES)

export function makeCube() {
  const pieces = []
  const layers = [-1, 0, 1]
  for (const x of layers) {
    for (const y of layers) {
      for (const z of layers) {
        const position = [x, y, z]
        if (!position.some((value) => Math.abs(value) === 1)) continue
        const stickers = Object.fromEntries(
          faceEntries.filter(([, face]) => position[face.axis] === face.layer)
            .map(([letter]) => [letter, letter]),
        )
        pieces.push({ position, stickers })
      }
    }
  }
  return pieces
}

export function describeTurn(move) {
  const { axis, layer } = FACES[move[0]]
  const amount = move[1] === '2' ? 2 : move[1] === "'" ? -1 : 1
  return { axis, layer, quarters: -layer * amount }
}

function rotate([x, y, z], axis, quarters) {
  const direction = Math.sign(quarters)
  for (let step = 0; step < Math.abs(quarters); step += 1) {
    if (axis === 0) [y, z] = [-direction * z, direction * y]
    if (axis === 1) [x, z] = [direction * z, -direction * x]
    if (axis === 2) [x, y] = [-direction * y, direction * x]
  }
  return [x || 0, y || 0, z || 0]
}

export function turnCube(pieces, move) {
  const { axis, layer, quarters } = describeTurn(move)
  const rotatedFaces = Object.fromEntries(faceEntries.map(([letter, face]) => {
    const normal = [0, 0, 0]
    normal[face.axis] = face.layer
    const rotated = rotate(normal, axis, quarters)
    const [destination] = faceEntries.find(([, side]) => rotated[side.axis] === side.layer)
    return [letter, destination]
  }))

  return pieces.map((piece) => {
    if (piece.position[axis] !== layer) return piece
    return {
      position: rotate(piece.position, axis, quarters),
      stickers: Object.fromEntries(Object.entries(piece.stickers)
        .map(([face, color]) => [rotatedFaces[face], color])),
    }
  })
}

export function isSolved(pieces) {
  return pieces.every(({ stickers }) => Object.entries(stickers)
    .every(([face, color]) => face === color))
}

export function inverseMove(move) {
  if (move.endsWith('2')) return move
  return move.endsWith("'") ? move[0] : `${move}'`
}

export function pieceKind(piece) {
  return ['center', 'edge', 'corner'][Object.keys(piece.stickers).length - 1]
}

const layerTurns = faceEntries.flatMap(([face]) => [face, inverseMove(face), `${face}2`])
  .map((move) => ({ move, ...describeTurn(move) }))

export function findPieceRoute(from, to) {
  const destination = to.join(',')
  const visited = new Set([from.join(',')])
  const route = [{ position: from, moves: [] }]

  // Search only the selected piece's positions. Each step is a legal turn of the whole cube.
  for (const { position, moves } of route) {
    if (position.join(',') === destination) return moves
    for (const { move, axis, layer, quarters } of layerTurns) {
      if (position[axis] !== layer) continue
      const next = rotate(position, axis, quarters)
      const key = next.join(',')
      if (visited.has(key)) continue
      visited.add(key)
      route.push({ position: next, moves: [...moves, move] })
    }
  }

  return null
}
