"use client";

import { useState, type ReactNode } from "react";
import { konsekvenserAv } from "@/lib/brev/konsekvenser";
import type { Lagring, Utfylling } from "@/lib/brev/utfylling";
import type { Innsending } from "@/lib/vurdering/innsending";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Asking before what cannot be undone, or what makes the letter weaker. Cancelling is always the
// safe choice, so it is the button that has focus when the dialog opens.

type Innhold = { tittel: string; tekst: ReactNode; handling: string; destruktiv?: boolean };

export function Dialoginnhold({ tittel, tekst, handling, destruktiv, arbeider, bekreft }: Innhold & { arbeider: boolean; bekreft: () => void }) {
  return (
    <AlertDialogContent className="data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-[17px] font-semibold">{tittel}</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="text-[14px] leading-[1.5] text-muted-foreground">{tekst}</div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={arbeider}>Avbryt</AlertDialogCancel>
        <AlertDialogAction
          variant={destruktiv ? "destructive" : "default"}
          disabled={arbeider}
          onClick={(e) => {
            e.preventDefault();
            bekreft();
          }}
        >
          {handling}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

// A button that asks first. `children` is the button itself. The dialog stays open, with its buttons
// off, until `utfor` is done.
export function BekreftKnapp({ children, utfor, ...innhold }: Innhold & { children: ReactNode; utfor: () => void | Promise<void> }) {
  const [apen, setApen] = useState(false);
  const [arbeider, setArbeider] = useState(false);
  return (
    <AlertDialog open={apen} onOpenChange={(a) => !arbeider && setApen(a)}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <Dialoginnhold
        {...innhold}
        arbeider={arbeider}
        bekreft={async () => {
          setArbeider(true);
          try {
            await utfor();
          } finally {
            setArbeider(false);
            setApen(false);
          }
        }}
      />
    </AlertDialog>
  );
}

// Wraps a step's save: a save that makes the letter weaker (`konsekvenserAv`) is first shown in a
// dialog, and only sent when the buyer goes on. Cancelling returns false, so the step stays open with
// what was filled in. A save the server would refuse is sent as before and gets the server's message.
export function useBekreftLagring(lagre: (l: Lagring) => Promise<boolean>, sak: { svar: Innsending; utfylling: Utfylling }, idag: string) {
  const [sporsmal, setSporsmal] = useState<{ tap: string[]; svar: (ok: boolean) => void } | null>(null);

  async function bekreftOgLagre(lagring: Lagring): Promise<boolean> {
    const { avvist, tap } = konsekvenserAv(sak, lagring, idag);
    if (!avvist && tap.length > 0) {
      const ok = await new Promise<boolean>((svar) => setSporsmal({ tap, svar }));
      if (!ok) return false;
    }
    return lagre(lagring);
  }

  const svar = (ok: boolean) => {
    sporsmal?.svar(ok);
    setSporsmal(null);
  };
  const dialog = (
    <AlertDialog open={sporsmal !== null} onOpenChange={(apen) => !apen && svar(false)}>
      {sporsmal && (
        <Dialoginnhold
          tittel="Dette gjør brevet svakere"
          tekst={
            <>
              <p className="m-0">Hvis du lagrer dette:</p>
              <ul className="m-0 mt-1.5 flex list-disc flex-col gap-1 pl-5">
                {sporsmal.tap.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="m-0 mt-2">Stemmer svaret, skal du lagre det. Brevet må bygge på det som faktisk skjedde.</p>
            </>
          }
          handling="Lagre likevel"
          arbeider={false}
          bekreft={() => svar(true)}
        />
      )}
    </AlertDialog>
  );
  return { lagre: bekreftOgLagre, dialog };
}
