import { NextResponse, type NextRequest } from "next/server";
import { adminKonfigurert, erAdmin } from "@/lib/auth";

// Basic Auth in front of the data views; they expose (redacted) decision data.
export function proxy(request: NextRequest) {
  if (!adminKonfigurert()) {
    return new NextResponse("ADMIN_USER/ADMIN_PASSWORD er ikke satt", { status: 503 });
  }
  if (erAdmin(request.headers.get("authorization"))) return NextResponse.next();

  return new NextResponse("Innlogging kreves", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="tvistr-data", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/data/:path*", "/api/data/:path*"],
};
