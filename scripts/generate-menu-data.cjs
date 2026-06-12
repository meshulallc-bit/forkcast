const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const workbookPath = 'data/Menus and overview- Rosenthal_Meshula (1).xlsx'
const workbook = XLSX.readFile(workbookPath)
const sheet = workbook.Sheets['Menus - Natanya']
const weeklySelectionsSheet = workbook.Sheets['Weekly Selections']

if (!sheet) {
  throw new Error('Missing Menus - Natanya sheet')
}

if (!weeklySelectionsSheet) {
  throw new Error('Missing Weekly Selections sheet')
}

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
const weeklyRows = XLSX.utils.sheet_to_json(weeklySelectionsSheet, { header: 1, defval: '' })

const meals = []
let category = null
const orderedDescriptions = new Set()
const favoriteDescriptions = new Set()
const orderStats = new Map()
const latestComments = new Map()

function normalizeDescription(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parseWeekDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!match) return null

  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function hasTwoHearts(value) {
  return (String(value || '').match(/❤️/g) || []).length >= 2
}

function isWeeklySummaryRow(description) {
  const normalized = normalizeDescription(description)
  return ['chef\'s cost', 'groceries', 'staples', 'total', 'invoice'].includes(normalized)
}

const selectionDateRows = []
weeklyRows.forEach((row, index) => {
  const weekOf = parseWeekDate(row[0])
  if (weekOf) {
    selectionDateRows.push({ index, weekOf })
  }
})

const importedSelections = selectionDateRows.map((dateRow, dateIndex) => {
  const nextDateRow = selectionDateRows[dateIndex + 1]
  const selectionRows = weeklyRows.slice(dateRow.index + 1, nextDateRow?.index ?? weeklyRows.length)
  const selections = []

  for (const row of selectionRows) {
    const description = String(row[0] || '').trim()
    if (!description || isWeeklySummaryRow(description)) continue

    const normalized = normalizeDescription(description)
    const comments = String(row[4] || '').trim()
    orderedDescriptions.add(normalized)
    const currentStats = orderStats.get(normalized) ?? { timesOrdered: 0, lastOrderedDate: null }
    orderStats.set(normalized, {
      timesOrdered: currentStats.timesOrdered + 1,
      lastOrderedDate: !currentStats.lastOrderedDate || dateRow.weekOf > currentStats.lastOrderedDate
        ? dateRow.weekOf
        : currentStats.lastOrderedDate,
    })

    if (hasTwoHearts(comments)) {
      favoriteDescriptions.add(normalized)
    }

    if (comments) {
      const currentComment = latestComments.get(normalized)
      if (!currentComment || dateRow.weekOf > currentComment.weekOf) {
        latestComments.set(normalized, { weekOf: dateRow.weekOf, comments })
      }
    }

    selections.push({
      description,
      davidQuantity: Number(row[1]) || 0,
      lynnQuantity: Number(row[2]) || 0,
      notesForChef: String(row[3] || '').trim(),
      comments,
    })
  }

  return {
    weekOf: dateRow.weekOf,
    submittedAt: dateRow.weekOf,
    selections,
  }
})

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function isSection(value) {
  const normalized = value.toLowerCase().trim()
  if (normalized.includes('breakfast')) return 'breakfast'
  if (normalized.includes('lunch') || normalized.includes('dinner')) return 'lunchDinner'
  if (normalized.includes('low calorie') || normalized.includes('low cal')) return 'lowCalorie'
  return null
}

function isMenuHeader(value) {
  const normalized = value.toLowerCase().trim()
  return normalized === '' || normalized.startsWith('menu ') || normalized.includes('options')
}

for (const row of rows) {
  const description = String(row[0] || '').trim()
  if (!description) continue

  const nextCategory = isSection(description)
  if (nextCategory) {
    category = nextCategory
    continue
  }

  if (!category || isMenuHeader(description)) continue

  const davidNote = String(row[2] || '').trim()
  const lynnNote = String(row[3] || '').trim()
  const ordered = String(row[1] || '').trim().toLowerCase() === 'x'
  const normalized = normalizeDescription(description)
  const isFavorite = favoriteDescriptions.has(normalized) || hasTwoHearts(`${davidNote} ${lynnNote}`)
  const wasOrdered = ordered || orderedDescriptions.has(normalized)
  const stats = orderStats.get(normalized)
  const timesOrdered = stats?.timesOrdered ?? (ordered ? 1 : 0)
  const lastOrderedDate = stats?.lastOrderedDate ?? (ordered ? 'Previously ordered' : 'Never')
  const comments = latestComments.get(normalized)?.comments ?? ''

  meals.push({
    id: `${category}-${slugify(description)}`,
    category,
    description,
    davidRating: null,
    lynnRating: null,
    status: isFavorite ? 'favorite' : wasOrdered ? 'ordered' : 'notOrdered',
    comments,
    recommendedBecause: ordered
      ? 'Ordered before and available in the Natanya menu.'
      : 'Available in the Natanya menu and not yet marked ordered.',
    lastOrderedDate,
    timesOrdered,
    davidNote,
    lynnNote,
  })
}

const output = `export type MealCategory = 'breakfast' | 'lunchDinner' | 'lowCalorie'

export type Meal = {
  id: string
  category: MealCategory
  description: string
  davidRating: number | null
  lynnRating: number | null
  status: 'notOrdered' | 'ordered' | 'favorite' | 'doNotOrderAgain'
  comments: string
  recommendedBecause: string
  lastOrderedDate: string
  timesOrdered: number
  davidNote?: string
  lynnNote?: string
}

export const meals: Meal[] = ${JSON.stringify(meals, null, 2)}
`

const historyOutput = `export type ImportedWeeklySelection = {
  weekOf: string
  submittedAt: string
  selections: {
    description: string
    davidQuantity: number
    lynnQuantity: number
    notesForChef: string
    comments: string
  }[]
}

export const importedWeeklySelections: ImportedWeeklySelection[] = ${JSON.stringify(importedSelections, null, 2)}
`

const outputPath = path.join('src', 'mealData.ts')
fs.writeFileSync(outputPath, output)

const historyOutputPath = path.join('src', 'selectionHistory.ts')
fs.writeFileSync(historyOutputPath, historyOutput)

console.log(`Wrote ${meals.length} meals to ${outputPath}`)
console.log(`Wrote ${importedSelections.length} weekly selections to ${historyOutputPath}`)
console.log('Counts:')
console.log({
  breakfast: meals.filter((meal) => meal.category === 'breakfast').length,
  lunchDinner: meals.filter((meal) => meal.category === 'lunchDinner').length,
  lowCalorie: meals.filter((meal) => meal.category === 'lowCalorie').length,
})
