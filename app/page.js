"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// --- 게임 설정 상수 ---
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const POLE_WIDTH = 8;
const POLE_HEIGHT = 350;
const RING_OUTER_RADIUS = 40;
const RING_INNER_RADIUS = 20;
const RING_THICKNESS = 20;
const INITIAL_DROP_SPEED = 2.5; 
const INITIAL_LIVES = 5;
const CATCH_TOLERANCE = 15;

const RING_TYPES = [
  { color: "#3b82f6", points: 10, weight: 5 },
  { color: "#10b981", points: 20, weight: 3 },
  { color: "#f59e0b", points: 30, weight: 2 },
  { color: "#ef4444", points: 40, weight: 1 },
  { color: "#fbbf24", points: 100, weight: 0.3 },
];

export default function RingCatcherGame() {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [gameState, setGameState] = useState("START"); // START, PLAYING, GAMEOVER
  const [username, setUsername] = useState("Pioneer");

  // 사운드 Refs (sounds 복수형 경로 적용)
  const sounds = useRef({
    bgm: typeof Audio !== "undefined" ? new Audio("/sounds/bgm.mp3") : null,
    catch: typeof Audio !== "undefined" ? new Audio("/sounds/catch.mp3") : null,
    bomb: typeof Audio !== "undefined" ? new Audio("/sounds/bomb.mp3") : null,
    gameover: typeof Audio !== "undefined" ? new Audio("/sounds/gameover.mp3") : null,
  });

  // 사운드 재생 함수 (안전 모드)
  const playEffect = (type) => {
    try {
      const s = sounds.current[type];
      if (s) {
        s.currentTime = 0;
        s.play().catch(() => {}); // 브라우저 차단 방지
      }
    } catch (e) { console.error("Sound error"); }
  };

  // 파이 SDK 인증 로직
  useEffect(() => {
    if (window.Pi) {
      window.Pi.init({ version: "1.5", sandbox: true });
      window.Pi.authenticate(['username'], (payment) => {}).then((auth) => {
        setUsername(auth.user.username);
      }).catch(() => {});
    }
  }, []);

  // 게임 시작 함수
  const startGame = () => {
    setScore(0);
    setLives(INITIAL_LIVES);
    setGameState("PLAYING");
    if (sounds.current.bgm) {
      sounds.current.bgm.loop = true;
      sounds.current.bgm.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (gameState !== "PLAYING") return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    
    let rodX = CANVAS_WIDTH / 2;
    let rings = [];
    let caughtRings = [];
    let frameCount = 0;

    const gameLoop = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 1. 막대 그리기
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(rodX - POLE_WIDTH / 2, CANVAS_HEIGHT - POLE_HEIGHT, POLE_WIDTH, POLE_HEIGHT);

      // 2. 링 생성 (1.0 로직)
      if (frameCount % 100 === 0) {
        const type = RING_TYPES[Math.floor(Math.random() * RING_TYPES.length)];
        rings.push({
          x: Math.random() * (CANVAS_WIDTH - 60) + 30,
          y: -50,
          ...type
        });
      }

      // 3. 링 이동 및 판정
      rings = rings.filter(ring => {
        ring.y += INITIAL_DROP_SPEED;

        // 잡기 판정
        const dist = Math.abs(ring.x - rodX);
        const hitTop = CANVAS_HEIGHT - POLE_HEIGHT;
        if (dist < CATCH_TOLERANCE && ring.y > hitTop && ring.y < hitTop + 20) {
          setScore(prev => prev + ring.points);
          playEffect('catch');
          caughtRings.push({ ...ring, caughtY: CANVAS_HEIGHT - (caughtRings.length * 15) - 20 });
          return false;
        }

        // 놓침 판정
        if (ring.y > CANVAS_HEIGHT) {
          setLives(prev => {
            if (prev <= 1) {
              setGameState("GAMEOVER");
              playEffect('gameover');
              if (sounds.current.bgm) sounds.current.bgm.pause();
            }
            return prev - 1;
          });
          return false;
        }

        // 링 그리기
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, RING_OUTER_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = RING_THICKNESS;
        ctx.stroke();
        return true;
      });

      // 4. 쌓인 링 그리기
      caughtRings.forEach(r => {
        ctx.beginPath();
        ctx.arc(rodX, r.caughtY, RING_OUTER_RADIUS / 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 10;
        ctx.stroke();
      });

      frameCount++;
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    const handleInput = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      rodX = Math.max(POLE_WIDTH, Math.min(CANVAS_WIDTH - POLE_WIDTH, x));
    };

    canvas.addEventListener("mousemove", handleInput);
    canvas.addEventListener("touchmove", handleInput);
    gameLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener("mousemove", handleInput);
      canvas.removeEventListener("touchmove", handleInput);
    };
  }, [gameState]);

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border-8 border-[#fbbf24]">
        <div className="p-4 flex justify-between items-center bg-gray-50 border-b">
          <div>
            <p className="text-xs font-bold text-gray-400">SCORE</p>
            <p className="text-3xl font-black text-blue-600">{score}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-400">LIVES</p>
            <p className="text-2xl">{"❤️".repeat(lives)}</p>
          </div>
        </div>

        <div className="relative bg-[#bae6fd]">
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="w-full h-auto touch-none" />
          
          {gameState !== "PLAYING" && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-6 text-center">
              <h2 className="text-white text-4xl font-black mb-4">
                {gameState === "START" ? "RING CATCHER" : "GAME OVER"}
              </h2>
              <p className="text-white mb-8">Ready, {username}?</p>
              <button 
                onClick={startGame}
                className="bg-[#fbbf24] hover:scale-105 transition-transform text-black text-2xl font-black py-4 px-12 rounded-full shadow-lg"
              >
                {gameState === "START" ? "START GAME" : "RETRY"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
