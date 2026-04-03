"use client";

import { useEffect, useRef, useState } from "react";

// --- 게임 설정 상수 ---
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const POLE_WIDTH = 10; 
const POLE_HEIGHT = 380;
const RING_OUTER_RADIUS = 40;
const RING_THICKNESS = 18;
const INITIAL_DROP_SPEED = 3.2; 
const MAX_LIVES = 5; 
const CATCH_TOLERANCE = 15; 
const GOAL_SCORE = 2000; 

const RING_TYPES = [
  { color: "#3b82f6", points: 10, weight: 6 },
  { color: "#10b981", points: 30, weight: 3 },
  { color: "#fbbf24", points: 100, weight: 0.5 },
  { color: "#ef4444", points: -100, weight: 1.2 }, 
];

export default function RingCatcherGame() {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [gameState, setGameState] = useState("START");
  const [username, setUsername] = useState("Pioneer");
  const [lastBonusMilestone, setLastBonusMilestone] = useState(0);
  const [showFever, setShowFever] = useState(false);

  // --- 모든 사운드 파일 로드 ---
  const sounds = useRef({
    bgm: typeof Audio !== "undefined" ? new Audio("/sounds/bgm.mp3") : null,
    catch: typeof Audio !== "undefined" ? new Audio("/sounds/catch.mp3") : null,
    bomb: typeof Audio !== "undefined" ? new Audio("/sounds/bomb.mp3") : null,
    fever: typeof Audio !== "undefined" ? new Audio("/sounds/fever.mp3") : null,
    gameover: typeof Audio !== "undefined" ? new Audio("/sounds/gameover.mp3") : null,
  });

  const playEffect = (type) => {
    const s = sounds.current[type];
    if (s) {
      s.currentTime = 0;
      s.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.Pi) {
      window.Pi.init({ version: "1.5", sandbox: true });
      window.Pi.authenticate(['username'], () => {}).then(auth => setUsername(auth.user.username)).catch(() => {});
    }
  }, []);

  const startGame = () => {
    setScore(0); setLives(MAX_LIVES); setLastBonusMilestone(0);
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
    let rodX = CANVAS_WIDTH / 2; // 자유 조작 유지
    let rings = [];
    let caughtRings = [];
    let frameCount = 0;

    const gameLoop = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 상단 프로그레스 바
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(0, 0, CANVAS_WIDTH, 6);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(0, 0, (score / GOAL_SCORE) * CANVAS_WIDTH, 6);

      // 막대 렌더링
      ctx.fillStyle = "#475569";
      ctx.fillRect(rodX - POLE_WIDTH / 2, CANVAS_HEIGHT - POLE_HEIGHT, POLE_WIDTH, POLE_HEIGHT);

      // 점수별 가속도 및 생성 속도 조절
      const spawnRate = Math.max(18, 75 - Math.floor(score / 200) * 12);
      if (frameCount % spawnRate === 0) {
        const totalWeight = RING_TYPES.reduce((acc, curr) => acc + curr.weight, 0);
        let random = Math.random() * totalWeight;
        let selected = RING_TYPES[0];
        for (const t of RING_TYPES) { if (random < t.weight) { selected = t; break; } random -= t.weight; }
        
        rings.push({
          x: Math.random() * (CANVAS_WIDTH - 100) + 50,
          y: -50,
          speed: INITIAL_DROP_SPEED + (score / 300), // 가속도 상향
          ...selected
        });
      }

      rings = rings.filter(ring => {
        ring.y += ring.speed;
        const dist = Math.abs(ring.x - rodX);
        const hitTop = CANVAS_HEIGHT - POLE_HEIGHT;

        // 충돌 판정
        if (dist < CATCH_TOLERANCE && ring.y > hitTop && ring.y < hitTop + 25) {
          if (ring.color === "#ef4444") {
            setScore(prev => Math.max(0, prev + ring.points));
            playEffect('bomb'); // 폭탄 사운드
          } else {
            setScore(prev => {
              const next = prev + ring.points;
              // 500점 단위 피버 로직
              const currentMilestone = Math.floor(next / 500);
              if (currentMilestone > lastBonusMilestone) {
                setLives(MAX_LIVES);
                setLastBonusMilestone(currentMilestone);
                playEffect('fever'); // 피버 사운드
                setShowFever(true);
                setTimeout(() => setShowFever(false), 2000);
              }
              if (next >= GOAL_SCORE) setGameState("WIN");
              return next;
            });
            playEffect('catch'); // 획득 사운드
            caughtRings.push({ ...ring, caughtY: CANVAS_HEIGHT - (caughtRings.length * 14) - 35 });
          }
          return false;
        }

        // 바닥 추락 판정 (하트 차감)
        if (ring.y > CANVAS_HEIGHT) {
          if (ring.color !== "#ef4444") {
            setLives(prev => {
              if (prev <= 1) {
                setGameState("GAMEOVER");
                playEffect('gameover'); // 게임오버 사운드
                if (sounds.current.bgm) sounds.current.bgm.pause();
              }
              return prev - 1;
            });
          }
          return false;
        }

        ctx.beginPath();
        ctx.arc(ring.x, ring.y, RING_OUTER_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = RING_THICKNESS;
        ctx.stroke();
        return true;
      });

      caughtRings.slice(-30).forEach(r => {
        ctx.beginPath();
        ctx.arc(rodX, r.caughtY, RING_OUTER_RADIUS * 0.7, 0, Math.PI * 2);
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
      rodX = Math.max(30, Math.min(CANVAS_WIDTH - 30, x));
    };

    canvas.addEventListener("mousemove", handleInput);
    canvas.addEventListener("touchmove", handleInput, { passive: false });
    gameLoop();
    return () => { cancelAnimationFrame(animationFrameId); canvas.removeEventListener("mousemove", handleInput); canvas.removeEventListener("touchmove", handleInput); };
  }, [gameState, score, lastBonusMilestone]);

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border-[10px] border-[#fbbf24] relative">
        <div className="p-5 flex justify-between items-center bg-gray-50 border-b-2">
          <div className="text-left">
            <p className="text-[10px] font-black text-blue-500">GOAL: {GOAL_SCORE}</p>
            <p className="text-4xl font-black text-slate-800 leading-none">{score}</p>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <span key={i} className={`text-xl transition-all duration-500 ${i < lives ? 'scale-110 drop-shadow-md' : 'grayscale opacity-20'}`}>❤️</span>
            ))}
          </div>
        </div>

        <div className="relative bg-[#bae6fd]">
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="w-full h-auto touch-none" />
          
          {/* 피버 타임 알림 */}
          {showFever && (
            <div className="absolute top-1/4 left-0 w-full text-center pointer-events-none animate-ping">
              <span className="text-4xl font-black text-yellow-500 stroke-black drop-shadow-lg">FEVER TIME!!</span>
            </div>
          )}

          {gameState !== "PLAYING" && (
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center text-white">
              <h2 className="text-[#fbbf24] text-5xl font-black mb-1 italic">PI-RING 2.0</h2>
              <p className="text-[10px] tracking-widest mb-8 opacity-60 uppercase">Grit leads to the Mainnet</p>
              
              <div className="bg-white/10 rounded-3xl p-6 mb-10 w-full text-left border border-white/10 leading-relaxed">
                <p className="text-sm mb-4 italic">Welcome back, <span className="text-[#fbbf24] font-bold">{username}</span></p>
                <div className="space-y-3 text-[11px]">
                  <p className="flex items-start gap-2">
                    <span className="text-green-400 font-bold">🎁 500PT 보너스:</span> 
                    <span>구간마다 <span className="text-green-400 font-bold underline">FEVER 사운드</span>와 함께 생명력이 충전됩니다!</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">⚡ 속도 무제한:</span> 
                    <span>점수가 오를수록 링의 낙하 속도가 한계까지 빨라집니다!</span>
                  </p>
                </div>
              </div>

              <button onClick={startGame} className="bg-[#fbbf24] text-black text-2xl font-black py-5 px-16 rounded-2xl shadow-lg active:scale-95 transition-all">
                {gameState === "START" ? "START MISSION" : "RETRY MISSION"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
