'use client';

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

// --- 스타일 정의 ---
const GameStyles = () => (
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Jua&display=swap');
    body { font-family: 'Jua', sans-serif; overflow: hidden; background: #0a0f1e; }
    @keyframes popRing {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.5) rotate(15deg); opacity: 0; filter: blur(2px); }
    }
    .ring-caught { animation: popRing 0.3s ease-out forwards; }
    @keyframes shakeBomb {
      0%, 100% { transform: translate(0, 0); }
      20%, 60% { transform: translate(-5px, 0); }
      40%, 80% { transform: translate(5px, 0); }
    }
    .ring-bomb { animation: shakeBomb 0.5s infinite; background-color: #333 !important; border: 3px solid #ff4444 !important;}
  `}</style>
);

// --- 효과음 함수 ---
const playSound = (type) => {
  const audio = new Audio(`/sounds/${type}.mp3`);
  audio.volume = 0.5;
  audio.play().catch(() => {}); // 브라우저 차단 방지
};

// --- 고리 컴포넌트 ---
const Ring = ({ ring, onCatch }) => {
  const [isCaught, setIsCaught] = useState(false);
  const handleCatch = () => {
    if (isCaught) return;
    setIsCaught(true);
    playSound(ring.isBomb ? 'bomb' : 'catch');
    setTimeout(() => onCatch(ring), 200);
  };
  return (
    <div
      onClick={handleCatch}
      className={`absolute flex items-center justify-center rounded-full cursor-pointer transition-transform ${isCaught ? 'ring-caught' : ''} ${ring.isBomb ? 'ring-bomb' : ''}`}
      style={{ left: ring.x, top: ring.y, width: ring.size, height: ring.size, backgroundColor: ring.color, border: '4px solid rgba(255,255,255,0.6)', boxShadow: `0 0 15px ${ring.color}`, zIndex: 10 }}
    >
      <span className="text-xl font-bold text-white select-none">π</span>
    </div>
  );
};

export default function Game() {
  const [gameState, setGameState] = useState('loading'); // loading -> lobby -> playing -> gameover
  const [user, setUser] = useState(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [rings, setRings] = useState([]);
  const [isFever, setIsFever] = useState(false);
  const [feverCount, setFeverCount] = useState(0);
  const gameAreaRef = useRef(null);
  const bgmRef = useRef(null);

  // --- 1. 파이 SDK 초기화 (메인넷 심사용 핵심) ---
  useEffect(() => {
    const initPi = async () => {
      if (window.Pi) {
        try {
          const scopes = ['username', 'payments'];
          const auth = await window.Pi.authenticate(scopes, (onIncompletePaymentFound) => {
            console.log('Incomplete payment found', onIncompletePaymentFound);
          });
          setUser(auth.user);
          setGameState('lobby');
        } catch (err) {
          console.error('Pi SDK Auth failed', err);
          setGameState('lobby'); // SDK 실패해도 로컬 플레이 가능하게
        }
      } else {
        setGameState('lobby'); // 일반 브라우저 대응
      }
    };
    initPi();
  }, []);

  // --- 2. BGM 제어 ---
  useEffect(() => {
    if (gameState === 'playing') {
      bgmRef.current = new Audio('/sounds/bgm.mp3');
      bgmRef.current.loop = true;
      bgmRef.current.volume = 0.3;
      bgmRef.current.play().catch(() => {});
    } else {
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current = null; }
    }
    return () => { if (bgmRef.current) bgmRef.current.pause(); };
  }, [gameState]);

  // --- 3. 게임 로직 ---
  useEffect(() => {
    if (gameState !== 'playing') return;
    const spawnInterval = setInterval(() => {
      const area = gameAreaRef.current?.getBoundingClientRect();
      if (!area) return;
      const size = Math.random() * 20 + 50;
      const newRing = {
        id: Date.now(),
        x: Math.random() * (area.width - size),
        y: Math.random() * (area.height - size - 120),
        size,
        isBomb: Math.random() < 0.08,
        color: ['#FF5555', '#55FF55', '#5555FF', '#FFFF55'][Math.floor(Math.random() * 4)]
      };
      setRings(prev => [...prev, newRing]);
      setTimeout(() => {
        setRings(prev => {
          const stillThere = prev.find(r => r.id === newRing.id);
          if (stillThere && !newRing.isBomb && gameState === 'playing') {
            setLives(l => {
              if (l <= 1) { setGameState('gameover'); playSound('gameover'); return 0; }
              return l - 1;
            });
          }
          return prev.filter(r => r.id !== newRing.id);
        });
      }, isFever ? 1300 : 2200);
    }, isFever ? 600 : 1100);
    return () => clearInterval(spawnInterval);
  }, [gameState, isFever]);

  const handleCatch = (ring) => {
    if (ring.isBomb) {
      setLives(l => { if (l <= 1) { setGameState('gameover'); playSound('gameover'); return 0; } return l - 1; });
      setFeverCount(0);
    } else {
      setScore(s => s + (isFever ? 50 : 20));
      setFeverCount(prev => {
        if (prev + 1 >= 10 && !isFever) {
          setIsFever(true);
          playSound('fever');
          setTimeout(() => setIsFever(false), 5000);
          return 0;
        }
        return prev + 1;
      });
    }
    setRings(prev => prev.filter(r => r.id !== ring.id));
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white p-4 flex flex-col items-center">
      <Head>
        <title>Ring Catcher Pi v3.0 Super</title>
        <script src="https://sdk.minepi.com/pi-sdk.js" defer></script>
      </Head>
      <GameStyles />

      <header className="w-full max-w-md flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-black text-yellow-400 italic">RING CATCHER</h1>
          {user && <p className="text-[10px] text-sky-400">Pioneer: {user.username}</p>}
        </div>
        <div className="bg-red-600 px-3 py-1 rounded-full text-[10px] font-bold animate-pulse">SUPER v3.0</div>
      </header>

      <main ref={gameAreaRef} className="w-full max-w-md aspect-[3/4] bg-[#1a2333] rounded-3xl border-4 border-[#3a4a6e] relative overflow-hidden shadow-2xl">
        {isFever && <div className="absolute inset-0 bg-yellow-400/10 animate-pulse" />}
        
        <div className="absolute top-4 left-4 right-4 flex justify-between z-20">
          <div className="bg-black/50 p-2 rounded-xl border border-white/10">
            <p className="text-[10px] text-gray-400">SCORE</p>
            <p className="text-xl font-bold">{score}</p>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex gap-1 mb-1">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={`text-xl ${i < lives ? 'grayscale-0' : 'grayscale opacity-30'}`}>❤️</span>
              ))}
            <div className="relative w-full h-full">
          {rings.map(r => <Ring key={r.id} ring={r} onCatch={handleCatch} />)}
        </div>
      </main>

      <footer className="mt-8 text-center text-gray-500 text-[10px]">
        <p>© 2026 RAPAJOCKDH. Built for Pi Network.</p>
        <p className="mt-1 italic">"Grit leads to the Mainnet."</p>
      </footer>
    </div>
  );
}
