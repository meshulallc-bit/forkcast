const XLSX = require('xlsx')

const workbookPath = 'data/Menus and overview- Rosenthal_Meshula (1).xlsx'
const workbook = XLSX.readFile(workbookPath)

const sheetName = 'Menus - Natanya'
const sheet = workbook.Sheets[sheetName]

if (!sheet) {
  console.error('Could not find sheet:', sheetName)
  console.log('Available sheets:', workbook.SheetNames)
  process.exit(1)
}

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

console.log('Sheet:', sheetName)
console.log('Rows:', rows.length)

rows.slice(0, 80).forEach((row, index) => {
  console.log(String(index + 1).padStart(3, '0') + ': ' + JSON.stringify(row))
})
