import type { ReactNode } from "react";
import type { Brev } from "@/lib/brev/brev";

// Anything in square brackets is something the buyer has to fill in; it is marked in yellow so it is
// not missed. What has been filled in reads as ordinary letter text. When the fill-in list is on
// screen (`apne`), a placeholder is a button that opens the step it belongs to.
const PLASSHOLDER = /(\[[^\]]+\])/;
const MANGLER = "rounded-[2px] border-b-2 border-[oklch(0.72_0.11_85)] bg-[oklch(0.96_0.07_85)] px-[3px] text-[#6b5618]";
const MANGLER_KNAPP = `${MANGLER} cursor-pointer underline decoration-dotted underline-offset-2`;

// Which step in the fill-in list a placeholder in free-running text (the subject line and the body)
// belongs to: «[Sted]» is the sender's, and «[MANGLER: …]» the step the plan says fills it in
// (`plan.mangler`). null when there is none to open.
type Mangler = readonly { tekst: string; steg: string }[];
function stegForPlassholder(tekst: string, mangler: Mangler): string | null {
  if (tekst === "[Sted]") return "avsender";
  const mangel = /^\[MANGLER: (.+)\]$/.exec(tekst)?.[1];
  return mangler.find((m) => m.tekst === mangel)?.steg ?? null;
}

// A link in the letter (the decision it cites) is clickable on the page too.
const LENKE = /(https:\/\/[^\s)]+)/;
function MedLenker({ tekst }: { tekst: string }): ReactNode {
  return tekst.split(LENKE).map((del, n) =>
    n % 2 === 0 ? (
      del
    ) : (
      <a key={n} href={del} target="_blank" rel="noreferrer" className="break-all text-[#1f3a5f] underline underline-offset-2">
        {del}
      </a>
    ),
  );
}

// `steg` fixes the step for every placeholder in the text (the address blocks, where the same
// placeholder text, «[Postnummer og sted]», belongs to different steps depending on whose address it
// is); left out, each placeholder is resolved on its own text.
function Tekst({ children, steg, apne, mangler = [] }: { children: string; steg?: string; apne?: (steg: string) => void; mangler?: Mangler }): ReactNode {
  return children.split(PLASSHOLDER).map((del, n) => {
    if (n % 2 === 0) return <MedLenker key={n} tekst={del} />;
    const malSteg = steg ?? stegForPlassholder(del, mangler);
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
export function Brevark({ brev, apne, mangler = [] }: { brev: Brev; apne?: (steg: string) => void; mangler?: Mangler }) {
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
        <Tekst apne={apne} mangler={mangler}>
          {brev.emne}
        </Tekst>
      </h1>
      {brev.deler.map((d, i) => [
        d.overskrift && (
          <h2 key={`o${i}`} className="m-0 pt-2 font-brev text-[15px] font-semibold leading-[1.5]">
            {d.overskrift}
          </h2>
        ),
        ...d.avsnitt.map((a, n) => (
          <p key={`${i}-${n}`} className="m-0 font-brev text-[15px] leading-[1.8]">
            <Tekst apne={apne} mangler={mangler}>
              {a}
            </Tekst>
          </p>
        )),
      ])}
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
