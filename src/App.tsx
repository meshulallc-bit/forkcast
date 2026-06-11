import './App.css'

function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Lynn & David</p>
        <h1>Forkcast</h1>
        <p className="subtitle">
          Meals you can eat.
        </p>

        <div className="status-grid">
          <div>
            <strong>Breakfast</strong>
            <span>Choose 1</span>
          </div>
          <div>
            <strong>Lunch / Dinner</strong>
            <span>Choose 2</span>
          </div>
          <div>
            <strong>Low Calorie</strong>
            <span>Choose 2</span>
          </div>
        </div>

        <button type="button">Start meal picks</button>
      </section>
    </main>
  )
}

export default App
