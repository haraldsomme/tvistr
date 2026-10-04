import type { ReactNode } from "react";
import { FEIL_PLASSHOLDER, KRAV_ALTERNATIV, OPPLYSNING_PLASSHOLDER, type Brev } from "@/lib/brev/brev";

// Anything in square brackets is something the buyer has to fill in; it is marked in yellow so it is
// not missed. What has been filled in reads as ordinary letter text. When the fill-in list is on
// screen (`apne`), a placeholder is a button that opens the step it belongs to.
const PLASSHOLDER = /(\[[^\]]+\])/;
const MANGLER = "rounded-[2px] border-b-2 border-[oklch(0.72_0.11_85)] bg-[oklch(0.96_0.07_85)] px-[3px] text-[#6b5618]";
const MANGLER_KNAPP = `${MANGLER} cursor-pointer underline decoration-dotted underline-offset-2`;

// Which step in the fill-in list a placeholder in free-running text (the subject line and the body)
// belongs to, or null when there is none to open (the vehicle, locked from the assessment, never
// actually shows as a placeholder on this page).
function stegForPlassholder(tekst: string): string | null {
  if (tekst === "[Sted]") return "avsender";
  if (tekst.includes("kjøpsdato") || tekst.includes("kjøpesum")) return "kjopet";
  if (tekst === FEIL_PLASSHOLDER) return "feilen";
  if (tekst === OPPLYSNING_PLASSHOLDER) return "for-kjopet";
  if (tekst === KRAV_ALTERNATIV) return "krav";
  return null;
}

// `steg` fixes the step for every placeholder in the text (the address blocks, where the same
// placeholder text, «[Postnummer og sted]», belongs to different steps depending on whose address it
// is); left out, each placeholder is resolved on its own text.
function Tekst({ children, steg, apne }: { children: string; steg?: string; apne?: (steg: string) => void }): ReactNode {
  return children.split(PLASSHOLDER).map((del, n) => {
    if (n % 2 === 0) return del;
    const malSteg = steg ?? stegForPlassholder(del);
    if (apne && malSteg)
      return (
        <button key={n} type="button" onClick={() => apne(malSteg)} className={MANGLER_KNAPP}>
          {del}
        </button>
      );
    return (
      <mark key={n} className={MANGLER}>
        {del}
      </mark>
    );
  });
}

function Linjer({ linjer, hoyre, steg, apne }: { linjer: string[]; hoyre?: boolean; steg: string; apne?: (steg: string) => void }) {
  return (
    <div className={hoyre ? "md:text-right" : undefined}>
      {linjer.map((l, n) => (
        <div key={n}>
          <Tekst steg={steg} apne={apne}>
            {l}
          </Tekst>
        </div>
      ))}
    </div>
  );
}

// `apne` opens a step in the fill-in list, when the letter is shown next to it. The downloaded PDF and
// Word file have no such affordance; there the mark is simply a mark.
export function Brevark({ brev, apne }: { brev: Brev; apne?: (steg: string) => void }) {
  return (
    <article
      aria-label="Reklamasjonsbrev"
      className="flex w-full max-w-[820px] flex-col gap-[18px] rounded-[3px] bg-white px-6 py-10 shadow-[0_20px_50px_-28px_rgba(23,38,61,.45)] md:px-[72px] md:py-16"
    >
      <div className="flex flex-col justify-between gap-4 font-brev text-[14px] leading-[1.55] text-[#3d4757] md:flex-row">
        <Linjer linjer={brev.avsender} steg="avsender" apne={apne} />
        <Linjer linjer={brev.mottaker} hoyre steg="forhandler" apne={apne} />
      </div>
      <div className="font-brev text-[14px] text-[#3d4757]">
        <Tekst apne={apne}>{brev.stedDato}</Tekst>
      </div>
      <h1 className="m-0 pt-1.5 font-brev text-[20px] font-semibold leading-[1.35]">
        <Tekst apne={apne}>{brev.emne}</Tekst>
      </h1>
      {brev.avsnitt.map((a, n) => (
        <p key={n} className="m-0 font-brev text-[15px] leading-[1.8]">
          <Tekst apne={apne}>{a}</Tekst>
        </p>
      ))}
      <p className="m-0 font-brev text-[15px] leading-[1.8]">
        {brev.hilsen}
        <br />
        <Tekst steg="avsender" apne={apne}>
          {brev.underskrift}
        </Tekst>
      </p>
    </article>
  );
}
