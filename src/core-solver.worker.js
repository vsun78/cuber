import { solveCore } from './core-solver.js'

self.addEventListener('message', ({ data }) => {
  try {
    self.postMessage({ moves: solveCore(data) })
  } catch {
    self.postMessage({ error: 'Cuber could not find a core solution. Try again.' })
  }
})
