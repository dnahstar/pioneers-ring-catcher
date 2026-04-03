"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';

const GameStyles = () => (
  <style jsx global>{`
    @keyframes suck-in { 0% { transform: scale(1); opacity: 1; } 100% { transform: translateY(300px) scale(0.5); opacity: 0; } }
    .suck-animation { animation: suck-in 0.4s ease-in forwards; }
    .pole-glow { box-shadow: 0 0 20px rgba(56, 189, 248, 0.3); }
    @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
    .shake { animation: shake 0.15s ease-in-out; }
  `}</style>
);

export default function Home() {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [gameState, setGameState] = useState('lobby');
  const [rings, setRings] = useState([]);
  const [stackedCount, setStackedCount] = useState(0);
  const [user, setUser] = useState(null);
  const [isShaking, setIsShaking] = useState(false);
  const containerRef = useRef(null);

  // Pi SDK 연동 (아이디 노출용)
  useEffect(() => {
    const initPi = async () => {
      if (typeof window !== 'undefined' && window.Pi) {
        try {
          await window.Pi.init({ version: "2.0", sandbox: false });
          const auth = await window.Pi.authenticate(["username"], (e) => console.error(e));
          setUser(auth.user);
        } catch (e) { console.log("Not in Pi Browser"); }
      }
    };
    initPi();
  }, []);

  const playSound = useCallback((type) => {
    const audio = new Audio(`/sounds/${type}.mp3`);
    audio.play().catch(() => {});
  }, []);

  // 고리 생성: 더 역동적인 움직임
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
      const isBomb = Math.random() < 0.1;
      setRings(prev => [...prev, { id: Date.now(), x: 20 + Math.random() * 60, isBomb, caught: false }]);
    }, 850);
    return () => clearInterval(interval);
  }, [gameState]);

  const handleCatch = (ring) => {
    if (ring.caught) return;
   
    if (ring.isBomb) {
      setLives(l => { if (l <= 1) { setGameState('gameover'); playSound('gameover'); return 0; } return l - 1; });
      playSound('bomb');
    } else {
      // "끼우기" 성공 연출
      setScore(s => s + 50);
      setStackedCount(prev => (prev + 1) % 10);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 150);
      playSound('catch');
     
      setRings(prev => prev.map(r => r.id === ring.id ? { ...r, caught: true } : r));
      setTimeout(() => {
        setRings(prev => prev.filter(r => r.id !== ring.id));
      }, 400);
    }
  };

  return (
    <div className={`min-h-screen bg-[#050814] text-white p-4 flex flex-col items-center select-none font-sans ${isShaking ? 'shake' : ''}`}>
      <GameStyles />
      <header className="w-full max-w-md flex justify-between items-center mb-6 px-2">
        <div>
          <h1 className="text-2xl font-black text-yellow-400 italic leading-none tracking-tighter text-shadow-lg">RING CATCHER</h1>
          <p className="text-[11px] text-sky-400 font-bold mt-1">
            {user ? `PIONEER: ${user.username}` : "GUEST MODE"}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex gap-1 mb-1">
            {[...Array(5)].map((_, i) => (
              <span key={i} className={`text-lg ${i < lives ? 'animate-pulse' : 'grayscale opacity-20'}`}>❤️</span>
            ))}
          </div>
          <p className="text-3xl font-black text-white leading-none">{score}</p>
        </div>
      </header>

      <main ref={containerRef} className="w-full max-w-md aspect-[3/4.5] bg-gradient-to-b from-[#111827] to-[#0a0f1e] rounded-[3rem] border-[8px] border-[#1e293b] relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        {/* 오리지널 막대(Pole) 복원 */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-[80%] bg-gradient-to-r from-gray-700 via-gray-500 to-gray-700 rounded-t-full border-t-4 border-white/20 pole-glow" />
       
        {/* 끼워진 고리 시각화 */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col-reverse items-center">
          {[...Array(stackedCount)].map((_, i) => (
            <div key={i} className="w-24 h-6 border-4 border-yellow-400 bg-yellow-500/30 rounded-full mb-[-4px] shadow-lg" />
          ))}
        </div>

        {gameState === 'lobby' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050814]/90 backdrop-blur-md p-10">
            <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(250,204,21,0.5)]">
              <span className="text-5xl">π</span>
            </div>
            <h2 className="text-3xl font-black mb-2 italic">MISSION: MAINNET</h2>
            <p className="text-gray-400 text-sm mb-10">막대에 고리를 정확히 끼워 점수를 올리세요!</p>
            <button onClick={() => { setScore(0); setLives(5); setStackedCount(0); setGameState('playing'); playSound('start'); }}
              className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-black py-5 rounded-2xl font-black text-2xl shadow-[0_8px_0_#854d0e] active:translate-y-2 active:shadow-none transition-all uppercase">Start Mission</button>
          </div>
        )}

        {/* 게임오버 생략 (동일 로직) */}

        <div className="relative w-full h-full">
          {rings.map(r => (
            <div key={r.id} onClick={() => handleCatch(r)}
              className={`absolute cursor-pointer flex items-center justify-center rounded-full border-[6px] shadow-2xl transition-all ${r.caught ? 'suck-animation' : 'ring-fall active:scale-90'} ${r.isBomb ? 'border-red-500 bg-red-900/60' : 'border-sky-400 bg-sky-500/20'}`}
              style={{ left: `${r.x}%`, width: '75px', height: '75px' }}>
              <span className="text-3xl font-black">{r.isBomb ? '💣' : 'π'}</span>
            </div>
          ))}
        </div>
      </main>

      <footer className="mt-8 text-center opacity-50">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase">© 2026 RAPAJOCKDH • MAINNET PIONEER</p>
        <p className="text-[9px] italic mt-1 text-sky-400">"Grit leads to the Mainnet."</p>
      </footer>
    </div>
  );
}
