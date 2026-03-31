"use client"

import { RingCatcherGame } from "@/components/ring-catcher-game"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto py-8 px-4">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">PIONEERS!!</h1>
          <p className="text-xl text-slate-300">링 캐처 게임</p>
          <div className="mt-3">
            <span className="inline-block bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg">
              Version 2.0
            </span>
          </div>
        </header>

        <RingCatcherGame />
      </div>
    </div>
  )
}
