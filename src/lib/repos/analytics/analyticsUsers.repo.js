import { hasValue } from "@/lib/helpers/analytics.helpers";
import { fetchRows } from "./analyticsBase.repo";


export async function getUserMetrics(orgId) {
  const users = await fetchRows(
    "user",
    `
      id,
      assistant_id,
      email,
      phone_number,
      phone_country_code,
      phone_national,
      teams_aad_object_id,
      teams_from_id,
      whatsapp_bsuid,
      bird_contact_id
    `,
    (q) => q.eq("organization_id", orgId)
  );

  const total = users.length;

  const withAssistant = users.filter((user) =>
    hasValue(user.assistant_id)
  ).length;

  const withEmail = users.filter((user) => hasValue(user.email)).length;

  const withPhone = users.filter(
    (user) =>
      hasValue(user.phone_number) ||
      (hasValue(user.phone_country_code) && hasValue(user.phone_national))
  ).length;

  const withTeams = users.filter(
    (user) =>
      hasValue(user.teams_aad_object_id) || hasValue(user.teams_from_id)
  ).length;

  const withWhatsapp = users.filter(
    (user) =>
      hasValue(user.whatsapp_bsuid) ||
      hasValue(user.bird_contact_id) ||
      hasValue(user.phone_number)
  ).length;

  return {
    total,
    withAssistant,
    withoutAssistant: Math.max(0, total - withAssistant),
    withEmail,
    withPhone,
    withTeams,
    withWhatsapp,
  };
}