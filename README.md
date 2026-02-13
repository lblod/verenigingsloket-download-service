# verenigingsloket-download-service

Micro-service for downloading associations data as Excel spreadsheets. Part of the Verenigingsloket application stack.

## Features

- Scheduled export of all associations to Excel
- On-demand export of sensitive data (including representatives) with authorization
- Integration with Vlaanderen's association registry API for representatives data

## API Endpoints

### POST /jobs

Debug endpoint for triggering a spreadsheet export manually.

```bash
curl -X POST http://localhost/jobs
# Or with specific associations:
curl -X POST "http://localhost/jobs?associationIds=uuid1,uuid2"
```

### POST /sensitive-data-jobs

Creates a spreadsheet export including sensitive data (representatives). Requires authentication and authorization.

**Required Headers:**
| Header | Description |
|--------|-------------|
| `mu-session-id` | Valid session ID |
| `mu-auth-allowed-groups` | JSON array of user roles (must include `verenigingen-beheerder` or `verenigingen-lezer`) |
| `X-Request-Reason` | UUID of a valid `ext:ReasonCode` (required when `ENABLE_REQUEST_REASON_CHECK=true`) |

**Response:** Returns 202 with job ID. The job processes asynchronously.

```bash
curl -X POST http://localhost/sensitive-data-jobs \
  -H "mu-session-id: <session-id>" \
  -H "mu-auth-allowed-groups: [{\"name\":\"verenigingen-beheerder\"}]" \
  -H "X-Request-Reason: cd64bd95-2a41-4a76-a927-20df200be10b"
```
Alternatively, if you have it set up within a semantic.works stack, you can use a `proxy_session` cookie for authentication via the identifier.

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid session |
| 403 | Missing required role |
| 400 | Missing or invalid X-Request-Reason header |

## Configuration

### General Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `SHARE_FOLDER` | Path to the shared folder for file storage | `/share` |
| `FILES_GRAPH` | Graph URI for file storage | `http://mu.semte.ch/graphs/organizations` |
| `SOURCE_GRAPH` | Graph URI for source data | `http://mu.semte.ch/graphs/organizations` |
| `SERVICE_NAME` | Service identifier URI | `http://data.lblod.info/services/id/verenigingsloket-download-service` |
| `CRON_PATTERN_SPREADSHEET_JOB` | Cron pattern for scheduled spreadsheet generation | `0 0 * * *` (daily at midnight) |
| `CRON_PATTERN_CLEANUP_JOB` | Cron pattern for cleanup of old files and jobs | `13 1 * * *` (daily at 01:13) |
| `CLEANUP_MAX_AGE_DAYS` | Delete files and jobs older than this many days | `7` |
| `EXCEL_MAX_CELL_LENGTH` | Maximum characters per Excel cell | `32767` |

### Graph Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_GRAPH` | Graph URI for session data | `http://mu.semte.ch/graphs/sessions` |
| `ORGANISATION_GRAPH` | Graph URI for organisation data | `http://mu.semte.ch/graphs/public` |
| `ASSOCIATIONS_GRAPH` | Graph URI for associations data | `http://mu.semte.ch/graphs/organizations` |
| `DATA_ACCESS_LOG_GRAPH` | Graph URI for data access logs | `http://mu.semte.ch/graphs/data-access-logs` |

### Representatives API Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_API_FOR_REPRESENTATIVES` | Fetch representatives from external API instead of SPARQL | `true` |
| `API_URL` | Base URL for the Vlaanderen association API | `https://iv.api.vlaanderen.be/api/v1/organisaties/verenigingen/` |
| `API_VERSION` | API version | `v1` |
| `API_CONCURRENT_REQUESTS` | Maximum concurrent API requests | `10` |
| `CLIENT_ID` | OAuth client ID for API authentication | - |
| `SCOPE` | OAuth scope for API authentication | - |
| `AUD` | OAuth audience for API authentication | - |
| `AUTH_DOMAIN` | OAuth authentication domain | `authenticatie.vlaanderen.be` |
| `ENVIRONMENT` | Environment mode (`DEV` or `PROD`) | `DEV` |
| `AUTHORIZATION_KEY` | Basic auth key for DEV environment | - |

### Authorization Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_REQUEST_REASON_CHECK` | Require X-Request-Reason header for sensitive data | `true` |

## Dispatcher Configuration

To integrate this service in a semantic.works stack, add the following routes to your `dispatcher.ex`:

```elixir
# Verenigingsloket Download Service
match "/verenigingen-downloads/*path", %{ accept: %{ json: true } } do
  Proxy.forward conn, path, "http://verenigingsloket-download/sensitive-data-jobs/"
end
```

### Docker Compose

Add the service to your `docker-compose.yml`:

```yaml
services:
  verenigingsloket-download:
    image: lblod/verenigingsloket-download-service:latest
    volumes:
      - ./data/files:/share
    environment:
      CRON_PATTERN_SPREADSHEET_JOB: "0 0 * * *"
      USE_API_FOR_REPRESENTATIVES: "true"
      CLIENT_ID: "your-client-id"
      SCOPE: "your-scope"
      AUD: "your-audience"
      ENVIRONMENT: "PROD"
      ENABLE_REQUEST_REASON_CHECK: "true"
    volumes:
      - ./config/verenigingsloket-download:/config  # For JWT keys in PROD
```

### Required Data for Authorization

For the `X-Request-Reason` header validation to work, you need to have `ext:ReasonCode` instances in your triplestore. This typically requires a one-time data migration of a concept scheme. An example SPARQL insert to create a reason code:

```sparql
PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

INSERT DATA {
  GRAPH <http://mu.semte.ch/graphs/public> {
    <http://data.lblod.info/reason-codes/cd64bd95-2a41-4a76-a927-20df200be10b> a ext:ReasonCode ;
      mu:uuid "cd64bd95-2a41-4a76-a927-20df200be10b" ;
      skos:prefLabel "Onderzoek naar verenigingen" .
  }
}
```

## Data Access Logging

All requests to the sensitive data endpoint are logged to the `DATA_ACCESS_LOG_GRAPH`. Each log entry includes:

- `ext:SensitiveInformationRead` - RDF type
- `ext:date` - Timestamp of the request
- `ext:success` - Whether the request was authorized
- `ext:person` - URI of the requesting user
- `ext:adminUnit` - URI of the user's administrative unit
- `ext:reason` - URI of the provided reason code
- `ext:resource` - URI of the created job (on success)
- `ext:errorMessage` - Error details (on failure)

This is the same logging mechanism used by [lblod/verenigingsregister-proxy-service](https://github.com/lblod/verenigingsregister-proxy-service).

### Retrieving Access Logs

Query all data access logs:

```sparql
PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?log ?uuid ?date ?resource ?reason ?reasonLabel ?person ?adminUnit ?adminUnitLabel ?success ?etag ?errorMessage
WHERE {
  GRAPH <http://mu.semte.ch/graphs/data-access-logs> {
    ?log a ext:SensitiveInformationRead ;
      mu:uuid ?uuid ;
      ext:date ?date ;
      ext:success ?success .

    OPTIONAL { ?log ext:resource ?resource }
    OPTIONAL {
      ?log ext:reason ?reason
      OPTIONAL {
        GRAPH ?reasonGraph {
          ?reason skos:prefLabel ?reasonLabel .
        }
      }
    }
    OPTIONAL { ?log ext:person ?person }
    OPTIONAL {
      ?log ext:adminUnit ?adminUnit
      OPTIONAL {
        GRAPH <http://mu.semte.ch/graphs/public> {
          ?adminUnit skos:prefLabel ?adminUnitLabel .
        }
      }
    }
    OPTIONAL { ?log ext:etag ?etag }
    OPTIONAL { ?log ext:errorMessage ?errorMessage }
  }
}
ORDER BY DESC(?date)
```
