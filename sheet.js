import XLSX from 'xlsx-js-style'
import { SHA256 } from 'crypto-js'

const createSheet = async generalData => {
  const currentDate = new Date()
  const timestamp = currentDate
    .toISOString()
    .replace(/[-:]/g, '_')
    .replace(/\.\d+/, '')
  const fileName = `verenigingen_${timestamp}.xlsx`
  const style = { font: { sz: 14, bold: true } }

  const createSheet = (data, sheetName) => {
    const rowStyle = { rows: [], width: [] }
    if (data && data.length > 0) {
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

  const workbook = XLSX.utils.book_new()
  const { worksheet: generalWorksheet, sheetName: generalSheetName } =
    createSheet(
      generalData
        .map(el => ({
          VCode: el.vCode,
          Naam: el.naam,
          Type: el.type,
          Hoofdqctiviteiten: el.hoofdactiviteiten,
          Beschrijving: el.beschrijving,
          Minimumleeftijd: el.minimumleeftijd,
          Maximumleeftijd: el.maximumleeftijd,
          Startdatum: el.startdatum,
          KboNummer: el.kboNummer,
          Straat: el.straat,
          Huisnummer: el.huisnummer,
          Busnummer: el.busnummer,
          Postcode: el.postcode,
          Gemeente: el.gemeente,
          Land: el.land
        }))
        .filter(
          (obj, index, self) =>
            index !==
            self.findIndex(
              t => SHA256(JSON.stringify(t)) === SHA256(JSON.stringify(obj))
            )
        ),
      'Algemeen'
    )
  const { worksheet: locationWorksheet, sheetName: locationSheetName } =
    createSheet(
      generalData
        .map(el => ({
          VCode: el.vCode,
          Straat: el.straat,
          Huisnummer: el.huisnummer,
          Busnummer: el.busnummer,
          Postcode: el.postcode,
          Gemeente: el.gemeente,
          Land: el.land,
          Naam: el.naam,
          Type: el.type,
          Hoofdqctiviteiten: el.hoofdactiviteiten,
          Beschrijving: el.beschrijving,
          Minimumleeftijd: el.minimumleeftijd,
          Maximumleeftijd: el.maximumleeftijd,
          Startdatum: el.startdatum,
          KboNummer: el.kboNummer
        }))
        .filter(
          (obj, index, self) =>
            index !==
            self.findIndex(
              t => SHA256(JSON.stringify(t)) === SHA256(JSON.stringify(obj))
            )
        ),
      'Locaties'
    )

  const {
    worksheet: representativeWorksheet,
    sheetName: representativeSheetName
  } = createSheet(
    generalData
      .map(el => ({
        VCode: el.vCode,
        Voornaam: el.voornaam,
        Achternaam: el.achternaam,
        Email: el.email,
        Websites: el.websites,
        Socials: el.solcials,
        Naam: el.naam,
        Type: el.type,
        Hoofdqctiviteiten: el.hoofdactiviteiten,
        Beschrijving: el.beschrijving,
        Minimumleeftijd: el.minimumleeftijd,
        Maximumleeftijd: el.maximumleeftijd,
        Startdatum: el.startdatum,
        KboNummer: el.kboNummer
      }))
      .filter(
        (obj, index, self) =>
          index !==
          self.findIndex(
            t => SHA256(JSON.stringify(t)) === SHA256(JSON.stringify(obj))
          )
      ),
    'Vertegenwoordigers'
  )

  XLSX.utils.book_append_sheet(workbook, generalWorksheet, generalSheetName)
  XLSX.utils.book_append_sheet(workbook, locationWorksheet, locationSheetName)
  XLSX.utils.book_append_sheet(
    workbook,
    representativeWorksheet,
    representativeSheetName
  )
  await XLSX.writeFile(workbook, fileName)
  return fileName
}

export default createSheet
