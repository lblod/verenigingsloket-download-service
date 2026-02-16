/**
 * Maps API responses to the format expected by sheet.js createSheet()
 *
 * API Response Structure:
 * {
 *   "vereniging": {
 *     "vCode": "V0012345",
 *     "naam": "Vereniging Naam",
 *     "vertegenwoordigers": [{ voornaam, achternaam, e-mail, telefoon, rol }],
 *     "contactgegevens": [{ contactgegeventype, waarde }],
 *     "hoofdactiviteitenVerenigingsloket": [{ naam }],
 *     "verenigingstype": { naam },
 *     "doelgroep": { minimumleeftijd, maximumleeftijd },
 *     "sleutels": [{ codeerSysteem, waarde }]
 *   }
 * }
 *
 * Expected Output (per representative - matches sheet.js lines 93-110):
 * {
 *   vCode, voornaam, achternaam, email,
 *   websites, socials, naam, type, hoofdactiviteiten,
 *   beschrijving, minimumleeftijd, maximumleeftijd, startdatum, kboNummer
 * }
 */

/**
 * Extract KBO number from sleutels array
 */
function extractKboNummer(sleutels) {
  if (!sleutels || !Array.isArray(sleutels)) return undefined;

  const kboSleutel = sleutels.find(s =>
    s.codeerSysteem === 'KBO' ||
    s.codeerSysteem === 'KboNummer' ||
    s.bron === 'KBO'
  );

  return kboSleutel?.waarde || kboSleutel?.gestructureerdeIdentificator?.nummer || undefined;
}

/**
 * Extract and format contact data (websites and socials)
 */
function extractContactData(contactgegevens) {
  if (!contactgegevens || !Array.isArray(contactgegevens)) {
    return { websites: '', socials: '' };
  }

  const websites = contactgegevens
    .filter(c => c.contactgegeventype === 'Website')
    .map(c => c.waarde)
    .filter(Boolean)
    .join(', ');

  // Only include SocialMedia type (facebook, youtube, etc.)
  // Exclude Telefoon and E-mail which are separate contact types
  const socials = contactgegevens
    .filter(c => c.contactgegeventype === 'SocialMedia')
    .map(c => c.waarde)
    .filter(Boolean)
    .join(', ');

  return { websites, socials };
}

/**
 * Extract hoofdactiviteiten as comma-separated string
 */
function extractHoofdactiviteiten(activiteiten) {
  if (!activiteiten || !Array.isArray(activiteiten)) return '';

  return activiteiten
    .map(a => a.naam)
    .filter(Boolean)
    .join(', ');
}

/**
 * Map a single API response to representative records
 */
function mapSingleResponse(response) {
  const vereniging = response?.vereniging;
  if (!vereniging) return [];

  const vertegenwoordigers = vereniging.vertegenwoordigers || [];
  const { websites, socials } = extractContactData(vereniging.contactgegevens);
  const hoofdactiviteiten = extractHoofdactiviteiten(vereniging.hoofdactiviteitenVerenigingsloket);

  // Common association data for all representatives
  const associationData = {
    vCode: vereniging.vCode,
    naam: vereniging.naam,
    type: vereniging.verenigingstype?.code,
    hoofdactiviteiten,
    beschrijving: vereniging.korteBeschrijving,
    minimumleeftijd: vereniging.doelgroep?.minimumleeftijd,
    maximumleeftijd: vereniging.doelgroep?.maximumleeftijd,
    startdatum: vereniging.startdatum,
    kboNummer: extractKboNummer(vereniging.sleutels),
    websites,
    socials,
  };

  // If there are representatives, create one record per representative
  if (vertegenwoordigers.length > 0) {
    return vertegenwoordigers.map(rep => ({
      ...associationData,
      voornaam: rep.voornaam,
      achternaam: rep.achternaam,
      email: rep['e-mail'], // API uses "e-mail" with hyphen
    }));
  }

  // If no representatives, don't include this association in the representatives sheet
  return [];
}

/**
 * Map multiple API responses to representative records
 * @param {Object[]} apiResponses - Array of API response objects
 * @returns {Object[]} Array of representative records for sheet.js
 */
export function mapApiResponseToRepresentatives(apiResponses) {
  if (!apiResponses || !Array.isArray(apiResponses)) {
    return [];
  }

  const representatives = [];

  for (const response of apiResponses) {
    const mapped = mapSingleResponse(response);
    representatives.push(...mapped);
  }

  return representatives;
}
