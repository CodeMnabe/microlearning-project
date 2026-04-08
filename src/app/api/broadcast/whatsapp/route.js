import { NextResponse } from "next/server";
import { sendWhatsappBroadcast } from "@/lib/services/broadcast/sendWhatsappBroadcast";

export async function POST(req) {
  try {
    const body = await req.json();
    const result = await sendWhatsappBroadcast(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("WhatsApp broadcast error:", err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: err.status || 500 },
    );
  }
}
