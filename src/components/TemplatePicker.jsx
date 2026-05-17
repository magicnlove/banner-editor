import logo from '../assets/logo.png'

const cards = [
  {
    id: 'horizontal',
    title: '가로형 현수막',
    thumbClass: 'h-24 w-64 rounded-lg', // 가로로 긴 직사각형
  },
  {
    id: 'vertical',
    title: '세로형 현수막',
    thumbClass: 'h-64 w-24 rounded-lg', // 세로로 긴 직사각형
  },
]

export function TemplatePicker({ onSelect }) {
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
            <p className="text-sm text-[#5c6370]">시작할 캔버스 크기를 선택하세요</p>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center px-6 py-8 sm:px-12 sm:py-12">
        <div className="flex w-full max-w-[min(100%,56rem)] flex-row flex-wrap items-center justify-center gap-20 sm:gap-24">
          {cards.map(({ id, title, thumbClass }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="flex w-full min-w-0 max-w-[min(25rem,calc(100vw-3rem))] flex-col items-center gap-8 rounded-2xl border border-[#e8eaef] bg-white px-8 py-10 text-center shadow-md transition-colors hover:border-[#FF6600] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF6600] focus-visible:ring-offset-4 sm:w-auto sm:min-w-[25rem] sm:max-w-none sm:px-16 sm:py-12"
            >
              <span
                className={`shrink-0 bg-[#b8bec9] shadow-[inset_0_2px_0_rgb(255_255_255_/0.35)] ${thumbClass}`}
                aria-hidden
              />
              <span className="text-[2rem] font-semibold leading-snug text-[#1a1d24]">
                {title}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
