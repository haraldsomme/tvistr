import Link from "next/link";
import { Logo } from "@/app/logo";

const STEG = [
  { nr: "01", tittel: "Svar på spørsmål", tekst: "Om bilen, kjøpet, feilen og hva du har av dokumentasjon." },
  { nr: "02", tittel: "Se vurderingen", tekst: "Gratis. Vi forklarer hvor sterk saken er og hvorfor." },
  { nr: "03", tittel: "Send brevet selv", tekst: "249 kr, én gang. Du får brevet som PDF og Word, klart til å sende." },
];

// Static example of what the letter looks like; the real one is written from the user's answers.
function Brevutsnitt() {
  return (
    <div
      aria-hidden
      className="hidden flex-col gap-3.5 rounded bg-white p-10 shadow-[0_18px_40px_-24px_rgba(23,38,61,.35)] md:flex md:rotate-[.6deg] md:border md:border-[#dcd8cf] md:px-11"
    >
      <div className="font-ui text-[12px] leading-[1.5] text-[#5b6472]">Oslo, 30. september 2026</div>
      <div className="font-brev text-[19px] font-semibold leading-[1.3]">Reklamasjon – Volkswagen Golf, reg.nr. EK 48213</div>
      <div className="font-brev text-[14px] leading-[1.65] text-[#3d4757]">
        Jeg viser til kjøp av ovennevnte bil 12. mai 2026. Bilen har en mangel etter forbrukerkjøpsloven § 16, og jeg reklamerer herved i medhold av § 27 …
      </div>
      <div className="flex flex-col gap-2 pt-1.5">
        {["100%", "94%", "97%", "62%"].map((b) => (
          <div key={b} className="h-[9px] rounded-sm bg-[#e8e5de]" style={{ width: b }} />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f4ef] font-ui text-[#17263d]">
      <header className="relative flex items-center justify-between border-b border-[#dcd8cf] px-6 py-[18px] md:px-16 md:py-[22px]">
        <Logo liten />
        <nav className="hidden text-[14px] font-medium text-[#3d4757] md:block">
          <a href="#slik-fungerer-det">Slik fungerer det</a>
        </nav>
        <details className="md:hidden">
          <summary aria-label="Meny" className="-m-3 flex size-12 cursor-pointer list-none flex-col justify-center gap-[5px] p-3 [&::-webkit-details-marker]:hidden">
            <span className="h-0.5 w-[22px] bg-[#17263d]" />
            <span className="h-0.5 w-[22px] bg-[#17263d]" />
            <span className="h-0.5 w-[22px] bg-[#17263d]" />
          </summary>
          <nav className="absolute inset-x-0 top-full z-10 border-b border-[#dcd8cf] bg-[#f6f4ef] px-6 text-[16px] font-medium text-[#1f3a5f]">
            <a href="#slik-fungerer-det" className="block py-4">Slik fungerer det</a>
          </nav>
        </details>
      </header>

      <section className="mx-auto flex w-full max-w-[1280px] flex-col md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-center md:gap-[72px] md:px-16 md:pb-[88px] md:pt-24">
        <div className="flex flex-col gap-5 px-6 pb-10 pt-10 md:gap-7 md:p-0">
          <div className="text-[13px] font-medium text-[#1f3a5f] md:tracking-[.02em]">For deg som har kjøpt bruktbil fra forhandler</div>
          <h1 className="m-0 font-brev text-[38px] font-semibold leading-[1.08] tracking-[-.01em] md:text-[60px] md:leading-[1.06] md:tracking-[-.015em] md:[text-wrap:balance]">
            Feil på bilen? Få et reklamasjonsbrev som holder.
          </h1>
          <p className="m-0 max-w-[520px] text-[16px] leading-[1.6] text-[#3d4757] md:text-[18px] md:[text-wrap:pretty]">
            <span className="md:hidden">Svar på noen få spørsmål og få en gratis vurdering av saken. Brevet sender du selv til forhandleren.</span>
            <span className="hidden md:inline">
              Svar på noen få spørsmål om kjøpet og feilen. Du får en gratis vurdering av saken, og kan deretter kjøpe et ferdig brev som du sender til forhandleren selv.
            </span>
          </p>
          <div className="flex flex-col items-center gap-3 pt-2 md:flex-row md:gap-4 md:pt-0">
            <Link href="/vurdering" className="w-full rounded-[6px] bg-[#17263d] p-[18px] text-center text-[16px] font-semibold text-[#f6f4ef] md:w-auto md:px-7">
              Start vurderingen
            </Link>
            <span className="text-[13px] text-[#5b6472] md:text-[14px]">Gratis · tar ca. 5 minutter</span>
          </div>
        </div>
        <Brevutsnitt />
      </section>

      <section id="slik-fungerer-det" className="border-t border-[#dcd8cf]">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-6 pb-12 pt-10 md:grid-cols-3 md:gap-12 md:px-16 md:pb-[72px] md:pt-14">
          {STEG.map((s) => (
            <div key={s.nr} className="flex flex-col gap-2.5">
              <div className="font-kode text-[13px] font-semibold text-[#1f3a5f]">{s.nr}</div>
              <h2 className="m-0 font-brev text-[21px] font-semibold leading-[1.3]">{s.tittel}</h2>
              <p className="m-0 text-[15px] leading-[1.6] text-[#3d4757]">{s.tekst}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-[#17263d] text-[#c9d2df]">
        <div className="mx-auto flex max-w-[1280px] items-start justify-between gap-12 px-6 pb-10 pt-8 md:px-16 md:pb-12 md:pt-10 text-[14px] leading-[1.5]">
          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold text-[#f6f4ef]">tvistr.no</span>
            <a href="mailto:kontakt@tvistr.no">kontakt@tvistr.no</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
