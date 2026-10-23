const sessionCookieNames = [
  "__Secure-neon-auth.session_token",
  "__Secure-neon-auth.local.session_data",
  "__Secure-neon-auth.session_challenge",
  "__Secure-neon-auth.session_challange",
];

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of sessionCookieNames) {
    headers.append("Set-Cookie", `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`);
  }
  return Response.json({ signedOut: true }, { headers });
}
