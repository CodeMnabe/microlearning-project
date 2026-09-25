import { NextResponse } from "next/server";
import { createContact, hasRecentContactFromEmail } from "@/lib/repos/contact.repo";

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null && Number(contentLength) > 16384) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const body = await request.json();

    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const company = String(body?.company || "").trim();
    const message = String(body?.message || "").trim();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 },
      );
    }

    if (body.website) {
      return NextResponse.json({ ok: true });
    }

    if (name.length > 120 || email.length > 254 || company.length > 120 || message.length > 4000) {
      return NextResponse.json({ error: "Field too long" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    }

    const sinceIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    if (await hasRecentContactFromEmail(email, sinceIso)) {
      return NextResponse.json(
        { error: "Please wait before sending another message." },
        { status: 429 },
      );
    }

    const contact = await createContact({
      name,
      email,
      company: company || null,
      message,
      source: "landing_page",
      status: "new",
    });

    return NextResponse.json({ ok: true, contactId: contact.id });
  } catch (error) {
    console.error("[contact-form] error:", error);

    return NextResponse.json(
      { error: "Something went wrong while sending the form." },
      { status: 500 },
    );
  }
}
