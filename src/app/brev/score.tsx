import { Button } from "@/components/ui/button";
import type { Score } from "@/lib/brev/score";

// The score tab: how well the letter is supported, what to do about it, and what cannot be changed.
export function ScorePanel({ score, apne }: { score: Score; apne: (steg: string) => void }) {
  return (
    <section aria-labelledby="score-tittel" className="flex w-full max-w-[820px] flex-col gap-4 lg:sticky lg:top-6">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-[18px] py-4">
        <h2 id="score-tittel" className="m-0 text-[15px] font-semibold text-primary">
          Score
        </h2>
        <p className="m-0 text-[40px] font-semibold leading-none text-primary">{score.prosent} %</p>
        <p className="m-0 text-[13px] leading-[1.55] text-muted-foreground">
          Scoren viser hvor godt brevet er underbygget med det Forbrukerklageutvalget har lagt vekt på i lignende saker. Den sier ikke hvor stor sjanse du har for å vinne.
        </p>
      </div>
      {score.trekk.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-[18px] py-4">
          <h3 className="m-0 text-[15px] font-semibold text-primary">Gjør dette</h3>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[14px] leading-[1.5] text-foreground">
            {score.trekk.map((t) => (
              <li key={t.id} className="flex items-baseline gap-x-2">
                <span className="w-8 shrink-0 font-semibold tabular-nums">−{t.poeng}</span>
                <span className="flex-1">
                  {t.tekst}
                  {t.ma && <span className="ml-2 rounded bg-secondary px-1.5 py-px text-[12px] font-semibold">Må</span>}
                  {t.steg && (
                    <Button type="button" variant="link" onClick={() => apne(t.steg!)} className="ml-2 h-auto p-0 align-baseline text-[13px]">
                      Rett dette
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {score.merknader.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-[18px] py-4">
          <h3 className="m-0 text-[15px] font-semibold text-primary">Merknader fra gjennomlesingen</h3>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[13px] leading-[1.5] text-muted-foreground">
            {score.merknader.map((f) => (
              <li key={f.id}>{f.tekst.replace(/^Merknad fra gjennomlesingen: /, "")}</li>
            ))}
          </ul>
        </div>
      )}
      {score.faste.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-[18px] py-4">
          <h3 className="m-0 text-[15px] font-semibold text-primary">Forhold du ikke kan endre</h3>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[13px] leading-[1.5] text-muted-foreground">
            {score.faste.map((f) => (
              <li key={f.id}>{f.tekst}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// The line above the letter: the score and a way to the tab.
export function ScoreLinje({ score, vis }: { score: Score; vis: () => void }) {
  return (
    <section aria-label="Score" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-[18px] py-3 text-[14px] text-foreground">
      {score.prosent === 100 ? (
        <span>Score 100 % · Brevet har det utvalget la vekt på i lignende saker.</span>
      ) : (
        <>
          <span>
            Score {score.prosent} % · {score.trekk.length} ting kan gjøre brevet sterkere
          </span>
          <Button type="button" variant="link" onClick={vis} className="h-auto p-0 text-[13px]">
            Se Score
          </Button>
        </>
      )}
    </section>
  );
}
