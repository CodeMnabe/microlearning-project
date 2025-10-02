require("dotenv").config();
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSessionOpen } from "@/lib/whatsapp/whatsapp-session";
import { toE164 } from "@/lib/whatsapp/toE164";
import { getUserByNumber } from "@/lib/repos/user.repo";
import { getOrganization } from "@/lib/repos/organizations.repo";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function POST(req) {
  try {
    const {
      orgId,
      recipients = [],
      message = "",
      imageUrls = [],
      templateId = [],
      languageCode = "pt-PT",
      waitHours = 48,
    } = await req.json();

    if (!orgId || recipients.length === 0) {
      return NextResponse.json(
        { error: "orgId e recipients são precisos" },
        { status: 400 }
      );
    }

    const org = await getOrganization(orgId);
    if (!org?.channel_id) {
      return NextResponse.json(
        { error: "Organização não tem channel_id" },
        { status: 400 }
      );
    }

    const results = [];
    for (const rcp of recipients) {
      try {
      } catch (err) {
        results.push({ recipient: rcp, ok: false, reason: String(err) });
      }
    }

    // const {data: pending, error: poErr} = await supabase
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
