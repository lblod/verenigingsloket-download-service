import XLSX from 'xlsx-js-style'

const deduplicate = data => {
  const seen = new Set()
  return data.filter(item => {
    const key = JSON.stringify(item)
    return !seen.has(key) && seen.add(key)
  })
}

const createSheet = async (
  associations = [],
  locations = [],
  representatives = []
) => {
  const workbook = XLSX.utils.book_new()

  if (associations.length) {
    console.log('Create associations sheet')
    const data = deduplicate(
      associations.map(el => ({
        VCode: el.vCode,
        Status: el.organizatieStatus,
        Naam: el.naam,
        Type: el.type,
        Hoofdactiviteiten: el.hoofdactiviteiten,
        Beschrijving: el.beschrijving,
        Minimumleeftijd: el.minimumleeftijd,
        Maximumleeftijd: el.maximumleeftijd,
        Startdatum: el.startdatum
          ? el.startdatum.split('-').reverse().join('-')
          : null,
        KboNummer: el.kboNummer,
        Straat: el.straat,
        Huisnummer: el.huisnummer,
        Busnummer: el.busnummer,
        Postcode: el.postcode,
        Gemeente: el.gemeente,
        Land: el.land
      }))
    )
    const { worksheet, sheetName } = addSheet(data, 'Algemeen')
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  if (locations.length) {
    console.log('Create locations sheet')
    const data = deduplicate(
      locations.map(el => ({
        VCode: el.vCode,
        Status: el.organizatieStatus,
        Straat: el.straat,
        Huisnummer: el.huisnummer,
        Busnummer: el.busnummer,
        Postcode: el.postcode,
        Gemeente: el.gemeente,
        Land: el.land,
        Naam: el.naam,
        Type: el.type,
        Hoofdactiviteiten: el.hoofdactiviteiten,
        Beschrijving: el.beschrijving,
        Minimumleeftijd: el.minimumleeftijd,
        Maximumleeftijd: el.maximumleeftijd,
        Startdatum: el.startdatum
          ? el.startdatum.split('-').reverse().join('-')
          : null,
        KboNummer: el.kboNummer
      }))
    )
    const { worksheet, sheetName } = addSheet(data, 'Locaties')
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  if (representatives.length) {
    console.log('Create representatives sheet')
    const data = deduplicate(
      representatives.map(el => ({
        VCode: el.vCode,
        Voornaam: el.voornaam,
        Achternaam: el.achternaam,
        Email: el.email,
        Websites: el.websites,
        Socials: el.socials,
        Naam: el.naam,
        Type: el.type,
        Hoofdactiviteiten: el.hoofdactiviteiten,
        Beschrijving: el.beschrijving,
        Minimumleeftijd: el.minimumleeftijd,
        Maximumleeftijd: el.maximumleeftijd,
        Startdatum: el.startdatum
          ? el.startdatum.split('-').reverse().join('-')
          : null,
        KboNummer: el.kboNummer
      }))
    )
    const { worksheet, sheetName } = addSheet(data, 'Vertegenwoordigers')
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  const fileBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
  return fileBuffer
}

export const addSheet = (data, sheetName) => {
  const style = { font: { sz: 14, bold: true } }
  const rowStyle = { rows: [], width: [] }

  if (data.length) {
    const keys = Object.keys(data[0])
    keys.forEach(key => {
      if (key) {
        rowStyle.rows.push({ v: key, t: 's', s: style })
        rowStyle.width.push({ wch: key.length + 6 })
      }
    })
  }

  const worksheet = XLSX.utils.json_to_sheet(data)
  worksheet['!cols'] = rowStyle.width
  XLSX.utils.sheet_add_aoa(worksheet, [rowStyle.rows])

  return { worksheet, sheetName }
}

export default createSheet
