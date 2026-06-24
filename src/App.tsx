import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import './App.css'
import { meals as baseMeals, type Meal, type MealCategory } from './mealData'
import { importedWeeklySelections } from './selectionHistory'

type MealStatus = Meal['status']
type Quantities = Record<string, { david: number; lynn: number }>
type ChefNotes = Record<string, string>
type MealOverrides = Record<string, Partial<Meal>>
type Screen = 'home' | 'pick' | 'review' | 'history'
type NewMealDraft = { category: MealCategory; description: string }
type ImportMealDraft = { text: string }
type ImportMealEntry = { description: string; category: MealCategory }
type SelectionDraft = {
  selectedMealIds: string[]
  quantities: Quantities
  chefNotes: ChefNotes
  extraSmall: number
  extraLarge: number
}

type CommentEntry = {
  id: string
  author: string
  date: string
  text: string
}

type RatingEntry = {
  id: string
  mealId: string
  author: 'David' | 'Lynn'
  weekOf: string
  rating: number
}

type WeeklySelection = {
  weekOf: string
  submittedAt: string
  selections: {
    mealId?: string
    description: string
    davidQuantity: number
    lynnQuantity: number
    notesForChef: string
    comments: string
  }[]
}

type StoredAppData = {
  submittedWeeks: WeeklySelection[]
  selectionDrafts: Record<string, SelectionDraft>
  mealOverrides: MealOverrides
  customMeals: Meal[]
  deletedMealIds: string[]
  mealComments: Record<string, CommentEntry[]>
  mealRatings: Record<string, RatingEntry[]>
  unmatchedEdits: Record<string, string>
}

const storageKey = 'forkcast-v2'

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

const statusLabels: Record<MealStatus, string> = {
  notOrdered: 'Not Ordered',
  ordered: 'Ordered',
  favorite: 'Favorite',
  doNotOrderAgain: 'Do Not Order Again',
}

function loadStoredData(): StoredAppData {
  const fallback = { submittedWeeks: [], selectionDrafts: {}, mealOverrides: {}, customMeals: [], deletedMealIds: [], mealComments: {}, mealRatings: {}, unmatchedEdits: {} }

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<StoredAppData>
    return {
      submittedWeeks: parsed.submittedWeeks ?? [],
      selectionDrafts: parsed.selectionDrafts ?? {},
      mealOverrides: parsed.mealOverrides ?? {},
      customMeals: parsed.customMeals ?? [],
      deletedMealIds: parsed.deletedMealIds ?? [],
      mealComments: parsed.mealComments ?? {},
      mealRatings: parsed.mealRatings ?? {},
      unmatchedEdits: parsed.unmatchedEdits ?? {},
    }
  } catch {
    return fallback
  }
}

function saveStoredData(data: StoredAppData) {
  localStorage.setItem(storageKey, JSON.stringify(data))
}

function normalizeDescription(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function slugify(value: string) {
  return normalizeDescription(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meal'
}

function historyMealId(description: string) {
  return `history-${slugify(description)}`
}

function categoryForHistorySelection(index: number): MealCategory {
  if (index === 0) return 'breakfast'
  if (index <= 2) return 'lunchDinner'
  return 'lowCalorie'
}

function categoryFromText(value: string): MealCategory | null {
  const normalized = normalizeDescription(value).replace(/[/:]/g, ' ')
  if (/\bbreakfast\b/.test(normalized)) return 'breakfast'
  if (/\blow\s*calorie\b|\blow\s*cal\b/.test(normalized)) return 'lowCalorie'
  if (/\blunch\b|\bdinner\b|\blunch\s*dinner\b/.test(normalized)) return 'lunchDinner'
  return null
}

function cleanImportedMealName(value: string) {
  return value.replace(/^[-•*\d.)\s]+/, '').trim()
}

function parseMealImportText(value: string) {
  const entries: ImportMealEntry[] = []
  const unclear: string[] = []
  let currentCategory: MealCategory | null = null

  for (const rawLine of value.split(/\r?\n/)) {
    const line = cleanImportedMealName(rawLine)
    if (!line) continue

    const [possibleCategory, ...rest] = line.split(':')
    const inlineCategory = rest.length > 0 ? categoryFromText(possibleCategory) : null
    const lineCategory = categoryFromText(line)

    if (inlineCategory) {
      const description = cleanImportedMealName(rest.join(':'))
      currentCategory = inlineCategory
      if (description) entries.push({ description, category: inlineCategory })
      continue
    }

    if (lineCategory && normalizeDescription(line).replace(/[^a-z]/g, '') === normalizeDescription(categoryLabels[lineCategory]).replace(/[^a-z]/g, '')) {
      currentCategory = lineCategory
      continue
    }

    if (currentCategory) {
      entries.push({ description: line, category: currentCategory })
    } else {
      unclear.push(line)
    }
  }

  return { entries, unclear }
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatWeek(value: string) {
  return parseIsoDate(value).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatFriendlyDate(value: string) {
  const date = parseIsoDate(value)
  const day = date.getDate()
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  return `${date.toLocaleDateString(undefined, { month: 'long' })} ${day}${suffix}`
}

function formatLastOrdered(value: string) {
  return value.match(/^\d{4}-\d{2}-\d{2}$/) ? formatWeek(value) : value
}

function sundayForDate(date: Date) {
  return toIsoDate(addDays(date, -date.getDay()))
}

function weeksBetween(a: string, b: string) {
  return Math.round((parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / (7 * 24 * 60 * 60 * 1000))
}

function weekRotationOffset(weekOf: string, category: MealCategory, groupSize: number) {
  if (groupSize <= 1) return 0
  const days = Math.round(parseIsoDate(weekOf).getTime() / (24 * 60 * 60 * 1000))
  const categoryOffset = category === 'breakfast' ? 1 : category === 'lunchDinner' ? 3 : 5
  return Math.abs(days + categoryOffset) % groupSize
}

function rotateMeals(meals: Meal[], offset: number) {
  if (offset === 0) return meals
  return [...meals.slice(offset), ...meals.slice(0, offset)]
}

function StarRating({ label, value, onChange }: { label: string; value: number | null; onChange: (rating: number) => void }) {
  return (
    <div className="star-rating" aria-label={`${label} rating`}>
      <span>{label}</span>
      <div>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            type="button"
            className={value !== null && rating <= value ? 'star active-star' : 'star'}
            onClick={() => onChange(rating)}
            aria-label={`${label} ${rating} star${rating === 1 ? '' : 's'}`}
            key={rating}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}

function selectedCount(meals: Meal[], selectedMealIds: string[], category: MealCategory) {
  return meals.filter((meal) => meal.category === category && selectedMealIds.includes(meal.id)).length
}

function defaultQuantityForMeal(meal: Meal, selectedMeals: Meal[]) {
  if (meal.category === 'breakfast') return { david: 5, lynn: 5 }

  const index = selectedMeals
    .filter((selectedMeal) => selectedMeal.category !== 'breakfast')
    .findIndex((selectedMeal) => selectedMeal.id === meal.id)

  const defaultQty = [3, 3, 2, 2][index] ?? 2
  return { david: defaultQty, lynn: defaultQty }
}

function buildDescriptionMap(meals: Meal[]) {
  return new Map(meals.map((meal) => [normalizeDescription(meal.description), meal]))
}

function App() {
  const [storedData, setStoredData] = useState(loadStoredData)
  const [screen, setScreen] = useState<Screen>('home')
  const [selectedWeekOf, setSelectedWeekOf] = useState('')
  const [selectedMealIds, setSelectedMealIds] = useState<string[]>([])
  const [optionMode, setOptionMode] = useState<'recommended' | 'more' | 'all'>('recommended')
  const [quantities, setQuantities] = useState<Quantities>({})
  const [chefNotes, setChefNotes] = useState<ChefNotes>({})
  const [extraSmall, setExtraSmall] = useState(2)
  const [extraLarge, setExtraLarge] = useState(2)
  const [generatedEmail, setGeneratedEmail] = useState('')
  const [approved, setApproved] = useState(false)
  const [chefEmailOpened, setChefEmailOpened] = useState(false)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, { author: string; text: string }>>({})
  const [newMealDraft, setNewMealDraft] = useState<NewMealDraft>({ category: 'breakfast', description: '' })
  const [showAddMeal, setShowAddMeal] = useState(false)
  const [mealSearch, setMealSearch] = useState('')
  const [editingMealIds, setEditingMealIds] = useState<string[]>([])
  const [importMealDraft, setImportMealDraft] = useState<ImportMealDraft>({ text: '' })
  const [importMessage, setImportMessage] = useState('')
  const [starFilter, setStarFilter] = useState(0)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [statusFilter, setStatusFilter] = useState<MealStatus | 'all'>('all')

  const baseAndCustomMeals = [...baseMeals, ...storedData.customMeals]
    .filter((meal) => !storedData.deletedMealIds.includes(meal.id))
  const baseAndCustomByDescription = buildDescriptionMap(baseAndCustomMeals)
  const historyOptionMealMap = new Map<string, Meal>()

  for (const week of importedWeeklySelections) {
    week.selections.forEach((selection, index) => {
      const selectionKey = `${selection.description}-`
      const description = storedData.unmatchedEdits[selectionKey] ?? selection.description
      const id = historyMealId(selection.description)

      if (storedData.deletedMealIds.includes(id) || baseAndCustomByDescription.has(normalizeDescription(description))) return

      const existingMeal = historyOptionMealMap.get(id)
      const comments = [existingMeal?.comments, selection.comments]
        .filter((comment): comment is string => Boolean(comment?.trim()))
        .filter((comment, index, allComments) => allComments.indexOf(comment) === index)
        .join('\n')

      historyOptionMealMap.set(id, {
        id,
        category: existingMeal?.category ?? categoryForHistorySelection(index),
        description: existingMeal?.description ?? description,
        davidRating: existingMeal?.davidRating ?? null,
        lynnRating: existingMeal?.lynnRating ?? null,
        status: 'ordered',
        comments,
        recommendedBecause: 'Imported from current and previous selections.',
        lastOrderedDate: existingMeal && existingMeal.lastOrderedDate > week.weekOf ? existingMeal.lastOrderedDate : week.weekOf,
        timesOrdered: (existingMeal?.timesOrdered ?? 0) + 1,
        davidNote: existingMeal?.davidNote ?? '',
        lynnNote: existingMeal?.lynnNote ?? '',
      })
    })
  }

  const meals = [...baseAndCustomMeals, ...historyOptionMealMap.values()]
    .map((meal) => ({ ...meal, ...storedData.mealOverrides[meal.id] }))
  const mealById = new Map(meals.map((meal) => [meal.id, meal]))
  const mealByDescription = buildDescriptionMap(meals)
  const importedWeeks: WeeklySelection[] = importedWeeklySelections.map((week) => ({
    ...week,
    selections: week.selections.map((selection) => ({
      ...selection,
      mealId: mealByDescription.get(normalizeDescription(selection.description))?.id ?? mealById.get(historyMealId(selection.description))?.id,
    })),
  }))
  const allSubmittedWeeks = [...importedWeeks, ...storedData.submittedWeeks].sort((a, b) => b.weekOf.localeCompare(a.weekOf))
  const submittedWeekSet = new Set(allSubmittedWeeks.map((week) => week.weekOf))
  const today = new Date()
  const currentWeekOf = sundayForDate(today)
  const saturdayTargetWeek = today.getDay() === 6 ? toIsoDate(addDays(today, 8)) : null
  const showSaturdaySelectPrompt = saturdayTargetWeek ? !submittedWeekSet.has(saturdayTargetWeek) : false
  const currentWeekSelection = allSubmittedWeeks.find((week) => week.weekOf === currentWeekOf)

  const selectedMeals = selectedMealIds.map((id) => mealById.get(id)).filter((meal): meal is Meal => Boolean(meal))

  useEffect(() => {
    if (!selectedWeekOf || (screen !== 'pick' && screen !== 'review')) return

    const draft: SelectionDraft = {
      selectedMealIds,
      quantities,
      chefNotes,
      extraSmall,
      extraLarge,
    }

    setStoredData((current) => {
      const currentDraft = current.selectionDrafts[selectedWeekOf]
      if (JSON.stringify(currentDraft) === JSON.stringify(draft)) return current

      const next = {
        ...current,
        selectionDrafts: {
          ...current.selectionDrafts,
          [selectedWeekOf]: draft,
        },
      }
      saveStoredData(next)
      return next
    })
  }, [chefNotes, extraLarge, extraSmall, quantities, screen, selectedMealIds, selectedWeekOf])

  function persist(next: StoredAppData) {
    setStoredData(next)
    saveStoredData(next)
  }

  function commentsForMeal(meal: Meal) {
    const importedComment = meal.comments.trim()
      ? [{ id: `${meal.id}-imported`, author: 'Imported', date: meal.lastOrderedDate, text: meal.comments.trim() }]
      : []
    const historicalComments = importedWeeklySelections.flatMap((week) =>
      week.selections
        .filter((selection) => historyMealId(selection.description) === meal.id)
        .filter((selection) => selection.comments.trim())
        .map((selection) => ({
          id: `${meal.id}-${week.weekOf}-${slugify(selection.comments)}`,
          author: 'Imported',
          date: week.weekOf,
          text: selection.comments.trim(),
        })),
    )

    return [...(storedData.mealComments[meal.id] ?? []), ...historicalComments, ...importedComment]
      .filter((comment) => comment.text.trim())
      .filter((comment, index, comments) => comments.findIndex((item) => item.date === comment.date && item.text === comment.text) === index)
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  function orderedDatesForMeal(meal: Meal) {
    return importedWeeklySelections
      .filter((week) => week.selections.some((selection) => historyMealId(selection.description) === meal.id))
      .map((week) => week.weekOf)
      .filter((date, index, dates) => dates.indexOf(date) === index)
      .sort((a, b) => b.localeCompare(a))
  }

  function latestCommentForMeal(meal: Meal) {
    return commentsForMeal(meal)[0]
  }

  function ratingsForMeal(meal: Meal) {
    return storedData.mealRatings[meal.id] ?? []
  }

  function ratingForMealWeek(meal: Meal, author: 'David' | 'Lynn', weekOf: string) {
    return ratingsForMeal(meal).find((rating) => rating.author === author && rating.weekOf === weekOf)?.rating ?? null
  }

  function averageRatingForMeal(meal: Meal) {
    const datedRatings = ratingsForMeal(meal).map((rating) => rating.rating)
    const legacyRatings = [meal.davidRating, meal.lynnRating].filter((rating): rating is number => rating !== null)
    const ratings = datedRatings.length > 0 ? datedRatings : legacyRatings
    if (ratings.length === 0) return null
    return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
  }

  function ratingCountForMeal(meal: Meal) {
    const datedCount = ratingsForMeal(meal).length
    if (datedCount > 0) return datedCount
    return [meal.davidRating, meal.lynnRating].filter((rating) => rating !== null).length
  }

  function updateMealRating(meal: Meal, author: 'David' | 'Lynn', rating: number, weekOf = toIsoDate(new Date())) {
    const currentRatings = storedData.mealRatings[meal.id] ?? []
    const nextRating: RatingEntry = {
      id: `${meal.id}-${author}-${weekOf}`,
      mealId: meal.id,
      author,
      weekOf,
      rating,
    }

    persist({
      ...storedData,
      mealRatings: {
        ...storedData.mealRatings,
        [meal.id]: [
          nextRating,
          ...currentRatings.filter((entry) => !(entry.author === author && entry.weekOf === weekOf)),
        ],
      },
      mealOverrides: {
        ...storedData.mealOverrides,
        [meal.id]: {
          ...storedData.mealOverrides[meal.id],
          ...(author === 'David' ? { davidRating: rating } : { lynnRating: rating }),
        },
      },
    })
  }

  function addMealComment(mealId: string, author: string, text: string) {
    const trimmed = text.trim()
    if (!trimmed) return

    const comment: CommentEntry = {
      id: `${mealId}-${Date.now()}`,
      author,
      date: toIsoDate(new Date()),
      text: trimmed,
    }

    persist({
      ...storedData,
      mealComments: {
        ...storedData.mealComments,
        [mealId]: [comment, ...(storedData.mealComments[mealId] ?? [])],
      },
    })
  }

  function updateUnmatchedDescription(key: string, value: string) {
    persist({
      ...storedData,
      unmatchedEdits: {
        ...storedData.unmatchedEdits,
        [key]: value,
      },
    })
  }

  function upcomingUnsubmittedWeeks() {
    const weeks: string[] = []
    let cursor = parseIsoDate(sundayForDate(today))

    while (weeks.length < 3) {
      const iso = toIsoDate(cursor)
      if (!submittedWeekSet.has(iso)) weeks.push(iso)
      cursor = addDays(cursor, 7)
    }

    return weeks
  }

  function startWeekSelection(weekOf: string) {
    const draft = storedData.selectionDrafts[weekOf]
    setSelectedWeekOf(weekOf)
    setSelectedMealIds(draft?.selectedMealIds ?? [])
    setQuantities(draft?.quantities ?? {})
    setChefNotes(draft?.chefNotes ?? {})
    setExtraSmall(draft?.extraSmall ?? 2)
    setExtraLarge(draft?.extraLarge ?? 2)
    setGeneratedEmail('')
    setApproved(false)
    setChefEmailOpened(false)
    setOptionMode('recommended')
    setScreen('pick')
  }

  function openAllOptions(showImporter = false) {
    const [weekOf] = upcomingUnsubmittedWeeks()
    startWeekSelection(weekOf)
    setOptionMode('all')
    setShowAddMeal(showImporter)
  }

  function updateMealOverride(mealId: string, updates: Partial<Meal>) {
    persist({
      ...storedData,
      mealOverrides: {
        ...storedData.mealOverrides,
        [mealId]: {
          ...storedData.mealOverrides[mealId],
          ...updates,
        },
      },
    })
  }

  function updateMealCard(meal: Meal, updates: Partial<Meal>) {
    let nextUnmatchedEdits = storedData.unmatchedEdits

    if (updates.description !== undefined && meal.id.startsWith('history-')) {
      const originalDescription = meal.id.replace(/^history-/, '')
      const importedSelection = importedWeeklySelections
        .flatMap((week) => week.selections)
        .find((selection) => slugify(selection.description) === originalDescription)

      if (importedSelection) {
        nextUnmatchedEdits = {
          ...storedData.unmatchedEdits,
          [`${importedSelection.description}-`]: updates.description,
        }
      }
    }

    persist({
      ...storedData,
      unmatchedEdits: nextUnmatchedEdits,
      mealOverrides: {
        ...storedData.mealOverrides,
        [meal.id]: {
          ...storedData.mealOverrides[meal.id],
          ...updates,
        },
      },
    })
  }

  function addCustomMeal() {
    const description = newMealDraft.description.trim()
    if (!description) return

    const baseId = `custom-${newMealDraft.category}-${slugify(description)}`
    const existingIds = new Set([...baseMeals, ...storedData.customMeals].map((meal) => meal.id))
    const id = existingIds.has(baseId) ? `${baseId}-${Date.now()}` : baseId
    const customMeal: Meal = {
      id,
      category: newMealDraft.category,
      description,
      davidRating: null,
      lynnRating: null,
      status: 'notOrdered',
      comments: '',
      recommendedBecause: 'Added manually to the menu.',
      lastOrderedDate: 'Never',
      timesOrdered: 0,
      davidNote: '',
      lynnNote: '',
    }

    persist({
      ...storedData,
      customMeals: [...storedData.customMeals, customMeal],
      deletedMealIds: storedData.deletedMealIds.filter((mealId) => mealId !== id),
    })
    setNewMealDraft((current) => ({ ...current, description: '' }))
    setShowAddMeal(false)
  }

  function buildCustomMealsFromEntries(mealEntries: ImportMealEntry[]) {
    const existingDescriptions = new Set([...baseMeals, ...storedData.customMeals].map((meal) => normalizeDescription(meal.description)))
    const existingIds = new Set([...baseMeals, ...storedData.customMeals].map((meal) => meal.id))
    const importedMeals: Meal[] = []

    for (const mealEntry of mealEntries) {
      const description = mealEntry.description.trim()
      if (!description || existingDescriptions.has(normalizeDescription(description))) continue

      const baseId = `custom-${mealEntry.category}-${slugify(description)}`
      const id = existingIds.has(baseId) ? `${baseId}-${Date.now()}-${importedMeals.length}` : baseId
      existingDescriptions.add(normalizeDescription(description))
      existingIds.add(id)
      importedMeals.push({
        id,
        category: mealEntry.category,
        description,
        davidRating: null,
        lynnRating: null,
        status: 'notOrdered',
        comments: '',
        recommendedBecause: 'Imported into the menu.',
        lastOrderedDate: 'Never',
        timesOrdered: 0,
        davidNote: '',
        lynnNote: '',
      })
    }

    return importedMeals
  }

  function importMealsFromEntries(mealEntries: ImportMealEntry[], unclear: string[]) {
    const importedMeals = buildCustomMealsFromEntries(mealEntries)
    if (importedMeals.length === 0) {
      setImportMessage(unclear.length > 0 ? `No meals imported. Missing or unclear category: ${unclear.join('; ')}` : 'No new meals found to import.')
      return
    }

    persist({
      ...storedData,
      customMeals: [...storedData.customMeals, ...importedMeals],
      deletedMealIds: storedData.deletedMealIds.filter((mealId) => !importedMeals.some((meal) => meal.id === mealId)),
    })
    setImportMealDraft((current) => ({ ...current, text: '' }))
    setImportMessage([
      `Imported ${importedMeals.length} meal${importedMeals.length === 1 ? '' : 's'}.`,
      unclear.length > 0 ? `Missing or unclear category: ${unclear.join('; ')}` : '',
    ].filter(Boolean).join(' '))
  }

  function importPastedMeals() {
    const parsedImport = parseMealImportText(importMealDraft.text)
    importMealsFromEntries(parsedImport.entries, parsedImport.unclear)
  }

  async function importSpreadsheet(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 })
    const entries: ImportMealEntry[] = []
    const unclear: string[] = []
    let currentCategory: MealCategory | null = null

    for (const row of rows) {
      const cells = row.map((cell) => String(cell ?? '').trim()).filter(Boolean)
      if (cells.length === 0) continue
      if (cells.every((cell) => ['meal', 'meal name', 'category'].includes(normalizeDescription(cell)))) continue

      const rowCategory = cells.map(categoryFromText).find((category): category is MealCategory => Boolean(category))
      const description = cells.find((cell) => !categoryFromText(cell)) ?? ''

      if (rowCategory && !description) {
        currentCategory = rowCategory
        continue
      }

      if (!description) continue
      if (rowCategory) {
        currentCategory = rowCategory
        entries.push({ description, category: rowCategory })
      } else if (currentCategory) {
        entries.push({ description, category: currentCategory })
      } else {
        unclear.push(description)
      }
    }

    importMealsFromEntries(entries, unclear)
    event.target.value = ''
  }

  function deleteMeal(meal: Meal) {
    if (!window.confirm(`Delete "${meal.description}"?`)) return
    if (!window.confirm('This will remove the whole meal card from options. Delete it permanently?')) return

    const nextOverrides = { ...storedData.mealOverrides }
    delete nextOverrides[meal.id]
    const isCustomMeal = storedData.customMeals.some((customMeal) => customMeal.id === meal.id)

    persist({
      ...storedData,
      mealOverrides: nextOverrides,
      customMeals: storedData.customMeals.filter((customMeal) => customMeal.id !== meal.id),
      deletedMealIds: isCustomMeal
        ? storedData.deletedMealIds
        : Array.from(new Set([...storedData.deletedMealIds, meal.id])),
    })
    setEditingMealIds((current) => current.filter((mealId) => mealId !== meal.id))
    setSelectedMealIds((current) => current.filter((mealId) => mealId !== meal.id))
    setQuantities((current) => {
      const next = { ...current }
      delete next[meal.id]
      return next
    })
    setChefNotes((current) => {
      const next = { ...current }
      delete next[meal.id]
      return next
    })
  }

  function recommendationScore(meal: Meal) {
    if (meal.status === 'doNotOrderAgain') return -1

    const avg = averageRatingForMeal(meal)
    const lastOrderedWeeksAgo = meal.lastOrderedDate.match(/^\d{4}-\d{2}-\d{2}$/)
      ? weeksBetween(meal.lastOrderedDate, selectedWeekOf || currentWeekOf)
      : Number.POSITIVE_INFINITY

    if (meal.timesOrdered === 0 || meal.status === 'notOrdered') return 100
    if (avg !== null && avg >= 5 && lastOrderedWeeksAgo >= 2) return 92
    if (avg !== null && avg >= 4 && lastOrderedWeeksAgo >= 3) return 86
    if (meal.status === 'favorite' && lastOrderedWeeksAgo >= 2) return 82
    if (lastOrderedWeeksAgo >= 4) return 56
    return 25 - Math.max(0, 4 - lastOrderedWeeksAgo)
  }

  function recommendationReason(meal: Meal) {
    const avg = averageRatingForMeal(meal)
    const lastOrderedWeeksAgo = meal.lastOrderedDate.match(/^\d{4}-\d{2}-\d{2}$/)
      ? weeksBetween(meal.lastOrderedDate, selectedWeekOf || currentWeekOf)
      : Number.POSITIVE_INFINITY

    if (meal.status === 'doNotOrderAgain') return 'Marked do not order again; shown only in All options.'
    if (meal.timesOrdered === 0 || meal.status === 'notOrdered') return 'Never ordered from the current menu.'
    if (avg !== null && avg >= 5 && lastOrderedWeeksAgo >= 2) return '5-star meal and not ordered in the past two weeks.'
    if (avg !== null && avg >= 4 && lastOrderedWeeksAgo >= 3) return '4-star meal and not ordered in the past three weeks.'
    if (meal.status === 'favorite') return 'Marked as a favorite from review history.'
    return 'Previously ordered and not too recent.'
  }

  function sortedMealsForCategory(category: MealCategory) {
    const sortedMeals = meals
      .filter((meal) => meal.category === category)
      .filter((meal) => optionMode === 'all' || meal.status !== 'doNotOrderAgain')
      .sort((a, b) => {
        const scoreDiff = recommendationScore(b) - recommendationScore(a)
        if (scoreDiff !== 0) return scoreDiff
        return a.description.localeCompare(b.description)
      })

    if (optionMode === 'all') return sortedMeals

    const rotatedMeals: Meal[] = []
    for (let index = 0; index < sortedMeals.length;) {
      const score = recommendationScore(sortedMeals[index])
      const group = sortedMeals.slice(index).filter((meal) => recommendationScore(meal) === score)
      const offset = weekRotationOffset(selectedWeekOf || currentWeekOf, category, group.length)
      rotatedMeals.push(...rotateMeals(group, offset))
      index += group.length
    }

    return rotatedMeals
  }

  function visibleMealsForCategory(category: MealCategory) {
    const searchTerm = optionMode === 'all' ? normalizeDescription(mealSearch) : ''
    const categoryMeals = sortedMealsForCategory(category).filter((meal) =>
      (!searchTerm || normalizeDescription(meal.description).includes(searchTerm))
      && (optionMode !== 'all' || starFilter === 0 || (averageRatingForMeal(meal) ?? 0) >= starFilter)
      && (optionMode !== 'all' || !favoritesOnly || meal.status === 'favorite')
      && (optionMode !== 'all' || statusFilter === 'all' || meal.status === statusFilter),
    )
    if (optionMode === 'all') return categoryMeals
    if (optionMode === 'more') return categoryMeals.slice(0, 12)
    return categoryMeals.slice(0, 4)
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
      setChefNotes((current) => {
        const next = { ...current }
        delete next[meal.id]
        return next
      })
      return
    }

    if (selectedCount(meals, selectedMealIds, meal.category) >= categoryTargets[meal.category]) return
    setSelectedMealIds((current) => [...current, meal.id])
  }

  function getQuantity(meal: Meal) {
    return quantities[meal.id] ?? defaultQuantityForMeal(meal, selectedMeals)
  }

  function updateQuantity(meal: Meal, person: 'david' | 'lynn', value: number) {
    const currentQty = getQuantity(meal)
    setQuantities((current) => ({
      ...current,
      [meal.id]: {
        ...currentQty,
        [person]: Number.isNaN(value) ? 0 : Math.max(0, value),
      },
    }))
  }

  function buildChefEmail() {
    const extraLine = `${extraSmall} additional small and ${extraLarge} additional large`
    const mealLines = selectedMeals.map((meal) => {
      const qty = getQuantity(meal)
      const note = chefNotes[meal.id]?.trim()
      return `${meal.description} D${qty.david}-L${qty.lynn}${note ? `\nNotes for Chef: ${note}` : ''}`
    })

    return `Week of ${formatWeek(selectedWeekOf)}\n${extraLine}\n\nFinalized Menu\n\n${mealLines.join('\n')}`
  }

  const chefEmail = generatedEmail || (selectedWeekOf ? buildChefEmail() : '')

  function approveAndSave() {
    const submittedWeek: WeeklySelection = {
      weekOf: selectedWeekOf,
      submittedAt: toIsoDate(new Date()),
      selections: selectedMeals.map((meal) => {
        const qty = getQuantity(meal)
        return {
          mealId: meal.id,
          description: meal.description,
          davidQuantity: qty.david,
          lynnQuantity: qty.lynn,
          notesForChef: chefNotes[meal.id]?.trim() ?? '',
          comments: meal.comments,
        }
      }),
    }

    const nextOverrides = { ...storedData.mealOverrides }
    for (const meal of selectedMeals) {
      const status = meal.status === 'favorite' || meal.status === 'doNotOrderAgain' ? meal.status : 'ordered'
      nextOverrides[meal.id] = {
        ...nextOverrides[meal.id],
        status,
        lastOrderedDate: selectedWeekOf,
        timesOrdered: meal.timesOrdered + 1,
      }
    }

    const submittedWeeks = [
      submittedWeek,
      ...storedData.submittedWeeks.filter((week) => week.weekOf !== selectedWeekOf),
    ]
    const nextSelectionDrafts = { ...storedData.selectionDrafts }
    delete nextSelectionDrafts[selectedWeekOf]

    persist({ ...storedData, submittedWeeks, selectionDrafts: nextSelectionDrafts, mealOverrides: nextOverrides })
    setGeneratedEmail(chefEmail)
    setApproved(true)
    setChefEmailOpened(false)
    navigator.clipboard?.writeText(chefEmail).catch(() => undefined)
  }

  function openChefEmail() {
    if (!approved) approveAndSave()
    setChefEmailOpened(true)
    const mailto = `mailto:info@uniwellness.life?subject=${encodeURIComponent(
      `Finalized Menu - Week of ${formatWeek(selectedWeekOf)}`,
    )}&body=${encodeURIComponent(chefEmail)}`

    window.location.href = mailto
  }

  function skipWeekAndNotifyChef() {
    if (!selectedWeekOf) return

    const submittedWeek: WeeklySelection = {
      weekOf: selectedWeekOf,
      submittedAt: toIsoDate(new Date()),
      selections: [],
    }

    const nextSelectionDrafts = { ...storedData.selectionDrafts }
    delete nextSelectionDrafts[selectedWeekOf]

    persist({
      ...storedData,
      selectionDrafts: nextSelectionDrafts,
      submittedWeeks: [
        submittedWeek,
        ...storedData.submittedWeeks.filter((week) => week.weekOf !== selectedWeekOf),
      ],
    })

    const nextMealService = toIsoDate(addDays(parseIsoDate(selectedWeekOf), 7))
    const body = `Hi, Chef!\n\nI wanted to let you know that we need to skip meal prep for the week of ${formatFriendlyDate(selectedWeekOf)}.\n\nWe will see you on ${formatFriendlyDate(nextMealService)}.\n\nBest,`
    const mailto = `mailto:info@uniwellness.life?cc=${encodeURIComponent('dsr13@cox.net')}&subject=${encodeURIComponent(
      `Skipping meals - Week of ${formatWeek(selectedWeekOf)}`,
    )}&body=${encodeURIComponent(body)}`

    window.location.href = mailto
    setScreen('home')
  }

  function finishWeekSelection() {
    if (!chefEmailOpened) return
    setScreen('home')
  }

  function formatRatingForEmail(value: number | null) {
    return value === null ? 'Not rated' : `${value}/5`
  }

  function commentsByAuthorForEmail(meal: Meal, author: 'David' | 'Lynn') {
    const comments = commentsForMeal(meal)
      .filter((comment) => comment.author === author)
      .map((comment) => comment.text.trim())
      .filter(Boolean)

    return comments.length > 0 ? comments.join('; ') : 'No comment yet'
  }

  function buildChefFeedbackEmail(week: WeeklySelection) {
    const mealLines = week.selections.map((selection) => {
      const meal = selection.mealId ? mealById.get(selection.mealId) : mealByDescription.get(normalizeDescription(selection.description))
      const mealName = meal?.description ?? selection.description

      if (!meal) {
        return `${mealName}\nDavid rating: Not rated\nDavid comment: No comment yet\nLynn rating: Not rated\nLynn comment: No comment yet`
      }

      return [
        mealName,
        `David rating: ${formatRatingForEmail(meal.davidRating)}`,
        `David comment: ${commentsByAuthorForEmail(meal, 'David')}`,
        `Lynn rating: ${formatRatingForEmail(meal.lynnRating)}`,
        `Lynn comment: ${commentsByAuthorForEmail(meal, 'Lynn')}`,
      ].join('\n')
    })

    return `Meal feedback - Week of ${formatWeek(week.weekOf)}\n\n${mealLines.join('\n\n')}`
  }

  function openChefFeedbackEmail(week: WeeklySelection) {
    const body = buildChefFeedbackEmail(week)
    const mailto = `mailto:info@uniwellness.life?subject=${encodeURIComponent(
      `Meal Feedback - Week of ${formatWeek(week.weekOf)}`,
    )}&body=${encodeURIComponent(body)}`

    window.location.href = mailto
  }

  function renderMealCard(meal: Meal) {
    const selected = selectedMealIds.includes(meal.id)
    const categorySelectedCount = selectedCount(meals, selectedMealIds, meal.category)
    const disabled = categorySelectedCount >= categoryTargets[meal.category] && !selected
    const latestComment = latestCommentForMeal(meal)
    const showRecommendation = optionMode !== 'all'
    const isEditing = editingMealIds.includes(meal.id)
    const orderedDates = orderedDatesForMeal(meal)
    const avgRating = averageRatingForMeal(meal)
    const ratingCount = ratingCountForMeal(meal)

    return (
      <article className={`meal-card ${selected ? 'selected' : ''}`} key={meal.id}>
          <div className="meal-card-header">
            <button type="button" className="meal-title-button" onClick={() => toggleMeal(meal)} disabled={disabled}>
              <span className="checkbox" aria-hidden="true">{selected ? '✓' : ''}</span>
              <strong>{meal.description}</strong>
            </button>
            <div className="status-choice-row" aria-label="Meal status">
              {(['notOrdered', 'ordered', 'favorite', 'doNotOrderAgain'] as MealStatus[]).map((status) => (
                <button
                  type="button"
                  className={meal.status === status ? `status-chip active-status ${status}` : 'status-chip'}
                  onClick={() => updateMealOverride(meal.id, { status })}
                  key={status}
                >
                  {statusLabels[status]}
                </button>
              ))}
            </div>
          </div>
        <div className="meal-card-body">
          {latestComment && (
            <div className="latest-comment">
              <strong>Latest comment:</strong> {latestComment.text}
              <span>{latestComment.author} · {formatLastOrdered(latestComment.date)}</span>
            </div>
          )}
          {showRecommendation && <span className="recommendation"><strong>Recommended because:</strong> {recommendationReason(meal)}</span>}
          {isEditing && (
            <div className="meal-edit-row">
              <label>
                Meal name
                <input value={meal.description} onChange={(event) => updateMealCard(meal, { description: event.target.value })} />
              </label>
              <label>
                Category
                <select value={meal.category} onChange={(event) => updateMealCard(meal, { category: event.target.value as MealCategory })}>
                  {(['breakfast', 'lunchDinner', 'lowCalorie'] as MealCategory[]).map((category) => (
                    <option value={category} key={category}>{categoryLabels[category]}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="meal-meta unified-meta">
            <StarRating label="David" value={meal.davidRating} onChange={(rating) => updateMealRating(meal, 'David', rating)} />
            <StarRating label="Lynn" value={meal.lynnRating} onChange={(rating) => updateMealRating(meal, 'Lynn', rating)} />
            {avgRating !== null && <span>Average rating: {avgRating.toFixed(1)}/5 ({ratingCount})</span>}
            <span>Last ordered: {formatLastOrdered(meal.lastOrderedDate)}</span>
            <span>Times ordered: {meal.timesOrdered}</span>
            {orderedDates.length > 1 && <span>Ordered dates: {orderedDates.map(formatLastOrdered).join(', ')}</span>}
          </div>
        </div>
        {selected && (
          <label className="chef-note-field">
            Notes for Chef
            <textarea
              value={chefNotes[meal.id] ?? ''}
              onChange={(event) => setChefNotes((current) => ({ ...current, [meal.id]: event.target.value }))}
              placeholder="Optional meal-specific note for the chef"
            />
          </label>
        )}
        <div className="meal-card-bottom-actions">
          <button
            type="button"
            className={isEditing ? 'icon-action-button active-icon-action' : 'icon-action-button'}
            onClick={() => setEditingMealIds((current) => current.includes(meal.id) ? current.filter((mealId) => mealId !== meal.id) : [...current, meal.id])}
            aria-label={`${isEditing ? 'Close editor for' : 'Edit'} ${meal.description}`}
          >
            ✎
          </button>
          <button type="button" className="icon-action-button delete-meal-button" onClick={() => deleteMeal(meal)} aria-label={`Delete ${meal.description}`}>
            🗑
          </button>
        </div>
      </article>
    )
  }

  function renderHistorySelection(selection: WeeklySelection['selections'][number], weekOf: string) {
    const selectionKey = `${selection.description}-${selection.mealId ?? ''}`
    const editedDescription = storedData.unmatchedEdits[selectionKey] ?? selection.description
    const meal = selection.mealId ? mealById.get(selection.mealId) : mealByDescription.get(normalizeDescription(editedDescription))
    const draft = commentDrafts[selectionKey] ?? { author: 'Lynn', text: '' }
    const isEditing = meal ? editingMealIds.includes(meal.id) : false
    const orderedDates = meal ? orderedDatesForMeal(meal) : []
    const avgRating = meal ? averageRatingForMeal(meal) : null
    const ratingCount = meal ? ratingCountForMeal(meal) : 0

    return (
      <article className="meal-card history-card" key={selectionKey}>
        <div className="meal-card-header">
          <div className="meal-title-static">
            <span className="checkbox checked-box" aria-hidden="true">✓</span>
            <div>
              <strong>{meal?.description ?? editedDescription}</strong>
              <span>D{selection.davidQuantity} / L{selection.lynnQuantity}</span>
            </div>
          </div>
          {meal && (
            <div className="status-choice-row" aria-label="Meal status">
              {(['notOrdered', 'ordered', 'favorite', 'doNotOrderAgain'] as MealStatus[]).map((status) => (
                <button
                  type="button"
                  className={meal.status === status ? `status-chip active-status ${status}` : 'status-chip'}
                  onClick={() => updateMealCard(meal, { status })}
                  key={status}
                >
                  {statusLabels[status]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="meal-card-body">
          {selection.notesForChef && <p className="chef-note-display"><strong>Notes for Chef:</strong> {selection.notesForChef}</p>}
          {!meal && (
            <label className="unmatched-editor">
              Edit meal name to match a menu card
              <input value={editedDescription} onChange={(event) => updateUnmatchedDescription(selectionKey, event.target.value)} />
            </label>
          )}
          {meal ? (
            <>
              <div className="comment-list">
                {commentsForMeal(meal).map((comment) => (
                  <div className="comment-entry" key={comment.id}>
                    <p>{comment.text}</p>
                    <span>{comment.author} · {formatLastOrdered(comment.date)}</span>
                  </div>
                ))}
                {selection.comments && !meal.comments.includes(selection.comments) && (
                  <div className="comment-entry">
                    <p>{selection.comments}</p>
                    <span>Imported · {formatLastOrdered(weekOf)}</span>
                  </div>
                )}
              </div>
              <div className="meal-meta unified-meta">
                {isEditing && (
                  <div className="meal-edit-row">
                    <label>
                      Meal name
                      <input value={meal.description} onChange={(event) => updateMealCard(meal, { description: event.target.value })} />
                    </label>
                    <label>
                      Category
                      <select value={meal.category} onChange={(event) => updateMealCard(meal, { category: event.target.value as MealCategory })}>
                        {(['breakfast', 'lunchDinner', 'lowCalorie'] as MealCategory[]).map((category) => (
                          <option value={category} key={category}>{categoryLabels[category]}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <StarRating label="David" value={ratingForMealWeek(meal, 'David', weekOf)} onChange={(rating) => updateMealRating(meal, 'David', rating, weekOf)} />
                <StarRating label="Lynn" value={ratingForMealWeek(meal, 'Lynn', weekOf)} onChange={(rating) => updateMealRating(meal, 'Lynn', rating, weekOf)} />
                {avgRating !== null && <span>Average rating: {avgRating.toFixed(1)}/5 ({ratingCount})</span>}
                <span>Last ordered: {formatLastOrdered(meal.lastOrderedDate)}</span>
                <span>Times ordered: {meal.timesOrdered}</span>
                {orderedDates.length > 1 && <span>Ordered dates: {orderedDates.map(formatLastOrdered).join(', ')}</span>}
              </div>
              <div className="add-comment-row">
                <select value={draft.author} onChange={(event) => setCommentDrafts((current) => ({ ...current, [selectionKey]: { ...draft, author: event.target.value } }))}>
                  <option value="Lynn">Lynn</option>
                  <option value="David">David</option>
                </select>
                <input
                  value={draft.text}
                  placeholder="Add a new comment"
                  onChange={(event) => setCommentDrafts((current) => ({ ...current, [selectionKey]: { ...draft, text: event.target.value } }))}
                />
                <button
                  type="button"
                  onClick={() => {
                    addMealComment(meal.id, draft.author, draft.text)
                    setCommentDrafts((current) => ({ ...current, [selectionKey]: { ...draft, text: '' } }))
                  }}
                >
                  Add comment
                </button>
              </div>
            </>
          ) : (
            <p className="unmatched-note">This imported meal is not matched to a current menu card yet.</p>
          )}
        </div>
        {meal && (
          <div className="meal-card-bottom-actions">
            <button
              type="button"
              className={isEditing ? 'icon-action-button active-icon-action' : 'icon-action-button'}
              onClick={() => setEditingMealIds((current) => current.includes(meal.id) ? current.filter((mealId) => mealId !== meal.id) : [...current, meal.id])}
              aria-label={`${isEditing ? 'Close editor for' : 'Edit'} ${meal.description}`}
            >
              ✎
            </button>
            <button type="button" className="icon-action-button delete-meal-button" onClick={() => deleteMeal(meal)} aria-label={`Delete ${meal.description}`}>
              🗑
            </button>
          </div>
        )}
      </article>
    )
  }

  if (screen === 'history') {
    const unratedSelections = allSubmittedWeeks.flatMap((week) =>
      week.selections
        .filter((selection) => {
          const meal = selection.mealId ? mealById.get(selection.mealId) : mealByDescription.get(normalizeDescription(selection.description))
          if (!meal) return false
          return ratingForMealWeek(meal, 'David', week.weekOf) === null || ratingForMealWeek(meal, 'Lynn', week.weekOf) === null
        })
        .map((selection) => ({ selection, weekOf: week.weekOf })),
    )

    return (
      <main className="app-shell">
        <section className="hero-card wide-card selection-card">
          <div className="page-topline">
            <p className="eyebrow">Forkcast</p>
            <div className="top-actions">
              {optionMode === 'all' && <button type="button" className="secondary-button compact-button" onClick={() => setShowAddMeal((current) => !current)}>+ New</button>}
              <button type="button" className="secondary-button compact-button" onClick={() => setScreen('home')}>Home</button>
            </div>
          </div>
          <h1>Current & previous selections</h1>
          <p className="subtitle">Review submitted weeks, rate meals, add comments, and update meal status.</p>
          <section className="history-week needs-rating-section">
            <div className="section-heading">
              <div>
                <h2>Meals that need ratings</h2>
                <p>Ordered meals missing a David or Lynn rating since their cook date.</p>
              </div>
              <span className={unratedSelections.length === 0 ? 'complete-pill' : 'open-pill'}>{unratedSelections.length === 0 ? 'All rated' : `${unratedSelections.length} left`}</span>
            </div>
            {unratedSelections.length > 0 ? (
              <div className="history-meals">
                {unratedSelections.map(({ selection, weekOf }) => renderHistorySelection(selection, weekOf))}
              </div>
            ) : (
              <p className="unmatched-note">Everything ordered has a current David and Lynn rating.</p>
            )}
          </section>
          <div className="history-list">
            {allSubmittedWeeks.map((week) => (
              <section className="history-week" key={`${week.weekOf}-${week.submittedAt}`}>
                <div className="section-heading">
                  <div>
                    <h2>Week of {formatWeek(week.weekOf)}</h2>
                    <p>{week.weekOf === currentWeekOf ? 'Current week' : `Submitted ${formatWeek(week.submittedAt)}`}</p>
                  </div>
                  <div className="section-actions">
                    <button type="button" className="secondary-button compact-button" onClick={() => openChefFeedbackEmail(week)}>
                      Email chef feedback
                    </button>
                    <button type="button" className="secondary-button compact-button" onClick={() => startWeekSelection(week.weekOf)}>
                      Re-select week
                    </button>
                  </div>
                </div>
                <div className="history-meals">{week.selections.map((selection) => renderHistorySelection(selection, week.weekOf))}</div>
              </section>
            ))}
          </div>
          <div className="footer-actions">
            <button type="button" className="secondary-button" onClick={() => setScreen('home')}>Back</button>
          </div>
        </section>
      </main>
    )
  }

  if (screen === 'review') {
    return (
      <main className="app-shell">
        <section className="hero-card wide-card">
          <div className="page-topline">
            <p className="eyebrow">Forkcast</p>
            <div className="top-actions">
              {optionMode === 'all' && <button type="button" className="secondary-button compact-button" onClick={() => setShowAddMeal((current) => !current)}>+ New</button>}
              <button type="button" className="secondary-button compact-button" onClick={() => setScreen('home')}>Home</button>
            </div>
          </div>
          <h1>Review week of {formatWeek(selectedWeekOf)}</h1>
          <p className="subtitle">Confirm quantities and chef notes before sending.</p>
          <div className="review-list">
            {selectedMeals.map((meal) => {
              const qty = getQuantity(meal)
              return (
                <div className="review-row" key={meal.id}>
                  <div className="review-meal-text">
                    <strong>{meal.description}</strong>
                    <span>{categoryLabels[meal.category]}</span>
                    <label className="chef-note-field inline-note">
                      Notes for Chef
                      <textarea
                        value={chefNotes[meal.id] ?? ''}
                        onChange={(event) => setChefNotes((current) => ({ ...current, [meal.id]: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="quantity-grid">
                    <label>David<input type="number" min="0" value={qty.david} onChange={(event) => updateQuantity(meal, 'david', Number(event.target.value))} /></label>
                    <label>Lynn<input type="number" min="0" value={qty.lynn} onChange={(event) => updateQuantity(meal, 'lynn', Number(event.target.value))} /></label>
                  </div>
                </div>
              )
            })}
          </div>
          <section className="extra-meals">
            <div><h2>Extra Meals</h2><p>Optional additional meals.</p></div>
            <div className="review-settings">
              <label>Small<input type="number" value={extraSmall} min="0" onChange={(event) => setExtraSmall(Math.max(0, Number(event.target.value)))} /></label>
              <label>Large<input type="number" value={extraLarge} min="0" onChange={(event) => setExtraLarge(Math.max(0, Number(event.target.value)))} /></label>
            </div>
          </section>
          <div className="footer-actions">
            <button type="button" className="secondary-button" onClick={() => setScreen('pick')}>Back to picks</button>
            <button type="button" onClick={approveAndSave}>Approve & save</button>
          </div>
          <section className="email-preview">
            <h2>Chef Email</h2>
            <p>Edit this before sending if you want to add comments.</p>
            {approved && <p className="approved-message">Approved and saved. Email copied to clipboard.</p>}
            <textarea value={chefEmail} onChange={(event) => { setGeneratedEmail(event.target.value); setApproved(false); setChefEmailOpened(false) }} />
            <button type="button" onClick={openChefEmail}>Open email to chef</button>
            <button type="button" onClick={finishWeekSelection} disabled={!chefEmailOpened}>Done</button>
          </section>
        </section>
      </main>
    )
  }

  if (screen === 'pick') {
    return (
      <main className="app-shell">
        <section className="hero-card wide-card">
          <div className="page-topline">
            <p className="eyebrow">Forkcast</p>
            <button type="button" className="secondary-button compact-button" onClick={() => setScreen('home')}>Home</button>
          </div>
          <h1>Selecting meals for {formatWeek(selectedWeekOf)}</h1>
          <p className="subtitle">Choose one breakfast, two lunch / dinner meals, and two low calorie meals.</p>
          <div className="skip-week-action">
            <button type="button" className="secondary-button" onClick={skipWeekAndNotifyChef}>Skip week and notify chef</button>
          </div>
          <div className="option-controls" aria-label="Meal option display controls">
            <button type="button" className={optionMode === 'recommended' ? 'control-active' : 'control-button'} onClick={() => { setOptionMode('recommended'); setShowAddMeal(false) }}>Recommended</button>
            <button type="button" className={optionMode === 'more' ? 'control-active' : 'control-button'} onClick={() => { setOptionMode('more'); setShowAddMeal(false) }}>More options</button>
            <button type="button" className={optionMode === 'all' ? 'control-active' : 'control-button'} onClick={() => { setOptionMode('all'); setShowAddMeal(false) }}>All options</button>
          </div>
          {optionMode === 'all' && showAddMeal && (
            <section className="add-meal-panel" aria-label="Add meal card">
              <div className="add-meal-form">
                <label>
                  Category
                  <select value={newMealDraft.category} onChange={(event) => setNewMealDraft((current) => ({ ...current, category: event.target.value as MealCategory }))}>
                    {(['breakfast', 'lunchDinner', 'lowCalorie'] as MealCategory[]).map((category) => (
                      <option value={category} key={category}>{categoryLabels[category]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Meal name
                  <input value={newMealDraft.description} onChange={(event) => setNewMealDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Enter meal description" />
                </label>
                <button type="button" onClick={addCustomMeal} disabled={!newMealDraft.description.trim()}>Add meal</button>
              </div>
              <div className="import-meals-panel">
                <label>
                  Paste meal names
                  <textarea
                    value={importMealDraft.text}
                    onChange={(event) => setImportMealDraft((current) => ({ ...current, text: event.target.value }))}
                    placeholder="Breakfast\nEgg bites\nLunch/Dinner\nPad thai\nLow Calorie\nGarlic lemon chicken"
                  />
                </label>
                <div className="import-actions">
                  <button type="button" onClick={importPastedMeals} disabled={!importMealDraft.text.trim()}>Import pasted list</button>
                  <label className="file-import-button">
                    Upload spreadsheet
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={importSpreadsheet} />
                  </label>
                </div>
                {importMessage && <p className="import-message">{importMessage}</p>}
              </div>
            </section>
          )}
          {optionMode === 'all' && (
            <>
              <label className="meal-search">
                Search meals
                <input
                  value={mealSearch}
                  onChange={(event) => setMealSearch(event.target.value)}
                  placeholder="Start typing a meal name"
                  list="meal-search-options"
                />
              </label>
              <datalist id="meal-search-options">
                {meals.map((meal) => <option value={meal.description} key={meal.id} />)}
              </datalist>
              <div className="meal-filter-controls" aria-label="Meal filters">
                <label>
                  Stars
                  <select value={starFilter} onChange={(event) => setStarFilter(Number(event.target.value))}>
                    <option value={0}>Any stars</option>
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <option value={rating} key={rating}>{rating}+ stars</option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as MealStatus | 'all')}>
                    <option value="all">Any status</option>
                    {(['notOrdered', 'ordered', 'favorite', 'doNotOrderAgain'] as MealStatus[]).map((status) => (
                      <option value={status} key={status}>{statusLabels[status]}</option>
                    ))}
                  </select>
                </label>
                <label className="favorite-filter">
                  <input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} />
                  Favorites only
                </label>
              </div>
              <nav className="category-tabs" aria-label="Meal category shortcuts">
                {(['breakfast', 'lunchDinner', 'lowCalorie'] as MealCategory[]).map((category) => (
                  <a href={`#${category}-section`} key={category}>{categoryLabels[category].replace(' / ', '/')}</a>
                ))}
              </nav>
            </>
          )}
          {(['breakfast', 'lunchDinner', 'lowCalorie'] as MealCategory[]).map((category) => {
            const count = selectedCount(meals, selectedMealIds, category)
            const target = categoryTargets[category]
            const visibleMeals = visibleMealsForCategory(category)
            return (
              <section className="meal-section" id={`${category}-section`} key={category}>
                <div className="section-heading">
                  <div>
                    <h2>{categoryLabels[category]}</h2>
                    <p>Choose {target}. Selected {count} of {target}. Showing {visibleMeals.length} of {meals.filter((meal) => meal.category === category).length} menu options.</p>
                  </div>
                  <span className={count === target ? 'complete-pill' : 'open-pill'}>{count === target ? 'Complete' : `${target - count} left`}</span>
                </div>
                <div className="meal-list">{visibleMeals.map(renderMealCard)}</div>
              </section>
            )
          })}
          <div className="footer-actions">
            <button type="button" className="secondary-button" onClick={() => setScreen('home')}>Back</button>
            <button type="button" disabled={selectedMealIds.length !== 5} onClick={() => setScreen('review')}>Review {selectedMealIds.length}/5 selected</button>
          </div>
        </section>
      </main>
    )
  }

  const upcomingWeeks = upcomingUnsubmittedWeeks()

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Meals you can eat.</p>
        <img className="home-logo" src={`${import.meta.env.BASE_URL}forkcast-logo.svg`} alt="Forkcast" />
        <h1 className="sr-only">Forkcast</h1>
        <p className="subtitle">Order. Eat. Rate. Repeat.</p>

        {today.getDay() === 6 && currentWeekSelection && (
          <div className="reminder-card">
            <strong>Saturday review</strong>
            <span>Review week of {formatWeek(currentWeekSelection.weekOf)} before selecting upcoming meals.</span>
            <button type="button" className="secondary-button" onClick={() => setScreen('history')}>Review meals</button>
          </div>
        )}

        {showSaturdaySelectPrompt && saturdayTargetWeek && (
          <div className="reminder-card highlight-card">
            <strong>Selection reminder</strong>
            <span>Select meals for week of {formatWeek(saturdayTargetWeek)}.</span>
            <button type="button" onClick={() => startWeekSelection(saturdayTargetWeek)}>Select meals</button>
          </div>
        )}

        <div className="status-grid week-grid">
          {upcomingWeeks.map((week) => (
            <button type="button" className="week-button" onClick={() => startWeekSelection(week)} key={week}>
              <strong>Week of</strong>
              <span>{formatWeek(week)}</span>
            </button>
          ))}
        </div>

        <div className="footer-actions single-action">
          <button type="button" className="secondary-button" onClick={() => openAllOptions()}>View all meal options</button>
          <button type="button" className="secondary-button" onClick={() => setScreen('history')}>View current and previous selections</button>
          <button type="button" className="secondary-button" onClick={() => openAllOptions(true)}>Add new menu options</button>
        </div>
      </section>
    </main>
  )
}

export default App
