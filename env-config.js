export const SHARE_FOLDER = process.env.SHARE_FOLDER || '/share';
export const FILES_GRAPH = process.env.FILES_GRAPH || 'http://mu.semte.ch/graphs/organizations';
export const SOURCE_GRAPH = process.env.SOURCE_GRAPH || 'http://mu.semte.ch/graphs/organizations';
export const SERVICE_NAME = process.env.SERVICE_NAME || 'http://data.lblod.info/services/id/verenigingsloket-download-service';
export const CRON_PATTERN_SPREADSHEET_JOB = process.env.CRON_PATTERN_SPREADSHEET_JOB || '0 0 * * *';
export const EXCEL_MAX_CELL_LENGTH = parseInt(process.env.EXCEL_MAX_CELL_LENGTH, 10) || 32767;
export const SESSION_GRAPH = process.env.SESSION_GRAPH || 'http://mu.semte.ch/graphs/sessions';
