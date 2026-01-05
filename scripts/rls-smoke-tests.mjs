import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const ORG_ID = '219c2724-033c-4f98-bc2a-3ffe12c5a618';
const APRENDIZ_UID = 'c877ae1f-f2be-4697-a227-62778565305e';
const REFERENTE_UID = '893b28a1-331c-432a-bb45-e45700ba3d95';

const COURSE_ID = '2c8e263a-e835-4ec8-828c-9b57ce5c7156';
const UNIT_ID = '809b8e44-d6b1-4478-80b5-af4dbf53dd91';
const LESSON_ID = '30b3b16c-3b59-4eae-b8cf-c15194a2afdc';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

const REFERENTE_EMAIL = process.env.TEST_REFERENTE_EMAIL;
const REFERENTE_PASSWORD = process.env.TEST_REFERENTE_PASSWORD;

let failures = 0;

async function login(email, password) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function test(name, fn, { critical = true } = {}) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`❌ FAIL: ${name}`);
    console.error(err.message);
    if (critical) {
      // continue running to report all failures, exit at end
    }
  }
}

const LOCAL_A = '2580e080-bf31-41c0-8242-7d90b070d060';
const LOCAL_B = '13cd2ffe-ee2b-46b3-8fd0-bb8a705dd1ef';

function isUniqueViolation(error) {
  return error?.code === '23505';
}

function isRlsViolation(error) {
  return /row-level security/i.test(error?.message ?? '');
}

async function ensureLessonCompletion(client, userId) {
  const payload = {
    org_id: ORG_ID,
    local_id: LOCAL_A,
    course_id: COURSE_ID,
    unit_id: UNIT_ID,
    lesson_id: LESSON_ID,
    user_id: userId,
    completed_at: new Date().toISOString(),
  };

  const { error } = await client.from('lesson_completions').insert(payload);
  if (error && !isUniqueViolation(error)) {
    throw error;
  }
}

async function getQuizId(client) {
  const { data, error } = await client
    .from('quizzes')
    .select('id')
    .eq('course_id', COURSE_ID)
    .limit(1);

  if (error) throw error;
  return data?.[0]?.id ?? null;
}

async function getQuizQuestionAndOption(client, quizId) {
  const { data: questions, error: questionsError } = await client
    .from('quiz_questions')
    .select('id')
    .eq('quiz_id', quizId)
    .limit(1);

  if (questionsError) throw questionsError;
  const questionId = questions?.[0]?.id;
  if (!questionId) return null;

  const { data: options, error: optionsError } = await client
    .from('quiz_options')
    .select('id')
    .eq('question_id', questionId)
    .limit(1);

  if (optionsError) throw optionsError;
  const optionId = options?.[0]?.id ?? null;

  return { questionId, optionId };
}

async function ensureQuizAttempt(client, quizId, userId) {
  const payload = {
    org_id: ORG_ID,
    local_id: LOCAL_A,
    course_id: COURSE_ID,
    quiz_id: quizId,
    user_id: userId,
    attempt_no: 1,
    submitted_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await client
    .from('quiz_attempts')
    .select('id')
    .eq('quiz_id', quizId)
    .eq('user_id', userId)
    .eq('attempt_no', payload.attempt_no)
    .limit(1);

  if (existingError) throw existingError;
  if (existing?.[0]?.id) return existing[0].id;

  const { data, error } = await client
    .from('quiz_attempts')
    .insert(payload)
    .select('id')
    .single();

  if (error && !isUniqueViolation(error)) {
    throw error;
  }
  if (data?.id) return data.id;

  const { data: fallback, error: fallbackError } = await client
    .from('quiz_attempts')
    .select('id')
    .eq('quiz_id', quizId)
    .eq('user_id', userId)
    .eq('attempt_no', payload.attempt_no)
    .limit(1);

  if (fallbackError) throw fallbackError;
  return fallback?.[0]?.id ?? null;
}

async function run() {
  const aprendiz = await login(
    process.env.TEST_APRENDIZ_EMAIL,
    process.env.TEST_APRENDIZ_PASSWORD,
  );

  await test('Aprendiz ve SOLO su local', async () => {
    const { data, error } = await aprendiz.from('locals').select('id,name');
    if (error) throw error;

    const ids = data.map((r) => r.id);
    if (!ids.includes(LOCAL_A)) throw new Error('No ve su Local A');
    if (ids.includes(LOCAL_B)) throw new Error('Ve Local B (NO debería)');
  });

  await test('Aprendiz ve SOLO su local_membership', async () => {
    const { data, error } = await aprendiz
      .from('local_memberships')
      .select('local_id,user_id');

    if (error) throw error;
    if (!data.some((r) => r.local_id === LOCAL_A)) {
      throw new Error('No ve su local_membership');
    }
  });
  await test('Aprendiz ve asignación del curso en Local A', async () => {
    const { data, error } = await aprendiz
      .from('local_courses')
      .select('local_id, course_id')
      .eq('local_id', LOCAL_A);

    if (error) throw error;

    const ok = (data ?? []).some((r) => r.course_id === COURSE_ID);
    if (!ok) throw new Error('No ve el course_id asignado a Local A');
  });
  await test('Aprendiz NO ve asignaciones de Local B', async () => {
    const { data, error } = await aprendiz
      .from('local_courses')
      .select('local_id, course_id')
      .eq('local_id', LOCAL_B);

    if (error) throw error;
    if ((data ?? []).length > 0)
      throw new Error('Ve asignaciones de Local B (NO debería)');
  });
  await test('Aprendiz ve cursos del dashboard en Local A', async () => {
    const { data, error } = await aprendiz
      .from('v_learner_dashboard_courses')
      .select('local_id, course_id')
      .eq('local_id', LOCAL_A);

    if (error) throw error;
    const ok = (data ?? []).some((r) => r.course_id === COURSE_ID);
    if (!ok) throw new Error('No ve cursos del dashboard en Local A');
  });
  await test('Aprendiz NO ve cursos del dashboard en Local B', async () => {
    const { data, error } = await aprendiz
      .from('v_learner_dashboard_courses')
      .select('local_id, course_id')
      .eq('local_id', LOCAL_B);

    if (error) throw error;
    if ((data ?? []).length > 0)
      throw new Error('Ve cursos del dashboard en Local B (NO debería)');
  });
  await test('Aprendiz ve course outline en Local A', async () => {
    const { data, error } = await aprendiz
      .from('v_course_outline')
      .select('local_id, course_id, lesson_id')
      .eq('local_id', LOCAL_A)
      .eq('course_id', COURSE_ID);

    if (error) throw error;
    if ((data ?? []).length === 0)
      throw new Error('No ve course outline en Local A');
  });
  await test('Aprendiz NO ve course outline en Local B', async () => {
    const { data, error } = await aprendiz
      .from('v_course_outline')
      .select('local_id, course_id')
      .eq('local_id', LOCAL_B)
      .eq('course_id', COURSE_ID);

    if (error) throw error;
    if ((data ?? []).length > 0)
      throw new Error('Ve course outline en Local B (NO debería)');
  });
  await test('Aprendiz ve lesson player en Local A', async () => {
    const { data, error } = await aprendiz
      .from('v_lesson_player')
      .select('local_id, lesson_id, is_completed')
      .eq('local_id', LOCAL_A)
      .eq('lesson_id', LESSON_ID);

    if (error) throw error;
    if ((data ?? []).length === 0)
      throw new Error('No ve lesson player en Local A');
  });
  await test('Aprendiz NO ve lesson player en Local B', async () => {
    const { data, error } = await aprendiz
      .from('v_lesson_player')
      .select('local_id, lesson_id')
      .eq('local_id', LOCAL_B)
      .eq('lesson_id', LESSON_ID);

    if (error) throw error;
    if ((data ?? []).length > 0)
      throw new Error('Ve lesson player en Local B (NO debería)');
  });
  await test('Aprendiz ve v_my_locals con Local A', async () => {
    const { data, error } = await aprendiz.from('v_my_locals').select('*');
    if (error) throw error;
    if ((data ?? []).length === 0) throw new Error('v_my_locals vacio');
    const ids = data.map((row) => row.local_id);
    if (!ids.includes(LOCAL_A)) throw new Error('No ve Local A en v_my_locals');
    if (ids.includes(LOCAL_B))
      throw new Error('Ve Local B en v_my_locals (NO debería)');
  });
  await test('Aprendiz ve quiz state not_started (si aplica)', async () => {
    const quizId = await getQuizId(aprendiz);
    if (!quizId) {
      return;
    }

    const { data, error } = await aprendiz
      .from('v_quiz_state')
      .select('attempt_status')
      .eq('local_id', LOCAL_A)
      .eq('quiz_id', quizId)
      .single();

    if (error) throw error;
    if (
      !['not_started', 'in_progress', 'submitted'].includes(data.attempt_status)
    ) {
      throw new Error(`Estado inesperado: ${data.attempt_status}`);
    }
  });
  await test('Aprendiz ve quiz state in_progress luego de attempt (si aplica)', async () => {
    const quizId = await getQuizId(aprendiz);
    if (!quizId) {
      return;
    }

    await ensureQuizAttempt(aprendiz, quizId, APRENDIZ_UID);

    const { data, error } = await aprendiz
      .from('v_quiz_state')
      .select('attempt_status')
      .eq('local_id', LOCAL_A)
      .eq('quiz_id', quizId)
      .single();

    if (error) throw error;
    if (data.attempt_status !== 'in_progress') {
      throw new Error(
        `Estado esperado in_progress, got ${data.attempt_status}`,
      );
    }
  });
  await test('Aprendiz responde quiz y answered_count incrementa (si aplica)', async () => {
    const quizId = await getQuizId(aprendiz);
    if (!quizId) {
      return;
    }

    const attemptId = await ensureQuizAttempt(aprendiz, quizId, APRENDIZ_UID);
    const qa = await getQuizQuestionAndOption(aprendiz, quizId);
    if (!attemptId || !qa) {
      return;
    }

    const payload = {
      org_id: ORG_ID,
      local_id: LOCAL_A,
      course_id: COURSE_ID,
      attempt_id: attemptId,
      question_id: qa.questionId,
      user_id: APRENDIZ_UID,
      option_id: qa.optionId ?? null,
      answer_text: qa.optionId ? null : 'respuesta',
    };

    const { error: insertError } = await aprendiz
      .from('quiz_answers')
      .insert(payload);
    if (insertError && !isUniqueViolation(insertError)) {
      throw insertError;
    }

    const { data, error } = await aprendiz
      .from('v_quiz_state')
      .select('answered_count, questions')
      .eq('local_id', LOCAL_A)
      .eq('quiz_id', quizId)
      .single();

    if (error) throw error;
    if (data.answered_count < 1) {
      throw new Error('answered_count no incremento');
    }
    const hasSelected =
      Array.isArray(data.questions) &&
      data.questions.some((q) => q.selected_option_id || q.answer_text);
    if (!hasSelected) {
      throw new Error('questions JSON sin selected_option_id/answer_text');
    }
  });
  await test('Aprendiz NO ve quiz state en Local B (si aplica)', async () => {
    const quizId = await getQuizId(aprendiz);
    if (!quizId) {
      return;
    }

    const { data, error } = await aprendiz
      .from('v_quiz_state')
      .select('local_id')
      .eq('local_id', LOCAL_B)
      .eq('quiz_id', quizId);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Ve quiz state en Local B (NO debería)');
    }
  });
  await test('Aprendiz puede insertar lesson_completion OWN', async () => {
    await ensureLessonCompletion(aprendiz, APRENDIZ_UID);
  });
  await test('Aprendiz NO puede insertar lesson_completion para otro usuario', async () => {
    const payload = {
      org_id: ORG_ID,
      local_id: LOCAL_A,
      course_id: COURSE_ID,
      unit_id: UNIT_ID,
      lesson_id: LESSON_ID,
      user_id: REFERENTE_UID, // intenta escribir por otro
      completed_at: new Date().toISOString(),
    };

    const { error } = await aprendiz.from('lesson_completions').insert(payload);

    // Aquí esperamos error por RLS
    if (!error)
      throw new Error('Insert indebido permitido; debería fallar por RLS');
    if (!isRlsViolation(error)) {
      throw new Error(`Insert falló pero no por RLS: ${error.message}`);
    }
  });

  await test('Aprendiz puede insertar quiz_attempt OWN (si aplica)', async () => {
    const quizId = await getQuizId(aprendiz);
    if (!quizId) {
      return;
    }

    await ensureQuizAttempt(aprendiz, quizId, APRENDIZ_UID);
  });

  await test('Aprendiz puede insertar quiz_answer OWN (si aplica)', async () => {
    const quizId = await getQuizId(aprendiz);
    if (!quizId) {
      return;
    }

    const attemptId = await ensureQuizAttempt(aprendiz, quizId, APRENDIZ_UID);
    if (!attemptId) {
      throw new Error('No se pudo obtener quiz_attempt');
    }

    const qa = await getQuizQuestionAndOption(aprendiz, quizId);
    if (!qa) {
      return;
    }

    const payload = {
      org_id: ORG_ID,
      local_id: LOCAL_A,
      course_id: COURSE_ID,
      attempt_id: attemptId,
      question_id: qa.questionId,
      user_id: APRENDIZ_UID,
      option_id: qa.optionId ?? null,
      answer_text: qa.optionId ? null : 'respuesta',
    };

    const { error } = await aprendiz.from('quiz_answers').insert(payload);
    if (error && !isUniqueViolation(error)) {
      throw error;
    }
  });

  await test('Aprendiz NO puede insertar quiz_answer para otro usuario', async () => {
    const quizId = await getQuizId(aprendiz);
    if (!quizId) {
      return;
    }

    const attemptId = await ensureQuizAttempt(aprendiz, quizId, APRENDIZ_UID);
    if (!attemptId) {
      throw new Error('No se pudo obtener quiz_attempt');
    }

    const qa = await getQuizQuestionAndOption(aprendiz, quizId);
    if (!qa) {
      return;
    }

    const payload = {
      org_id: ORG_ID,
      local_id: LOCAL_A,
      course_id: COURSE_ID,
      attempt_id: attemptId,
      question_id: qa.questionId,
      user_id: REFERENTE_UID,
      option_id: qa.optionId ?? null,
      answer_text: qa.optionId ? null : 'respuesta',
    };

    const { error } = await aprendiz.from('quiz_answers').insert(payload);
    if (!error)
      throw new Error('Insert indebido permitido; debería fallar por RLS');
    if (!isRlsViolation(error)) {
      throw new Error(`Insert falló pero no por RLS: ${error.message}`);
    }
  });

  if (!REFERENTE_EMAIL || !REFERENTE_PASSWORD) {
    throw new Error('Missing TEST_REFERENTE_EMAIL or TEST_REFERENTE_PASSWORD');
  }

  const referente = await login(REFERENTE_EMAIL, REFERENTE_PASSWORD);

  await test('Referente ve roster de Local A', async () => {
    const { data, error } = await referente
      .from('local_memberships')
      .select('local_id,user_id,role')
      .eq('local_id', LOCAL_A);

    if (error) throw error;
    if (!data?.some((r) => r.user_id === REFERENTE_UID)) {
      throw new Error('No ve su membership en Local A');
    }
  });

  await test('Referente NO ve memberships de Local B', async () => {
    const { data, error } = await referente
      .from('local_memberships')
      .select('local_id,user_id')
      .eq('local_id', LOCAL_B);

    if (error) throw error;
    if ((data ?? []).length > 0)
      throw new Error('Ve memberships de Local B (NO debería)');
  });

  await test('Referente puede leer progreso del Local A', async () => {
    await ensureLessonCompletion(aprendiz, APRENDIZ_UID);

    const { data, error } = await referente
      .from('lesson_completions')
      .select('local_id,lesson_id,user_id')
      .eq('local_id', LOCAL_A);

    if (error) throw error;
    if (!data?.some((r) => r.lesson_id === LESSON_ID)) {
      throw new Error('No ve progreso del Local A');
    }
  });

  await test('Referente NO ve progreso de Local B', async () => {
    const { data, error } = await referente
      .from('lesson_completions')
      .select('local_id,lesson_id')
      .eq('local_id', LOCAL_B);

    if (error) throw error;
    if ((data ?? []).length > 0)
      throw new Error('Ve progreso de Local B (NO debería)');
  });

  await test('Referente NO puede insertar lesson_completion', async () => {
    const payload = {
      org_id: ORG_ID,
      local_id: LOCAL_A,
      course_id: COURSE_ID,
      unit_id: UNIT_ID,
      lesson_id: LESSON_ID,
      user_id: REFERENTE_UID,
      completed_at: new Date().toISOString(),
    };

    const { error } = await referente
      .from('lesson_completions')
      .insert(payload);
    if (!error)
      throw new Error('Insert indebido permitido; debería fallar por RLS');
    if (!isRlsViolation(error)) {
      throw new Error(`Insert falló pero no por RLS: ${error.message}`);
    }
  });

  await test('Referente NO puede insertar quiz_attempts (si aplica)', async () => {
    const quizId = await getQuizId(referente);
    if (!quizId) {
      return;
    }

    const payload = {
      org_id: ORG_ID,
      local_id: LOCAL_A,
      course_id: COURSE_ID,
      quiz_id: quizId,
      user_id: REFERENTE_UID,
      attempt_no: 1,
      submitted_at: new Date().toISOString(),
    };

    const { error } = await referente.from('quiz_attempts').insert(payload);
    if (!error)
      throw new Error('Insert indebido permitido; debería fallar por RLS');
    if (!isRlsViolation(error)) {
      throw new Error(`Insert falló pero no por RLS: ${error.message}`);
    }
  });

  await test('Referente NO puede insertar quiz_answers (si aplica)', async () => {
    const quizId = await getQuizId(referente);
    if (!quizId) {
      return;
    }

    const attemptId = await ensureQuizAttempt(aprendiz, quizId, APRENDIZ_UID);
    if (!attemptId) {
      throw new Error('No se pudo obtener quiz_attempt');
    }

    const qa = await getQuizQuestionAndOption(referente, quizId);
    if (!qa) {
      return;
    }

    const payload = {
      org_id: ORG_ID,
      local_id: LOCAL_A,
      course_id: COURSE_ID,
      attempt_id: attemptId,
      question_id: qa.questionId,
      user_id: REFERENTE_UID,
      option_id: qa.optionId ?? null,
      answer_text: qa.optionId ? null : 'respuesta',
    };

    const { error } = await referente.from('quiz_answers').insert(payload);
    if (!error)
      throw new Error('Insert indebido permitido; debería fallar por RLS');
    if (!isRlsViolation(error)) {
      throw new Error(`Insert falló pero no por RLS: ${error.message}`);
    }
  });
  await test('Referente ve v_my_locals con Local A', async () => {
    const { data, error } = await referente.from('v_my_locals').select('*');
    if (error) throw error;
    const ids = (data ?? []).map((row) => row.local_id);
    if (!ids.includes(LOCAL_A))
      throw new Error('Referente no ve Local A en v_my_locals');
    if (ids.includes(LOCAL_B))
      throw new Error('Referente ve Local B en v_my_locals (NO debería)');
  });

  const orgAdmin = await login(
    process.env.TEST_ORGADMIN_EMAIL,
    process.env.TEST_ORGADMIN_PASSWORD,
  );
  await test(
    'Org admin v_my_locals solo propios (o vacio)',
    async () => {
      const { data, error } = await orgAdmin.from('v_my_locals').select('*');
      if (error) throw error;
      const ids = (data ?? []).map((row) => row.local_id);
      if (ids.includes(LOCAL_B) && !ids.includes(LOCAL_A)) {
        throw new Error('Org admin ve Local B sin Local A (revisar seeds)');
      }
    },
    { critical: false },
  );

  const superadmin = await login(
    process.env.TEST_SUPERADMIN_EMAIL,
    process.env.TEST_SUPERADMIN_PASSWORD,
  );
  await test(
    'Superadmin v_my_locals solo propios (o vacio)',
    async () => {
      const { data, error } = await superadmin.from('v_my_locals').select('*');
      if (error) throw error;
      const ids = (data ?? []).map((row) => row.local_id);
      if (ids.includes(LOCAL_B) && !ids.includes(LOCAL_A)) {
        throw new Error('Superadmin ve Local B sin Local A (revisar seeds)');
      }
    },
    { critical: false },
  );

  if (failures > 0) {
    process.exit(1);
  }
}

run();
