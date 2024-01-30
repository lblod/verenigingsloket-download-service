import { query as muQuery, sparqlEscape } from 'mu';

/**
 * convert results of select query to an array of objects.
 * courtesy: Niels Vandekeybus & Felix
 * @method parseResult
 * @return {Array}
 */
export function parseResult( result ) {
    if(!(result.results && result.results.bindings.length)) return [];
  
    const bindingKeys = result.head.vars;
    return result.results.bindings.map((row) => {
      const obj = {};
      bindingKeys.forEach((key) => {
        if(row[key] && row[key].datatype == 'http://www.w3.org/2001/XMLSchema#integer' && row[key].value){
          obj[key] = parseInt(row[key].value);
        }
        else if(row[key] && row[key].datatype == 'http://www.w3.org/2001/XMLSchema#dateTime' && row[key].value){
          obj[key] = new Date(row[key].value);
        }
        else obj[key] = row[key] ? row[key].value:undefined;
      });
      return obj;
    });
  }

export const queryAssociations = async (uuids) => {
    const res = await muQuery(`
    PREFIX schema: <http://schema.org/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX dc: <http://purl.org/dc/terms/>
    PREFIX org: <http://www.w3.org/ns/org#>
    PREFIX verenigingen_ext: <http://data.lblod.info/vocabularies/FeitelijkeVerenigingen/> 
    PREFIX locn: <http://www.w3.org/ns/locn#> 
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX generiek: <https://data.vlaanderen.be/ns/generiek#>
    PREFIX adres: <https://data.vlaanderen.be/ns/adres#>
    PREFIX organisatie: <https://data.vlaanderen.be/ns/organisatie#>
    PREFIX regorg: <http://www.w3.org/ns/regorg#>


    SELECT ?vCode ?naam ?type 
    (GROUP_CONCAT(DISTINCT ?activityName; separator=", ") as ?hoofdactiviteiten)
    ?beschrijving 
    ?minimumleeftijd  ?maximumleeftijd ?startdatum  ?kboNummer 
    ?straat ?huisnummer ?busnummer ?postcode ?gemeente ?land
     WHERE {
           ?vereniging a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#FeitelijkeVereniging> ;
           skos:prefLabel ?naam ;
           mu:uuid ?uuid;
           dc:description ?beschrijving ;
           org:hasPrimarySite ?primaryAddress .
           ?primaryAddress organisatie:bestaatUit ?address .
           ?address locn:thoroughfare ?straat ;
           adres:Adresvoorstelling.huisnummer ?huisnummer ;
           locn:postCode ?postcode ;
           adres:gemeentenaam ?gemeente ;
           adres:land ?land .

           optional {
            ?vereniging regorg:orgActivity ?activity . 
            ?activity skos:prefLabel ?activityName .
           }
           
           optional {
            ?address adres:Adresvoorstelling.busnummer ?busnummer . 
           }

           optional{ 
            ?verengiging org:classification ?classification .
            ?classification skos:notation ?type .
          }
           optional{ 
            ?vereniging  verenigingen_ext:doelgroep ?doelgroep .
            ?doelgroep  verenigingen_ext:minimumleeftijd ?minimumleeftijd ;
            verenigingen_ext:maximumleeftijd ?maximumleeftijd .
          }
          optional {
            ?changeEvent org:resultingOrganization ?vereniging ;
            locn:veranderingsgebeurtenisResultaat  <http://lblod.data.gift/concepts/f0e2706a-3b64-4464-ad9c-4e65dc976288> ;
            dct:date ?startdatum .
          }
          optional {
            ?vereniging adms:identifier ?identifier .
            ?identifier skos:notation "KBO nummer";
            generiek:gestructureerdeIdentificator ?structuredID .
            ?structuredID generiek:lokaleIdentificator ?kboNummer .
          }

          optional {
            ?vereniging adms:identifier ?Videntifier .
            ?Videntifier skos:notation "vCode";
            generiek:gestructureerdeIdentificator ?VstructuredID .
            ?VstructuredID generiek:lokaleIdentificator ?vCode .
          }
        
          FILTER(
            ?uuid IN (${uuids.map((el)=> (sparqlEscape(el))).join(',')})
            )
        }
          ORDER BY (?vCode)
          `);

    return parseResult(res);
}

export const queryAssociationsLocations = async (uuids) => {
  const res = await muQuery(`
  PREFIX schema: <http://schema.org/>
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
  PREFIX dc: <http://purl.org/dc/terms/>
  PREFIX org: <http://www.w3.org/ns/org#>
  PREFIX verenigingen_ext: <http://data.lblod.info/vocabularies/FeitelijkeVerenigingen/> 
  PREFIX locn: <http://www.w3.org/ns/locn#> 
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX adms: <http://www.w3.org/ns/adms#>
  PREFIX generiek: <https://data.vlaanderen.be/ns/generiek#>
  PREFIX adres: <https://data.vlaanderen.be/ns/adres#>
  PREFIX organisatie: <https://data.vlaanderen.be/ns/organisatie#>
  PREFIX regorg: <http://www.w3.org/ns/regorg#>


  SELECT ?vCode ?straat ?huisnummer ?busnummer ?postcode ?gemeente ?land ?naam
  ?type (GROUP_CONCAT(DISTINCT ?activityName; separator=", ") as ?hoofdactiviteiten)
  ?beschrijving ?minimumleeftijd  ?maximumleeftijd ?startdatum  ?kboNummer 
   WHERE {
         ?vereniging a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#FeitelijkeVereniging> ;
         skos:prefLabel ?naam ;
         mu:uuid ?uuid;
         dc:description ?beschrijving .

         optional {
          ?vereniging ?e ?site .
          ?site a org:Site ;
          organisatie:bestaatUit ?address .
          ?address locn:thoroughfare ?straat ;
          adres:Adresvoorstelling.huisnummer ?huisnummer ;
          locn:postCode ?postcode ;
          adres:gemeentenaam ?gemeente ;
          adres:land ?land .
          optional {
            ?address adres:Adresvoorstelling.busnummer ?busnummer . 
           }
         }

         optional {
          ?vereniging regorg:orgActivity ?activity . 
          ?activity skos:prefLabel ?activityName .
         }
         
         optional{ 
          ?verengiging org:classification ?classification .
          ?classification skos:notation ?type .
        }
         optional{ 
          ?vereniging  verenigingen_ext:doelgroep ?doelgroep .
          ?doelgroep  verenigingen_ext:minimumleeftijd ?minimumleeftijd ;
          verenigingen_ext:maximumleeftijd ?maximumleeftijd .
        }
        optional {
          ?changeEvent org:resultingOrganization ?vereniging ;
          locn:veranderingsgebeurtenisResultaat  <http://lblod.data.gift/concepts/f0e2706a-3b64-4464-ad9c-4e65dc976288> ;
          dct:date ?startdatum .
        }
        optional {
          ?vereniging adms:identifier ?identifier .
          ?identifier skos:notation "KBO nummer";
          generiek:gestructureerdeIdentificator ?structuredID .
          ?structuredID generiek:lokaleIdentificator ?kboNummer .
        }

        optional {
          ?vereniging adms:identifier ?Videntifier .
          ?Videntifier skos:notation "vCode";
          generiek:gestructureerdeIdentificator ?VstructuredID .
          ?VstructuredID generiek:lokaleIdentificator ?vCode .
        }
         FILTER(
          ?uuid IN (${uuids.map((el)=> (sparqlEscape(el))).join(',')})
        )
      }

       
        ORDER BY (?vCode)
        `);

  return parseResult(res);
}

export const queryAssociationsMembers = async (uuids) => {
  const res = await muQuery(`
  PREFIX schema: <http://schema.org/>
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
  PREFIX dc: <http://purl.org/dc/terms/>
  PREFIX org: <http://www.w3.org/ns/org#>
  PREFIX verenigingen_ext: <http://data.lblod.info/vocabularies/FeitelijkeVerenigingen/> 
  PREFIX locn: <http://www.w3.org/ns/locn#> 
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX adms: <http://www.w3.org/ns/adms#>
  PREFIX generiek: <https://data.vlaanderen.be/ns/generiek#>
  PREFIX adres: <https://data.vlaanderen.be/ns/adres#>
  PREFIX organisatie: <https://data.vlaanderen.be/ns/organisatie#>
  PREFIX regorg: <http://www.w3.org/ns/regorg#>


  SELECT ?vCode ?voornaam ?achternaam ?email ?telefoonnummer 
  (GROUP_CONCAT(DISTINCT ?website; separator="") AS ?websites)
  (GROUP_CONCAT(DISTINCT ?social; separator="") AS ?socials)
   ?naam
  ?type (GROUP_CONCAT(DISTINCT ?activityName; separator=", ") as ?hoofdactiviteiten)
  ?beschrijving ?minimumleeftijd  ?maximumleeftijd ?startdatum  ?kboNummer 
   WHERE {
         ?vereniging a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#FeitelijkeVereniging> ;
         skos:prefLabel ?naam ;
         mu:uuid ?uuid;
         dc:description ?beschrijving .

         optional {
          ?vereniging regorg:orgActivity ?activity . 
          ?activity skos:prefLabel ?activityName .
         }
         
         optional{ 
          ?verengiging org:classification ?classification .
          ?classification skos:notation ?type .
        }

         optional{ 
          ?vereniging  verenigingen_ext:doelgroep ?doelgroep .
          ?doelgroep  verenigingen_ext:minimumleeftijd ?minimumleeftijd ;
          verenigingen_ext:maximumleeftijd ?maximumleeftijd .
        }
        optional {
          ?changeEvent org:resultingOrganization ?vereniging ;
          locn:veranderingsgebeurtenisResultaat  <http://lblod.data.gift/concepts/f0e2706a-3b64-4464-ad9c-4e65dc976288> ;
          dct:date ?startdatum .
        }
        optional {
          ?vereniging adms:identifier ?identifier .
          ?identifier skos:notation "KBO nummer";
          generiek:gestructureerdeIdentificator ?structuredID .
          ?structuredID generiek:lokaleIdentificator ?kboNummer .
        }

        optional {
          ?vereniging adms:identifier ?Videntifier .
          ?Videntifier skos:notation "vCode";
          generiek:gestructureerdeIdentificator ?VstructuredID .
          ?VstructuredID generiek:lokaleIdentificator ?vCode .
        }

        ?membership a <http://www.w3.org/ns/org#Membership> ;
        org:organization ?vereniging ;
        org:member ?member .
        ?member foaf:givenName ?voornaam ;
        foaf:familyName ?achternaam .

        optional {
          ?member org:basedAt ?site .
          ?site org:siteAddress ?siteAddress . 
          ?siteAddress schema:email ?email ;
          schema:telephone ?telefoonnummer .
        }
        optional {
          ?member org:basedAt ?osite .
          ?osite org:siteAddress ?ositeAddress . 
          ?ositeAddress foaf:name ?siteName ;
          foaf:page ?sitePage .
          BIND(IF(STR(?siteName) = "Website", ?sitePage, "") AS ?website)
          BIND(IF(STR(?siteName) != "Website", ?sitePage, "") AS ?social)
        }
        FILTER(
          ?uuid IN (${uuids.map((el)=> (sparqlEscape(el))).join(',')})
        )
      }

      ORDER BY (?vCode)
      `);

  return parseResult(res);
}

export const queryAssociationsId = async (query) => {
  const {
    search, 
    activities, 
    status,
    postalCodes,
    types,
    targetAudiences
  } = query;

    const targetArray = targetAudiences ? targetAudiences.split(',') : null;
    
    const targetQuery = [];
    if(targetArray){
    if(targetArray.includes('-18')) {
      targetQuery.push('(?minimumleeftijd <= 18)')
    }
    if(targetArray.includes('18+')) {
      targetQuery.push('(?maximumleeftijd >= 18)')
    }
    if(targetArray.includes('65+')) {
      targetQuery.push('(?maximumleeftijd >= 35)')
    }
  }

      
      const res = await muQuery(`
  PREFIX schema: <http://schema.org/>
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
  PREFIX dc: <http://purl.org/dc/terms/>
  PREFIX org: <http://www.w3.org/ns/org#>
  PREFIX verenigingen_ext: <http://data.lblod.info/vocabularies/FeitelijkeVerenigingen/> 
  PREFIX locn: <http://www.w3.org/ns/locn#> 
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX adms: <http://www.w3.org/ns/adms#>
  PREFIX generiek: <https://data.vlaanderen.be/ns/generiek#>
  PREFIX adres: <https://data.vlaanderen.be/ns/adres#>
  PREFIX organisatie: <https://data.vlaanderen.be/ns/organisatie#>
  PREFIX regorg: <http://www.w3.org/ns/regorg#>


  SELECT DISTINCT ?uuid
   WHERE {
         ?vereniging a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#FeitelijkeVereniging> ;
         skos:prefLabel ?naam ;
         mu:uuid ?uuid .

         optional {
          ?vereniging regorg:orgActivity ?activity . 
          ?activity mu:uuid ?activityUuid ;
            skos:prefLabel ?activityName .
         }

         optional {
          ?vereniging ?e ?site .
          ?site a org:Site ;
          organisatie:bestaatUit ?address .
          ?address locn:postCode ?postcode .
  
         }

         optional {
          ?vereniging regorg:orgStatus ?status .
          ?status mu:uuid ?statusUuid .
         }
         
         optional{ 
          ?verengiging org:classification ?classification .
          ?classification mu:uuid ?classificationUuid .
                }
        optional {
          ?vereniging adms:identifier ?identifier .
          ?identifier skos:notation "KBO nummer";
          generiek:gestructureerdeIdentificator ?structuredID .
          ?structuredID generiek:lokaleIdentificator ?kboNummer .
        }

        optional{ 
          ?vereniging  verenigingen_ext:doelgroep ?doelgroep .
          ?doelgroep  verenigingen_ext:minimumleeftijd ?minimumleeftijd ;
          verenigingen_ext:maximumleeftijd ?maximumleeftijd .
        }

        optional {
          ?vereniging adms:identifier ?Videntifier .
          ?Videntifier skos:notation "vCode";
          generiek:gestructureerdeIdentificator ?VstructuredID .
          ?VstructuredID generiek:lokaleIdentificator ?vCode .
        }

        optional {
        ?membership a <http://www.w3.org/ns/org#Membership> ;
        org:organization ?vereniging ;
        org:member ?member .
        ?member foaf:givenName ?voornaam ;
        foaf:familyName ?achternaam .
        }



        ${search != null ? ` FILTER (
          CONTAINS(LCASE(?vCode), ${sparqlEscape(search.toLowerCase())}) ||
          CONTAINS(LCASE(?naam), ${sparqlEscape(search.toLowerCase())}) ||
          CONTAINS(LCASE(?activityName), ${sparqlEscape(search.toLowerCase())}) ||
          CONTAINS(LCASE(?voornaam), ${sparqlEscape(search.toLowerCase())}) ||
          CONTAINS(LCASE(?achternaam), ${sparqlEscape(search.toLowerCase())})
        )`: ''}

        ${activities != null ? `
        FILTER(
          ?activityUuid IN (${sparqlEscape(activities)})
        )
        ` : ''}

        ${status != null ? `
        FILTER(
          ?statusUuid IN (${sparqlEscape(status)})
        )
        `: ''}

        ${types != null ? `
        FILTER(
          ?classificationUuid IN (${sparqlEscape(types)})
        )
        `: ''}
        ${postalCodes != null ? `
        FILTER(
          ?postcode IN (${sparqlEscape(postalCodes)})
        )
        `: ''}
        ${targetAudiences != null ? `
        FILTER(
          ${targetQuery.join('||')}
        )
        `: ''}
      }

      ORDER BY (?vCode)
      `);

      return parseResult(res);
    }
    

export default queryAssociations;