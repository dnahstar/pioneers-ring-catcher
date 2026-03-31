"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Play, RotateCcw, HelpCircle } from "lucide-react"
import { createEmptyGrid, findPath, type Cell, type CellType } from "@/lib/pathfinding"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const ROWS = 20
const COLS = 30
const CELL_SIZE = 24

export function PathfindingGrid() {
  const [grid, setGrid] = useState<Cell[][]>(() => createEmptyGrid(ROWS, COLS))
  const [isDrawing, setIsDrawing] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [drawMode, setDrawMode] = useState<"wall" | "erase">("wall")
  const gridRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (row: number, col: number) => {
    if (isRunning) return
    if (grid[row][col].type === "start" || grid[row][col].type === "end") return

    setIsDrawing(true)
    toggleCell(row, col)
  }

  const handleMouseEnter = (row: number, col: number) => {
    if (!isDrawing || isRunning) return
    if (grid[row][col].type === "start" || grid[row][col].type === "end") return

    toggleCell(row, col)
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
  }

  const toggleCell = (row: number, col: number) => {
    setGrid((prevGrid) => {
      const newGrid = prevGrid.map((r) => r.map((c) => ({ ...c })))
      const cell = newGrid[row][col]

      if (cell.type === "empty" || cell.type === "visited" || cell.type === "path") {
        cell.type = drawMode === "wall" ? "wall" : "empty"
      } else if (cell.type === "wall") {
        cell.type = "empty"
      }

      return newGrid
    })
  }

  const runPathfinding = async () => {
    setIsRunning(true)

    // Clear previous path and visited cells
    const clearedGrid = grid.map((row) =>
      row.map((cell) => ({
        ...cell,
        type: cell.type === "path" || cell.type === "visited" ? "empty" : cell.type,
      })),
    )
    setGrid(clearedGrid)

    // Find start and end
    let start: { row: number; col: number } | null = null
    let end: { row: number; col: number } | null = null

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (clearedGrid[row][col].type === "start") start = { row, col }
        if (clearedGrid[row][col].type === "end") end = { row, col }
      }
    }

    if (!start || !end) {
      setIsRunning(false)
      return
    }

    const { path, visited } = findPath(clearedGrid, start, end)

    // Animate visited cells
    for (let i = 0; i < visited.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      setGrid((prevGrid) => {
        const newGrid = prevGrid.map((r) => r.map((c) => ({ ...c })))
        const cell = visited[i]
        if (newGrid[cell.row][cell.col].type === "empty") {
          newGrid[cell.row][cell.col].type = "visited"
        }
        return newGrid
      })
    }

    if (path.length > 0) {
      for (let i = 1; i < path.length - 1; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        setGrid((prevGrid) => {
          const newGrid = prevGrid.map((r) => r.map((c) => ({ ...c })))
          const cell = path[i]
          if (newGrid[cell.row][cell.col].type !== "start" && newGrid[cell.row][cell.col].type !== "end") {
            newGrid[cell.row][cell.col].type = "path"
          }
          return newGrid
        })
      }
    }

    setIsRunning(false)
  }

  const resetGrid = () => {
    setGrid(createEmptyGrid(ROWS, COLS))
  }

  const clearPath = () => {
    setGrid((prevGrid) =>
      prevGrid.map((row) =>
        row.map((cell) => ({
          ...cell,
          type: cell.type === "path" || cell.type === "visited" ? "empty" : cell.type,
        })),
      ),
    )
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDrawing(false)
    window.addEventListener("mouseup", handleGlobalMouseUp)
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp)
  }, [])

  const getCellColor = (type: CellType): string => {
    switch (type) {
      case "start":
        return "bg-rose-500"
      case "end":
        return "bg-blue-500"
      case "wall":
        return "bg-slate-800"
      case "path":
        return "bg-emerald-500"
      case "visited":
        return "bg-sky-200"
      default:
        return "bg-white"
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          onClick={runPathfinding}
          disabled={isRunning}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6"
        >
          <Play className="mr-2" size={18} />
          길찾기 시작
        </Button>

        <Button
          onClick={clearPath}
          disabled={isRunning}
          variant="outline"
          className="border-2 border-slate-300 font-semibold px-6 bg-transparent"
        >
          <HelpCircle className="mr-2" size={18} />
          도움말
        </Button>

        <Button
          onClick={resetGrid}
          disabled={isRunning}
          variant="outline"
          className="border-2 border-slate-300 font-semibold px-6 bg-transparent"
        >
          <RotateCcw className="mr-2" size={18} />
          리셋
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="border-2 border-slate-300 font-semibold px-6 bg-transparent">
              <HelpCircle className="mr-2" size={18} />
              도움말
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl">🚀 미로 탈출! 길찾기 가이드</DialogTitle>
            </DialogHeader>
            <DialogDescription className="space-y-4 text-left">
              <div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">1. 게임 목표</h3>
                <p className="text-slate-700">
                  복잡한 미로 속에서 시작점(빨간색)부터 도착점(파란색)까지 가장 빠른 길을 찾아보세요!
                </p>
              </div>

              <div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">2. 조작 방법</h3>
                <ul className="space-y-2 text-slate-700">
                  <li>
                    <strong>벽 세우기:</strong> 화면의 빈 칸을 터치하면 장애물이 생성됩니다. 다시 터치하면 제거됩니다.
                  </li>
                  <li>
                    <strong>시작/중지:</strong> 하단의 '길찾기 시작' 버튼을 누르면 AI가 최단 경로를 계산하여 초록색
                    선으로 표시합니다.
                  </li>
                  <li>
                    <strong>초기화:</strong> '리셋' 버튼을 누르면 모든 벽과 경로가 사라지고 새로 시작할 수 있습니다.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">3. 팁 (Tip)</h3>
                <ul className="space-y-2 text-slate-700">
                  <li>⚠️ 길이 완전히 막혀버리면 AI가 경로를 찾을 수 없어요! 최소한 한 칸의 통로는 남겨두어야 합니다.</li>
                  <li>⏱️ 장애물을 많이 만들수록 AI가 고민하는 시간이 길어질 수 있으니 주의하세요!</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-6 items-center text-sm flex-wrap justify-center">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-rose-500 rounded border border-slate-300" />
          <span className="font-medium">시작점</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-blue-500 rounded border border-slate-300" />
          <span className="font-medium">도착점</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-slate-800 rounded border border-slate-300" />
          <span className="font-medium">장애물</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-sky-200 rounded border border-slate-300" />
          <span className="font-medium">탐색 중</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-emerald-500 rounded border border-slate-300" />
          <span className="font-medium">최단 경로</span>
        </div>
      </div>

      <div
        ref={gridRef}
        className="inline-block border-4 border-slate-800 rounded-lg shadow-2xl bg-slate-100 p-2"
        style={{
          touchAction: "none",
        }}
      >
        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="flex">
            {row.map((cell, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={`${getCellColor(cell.type)} border border-slate-300 cursor-pointer transition-colors duration-100 hover:opacity-80`}
                style={{
                  width: `${CELL_SIZE}px`,
                  height: `${CELL_SIZE}px`,
                }}
                onMouseDown={() => handleMouseDown(rowIdx, colIdx)}
                onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                onMouseUp={handleMouseUp}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="text-center text-sm text-slate-600 max-w-md">
        <p className="font-medium">💡 빠른 시작</p>
        <p className="mt-2">
          마우스를 클릭하고 드래그하여 장애물을 만드세요. '길찾기 시작' 버튼을 누르면 AI가 최단 경로를 찾아 표시합니다.
        </p>
      </div>
    </div>
  )
}
