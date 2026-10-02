import type { ReactNode } from "react";
import type { Brev } from "@/lib/brev/brev";

// Anything in square brackets is something the buyer has to fill in; it is marked in yellow so it is
// not missed. What has been filled in reads as ordinary letter text.
const PLASSHOLDER = /(\[[^\]]+\])/;
const MANGLER = "rounded-[2px] border-b-2 border-[oklch(0.72_0.11_85)] bg-[oklch(0.96_0.07_85)] px-[3px] text-[#6b5618]";

function Tekst({ children }: { children: string }): ReactNode {
  return children.split(PLASSHOLDER).map((del, n) =>
    n % 2 === 1 ? (
      <mark key={n} className={MANGLER}>
        {del}
      </mark>
    ) : (
      del
    ),
  );
}

function Linjer({ linjer, hoyre }: { linjer: string[]; hoyre?: boolean }) {
  return (
    <div className={hoyre ? "md:text-right" : undefined}>
      {linjer.map((l, n) => (
        <div key={n}>
          <Tekst>{l}</Tekst>
        </div>
      ))}
    </div>
  );
}

export function Brevark({ brev }: { brev: Brev }) {
  return (
    <article
      aria-label="Reklamasjonsbrev"
      className="flex w-full max-w-[820px] flex-col gap-[18px] rounded-[3px] bg-white px-6 py-10 shadow-[0_20px_50px_-28px_rgba(23,38,61,.45)] md:px-[72px] md:py-16"
    >
      <div className="flex flex-col justify-between gap-4 font-brev text-[14px] leading-[1.55] text-[#3d4757] md:flex-row">
        <Linjer linjer={brev.avsender} />
        <Linjer linjer={brev.mottaker} hoyre />
      </div>
      <div className="font-brev text-[14px] text-[#3d4757]">
        <Tekst>{brev.stedDato}</Tekst>
      </div>
      <h1 className="m-0 pt-1.5 font-brev text-[20px] font-semibold leading-[1.35]">
        <Tekst>{brev.emne}</Tekst>
      </h1>
      {brev.avsnitt.map((a, n) => (
        <p key={n} className="m-0 font-brev text-[15px] leading-[1.8]">
          <Tekst>{a}</Tekst>
        </p>
      ))}
      <p className="m-0 font-brev text-[15px] leading-[1.8]">
        {brev.hilsen}
        <br />
        <Tekst>{brev.underskrift}</Tekst>
      </p>
    </article>
  );
}
