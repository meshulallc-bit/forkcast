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

type Quantities = Record<string, { david: number; lynn: number }>

const meals: Meal[] = [
  {
    id: 'egg-white-frittata',
    category: 'breakfast',
    name: 'Egg White Garden Frittata',
    description: 'Chef description from spreadsheet will appear here.',
    rating: 4.5,
    recommendedBecause: 'High rating and not ordered last week.',
    lastOrderedDate: '5/24',
    timesOrdered: 1,
  },
  {
    id: 'greek-yogurt-parfait',
    category: 'breakfast',
    name: 'Greek Yogurt Berry Parfait',
    description: 'Chef description from spreadsheet will appear here.',
    rating: null,
    recommendedBecause: 'Never tried before, so it is prioritized.',
    lastOrderedDate: 'Never',
    timesOrdered: 0,
  },
  {
    id: 'protein-pancakes',
    category: 'breakfast',
    name: 'Protein Pancakes with Apples',
    description: 'Chef description from spreadsheet will appear here.',
    rating: 4.5,
    recommendedBecause: '4-star meal eligible after cooldown.',
    lastOrderedDate: '4/27',
    timesOrdered: 1,
  },
  {
    id: 'mini-shakshuka',
    category: 'breakfast',
    name: 'Mini Shakshuka Breakfast Bowl',
    description: 'Chef description from spreadsheet will appear here.',
    rating: 3.5,
    recommendedBecause: 'Available on the current menu.',
    lastOrderedDate: '5/10',
    timesOrdered: 1,
  },
  {
    id: 'herb-salmon',
    category: 'lunchDinner',
    name: 'Herb Salmon with Roasted Vegetables',
    description: 'Chef description from spreadsheet will appear here.',
    rating: 5,
    recommendedBecause: '5-star favorite eligible after 2 weeks.',
    lastOrderedDate: '5/3',
    timesOrdered: 1,
  },
  {
    id: 'chicken-shawarma',
    category: 'lunchDinner',
    name: 'Chicken Shawarma Plate',
    description: 'Chef description from spreadsheet will appear here.',
    rating: 4.5,
    recommendedBecause: 'Strong rating history, but not ordered this week.',
    lastOrderedDate: '5/31',
    timesOrdered: 1,
  },
  {
    id: 'turkey-meatballs',
    category: 'lunchDinner',
    name: 'Turkey Meatballs in Tomato Sauce',
    description: 'Chef description from spreadsheet will appear here.',
    rating: 4,
    recommendedBecause: '4-star meal eligible after 4 weeks.',
    lastOrderedDate: '4/20',
    timesOrdered: 1,
  },
  {
    id: 'beef-kebabs',
    category: 'lunchDinner',
    name: 'Beef Kebabs with Cauliflower Rice',
    description: 'Chef description from spreadsheet will appear here.',
    rating: null,
    recommendedBecause: 'Never tried before, so it is prioritized.',
    lastOrderedDate: 'Never',
    timesOrdered: 0,
  },
  {
    id: 'zucchini-lasagna',
    category: 'lowCalorie',
    name: 'Low Cal Zucchini Lasagna',
    description: 'Chef description from spreadsheet will appear here.',
    rating: 4,
    recommendedBecause: '4-star meal eligible after cooldown.',
    lastOrderedDate: '5/3',
    timesOrdered: 1,
  },
  {
    id: 'cauliflower-fried-rice',
    category: 'lowCalorie',
    name: 'Cauliflower Fried Rice with Chicken',
    description: 'Chef description from spreadsheet will appear here.',
    rating: 5,
    recommendedBecause: '5-star favorite eligible after 2 weeks.',
    lastOrderedDate: '5/31',
    timesOrdered: 1,
  },
  {
    id: 'tuna-cakes',
    category: 'lowCalorie',
    name: 'Tuna Cakes with Cucumber Salad',
    description: 'Chef description from spreadsheet will appear here.',
    rating: null,
    recommendedBecause: 'Never tried before, so it is prioritized.',
    lastOrderedDate: 'Never',
    timesOrdered: 0,
  },
  {
    id: 'turkey-lettuce-cups',
    category: 'lowCalorie',
    name: 'Turkey Lettuce Cups',
    description: 'Chef description from spreadsheet will appear here.',
    rating: null,
    recommendedBecause: 'Never tried before, so it is prioritized.',
    lastOrderedDate: 'Never',
    timesOrdered: 0,
  },
  {
    id: 'lemon-chicken',
    category: 'lunchDinner',
    name: 'Lemon Chicken with Green Beans',
    description: 'Chef description from spreadsheet will appear here.',
    rating: 4.5,
    recommendedBecause: 'Additional current menu option.',
    lastOrderedDate: '5/17',
    timesOrdered: 1,
  },
  {
    id: 'stuffed-peppers',
    category: 'lunchDinner',
    name: 'Mediterranean Stuffed Peppers',
    description: 'Chef description from spreadsheet will appear here.',
    rating: null,
    recommendedBecause: 'Additional current menu option.',
    lastOrderedDate: 'Never',
    timesOrdered: 0,
  },
  {
    id: 'grilled-chicken-salad',
    category: 'lowCalorie',
    name: 'Grilled Chicken Israeli Salad',
    description: 'Chef description from spreadsheet will appear here.',
    rating: null,
    recommendedBecause: 'Additional current menu option.',
    lastOrderedDate: 'Never',
    timesOrdered: 0,
  },
  {
    id: 'white-fish-broccoli',
    category: 'lowCalorie',
    name: 'White Fish with Steamed Broccoli',
    description: 'Chef description from spreadsheet will appear here.',
    rating: 4,
    recommendedBecause: 'Additional current menu option.',
    lastOrderedDate: '5/24',
    timesOrdered: 1,
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
  const [screen, setScreen] = useState<'pick' | 'review'>('pick')
  const [selectedMealIds, setSelectedMealIds] = useState<string[]>([])
  const [optionMode, setOptionMode] = useState<'recommended' | 'more' | 'all'>('recommended')
  const [quantities, setQuantities] = useState<Quantities>({})
  const [extraSmall, setExtraSmall] = useState(2)
  const [extraLarge, setExtraLarge] = useState(2)

  const selectedMeals = selectedMealIds
    .map((id) => meals.find((meal) => meal.id === id))
    .filter((meal): meal is Meal => Boolean(meal))

  function defaultQuantityForMeal(meal: Meal) {
    if (meal.category === 'breakfast') {
      return { david: 5, lynn: 5 }
    }

    const nonBreakfastIndex = selectedMeals
      .filter((selectedMeal) => selectedMeal.category !== 'breakfast')
      .findIndex((selectedMeal) => selectedMeal.id === meal.id)

    const defaultQty = [3, 3, 2, 2][nonBreakfastIndex] ?? 2
    return { david: defaultQty, lynn: defaultQty }
  }

  function getQuantity(meal: Meal) {
    return quantities[meal.id] ?? defaultQuantityForMeal(meal)
  }

  function updateQuantity(meal: Meal, person: 'david' | 'lynn', value: number) {
    const currentQty = getQuantity(meal)

    setQuantities((current) => ({
      ...current,
      [meal.id]: {
        ...currentQty,
        [person]: Number.isNaN(value) ? 0 : value,
      },
    }))
  }

  function toggleMeal(meal: Meal) {
    const isSelected = selectedMealIds.includes(meal.id)

    if (isSelected) {
      setSelectedMealIds((current) => current.filter((id) => id !== meal.id))
      setQuantities((current) => {
        const next = { ...current }
        delete next[meal.id]
        return next
      })
      return
    }

    const selectedCount = getSelectedCount(selectedMealIds, meal.category)
    const target = categoryTargets[meal.category]

    if (selectedCount >= target) {
      return
    }

    setSelectedMealIds((current) => [...current, meal.id])
  }

  function visibleMealsForCategory(category: MealCategory) {
    const categoryMeals = meals.filter((meal) => meal.category === category)

    if (optionMode === 'all') {
      return categoryMeals
    }

    if (optionMode === 'more') {
      return categoryMeals.slice(0, 6)
    }

    return categoryMeals.slice(0, 4)
  }

  if (started && screen === 'review') {
    return (
      <main className="app-shell">
        <section className="hero-card wide-card">
          <p className="eyebrow">Forkcast</p>
          <h1>Review order</h1>
          <p className="subtitle">Confirm David and Lynn quantities before sending to the chef.</p>

          <div className="review-list">
            {selectedMeals.map((meal) => {
              const qty = getQuantity(meal)

              return (
                <div className="review-row" key={meal.id}>
                  <div className="review-meal-text">
                    <strong>{meal.description}</strong>
                    <span>{categoryLabels[meal.category]}</span>
                  </div>

                  <div className="quantity-grid">
                    <label>
                      David
                      <input
                        type="number"
                        value={qty.david}
                        onChange={(event) => updateQuantity(meal, 'david', Number(event.target.value))}
                      />
                    </label>

                    <label>
                      Lynn
                      <input
                        type="number"
                        value={qty.lynn}
                        onChange={(event) => updateQuantity(meal, 'lynn', Number(event.target.value))}
                      />
                    </label>
                  </div>
                </div>
              )
            })}
          </div>

          <section className="extra-meals">
            <div>
              <h2>Extra Meals</h2>
              <p>Optional additional meals.</p>
            </div>

            <div className="review-settings">
              <label>
                Small
                <input
                  type="number"
                  value={extraSmall}
                  onChange={(event) => setExtraSmall(Number(event.target.value))}
                />
              </label>

              <label>
                Large
                <input
                  type="number"
                  value={extraLarge}
                  onChange={(event) => setExtraLarge(Number(event.target.value))}
                />
              </label>
            </div>
          </section>

          <div className="footer-actions">
            <button type="button" className="secondary-button" onClick={() => setScreen('pick')}>
              Back to picks
            </button>
            <button type="button">Approve & generate email</button>
          </div>
        </section>
      </main>
    )
  }

  if (started) {
    return (
      <main className="app-shell">
        <section className="hero-card wide-card">
          <p className="eyebrow">Forkcast</p>
          <h1>Pick this week’s meals</h1>
          <p className="subtitle">Meals you can eat.</p>

          <div className="option-controls" aria-label="Meal option display controls">
            <button
              type="button"
              className={optionMode === 'recommended' ? 'control-active' : 'control-button'}
              onClick={() => setOptionMode('recommended')}
            >
              Recommended
            </button>
            <button
              type="button"
              className={optionMode === 'more' ? 'control-active' : 'control-button'}
              onClick={() => setOptionMode('more')}
            >
              More options
            </button>
            <button
              type="button"
              className={optionMode === 'all' ? 'control-active' : 'control-button'}
              onClick={() => setOptionMode('all')}
            >
              All options
            </button>
          </div>

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
                  {visibleMealsForCategory(category)
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
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setStarted(false)
                setScreen('pick')
              }}
            >
              Back to home
            </button>
            <button
              type="button"
              disabled={selectedMealIds.length !== 5}
              onClick={() => setScreen('review')}
            >
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
