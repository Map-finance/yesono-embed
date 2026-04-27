import { NextRequest, NextResponse } from "next/server";

const HOST_FRAME_ANCESTORS =
  process.env.NEXT_PUBLIC_EMBED_FRAME_ANCESTORS || "*";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set(
    "Content-Security-Policy",
    `frame-ancestors ${HOST_FRAME_ANCESTORS}`
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:css|js|map|png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
