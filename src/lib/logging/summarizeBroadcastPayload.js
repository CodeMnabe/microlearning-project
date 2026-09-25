export function summarizeBroadcastPayload(payload) {
  return {
    orgId: payload.orgId,
    recipientCount: payload.recipients?.length ?? 0,
    userIdCount: payload.userIds?.length ?? 0,
    messageLength: (payload.message ?? payload.text ?? "").length,
    hasFiles: Boolean(payload.files?.length),
    hasQuestion: Boolean(payload.question ?? payload.questionId),
  };
}
