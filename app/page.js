"use client";

import { useEffect, useRef, useState } from "react";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const POLE_WIDTH = 10; 
const POLE_HEIGHT = 380;
const RING_OUTER_RADIUS = 40;
const RING_THICKNESS = 18;
const INITIAL_DROP_SPEED = 3.2; 
const MAX_LIVES = 5; 
const GOAL_SCORE = 2000;

const RING_TYPES = [
  { color: "#3b82f6", points: 10, label: "파랑", weight: 6 },
  { color: "#10b981", points: 30, label: "초록", weight: 3 },
  { color: "#fbbf24", points: 100, label: "노랑", weight: 0.5 },
  { color: "#ef4444", points: -100, label: "빨강(폭탄)", weight: 1.2 }, 
];

export default function RingCatcherGame() {
  const canvasRef = useRef(null);
  // 핵심: rodX를 useRef로 관리하여 리렌더링 시에도 위치 고정
  const rodXRef = useRef(CANVAS_WIDTH / 2); 
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [gameState, setGameState] = useState("START");
  const [username, setUsername] = useState("Pioneer");
  const [authStatus, setAuthStatus] = useState("인증 대기 중...");
  const [lastBonusMilestone, setLastBonusMilestone] = useState(0);
  const [showFever, setShowFever] = useState(false);

  const sounds = useRef({
    bgm: typeof Audio !== "undefined" ? new Audio("/sounds/bgm.mp3") : null,
    catch: typeof Audio !== "undefined" ? new Audio("/sounds/catch.mp3") : null,
    bomb: typeof Audio !== "undefined" ? new Audio("/sounds/bomb.mp3") : null,
    fever: typeof Audio !== "undefined" ? new Audio("/sounds/fever.mp3") : null,
    gameover: typeof Audio !== "undefined" ? new Audio("/sounds/gameover.mp3") : null,
  });

  const playEffect = (type) => {
    const s = sounds.current[type];
    if (s) { s.currentTime = 0; s.play().catch(() => {}); }
  };

     const handleAuth = async () => {
    // 초기 상태를 '확인 중'으로 설정하여 바로 에러가 뜨지 않게 함
    setAuthStatus("인증 확인 중...");

    const checkAndAuth = async (retries = 0) => {
      // 1. window.Pi 객체가 있는지 먼저 확인
      if (typeof window !== "undefined" && window.Pi) {
        try {
          await window.Pi.init({ version: "1.5", sandbox: false });
          const auth = await window.Pi.authenticate(['username'], (error) => {
            console.error("Pi Auth Callback Error:", error);
            setAuthStatus("인증 오류 (재시도 필요)");
          });
          setUsername(auth.user.username);
          setAuthStatus("인증 성공");
        } catch (e) {
          console.error("Pi Init Error:", e);
          setAuthStatus("인증 오류 (재시도 필요)");
        }
      } else if (retries < 20) { 
        // 2. SDK가 없으면 0.5초마다 다시 확인 (최대 10초 대기)
        setTimeout(() => checkAndAuth(retries + 1), 500);
      } else {
        setAuthStatus("인증 오류 (재시도 필요)");
      }
    };

    checkAndAuth();
  };

  useEffect(() => {
    // 페이지 로드 후 1초 뒤에 인증 시작 (브라우저 초기화 시간 확보)
    const timer = setTimeout(() => handleAuth(), 1000);
    return () => clearTimeout(timer);
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

      // 막대 렌더링 (rodXRef를 사용하여 중앙 복귀 원천 차단)
      ctx.fillStyle = "#475569";
      ctx.fillRect(rodXRef.current - POLE_WIDTH / 2, CANVAS_HEIGHT - POLE_HEIGHT, POLE_WIDTH, POLE_HEIGHT);

      const spawnRate = Math.max(18, 75 - Math.floor(score / 200) * 12);
      if (frameCount % spawnRate === 0) {
        const totalWeight = RING_TYPES.reduce((acc, curr) => acc + curr.weight, 0);
        let random = Math.random() * totalWeight;
        let selected = RING_TYPES[0];
        for (const t of RING_TYPES) { if (random < t.weight) { selected = t; break; } random -= t.weight; }
        rings.push({ x: Math.random() * (CANVAS_WIDTH - 100) + 50, y: -50, speed: INITIAL_DROP_SPEED + (score / 300), ...selected });
      }

      rings = rings.filter(ring => {
        ring.y += ring.speed;
        const dist = Math.abs(ring.x - rodXRef.current);
        const hitTop = CANVAS_HEIGHT - POLE_HEIGHT;

        if (dist < 20 && ring.y > hitTop && ring.y < hitTop + 25) {
          if (ring.color === "#ef4444") {
            setScore(prev => Math.max(0, prev + ring.points));
            playEffect('bomb');
          } else {
            setScore(prev => {
              const next = prev + ring.points;
              const currentMilestone = Math.floor(next / 500);
              if (currentMilestone > lastBonusMilestone) {
                setLives(MAX_LIVES);
                setLastBonusMilestone(currentMilestone);
                playEffect('fever');
                setShowFever(true);
                setTimeout(() => setShowFever(false), 2000);
              }
              if (next >= GOAL_SCORE) setGameState("WIN");
              return next;
            });
            playEffect('catch');
            caughtRings.push({ ...ring, caughtY: CANVAS_HEIGHT - (caughtRings.length * 14) - 35 });
          }
          return false;
        }

        if (ring.y > CANVAS_HEIGHT) {
          if (ring.color !== "#ef4444") {
            setLives(prev => {
              if (prev <= 1) { setGameState("GAMEOVER"); playEffect('gameover'); if (sounds.current.bgm) sounds.current.bgm.pause(); }
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
        ctx.arc(rodXRef.current, r.caughtY, RING_OUTER_RADIUS * 0.7, 0, Math.PI * 2);
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
      rodXRef.current = Math.max(30, Math.min(CANVAS_WIDTH - 30, x)); // 위치 실시간 저장
    };

    canvas.addEventListener("mousemove", handleInput);
    canvas.addEventListener("touchmove", handleInput, { passive: false });
    gameLoop();
    return () => { cancelAnimationFrame(animationFrameId); canvas.removeEventListener("mousemove", handleInput); canvas.removeEventListener("touchmove", handleInput); };
  }, [gameState, score, lastBonusMilestone]);

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border-[10px] border-[#fbbf24] relative">
        {/* 상단 헤더 */}
        <div className="p-5 flex justify-between items-center bg-gray-50 border-b-2">
          <div className="text-left">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">Goal: {GOAL_SCORE}</p>
            <p className="text-4xl font-black text-slate-800 leading-none">{score}</p>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <span key={i} className={`text-xl transition-all ${i < lives ? 'scale-110' : 'grayscale opacity-20'}`}>❤️</span>
            ))}
          </div>
        </div>

        <div className="relative bg-[#bae6fd]">
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="w-full h-auto touch-none" />
          
          {showFever && (
            <div className="absolute top-1/4 left-0 w-full text-center animate-bounce">
              <span className="bg-yellow-400 text-black px-4 py-2 rounded-full font-black text-xl border-2 border-white">FEVER! LIFE RECOVERY</span>
            </div>
          )}

          {gameState !== "PLAYING" && (
            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white overflow-y-auto">
              <h2 className="text-[#fbbf24] text-4xl font-black mb-2 italic">PI-RING 2.0</h2>
              <p className="text-[9px] tracking-widest mb-6 opacity-60 uppercase underline underline-offset-4 decoration-[#fbbf24]">Grit leads to the Mainnet</p>
              
              <div className="bg-white/10 rounded-2xl p-4 mb-6 w-full text-left border border-white/10 text-[11px]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                  <p>👋 Welcome, <span className="text-[#fbbf24] font-bold">{username}</span></p>
                  <p className={`text-[9px] px-2 py-0.5 rounded ${authStatus === "인증 성공" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{authStatus}</p>
                </div>

                {/* 링 점수 체계 안내 */}
                <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                  {RING_TYPES.map(t => (
                    <div key={t.label} className="flex flex-col items-center bg-black/20 p-1 rounded">
                      <div className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: t.color }}></div>
                      <p className="font-bold scale-90">{t.points}점</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 opacity-90 leading-tight">
                  <p className="flex gap-2"><span>🎁</span> <span><b className="text-green-400">500점 단위:</b> 하트가 5개로 즉시 완충!</span></p>
                  <p className="flex gap-2"><span>⚠️</span> <span><b className="text-red-400">생명 차감:</b> 링을 놓치면 하트가 깎입니다.</span></p>
                  <p className="flex gap-2"><span>✨</span> <span><b className="text-blue-300">팁:</b> 막대는 손끝을 그대로 따라갑니다.</span></p>
                </div>
              </div>

              <button onClick={startGame} className="bg-[#fbbf24] text-black text-xl font-black py-4 px-12 rounded-xl shadow-lg active:scale-95 transition-all">
                {gameState === "START" ? "START MISSION" : "RETRY MISSION"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
