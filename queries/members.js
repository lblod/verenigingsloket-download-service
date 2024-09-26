const representatives = (escapedIds, graph) => `
SELECT ?vCode ?naam ?type (GROUP_CONCAT(DISTINCT ?activityName; SEPARATOR = ", ") AS ?hoofdactiviteiten)
  ?beschrijving ?minimumleeftijd ?maximumleeftijd ?startdatum ?kboNummer ?voornaam ?achternaam ?email ?telefoonnummer
  (GROUP_CONCAT(DISTINCT ?website; SEPARATOR = "") AS ?websites) (GROUP_CONCAT(DISTINCT ?social; SEPARATOR = "") AS ?socials)
WHERE { GRAPH <${graph}> {
    VALUES ?uuid {  ${escapedIds}  }
    ?vereniging a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#Vereniging> ;
        mu:uuid ?uuid .
    OPTIONAL { ?vereniging skos:prefLabel ?naam . }
    OPTIONAL {
      ?vereniging dcterms:description ?beschrijving .
    }
    OPTIONAL {
      ?vereniging reorg:orgStatus ?status .
      ?status mu:uuid ?statusUuid .
    }
    OPTIONAL {
      ?vereniging reorg:orgActivity ?activity .
      ?activity mu:uuid ?activityUuid ;
                skos:prefLabel ?activityName .
    }
    OPTIONAL {
      ?vereniging org:classification ?classification .
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
    ?vereniging org:hasMembership ?membership .
    OPTIONAL {
      ?membership a org:Membership ;
                  mu:uuid ?membershipUuid ;
                  org:member ?person .
      OPTIONAL {
        ?person a person:Person ;
                mu:uuid ?personUuid ;
                foaf:givenName ?voornaam ;
                foaf:familyName ?achternaam .
      }
      OPTIONAL {
        ?person schema:contactPoint ?contactMemberPhone .
        ?contactMemberPhone a schema:ContactPoint ;
                            mu:uuid ?contactMemberPhoneUuid ;
                            schema:telephone ?telefoonnummer .
      }
      OPTIONAL {
        ?person schema:contactPoint ?contactMemberEmail .
        ?contactMemberEmail a schema:ContactPoint ;
                            mu:uuid ?contactMemberEmailUuid ;
                            schema:email ?email .
      }
      OPTIONAL {
        ?person schema:contactPoint ?contactMemberSocialMedia .
        ?contactMemberSocialMedia a schema:ContactPoint ;
                                  mu:uuid ?contactMemberSocialMediaUuid ;
                                  foaf:name ?sitenName ;
                                  foaf:page ?page .
        BIND (IF(str(?page) = "Website", ?page, "") AS ?website)
        BIND (IF(str(?page) != "Website", ?page, "") AS ?social)
      }
    }
  }
  GRAPH <http://mu.semte.ch/graphs/public> {
    ?classification  skos:notation ?type .
  }
}
ORDER BY ?vCode`

export default representatives
