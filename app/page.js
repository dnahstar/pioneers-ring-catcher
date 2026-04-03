"use client";

import { useEffect, useRef, useState } from "react";

// --- 1.0 하드코어 감성 복구 설정 ---
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const POLE_WIDTH = 8; 
const POLE_HEIGHT = 380;
const RING_OUTER_RADIUS = 38;
const RING_THICKNESS = 15;
const INITIAL_DROP_SPEED = 3.8; // 1.0보다 더 빠르게 시작
const INITIAL_LIVES = 3; 
const CATCH_TOLERANCE = 12; // 1.0의 좁은 판정 복구
const GOAL_SCORE = 2000;

const RING_TYPES = [
  { color: "#3b82f6", points: 10, weight: 6 },
  { color: "#10b981", points: 30, weight: 3 },
  { color: "#ef4444", points: -100, weight: 1.5 }, // 폭탄 (감점 대폭 강화)
  { color: "#fbbf24", points: 250, weight: 0.2 }, // 황금링 (역전의 기회)
];

export default function RingCatcherGame() {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [gameState, setGameState] = useState("START");
  const [username, setUsername] = useState("Pioneer");
  const [authError, setAuthError] = useState("");

  // --- [핵심] 파이 인증 로직 강화 ---
  useEffect(() => {
    const authenticatePi = async () => {
      if (typeof window !== "undefined" && window.Pi) {
        try {
          // sandbox: true는 테스트용, 실배포는 false
          await window.Pi.init({ version: "1.5", sandbox: true });
          
          const auth = await window.Pi.authenticate(['username'], (payment) => {});
          setUsername(auth.user.username);
          setAuthError(""); 
        } catch (err) {
          console.error(err);
          setAuthError("인증 대기 중...");
          // 실패 시 3초 후 재시도 (팝업 차단 대비)
          setTimeout(authenticatePi, 3000);
        }
      } else {
        setAuthError("SDK 로드 대기 중...");
        setTimeout(authenticatePi, 1000);
      }
    };
    authenticatePi();
  }, []);

  // 사운드 관리
  const sounds = useRef({
    bgm: typeof Audio !== "undefined" ? new Audio("/sounds/bgm.mp3") : null,
    catch: typeof Audio !== "undefined" ? new Audio("/sounds/catch.mp3") : null,
    bomb: typeof Audio !== "undefined" ? new Audio("/sounds/bomb.mp3") : null,
    gameover: typeof Audio !== "undefined" ? new Audio("/sounds/gameover.mp3") : null,
  });

  const playEffect = (type) => {
    const s = sounds.current[type];
    if (s) { s.currentTime = 0; s.play().catch(() => {}); }
  };

  const startGame = () => {
    setScore(0); setLives(INITIAL_LIVES);
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

      // 목표 달성 게이지 (상단)
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(50, 20, CANVAS_WIDTH-100, 10);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(50, 20, Math.min(1, score/GOAL_SCORE)*(CANVAS_WIDTH-100), 10);

      // 막대
      ctx.fillStyle = "#475569";
      ctx.fillRect(rodX - POLE_WIDTH/2, CANVAS_HEIGHT - POLE_HEIGHT, POLE_WIDTH, POLE_HEIGHT);

      // 링 생성 (점수가 높을수록 더 빨리 생성)
      if (frameCount % Math.max(20, 70 - Math.floor(score/200)*5) === 0) {
        const totalWeight = RING_TYPES.reduce((acc, curr) => acc + curr.weight, 0);
        let random = Math.random() * totalWeight;
        let selected = RING_TYPES[0];
        for (const t of RING_TYPES) { if (random < t.weight) { selected = t; break; } random -= t.weight; }
        
        rings.push({
          x: Math.random() * (CANVAS_WIDTH - 100) + 50,
          y: -50,
          speed: INITIAL_DROP_SPEED + (score / 500), // 가속도
          ...selected
        });
      }

      rings = rings.filter(ring => {
        ring.y += ring.speed;
        const dist = Math.abs(ring.x - rodX);
        const hitTop = CANVAS_HEIGHT - POLE_HEIGHT;

        if (dist < CATCH_TOLERANCE && ring.y > hitTop && ring.y < hitTop + 20) {
          if (ring.points < 0) { // 폭탄
            setLives(prev => prev - 1);
            playEffect('bomb');
          } else {
            setScore(prev => {
              const next = prev + ring.points;
              if (next >= GOAL_SCORE) setGameState("WIN");
              return next;
            });
            playEffect('catch');
            caughtRings.push({ ...ring, caughtY: CANVAS_HEIGHT - (caughtRings.length * 12) - 30 });
          }
          return false;
        }

        if (ring.y > CANVAS_HEIGHT) {
          if (ring.points > 0) { // 정상 링을 놓치면 라이프 차감
            setLives(prev => { if (prev <= 1) setGameState("GAMEOVER"); return prev - 1; });
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
        ctx.lineWidth = 8;
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
  }, [gameState, score]);

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border-[10px] border-[#fbbf24] relative">
        <div className="p-5 flex justify-between items-center bg-gray-50 border-b-4 border-gray-100">
          <div className="text-left">
            <p className="text-[10px] font-black text-blue-500 tracking-tighter">GOAL: {GOAL_SCORE}</p>
            <p className="text-4xl font-black text-slate-800 leading-none">{score}</p>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: INITIAL_LIVES }).map((_, i) => (
              <span key={i} className={`text-xl ${i < lives ? '' : 'grayscale opacity-20'}`}>❤️</span>
            ))}
          </div>
        </div>

        <div className="relative bg-[#cbd5e1]">
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="w-full h-auto touch-none" />
          
          {gameState !== "PLAYING" && (
            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
              <h2 className="text-[#fbbf24] text-5xl font-black mb-1 italic">PI-RING 2.0</h2>
              <p className="text-white/40 text-[10px] tracking-widest mb-8 uppercase">Grit leads to the Mainnet</p>
              
              <div className="bg-white/5 rounded-3xl p-6 mb-10 w-full text-left border border-white/10">
                <p className="text-white text-sm mb-4">👋 Welcome, <span className="text-[#fbbf24] font-bold">{username}</span></p>
                <div className="space-y-2 text-[11px] text-gray-300">
                  <p>🎯 <span className="text-white font-bold">미션:</span> 2,000점을 달성하여 메인넷에 진입하세요!</p>
                  <p>⚠️ <span className="text-red-400 font-bold">경고:</span> 링을 놓치거나 빨간 링을 잡으면 하트가 깎입니다.</p>
                  <p className="text-blue-300">⚡ 점수가 오를수록 링이 미친 듯이 빨라집니다!</p>
                </div>
                {authError && <p className="mt-4 text-[10px] text-orange-400 animate-pulse text-center">{authError}</p>}
              </div>

              <button onClick={startGame} className="bg-[#fbbf24] text-black text-2xl font-black py-5 px-16 rounded-2xl shadow-lg active:scale-95 transition-all">
                {gameState === "START" ? "MISSION START" : "RETRY"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
