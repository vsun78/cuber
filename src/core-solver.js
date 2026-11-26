import { cornerOrientation, FACES, getCorners, makeCube, turnCube } from './cube.js'

const faces = Object.keys(FACES)
const suffixes = ['', '2', "'"]
const solvedCorners = getCorners(makeCube())
const cornerCount = solvedCorners.length
const factorials = [1, 1, 2, 6, 24, 120, 720, 5040, 40320]
const cornerSlots = new Map(solvedCorners.map(({ position }, index) => [position.join(','), index]))
const stickerKey = (stickers) => Object.values(stickers).sort().join('')
const cornerIds = new Map(solvedCorners.map(({ stickers }, index) => [stickerKey(stickers), index]))

function readCorners(corners) {
  const permutation = new Array(cornerCount)
  const twists = new Array(cornerCount)
  for (const { position, stickers } of corners) {
    const slot = cornerSlots.get(position.join(','))
    permutation[slot] = cornerIds.get(stickerKey(stickers))
    twists[slot] = cornerOrientation({ position, stickers })
  }
  return { permutation, twists }
}

function rankPermutation(permutation) {
  let rank = 0
  for (let i = 0; i < cornerCount; i += 1) {
    let smaller = 0
    for (let j = i + 1; j < cornerCount; j += 1) {
      if (permutation[j] < permutation[i]) smaller += 1
    }
    rank += smaller * factorials[cornerCount - i - 1]
  }
  return rank
}

function unrankPermutation(rank) {
  const remaining = solvedCorners.map((_, index) => index)
  return solvedCorners.map((_, index) => {
    const weight = factorials[cornerCount - index - 1]
    const [corner] = remaining.splice(Math.floor(rank / weight), 1)
    rank %= weight
    return corner
  })
}

function rankTwists(twists) {
  let rank = 0
  for (let i = 0; i < cornerCount - 1; i += 1) rank = rank * 3 + twists[i]
  return rank
}

function unrankTwists(rank) {
  const twists = new Array(cornerCount)
  let sum = 0
  for (let i = cornerCount - 2; i >= 0; i -= 1) {
    twists[i] = rank % 3
    sum += twists[i]
    rank = Math.floor(rank / 3)
  }
  twists[cornerCount - 1] = (3 - sum % 3) % 3
  return twists
}

const turns = faces.map((face) => readCorners(turnCube(solvedCorners, face)))

function buildTable(size, rank, unrank, apply) {
  const quarterTurns = new Uint16Array(size * faces.length)
  for (let state = 0; state < size; state += 1) {
    const decoded = unrank(state)
    for (const [face, turn] of turns.entries()) {
      quarterTurns[state * faces.length + face] = rank(apply(decoded, turn))
    }
  }

  const distance = new Uint8Array(size).fill(255)
  const queue = new Uint16Array(size)
  distance[0] = 0
  let sizeOfQueue = 1
  for (let i = 0; i < sizeOfQueue; i += 1) {
    const state = queue[i]
    for (let face = 0; face < faces.length; face += 1) {
      let next = state
      for (let amount = 0; amount < suffixes.length; amount += 1) {
        next = quarterTurns[next * faces.length + face]
        if (distance[next] !== 255) continue
        distance[next] = distance[state] + 1
        queue[sizeOfQueue] = next
        sizeOfQueue += 1
      }
    }
  }
  return { quarterTurns, distance }
}

let permutationTable
let twistTable

export function solveCore(pieces) {
  const { permutation, twists } = readCorners(getCorners(pieces))
  const startPermutation = rankPermutation(permutation)
  const startTwists = rankTwists(twists)
  if (startPermutation === 0 && startTwists === 0) return []

  permutationTable ??= buildTable(factorials[cornerCount], rankPermutation, unrankPermutation,
    (state, turn) => turn.permutation.map((from) => state[from]))
  twistTable ??= buildTable(3 ** (cornerCount - 1), rankTwists, unrankTwists,
    (state, turn) => turn.permutation.map((from, to) => (state[from] + turn.twists[to]) % 3))

  const path = []
  // Both pattern distances are lower bounds on the number of turns left.
  function search(permutation, twists, remaining, previous) {
    if (permutation === 0 && twists === 0) return true
    if (Math.max(permutationTable.distance[permutation], twistTable.distance[twists]) > remaining) return false

    for (let face = 0; face < faces.length; face += 1) {
      if (face === previous || (face < previous && FACES[faces[face]].axis === FACES[faces[previous]].axis)) continue
      let nextPermutation = permutation
      let nextTwists = twists
      for (const suffix of suffixes) {
        nextPermutation = permutationTable.quarterTurns[nextPermutation * faces.length + face]
        nextTwists = twistTable.quarterTurns[nextTwists * faces.length + face]
        path.push(faces[face] + suffix)
        if (search(nextPermutation, nextTwists, remaining - 1, face)) return true
        path.pop()
      }
    }
    return false
  }

  const lowerBound = Math.max(permutationTable.distance[startPermutation], twistTable.distance[startTwists])
  for (let depth = lowerBound; depth <= 16; depth += 1) {
    if (search(startPermutation, startTwists, depth, -1)) return path
  }
  throw new Error('Could not solve the corners.')
}
