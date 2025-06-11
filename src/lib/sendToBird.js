const messagebird = require("messagebird")(
  "VAhz2aszTMIWpiSWCLviyFQIfNXSscvlrkM1"
); // No 'live_' prefix here

const params = {
  to: "+351925273952", // recipient number
  from: "d2e32ae4-ddf0-563f-b913-a95c1d9c44f2", // the WhatsApp Channel ID from dashboard
  type: "text",
  content: {
    text: "Olá! Esta é uma mensagem de teste.",
  },
};

messagebird.conversations.send(params, function (err, response) {
  if (err) {
    console.error("❌ Error sending message:", err.errors || err);
  } else {
    console.log("✅ Message sent successfully:", response);
  }
});
