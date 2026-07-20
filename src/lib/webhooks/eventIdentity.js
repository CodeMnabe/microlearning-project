import crypto from "node:crypto";

function normalize(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }

  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function hashWebhookValue(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function minimalMessageBirdEvent(event) {
  const payload = event?.payload || {};

  if (event?.event === "whatsapp.interaction") {
    return {
      service: event.service,
      event: event.event,
      payload: {
        type: payload.type,
        messageId: payload.messageId,
        channelId: payload.channelId,
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
      },
    };
  }

  return {
    service: event?.service,
    event: event?.event,
    payload: {
      id: payload.id,
      messageId: payload.messageId,
      channelId: payload.channelId,
      channel: payload.channel?.id ? { id: payload.channel.id } : undefined,
      receiver: payload.receiver?.channel?.id
        ? { channel: { id: payload.receiver.channel.id } }
        : undefined,
      sender: payload.sender
        ? {
            identifierKey: payload.sender.identifierKey,
            identifierValue: payload.sender.identifierValue,
            contact: payload.sender.contact
              ? {
                  id: payload.sender.contact.id,
                  identifierKey: payload.sender.contact.identifierKey,
                  identifierValue: payload.sender.contact.identifierValue,
                  identifiers: Array.isArray(payload.sender.contact.identifiers)
                    ? payload.sender.contact.identifiers.map((identifier) => ({
                        identifierKey: identifier?.identifierKey,
                        identifierValue: identifier?.identifierValue,
                      }))
                    : undefined,
                }
              : undefined,
          }
        : undefined,
      contact: payload.contact?.id ? { id: payload.contact.id } : undefined,
      meta: payload.meta?.extraInformation
        ? { extraInformation: payload.meta.extraInformation }
        : undefined,
      body: payload.body
        ? {
            id: payload.body.id,
            type: payload.body.type,
            text: payload.body.text?.text
              ? { text: payload.body.text.text }
              : undefined,
          }
        : undefined,
    },
  };
}

export function getMessageBirdChannelId(event) {
  return (
    normalize(event?.payload?.channelId) ||
    normalize(event?.payload?.channel?.id) ||
    normalize(event?.payload?.receiver?.channel?.id)
  );
}

export function buildMessageBirdEventIdentity(event, organizationId) {
  if (!event || Number.isNaN(Number(organizationId))) return null;

  const channelId = getMessageBirdChannelId(event);
  if (!channelId) return null;

  let eventType;
  let externalEventId;

  if (
    event.service === "channels" &&
    event.event === "whatsapp.inbound" &&
    event.payload?.body?.type === "text"
  ) {
    eventType = "whatsapp.inbound.text";
    externalEventId =
      normalize(event.payload?.id) ||
      normalize(event.payload?.messageId) ||
      normalize(event.payload?.body?.id);
  } else if (
    event.service === "channels" &&
    event.event === "whatsapp.interaction" &&
    event.payload?.type === "read"
  ) {
    eventType = "whatsapp.interaction.read";
    externalEventId = normalize(event.payload?.messageId);
  } else {
    return null;
  }

  if (!externalEventId) return null;

  const storedEvent = minimalMessageBirdEvent(event);

  return {
    provider: "messagebird",
    organizationId: Number(organizationId),
    eventType,
    scopeId: `channel:${channelId}`,
    externalEventId,
    payloadHash: hashWebhookValue(storedEvent),
    metadata: { event: storedEvent },
  };
}

function minimalTeamsActivity(activity) {
  return {
    type: activity?.type,
    id: activity?.id,
    action: activity?.action,
    text: activity?.text,
    serviceUrl: activity?.serviceUrl,
    channelData: activity?.channelData
      ? {
          tenant: activity.channelData.tenant?.id
            ? { id: activity.channelData.tenant.id }
            : undefined,
          team: activity.channelData.team
            ? {
                id: activity.channelData.team.id,
                aadGroupId: activity.channelData.team.aadGroupId,
              }
            : undefined,
          channel: activity.channelData.channel?.id
            ? { id: activity.channelData.channel.id }
            : undefined,
        }
      : undefined,
    conversation: activity?.conversation
      ? {
          id: activity.conversation.id,
          tenantId: activity.conversation.tenantId,
          conversationType: activity.conversation.conversationType,
          isGroup: activity.conversation.isGroup,
        }
      : undefined,
    from: activity?.from
      ? {
          id: activity.from.id,
          aadObjectId: activity.from.aadObjectId,
        }
      : undefined,
  };
}

export function getTeamsTenantId(activity) {
  return (
    normalize(activity?.channelData?.tenant?.id) ||
    normalize(activity?.conversation?.tenantId)
  );
}

export function buildTeamsEventIdentity(activity, organizationId) {
  const externalEventId = normalize(activity?.id);
  const tenantId = getTeamsTenantId(activity);
  const conversationId = normalize(activity?.conversation?.id) || "none";

  if (!externalEventId || !tenantId || Number.isNaN(Number(organizationId))) {
    return null;
  }

  let eventType;
  if (activity.type === "message") {
    eventType = "teams.message";
  } else if (activity.type === "installationUpdate" && activity.action) {
    eventType = `teams.installationUpdate.${normalize(activity.action)}`;
  } else {
    return null;
  }

  const storedActivity = minimalTeamsActivity(activity);

  return {
    provider: "teams",
    organizationId: Number(organizationId),
    eventType,
    scopeId: `tenant:${tenantId}:conversation:${conversationId}`,
    externalEventId,
    payloadHash: hashWebhookValue(storedActivity),
    metadata: { activity: storedActivity },
  };
}
