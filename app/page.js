"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// --- 게임 설정 상수 (1.0 기준) ---
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const POLE_WIDTH = 8;
const POLE_HEIGHT = 350;
const RING_OUTER_RADIUS = 40;
const RING_INNER_RADIUS = 20;
const RING_THICKNESS = 20;
const INITIAL_DROP_SPEED = 2.5; // 1.0의 속도감 복구
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
  // --- Refs ---
  const canvasRef = useRef(null);
  const animationFrameRef = useRef();
  const dropIntervalRef = useRef();
  const audioRefs = useRef({
    bgm: null,
    catch: null,
    bomb: null,
    fever: null,
    gameover: null
  });

  // --- States ---
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [poleX, setPoleX] = useState(CANVAS_WIDTH / 2);
  const [rings, setRings] = useState([]);
  const [dropSpeed, setDropSpeed] = useState(INITIAL_DROP_SPEED);
  const [username, setUsername] = useState("Pioneer");
  const [realtimeUsers, setRealtimeUsers] = useState(4); // 데모용 유저수

  // --- 사운드 초기화 (사용자 지정 경로 연결) ---
  useEffect(() => {
    const loadSound = (name) => {
      const audio = new Audio(`/sound/${name}.mp3`);
      if (name === 'bgm') audio.loop = true;
      return audio;
    };
    
    audioRefs.current = {
      bgm: loadSound('bgm'),
      catch: loadSound('catch'),
      bomb: loadSound('bomb'),
      fever: loadSound('fever'),
      gameover: loadSound('gameover')
    };

    // 파이 SDK 연동 (AUTH ERROR 방지)
    if (window.Pi) {
      window.Pi.authenticate(['username'], (onIncompletePaymentFound) => {})
        .then((auth) => setUsername(auth.user.username))
        .catch(() => setUsername("Pioneer"));
    }
  }, []);

  const playSound = (name) => {
    const sound = audioRefs.current[name];
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }
  };

  // --- 게임 로직 (1.0 기반) ---
  const dropRing = useCallback(() => {
    const totalWeight = RING_TYPES.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;
    let ringType = RING_TYPES[0];
    for (const t of RING_TYPES) {
      random -= t.weight;
      if (random <= 0) { ringType = t; break; }
    }

    const x = Math.random() * (CANVAS_WIDTH - RING_OUTER_RADIUS * 2) + RING_OUTER_RADIUS;
    const newRing = {
      id: Math.random().toString(),
      x, y: -RING_OUTER_RADIUS,
      speed: dropSpeed + Math.random() * 0.5,
      ...ringType,
      caught: false,
      caughtY: 0
    };
    setRings(prev => [...prev, newRing]);
  }, [dropSpeed]);

  const gameLoop = useCallback(() => {
    if (!canvasRef.current || !isPlaying) return;
    const ctx = canvasRef.current.getContext("2d");

    setRings(prevRings => {
      const updated = prevRings.map(ring => {
        if (ring.caught) return ring;
        const newY = ring.y + ring.speed;
        const poleTopY = CANVAS_HEIGHT - POLE_HEIGHT;

        // 고리 끼우기 판정
        if (newY >= poleTopY - 20 && newY <= poleTopY + CATCH_TOLERANCE) {
          if (Math.abs(ring.x - poleX) <= CATCH_TOLERANCE) {
            playSound('catch');
            setScore(s => s + ring.points);
            const caughtCount = prevRings.filter(r => r.caught).length;
            return { ...ring, y: newY, caught: true, caughtY: poleTopY + (caughtCount * RING_THICKNESS) };
          }
        }

        // 바닥에 닿음 (실패)
        if (newY > CANVAS_HEIGHT + RING_OUTER_RADIUS) {
          playSound('bomb');
          setLives(l => {
            if (l <= 1) {
              setIsGameOver(true);
              setIsPlaying(false);
              playSound('gameover');
              audioRefs.current.bgm.pause();
            }
            return l - 1;
          });
          return null;
        }
        return { ...ring, y: newY };
      }).filter(Boolean);
      return updated;
    });

    // 화면 그리기
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 배경 (1.0 감성)
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, "#87ceeb"); grad.addColorStop(1, "#e0f2ff");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 막대
    const poleTopY = CANVAS_HEIGHT - POLE_HEIGHT;
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(poleX - POLE_WIDTH / 2, poleTopY, POLE_WIDTH, POLE_HEIGHT);

    // 링 그리기
    rings.forEach(ring => {
      const drawY = ring.caught ? ring.caughtY : ring.y;
      const drawX = ring.caught ? poleX : ring.x;
      
      ctx.beginPath();
      ctx.arc(drawX, drawY, RING_OUTER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = ring.color;
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(drawX, drawY, RING_INNER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();

      ctx.fillStyle = "black";
      ctx.font = "bold 20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("π", drawX, drawY + 7);
    });

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, poleX, rings]);

  useEffect(() => {
    if (isPlaying) {
      gameLoop();
      dropIntervalRef.current = setInterval(dropRing, 1500);
      audioRefs.current.bgm.play().catch(() => {});
    }
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      clearInterval(dropIntervalRef.current);
    };
  }, [isPlaying, gameLoop, dropRing]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4 font-sans text-white">
      {/* 상단 유저 정보 (에러 수정판) */}
      <div className="flex items-center gap-3 mb-4 bg-white/10 px-6 py-2 rounded-full border border-white/20">
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        <span className="font-bold">{username}님 포함 {realtimeUsers}명이 도전 중!</span>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-[440px] text-slate-900 border-8 border-yellow-400">
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-xs font-bold text-slate-500">SCORE</p>
            <p className="text-4xl font-black text-blue-600">{score}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-500">LIVES</p>
            <div className="flex gap-1 justify-end">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={`text-2xl ${i < lives ? 'grayscale-0' : 'grayscale'}`}>❤️</span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative rounded-xl overflow-hidden cursor-none touch-none bg-sky-100 border-4 border-slate-200">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerMove={(e) => {
              const rect = canvasRef.current.getBoundingClientRect();
              setPoleX(Math.max(20, Math.min(CANVAS_WIDTH - 20, e.clientX - rect.left)));
            }}
            className="w-full h-auto"
          />

          {!isPlaying && !isGameOver && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
              <button 
                onClick={() => setIsPlaying(true)}
                className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black px-12 py-6 rounded-full text-2xl shadow-xl transform hover:scale-110 transition"
              >
                START GAME
              </button>
            </div>
          )}

          {isGameOver && (
            <div className="absolute inset-0 bg-red-600/90 flex flex-col items-center justify-center p-6 text-center">
              <h2 className="text-5xl font-black text-white mb-2">GAME OVER</h2>
              <p className="text-white/80 mb-6 font-bold">최종 점수: {score}</p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-white text-red-600 font-black px-10 py-4 rounded-full text-xl shadow-xl"
              >
                RETRY
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[10px] font-bold text-slate-400">
          <p>마우스/터치로 막대 조절</p>
          <p>π링을 막대에 끼우세요!</p>
        </div>
      </div>
    </div>
  );
}
