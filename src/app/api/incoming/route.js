import { NextResponse } from "next/server";
import twilio from "twilio";
import chatWithAssistant from "@/lib/sendToAI";
import { createMessage } from "@/lib/repos/messages.repo";

export async function POST(request) {
  try {
    //* Reads the message the body brings from the POST request to get the information from Twilio
    const body = await request.text();
    const params = new URLSearchParams(body);

    const incomingMessage = params.get("Body");
    const fromNumber = params.get("From");
    const userNumber = fromNumber.replace("whatsapp:+351", "");

    const { MessagingResponse } = twilio.twiml;

    console.log(`Received message: "${incomingMessage}" from ${userNumber}`);

    //* Sends the message to the AssistantsAPI
    let aiResponse = {};
    try {
      //* Receives an object that contains the following { message, userMessageId, assistantMessageId, threadId }
      aiResponse = await chatWithAssistant(userNumber, incomingMessage);
    } catch (err) {
      console.error("Erro ao chamar IA:", err);
      aiResponse = "Desculpe, ocorreu um erro ao processar tua mensagem.";
    }
    //* Creates a new record in the database from the users message (threadId, messageId, whatsAppId, content, role)
    const userMessage = createMessage({
      threadId: aiResponse.threadId,
      messageId: aiResponse.userMessageId,
      whatsAppId: params.get("MessageSid"),
      content: incomingMessage,
      role: "USER",
    });
    console.log(userMessage);

    //* Makes an api call to send a message back
    const res = await fetch("http://localhost:3000/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: userNumber,
        message: aiResponse.message,
      }),
    });

    //* Gets the ID from the response of the api call
    const data = await res.json();
    const sid = data.sid;

    //* Creates a new record in the database from the assistants message
    const assistantMessage = createMessage({
      threadId: aiResponse.threadId,
      messageId: aiResponse.assistantMessageId,
      whatsAppId: sid,
      content: aiResponse.message,
      role: "ASSISTANT",
    });
    console.log(assistantMessage);

    return NextResponse.json({ status: 200 });
  } catch (err) {
    console.error("Erro geral /api/incoming:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
