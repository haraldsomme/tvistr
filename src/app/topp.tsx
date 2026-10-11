import Link from "next/link";
import { Logo } from "@/app/logo";

// The header shared by the landing page and the form.
export function Topp() {
  return (
    <header className="relative flex flex-none items-center justify-between border-b border-[#dcd8cf] bg-[#f6f4ef] px-6 py-[18px] font-ui text-[#17263d] md:px-16 md:py-[22px]">
      <Link href="/" aria-label="Til forsiden">
        <Logo liten />
      </Link>
      <nav className="hidden text-[14px] font-medium text-[#3d4757] md:block">
        <a href="/#slik-fungerer-det">Slik fungerer det</a>
      </nav>
      <details className="md:hidden">
        <summary aria-label="Meny" className="-m-3 flex size-12 cursor-pointer list-none flex-col justify-center gap-[5px] p-3 [&::-webkit-details-marker]:hidden">
          <span className="h-0.5 w-[22px] bg-[#17263d]" />
          <span className="h-0.5 w-[22px] bg-[#17263d]" />
          <span className="h-0.5 w-[22px] bg-[#17263d]" />
        </summary>
        <nav className="absolute inset-x-0 top-full z-10 border-b border-[#dcd8cf] bg-[#f6f4ef] px-6 text-[16px] font-medium text-[#1f3a5f]">
          <a href="/#slik-fungerer-det" className="block py-4">Slik fungerer det</a>
        </nav>
      </details>
    </header>
  );
}
