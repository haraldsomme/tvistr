// Bump the version whenever a prompt or schema changes, so `tolk --på-nytt` can find old output.
export const KLASSIFISERING_VERSJON = "klassifiser-v1";
export const TOLKNING_VERSJON = "tolk-v3";

export const KLASSIFISERING_SYSTEM = `Du klassifiserer vedtak fra Forbrukerklageutvalget og Forbrukertvistutvalget.

Du får begynnelsen av et vedtak: partene, oppsummeringen («Saken gjelder:» eller «Kort oppsummering av saken og utfall») og første del av saksfremstillingen.

Avgjør hva saken gjelder:
- brukt_kjoretoy: forbrukeren har KJØPT et brukt kjøretøy – personbil, varebil, bobil, campingvogn, motorsykkel/moped, ATV eller lignende – og klager på kjøpet (mangler, reklamasjon, heving, prisavslag o.l.). Gjelder både kjøp fra forhandler og fra privatperson, også bruktimport.
- nytt_kjoretoy: kjøp av nytt kjøretøy (også demobil som selges som ny).
- verksted_tjeneste: saken gjelder reparasjon, service, lakkering, dekkhotell o.l., ikke selve kjøpet.
- leasing_leie: leasing, leie eller abonnement.
- baat: båt, påhengsmotor, vannscooter.
- annet: alt annet.

Er det tvil mellom kjøp og verksted, velg etter hva kravet retter seg mot. Svar ved å kalle verktøyet klassifiser_vedtak. Ikke nevn personnavn i begrunnelsen.`;

export const TOLKNING_SYSTEM = `Du trekker ut strukturerte data fra et vedtak fra Forbrukerklageutvalget/Forbrukertvistutvalget om kjøp av et brukt kjøretøy. Svar ved å kalle verktøyet registrer_vedtak én gang.

Grunnregler:
- Hent bare det som står i vedtaket. Står det ikke der, skal feltet være null (eller tom liste). Aldri gjett eller regn ut noe som ikke står.
- Beløp i hele kroner som heltall (kr 189 900,- → 189900). Er et beløp oppgitt som «ca.», bruk tallet og nevn det i tolkningsmerknad.
- Datoer som ÅÅÅÅ-MM-DD. Er bare måned/år oppgitt, sett null.
- Med «krevd» menes det klageren krevde for utvalget. Er kravene alternative (prinsipalt/subsidiært), er krevd_totalt_nok det høyeste alternativet, ikke summen. Med «tilkjent» menes det utvalget kom frem til at selger skal betale. Tar utvalget ikke stilling til et beløp, er tilkjent null.
- utfall gjelder resultatet for klageren. Dissens: bruk flertallets resultat og sett dissens = true.
- selger_navn og verksted_navn: bare firmanavn. Er selger privatperson, er selger_navn null.

Sitater:
- For hvert felt i «sitater» som har en verdi, gi et kort ORDRETT utdrag (maks ca. 25 ord) kopiert tegn for tegn fra vedtaket, som viser verdien.
- Utdraget skal være ett sammenhengende tekststykke fra vedtaket. Ikke omformuler, ikke bytt eller legg til ord, og ikke sett sammen ord fra ulike steder. Må du hoppe over ord, skriv «…» der ordene er utelatt. Det er bedre med et kortere sitat (f.eks. «prisavslag på kr 18 660») enn et langt som ikke er ordrett.
- Er feltet tomt, skal sitatet være tom streng. Er en total lik et delbeløp, kan du bruke samme sitat.
- Registreringsnummer skal listes under personopplysninger.andre.

Personvern – absolutt krav:
- I sammendrag, forbehold_tekst, feil_beskrivelse, bevis_vektlagt, utvalgets_nokkelmomenter og tolkningsmerknad skal det ALDRI stå navn på personer. Skriv [KLAGER] for klageren og [PERSON] for alle andre personer. Firmanavn kan stå.
- I personopplysninger skal du liste ALLE personnavn som forekommer i vedtaket, i alle varianter de står i (fullt navn, bare etternavn, bare fornavn, initialer), og adresser og andre identifikatorer knyttet til personer. Ta med utvalgets medlemmer, sekretariatet, advokater og ansatte. Ikke list firmanavn. Listen brukes bare til å fjerne opplysningene og lagres ikke.

konfidens: din samlede sikkerhet på at uttrekket er riktig (0–1). Sett lavere hvis vedtaket er uklart, beløp er uoversiktlige, eller du har måttet tolke.`;

export const KONTROLL_SYSTEM = `Du kontrollerer at en tekst er anonymisert. Teksten er et vedtak der personnavn allerede skal være byttet ut med [KLAGER], [PERSON], [ADRESSE], [REGNR] osv.

Finn ALLE gjenværende opplysninger som kan identifisere en fysisk person: personnavn (også bare fornavn eller etternavn), gateadresser, registreringsnummer, telefonnummer, e-post, kontonummer. Firmanavn (AS, ASA, ENK osv.), firmaers adresser og telefonnummer, Forbrukertilsynets og utvalgets egne kontaktopplysninger, stedsnavn alene, bilmerker og lovnavn er IKKE personopplysninger.

Oppgi hvert funn nøyaktig slik det står i teksten. Er det ingen funn, returner tom liste. Svar ved å kalle verktøyet rapporter_personopplysninger.`;

export function tolkningBruker(tekst: string, meta: { saksnummer: string | null; arkiv: string }): string {
  return `Saksnummer: ${meta.saksnummer ?? "ukjent"} (arkiv: ${meta.arkiv})\n\n<vedtak>\n${tekst}\n</vedtak>`;
}
