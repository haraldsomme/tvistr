import { KATEGORIER, type Skjema } from "@/lib/skjema/skjema";
import type { SakSvar } from "./actions";

const SPOR: Record<string, string> = {
  A: "Selger ga opplysninger som ikke stemte, eller holdt tilbake opplysninger",
  B: "Feilen viste seg innen fristen der loven legger til grunn at den var der ved kjøpet",
  C: "Verkstedet dokumenterer at feilen går ut over normal slitasje",
};

// Why a defect has no track (src/lib/sammenligning/avled.ts), in words for the buyer.
const INGEN_SPOR: Record<string, string> = {
  muntlig_opplysning: "Selgers løfte var muntlig, og det er vanskelig å bevise.",
  rapport_mangler: "Det mangler skriftlig dokumentasjon fra et verksted som sier hvilken del som er feil.",
  utenfor_frist: "Feilen viste seg etter fristen der loven legger til grunn at feilen var der ved kjøpet, og rapporten sier ikke at den går ut over normal slitasje.",
};

// What the nearest won decision had that the buyer lacks (Naermeste.mangler), as «den hadde …».
const MANGLER: Record<string, string> = {
  rapport_ok: "skriftlig dokumentasjon fra et verksted av hvilken del som er feil",
  arsak: "en rapport som forklarte hvorfor delen sviktet",
  utover_paregnelig: "en sakkyndig rapport som sa at feilen går ut over normal slitasje",
  ved_levering: "en rapport som sa at feilen var der da bilen ble overtatt",
  rapport_levering: "en rapport som sa at feilen var der da bilen ble overtatt",
  dokumentert_fortielse: "dokumentasjon av forholdet selger ikke opplyste om",
  selger_motbevis: "en selger som ikke la frem motbevis",
  tid_til_feil: "en feil som viste seg tidligere etter kjøpet",
  reklamasjonstid: "en raskere reklamasjon",
  ikke_slitedel: "en feil på en del som ikke regnes som slitedel",
  alder: "en nyere bil",
  km: "en bil med lavere kilometerstand",
  pris: "en dyrere bil",
  form: "opplysningen i kontrakten",
  konkrethet: "en konkret skriftlig opplysning fra selger",
  direkte_sporsmal: "et skriftlig svar på et direkte spørsmål",
  forbehold: "et salg uten «som den er»-forbehold",
};
const liste = (x: string[]) => (x.length < 2 ? x.join("") : `${x.slice(0, -1).join(", ")} og ${x[x.length - 1]}`);

const SANKSJON: Record<string, string> = {
  heving: "kjøpet ble hevet",
  prisavslag: "kjøperen fikk prisavslag",
  erstatning: "kjøperen fikk erstatning",
  prisavslag_og_erstatning: "kjøperen fikk prisavslag og erstatning",
};

const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
const dato = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d}. ${MANEDER[m - 1]} ${a}`;
};

// A first, plain result: per defect, whether a won decision as strong as the buyer's case exists,
// with a link to it. The strength assessment and the letter come later (docs/sammenligningsmotor.md § 13).
export function Resultat({ svar, skjema }: { svar: Extract<SakSvar, { ok: true }>; skjema: Skjema }) {
  if (svar.stopp) {
    return <p className="m-0 text-[16px] text-[#3d4757]">Kjøp fra privatperson dekkes ikke av tjenesten ennå.</p>;
  }
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-[#1f3a5f]">Vurderingen</span>
        <h1 className="m-0 font-brev text-[30px] font-semibold leading-[1.15] md:text-[36px]">Dette fant vi i Forbrukerklageutvalgets vedtak</h1>
      </div>
      <div className="flex flex-col gap-5">
        {svar.feil.map((f) => {
          const sf = skjema.del3_feil.find((x) => x.id === f.feil_id)!;
          const kategori = KATEGORIER.find((k) => k.nokkel === sf.kategori)?.navn.replace(/ \(.*\)$/, "") ?? sf.kategori;
          return (
            <section key={f.feil_id} className="flex flex-col gap-3 rounded-[6px] border border-[#dcd8cf] bg-white px-5 py-5">
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-medium uppercase tracking-[.04em] text-[#5b6472]">{kategori}</span>
                <h2 className="m-0 font-brev text-[20px] font-semibold leading-[1.35]">Feilen er at {sf.en_setning}.</h2>
              </div>
              {f.forlik && <p className="m-0 text-[15px] text-[#5b6472]">Avtalen du har inngått med selger, gjelder denne feilen. Den tas ikke med i kravet.</p>}
              {f.vedtak ? (
                <>
                  <p className="m-0 text-[16px] leading-[1.6] text-[#3d4757]">
                    Vi fant et vedtak der en kjøper vant i en sak som ikke var sterkere enn din:{" "}
                    <a href={f.vedtak.kilde_url} target="_blank" rel="noreferrer" className="font-medium text-[#1f3a5f] underline underline-offset-2">
                      vedtak {f.vedtak.saksnummer} av {dato(f.vedtak.vedtaksdato)}
                    </a>
                    {f.vedtak.sanksjon && `, der ${SANKSJON[f.vedtak.sanksjon]}`}.
                  </p>
                  {f.spor && <p className="m-0 text-[14px] text-[#5b6472]">Grunnlag: {SPOR[f.spor]}.</p>}
                  {f.motstridende && (
                    <p className="m-0 text-[15px] leading-[1.6] text-[#3d4757]">
                      Utvalget har gitt medhold i {f.vedtak.saksnummer}, men avvist{" "}
                      <a href={f.motstridende.kilde_url} target="_blank" rel="noreferrer" className="font-medium text-[#1f3a5f] underline underline-offset-2">
                        {f.motstridende.saksnummer}
                      </a>{" "}
                      med lignende fakta.{f.motstridende.skilte.length > 0 && ` Det som skilte: ${f.motstridende.skilte.join(" ")}`}
                    </p>
                  )}
                  {f.til_brevet && <p className="m-0 text-[14px] font-medium text-[#2d6a3e]">Dette vedtaket brukes i brevet.</p>}
                </>
              ) : (
                <>
                  <p className="m-0 text-[16px] leading-[1.6] text-[#3d4757]">
                    {f.ingen_spor_arsak
                      ? INGEN_SPOR[f.ingen_spor_arsak]
                      : "Vi fant ikke et vedtak der kjøperen vant i en sak som var like sterk eller svakere enn din. Brevet bygger da på loven og faktum alene."}
                  </p>
                  {f.naermeste && (
                    <p className="m-0 text-[15px] leading-[1.6] text-[#3d4757]">
                      Nærmeste vinnende sak er{" "}
                      <a href={f.naermeste.kilde_url} target="_blank" rel="noreferrer" className="font-medium text-[#1f3a5f] underline underline-offset-2">
                        vedtak {f.naermeste.saksnummer} av {dato(f.naermeste.vedtaksdato)}
                      </a>
                      ; den hadde {liste([...new Set(f.naermeste.mangler.map((m) => MANGLER[m] ?? m))])}, som du mangler.
                    </p>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>
      <details className="text-[14px] text-[#5b6472]">
        <summary className="cursor-pointer">Svarene dine (JSON)</summary>
        <pre data-testid="skjema-json" className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-[6px] bg-white p-4 font-kode text-[12px] leading-[1.5] text-[#17263d]">
          {JSON.stringify(skjema, null, 2)}
        </pre>
      </details>
    </>
  );
}
