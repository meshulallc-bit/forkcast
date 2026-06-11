const XLSX = require('xlsx')

const workbookPath = 'data/Menus and overview- Rosenthal_Meshula (1).xlsx'
const workbook = XLSX.readFile(workbookPath)

console.log('Sheets:')
for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  console.log('\n--- ' + sheetName + ' ---')
  console.log('Rows:', rows.length)

  const preview = rows.slice(0, 10)
  for (const row of preview) {
    console.log(JSON.stringify(row))
  }
}
