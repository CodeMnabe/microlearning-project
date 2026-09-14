import { createClient as createServiceClient } from "@supabase/supabase-js";

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const QUESTION_SELECT = `
  id,
  organization_id,
  kind,
  body,
  options,
  feedback_correct,
  feedback_incorrect,
  expected_answer,
  scheduled_broadcast_id,
  send_group_id,
  created_by_user_id,
  expires_at,
  created_at
`;

const ANSWER_SELECT = `
  id,
  question_id,
  organization_id,
  user_id,
  message_id,
  inbound_message_id,
  answer_text,
  option_index,
  is_correct,
  verdict,
  ai_feedback,
  admin_verdict,
  review_needed,
  answered_at
`;

function toIso(value) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

export async function createQuestion({
  organizationId,
  kind,
  body,
  options = null,
  feedbackCorrect = null,
  feedbackIncorrect = null,
  expectedAnswer = null,
  scheduledBroadcastId = null,
  sendGroupId = null,
  createdByUserId = null,
  expiresAt,
}) {
  const { data, error } = await supabase
    .from("question")
    .insert([
      {
        organization_id: organizationId,
        kind,
        body,
        options,
        feedback_correct: feedbackCorrect || null,
        feedback_incorrect: feedbackIncorrect || null,
        expected_answer: expectedAnswer || null,
        scheduled_broadcast_id: scheduledBroadcastId,
        send_group_id: sendGroupId,
        created_by_user_id: createdByUserId,
        expires_at: toIso(expiresAt),
      },
    ])
    .select(QUESTION_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function getQuestionById(id) {
  if (!id) return null;

  const { data, error } = await supabase
    .from("question")
    .select(QUESTION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getQuestionsByIds(ids = []) {
  const clean = [...new Set((ids || []).filter(Boolean))];

  if (!clean.length) return [];

  const { data, error } = await supabase
    .from("question")
    .select(QUESTION_SELECT)
    .in("id", clean);

  if (error) throw error;
  return data || [];
}

export async function getQuestionAnswer(questionId, userId) {
  if (!questionId || !userId) return null;

  const { data, error } = await supabase
    .from("question_answer")
    .select(ANSWER_SELECT)
    .eq("question_id", questionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * Regista a primeira resposta de um contacto. Devolve null quando já havia
 * uma resposta a esta pergunta (violação da chave única).
 */
export async function createQuestionAnswer({
  questionId,
  organizationId,
  userId,
  messageId = null,
  inboundMessageId = null,
  answerText = null,
  optionIndex = null,
  isCorrect = null,
  verdict = null,
  aiFeedback = null,
  reviewNeeded = false,
}) {
  const { data, error } = await supabase
    .from("question_answer")
    .insert([
      {
        question_id: questionId,
        organization_id: organizationId,
        user_id: userId,
        message_id: messageId,
        inbound_message_id: inboundMessageId,
        answer_text: answerText,
        option_index: optionIndex,
        is_correct: isCorrect,
        verdict,
        ai_feedback: aiFeedback,
        review_needed: Boolean(reviewNeeded),
      },
    ])
    .select(ANSWER_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }

  return data;
}
