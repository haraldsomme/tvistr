import Link from "next/link";
import { Logo } from "@/app/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f4ef] font-ui text-[#17263d]">
      <div className="border-b border-[#dcd8cf] px-6 pb-[18px] pt-[52px] md:px-16 md:py-[22px]">
        <Logo liten />
      </div>
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 pt-14 md:px-0 md:pt-28">
        <h1 className="m-0 font-brev text-[30px] font-semibold leading-[1.15] md:text-[40px]">Vi finner ikke dette brevet</h1>
        <p className="m-0 text-[16px] leading-[1.6] text-[#3d4757]">
          Saken kan være slettet. Vi sletter saker 30 dager etter at de sist ble endret. Du kan lage et nytt brev ved å ta vurderingen på nytt.
        </p>
        <Link href="/vurdering" className="self-start rounded-[6px] bg-[#17263d] px-7 py-[18px] text-[16px] font-semibold text-[#f6f4ef]">
          Start vurderingen
        </Link>
      </div>
    </div>
  );
}
