export async function getTagsInOrg(sb, orgId) {
  const { data, error } = await sb
    .from("tags")
    .select("*")
    .eq("org_id", orgId)
    .order("name");

  if (error) throw error;
  return data;
}

export async function createTag(sb, { orgId, name, color }) {
  const slug = name.toLowerCase().trim().replace(/\s+/g, "-");

  const { data, error } = await sb
    .from("tags")
    .insert({ org_id: orgId, name, slug, color })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTag(sb, id, fields) {
  const patch = {};

  if (fields.name !== undefined) {
    patch.name = fields.name;
    patch.slug = fields.name.toLowerCase().trim().replace(/\s+/g, "-");
  }

  if (fields.color !== undefined) patch.color = fields.color;
  if (fields.is_archived !== undefined) patch.is_archived = fields.is_archived;

  const { data, error } = await sb
    .from("tags")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTag(sb, id) {
  const { error } = await sb.from("tags").delete().eq("id", id);

  if (error) throw error;
  return true;
}

export async function getTagsByExactNamesInOrg(sb, orgId, names = []) {
  const cleanNames = [
    ...new Set(names.map((name) => String(name || "").trim()).filter(Boolean)),
  ];

  if (!cleanNames.length) return [];

  const { data, error } = await sb
    .from("tags")
    .select("id, org_id, name, slug, color, is_archived")
    .eq("org_id", orgId)
    .eq("is_archived", false)
    .in("name", cleanNames);

  if (error) throw error;

  return data || [];
}

export async function addTagsToUser(sb, userId, tagIds = []) {
  const cleanTagIds = [
    ...new Set(
      tagIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];

  if (!userId || !cleanTagIds.length) return [];

  const rows = cleanTagIds.map((tagId) => ({
    user_id: userId,
    tag_id: tagId,
  }));

  const { data, error } = await sb
    .from("user_tag")
    .upsert(rows, {
      onConflict: "user_id,tag_id",
      ignoreDuplicates: true,
    })
    .select();

  if (error) throw error;

  return data || [];
}
