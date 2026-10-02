export function Logo({ liten }: { liten?: boolean }) {
  return (
    <div className={`font-brev font-semibold leading-none ${liten ? "text-[21px] md:text-[24px]" : "text-[24px]"}`}>
      Tvistr<span className="font-normal text-[#8a94a3]">.no</span>
    </div>
  );
}
