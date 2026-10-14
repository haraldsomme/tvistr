import { Logo } from "@/app/logo";
import { MaalVisning } from "@/app/maal-visning";
import { tall } from "@/lib/brev/format";
import { PRIS } from "@/lib/pris";
import { ALLE } from "@/lib/vurdering/statistikk";

// The landing page (docs/vurdering.md, «Landingssiden»): one action, the registration number, which is
// step 1 of the form. No testimonials and no promises; the number of decisions is read from the
// database when the site is built.
export const dynamic = "force-static";

const PUNKTER = ["Riktige lovhenvisninger for ditt kjøp", "Et vedtak der kjøperen fikk medhold i en lignende sak", "Kravet og fristen formulert som en jurist ville gjort det"];

// Without a database at build time the page is built without the number, not stopped.
async function antallVedtak(): Promise<number | null> {
  try {
    const { lesStatistikk } = await import("@/lib/vurdering/statistikk-db");
    return (await lesStatistikk()).get(ALLE)?.antallSaker ?? null;
  } catch (e) {
    console.error("antall vedtak ble ikke lest", e);
    return null;
  }
}

function Hake({ stor }: { stor?: boolean }) {
  return (
    <span className={`grid flex-none place-items-center rounded-full bg-[oklch(0.965_0.018_255)] ${stor ? "size-8" : "size-5"}`}>
      <svg width={stor ? 14 : 11} height={stor ? 14 : 11} viewBox="0 0 12 12" aria-hidden>
        <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="oklch(0.47 0.12 255)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// The plate and the button. A plain form, so it works before the page's script has loaded.
function Regnrfelt() {
  return (
    <form action="/sak" method="get" className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-3">
      <label className="flex h-[58px] w-full flex-none items-stretch overflow-hidden rounded-[8px] border-2 border-[#16181a] bg-white focus-within:shadow-[0_0_0_4px_oklch(0.965_0.018_255)] md:w-[230px]">
        <span aria-hidden className="flex w-7 flex-none items-end justify-center bg-[oklch(0.42_0.15_262)] pb-[7px] text-[12px] font-bold text-white">
          N
        </span>
        <span className="sr-only">Registreringsnummer</span>
        <input
          name="regnr"
          required
          maxLength={8}
          pattern="[A-Za-zÆØÅæøå0-9 \-]{2,8}"
          placeholder="AB 12345"
          autoComplete="off"
          spellCheck={false}
          className="w-full min-w-0 bg-transparent px-3.5 font-[family-name:var(--font-jbmono)] text-[25px] font-semibold uppercase tracking-[.06em] text-[#16181a] outline-none placeholder:text-[#b4b8bc]"
        />
      </label>
      <button type="submit" className="h-[50px] cursor-pointer rounded-[10px] bg-[oklch(0.47_0.12_255)] px-[26px] text-[15px] font-semibold text-white md:h-[58px] md:text-[16px]">
        Sjekk bilen
      </button>
    </form>
  );
}

export default async function Home() {
  const n = await antallVedtak();
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f4] font-[family-name:var(--font-instrument)] text-[#16181a] antialiased">
      <MaalVisning hendelse="landing" />
      <header className="flex items-center justify-between border-b border-[#e2e3e0] bg-white px-5 py-[18px] md:px-16 md:py-[22px]">
        <Logo liten />
        <nav className="hidden text-[14px] font-medium text-[#2c3033] md:block">
          <a href="#brevet">Slik fungerer det</a>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-[1280px] gap-10 px-5 pb-9 pt-9 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-center md:gap-[72px] md:px-16 md:pb-[88px] md:pt-24">
        <div className="flex flex-col gap-3 md:gap-[26px]">
          <span className="font-[family-name:var(--font-jbmono)] text-[11px] font-semibold uppercase tracking-[.08em] text-[oklch(0.47_0.12_255)]">For deg som har kjøpt bruktbil fra forhandler</span>
          <h1 className="m-0 text-[34px] font-semibold leading-[1.06] tracking-[-0.03em] md:text-[56px] md:leading-[1.04] md:[text-wrap:balance]">Sjekk om du har en reklamasjonssak</h1>
          <p className="m-0 max-w-[520px] text-[15.5px] leading-[1.55] text-[#5f6468] md:text-[18px] md:[text-wrap:pretty]">
            Skriv inn registreringsnummeret, svar på fem spørsmål, og se hva loven og Forbrukerklageutvalget sier om saker som din.
          </p>
          <div className="mt-3 md:mt-0">
            <Regnrfelt />
          </div>
          <span className="text-[15px] font-semibold">Gratis. Brevet koster {PRIS} kr.</span>
        </div>
        <div aria-hidden className="hidden rotate-[.8deg] md:block">
          <article className="flex flex-col gap-3.5 rounded-[6px] border border-[#e2e3e0] bg-white px-10 py-9 shadow-[0_18px_40px_-20px_rgba(20,25,35,.3)]">
            <span className="text-[13px] text-[#5f6468]">Oslo, 14. oktober 2026</span>
            <span className="text-[17px] font-bold leading-[1.35]">Reklamasjon – Volkswagen Golf, reg.nr. EK 48213</span>
            <span className="text-[14.5px] leading-[1.65] text-[#2c3033]">Jeg viser til kjøp av ovennevnte bil 12. mai 2026. Bilen har en mangel etter forbrukerkjøpsloven, og jeg reklamerer herved …</span>
            <div className="flex flex-col gap-2 pt-1.5">
              {["100%", "94%", "97%", "62%"].map((b) => (
                <div key={b} className="h-[9px] rounded-[3px] bg-[#ecedea]" style={{ width: b }} />
              ))}
            </div>
          </article>
        </div>
      </section>

      <section id="brevet" className="border-t border-[#e2e3e0]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-5 py-7 md:gap-7 md:px-16 md:pb-16 md:pt-14">
          <span className="font-[family-name:var(--font-jbmono)] text-[11px] font-semibold uppercase tracking-[.08em] text-[oklch(0.47_0.12_255)]">Brevet inneholder</span>
          <div className="grid gap-2.5 md:grid-cols-3 md:gap-10">
            {PUNKTER.map((p) => (
              <div key={p} className="flex items-start gap-2.5 text-[14px] leading-[1.45] md:flex-col md:gap-3 md:text-[19px] md:font-semibold md:leading-[1.35] md:tracking-[-0.01em]">
                <span className="md:hidden">
                  <Hake />
                </span>
                <span className="hidden md:block">
                  <Hake stor />
                </span>
                <span>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {n !== null && (
        <section className="border-t border-[#e2e3e0]">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-1 px-5 py-6 md:flex-row md:items-baseline md:gap-[18px] md:px-16 md:pb-14 md:pt-10">
            <span className="text-[30px] font-semibold leading-none md:text-[44px]">{tall(n)}</span>
            <span className="text-[14.5px] text-[#5f6468] md:text-[17px]">vedtak fra Forbrukerklageutvalget ligger til grunn</span>
          </div>
        </section>
      )}

      <footer className="mt-auto bg-[#16181a] text-[#c4c7ca]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-5 py-8 text-[14px] leading-[1.5] md:px-16 md:py-10">
          <span className="text-[15px] font-semibold text-white">tvistr.no</span>
          <a href="mailto:kontakt@tvistr.no">kontakt@tvistr.no</a>
        </div>
      </footer>
    </div>
  );
}
