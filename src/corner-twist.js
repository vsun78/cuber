import { FACES, inverseMove, turnCube } from './cube.js'

const invert = (moves) => [...moves].reverse().map(inverseMove)
const cornerTurns = Object.keys(FACES).flatMap((face) => [face, `${face}2`, inverseMove(face)])
const twistSetup = "R' D' R D R' D' R D".split(' ')
const anchorTwist = [...twistSetup, 'U', ...invert(twistSetup), "U'"]
const setupPaths = new Map()

function pairKey(first, second) {
  return `${first.join(',')}/${second.join(',')}`
}

function findSetups() {
  const anchors = [{ position: [1, 1, -1], stickers: {} }, { position: [1, 1, 1], stickers: {} }]
  const queue = [{ pieces: anchors, moves: [] }]
  setupPaths.set(pairKey(anchors[0].position, anchors[1].position), [])

  for (const { pieces, moves } of queue) {
    for (const move of cornerTurns) {
      const turned = turnCube(pieces, move)
      const key = pairKey(turned[0].position, turned[1].position)
      if (setupPaths.has(key)) continue
      const next = [...moves, move]
      setupPaths.set(key, next)
      queue.push({ pieces: turned, moves: next })
    }
  }
}

export function makeCornerTwist(first, second, direction) {
  return `T:${pairKey(first, second)}:${direction}`
}

export function readCornerTwist(move) {
  if (!move?.startsWith('T:')) return null
  const [, pair, direction] = move.split(':')
  const [first, second] = pair.split('/').map((position) => position.split(',').map(Number))
  return { first, second, direction: Number(direction) }
}

export function expandCornerTwist(move) {
  const twist = readCornerTwist(move)
  if (!twist) return [move]
  if (setupPaths.size === 0) findSetups()
  const setup = setupPaths.get(pairKey(twist.first, twist.second))
  const sequence = twist.direction === 1 ? anchorTwist : invert(anchorTwist)
  return [...invert(setup), ...sequence, ...setup]
}
