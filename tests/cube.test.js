import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cornerOrientation, FACES, findPieceRoute, getCorners, inverseMove, isSolved, makeCube, pieceKind, turnCube } from '../src/cube.js'
import { makeCornerTwist } from '../src/corner-twist.js'
import { solveCore } from '../src/core-solver.js'
import { applyLinkedTurn, findLinkedTurn, getLinkedPartner, LINKED_TURNS, scrambleLinkedCore, slotName, solveLinkedCore } from '../src/linked-core.js'

test('a solved cube has 26 visible pieces and nine stickers of every color', () => {
  const cube = makeCube()
  assert.equal(cube.length, 26)
  assert.equal(new Set(cube.map(({ position }) => position.join(','))).size, 26)
  assert.equal(isSolved(cube), true)

  const colors = cube.flatMap(({ stickers }) => Object.values(stickers))
  for (const face of Object.keys(FACES)) {
    assert.equal(colors.filter((color) => color === face).length, 9)
  }
})

test('a clockwise front turn sends the top-front-right corner to the bottom-front-right', () => {
  const cube = turnCube(makeCube(), 'F')
  const corner = cube.find(({ position }) => position.join(',') === '1,-1,1')
  assert.deepEqual(corner.stickers, { R: 'U', D: 'R', F: 'F' })
  assert.equal(isSolved(cube), false)
})

test('every face supports inverse turns and half turns without moving fixed centers', () => {
  for (const face of Object.keys(FACES)) {
    const cube = makeCube()
    const turned = turnCube(cube, face)
    assert.equal(isSolved(turned), false)
    assert.deepEqual(turnCube(turned, inverseMove(face)), cube)
    assert.deepEqual(turnCube(turned, face), turnCube(cube, `${face}2`))
    assert.deepEqual(turnCube(turnCube(cube, `${face}2`), `${face}2`), cube)
    for (const { stickers } of turned.filter(({ position }) => position.filter(Boolean).length === 1)) {
      assert.equal(Object.keys(stickers)[0], Object.values(stickers)[0])
    }
  }
})

test('piece routes reach every position of the same type using legal face turns', () => {
  const cube = makeCube()
  for (const [index, source] of cube.entries()) {
    for (const target of cube) {
      if (source === target) {
        assert.deepEqual(findPieceRoute(source.position, target.position), [])
      } else if (pieceKind(source) === 'center' || pieceKind(source) !== pieceKind(target)) {
        assert.equal(findPieceRoute(source.position, target.position), null)
      } else {
        const moves = findPieceRoute(source.position, target.position)
        assert.ok(moves?.length)
        const result = moves.reduce(turnCube, cube)
        assert.deepEqual(result[index].position, target.position)
        assert.equal(isSolved([...moves].reverse().map(inverseMove).reduce(turnCube, result)), true)
      }
    }
  }
})

test('the core inherits the scramble and follows the same turns as the 3×3', () => {
  const scramble = ['R', 'F2', "U'", 'L2', 'D', 'B']
  const cube = scramble.reduce(turnCube, makeCube())
  const core = getCorners(cube)
  assert.equal(core.length, 8)
  assert.equal(isSolved(core), false)

  for (const face of Object.keys(FACES)) {
    for (const move of [face, inverseMove(face), `${face}2`]) {
      assert.deepEqual(turnCube(core, move), getCorners(turnCube(cube, move)))
    }
  }
})

test('the core solver resolves both corner orientation and permutation', () => {
  const commutator = ['R', 'U', "R'", "U'"]
  const scrambles = [
    [...commutator, ...commutator, ...commutator],
    ['R2', 'U2', 'F2', 'L2'],
    ['D2', "R'", 'B', 'F2', 'L', 'U', 'B2', 'R2', "F'", 'U2', "D'", 'L2'],
  ]

  assert.deepEqual(solveCore(makeCube()), [])
  for (const scramble of scrambles) {
    const cube = scramble.reduce(turnCube, makeCube())
    const moves = solveCore(getCorners(cube))
    assert.ok(moves.length > 0)
    assert.equal(isSolved(getCorners(moves.reduce(turnCube, cube))), true)
  }
})

test('every linked swap exchanges exactly the advertised corners and edges', () => {
  const cube = makeCube()
  for (const [move, { corners, edges }] of Object.entries(LINKED_TURNS)) {
    const next = applyLinkedTurn(cube, move)
    const affected = new Map([[corners[0], corners[1]], [corners[1], corners[0]],
      [edges[0], edges[1]], [edges[1], edges[0]]])
    const from = cube.find(({ position }) => slotName(position) === corners[0])
    const to = cube.find(({ position }) => slotName(position) === corners[1])
    assert.equal(findLinkedTurn(from.position, to.position), move)
    assert.equal(findLinkedTurn(to.position, from.position), move)
    assert.equal(getLinkedPartner(from.position), edges[0])
    assert.equal(getLinkedPartner(to.position), edges[1])

    for (const [index, original] of cube.entries()) {
      const home = slotName(original.position)
      const piece = next[index]
      const position = slotName(piece.position)
      assert.equal(position, affected.get(home) ?? home)
      if (affected.has(home)) assert.equal(piece.stickers[position[0]], home[0])
      else assert.deepEqual(piece, original)
    }

    assert.deepEqual(applyLinkedTurn(next, move), cube)
  }
})

test('linked corner solutions also restore the 3×3, including bottom-to-top swaps', () => {
  const scrambles = [
    ['7', '6', '5', '4', '3', '2', '1', '5', '4', '3', '2'],
    ['4', '3', '2', '5', '7', '1', '3', '2', '6'],
    ...Array.from({ length: 4 }, () => scrambleLinkedCore()),
  ]

  for (const moves of scrambles) {
    const cube = moves.reduce(applyLinkedTurn, makeCube())
    assert.equal(isSolved(getCorners(cube)), false)
    assert.equal(isSolved(cube), false)
    const solution = solveLinkedCore(getCorners(cube))
    assert.equal(isSolved(solution.reduce(applyLinkedTurn, cube)), true)
  }
  assert.equal(solveLinkedCore(scrambles[2].reduce(applyLinkedTurn, makeCube())).length >= 8, true)
})

test('a linked corner solve also restores the 3×3 after swaps and twists', () => {
  const twist = makeCornerTwist([1, 1, 1], [-1, -1, -1], 1)
  const moves = ['4', '3', '7', twist, '1', '6', '2', '5', '4']
  const cube = moves.reduce(applyLinkedTurn, makeCube())
  const corners = getCorners(cube)
  assert.deepEqual(corners, moves.reduce(applyLinkedTurn, getCorners(makeCube())))
  assert.equal(isSolved(solveLinkedCore(corners).reduce(applyLinkedTurn, cube)), true)
})

test('a clockwise twist and its counterclockwise inverse preserve every other piece', () => {
  const cube = makeCube()
  const corners = getCorners(cube)
  for (const [first, second] of [[corners[0], corners[7]], [corners[1], corners[3]]]) {
    const twisted = applyLinkedTurn(cube, makeCornerTwist(first.position, second.position, 1))
    assert.equal(cornerOrientation(twisted[cube.indexOf(first)]), 1)
    assert.equal(cornerOrientation(twisted[cube.indexOf(second)]), 2)
    assert.deepEqual(twisted.map(({ position }) => position), cube.map(({ position }) => position))
    assert.equal(twisted.filter((piece) => !isSolved([piece])).length, 2)
    assert.deepEqual(applyLinkedTurn(twisted, makeCornerTwist(first.position, second.position, -1)), cube)
  }
})
