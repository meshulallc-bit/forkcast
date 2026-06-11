import { useState } from 'react'
import './App.css'

type MealCategory = 'breakfast' | 'lunchDinner' | 'lowCalorie'

type Meal = {
  id: string
  category: MealCategory
  name: string
  description: string
  rating: number | null
  recommendedBecause: string
  lastOrderedDate: string
  timesOrdered: number
}

const meals: Meal[] = [
  {
    id: 'egg-white-frittata',
    category: 'breakfast',
    name: 'Egg White Garden Frittata',
    description:
      'Chef description from spreadsheet will appear here.',
    rating: 4.5,
    recommendedBecause: 'High rating and not ordered last week.',
    lastOrderedDate: '5/24',
    timesOrdered: 1,
  },
  {
    id: 'greek-yogurt-parfait',
    category: 'breakfast',
    name: 'Greek Yogurt Berry Parfait',
    description:
      'Chef description from spreadsheet will appear here.',
    rating: null,
    recommendedBecause: 'Never tried before, so it is prioritized.',
    lastOrderedDate: 'Never',
    timesOrdered: 0,
  },
  {
    id: 'protein-pancakes',
    category: 'breakfast',
    name: 'Protein Pancakes with Apples',
    description:
      'Chef description from spreadsheet will appear here.',
    rating: 4.5,
    recommendedBecause: '4-star meal eligible after cooldown.',
    lastOrderedDate: '4/27',
    timesOrdered: 1,
  },
  {
    id: 'mini-shakshuka',
    category: 'breakfast',
    name: 'Mini Shakshuka Breakfast Bowl',
    description:
      'Chef description from spreadsheet will appear here.',
    rating: 3.5,
    recommendedBecause: 'Available on the current menu.',
    lastOrderedDate: '5/10',
    timesOrdered: 1,
  },
  {
    id: 'herb-salmon',
    category: 'lunchDinner',
    name: 'Herb Salmon with Roasted Vegetables',
    description:
      'Chef description from spreadsheet will appear here.',
    rating: 5,
    recommendedBecause: '5-star favorite eligible after 2 weeks.',
    lastOrderedDate: '5/3',
    timesOrdered: 1,
  },
  {
    id: 'chicken-shawarma',
    category: 'lunchDinner',
    name: 'Chicken Shawarma Plate',
    description:
      'Chef description from spreadsheet will appear here.',
    rating: 4.5,
    recommendedBecause: 'Strong rating history, but not ordered this week.',
    lastOrderedDate: '5/31',
    timesOrdered: 1,
  },
  {
    id: 'turkey-meatballs',
    category: 'lunchDinner',
    name: 'Turkey Meatballs in Tomato Sauce',
    description:
      'Chef description from spreadsheet will appear here.',
    rating: 4,
    recommendedBecause: '4-star meal eligible after 4 weeks.',
    lastOrderedDate: '4/20',
    timesOrdered: 1,
  },
  {
    id: 'beef-kebabs',
    category: 'lunchDinner',
    name: 'Beef Kebabs with Cauliflower Rice',
    description:
      'Chef description from spreadsheet will appear here.',
    rating: null,
    recommendedBecause: 'Never tried before, so it is prioritized.',
    lastOrderedDate: 'Never',
    timesOrdered: 0,
  },
  {
    id: 'zucchini-lasagna',
    category: 'lowCalorie',
    name: 'Low Cal Zucchini Lasagna',
    description:
      'Chef description from spreadsheet will appear here.',
    rating: 4,
    recommendedBecause: '4-star meal eligible after cooldown.',
    lastOrderedDate: '5/3',
    timesOrdered: 1,
  },
  {
    id: 'cauliflower-fried-rice',
    category: 'lowCalorie',
    name: 'Cauliflower Fried Rice with Chicken',
    description:
      'Chef description from spreadsheet will appear here.',
    rating: 5,
    recommendedBecause: '5-star favorite eligible after 2 weeks.',
    lastOrderedDate: '5/31',
    timesOrdered: 1,
  },
  {
    id: 'tuna-cakes',
    category: 'lowCalorie',
    name: 'Tuna Cakes with Cucumber Salad',
    description:
      'Chef description from spreadsheet will appear here.',
    rating: null,
    recommendedBecause: 'Never tried before, so it is prioritized.',
    lastOrderedDate: 'Never',
    timesOrdered: 0,
  },
  {
    id: 'turkey-lettuce-cups',
    category: 'lowCalorie',
    name: 'Turkey Lettuce Cups',
    description:
      'Chef description from spreadsheet will appear here.',
    rating: null,
    recommendedBecause: 'Never tried before, so it is prioritized.',
    lastOrderedDate: 'Never',
    timesOrdered: 0,
  },
]

const categoryLabels: Record<MealCategory, string> = {
  breakfast: 'Breakfast',
  lunchDinner: 'Lunch / Dinner',
  lowCalorie: 'Low Calorie',
}

const categoryTargets: Record<MealCategory, number> = {
  breakfast: 1,
  lunchDinner: 2,
  lowCalorie: 2,
}

function getSelectedCount(selectedMealIds: string[], category: MealCategory) {
  return meals.filter((meal) => meal.category === category && selectedMealIds.includes(meal.id)).length
}

function Rating({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <span className="rating">New</span>
  }

  return <span className="rating">★ {rating.toFixed(1)}</span>
}

function MealCard({
  meal,
  selected,
  disabled,
  onToggle,
}: {
  meal: Meal
  selected: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`meal-card ${selected ? 'selected' : ''}`}
      onClick={onToggle}
      disabled={disabled && !selected}
    >
      <span className="checkbox" aria-hidden="true">
        {selected ? '✓' : ''}
      </span>

      <span className="meal-content">
        <span className="meal-topline">
          <strong>{meal.description}</strong>
          <Rating rating={meal.rating} />
        </span>

        <span className="recommendation">
          <strong>Recommended because:</strong> {meal.recommendedBecause}
        </span>

        <span className="meal-meta">
          <span>Last ordered: {meal.lastOrderedDate}</span>
          <span>Times ordered: {meal.timesOrdered}</span>
        </span>
      </span>
    </button>
  )
}

function App() {
  const [started, setStarted] = useState(false)
  const [selectedMealIds, setSelectedMealIds] = useState<string[]>([])

  function toggleMeal(meal: Meal) {
    const isSelected = selectedMealIds.includes(meal.id)

    if (isSelected) {
      setSelectedMealIds((current) => current.filter((id) => id !== meal.id))
      return
    }

    const selectedCount = getSelectedCount(selectedMealIds, meal.category)
    const target = categoryTargets[meal.category]

    if (selectedCount >= target) {
      return
    }

    setSelectedMealIds((current) => [...current, meal.id])
  }

  if (started) {
    return (
      <main className="app-shell">
        <section className="hero-card wide-card">
          <p className="eyebrow">Forkcast</p>
          <h1>Pick this week’s meals</h1>
          <p className="subtitle">Meals you can eat.</p>

          {(['breakfast', 'lunchDinner', 'lowCalorie'] as MealCategory[]).map((category) => {
            const selectedCount = getSelectedCount(selectedMealIds, category)
            const target = categoryTargets[category]

            return (
              <section className="meal-section" key={category}>
                <div className="section-heading">
                  <div>
                    <h2>{categoryLabels[category]}</h2>
                    <p>
                      Choose {target}. Selected {selectedCount} of {target}.
                    </p>
                  </div>
                  <span className={selectedCount === target ? 'complete-pill' : 'open-pill'}>
                    {selectedCount === target ? 'Complete' : `${target - selectedCount} left`}
                  </span>
                </div>

                <div className="meal-list">
                  {meals
                    .filter((meal) => meal.category === category)
                    .map((meal) => (
                      <MealCard
                        key={meal.id}
                        meal={meal}
                        selected={selectedMealIds.includes(meal.id)}
                        disabled={selectedCount >= target}
                        onToggle={() => toggleMeal(meal)}
                      />
                    ))}
                </div>
              </section>
            )
          })}

          <div className="footer-actions">
            <button type="button" className="secondary-button" onClick={() => setStarted(false)}>
              Back to home
            </button>
            <button type="button" disabled={selectedMealIds.length !== 5}>
              Review {selectedMealIds.length}/5 selected
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Lynn & David</p>
        <h1>Forkcast</h1>
        <p className="subtitle">Meals you can eat.</p>

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

        <button type="button" onClick={() => setStarted(true)}>
          Start meal picks
        </button>
      </section>
    </main>
  )
}

export default App
