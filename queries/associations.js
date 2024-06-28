const associations = escapedIds => `

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

 ?vereniging org:hasPrimarySite ?primarySite .
      ?primarySite organisatie:bestaatUit ?address .
      OPTIONAL {
        ?address a <http://www.w3.org/ns/locn#Address> ;
               mu:uuid ?adUuid ;
               locn:postCode ?postcode ;
               locn:thoroughfare ?straat ;
               adres:land ?land ;
               adres:gemeentenaam ?gemeente .
        OPTIONAL {
          ?address adres:Adresvoorstelling.busnummer ?busnummer .
        }
        OPTIONAL {
          ?address adres:Adresvoorstelling.huisnummer ?huisnummer .
        }
      }


  OPTIONAL {
    ?vereniging reorg:orgActivity ?activity .
    ?activity mu:uuid ?activityUuid ;
              skos:prefLabel ?activityName .
  }
  OPTIONAL {
    ?vereniging org:classification ?classification .
    ?classification  skos:notation ?type .
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

export default associations
