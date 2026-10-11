import { TICK_MS } from '@gaemigul/queen';

export function App() {
  return (
    <main className="min-h-dvh bg-zinc-950 p-6 text-zinc-100">
      <h1 className="text-2xl font-bold">개미굴</h1>
      <p className="mt-2 text-zinc-400">잠들지 않는 시장 · {TICK_MS / 1000}초마다 움직입니다</p>
    </main>
  );
}
