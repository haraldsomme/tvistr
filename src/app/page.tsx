import { SelgerVelger } from "./selger-velger";

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">tvistr</h1>
      <div className="mt-10 max-w-md">
        <SelgerVelger />
      </div>
    </div>
  );
}
