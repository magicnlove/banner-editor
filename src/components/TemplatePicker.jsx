import { useState } from 'react'
import logo from '../assets/logo.png'
import { cmInputToPx } from '../lib/units'

const HANWHA_CARDS = [
  {
    id: 'horizontal',
    title: '가로형 현수막',
    thumbClass: 'h-24 w-64 rounded-lg',
  },
  {
    id: 'vertical',
    title: '세로형 현수막 / 배너',
    thumbClass: 'h-64 w-24 rounded-lg',
  },
]

const FREE_DEFAULT_W_CM = '30'
const FREE_DEFAULT_H_CM = '20'
const FREE_MIN_CM = 1
const FREE_MAX_CM = 200

export function TemplatePicker({ onSelect }) {
  const [freeW, setFreeW] = useState(FREE_DEFAULT_W_CM)
  const [freeH, setFreeH] = useState(FREE_DEFAULT_H_CM)

  const startFree = () => {
    const wCm = Math.min(FREE_MAX_CM, Math.max(FREE_MIN_CM, Number.parseFloat(freeW) || FREE_MIN_CM))
    const hCm = Math.min(FREE_MAX_CM, Math.max(FREE_MIN_CM, Number.parseFloat(freeH) || FREE_MIN_CM))
    const widthPx = cmInputToPx(String(wCm))
    const heightPx = cmInputToPx(String(hCm))
    if (!widthPx || !heightPx) return
    onSelect({ type: 'free', widthPx, heightPx })
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f6f7f9]">
      <header className="border-b border-[#e8eaef] bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <img
            src={logo}
            alt=""
            className="h-9 w-auto rounded-lg shadow-sm"
            width={200}
            height={48}
          />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[#1a1d24]">
              한화투자증권 현수막 생성기
            </h1>
            <p className="text-sm text-[#5c6370]">시작할 캔버스를 선택하세요</p>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 justify-center overflow-auto px-6 py-10 sm:px-12">
        <div className="flex w-full max-w-4xl flex-col gap-12">
          <section className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-[#1a1d24]">한화투자증권 양식</h2>
              <p className="mt-1 text-sm text-[#5c6370]">공식 현수막 템플릿으로 시작합니다</p>
            </div>
            <div className="flex flex-wrap items-stretch justify-center gap-8 sm:gap-12">
              {HANWHA_CARDS.map(({ id, title, thumbClass }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelect({ type: 'template', templateKey: id })}
                  className="flex w-full min-w-0 max-w-[min(22rem,calc(100vw-3rem))] flex-col items-center gap-6 rounded-2xl border border-[#e8eaef] bg-white px-8 py-8 text-center shadow-md transition-colors hover:border-[#FF6600] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF6600] focus-visible:ring-offset-4 sm:w-auto sm:min-w-[18rem]"
                >
                  <span
                    className={`shrink-0 bg-[#b8bec9] shadow-[inset_0_2px_0_rgb(255_255_255_/0.35)] ${thumbClass}`}
                    aria-hidden
                  />
                  <span className="text-xl font-semibold leading-snug text-[#1a1d24]">{title}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-5 border-t border-[#e8eaef] pt-10">
            <div>
              <h2 className="text-base font-semibold text-[#1a1d24]">자유형</h2>
              <p className="mt-1 text-sm text-[#5c6370]">
                원하는 크기(cm)로 빈 캔버스에서 시작합니다
              </p>
            </div>
            <div className="mx-auto max-w-md rounded-2xl border border-[#e8eaef] bg-white p-6 shadow-md">
              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs font-medium text-[#5c6370]">
                  가로 (cm)
                  <input
                    type="number"
                    min={FREE_MIN_CM}
                    max={FREE_MAX_CM}
                    step={0.1}
                    value={freeW}
                    onChange={(e) => setFreeW(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#e8eaef] px-3 py-2.5 text-sm tabular-nums"
                  />
                </label>
                <label className="text-xs font-medium text-[#5c6370]">
                  세로 (cm)
                  <input
                    type="number"
                    min={FREE_MIN_CM}
                    max={FREE_MAX_CM}
                    step={0.1}
                    value={freeH}
                    onChange={(e) => setFreeH(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#e8eaef] px-3 py-2.5 text-sm tabular-nums"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={startFree}
                className="mt-5 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF6600] focus-visible:ring-offset-2"
              >
                시작하기
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}