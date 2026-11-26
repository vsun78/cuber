import { turnCube } from './cube.js'
import { expandCornerTwist } from './corner-twist.js'

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
