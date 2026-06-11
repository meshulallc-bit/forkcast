const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const workbookPath = 'data/Menus and overview- Rosenthal_Meshula (1).xlsx'
const workbook = XLSX.readFile(workbookPath)
const sheet = workbook.Sheets['Menus - Natanya']

if (!sheet) {
  throw new Error('Missing Menus - Natanya sheet')
}

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

const meals = []
let category = null

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

  meals.push({
    id: `${category}-${slugify(description)}`,
    category,
    description,
    rating: null,
    recommendedBecause: ordered
      ? 'Ordered before and available in the Natanya menu.'
      : 'Available in the Natanya menu and not yet marked ordered.',
    lastOrderedDate: ordered ? 'Previously ordered' : 'Never',
    timesOrdered: ordered ? 1 : 0,
    davidNote,
    lynnNote,
  })
}

const output = `export type MealCategory = 'breakfast' | 'lunchDinner' | 'lowCalorie'

export type Meal = {
  id: string
  category: MealCategory
  description: string
  rating: number | null
  recommendedBecause: string
  lastOrderedDate: string
  timesOrdered: number
  davidNote?: string
  lynnNote?: string
}

export const meals: Meal[] = ${JSON.stringify(meals, null, 2)}
`

const outputPath = path.join('src', 'mealData.ts')
fs.writeFileSync(outputPath, output)

console.log(`Wrote ${meals.length} meals to ${outputPath}`)
console.log('Counts:')
console.log({
  breakfast: meals.filter((meal) => meal.category === 'breakfast').length,
  lunchDinner: meals.filter((meal) => meal.category === 'lunchDinner').length,
  lowCalorie: meals.filter((meal) => meal.category === 'lowCalorie').length,
})
