import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FACES, findPieceRoute, getCorners, inverseMove, isSolved, makeCube, pieceKind, turnCube } from '../src/cube.js'

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
