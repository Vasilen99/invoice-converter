import { createClient } from "../../../../../utility/supabase/server";
import { NextResponse } from "next/server";

/**
 * OAuth callback handler for social login (Google, Facebook, etc.)
 *
 * Flow:
 * 1. User clicks "Login with Google"
 * 2. OAuth provider redirects here with authorization code
 * 3. We exchange the code for a session
 * 4. Redirect user back to their original page
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Determine the origin URL for redirects
  const host = request.headers.get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const resolvedOrigin = host ? `${protocol}://${host}` : origin;

  // Extract OAuth code and return path from query parameters
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/";

  // If no authorization code, redirect to error page
  if (!code) {
    console.error("[OAuth Callback] Missing authorization code");
    return NextResponse.redirect(`${resolvedOrigin}/auth/auth-code-error`);
  }

  try {
    // Exchange OAuth code for Supabase session
    const supabase = await createClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error(
        "[OAuth Callback] Code exchange failed:",
        exchangeError.message,
      );
      return NextResponse.redirect(`${resolvedOrigin}/auth/auth-code-error`);
    }

    // Ensure redirect path is safe (prevent open redirect vulnerability)
    // Only allow relative URLs or same-origin URLs
    if (next.startsWith("http://") || next.startsWith("https://")) {
      try {
        const nextUrl = new URL(next);
        if (nextUrl.origin !== resolvedOrigin) {
          console.warn("[OAuth Callback] Rejecting cross-origin redirect", {
            next,
            resolvedOrigin,
          });
          next = "/";
        }
      } catch {
        console.warn("[OAuth Callback] Invalid redirect URL", { next });
        next = "/";
      }
    }

    // Construct final redirect URL
    const redirectUrl = `${resolvedOrigin}${next}`;

    // Check for Vercel/load-balancer scenario
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";

    if (isLocalEnv) {
      return NextResponse.redirect(redirectUrl);
    } else if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`);
    } else {
      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    console.error("[OAuth Callback] Unexpected error:", error);
    return NextResponse.redirect(`${resolvedOrigin}/auth/auth-code-error`);
  }
}
