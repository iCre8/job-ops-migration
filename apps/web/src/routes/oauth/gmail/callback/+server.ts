/**
 * GET /oauth/gmail/callback?code=...
 *
 * Handles the Google OAuth2 authorization callback.
 *
 * Flow:
 *   1. Exchange the authorization code for tokens (Google token endpoint).
 *   2. Fetch the user's email address (Google userinfo endpoint).
 *   3. Upsert the PostApplicationIntegration record via tRPC tracking.connect.
 *   4. Redirect to /tracking.
 *
 * Environment variables required:
 *   GMAIL_OAUTH_CLIENT_ID
 *   GMAIL_OAUTH_CLIENT_SECRET
 *   GMAIL_OAUTH_REDIRECT_URI   (default: http://localhost:3000/oauth/gmail/callback)
 */

import { redirect } from "@sveltejs/kit";
import { trpcServer } from "$lib/server/trpc/server.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const code = event.url.searchParams.get("code");
  const error = event.url.searchParams.get("error");

  if (error || !code) {
    redirect(302, "/tracking?error=oauth_denied");
  }

  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.GMAIL_OAUTH_REDIRECT_URI ??
    "http://localhost:3000/oauth/gmail/callback";

  if (!clientId || !clientSecret) {
    redirect(302, "/tracking?error=oauth_not_configured");
  }

  try {
    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!tokenRes.ok) {
      redirect(302, "/tracking?error=token_exchange_failed");
    }

    type TokenResponse = {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
    };
    const tokens = (await tokenRes.json()) as TokenResponse;

    if (!tokens.refresh_token) {
      // This happens when the user has already granted access and Google
      // does not re-issue a refresh token. Prompt the user to revoke access
      // in their Google account and reconnect.
      redirect(302, "/tracking?error=no_refresh_token");
    }

    // 2. Fetch user email
    let email: string | undefined;
    if (tokens.access_token) {
      const userRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (userRes.ok) {
        const user = (await userRes.json()) as { email?: string };
        email = user.email;
      }
    }

    // 3. Persist via tRPC
    const trpc = await trpcServer(event);
    await trpc.tracking.connect({
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      email,
      tokenExpiryMs: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : undefined,
    });
  } catch {
    redirect(302, "/tracking?error=connect_failed");
  }

  // 4. Redirect to tracking page on success
  redirect(302, "/tracking?connected=1");
};
