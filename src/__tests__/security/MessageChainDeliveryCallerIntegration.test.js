import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function source(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const sender = source(
  "src/lib/services/broadcast/readChains/sendReadChainStep.js",
);
const progression = source(
  "src/lib/services/broadcast/readChains/processReadChainAfterRead.js",
);
const syncReads = source("src/app/api/messagebird/sync-read-receipts/route.js");
const manualReads = source(
  "src/app/api/broadcast/read-chain/process-read/route.js",
);
const scheduled = source("src/app/api/cron/read-chains/route.js");
const delayed = source("src/app/api/cron/read-chain-delays/route.js");
const messageBird = source("src/app/api/messagebird/route.js");

describe("message chain callers use delivery claims", () => {
  it("reserves and claims before the provider call, then completes under ownership", () => {
    const providerCall = sender.indexOf(
      "const result = await sendWhatsappBroadcast",
    );
    expect(sender.indexOf("ensureMessageChainDelivery")).toBeLessThan(
      providerCall,
    );
    expect(sender.indexOf("claimMessageChainDelivery")).toBeLessThan(
      providerCall,
    );
    expect(sender.indexOf("markMessageChainDeliverySendStarted")).toBeLessThan(
      providerCall,
    );
    expect(sender).toMatch(/withLeaseHeartbeat/);
    expect(sender).toMatch(/completeMessageChainDeliverySend/);
    expect(sender).toMatch(/markMessageChainDeliveryUnknownOutcome/);
  });

  it("removes the read progression check-send-upsert sequence", () => {
    expect(progression).toMatch(/ensureMessageChainDelivery/);
    expect(progression).not.toMatch(/getMessageChainDelivery\(/);
    expect(progression).not.toMatch(/createMessageChainDelivery\(/);
    expect(progression).toMatch(/sendReadChainStep/);
  });

  it("keeps direct sync and process-read paths behind the shared progression", () => {
    expect(syncReads).toMatch(/processReadChainAfterRead\(updatedMessage\)/);
    expect(manualReads).toMatch(/processReadChainAfterRead\(message\)/);
  });

  it("routes first scheduled and delayed steps through the shared claimed sender", () => {
    expect(scheduled).toMatch(/sendReadChainStep\(/);
    expect(scheduled).not.toMatch(/getMessageChainDelivery\(/);
    expect(delayed).toMatch(/getDueScheduledMessageChainDeliveries/);
    expect(delayed).toMatch(/sendReadChainStep\(/);
    expect(delayed).not.toMatch(/claimDueScheduledMessageChainDeliveries/);
  });

  it("keeps webhook effects and adds delivery identity metadata for observability", () => {
    expect(messageBird).toMatch(/effectType: "read_chain_processing"/);
    expect(messageBird).toMatch(
      /advance-chain:\$\{updated\.message_chain_recipient_id\}/,
    );
    expect(messageBird).toMatch(
      /chainRecipientId: updated\.message_chain_recipient_id/,
    );
    expect(messageBird).toMatch(/chainStepId: updated\.message_chain_step_id/);
    expect(messageBird).toMatch(/status: "unknown_outcome"/);
  });
});
