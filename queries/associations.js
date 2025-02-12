const associations = (escapedIds, graph) => `
SELECT DISTINCT ?vCode ?naam ?type (GROUP_CONCAT(DISTINCT ?activityName; SEPARATOR = ", ") AS ?hoofdactiviteiten)
  ?beschrijving ?minimumleeftijd ?maximumleeftijd ?startdatum ?kboNummer ?straat ?huisnummer
  ?busnummer ?postcode ?gemeente ?land
WHERE { GRAPH <${graph}> {
    VALUES ?uuid {  ${escapedIds}  }
  ?vereniging a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#FeitelijkeVereniging> ;
    mu:uuid ?uuid .

    OPTIONAL { ?vereniging skos:prefLabel ?naam . }
    OPTIONAL { ?vereniging dcterms:description ?beschrijving . }
    OPTIONAL {
      ?vereniging org:hasPrimarySite ?primarySite .
      OPTIONAL {
        ?primarySite organisatie:bestaatUit ?address .
        OPTIONAL {
          ?address a locn:Address ;
                    mu:uuid ?adUuid .
          OPTIONAL { ?address locn:postCode ?postcode . }
          OPTIONAL { ?address locn:thoroughfare ?straat . }
          OPTIONAL { ?address adres:land ?land . }
          OPTIONAL { ?address adres:gemeentenaam ?gemeente . }
          OPTIONAL { ?address adres:Adresvoorstelling.busnummer ?busnummer . }
          OPTIONAL { ?address adres:Adresvoorstelling.huisnummer ?huisnummer . }
        }
      }
    }
    OPTIONAL {
      ?vereniging reorg:orgActivity ?activity .
      ?activity mu:uuid ?activityUuid ;
                skos:prefLabel ?activityName .
    }
    OPTIONAL { ?vereniging org:classification ?classification . }
    OPTIONAL {
      ?vereniging verenigingen_ext:doelgroep ?doelgroep .
      ?doelgroep verenigingen_ext:minimumleeftijd ?minimumleeftijd ;
                verenigingen_ext:maximumleeftijd ?maximumleeftijd .
    }
    OPTIONAL { ?vereniging pav:createdOn ?startdatum . }
    OPTIONAL {
      ?vereniging adms:identifier ?identifier .
      ?identifier skos:notation "KBO nummer" ;
                  generiek:gestructureerdeIdentificator ?structuredID .
      ?structuredID generiek:lokaleIdentificator ?kboNummer .
    }
    OPTIONAL {
      ?vereniging adms:identifier ?Videntifier .
      ?Videntifier skos:notation "vCode" ;
                  generiek:gestructureerdeIdentificator ?VstructuredID .
      ?VstructuredID generiek:lokaleIdentificator ?vCode .
    }
  }
  GRAPH <http://mu.semte.ch/graphs/public> {
    ?classification skos:notation ?type .
  }
}
ORDER BY ?vCode`

export default associations
