import { NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(request) {
  const { to, message } = await request.json();

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsAppFrom = process.env.TWILIO_WHATSAPP_NUMBER;
  const client = twilio(accountSid, authToken);

  try {
    const msg = await client.messages.create({
      from: `whatsapp:${whatsAppFrom}`,
      to: `whatsapp:+351${to}`,
      body: message,
    });
    return NextResponse.json({ sid: msg.sid });
  } catch (err) {
    console.error("Erro ao enviar:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
