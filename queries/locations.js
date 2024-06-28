const locations = escapedIds => `
SELECT ?vCode ?naam ?type (GROUP_CONCAT(DISTINCT ?activityName; SEPARATOR = ", ") AS ?hoofdactiviteiten)
  ?beschrijving ?minimumleeftijd ?maximumleeftijd ?startdatum ?kboNummer ?straat ?huisnummer
  ?busnummer ?postcode ?gemeente ?land
WHERE {
  VALUES ?uuid {  ${escapedIds}  }
  ?vereniging a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#FeitelijkeVereniging> ;
              skos:prefLabel ?naam ;
              mu:uuid ?uuid .
  OPTIONAL {
    ?vereniging dcterms:description ?beschrijving .
  }
  OPTIONAL {
    ?vereniging reorg:orgStatus ?status .
    ?status mu:uuid ?statusUuid .
  }
  OPTIONAL {
    ?vereniging ?e ?site .
    ?site a org:Site ;
          organisatie:bestaatUit ?address .
    ?address locn:thoroughfare ?straat ;
             adres:Adresvoorstelling.huisnummer ?huisnummer ;
             locn:postCode ?postcode ;
             adres:gemeentenaam ?gemeente ;
             adres:land ?land .
    OPTIONAL {
      ?address adres:Adresvoorstelling.busnummer ?busnummer .
    }
  }
  OPTIONAL {
    ?vereniging reorg:orgActivity ?activity .
    ?activity mu:uuid ?activityUuid ;
              skos:prefLabel ?activityName .
  }
  OPTIONAL {
    ?vereniging org:classification ?classification .
    ?classification mu:uuid ?classificationUuid ;
                    skos:notation ?type .
  }
  OPTIONAL {
    ?vereniging verenigingen_ext:doelgroep ?doelgroep .
    ?doelgroep verenigingen_ext:minimumleeftijd ?minimumleeftijd ;
               verenigingen_ext:maximumleeftijd ?maximumleeftijd .
  }
  OPTIONAL {
    ?vereniging pav:createdOn ?startdatum .
  }
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
ORDER BY ?vCode`

export default locations
