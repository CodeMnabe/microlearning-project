import { NextResponse } from "next/server";
import { createContact } from "@/lib/repos/contact.repo";

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  try {
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

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
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
