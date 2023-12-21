import XLSX from 'xlsx-js-style';

const createSheet = async (generalData, locationsData,membersData) => {
const currentDate = new Date();
      const timestamp = currentDate
        .toISOString()
        .replace(/[-:]/g, '_')
        .replace(/\.\d+/, '');
      const fileName = `verenigingen_${timestamp}.xlsx`;
      const style = { font: { sz: 14, bold: true } };

      const createSheet = (data, sheetName) => {
        const rowStyle = { rows: [], width: [] };
        if (data && data.length > 0) {
          const keys = Object.keys(data[0]);
          keys.forEach((key) => {
            if (key) {
              rowStyle.rows.push({ v: key, t: 's', s: style });
              rowStyle.width.push({ wch: key.length + 6 });
            }
          });
        }

        const worksheet = XLSX.utils.json_to_sheet(data);
        worksheet['!cols'] = rowStyle.width;
        XLSX.utils.sheet_add_aoa(worksheet, [rowStyle.rows]);

        return { worksheet, sheetName };
      };


      const workbook = XLSX.utils.book_new();
      const { worksheet: generalWorksheet, sheetName: generalSheetName } =
        createSheet(generalData, 'Algemeen');
      const { worksheet: locationWorksheet, sheetName: locationSheetName } =
        createSheet(locationsData, 'Locaties');

      const {
        worksheet: representativeWorksheet,
        sheetName: representativeSheetName,
      } = createSheet(membersData, 'Vertegenwoordigers');

      XLSX.utils.book_append_sheet(
        workbook,
        generalWorksheet,
        generalSheetName,
      );
      XLSX.utils.book_append_sheet(
        workbook,
        locationWorksheet,
        locationSheetName,
      );
      XLSX.utils.book_append_sheet(
        workbook,
        representativeWorksheet,
        representativeSheetName,
      );
    await XLSX.writeFile(workbook, fileName);
    return fileName;

}

export default createSheet;