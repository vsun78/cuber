import { cornerOrientation, getCorners, turnCube } from './cube.js'
import { expandCornerTwist, makeCornerTwist } from './corner-twist.js'

const cornerSlots = ['UFL', 'UFR', 'UBR', 'UBL', 'DBL', 'DBR', 'DFR', 'DFL']
const edgeSlots = ['UL', 'UF', 'UR', 'UB', 'DL', 'DB', 'DR', 'DF']
// Each sequence swaps the same two links without twisting any corner or flipping any edge.
const sequences = [
  "F U F' L' F U F' U' F' L F2 U' F' U'",
  "R U R' F' R U R' U' R' F R2 U' R' U'",
  "B U B' R' B U B' U' B' R B2 U' B' U'",
  "U D F2 R U R' F' R U R' U' R' F R2 U' R' U' F2 D' U'",
  "B D B' L' B D B' D' B' L B2 D' B' D'",
  "R D R' B' R D R' D' R' B R2 D' R' D'",
  "F D F' R' F D F' D' F' R F2 D' F' D'",
]

export const LINKED_TURNS = Object.fromEntries(sequences.map((sequence, index) => [String(index + 1), {
  corners: cornerSlots.slice(index, index + 2),
  edges: edgeSlots.slice(index, index + 2),
  moves: sequence.split(' '),
}]))

export function slotName([x, y, z]) {
  const vertical = y === 1 ? 'U' : y === -1 ? 'D' : ''
  const depth = z === 1 ? 'F' : z === -1 ? 'B' : ''
  const lateral = x === 1 ? 'R' : x === -1 ? 'L' : ''
  return vertical + depth + lateral
}

export function getLinkedPartner(position) {
  return edgeSlots[cornerSlots.indexOf(slotName(position))]
}

export function findLinkedTurn(from, to) {
  const index = cornerSlots.indexOf(slotName(from))
  const destination = cornerSlots.indexOf(slotName(to))
  return index >= 0 && destination >= 0 && Math.abs(index - destination) === 1 ? String(Math.max(index, destination)) : null
}

export function applyLinkedTurn(pieces, turn) {
  const moves = LINKED_TURNS[turn]?.moves ?? expandCornerTwist(turn)
  return moves.reduce(turnCube, pieces)
}

const stickerKey = (stickers) => [...stickers].sort().join('')
const cornerIds = new Map(cornerSlots.map((name, index) => [stickerKey(name), index]))

export function getLinkedHomeSlot(piece) {
  return cornerSlots[cornerIds.get(stickerKey(Object.values(piece.stickers)))]
}

function sortBySwapping(order) {
  const moves = []
  for (let target = 0; target < cornerSlots.length; target += 1) {
    let position = order.indexOf(target)
    while (position > target) {
      [order[position - 1], order[position]] = [order[position], order[position - 1]]
      moves.push(String(position))
      position -= 1
    }
  }
  return moves
}

export function solveLinkedCore(pieces) {
  const corners = getCorners(pieces)
  const order = []
  for (const { position, stickers } of corners) {
    const slot = cornerSlots.indexOf(slotName(position))
    if (slot >= 0) order[slot] = cornerIds.get(stickerKey(Object.values(stickers)))
  }
  const swaps = sortBySwapping(order)
  const placed = swaps.reduce(applyLinkedTurn, corners)
  const partner = placed.at(-1).position
  const twists = placed.slice(0, -1).flatMap((corner) => {
    const orientation = cornerOrientation(corner)
    return orientation ? [makeCornerTwist(corner.position, partner, orientation === 1 ? -1 : 1)] : []
  })
  return [...swaps, ...twists]
}

export function scrambleLinkedCore() {
  const order = cornerSlots.map((_, index) => index)
  for (let index = order.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    const corner = order[index]
    order[index] = order[target]
    order[target] = corner
  }

  const moves = sortBySwapping([...order])
  return (moves.length >= 8 ? moves : sortBySwapping(order.reverse())).reverse()
}
