import { createClient } from "../../../../../utility/supabase/server";
import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // On mobile dev, origin may resolve to localhost, use host header instead
  const host = request.headers.get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const resolvedOrigin = host ? `${protocol}://${host}` : origin;

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // if (
      //   next.startsWith("servifymobilewv://") ||
      //   next.startsWith("servify://")
      // ) {
      //   return NextResponse.redirect(next);
      // }
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${resolvedOrigin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${resolvedOrigin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${resolvedOrigin}/auth/auth-code-error`);
}
