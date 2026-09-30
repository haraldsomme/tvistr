// Minimal validator for the JSON Schema subset used in skjema.ts (object, array, string,
// integer, number, boolean, null, enum, anyOf). Used where the schema is too large for
// strict tool use.

type Skjema = {
  type?: string;
  enum?: unknown[];
  anyOf?: Skjema[];
  properties?: Record<string, Skjema>;
  required?: string[];
  items?: Skjema;
};

export function sjekkSkjema(skjemaInn: object, verdi: unknown, sti = "$"): string[] {
  const skjema = skjemaInn as Skjema;
  if (skjema.anyOf) {
    const varianter = skjema.anyOf.map((s) => sjekkSkjema(s, verdi, sti));
    return varianter.some((f) => f.length === 0) ? [] : [`${sti}: passer ikke noen av variantene`];
  }
  const feil: string[] = [];
  switch (skjema.type) {
    case "object": {
      if (typeof verdi !== "object" || verdi === null || Array.isArray(verdi)) return [`${sti}: forventet objekt`];
      const o = verdi as Record<string, unknown>;
      for (const k of skjema.required ?? []) if (!(k in o)) feil.push(`${sti}.${k}: mangler`);
      for (const [k, s] of Object.entries(skjema.properties ?? {})) if (k in o) feil.push(...sjekkSkjema(s, o[k], `${sti}.${k}`));
      for (const k of Object.keys(o)) if (!(k in (skjema.properties ?? {}))) feil.push(`${sti}.${k}: ukjent felt`);
      break;
    }
    case "array":
      // A missing list or a single value is read as a list by fraModell; check the value itself.
      if (verdi === null || verdi === "") return [];
      if (typeof verdi === "string") return skjema.items ? sjekkSkjema(skjema.items, verdi, `${sti}[0]`) : [];
      if (!Array.isArray(verdi)) return [`${sti}: forventet liste`];
      // Empty entries and values outside a fixed vocabulary are dropped by fraModell.
      verdi.forEach((v, i) => {
        if (v === "" || !skjema.items) return;
        const f = sjekkSkjema(skjema.items, v, `${sti}[${i}]`);
        if (skjema.items.enum && typeof v === "string") return;
        feil.push(...f);
      });
      break;
    case "string":
      // null means "not stated", same as the "" the schema asks for; fraModell maps both to null.
      if (verdi === null) return [];
      if (typeof verdi !== "string") return [`${sti}: forventet tekst`];
      break;
    case "integer":
      if (!Number.isInteger(verdi)) return [`${sti}: forventet heltall`];
      break;
    case "number":
      if (typeof verdi !== "number") return [`${sti}: forventet tall`];
      break;
    case "boolean":
      if (typeof verdi !== "boolean") return [`${sti}: forventet ja/nei`];
      break;
    case "null":
      if (verdi !== null) return [`${sti}: forventet null`];
      break;
  }
  if (skjema.enum && !skjema.enum.includes(verdi)) feil.push(`${sti}: ${JSON.stringify(verdi)} er ikke en gyldig verdi`);
  return feil;
}
