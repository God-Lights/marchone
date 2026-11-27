import { RouteEditor } from "./route/RouteEditor";

export function App() {
  return (
    <main>
      <header>
        <h1>MarchOne</h1>
        <p className="sub">마치가 걸어갈 길을 정해 주세요</p>
      </header>
      <RouteEditor />
    </main>
  );
}
