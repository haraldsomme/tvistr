// The buyer's details as Vipps shares them (PROFIL in klient.ts), into the form's empty fields. What
// the form already has, from the buyer's previous case, stays. The address goes in only as a whole.
import { FMT } from "@/lib/app/format";
import type { Skjema } from "@/lib/app/skjema";
import type { Kjoperdata } from "./klient";

export function fyllKjoper(s: Skjema, d: Kjoperdata | undefined): Skjema {
  if (!d) return s;
  const ut = { ...s };
  const navn = [d.firstName, d.lastName].filter(Boolean).join(" ").trim();
  if (!ut.b_name.trim() && navn) ut.b_name = navn;
  if (!ut.b_email.trim() && d.email) ut.b_email = d.email.trim();
  // Vipps gives the number with the country code (4712345678); the form has Norwegian numbers only.
  const tlf = d.mobileNumber?.replace(/\D/g, "").match(/^47(\d{8})$/)?.[1];
  if (!ut.b_phone.trim() && tlf) ut.b_phone = FMT.phone(tlf);
  const a = d.addresses?.find((x) => !x.country || x.country === "NO") ?? d.addresses?.[0];
  if (a?.addressLine1 && !ut.b_addr.trim() && !ut.b_zip.trim() && !ut.b_city.trim()) {
    ut.b_addr = [a.addressLine1, a.addressLine2].filter(Boolean).join(", ");
    ut.b_zip = FMT.zip(a.postCode ?? "");
    ut.b_city = a.city ?? "";
  }
  return ut;
}

// The address shown on the receipt page, without giving it away: k***@gmail.com.
export const maskerEpost = (e: string) => e.replace(/^(.)[^@]*(@.+)$/, "$1***$2");
