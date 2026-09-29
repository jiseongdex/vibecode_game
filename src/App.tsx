import { GameScreen } from './components/GameScreen/GameScreen'

export function App() {
  return (
    <main>
      <header>
        <p>20개의 미로, 하나의 구출 작전</p>
        <h1>미로 구출대</h1>
      </header>

      <section aria-label="게임 화면" data-testid="game-container">
        <GameScreen />
      </section>
    </main>
  )
}
