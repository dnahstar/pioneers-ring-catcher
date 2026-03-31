export type CellType = "empty" | "wall" | "start" | "end" | "path" | "visited"

export interface Cell {
  row: number
  col: number
  type: CellType
}

export interface GridState {
  grid: Cell[][]
  isDrawing: boolean
  isRunning: boolean
}

// A* Pathfinding Algorithm
export function findPath(
  grid: Cell[][],
  start: { row: number; col: number },
  end: { row: number; col: number },
): { path: Cell[]; visited: Cell[] } {
  const rows = grid.length
  const cols = grid[0].length

  const openSet: Cell[] = [grid[start.row][start.col]]
  const closedSet: Set<string> = new Set()
  const cameFrom = new Map<string, Cell>()
  const gScore = new Map<string, number>()
  const fScore = new Map<string, number>()

  const visited: Cell[] = []

  const getKey = (cell: Cell) => `${cell.row},${cell.col}`
  const startKey = getKey(grid[start.row][start.col])

  gScore.set(startKey, 0)
  fScore.set(startKey, heuristic(start, end))

  while (openSet.length > 0) {
    // Find cell with lowest fScore
    let current = openSet[0]
    let currentIdx = 0

    for (let i = 1; i < openSet.length; i++) {
      if (
        (fScore.get(getKey(openSet[i])) || Number.POSITIVE_INFINITY) <
        (fScore.get(getKey(current)) || Number.POSITIVE_INFINITY)
      ) {
        current = openSet[i]
        currentIdx = i
      }
    }

    if (current.row === end.row && current.col === end.col) {
      return { path: reconstructPath(cameFrom, current), visited }
    }

    openSet.splice(currentIdx, 1)
    const currentKey = getKey(current)
    closedSet.add(currentKey)
    visited.push(current)

    const neighbors = getNeighbors(grid, current, rows, cols)

    for (const neighbor of neighbors) {
      const neighborKey = getKey(neighbor)

      if (closedSet.has(neighborKey)) continue

      const tentativeGScore = (gScore.get(currentKey) || Number.POSITIVE_INFINITY) + 1

      if (!openSet.find((cell) => getKey(cell) === neighborKey)) {
        openSet.push(neighbor)
      } else if (tentativeGScore >= (gScore.get(neighborKey) || Number.POSITIVE_INFINITY)) {
        continue
      }

      cameFrom.set(neighborKey, current)
      gScore.set(neighborKey, tentativeGScore)
      fScore.set(neighborKey, tentativeGScore + heuristic({ row: neighbor.row, col: neighbor.col }, end))
    }
  }

  return { path: [], visited }
}

function heuristic(a: { row: number; col: number }, b: { row: number; col: number }): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col)
}

function getNeighbors(grid: Cell[][], cell: Cell, rows: number, cols: number): Cell[] {
  const neighbors: Cell[] = []
  const directions = [
    { row: -1, col: 0 }, // up
    { row: 1, col: 0 }, // down
    { row: 0, col: -1 }, // left
    { row: 0, col: 1 }, // right
  ]

  for (const dir of directions) {
    const newRow = cell.row + dir.row
    const newCol = cell.col + dir.col

    if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols && grid[newRow][newCol].type !== "wall") {
      neighbors.push(grid[newRow][newCol])
    }
  }

  return neighbors
}

function reconstructPath(cameFrom: Map<string, Cell>, current: Cell): Cell[] {
  const path: Cell[] = [current]
  const getKey = (cell: Cell) => `${cell.row},${cell.col}`

  let currentKey = getKey(current)

  while (cameFrom.has(currentKey)) {
    current = cameFrom.get(currentKey)!
    path.unshift(current)
    currentKey = getKey(current)
  }

  return path
}

export function createEmptyGrid(rows: number, cols: number): Cell[][] {
  const grid: Cell[][] = []

  for (let row = 0; row < rows; row++) {
    grid[row] = []
    for (let col = 0; col < cols; col++) {
      grid[row][col] = {
        row,
        col,
        type: "empty",
      }
    }
  }

  // Set start and end positions
  grid[1][1].type = "start"
  grid[rows - 2][cols - 2].type = "end"

  return grid
}
