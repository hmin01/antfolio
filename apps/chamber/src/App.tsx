import { TICK_MS } from '@gaemigul/queen';

export function App() {
  return (
    <main className="min-h-dvh bg-zinc-950 p-6 text-zinc-100">
      <h1 className="text-2xl font-bold">여왕의 방</h1>
      <p className="mt-2 text-zinc-400">
        개미굴 가격 엔진 시뮬레이터 · 틱 간격 {TICK_MS / 1000}초
      </p>
    </main>
  );
}
