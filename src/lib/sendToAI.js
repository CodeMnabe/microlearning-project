// lib/sendToAi.js
require("dotenv").config();
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const {
  createOrganization,
  getOrganization,
  createUser,
  getUserById,
  getUserByNumber,
  createThread,
  getThreadsForUser,
} = require("./db.js");

let defaultOrg = getOrganization("TestOrg");
if (!defaultOrg) {
  defaultOrg = createOrganization("TestOrg");
}

async function chatWithAssistant(userNumber, userMessage) {
  try {
    //* Check if user exists in the database. If not, create a new user.
    let user = getUserByNumber(userNumber);
    if (!user) {
      user = createUser({
        organizationId: defaultOrg.id,
        phoneNumber: userNumber,
        name: "Unknown",
      });
    }

    //* Checks if the user has any thread to continue the conversation from, if not creates a new thread
    let thread =
      getThreadsForUser(user.id).length > 0 ? getThreadsForUser(user.id) : [];

    if (!thread || thread.length === 0) {
      const newThread = await client.beta.threads.create();
      thread.push(createThread({ userId: user.id, aiThreadId: newThread.id }));
    }

    console.log(thread[thread.length - 1].aiThreadId);

    //* Creates the message to send to the assistant
    const newUserMessage = await client.beta.threads.messages.create(
      thread[thread.length - 1].aiThreadId,
      {
        role: "user",
        content: userMessage,
      }
    );

    //* Creates the run so we can check if the assistant has responded
    const run = await client.beta.threads.runs.create(
      thread[thread.length - 1].aiThreadId,
      {
        assistant_id: process.env.OPENAI_ASSISTANT_ID,
      }
    );

    //* Check if the assistant has finished responding by checking the run status
    let runStatus = "in_progress";
    while (runStatus !== "completed") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const runCheck = await client.beta.threads.runs.retrieve(
        thread[thread.length - 1].aiThreadId,
        run.id
      );
      runStatus = runCheck.status;
    }

    //* Fetch the messages from the assistant and return them
    const messages = await client.beta.threads.messages.list(
      thread[thread.length - 1].aiThreadId
    );
    const aiResponse = messages.data[0].content[0].text.value;

    console.log("Resposta AI: ", aiResponse);
    //* Returns the response from the assistant, the message ID and the thread ID used
    return {
      message: aiResponse,
      userMessageId: newUserMessage.id,
      assistantMessageId: messages.data[0].id,
      threadId: thread[thread.length - 1].aiThreadId,
    };
  } catch (err) {
    console.error("Error calling OpenAI:", err);
    return "Desculpa, ocorreu um erro ao processar a tua mensagem";
  }
}

module.exports = chatWithAssistant;
