"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { PhysicsEngine, type PhysicsBody } from "@/lib/physics-engine"
import { AlertCircle, Play, RotateCcw, HelpCircle } from "lucide-react"

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 600
const CATCHER_WIDTH = 80
const CATCHER_HEIGHT = 15
const PIE_SIZES = [30, 35, 40, 45]
const PIE_COLORS = ["#f59e0b", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#6366f1"]
const DROP_INTERVAL = 2000
const BONUS_HEIGHT_THRESHOLD = 200

export function PiStackGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<PhysicsEngine | null>(null)
  const animationFrameRef = useRef<number>()
  const dropIntervalRef = useRef<NodeJS.Timeout>()
  const catcherIdRef = useRef<string>("catcher")

  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [catcherX, setCatcherX] = useState(CANVAS_WIDTH / 2)
  const [stackHeight, setStackHeight] = useState(0)

  // Initialize physics engine
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new PhysicsEngine(CANVAS_WIDTH, CANVAS_HEIGHT)
    }
  }, [])

  // Move catcher
  const moveCatcher = useCallback(
    (clientX: number) => {
      if (!isPlaying || isGameOver || !canvasRef.current) return

      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const clampedX = Math.max(CATCHER_WIDTH / 2, Math.min(CANVAS_WIDTH - CATCHER_WIDTH / 2, x))

      setCatcherX(clampedX)

      if (engineRef.current) {
        const catcher = engineRef.current.getBodies().find((b) => b.id === catcherIdRef.current)
        if (catcher) {
          catcher.x = clampedX
        }
      }
    },
    [isPlaying, isGameOver],
  )

  // Mouse/touch handlers
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      moveCatcher(e.clientX)
    },
    [moveCatcher],
  )

  // Drop pie
  const dropPie = useCallback(() => {
    if (!engineRef.current || isGameOver) return

    const size = PIE_SIZES[Math.floor(Math.random() * PIE_SIZES.length)]
    const color = PIE_COLORS[Math.floor(Math.random() * PIE_COLORS.length)]
    const x = Math.random() * (CANVAS_WIDTH - size) + size / 2

    const pie: PhysicsBody = {
      id: `pie-${Date.now()}-${Math.random()}`,
      x,
      y: -size,
      vx: 0,
      vy: 0,
      width: size,
      height: size,
      rotation: 0,
      angularVelocity: 0,
      isStatic: false,
      type: "pie",
      color,
    }

    engineRef.current.addBody(pie)
  }, [isGameOver])

  // Check game over conditions
  const checkGameOver = useCallback(() => {
    if (!engineRef.current) return false

    const bodies = engineRef.current.getBodies()
    const pies = bodies.filter((b) => b.type === "pie")

    // Check if any pie fell below the canvas
    for (const pie of pies) {
      if (pie.y > CANVAS_HEIGHT + 50) {
        // Check if it missed the catcher
        const catcher = bodies.find((b) => b.id === catcherIdRef.current)
        if (catcher) {
          const distance = Math.abs(pie.x - catcher.x)
          if (distance > CATCHER_WIDTH / 2 + pie.width / 2) {
            return true
          }
        }
        // Remove fallen pies
        engineRef.current.removeBody(pie.id)
      }
    }

    return false
  }, [])

  // Game loop
  const gameLoop = useCallback(() => {
    if (!engineRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Update physics
    engineRef.current.update()

    // Check game over
    if (checkGameOver()) {
      setIsGameOver(true)
      setIsPlaying(false)
      return
    }

    // Calculate stack height and update score
    const bodies = engineRef.current.getBodies()
    const pies = bodies.filter((b) => b.type === "pie")

    if (pies.length > 0) {
      const lowestY = Math.min(...pies.map((p) => p.y - p.height / 2))
      const currentHeight = CANVAS_HEIGHT - lowestY
      setStackHeight(currentHeight)

      // Bonus for reaching height thresholds
      if (currentHeight > BONUS_HEIGHT_THRESHOLD && currentHeight % 100 < 10) {
        setScore((s) => s + 50)
      }
    }

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    gradient.addColorStop(0, "#1e293b")
    gradient.addColorStop(1, "#334155")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw height markers
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"
    ctx.lineWidth = 1
    for (let i = 100; i < CANVAS_HEIGHT; i += 100) {
      ctx.beginPath()
      ctx.moveTo(0, CANVAS_HEIGHT - i)
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - i)
      ctx.stroke()
    }

    // Draw all bodies
    bodies.forEach((body) => {
      ctx.save()
      ctx.translate(body.x, body.y)
      ctx.rotate(body.rotation)

      if (body.type === "catcher") {
        // Draw catcher as rounded rectangle
        ctx.fillStyle = "#10b981"
        ctx.strokeStyle = "#059669"
        ctx.lineWidth = 3
        const radius = 5
        ctx.beginPath()
        ctx.roundRect(-body.width / 2, -body.height / 2, body.width, body.height, radius)
        ctx.fill()
        ctx.stroke()
      } else if (body.type === "pie") {
        // Draw pie as circle with Pi symbol
        ctx.fillStyle = body.color
        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(0, 0, body.width / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Draw Pi symbol
        ctx.fillStyle = "white"
        ctx.font = `bold ${body.width * 0.5}px Arial`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText("π", 0, 0)
      }

      ctx.restore()
    })

    animationFrameRef.current = requestAnimationFrame(gameLoop)
  }, [checkGameOver])

  // Start game
  const startGame = useCallback(() => {
    if (!engineRef.current) return

    // Reset
    engineRef.current.bodies = []
    setScore(0)
    setIsGameOver(false)
    setIsPlaying(true)
    setStackHeight(0)
    setCatcherX(CANVAS_WIDTH / 2)

    // Add catcher
    const catcher: PhysicsBody = {
      id: catcherIdRef.current,
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 50,
      vx: 0,
      vy: 0,
      width: CATCHER_WIDTH,
      height: CATCHER_HEIGHT,
      rotation: 0,
      angularVelocity: 0,
      isStatic: true,
      type: "catcher",
      color: "#10b981",
    }
    engineRef.current.addBody(catcher)

    // Start dropping pies
    dropPie()
    dropIntervalRef.current = setInterval(() => {
      dropPie()
      setScore((s) => s + 10)
    }, DROP_INTERVAL)

    // Start game loop
    gameLoop()
  }, [dropPie, gameLoop])

  // Stop game
  const stopGame = useCallback(() => {
    setIsPlaying(false)
    if (dropIntervalRef.current) {
      clearInterval(dropIntervalRef.current)
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (score > highScore) {
      setHighScore(score)
    }
  }, [score, highScore])

  // Cleanup
  useEffect(() => {
    return () => {
      if (dropIntervalRef.current) {
        clearInterval(dropIntervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Stop game when game over
  useEffect(() => {
    if (isGameOver) {
      stopGame()
    }
  }, [isGameOver, stopGame])

  return (
    <div className="flex flex-col items-center gap-6">
      <Card className="p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="text-sm text-muted-foreground">점수</div>
            <div className="text-3xl font-bold text-primary">{score}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">최고 점수</div>
            <div className="text-2xl font-semibold">{highScore}</div>
          </div>
        </div>

        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1">쌓은 높이</div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                style={{ width: `${Math.min((stackHeight / CANVAS_HEIGHT) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="relative border-2 border-border rounded-lg overflow-hidden mb-4">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerMove={handlePointerMove}
            className="w-full h-auto cursor-pointer touch-none"
            style={{ maxHeight: "600px" }}
          />

          {!isPlaying && !isGameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="text-center text-white">
                <div className="text-2xl font-bold mb-2">파이를 쌓아보세요!</div>
                <div className="text-sm opacity-80">마우스로 받침대를 움직이세요</div>
              </div>
            </div>
          )}

          {isGameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="text-center text-white">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                <div className="text-3xl font-bold mb-2">게임 오버!</div>
                <div className="text-lg mb-4">최종 점수: {score}</div>
                <Button onClick={startGame} size="lg" className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  다시 시작
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!isPlaying ? (
            <Button onClick={startGame} className="flex-1 gap-2" size="lg">
              <Play className="w-4 h-4" />
              게임 시작
            </Button>
          ) : (
            <Button onClick={stopGame} variant="destructive" className="flex-1" size="lg">
              정지
            </Button>
          )}

          <Button onClick={() => setShowGuide(true)} variant="outline" size="lg" className="gap-2">
            <HelpCircle className="w-4 h-4" />
            도움말
          </Button>
        </div>
      </Card>

      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">파이 스택 게임 가이드</DialogTitle>
            <DialogDescription className="text-base leading-relaxed pt-4 space-y-4">
              <div>
                <div className="font-semibold text-foreground mb-2">게임 목표</div>
                <p>하늘에서 떨어지는 파이 블록을 받침대로 받아 최대한 높이 쌓아 올리세요!</p>
              </div>

              <div>
                <div className="font-semibold text-foreground mb-2">조작 방법</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>마우스를 좌우로 움직여 받침대를 조종하세요</li>
                  <li>떨어지는 파이 블록을 받침대로 받으세요</li>
                  <li>블록을 쌓을수록 점수가 올라갑니다</li>
                </ul>
              </div>

              <div>
                <div className="font-semibold text-foreground mb-2">점수 시스템</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>파이 블록 생성: +10점</li>
                  <li>높이 200 돌파: +50점 보너스</li>
                </ul>
              </div>

              <div>
                <div className="font-semibold text-foreground mb-2">게임 오버</div>
                <p>파이 블록이 받침대를 벗어나 바닥에 떨어지면 게임이 종료됩니다.</p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg">
                <div className="font-semibold text-amber-900 dark:text-amber-100 mb-1">팁</div>
                <p className="text-amber-800 dark:text-amber-200 text-sm">
                  블록이 흔들리지 않도록 균형있게 쌓아보세요. 너무 한쪽으로 치우치면 무너질 수 있습니다!
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}
