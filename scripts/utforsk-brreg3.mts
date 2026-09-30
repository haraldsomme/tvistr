const misses = ["Auto Save Service AS","Autotrend AS","Bilmax Trøndelag AS","Bruktbilforum AS","H G. Bil As","KT Auto AS","Kolbotn Autosalg AS","Landbruksauksjon.no AS","Motorstudio AS","Rogaland Autosalg AS","Stavanger Bruktbil AS","Vest Bilsalg AS","Bil-Partner AS","Berges Motorsenter AS","Olsen Bil AS"];
const nn = (s: string) => s.toLowerCase().replace(/\b(as|asa)\b/g, "").replace(/[^a-zæøå0-9]/g, "");
async function f(path: string, navn: string, extra = "") {
  const j: any = await (await fetch(`https://data.brreg.no/enhetsregisteret/api/${path}?navn=${encodeURIComponent(navn)}${extra}&size=50`)).json();
  return (j._embedded?.[path] ?? []) as any[];
}
for (const n of misses) {
  const k = n.replace(/\b(as)\b/i, "").replace(/[.,]/g, " ").trim();
  const res: Record<string, string> = {};
  const full = await f("enheter", n);
  res.fullt = full.find((x) => nn(x.navn) === nn(n))?.navn ?? "-";
  const fort = await f("enheter", k, "&navnMetodeForSoek=FORTLOEPENDE");
  res.fortl = fort.filter((x) => nn(x.navn).startsWith(nn(n))).map((x) => `${x.navn}[${x.forretningsadresse?.kommune}]`).slice(0, 3).join(", ") || "-";
  const ue = await f("underenheter", n);
  res.under = ue.filter((x) => nn(x.navn).startsWith(nn(n))).map((x) => `${x.navn}[${x.beliggenhetsadresse?.kommune}]`).slice(0, 2).join(", ") || "-";
  console.log(n.padEnd(26), JSON.stringify(res));
}
