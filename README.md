# verenigingsloket-download-service
 Micro-service for dowloading associations

## Configuration

The service can be configured using the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SHARE_FOLDER` | Path to the shared folder for file storage | `/share` |
| `FILES_GRAPH` | Graph URI for file storage | `http://mu.semte.ch/graphs/organizations` |
| `SOURCE_GRAPH` | Graph URI for source data | `http://mu.semte.ch/graphs/organizations` |
| `SERVICE_NAME` | Service identifier URI | `http://data.lblod.info/services/id/verenigingsloket-download-service` |
| `CRON_PATTERN_SPREADSHEET_JOB` | Cron pattern for scheduled spreadsheet generation | `0 0 * * *` (daily at midnight) |
| `CHUNK_SIZE` | Number of associations to process per batch | `100` |
| `FEATURE_INCLUDE_REPRESENTATIVES` | Include representatives tab in export | `false` |
