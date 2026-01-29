export const SHARE_FOLDER = process.env.SHARE_FOLDER || '/share';
export const FILES_GRAPH = process.env.FILES_GRAPH || 'http://mu.semte.ch/graphs/organizations';
export const SOURCE_GRAPH = process.env.SOURCE_GRAPH || 'http://mu.semte.ch/graphs/organizations';
export const SERVICE_NAME = process.env.SERVICE_NAME || 'http://data.lblod.info/services/id/verenigingsloket-download-service';
export const CRON_PATTERN_SPREADSHEET_JOB = process.env.CRON_PATTERN_SPREADSHEET_JOB || '0 0 * * *';
export const CRON_PATTERN_CLEANUP_JOB = process.env.CRON_PATTERN_CLEANUP_JOB || '13 1 * * *';
export const CLEANUP_MAX_AGE_DAYS = parseInt(process.env.CLEANUP_MAX_AGE_DAYS, 10) || 7;
export const EXCEL_MAX_CELL_LENGTH = parseInt(process.env.EXCEL_MAX_CELL_LENGTH, 10) || 32767;
export const SESSION_GRAPH = process.env.SESSION_GRAPH || 'http://mu.semte.ch/graphs/sessions';
export const ORGANISATION_GRAPH = process.env.ORGANISATION_GRAPH || 'http://mu.semte.ch/graphs/public';
export const ASSOCIATIONS_GRAPH = process.env.ASSOCIATIONS_GRAPH || 'http://mu.semte.ch/graphs/organizations';

// API Configuration for Representatives
export const API_BASE = process.env.API_URL || 'https://iv.api.vlaanderen.be/api/v1/organisaties/verenigingen/';
export const API_VERSION = process.env.API_VERSION || 'v1';
export const SCOPE = process.env.SCOPE;
export const ENVIRONMENT = process.env.ENVIRONMENT || 'DEV';
export const AUTHORIZATION_KEY = process.env.AUTHORIZATION_KEY || '';
export const AUD = process.env.AUD;
export const AUTH_DOMAIN = process.env.AUTH_DOMAIN || 'authenticatie.vlaanderen.be';
export const API_CONCURRENT_REQUESTS = parseInt(process.env.API_CONCURRENT_REQUESTS, 10) || 10;
export const USE_API_FOR_REPRESENTATIVES = process.env.USE_API_FOR_REPRESENTATIVES !== 'false';
export const CLIENT_ID = process.env.CLIENT_ID;

// Authorization Configuration
export const ENABLE_REQUEST_REASON_CHECK = process.env.ENABLE_REQUEST_REASON_CHECK !== 'false';
export const DATA_ACCESS_LOG_GRAPH = process.env.DATA_ACCESS_LOG_GRAPH || 'http://mu.semte.ch/graphs/data-access-logs';
