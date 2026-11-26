import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getCorners, isSolved, makeCube, turnCube } from '../src/cube.js'
import { solveCore } from '../src/core-solver.js'
import { expandCornerTwist, makeCornerTwist } from '../src/corner-twist.js'

const endpoint = process.env.CUBER_API_URL ?? 'http://127.0.0.1:8000/api/cube.php'

function post(body) {
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  })
}

test('PHP generates a 20-move scramble and solves the same state in JavaScript', async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scramble = await post({ action: 'scramble' })
    assert.equal(scramble.status, 200)
    const { moves } = await scramble.json()
    assert.equal(moves.length, 20)
    moves.forEach((move, index) => {
      assert.match(move, /^[URFDLB](?:2|')?$/)
      assert.notEqual(move[0], moves[index - 1]?.[0])
    })

    const history = [...moves, 'U', 'U', 'F', "F'", 'R2']
    const solution = await post({ action: 'solve', moves: history })
    assert.equal(solution.status, 200)
    const result = await solution.json()
    assert.ok(result.moves.length < history.length)
    assert.equal(isSolved([...history, ...result.moves].reduce(turnCube, makeCube())), true)
  }
})

test('PHP combines adjacent turns and discards turns that cancel', async () => {
  const response = await post({ action: 'solve', moves: ['R', 'U', "U'", 'R', 'F2', "D'"] })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { moves: ['D', 'F2', 'R2'] })
})

test('the PHP solver finishes the 3×3 after a corner-only solution', async () => {
  const scramble = ['D2', "R'", 'B', 'F2', 'L', 'U', 'B2', 'R2', "F'", 'U2', "D'", 'L2']
  const cube = scramble.reduce(turnCube, makeCube())
  const coreMoves = solveCore(getCorners(cube))
  const reassembled = coreMoves.reduce(turnCube, cube)
  assert.equal(isSolved(getCorners(reassembled)), true)
  assert.equal(isSolved(reassembled), false)

  const response = await post({ action: 'solve', moves: [...scramble, ...coreMoves] })
  assert.equal(response.status, 200)
  const { moves } = await response.json()
  assert.equal(isSolved(moves.reduce(turnCube, reassembled)), true)
})

test('PHP can solve a Classic move history that includes a corner twist', async () => {
  const twist = makeCornerTwist([1, 1, 1], [-1, -1, -1], 1)
  const history = ['R', 'F2', twist, "U'"].flatMap(expandCornerTwist)
  const cube = history.reduce(turnCube, makeCube())
  const response = await post({ action: 'solve', moves: history })
  assert.equal(response.status, 200)
  const { moves } = await response.json()
  assert.equal(isSolved(moves.reduce(turnCube, cube)), true)
})

test('PHP returns JSON errors for invalid move lists and rejects GET', async () => {
  for (const moves of [['Q'], ['R3'], [7], { 0: 'R' }]) {
    const response = await post({ action: 'solve', moves })
    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /move/i)
  }

  const invalidJson = await fetch(endpoint, { method: 'POST', body: '{', signal: AbortSignal.timeout(5000) })
  assert.equal(invalidJson.status, 400)
  const wrongMethod = await fetch(endpoint, { signal: AbortSignal.timeout(5000) })
  assert.equal(wrongMethod.status, 405)
  assert.equal(wrongMethod.headers.get('allow'), 'POST')
})
