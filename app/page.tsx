"use client"

import { RingCatcherGame } from "@/components/ring-catcher-game"
// 1. Script 컴포넌트를 불러옵니다.
import Script from 'next/script'

export default function Home() {
  return (
    <>
      {/* 2. 여기에 파이 SDK 스크립트를 추가합니다. */}
      <Script 
        src="https://sdk.minepi.com/pi-sdk.js" 
        strategy="beforeInteractive" 
      />
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto py-8 px-4">
          <header className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">PIONEERS!!</h1>
            <p className="text-xl text-slate-300">링 캐처 게임</p>
            <div className="mt-3">
              <span className="inline-block bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-2 rounded-full font-bold shadow-lg">
                Version 2.0
              </span>
              
            </div>
          </header>

          <RingCatcherGame />
        </div>
      </div>
    </>
  )
}
