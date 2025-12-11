export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_ID = process.env.BOT_APP_ID?.trim();
const APP_PASSWORD = process.env.BOT_APP_PASSWORD?.trim();
const BF_SCOPE = "https://api.botframework.com/.default";

export async function getBotToken(tenantHint) {
  if (!APP_ID || !APP_PASSWORD) {
    throw new Error("Missing BOT_APP_ID or BOT_APP_PASSWORD");
  }

  const order = [tenantHint, "botframework.com"].filter(Boolean);

  let lastErr;
  for (const t of order) {
    try {
      return await fetchTokenAuthority(t);
    } catch (err) {
      lastErr = err;
      console.warn(`[TOKEN FAIL via ${t}]`, err.message);
    }
  }
  throw lastErr || new Error("Unable to get bot token");
}

async function fetchTokenAuthority(authorityTenant) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: APP_ID,
    client_secret: APP_PASSWORD,
    scope: BF_SCOPE,
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${authorityTenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);

  const [, payload] = json.access_token.split(".");
  const claims = JSON.parse(b64urlDecode(payload));

  return json.access_token;
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4 ? 4 - (str.length % 4) : 0;
  return Buffer.from(str + "=".repeat(pad), "base64").toString("utf8");
}
