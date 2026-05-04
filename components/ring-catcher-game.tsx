"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertCircle, Play, RotateCcw, HelpCircle, Heart } from "lucide-react"
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, collection, collectionGroup, query, onSnapshot, increment, where } from 'firebase/firestore';

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 600
const POLE_WIDTH = 8
const POLE_HEIGHT = 350
const RING_OUTER_RADIUS = 40
const RING_INNER_RADIUS = 20
const RING_THICKNESS = 20
const INITIAL_DROP_SPEED = 2
const INITIAL_LIVES = 5
const CATCH_TOLERANCE = 15

interface Ring {
  id: string
  x: number
  y: number
  speed: number
  color: string
  points: number
  caught: boolean
  caughtY: number
}

interface ScoreAnimation {
  id: string
  x: number
  y: number
  points: number
  opacity: number
  offsetY: number
}

interface BombAnimation {
  id: string
  x: number
  y: number
  missCount: number
  opacity: number
  scale: number
}

const RING_TYPES = [
  { color: "#3b82f6", points: 10, weight: 5 }, // Blue
  { color: "#10b981", points: 20, weight: 3 }, // Green
  { color: "#f59e0b", points: 30, weight: 2 }, // Orange
  { color: "#ef4444", points: 40, weight: 1 }, // Red
  { color: "#fbbf24", points: 100, weight: 0.3 }, // Golden
]

export function RingCatcherGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>(0)
  const dropIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastDropTimeRef = useRef<number>(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const bgMusicOscillatorRef = useRef<OscillatorNode | null>(null)
  const bgMusicGainRef = useRef<GainNode | null>(null)

  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [lives, setLives] = useState(INITIAL_LIVES)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [isVictory, setIsVictory] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [poleX, setPoleX] = useState(CANVAS_WIDTH / 2)
  const [rings, setRings] = useState<Ring[]>([])
  const [dropInterval, setDropInterval] = useState(2000)
  const [dropSpeed, setDropSpeed] = useState(INITIAL_DROP_SPEED)
  const [scoreAnimations, setScoreAnimations] = useState<ScoreAnimation[]>([])
  const [bombAnimations, setBombAnimations] = useState<BombAnimation[]>([])
  const [missCount, setMissCount] = useState(0)
  const [caughtCount, setCaughtCount] = useState(0)
  const [lastScoreMilestone, setLastScoreMilestone] = useState(0)
  const [lastCaughtMilestone, setLastCaughtMilestone] = useState(0)
  const [lastMajorScoreMilestone, setLastMajorScoreMilestone] = useState(0)
  const [lastMajorCaughtMilestone, setLastMajorCaughtMilestone] = useState(0)
  const [lastSuperScoreMilestone, setLastSuperScoreMilestone] = useState(0)
  const [lastSuperCaughtMilestone, setLastSuperCaughtMilestone] = useState(0)
  const [totalPlays, setTotalPlays] = useState(0)
  // 89번 줄 근처에 추가
  const [username, setUsername] = useState<string | null>(null);
  // 실시간 접속자 수를 저장할 상태
  const usernameRef = useRef(username);
useEffect(() => { usernameRef.current = username; }, [username]);
const [activeUsers, setActiveUsers] = useState(0);
const [victoryCount, setVictoryCount] = useState(0);

   // --- 1. 사운드 파일 저장소 (useRef) ---
  const soundRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
 // 102번 줄부터 시작
useEffect(() => {
  // --- [로직 A: 나의 누적 승리 횟수 감시] ---
  const actualId = (username && username !== "username" && username !== "null") 
                   ? username 
                   : "lost n found";
                   
  const victoryQuery = collection(db, "game_results", actualId, "victories");
  const unsubscribeVictory = onSnapshot(victoryQuery, (snapshot) => {
    setVictoryCount(snapshot.size);
  });

  // --- [로직 B: 최근 24시간 접속자 수 감시] ---
  // 모든 유저의 'history' 컬렉션을 한꺼번에 훑습니다.
  const activeUsersQuery = query(
    collectionGroup(db, "history"),
    where("updatedAt", ">=", new Date(Date.now() - 24 * 60 * 60 * 1000))
  );

  const unsubscribeActive = onSnapshot(activeUsersQuery, (snapshot) => {
    const uniqueUsers = new Set();
    snapshot.forEach((doc) => {
      uniqueUsers.add(doc.data().username); // history에 저장된 유저명 기준 중복 제거
    });
    setActiveUsers(uniqueUsers.size);
  });

  // 클린업: 페이지를 나갈 때 감시를 종료합니다.
  return () => {
    if (unsubscribeVictory) unsubscribeVictory();
    if (unsubscribeActive) unsubscribeActive();
  };
}, [username]); // 118번 줄 끝


const handleSaveScore = async ({ score, username }: { score: number; username: string }) => {
  // 1. 아이디 결정 (우선순위: 전달받은 이름 > Ref 이름 > 기본값)
  let actualId = username || usernameRef.current || "Pioneer";
  
  // 만약 시스템 기본값들이 들어왔다면 강제로 Pioneer로 변경
  if (actualId === "username" || actualId === "null" || !actualId) {
    actualId = "Pioneer";
  }

  console.log(`🚀 [저장 시작] 대상: ${actualId}, 점수: ${score}`);

  try {
    // 2. 모든 플레이 기록 저장 (history)
    const historyRef = doc(collection(db, "game_results", actualId, "history"));
    await setDoc(historyRef, {
      username: actualId,
      score: Number(score),
      updatedAt: serverTimestamp()
    });

    // 3. 승리 기록 저장 (2000점 이상)
    if (Number(score) >= 2000) {
      console.log("🏆 승리 데이터 전송 중...");
      const victoryLogRef = doc(collection(db, "game_results", actualId, "victories"));
      await setDoc(victoryLogRef, {
        wonAt: serverTimestamp(),
        score: Number(score),
        username: actualId
      });
      
      // ✅ 이 알림창이 떠야 백엔드 전송이 성공한 것입니다!
      alert(`🎉 승리가 기록되었습니다! (ID: ${actualId})`);
    }
  } catch (e) {
    console.error("❌ 전송 실패:", e);
    alert("데이터 저장 중 오류가 발생했습니다.");
  }
};

   const handleDonation = () => {
    // 1. 함수 실행 확인용 알림
    alert("기부 버튼 클릭됨!");

    const piWindow = window as any; // 타입 검사 우회를 위해 임시 변수 사용

    if (!piWindow.Pi) {
      alert("파이 브라우저에서 접속해주세요.");
      return;
    }

    const paymentData = {
      amount: 0.1,
      memo: "커피 한 잔 기부하기 (0.1 Pi)",
      metadata: { developer: "levelup25" }
    };

    try {
      alert("결제 창을 요청합니다...");
      // piWindow.Pi를 사용하여 타입스크립트 에러 방지
      piWindow.Pi.createPayment(paymentData, {
        onReadyForServerApproval: (id: string) => {
          alert("서버 승인 대기 중... ID: " + id);
        },
        onReadyForServerCompletion: (id: string, tx: string) => {
          alert("감사합니다! 커피 맛있게 마실게요! ☕");
        },
        onCancel: (id: string) => {
          alert("결제가 취소되었습니다.");
        },
        onError: (err: any, id?: string) => {
          alert("결제 에러 발생: " + JSON.stringify(err));
        },
      });
    } catch (err: any) {
      alert("함수 호출 실패: " + JSON.stringify(err));
    }
  };


   useEffect(() => {
      const initPi = async () => {
      if (typeof window !== 'undefined' && (window as any).Pi) {
        const Pi = (window as any).Pi;
        try {
          // 1. 초기화 실행
          await Pi.init({ version: "2.0", sandbox: true });
          console.log("파이 SDK 초기화 완료");

          // 2. 인증 시도
          Pi.authenticate(['username'], (onIncompletePaymentFound: any) => {})
            .then((auth: any) => {
              setUsername(auth.user.username);
              console.log("로그인 성공:", auth.user.username);
            })
            .catch((err: any) => {
              console.error("인증 실패:", err);
              alert("인증 에러가 발생했습니다: " + JSON.stringify(err));
            });
        } catch (err: any) {
          console.error("초기화 중 오류 발생:", err);
          alert("초기화 에러가 발생했습니다: " + JSON.stringify(err));
        }
      }
    };

    initPi();
  }, []);
  
  // --- 2. 사운드 미리 로드 및 에러 탐지 (useEffect) ---
  useEffect(() => {
    const soundNames = ['catch', 'fever', 'bomb', 'winner', 'gameover'];
    soundNames.forEach(name => {
      const audio = new Audio(`/sounds/${name}.mp3?v=1`);
      audio.preload = 'auto';
      
      // 파일 로드 실패 시 콘솔에 구체적인 에러를 찍어줍니다.
      audio.onerror = () => {
        console.error(`🚨 사운드 로드 실패: /sounds/${name}.mp3 (파일명/확장자/대소문자 확인 필요)`);
      };

      soundRefs.current[name] = audio;
    });
  }, []);

  // --- 3. 실제 재생 함수 (playSound) 황금 밸런스 버전 ---
  const playSound = useCallback((name: string) => {
    const audio = soundRefs.current[name];
    if (audio) {
      audio.pause();       
      audio.currentTime = 0; // 재생 위치 초기화

      // 🔊 사운드별 맞춤 볼륨 설정 (사용자님의 우려를 반영한 믹싱)
      if (name === 'catch') {
        audio.volume = 0.7; // 캐치음은 너무 크지 않게 (70%)
      } else if (name === 'winner' || name === 'fever') {
        audio.volume = 1.0; // 승리/피버음은 가장 웅장하게 (100%)
      } else if (name === 'bomb' || name === 'gameover') {
        audio.volume = 0.9; // 경고음은 명확하게 (90%)
      } else {
        audio.volume = 0.8; // 기타 기본값
      }

      audio.play().catch(e => console.log(`${name} 재생 실패:`, e));
    }
  }, []);
  // --- 점수 저장 로직 ---
  const saveScoreToFirebase = async (finalScore: number) => {
    try {
      await setDoc(doc(db, "game_results", "username"), {
        score: finalScore,
        updatedAt: serverTimestamp(),
        appName: "Pioneer-dream"
      }, { merge: true });
      console.log("점수가 성공적으로 서버에 저장되었습니다!");
    } catch (e) {
      console.error("저장 실패:", e);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      const savedPlays = localStorage.getItem("ringCatcherTotalPlays")
      if (savedPlays) {
        setTotalPlays(Number.parseInt(savedPlays, 10))
      }
    }
  }, [])
// 게임 종료(isGameOver)가 true가 되는 순간, 딱 한 번만 점수를 저장합니다.

useEffect(() => {
  if (isGameOver && score > 0) {
    handleSaveScore({ score, username: usernameRef.current });
  }
}, [isGameOver, score]); 

    // --- BGM 준비 및 중지 로직 ---
  const [bgmAudio] = useState(typeof Audio !== 'undefined' ? new Audio('/sounds/bgm.mp3') : null);

  const startBackgroundMusic = useCallback(() => {
    if (bgmAudio) {
      bgmAudio.loop = true;
      bgmAudio.volume = 0.3; 
      bgmAudio.currentTime = 0;
      bgmAudio.play().catch(() => {
       // 151번 줄 근처 수정
const playOnAction = () => {
  bgmAudio.play(); // 1. 배경음악 시작

  // 2. 효과음 엔진 강제 잠금 해제 (이게 추가되어야 합니다!)
  const soundNames = ['catch', 'fever', 'bomb', 'winner', 'gameover'];
  soundNames.forEach(name => {
    const audio = soundRefs.current[name];
    if (audio) {
      // 아주 짧게 재생했다가 멈춰서 브라우저에게 "이 소리 쓸 거야"라고 알려줌
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => {});
    }
  });

  window.removeEventListener('click', playOnAction);
};
window.addEventListener('click', playOnAction);
      });
    }
  }, [bgmAudio]);

  const stopBackgroundMusic = useCallback(() => {
    if (bgmAudio) {
      bgmAudio.pause();
    }
  }, [bgmAudio]);

 // --- 130번 줄 다음에 추가 시작 ---
   const handleLogin = useCallback(async () => {
    if (typeof window !== 'undefined' && window.Pi) {
      try {
        const scopes = ['username'];
        // 에러 원인이었던 두 번째 인자(callback)를 완전히 제거했습니다.
        const auth = await window.Pi.authenticate(scopes);
        
        if (auth && auth.user) {
          setUsername(auth.user.username);
        }
      } catch (err) {
        console.error(err);
        alert("파이 브라우저에서 접속하거나 로그인을 승인해주세요.");
      }
    }
  }, []);

  // --- 추가 끝 ---
  // 기존 코드들과의 호환성을 위해 남겨두는 별칭 함수
  const playCatchSound = useCallback(() => playSound('catch'), [playSound]);
  const addScoreAnimation = useCallback((x: number, y: number, points: number) => {
    const animation: ScoreAnimation = {
      id: `score-${Date.now()}-${Math.random()}`,
      x,
      y,
      points,
      opacity: 1,
      offsetY: 0,
    }
    setScoreAnimations((prev) => [...prev, animation])

    setTimeout(() => {
      setScoreAnimations((prev) => prev.filter((a) => a.id !== animation.id));
    }, 1000);
  }, [])

  const addBombAnimation = useCallback((x: number, y: number, missCount: number) => {
    const animation: BombAnimation = {
      id: `bomb-${Date.now()}-${Math.random()}`,
      x,
      y,
      missCount,
      opacity: 1,
      scale: 0.5,
    }
    setBombAnimations((prev) => [...prev, animation])

    setTimeout(() => {
      setBombAnimations((prev) => prev.filter((a) => a.id !== animation.id))
    }, 1500)
  }, [])

  const generateRingType = useCallback(() => {
    const totalWeight = RING_TYPES.reduce((sum, type) => sum + type.weight, 0)
    let random = Math.random() * totalWeight

    for (const type of RING_TYPES) {
      random -= type.weight
      if (random <= 0) {
        return type
      }
    }

    return RING_TYPES[0]
  }, [])

  const dropRing = useCallback(() => {
    const ringType = generateRingType()
    const x = Math.random() * (CANVAS_WIDTH - RING_OUTER_RADIUS * 2) + RING_OUTER_RADIUS

    const newRing: Ring = {
      id: `ring-${Date.now()}-${Math.random()}`,
      x,
      y: -RING_OUTER_RADIUS,
      speed: dropSpeed + Math.random() * 0.5,
      color: ringType.color,
      points: ringType.points,
      caught: false,
      caughtY: 0,
    }

    setRings((prev) => [...prev, newRing])
  }, [generateRingType, dropSpeed])

  const movePole = useCallback(
    (clientX: number) => {
      if (!isPlaying || isGameOver || !canvasRef.current) return

      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const clampedX = Math.max(POLE_WIDTH / 2, Math.min(CANVAS_WIDTH - POLE_WIDTH / 2, x))

      setPoleX(clampedX)
    },
    [isPlaying, isGameOver],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      movePole(e.clientX)
    },
    [movePole],
  )

  const gameLoop = useCallback(() => {
    if (!canvasRef.current || !isPlaying) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    setRings((prevRings) => {
      const updatedRings = prevRings.map((ring) => {
        if (ring.caught) {
          return ring
        }

        const newY = ring.y + ring.speed

        const poleTopY = CANVAS_HEIGHT - POLE_HEIGHT
        if (newY >= poleTopY - RING_OUTER_RADIUS && newY <= poleTopY + CATCH_TOLERANCE) {
          const distance = Math.abs(ring.x - poleX)
          if (distance <= CATCH_TOLERANCE) {
               // --- 236번 줄부터 시작 ---
        const caughtRings = prevRings.filter((r) => r.caught);
        const newCaughtY = poleTopY + caughtRings.length * RING_THICKNESS;
        const newScore = score + ring.points;
        const newCaughtCount = caughtCount + 1;

            // [최종 승리 체크] 2000점 또는 100개
    if (newScore >= 2000 || newCaughtCount >= 100) {
      stopBackgroundMusic();
      playSound('winner'); // 승리 사운드 즉시 재생
      
      setIsVictory(true);
      setIsGameOver(false);
      saveScoreToFirebase(newScore);

      // 💡 사운드가 끊기지 않도록 게임 정지(상태변경)를 0.15초만 늦춥니다.
      setTimeout(() => {
        setIsPlaying(false);
      }, 150);
    }

        // [Fever 보너스 체크] 500/1000/1500점 또는 25/50/75개
        else if (
          (newScore > 0 && [500, 1000, 1500].includes(newScore)) || 
          (newCaughtCount > 0 && [25, 50, 75].includes(newCaughtCount))
        ) {
          playSound('fever');
        } 
        // [일반 성공]
        else {
          playSound('catch');
        }

        setScore(newScore);
        setCaughtCount(newCaughtCount);
        addScoreAnimation(poleX, poleTopY - 50, ring.points);
        
        return { ...ring, caught: true, caughtY: newCaughtY };
        // --- 242번 줄(기존 return 부분)에서 끝 ---
          }
        }

        if (newY > CANVAS_HEIGHT + RING_OUTER_RADIUS) {
          setMissCount((count) => {
            const newCount = count + 1
            playSound('bomb');
            addBombAnimation(ring.x, CANVAS_HEIGHT - 50, newCount)
            return newCount
          })

          setLives((l) => {
            const newLives = l - 1
            if (newLives <= 0) {
              stopBackgroundMusic();
              playSound('gameover');
              setIsGameOver(true);
              setIsPlaying(false);
            
            }
            return newLives
          })
          return null
        }

        return { ...ring, y: newY }
      })

      return updatedRings.filter((ring) => ring !== null) as Ring[]
    })

    setScoreAnimations((prev) =>
      prev.map((anim) => ({
        ...anim,
        opacity: anim.opacity - 0.02,
        offsetY: anim.offsetY - 2,
      })),
    )

    setBombAnimations((prev) =>
      prev.map((anim) => ({
        ...anim,
        opacity: anim.opacity - 0.015,
        scale: Math.min(anim.scale + 0.03, 1.5),
      })),
    )

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    gradient.addColorStop(0, "#87ceeb")
    gradient.addColorStop(0.5, "#b0d8f0")
    gradient.addColorStop(1, "#e0f2ff")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    const poleTopY = CANVAS_HEIGHT - POLE_HEIGHT
    ctx.fillStyle = "#94a3b8"
    ctx.strokeStyle = "#64748b"
    ctx.lineWidth = 2

    ctx.fillRect(poleX - POLE_WIDTH / 2, poleTopY, POLE_WIDTH, POLE_HEIGHT)
    ctx.strokeRect(poleX - POLE_WIDTH / 2, poleTopY, POLE_WIDTH, POLE_HEIGHT)

    ctx.fillStyle = "#fbbf24"
    ctx.strokeStyle = "#f59e0b"
    ctx.beginPath()
    ctx.moveTo(poleX, poleTopY - 20)
    ctx.lineTo(poleX - 15, poleTopY)
    ctx.lineTo(poleX + 15, poleTopY)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    rings.forEach((ring) => {
      ctx.save()

      const displayY = ring.caught ? ring.caughtY : ring.y

      ctx.fillStyle = ring.color
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(ring.caught ? poleX : ring.x, displayY, RING_OUTER_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)"
      ctx.beginPath()
      ctx.arc(ring.caught ? poleX : ring.x, displayY, RING_INNER_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
      ctx.beginPath()
      ctx.arc(ring.caught ? poleX : ring.x, displayY - 10, RING_OUTER_RADIUS / 3, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = "#000000"
      ctx.font = "bold 24px Arial"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("π", ring.caught ? poleX : ring.x, displayY)

      if (ring.color === "#fbbf24") {
        ctx.fillStyle = "#000000"
        ctx.font = "bold 12px Arial"
        ctx.fillText("★", ring.caught ? poleX : ring.x, displayY - 15)
      }

      ctx.restore()
    })

    scoreAnimations.forEach((anim) => {
      ctx.save()
      ctx.globalAlpha = anim.opacity
      ctx.fillStyle = "#fbbf24"
      ctx.strokeStyle = "#000"
      ctx.lineWidth = 3
      ctx.font = "bold 24px Arial"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      const displayY = anim.y + anim.offsetY
      ctx.strokeText(`+${anim.points}`, anim.x, displayY)
      ctx.fillText(`+${anim.points}`, anim.x, displayY)
      ctx.restore()
    })

    bombAnimations.forEach((anim) => {
      ctx.save()
      ctx.globalAlpha = anim.opacity
      ctx.translate(anim.x, anim.y)
      ctx.scale(anim.scale, anim.scale)

      ctx.fillStyle = "#ff0000"
      ctx.strokeStyle = "#8b0000"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, 30, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.strokeStyle = "#ff4500"
      ctx.lineWidth = 4
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4
        const startX = Math.cos(angle) * 30
        const startY = Math.sin(angle) * 30
        const endX = Math.cos(angle) * 50
        const endY = Math.sin(angle) * 50
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()
      }

      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 28px Arial"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(anim.missCount.toString(), 0, 0)

      ctx.restore()
    })

    animationFrameRef.current = requestAnimationFrame(gameLoop)
  }, [isPlaying, rings, poleX, scoreAnimations, bombAnimations, playCatchSound, addScoreAnimation, addBombAnimation])

  useEffect(() => {
    if (isPlaying) {
      gameLoop()
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, gameLoop])

  useEffect(() => {
    if (isPlaying && !isGameOver) {
      dropIntervalRef.current = setInterval(() => {
        dropRing()
      }, dropInterval)

      return () => {
        if (dropIntervalRef.current) {
          clearInterval(dropIntervalRef.current)
        }
      }
    }
  }, [isPlaying, isGameOver, dropRing, dropInterval])

  useEffect(() => {
    if (isPlaying && !isGameOver) {
      const difficultyInterval = setInterval(() => {
        setDropSpeed((speed) => Math.min(speed + 0.2, 8))
        setDropInterval((interval) => Math.max(interval - 100, 800))
      }, 10000)

      return () => clearInterval(difficultyInterval)
    }
  }, [isPlaying, isGameOver])

  useEffect(() => {
    const currentMilestone = Math.floor(score / 500)
    if (currentMilestone > lastScoreMilestone && score > 0) {
      setMissCount((prevMiss) => Math.max(0, prevMiss - 2))
      setLives((prevLives) => Math.min(INITIAL_LIVES, prevLives + 2))
      setLastScoreMilestone(currentMilestone)
      addScoreAnimation(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0)
    }
  }, [score, lastScoreMilestone, addScoreAnimation])

  useEffect(() => {
    const currentMilestone = Math.floor(caughtCount / 25)
    if (currentMilestone > lastCaughtMilestone && caughtCount > 0) {
      setMissCount((prevMiss) => Math.max(0, prevMiss - 2))
      setLives((prevLives) => Math.min(INITIAL_LIVES, prevLives + 2))
      setLastCaughtMilestone(currentMilestone)
      addScoreAnimation(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40, 0)
    }
  }, [caughtCount, lastCaughtMilestone, addScoreAnimation])

  useEffect(() => {
    const currentMajorMilestone = Math.floor(score / 1000)
    if (currentMajorMilestone > lastMajorScoreMilestone && score > 0 && score >= 1000) {
      setMissCount(0)
      setLives(INITIAL_LIVES)
      setLastMajorScoreMilestone(currentMajorMilestone)
      addScoreAnimation(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3, 0)
    }
  }, [score, lastMajorScoreMilestone, addScoreAnimation])

  useEffect(() => {
    const currentMajorMilestone = Math.floor(caughtCount / 50)
    if (currentMajorMilestone > lastMajorCaughtMilestone && caughtCount > 0 && caughtCount >= 50) {
      setMissCount(0)
      setLives(INITIAL_LIVES)
      setLastMajorCaughtMilestone(currentMajorMilestone)
      addScoreAnimation(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3 + 40, 0)
    }
  }, [caughtCount, lastMajorCaughtMilestone, addScoreAnimation])

  useEffect(() => {
    const currentSuperMilestone = Math.floor(score / 1500)
    if (currentSuperMilestone > lastSuperScoreMilestone && score > 0 && score >= 1500) {
      setMissCount(0)
      setLives(INITIAL_LIVES)
      setRings((prevRings) => prevRings.filter((r) => r.caught))
      setLastSuperScoreMilestone(currentSuperMilestone)
      addScoreAnimation(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 4, 0)
    }
  }, [score, lastSuperScoreMilestone, addScoreAnimation])

  useEffect(() => {
    const currentSuperMilestone = Math.floor(caughtCount / 75)
    if (currentSuperMilestone > lastSuperCaughtMilestone && caughtCount > 0 && caughtCount >= 75) {
      setMissCount(0)
      setLives(INITIAL_LIVES)
      setRings((prevRings) => prevRings.filter((r) => r.caught))
      setLastSuperCaughtMilestone(currentSuperMilestone)
      addScoreAnimation(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 4 + 40, 0)
    }
  }, [caughtCount, lastSuperCaughtMilestone, addScoreAnimation])

  useEffect(() => {
    if ((score >= 2000 || caughtCount >= 100) && usernameRef.current) {
      setIsVictory(true)
      handleSaveScore({ score: score >= 2000 ? score : 2000, username: usernameRef.current });
      setIsPlaying(false)
      stopBackgroundMusic()
      if (dropIntervalRef.current) {
        clearInterval(dropIntervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (score > highScore) {
        setHighScore(score)
      }
    }
  }, [score, caughtCount, isPlaying, highScore, stopBackgroundMusic, username])

  const startGame = useCallback(() => {
    setScore(0)
    setLives(INITIAL_LIVES)
    setIsGameOver(false)
    setIsVictory(false)
    setIsPlaying(true)
    setPoleX(CANVAS_WIDTH / 2)
    setRings([])
    setDropSpeed(INITIAL_DROP_SPEED)
    setDropInterval(2000)
    setScoreAnimations([])
    setBombAnimations([])
    setMissCount(0)
    setCaughtCount(0)
    setLastScoreMilestone(0)
    setLastCaughtMilestone(0)
    setLastMajorScoreMilestone(0)
    setLastMajorCaughtMilestone(0)
    setLastSuperScoreMilestone(0)
    setLastSuperCaughtMilestone(0)
    setTotalPlays((prev) => {
      const newTotal = prev + 1
      if (typeof window !== "undefined") {
        localStorage.setItem("ringCatcherTotalPlays", newTotal.toString())
      }
      return newTotal
    })
    startBackgroundMusic()
    dropRing()
  }, [dropRing, startBackgroundMusic])

  const stopGame = useCallback(() => {
    setIsPlaying(false)
    stopBackgroundMusic()
    if (dropIntervalRef.current) {
      clearInterval(dropIntervalRef.current)
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (score > highScore) {
      setHighScore(score)
    }
  }, [score, highScore, stopBackgroundMusic])

  const openGuide = useCallback(() => {
    setShowGuide(true)
    if (isPlaying) {
      setIsPlaying(false)
      stopBackgroundMusic()
    }
  }, [isPlaying, stopBackgroundMusic])

  const resumeGame = useCallback(() => {
    setShowGuide(false)
    if (!isGameOver && rings.length > 0) {
      setIsPlaying(true)
      startBackgroundMusic()
    }
  }, [isGameOver, rings.length, startBackgroundMusic])

  useEffect(() => {
    return () => {
      stopBackgroundMusic()
      if (dropIntervalRef.current) {
        clearInterval(dropIntervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [stopBackgroundMusic])
useEffect(() => {
  // 브라우저 환경이고 파이 SDK가 로드되었다면 실행
  if (typeof window !== 'undefined' && window.Pi) {
    try {
      // 시스템에 '나 지금 접속 중이야'라고 미리 알리는 과정 (아이디어 1번)
      window.Pi.init({ version: "2.0", sandbox: false });
      console.log("Pi SDK 초기화 성공!");
    } catch (e) {
      console.error("Pi SDK 초기화 실패:", e);
    }
  }
}, []); // 앱이 처음 켜질 때 딱 한 번 실행
  return (
    <div className="flex flex-col items-center gap-6">
      {/* ☕ 개발자 기부 버튼 (로그인 버튼 위) */}
<div className="flex justify-center mb-2">
  <button 
    onClick={handleDonation}
    className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold py-2 px-6 rounded-full shadow-md transition-all active:scale-95 text-sm"
  >
    ☕ 커피 한 잔 기부하기 (0.1 Pi)
  </button>
</div>
      {/* 1. 상단 정보 영역 (접속자 수 & 로그인 버튼) */}
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        
        {/* 로그인 버튼 */}
        <div className="flex justify-center">
          {!username ? (
            <button 
              onClick={handleLogin}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-2xl hover:scale-105 transition-transform"
            >
              💜 파이 네트워크로 로그인
            </button>
          ) : (
            <div className="bg-white/90 backdrop-blur-sm px-6 py-2 rounded-full border border-purple-500/30 shadow-sm">
              <span className="text-slate-600 text-sm font-medium">반가워요! </span>
              <span className="text-purple-600 font-bold">{username}님</span>
              <span>🚀</span>
            </div>
          )}
        </div>

        {/* 접속자 수 표시 */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white/90 rounded-full shadow-md">
          <Heart className="w-4 h-4 text-red-500 fill-red-500" />
          <span className="text-base font-bold text-black">{activeUsers}</span>
          <span className="text-xs text-black">명이 즐기는 중</span>
        </div>
      </div>

      <Card className="p-6 w-full max-w-md">
  <div className="flex justify-between items-center mb-4">
    {/* 왼쪽: 현재 점수 */}
    <div>
      <div className="text-sm text-black/70">점수</div>
      <div className="text-3xl font-bold text-black">{score}</div>
    </div>

    {/* 가운데: 목숨 (기존 하트 유지) */}
    <div className="flex items-center gap-2">
      <Heart className="w-5 h-5 text-red-500" />
      <div className="text-2xl font-semibold text-black">{lives}</div>
    </div>

    {/* 오른쪽: 누적승리 (최고 점수 대체) */}
    <div className="text-right">
      <div className="text-sm text-black/70">누적승리</div>
      <div className="text-2xl font-semibold text-black">{victoryCount}회</div>
    </div>
  </div>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-blue-50 dark:bg-blue-950 p-2 rounded text-center">
            <div className="text-xs text-black/70 mb-1">잡은 고리</div>
            <div className="text-2xl font-bold text-black">{caughtCount}개</div>
          </div>
          <div className="flex-1 bg-purple-50 dark:bg-purple-950 p-2 rounded text-center">
            <div className="text-xs text-black/70 mb-1">쌓인 고리</div>
            <div className="text-2xl font-bold text-black">{rings.filter((r) => r.caught).length}개</div>
          </div>
        </div>

        <div className="mb-4 p-2 bg-green-50 dark:bg-green-950 rounded text-center">
          <div className="text-xs text-black font-semibold">
            💎 보너스: 500점마다 또는 25개 잡을 때마다 실수 2개 차감!
          </div>
          <div className="text-xs text-black font-semibold mt-1">
            🎉 대박 보너스: 1000점 또는 50개 달성 시 실수 완전 초기화!
          </div>
          <div className="text-xs text-black font-semibold mt-1">
            🌟 슈퍼 보너스: 1500점 또는 75개 달성 시 화면 고리 모두 제거!
          </div>
          <div className="text-xs text-black font-semibold mt-1 text-yellow-700">
            🏆 승리 조건: 2000점 또는 100개 달성!
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
              <div className="text-center bg-white/90 p-6 rounded-lg">
                <div className="text-2xl font-bold mb-2 text-black">고리를 잡아보세요!</div>
                <div className="text-sm text-black/80">마우스로 막대를 움직이세요</div>
              </div>
            </div>
          )}

      {isVictory && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-yellow-300/90 to-orange-400/90 backdrop-blur-sm">
              <div className="text-center bg-white/95 p-8 rounded-lg shadow-2xl">
                <div className="text-6xl mb-4">🏆</div>
                <div className="text-4xl font-bold mb-3 text-yellow-600">승리!</div>
                <div className="text-2xl font-bold mb-4 text-black">You are the best pioneer!!</div>
                <div className="text-lg mb-1 text-black">최종 점수: {score}</div>
                <div className="text-sm mb-4 text-black/80">잡은 고리: {caughtCount}개</div>
                <Button onClick={startGame} size="lg" className="gap-2 bg-yellow-600 hover:bg-yellow-700">
                  <RotateCcw className="w-4 h-4" />
                  다시 도전
                </Button>
              </div>
            </div>
          )}

          {isGameOver && !isVictory && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="text-center bg-white/90 p-6 rounded-lg">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                <div className="text-3xl font-bold mb-2 text-black">게임 오버!</div>
                <div className="text-lg mb-1 text-black">최종 점수: {score}</div>
                <div className="text-sm mb-4 text-black/80">잡은 고리: {caughtCount}개</div>
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

          <Button onClick={openGuide} variant="outline" size="lg" className="gap-2 bg-transparent">
            <HelpCircle className="w-4 h-4" />
            도움말
          </Button>
        </div>

        <div className="mt-4 p-3 bg-secondary rounded-lg">
          <div className="text-xs font-semibold mb-2 text-black">고리 점수</div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
              <span className="text-xs text-black">10점</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#10b981" }} />
              <span className="text-xs text-black">20점</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
              <span className="text-xs text-black">30점</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#ef4444" }} />
              <span className="text-xs text-black">40점</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#fbbf24" }} />
              <span className="text-xs font-bold text-black">100점 ★</span>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl text-black">링 캐처 게임 가이드</DialogTitle>
            <DialogDescription className="text-base leading-relaxed pt-4 space-y-4 text-black">
              <div>
                <div className="font-semibold text-black mb-2">게임 목표</div>
                <p className="text-black">
                  하늘에서 떨어지는 다양한 색상의 고리들을 화면 하단의 막대에 정확히 끼워 넣어 높은 점수를 얻으세요!
                </p>
              </div>

              <div>
                <div className="font-semibold text-black mb-2">조작 방법</div>
                <ul className="list-disc list-inside space-y-1 text-black">
                  <li>
                    <strong>막대 이동:</strong> 마우스를 좌우로 움직여 막대를 조종하세요
                  </li>
                  <li>
                    <strong>고리 잡기:</strong> 고리의 중앙 구멍이 막대 끝과 일치하면 성공!
                  </li>
                  <li>
                    <strong>쌓기:</strong> 성공한 고리들은 막대에 차곡차곡 쌓입니다
                  </li>
                </ul>
              </div>

              <div>
                <div className="font-semibold text-black mb-2">점수 시스템</div>
                <ul className="list-disc list-inside space-y-1 text-black">
                  <li>파란색 고리: 10점</li>
                  <li>초록색 고리: 20점</li>
                  <li>주황색 고리: 30점</li>
                  <li>빨간색 고리: 40점</li>
                  <li>황금색 고리 ★: 100점 (보너스!)</li>
                </ul>
              </div>

              <div>
                <div className="font-semibold text-black mb-2">난이도</div>
                <p className="text-black">시간이 지날수록 고리가 떨어지는 속도와 빈도가 증가합니다!</p>
              </div>

              <div>
                <div className="font-semibold text-black mb-2">게임 오버</div>
                <ul className="list-disc list-inside space-y-1 text-black">
                  <li>막대에 끼워지지 못한 고리가 바닥에 닿으면 기회 1개 차감</li>
                  <li>5번의 기회를 모두 소진하면 게임 종료</li>
                  <li>놓친 고리마다 폭탄 💣 애니메이션으로 횟수가 표시됩니다</li>
                </ul>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg">
                <div className="font-semibold text-amber-900 dark:text-amber-100 mb-1">팁</div>
                <p className="text-amber-800 dark:text-amber-200 text-sm">
                  황금색 고리는 희귀하지만 100점의 높은 점수를 줍니다. 놓치지 마세요!
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button onClick={resumeGame} className="flex-1" size="lg">
              게임 복귀
            </Button>
            <Button onClick={() => setShowGuide(false)} variant="outline" className="flex-1" size="lg">
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
