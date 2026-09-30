// Basic Auth check shared by the proxy and server actions (which can be POSTed directly).

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function adminKonfigurert(): boolean {
  return !!process.env.ADMIN_USER && !!process.env.ADMIN_PASSWORD;
}

export function erAdmin(authorization: string | null): boolean {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  if (!user || !password || !authorization) return false;
  const [scheme, encoded] = authorization.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  const decoded = atob(encoded);
  const sep = decoded.indexOf(":");
  return sep > 0 && timingSafeEqual(decoded.slice(0, sep), user) && timingSafeEqual(decoded.slice(sep + 1), password);
}
