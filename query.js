import { query as muQuery, update as muUpdate, sparqlEscape } from 'mu';

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

export const queryAssociations = async () => {
    const res = await muQuery(`
    PREFIX schema: <http://schema.org/>
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
    ?minimumleeftijd  ?maximumleeftijd ?koepelNaam ?startdatum  ?kboNummer 
    ?straat ?huisnummer ?busnummer ?postcode ?gemeente ?land
     WHERE {
           ?vereniging a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#FeitelijkeVereniging> ;
           skos:prefLabel ?naam ;
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
            ?vereniging org:memberOf ?koepel .
            ?koepel skos:prefLabel ?koepelNaam .
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
          }}
          ORDER BY DESC(?vCode)
          `);

    return parseResult(res);
}

export const queryAssociationsLocations = async () => {
  const res = await muQuery(`
  PREFIX schema: <http://schema.org/>
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
  ?beschrijving ?minimumleeftijd  ?maximumleeftijd ?koepelNaam ?startdatum  ?kboNummer 
   WHERE {
         ?vereniging a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#FeitelijkeVereniging> ;
         skos:prefLabel ?naam ;
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
          ?vereniging org:memberOf ?koepel .
          ?koepel skos:prefLabel ?koepelNaam .
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
        }}
        ORDER BY DESC(?vCode)
        `);

  return parseResult(res);
}

export const queryAssociationsMembers = async () => {
  const res = await muQuery(`
  PREFIX schema: <http://schema.org/>
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
  ?beschrijving ?minimumleeftijd  ?maximumleeftijd ?koepelNaam ?startdatum  ?kboNummer 
   WHERE {
         ?vereniging a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#FeitelijkeVereniging> ;
         skos:prefLabel ?naam ;
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
          ?vereniging org:memberOf ?koepel .
          ?koepel skos:prefLabel ?koepelNaam .
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
      }

        ORDER BY DESC(?vCode)
        `);

  return parseResult(res);
}

export default queryAssociations;