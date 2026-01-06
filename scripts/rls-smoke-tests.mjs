import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const ORG_ID = '219c2724-033c-4f98-bc2a-3ffe12c5a618';
const APRENDIZ_UID = 'c877ae1f-f2be-4697-a227-62778565305e';
const REFERENTE_UID = '893b28a1-331c-432a-bb45-e45700ba3d95';

const COURSE_ID = '2c8e263a-e835-4ec8-828c-9b57ce5c7156';
const UNIT_ID = '809b8e44-d6b1-4478-80b5-af4dbf53dd91';
const LESSON_ID = '30b3b16c-3b59-4eae-b8cf-c15194a2afdc';

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

const REFERENTE_EMAIL = process.env.TEST_REFERENTE_EMAIL;
const REFERENTE_PASSWORD = process.env.TEST_REFERENTE_PASSWORD;

let failures = 0;
let executed = 0;
let createdOrgId = null;

async function login(email, password) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function test(name, fn, { critical = true } = {}) {
  executed += 1;
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

function isIntegrityViolation(error) {
  return /quiz_answers org\/local\/course\/user must match attempt/i.test(
    error?.message ?? '',
  );
}

async function findScoringQuiz(client) {
  const { data: localCourses, error: localCoursesError } = await client
    .from('local_courses')
    .select('course_id')
    .eq('local_id', LOCAL_A);

  if (localCoursesError) throw localCoursesError;
  const courseIds = (localCourses ?? []).map((row) => row.course_id);
  if (courseIds.length === 0) return null;

  const { data: quizzes, error: quizzesError } = await client
    .from('quizzes')
    .select('id, course_id')
    .in('course_id', courseIds);

  if (quizzesError) throw quizzesError;
  const quizIds = (quizzes ?? []).map((row) => row.id);
  if (quizIds.length === 0) return null;

  for (const quizId of quizIds) {
    const { data: questions, error: questionsError } = await client
      .from('quiz_questions')
      .select('id, position')
      .eq('quiz_id', quizId)
      .order('position', { ascending: true });

    if (questionsError) throw questionsError;
    if (!questions || questions.length === 0) continue;

    const questionIds = questions.map((q) => q.id);
    const { data: options, error: optionsError } = await client
      .from('quiz_options')
      .select('id, question_id, is_correct')
      .in('question_id', questionIds);

    if (optionsError) throw optionsError;
    if (!options || options.length === 0) continue;

    const optionsByQuestion = new Map();
    options.forEach((option) => {
      if (!optionsByQuestion.has(option.question_id)) {
        optionsByQuestion.set(option.question_id, []);
      }
      optionsByQuestion.get(option.question_id).push(option);
    });

    const hasAllCorrect = questions.every((q) =>
      (optionsByQuestion.get(q.id) ?? []).some((opt) => opt.is_correct),
    );
    const hasAllWrong = questions.every((q) =>
      (optionsByQuestion.get(q.id) ?? []).some((opt) => !opt.is_correct),
    );

    if (!hasAllCorrect || !hasAllWrong) continue;

    return {
      quizId,
      questions,
      optionsByQuestion,
    };
  }

  return null;
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
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let quizAttemptId = null;
  let quizIdForRpc = null;
  let orgQuizId = null;
  let unassignedCourseId = null;
  let unassignedLessonId = null;
  let unassignedQuizId = null;

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
  await test('Aprendiz ve columnas quiz ids en course outline', async () => {
    const { data: locals, error: localsError } = await aprendiz
      .from('v_my_locals')
      .select('local_id')
      .limit(1);

    if (localsError) throw localsError;
    const localId = locals?.[0]?.local_id ?? LOCAL_A;

    const { data: courses, error: coursesError } = await aprendiz
      .from('v_learner_dashboard_courses')
      .select('course_id')
      .eq('local_id', localId)
      .limit(1);

    if (coursesError) throw coursesError;
    const courseId = courses?.[0]?.course_id ?? COURSE_ID;

    const { data, error } = await aprendiz
      .from('v_course_outline')
      .select('unit_id, unit_quiz_id, course_quiz_id')
      .eq('local_id', localId)
      .eq('course_id', courseId);

    if (error) throw error;
    if ((data ?? []).length === 0)
      throw new Error('No hay filas en course outline');

    const rows = data ?? [];
    const hasUnitQuiz = rows.some((row) => row.unit_quiz_id);
    const hasCourseQuiz = rows.some((row) => row.course_quiz_id);
    if (!hasUnitQuiz && !hasCourseQuiz) {
      console.log('ℹ️  Course outline sin quiz ids (no quiz seeded)');
      return;
    }

    const unitQuizByUnit = new Map();
    rows.forEach((row) => {
      if (!row.unit_quiz_id) return;
      const current = unitQuizByUnit.get(row.unit_id);
      if (current && current !== row.unit_quiz_id) {
        throw new Error('unit_quiz_id inconsistente dentro de la unidad');
      }
      unitQuizByUnit.set(row.unit_id, row.unit_quiz_id);
    });

    const courseQuizIds = Array.from(
      new Set(rows.map((row) => row.course_quiz_id).filter(Boolean)),
    );
    if (courseQuizIds.length > 1) {
      throw new Error('course_quiz_id inconsistente para el curso');
    }
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
  await test('RPC: rpc_mark_lesson_completed (aprendiz happy path + idempotencia)', async () => {
    const { data: locals, error: localsError } = await aprendiz
      .from('v_my_locals')
      .select('local_id');

    if (localsError) throw localsError;
    const localId = locals?.[0]?.local_id;
    if (!localId) throw new Error('No hay local para aprendiz');

    const { data: outline, error: outlineError } = await aprendiz
      .from('v_course_outline')
      .select('lesson_id')
      .eq('local_id', localId)
      .limit(1);

    if (outlineError) throw outlineError;
    const lessonId = outline?.[0]?.lesson_id;
    if (!lessonId) throw new Error('No hay lesson_id accesible');

    const payload = { p_local_id: localId, p_lesson_id: lessonId };
    const { error: rpcError1 } = await aprendiz.rpc(
      'rpc_mark_lesson_completed',
      payload,
    );
    if (rpcError1) throw rpcError1;
    const { error: rpcError2 } = await aprendiz.rpc(
      'rpc_mark_lesson_completed',
      payload,
    );
    if (rpcError2) throw rpcError2;

    const { data: lesson, error: lessonError } = await aprendiz
      .from('v_lesson_player')
      .select('is_completed')
      .eq('local_id', localId)
      .eq('lesson_id', lessonId)
      .single();

    if (lessonError) throw lessonError;
    if (!lesson?.is_completed)
      throw new Error('RPC no marco completada la leccion');
  });
  await test('RPC: rpc_mark_lesson_completed (deny local ajeno)', async () => {
    const { data: outline, error: outlineError } = await aprendiz
      .from('v_course_outline')
      .select('lesson_id')
      .eq('local_id', LOCAL_A)
      .limit(1);

    if (outlineError) throw outlineError;
    const lessonId = outline?.[0]?.lesson_id;
    if (!lessonId) throw new Error('No hay lesson_id accesible');

    const { error: rpcError } = await aprendiz.rpc(
      'rpc_mark_lesson_completed',
      {
        p_local_id: LOCAL_B,
        p_lesson_id: lessonId,
      },
    );

    if (!rpcError) throw new Error('RPC permitido en local ajeno (NO debería)');
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

    const { error: startError } = await aprendiz.rpc('rpc_quiz_start', {
      p_local_id: LOCAL_A,
      p_quiz_id: quizId,
    });

    if (startError) throw startError;

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
  await test('RPC: quiz start (idempotente) (si aplica)', async () => {
    const quizId = await getQuizId(aprendiz);
    if (!quizId) {
      return;
    }

    quizIdForRpc = quizId;

    const { data, error } = await aprendiz.rpc('rpc_quiz_start', {
      p_local_id: LOCAL_A,
      p_quiz_id: quizId,
    });

    if (error) throw error;
    quizAttemptId = data;
    if (!quizAttemptId)
      throw new Error('rpc_quiz_start no devolvio attempt_id');

    const { data: data2, error: error2 } = await aprendiz.rpc(
      'rpc_quiz_start',
      {
        p_local_id: LOCAL_A,
        p_quiz_id: quizId,
      },
    );

    if (error2) throw error2;
    if (data2 !== quizAttemptId) {
      throw new Error('rpc_quiz_start no es idempotente');
    }
  });
  await test('RPC: quiz answer (si aplica)', async () => {
    if (!quizIdForRpc || !quizAttemptId) {
      return;
    }

    const { data: state, error: stateError } = await aprendiz
      .from('v_quiz_state')
      .select('questions')
      .eq('local_id', LOCAL_A)
      .eq('quiz_id', quizIdForRpc)
      .single();

    if (stateError) throw stateError;
    const firstQuestion = state?.questions?.[0];
    const firstOption = firstQuestion?.options?.[0];
    if (!firstQuestion || !firstOption) {
      return;
    }

    const { error: answerError } = await aprendiz.rpc('rpc_quiz_answer', {
      p_attempt_id: quizAttemptId,
      p_question_id: firstQuestion.question_id,
      p_option_id: firstOption.option_id,
      p_answer_text: null,
    });

    if (answerError) throw answerError;

    const { data: stateAfter, error: stateAfterError } = await aprendiz
      .from('v_quiz_state')
      .select('answered_count, questions')
      .eq('local_id', LOCAL_A)
      .eq('quiz_id', quizIdForRpc)
      .single();

    if (stateAfterError) throw stateAfterError;
    if (stateAfter.answered_count < 1) {
      throw new Error('answered_count no incremento luego de rpc_quiz_answer');
    }
  });
  await test('RPC: quiz submit (idempotente) (si aplica)', async () => {
    if (!quizAttemptId || !quizIdForRpc) {
      return;
    }

    const { data, error } = await aprendiz.rpc('rpc_quiz_submit', {
      p_attempt_id: quizAttemptId,
    });

    if (error) throw error;
    if (data?.score == null || data?.passed == null) {
      throw new Error('rpc_quiz_submit no devolvio score/passed');
    }

    const { data: data2, error: error2 } = await aprendiz.rpc(
      'rpc_quiz_submit',
      {
        p_attempt_id: quizAttemptId,
      },
    );

    if (error2) throw error2;
    if (data2?.score !== data.score || data2?.passed !== data.passed) {
      throw new Error('rpc_quiz_submit no es idempotente');
    }

    const { data: state, error: stateError } = await aprendiz
      .from('v_quiz_state')
      .select('attempt_status')
      .eq('local_id', LOCAL_A)
      .eq('quiz_id', quizIdForRpc)
      .single();

    if (stateError) throw stateError;
    if (state.attempt_status !== 'submitted') {
      throw new Error(`Estado esperado submitted, got ${state.attempt_status}`);
    }
  });
  await test(
    'RPC: quiz scoring (correct vs incorrect)',
    async () => {
      const scoringQuiz = await findScoringQuiz(aprendiz);
      if (!scoringQuiz) {
        console.log('ℹ️  Skip: no quiz con opciones correctas/incorrectas');
        return;
      }

      const { quizId, questions, optionsByQuestion } = scoringQuiz;

      const { data: attemptId, error: startError } = await aprendiz.rpc(
        'rpc_quiz_start',
        {
          p_local_id: LOCAL_A,
          p_quiz_id: quizId,
        },
      );
      if (startError) throw startError;
      if (!attemptId) throw new Error('No se creo attempt para scoring');

      for (const question of questions) {
        const options = optionsByQuestion.get(question.id) ?? [];
        const correct = options.find((opt) => opt.is_correct);
        if (!correct) throw new Error('No hay opcion correcta');
        const { error } = await aprendiz.rpc('rpc_quiz_answer', {
          p_attempt_id: attemptId,
          p_question_id: question.id,
          p_option_id: correct.id,
          p_answer_text: null,
        });
        if (error) throw error;
      }

      const { data: submitData, error: submitError } = await aprendiz.rpc(
        'rpc_quiz_submit',
        {
          p_attempt_id: attemptId,
        },
      );
      if (submitError) throw submitError;
      if (submitData?.score !== 100) {
        throw new Error(`Score esperado 100, got ${submitData?.score}`);
      }
      if (submitData?.passed !== true) {
        throw new Error('Passed esperado true');
      }

      const { data: attemptId2, error: startError2 } = await aprendiz.rpc(
        'rpc_quiz_start',
        {
          p_local_id: LOCAL_A,
          p_quiz_id: quizId,
        },
      );
      if (startError2) throw startError2;
      if (!attemptId2) throw new Error('No se creo attempt incorrecto');

      for (const question of questions) {
        const options = optionsByQuestion.get(question.id) ?? [];
        const wrong = options.find((opt) => !opt.is_correct);
        if (!wrong) throw new Error('No hay opcion incorrecta');
        const { error } = await aprendiz.rpc('rpc_quiz_answer', {
          p_attempt_id: attemptId2,
          p_question_id: question.id,
          p_option_id: wrong.id,
          p_answer_text: null,
        });
        if (error) throw error;
      }

      const { data: submitData2, error: submitError2 } = await aprendiz.rpc(
        'rpc_quiz_submit',
        {
          p_attempt_id: attemptId2,
        },
      );
      if (submitError2) throw submitError2;
      if (submitData2?.passed !== false) {
        throw new Error('Passed esperado false con respuestas incorrectas');
      }
    },
    { critical: false },
  );
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
    if (!isRlsViolation(error) && !isIntegrityViolation(error)) {
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
  await test('RPC: rpc_mark_lesson_completed (deny otro usuario)', async () => {
    const { data: outline, error: outlineError } = await aprendiz
      .from('v_course_outline')
      .select('lesson_id')
      .eq('local_id', LOCAL_A)
      .limit(1);

    if (outlineError) throw outlineError;
    const lessonId = outline?.[0]?.lesson_id;
    if (!lessonId) throw new Error('No hay lesson_id accesible');

    const { error: rpcError } = await referente.rpc(
      'rpc_mark_lesson_completed',
      {
        p_local_id: LOCAL_A,
        p_lesson_id: lessonId,
      },
    );

    if (!rpcError) throw new Error('RPC permitido a referente (NO debería)');
  });
  await test('RPC: quiz answer deny otro usuario (si aplica)', async () => {
    if (!quizAttemptId || !quizIdForRpc) {
      return;
    }

    const { data: state, error: stateError } = await aprendiz
      .from('v_quiz_state')
      .select('questions')
      .eq('local_id', LOCAL_A)
      .eq('quiz_id', quizIdForRpc)
      .single();

    if (stateError) throw stateError;
    const firstQuestion = state?.questions?.[0];
    const firstOption = firstQuestion?.options?.[0];
    if (!firstQuestion || !firstOption) {
      return;
    }

    const { error } = await referente.rpc('rpc_quiz_answer', {
      p_attempt_id: quizAttemptId,
      p_question_id: firstQuestion.question_id,
      p_option_id: firstOption.option_id,
      p_answer_text: null,
    });

    if (!error) throw new Error('rpc_quiz_answer permitido a referente');
  });
  await test('RPC: quiz submit deny otro usuario (si aplica)', async () => {
    if (!quizAttemptId) {
      return;
    }

    const { error } = await referente.rpc('rpc_quiz_submit', {
      p_attempt_id: quizAttemptId,
    });

    if (!error) throw new Error('rpc_quiz_submit permitido a referente');
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
    if (!isRlsViolation(error) && !isIntegrityViolation(error)) {
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
  await test('Referente ve ref dashboard en su local', async () => {
    const { data: locals, error: localsError } = await referente
      .from('v_my_locals')
      .select('local_id')
      .limit(1);

    if (localsError) throw localsError;
    const localId = locals?.[0]?.local_id ?? LOCAL_A;

    const { data, error } = await referente
      .from('v_ref_dashboard')
      .select(
        'local_id,local_name,health_percent,learners_count,active_courses_count',
      )
      .eq('local_id', localId)
      .single();

    if (error) throw error;
    if (!data?.local_id) throw new Error('Ref dashboard sin local_id');
    if (data.health_percent == null) {
      throw new Error('Ref dashboard sin health_percent');
    }
  });
  await test('Referente ve ref learners en su local', async () => {
    const { data: locals, error: localsError } = await referente
      .from('v_my_locals')
      .select('local_id')
      .limit(1);

    if (localsError) throw localsError;
    const localId = locals?.[0]?.local_id ?? LOCAL_A;

    const { data, error } = await referente
      .from('v_ref_learners')
      .select(
        'learner_id,learner_name,learner_state,risk_level,recent_flag,completion_percent',
      )
      .eq('local_id', localId)
      .limit(1);

    if (error) throw error;
    if ((data ?? []).length === 0) {
      console.log('ℹ️  Ref learners sin rows (no learners seeded)');
      return;
    }
    const row = data[0];
    if (!row.learner_id || !row.learner_name) {
      throw new Error('Ref learners sin learner_id o learner_name');
    }
    if (row.learner_state == null || row.risk_level == null) {
      throw new Error('Ref learners sin estado o riesgo');
    }
  });
  await test('Referente ve ref learner detail en su local', async () => {
    const { data: locals, error: localsError } = await referente
      .from('v_my_locals')
      .select('local_id')
      .limit(1);

    if (localsError) throw localsError;
    const localId = locals?.[0]?.local_id ?? LOCAL_A;

    const { data: learners, error: learnersError } = await referente
      .from('v_ref_learners')
      .select('learner_id')
      .eq('local_id', localId)
      .limit(1);

    if (learnersError) throw learnersError;
    const learnerId = learners?.[0]?.learner_id;
    if (!learnerId) {
      console.log('ℹ️  Ref learner detail sin learners (no data)');
      return;
    }

    const { data, error } = await referente
      .from('v_ref_learner_detail')
      .select('learner_id,courses,recent_activity,quizzes')
      .eq('local_id', localId)
      .eq('learner_id', learnerId)
      .single();

    if (error) throw error;
    if (!data?.learner_id) throw new Error('Ref learner detail sin learner_id');
    if (!Array.isArray(data.courses)) {
      throw new Error('Ref learner detail courses no es array');
    }
    if (!Array.isArray(data.recent_activity)) {
      throw new Error('Ref learner detail recent_activity no es array');
    }
    if (!Array.isArray(data.quizzes)) {
      throw new Error('Ref learner detail quizzes no es array');
    }
  });
  await test('Referente NO ve ref learner detail de otro local', async () => {
    const { data, error } = await referente
      .from('v_ref_learner_detail')
      .select('learner_id')
      .eq('local_id', LOCAL_B)
      .eq('learner_id', APRENDIZ_UID);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error(
        'Referente ve ref learner detail de Local B (NO debería)',
      );
    }
  });
  await test('Aprendiz NO ve ref learner detail (local propio)', async () => {
    const { data, error } = await aprendiz
      .from('v_ref_learner_detail')
      .select('learner_id')
      .eq('local_id', LOCAL_A)
      .eq('learner_id', APRENDIZ_UID);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve ref learner detail (NO debería)');
    }
  });
  await test('Referente NO ve ref learners de otro local', async () => {
    const { data, error } = await referente
      .from('v_ref_learners')
      .select('learner_id')
      .eq('local_id', LOCAL_B);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve ref learners de Local B (NO debería)');
    }
  });
  await test('Aprendiz NO ve ref learners (local propio)', async () => {
    const { data, error } = await aprendiz
      .from('v_ref_learners')
      .select('learner_id')
      .eq('local_id', LOCAL_A);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve ref learners (NO debería)');
    }
  });
  await test('Referente NO ve ref dashboard de otro local', async () => {
    const { data, error } = await referente
      .from('v_ref_dashboard')
      .select('local_id')
      .eq('local_id', LOCAL_B);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve ref dashboard de Local B (NO debería)');
    }
  });
  await test('Aprendiz NO ve ref dashboard (local propio)', async () => {
    const { data, error } = await aprendiz
      .from('v_ref_dashboard')
      .select('local_id')
      .eq('local_id', LOCAL_A);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve ref dashboard (NO debería)');
    }
  });
  await test('Referente NO ve org dashboard', async () => {
    const { data, error } = await referente
      .from('v_org_dashboard')
      .select('org_id')
      .eq('org_id', ORG_ID);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve org dashboard (NO debería)');
    }
  });
  await test('Referente NO ve org local detail', async () => {
    const { data, error } = await referente
      .from('v_org_local_detail')
      .select('local_id')
      .eq('local_id', LOCAL_A);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve org local detail (NO debería)');
    }
  });
  await test('Referente NO ve org learner detail', async () => {
    const { data, error } = await referente
      .from('v_org_learner_detail')
      .select('learner_id')
      .eq('learner_id', APRENDIZ_UID);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve org learner detail (NO debería)');
    }
  });
  await test('Referente NO ve org alerts', async () => {
    const { data, error } = await referente
      .from('v_org_alerts')
      .select('learner_id')
      .limit(1);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve org alerts (NO debería)');
    }
  });
  await test('Referente NO ve org courses', async () => {
    const { data, error } = await referente
      .from('v_org_courses')
      .select('course_id')
      .limit(1);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve org courses (NO debería)');
    }
  });
  await test('Referente NO puede setear cursos de local (RPC)', async () => {
    const { error } = await referente.rpc('rpc_set_local_courses', {
      p_local_id: LOCAL_A,
      p_course_ids: [COURSE_ID],
    });

    if (!error) {
      throw new Error('Referente pudo setear cursos (NO debería)');
    }
  });
  await test('Referente NO ve org local courses', async () => {
    const { data, error } = await referente
      .from('v_org_local_courses')
      .select('course_id')
      .eq('local_id', LOCAL_A);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve org local courses (NO debería)');
    }
  });
  await test('Referente NO ve org course outline', async () => {
    const { data, error } = await referente
      .from('v_org_course_outline')
      .select('course_id')
      .eq('course_id', COURSE_ID);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve org course outline (NO debería)');
    }
  });
  await test('Referente NO ve org quiz detail', async () => {
    const quizId = orgQuizId ?? '00000000-0000-0000-0000-000000000000';
    const { data, error } = await referente
      .from('v_org_quiz_detail')
      .select('quiz_id')
      .eq('quiz_id', quizId);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve org quiz detail (NO debería)');
    }
  });
  await test('Referente NO ve superadmin orgs', async () => {
    const { data, error } = await referente
      .from('v_superadmin_organizations')
      .select('org_id')
      .limit(1);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve superadmin orgs (NO debería)');
    }
  });
  await test('Referente NO ve superadmin org detail', async () => {
    const { data, error } = await referente
      .from('v_superadmin_organization_detail')
      .select('org_id')
      .eq('org_id', ORG_ID);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve superadmin org detail (NO debería)');
    }
  });
  await test('Referente NO puede crear organizacion (RPC)', async () => {
    const { error } = await referente.rpc('rpc_create_organization', {
      p_name: `Ref Org ${Date.now()}`,
      p_description: null,
    });

    if (!error) {
      throw new Error('Referente pudo crear organizacion (NO debería)');
    }
  });
  await test('Referente NO puede editar quiz (RPC)', async () => {
    if (!orgQuizId) {
      console.log('ℹ️  Referente quiz RPC sin quiz_id (no data)');
      return;
    }
    const { error } = await referente.rpc('rpc_update_quiz_metadata', {
      p_quiz_id: orgQuizId,
      p_title: 'Referente update',
      p_description: null,
      p_pass_score_pct: null,
      p_shuffle_questions: null,
      p_show_correct_answers: null,
    });

    if (!error) {
      throw new Error('Referente pudo editar quiz (NO debería)');
    }
  });
  await test('Referente NO puede crear quiz (RPC)', async () => {
    const { error } = await referente.rpc('rpc_create_final_quiz', {
      p_course_id: COURSE_ID,
    });

    if (!error) {
      throw new Error('Referente pudo crear quiz (NO debería)');
    }
  });
  await test('Referente NO ve org lesson detail', async () => {
    const { data, error } = await referente
      .from('v_org_lesson_detail')
      .select('lesson_id')
      .eq('lesson_id', LESSON_ID);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Referente ve org lesson detail (NO debería)');
    }
  });
  await test('Aprendiz NO ve org dashboard', async () => {
    const { data, error } = await aprendiz
      .from('v_org_dashboard')
      .select('org_id')
      .eq('org_id', ORG_ID);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve org dashboard (NO debería)');
    }
  });
  await test('Aprendiz NO ve org learner detail', async () => {
    const { data, error } = await aprendiz
      .from('v_org_learner_detail')
      .select('learner_id')
      .eq('learner_id', APRENDIZ_UID);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve org learner detail (NO debería)');
    }
  });
  await test('Aprendiz NO ve org alerts', async () => {
    const { data, error } = await aprendiz
      .from('v_org_alerts')
      .select('learner_id')
      .limit(1);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve org alerts (NO debería)');
    }
  });
  await test('Aprendiz NO ve org courses', async () => {
    const { data, error } = await aprendiz
      .from('v_org_courses')
      .select('course_id')
      .limit(1);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve org courses (NO debería)');
    }
  });
  await test('Aprendiz NO puede setear cursos de local (RPC)', async () => {
    const { error } = await aprendiz.rpc('rpc_set_local_courses', {
      p_local_id: LOCAL_A,
      p_course_ids: [COURSE_ID],
    });

    if (!error) {
      throw new Error('Aprendiz pudo setear cursos (NO debería)');
    }
  });
  await test('Aprendiz NO ve org local courses', async () => {
    const { data, error } = await aprendiz
      .from('v_org_local_courses')
      .select('course_id')
      .eq('local_id', LOCAL_A);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve org local courses (NO debería)');
    }
  });
  await test('Aprendiz NO ve org course outline', async () => {
    const { data, error } = await aprendiz
      .from('v_org_course_outline')
      .select('course_id')
      .eq('course_id', COURSE_ID);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve org course outline (NO debería)');
    }
  });
  await test('Aprendiz NO ve org quiz detail', async () => {
    const quizId = orgQuizId ?? '00000000-0000-0000-0000-000000000000';
    const { data, error } = await aprendiz
      .from('v_org_quiz_detail')
      .select('quiz_id')
      .eq('quiz_id', quizId);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve org quiz detail (NO debería)');
    }
  });
  await test('Aprendiz NO ve superadmin orgs', async () => {
    const { data, error } = await aprendiz
      .from('v_superadmin_organizations')
      .select('org_id')
      .limit(1);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve superadmin orgs (NO debería)');
    }
  });
  await test('Aprendiz NO ve superadmin org detail', async () => {
    const { data, error } = await aprendiz
      .from('v_superadmin_organization_detail')
      .select('org_id')
      .eq('org_id', ORG_ID);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve superadmin org detail (NO debería)');
    }
  });
  await test('Aprendiz NO puede crear organizacion (RPC)', async () => {
    const { error } = await aprendiz.rpc('rpc_create_organization', {
      p_name: `Apr Org ${Date.now()}`,
      p_description: null,
    });

    if (!error) {
      throw new Error('Aprendiz pudo crear organizacion (NO debería)');
    }
  });
  await test('Aprendiz NO puede editar quiz (RPC)', async () => {
    if (!orgQuizId) {
      console.log('ℹ️  Aprendiz quiz RPC sin quiz_id (no data)');
      return;
    }
    const { error } = await aprendiz.rpc('rpc_update_quiz_metadata', {
      p_quiz_id: orgQuizId,
      p_title: 'Aprendiz update',
      p_description: null,
      p_pass_score_pct: null,
      p_shuffle_questions: null,
      p_show_correct_answers: null,
    });

    if (!error) {
      throw new Error('Aprendiz pudo editar quiz (NO debería)');
    }
  });
  await test('Aprendiz NO puede crear quiz (RPC)', async () => {
    const { error } = await aprendiz.rpc('rpc_create_final_quiz', {
      p_course_id: COURSE_ID,
    });

    if (!error) {
      throw new Error('Aprendiz pudo crear quiz (NO debería)');
    }
  });
  await test('Aprendiz NO ve org lesson detail', async () => {
    const { data, error } = await aprendiz
      .from('v_org_lesson_detail')
      .select('lesson_id')
      .eq('lesson_id', LESSON_ID);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve org lesson detail (NO debería)');
    }
  });
  await test('Aprendiz NO ve org local detail', async () => {
    const { data, error } = await aprendiz
      .from('v_org_local_detail')
      .select('local_id')
      .eq('local_id', LOCAL_A);

    if (error) {
      return;
    }
    if ((data ?? []).length > 0) {
      throw new Error('Aprendiz ve org local detail (NO debería)');
    }
  });
  await test('Anon NO ve org quiz detail', async () => {
    const quizId = orgQuizId ?? '00000000-0000-0000-0000-000000000000';
    const { data, error } = await anon
      .from('v_org_quiz_detail')
      .select('quiz_id')
      .eq('quiz_id', quizId);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Anon ve org quiz detail (NO debería)');
    }
  });
  await test('Anon NO ve superadmin orgs', async () => {
    const { data, error } = await anon
      .from('v_superadmin_organizations')
      .select('org_id')
      .limit(1);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Anon ve superadmin orgs (NO debería)');
    }
  });
  await test('Anon NO ve superadmin org detail', async () => {
    const { data, error } = await anon
      .from('v_superadmin_organization_detail')
      .select('org_id')
      .eq('org_id', ORG_ID);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Anon ve superadmin org detail (NO debería)');
    }
  });
  await test('Anon NO puede crear organizacion (RPC)', async () => {
    const { error } = await anon.rpc('rpc_create_organization', {
      p_name: `Anon Org ${Date.now()}`,
      p_description: null,
    });

    if (!error) {
      throw new Error('Anon pudo crear organizacion (NO debería)');
    }
  });
  await test('Anon NO puede editar quiz (RPC)', async () => {
    const quizId = orgQuizId ?? '00000000-0000-0000-0000-000000000000';
    const { error } = await anon.rpc('rpc_update_quiz_metadata', {
      p_quiz_id: quizId,
      p_title: 'Anon update',
      p_description: null,
      p_pass_score_pct: null,
      p_shuffle_questions: null,
      p_show_correct_answers: null,
    });

    if (!error) {
      throw new Error('Anon pudo editar quiz (NO debería)');
    }
  });
  await test('Anon NO puede crear quiz (RPC)', async () => {
    const { error } = await anon.rpc('rpc_create_final_quiz', {
      p_course_id: COURSE_ID,
    });

    if (!error) {
      throw new Error('Anon pudo crear quiz (NO debería)');
    }
  });
  await test('Anon NO puede setear cursos de local (RPC)', async () => {
    const { error } = await anon.rpc('rpc_set_local_courses', {
      p_local_id: LOCAL_A,
      p_course_ids: [COURSE_ID],
    });

    if (!error) {
      throw new Error('Anon pudo setear cursos (NO debería)');
    }
  });
  await test('Anon NO ve org local courses', async () => {
    const { data, error } = await anon
      .from('v_org_local_courses')
      .select('course_id')
      .eq('local_id', LOCAL_A);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Anon ve org local courses (NO debería)');
    }
  });
  await test('RPC: quiz start deny local ajeno (si aplica)', async () => {
    if (!quizIdForRpc) {
      return;
    }

    const { error } = await aprendiz.rpc('rpc_quiz_start', {
      p_local_id: LOCAL_B,
      p_quiz_id: quizIdForRpc,
    });

    if (!error) throw new Error('rpc_quiz_start permitido en local ajeno');
  });

  const orgAdmin = await login(
    process.env.TEST_ORGADMIN_EMAIL,
    process.env.TEST_ORGADMIN_PASSWORD,
  );
  await test('Org admin detecta curso no asignado (setup)', async () => {
    const { data, error } = await orgAdmin
      .from('v_org_local_courses')
      .select('course_id, is_assigned')
      .eq('local_id', LOCAL_A)
      .eq('is_assigned', false)
      .limit(1);

    if (error) throw error;
    unassignedCourseId = data?.[0]?.course_id ?? null;
    if (!unassignedCourseId) {
      console.log('ℹ️  No hay curso no asignado en Local A (skip)');
      return;
    }

    const { data: units, error: unitError } = await orgAdmin
      .from('course_units')
      .select('id')
      .eq('course_id', unassignedCourseId);

    if (unitError) throw unitError;
    const unitIds = (units ?? []).map((row) => row.id);
    if (unitIds.length > 0) {
      const { data: lessons, error: lessonError } = await orgAdmin
        .from('lessons')
        .select('id')
        .in('unit_id', unitIds)
        .limit(1);

      if (lessonError) throw lessonError;
      unassignedLessonId = lessons?.[0]?.id ?? null;
    }

    const { data: quizzes, error: quizError } = await orgAdmin
      .from('quizzes')
      .select('id')
      .eq('course_id', unassignedCourseId)
      .limit(1);

    if (quizError) throw quizError;
    unassignedQuizId = quizzes?.[0]?.id ?? null;
  });
  await test('Aprendiz NO ve curso no asignado en dashboard (si aplica)', async () => {
    if (!unassignedCourseId) return;

    const { data, error } = await aprendiz
      .from('v_learner_dashboard_courses')
      .select('course_id')
      .eq('local_id', LOCAL_A)
      .eq('course_id', unassignedCourseId);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Ve curso no asignado en dashboard');
    }
  });
  await test('Aprendiz NO ve outline de curso no asignado (si aplica)', async () => {
    if (!unassignedCourseId) return;

    const { data, error } = await aprendiz
      .from('v_course_outline')
      .select('course_id')
      .eq('local_id', LOCAL_A)
      .eq('course_id', unassignedCourseId);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Ve outline de curso no asignado');
    }
  });
  await test('Aprendiz NO ve lesson player de curso no asignado (si aplica)', async () => {
    if (!unassignedLessonId) return;

    const { data, error } = await aprendiz
      .from('v_lesson_player')
      .select('lesson_id')
      .eq('local_id', LOCAL_A)
      .eq('lesson_id', unassignedLessonId);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Ve lesson player de curso no asignado');
    }
  });
  await test('Aprendiz NO ve quiz state de curso no asignado (si aplica)', async () => {
    if (!unassignedQuizId) return;

    const { data, error } = await aprendiz
      .from('v_quiz_state')
      .select('quiz_id')
      .eq('local_id', LOCAL_A)
      .eq('quiz_id', unassignedQuizId);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Ve quiz state de curso no asignado');
    }
  });
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
  await test('Org admin ve org dashboard con locals', async () => {
    const { data, error } = await orgAdmin
      .from('v_org_dashboard')
      .select('org_id, locals')
      .eq('org_id', ORG_ID)
      .maybeSingle();

    if (error) throw error;
    if (!data?.org_id) throw new Error('Org admin sin org_dashboard');
    if (!Array.isArray(data.locals)) {
      throw new Error('org_dashboard locals no es array');
    }
    if (data.locals[0]) {
      const hasKeys =
        data.locals[0].local_id &&
        data.locals[0].local_name &&
        data.locals[0].status;
      if (!hasKeys) {
        throw new Error('org_dashboard locals sin keys requeridas');
      }
    }
  });
  await test('Org admin ve org alerts (si aplica)', async () => {
    const { data, error } = await orgAdmin
      .from('v_org_alerts')
      .select(
        'org_id, learner_id, local_id, alert_type, alert_severity, alert_label, days_inactive, progress_pct, failed_quiz_count, last_activity_at',
      )
      .eq('org_id', ORG_ID);

    if (error) throw error;
    if ((data ?? []).length === 0) {
      console.log('ℹ️  Org alerts sin rows (no data)');
      return;
    }
    const row = data[0];
    if (!row?.org_id || !row?.learner_id || !row?.local_id) {
      throw new Error('org_alerts sin ids requeridos');
    }
    if (!['inactive', 'low_progress', 'quiz_failed'].includes(row.alert_type)) {
      throw new Error('org_alerts alert_type invalido');
    }
    if (!['at_risk', 'critical'].includes(row.alert_severity)) {
      throw new Error('org_alerts alert_severity invalido');
    }
    if (!row.alert_label) {
      throw new Error('org_alerts alert_label vacio');
    }
    if (row.alert_type === 'quiz_failed') {
      if ((row.failed_quiz_count ?? 0) < 3) {
        throw new Error('org_alerts quiz_failed sin conteo >= 3');
      }
    }
    if (row.alert_type === 'low_progress') {
      if (row.progress_pct == null || row.progress_pct >= 30) {
        throw new Error('org_alerts low_progress sin progress_pct < 30');
      }
    }
    if (row.alert_type === 'inactive') {
      if (!row.last_activity_at && row.days_inactive == null) {
        return;
      }
      if (row.days_inactive == null) {
        throw new Error('org_alerts inactive sin days_inactive');
      }
    }
  });
  await test('Org admin ve org courses (si aplica)', async () => {
    const { data, error } = await orgAdmin
      .from('v_org_courses')
      .select(
        'org_id, course_id, status, units_count, lessons_count, assigned_locals_count, learners_assigned_count',
      )
      .eq('org_id', ORG_ID);

    if (error) throw error;
    if ((data ?? []).length === 0) {
      console.log('ℹ️  Org courses sin rows (no data)');
      return;
    }
    const row = data[0];
    if (!row?.org_id || !row?.course_id) {
      throw new Error('org_courses sin ids requeridos');
    }
    if (!['draft', 'published', 'archived'].includes(row.status)) {
      throw new Error('org_courses status invalido');
    }
    if ((row.units_count ?? -1) < 0 || (row.lessons_count ?? -1) < 0) {
      throw new Error('org_courses counts invalidos');
    }
    if (row.assigned_locals_count !== 0 || row.learners_assigned_count !== 0) {
      throw new Error('org_courses assigned counts deben ser 0');
    }
  });
  await test('Org admin ve org local courses', async () => {
    const { data, error } = await orgAdmin
      .from('v_org_local_courses')
      .select('org_id, local_id, course_id, is_assigned, assignment_status')
      .eq('local_id', LOCAL_A);

    if (error) throw error;
    if ((data ?? []).length === 0) {
      console.log('ℹ️  Org local courses sin rows (no data)');
      return;
    }
    const row = data[0];
    if (!row?.org_id || !row?.local_id || !row?.course_id) {
      throw new Error('org_local_courses sin ids requeridos');
    }
    if (row.is_assigned && row.assignment_status !== 'active') {
      throw new Error('org_local_courses is_assigned inconsistente');
    }
  });
  await test('Org admin puede setear cursos de local (RPC)', async () => {
    const { data: catalog, error: catalogError } = await orgAdmin
      .from('v_org_local_courses')
      .select('course_id, is_assigned')
      .eq('local_id', LOCAL_A);

    if (catalogError) throw catalogError;
    if ((catalog ?? []).length === 0) {
      console.log('ℹ️  Org local courses sin catalogo (no data)');
      return;
    }

    const original = (catalog ?? [])
      .filter((row) => row.is_assigned)
      .map((row) => row.course_id);
    const desired = (catalog ?? [])
      .map((row) => row.course_id)
      .slice(0, Math.min(2, catalog.length));

    if (desired.length === 0) {
      console.log('ℹ️  Org local courses sin cursos para set');
      return;
    }

    try {
      const { error } = await orgAdmin.rpc('rpc_set_local_courses', {
        p_local_id: LOCAL_A,
        p_course_ids: desired,
      });
      if (error) throw error;

      const { error: againError } = await orgAdmin.rpc(
        'rpc_set_local_courses',
        {
          p_local_id: LOCAL_A,
          p_course_ids: desired,
        },
      );
      if (againError) throw againError;

      const { data: after, error: afterError } = await orgAdmin
        .from('v_org_local_courses')
        .select('course_id, is_assigned')
        .eq('local_id', LOCAL_A);

      if (afterError) throw afterError;
      const activeCount = (after ?? []).filter((row) => row.is_assigned).length;
      if (activeCount !== desired.length) {
        throw new Error('rpc_set_local_courses no aplico set deseado');
      }
    } finally {
      await orgAdmin.rpc('rpc_set_local_courses', {
        p_local_id: LOCAL_A,
        p_course_ids: original,
      });
    }
  });
  await test('Org admin ve org course outline', async () => {
    const { data, error } = await orgAdmin
      .from('v_org_course_outline')
      .select('course_id, course_status, units, final_quiz')
      .eq('course_id', COURSE_ID)
      .maybeSingle();

    if (error) throw error;
    if (!data?.course_id) {
      throw new Error('org_course_outline sin course_id');
    }
    if (!['draft', 'published', 'archived'].includes(data.course_status)) {
      throw new Error('org_course_outline course_status invalido');
    }
    if (!Array.isArray(data.units)) {
      throw new Error('org_course_outline units no es array');
    }
    if (data.units[0] && !Array.isArray(data.units[0].lessons)) {
      throw new Error('org_course_outline lessons no es array');
    }
    if (!orgQuizId) {
      orgQuizId =
        data.units?.[0]?.unit_quiz?.quiz_id ?? data.final_quiz?.quiz_id ?? null;
    }
  });
  await test('Org admin ve org quiz detail (si aplica)', async () => {
    if (!orgQuizId) {
      console.log('ℹ️  Org quiz detail sin quiz_id (no data)');
      return;
    }
    const { data, error } = await orgAdmin
      .from('v_org_quiz_detail')
      .select(
        'quiz_id, quiz_type, questions, pass_score_pct, shuffle_questions, show_correct_answers',
      )
      .eq('quiz_id', orgQuizId)
      .maybeSingle();

    if (error) throw error;
    if (!data?.quiz_id) {
      throw new Error('org_quiz_detail sin quiz_id');
    }
    if (!['unit', 'final'].includes(data.quiz_type)) {
      throw new Error('org_quiz_detail quiz_type invalido');
    }
    if (!Array.isArray(data.questions)) {
      throw new Error('org_quiz_detail questions no es array');
    }
    if (data.questions[0] && !Array.isArray(data.questions[0].choices)) {
      throw new Error('org_quiz_detail choices no es array');
    }
    if (data.pass_score_pct == null) {
      throw new Error('org_quiz_detail pass_score_pct null');
    }
  });
  await test('Org admin puede crear quiz unit/final (RPC)', async () => {
    const { data: unitQuizId, error: unitQuizError } = await orgAdmin.rpc(
      'rpc_create_unit_quiz',
      { p_unit_id: UNIT_ID },
    );

    if (unitQuizError) throw unitQuizError;
    if (!unitQuizId) {
      throw new Error('rpc_create_unit_quiz no retorno quiz_id');
    }

    const { data: unitQuizAgain, error: unitQuizAgainError } =
      await orgAdmin.rpc('rpc_create_unit_quiz', { p_unit_id: UNIT_ID });
    if (unitQuizAgainError) throw unitQuizAgainError;
    if (unitQuizAgain !== unitQuizId) {
      throw new Error('rpc_create_unit_quiz no es idempotente');
    }

    const { data: finalQuizId, error: finalQuizError } = await orgAdmin.rpc(
      'rpc_create_final_quiz',
      { p_course_id: COURSE_ID },
    );

    if (finalQuizError) throw finalQuizError;
    if (!finalQuizId) {
      throw new Error('rpc_create_final_quiz no retorno quiz_id');
    }

    const { data: finalQuizAgain, error: finalQuizAgainError } =
      await orgAdmin.rpc('rpc_create_final_quiz', { p_course_id: COURSE_ID });
    if (finalQuizAgainError) throw finalQuizAgainError;
    if (finalQuizAgain !== finalQuizId) {
      throw new Error('rpc_create_final_quiz no es idempotente');
    }

    const { data: quizRow, error: quizRowError } = await orgAdmin
      .from('v_org_quiz_detail')
      .select('quiz_id')
      .eq('quiz_id', unitQuizId)
      .maybeSingle();

    if (quizRowError) throw quizRowError;
    if (!quizRow?.quiz_id) {
      throw new Error('v_org_quiz_detail no devuelve quiz creado');
    }
  });
  await test('Org admin puede editar quiz (RPCs)', async () => {
    if (!orgQuizId) {
      console.log('ℹ️  Org quiz RPCs sin quiz_id (no data)');
      return;
    }

    const { data: original, error: originalError } = await orgAdmin
      .from('v_org_quiz_detail')
      .select('quiz_id, title, questions')
      .eq('quiz_id', orgQuizId)
      .maybeSingle();

    if (originalError) throw originalError;
    if (!original?.quiz_id) {
      throw new Error('org_quiz_detail sin quiz_id para RPCs');
    }

    const newTitle = 'Seed Quiz RPC';
    const { error: updateError } = await orgAdmin.rpc(
      'rpc_update_quiz_metadata',
      {
        p_quiz_id: orgQuizId,
        p_title: newTitle,
        p_description: original.description ?? null,
        p_pass_score_pct: original.pass_score_pct ?? null,
        p_shuffle_questions: original.shuffle_questions ?? null,
        p_show_correct_answers: original.show_correct_answers ?? null,
      },
    );
    if (updateError) throw updateError;

    const { data: updated, error: updatedError } = await orgAdmin
      .from('v_org_quiz_detail')
      .select('title')
      .eq('quiz_id', orgQuizId)
      .maybeSingle();

    if (updatedError) throw updatedError;
    if (updated?.title !== newTitle) {
      throw new Error('rpc_update_quiz_metadata no actualizo title');
    }

    const { data: questionId, error: createQuestionError } = await orgAdmin.rpc(
      'rpc_create_quiz_question',
      {
        p_quiz_id: orgQuizId,
        p_prompt: 'Seed question RPC',
      },
    );

    if (createQuestionError) throw createQuestionError;
    if (!questionId) {
      throw new Error('rpc_create_quiz_question no retorno id');
    }

    const { data: choiceA, error: choiceAError } = await orgAdmin.rpc(
      'rpc_create_quiz_choice',
      {
        p_question_id: questionId,
        p_text: 'Seed choice A',
        p_is_correct: false,
      },
    );
    if (choiceAError) throw choiceAError;

    const { data: choiceB, error: choiceBError } = await orgAdmin.rpc(
      'rpc_create_quiz_choice',
      {
        p_question_id: questionId,
        p_text: 'Seed choice B',
        p_is_correct: true,
      },
    );
    if (choiceBError) throw choiceBError;

    const { error: updateChoiceError } = await orgAdmin.rpc(
      'rpc_update_quiz_choice',
      {
        p_choice_id: choiceB,
        p_text: 'Seed choice B updated',
        p_is_correct: true,
      },
    );
    if (updateChoiceError) throw updateChoiceError;

    const { error: setCorrectError } = await orgAdmin.rpc(
      'rpc_set_quiz_correct_choice',
      {
        p_question_id: questionId,
        p_choice_id: choiceA,
      },
    );
    if (setCorrectError) throw setCorrectError;

    const { data: afterCorrect, error: afterCorrectError } = await orgAdmin
      .from('v_org_quiz_detail')
      .select('questions')
      .eq('quiz_id', orgQuizId)
      .maybeSingle();

    if (afterCorrectError) throw afterCorrectError;
    const questionRow =
      afterCorrect?.questions?.find(
        (question) => question.question_id === questionId,
      ) ?? null;
    const correctChoices = (questionRow?.choices ?? []).filter(
      (choice) => choice.is_correct,
    );
    if (correctChoices.length !== 1) {
      throw new Error('rpc_set_quiz_correct_choice no dejo una sola correcta');
    }

    const orderIds = (questionRow?.choices ?? []).map(
      (choice) => choice.choice_id,
    );
    if (orderIds.length >= 2) {
      const next = [...orderIds];
      [next[0], next[1]] = [next[1], next[0]];
      const { error: reorderChoicesError } = await orgAdmin.rpc(
        'rpc_reorder_quiz_choices',
        {
          p_question_id: questionId,
          p_choice_ids: next,
        },
      );
      if (reorderChoicesError) throw reorderChoicesError;
    }

    const { error: updateQuestionError } = await orgAdmin.rpc(
      'rpc_update_quiz_question',
      {
        p_question_id: questionId,
        p_prompt: 'Seed question RPC updated',
      },
    );
    if (updateQuestionError) throw updateQuestionError;

    const { data: afterUpdate, error: afterUpdateError } = await orgAdmin
      .from('v_org_quiz_detail')
      .select('questions')
      .eq('quiz_id', orgQuizId)
      .maybeSingle();

    if (afterUpdateError) throw afterUpdateError;
    const afterUpdateQuestion =
      afterUpdate?.questions?.find(
        (question) => question.question_id === questionId,
      ) ?? null;
    if (afterUpdateQuestion?.prompt !== 'Seed question RPC updated') {
      throw new Error('rpc_update_quiz_question no actualizo prompt');
    }

    const questionIds = (afterUpdate?.questions ?? []).map(
      (question) => question.question_id,
    );
    if (questionIds.length >= 2) {
      const next = [...questionIds];
      [next[0], next[1]] = [next[1], next[0]];
      const { error: reorderError } = await orgAdmin.rpc(
        'rpc_reorder_quiz_questions',
        {
          p_quiz_id: orgQuizId,
          p_question_ids: next,
        },
      );
      if (reorderError) throw reorderError;
    }

    const { error: archiveError } = await orgAdmin.rpc(
      'rpc_archive_quiz_question',
      { p_question_id: questionId },
    );
    if (archiveError) throw archiveError;

    const { data: afterArchive, error: afterArchiveError } = await orgAdmin
      .from('v_org_quiz_detail')
      .select('questions')
      .eq('quiz_id', orgQuizId)
      .maybeSingle();

    if (afterArchiveError) throw afterArchiveError;
    if (
      afterArchive?.questions?.some(
        (question) => question.question_id === questionId,
      )
    ) {
      throw new Error('rpc_archive_quiz_question no oculto pregunta');
    }
  });
  await test('Org admin ve org lesson detail', async () => {
    const { data, error } = await orgAdmin
      .from('v_org_lesson_detail')
      .select('lesson_id, lesson_type')
      .eq('lesson_id', LESSON_ID)
      .maybeSingle();

    if (error) throw error;
    if (!data?.lesson_id) {
      throw new Error('org_lesson_detail sin lesson_id');
    }
    if (
      !['text', 'html', 'richtext', 'video', 'file', 'link'].includes(
        data.lesson_type,
      )
    ) {
      throw new Error(
        `org_lesson_detail lesson_type invalido: ${data.lesson_type}`,
      );
    }
  });
  await test('Org admin puede actualizar lesson content (RPC)', async () => {
    const { data: detail, error: detailError } = await orgAdmin
      .from('v_org_lesson_detail')
      .select('lesson_id, lesson_type')
      .eq('lesson_id', LESSON_ID)
      .maybeSingle();

    if (detailError) throw detailError;
    if (!detail?.lesson_id) {
      throw new Error('org_lesson_detail sin lesson_id');
    }

    const payload = {
      p_lesson_id: LESSON_ID,
      p_title: 'Seed Lesson RPC',
      p_content_text: null,
      p_content_html: null,
      p_content_url: null,
      p_is_required: true,
      p_estimated_minutes: 10,
    };

    if (detail.lesson_type === 'text') {
      payload.p_content_text = 'Seed content text';
    } else if (
      detail.lesson_type === 'html' ||
      detail.lesson_type === 'richtext'
    ) {
      payload.p_content_html = '<p>Seed content html</p>';
    } else if (
      detail.lesson_type === 'video' ||
      detail.lesson_type === 'file' ||
      detail.lesson_type === 'link'
    ) {
      payload.p_content_url = 'https://example.com/asset';
    }

    const { error } = await orgAdmin.rpc('rpc_update_lesson_content', payload);
    if (error) throw error;

    const { data: updated, error: updatedError } = await orgAdmin
      .from('v_org_lesson_detail')
      .select('lesson_title')
      .eq('lesson_id', LESSON_ID)
      .maybeSingle();

    if (updatedError) throw updatedError;
    if (updated?.lesson_title !== payload.p_title) {
      throw new Error('rpc_update_lesson_content no actualizo title');
    }
  });
  await test('Org admin puede crear unit (RPC)', async () => {
    const unitTitle = 'Seed Unit A';
    let unitId = null;

    const { data: existing, error: existingError } = await orgAdmin
      .from('course_units')
      .select('id')
      .eq('course_id', COURSE_ID)
      .eq('title', unitTitle)
      .limit(1);

    if (existingError) throw existingError;
    if (existing?.[0]?.id) {
      unitId = existing[0].id;
    } else {
      const { data, error } = await orgAdmin.rpc('rpc_create_course_unit', {
        p_course_id: COURSE_ID,
        p_title: unitTitle,
      });

      if (error) throw error;
      unitId = data;
    }

    if (!unitId) {
      throw new Error('rpc_create_course_unit no retorno unit_id');
    }
  });
  await test('Org admin puede reordenar units (RPC)', async () => {
    const unitTitles = ['Seed Unit A', 'Seed Unit B'];
    const unitIds = [];

    for (const title of unitTitles) {
      const { data: existing, error: existingError } = await orgAdmin
        .from('course_units')
        .select('id')
        .eq('course_id', COURSE_ID)
        .eq('title', title)
        .limit(1);

      if (existingError) throw existingError;
      if (existing?.[0]?.id) {
        unitIds.push(existing[0].id);
      } else {
        const { data, error } = await orgAdmin.rpc('rpc_create_course_unit', {
          p_course_id: COURSE_ID,
          p_title: title,
        });

        if (error) throw error;
        unitIds.push(data);
      }
    }

    const { data: courseUnits, error: unitsError } = await orgAdmin
      .from('course_units')
      .select('id, position')
      .eq('course_id', COURSE_ID)
      .order('position', { ascending: true });

    if (unitsError) throw unitsError;
    const existingIds = (courseUnits ?? []).map((unit) => unit.id);
    const remaining = existingIds.filter((id) => !unitIds.includes(id));
    const newOrder = [unitIds[1], unitIds[0], ...remaining].filter(Boolean);

    const { error } = await orgAdmin.rpc('rpc_reorder_course_units', {
      p_course_id: COURSE_ID,
      p_unit_ids: newOrder,
    });

    if (error) throw error;

    const { data: reordered, error: reorderError } = await orgAdmin
      .from('course_units')
      .select('id, position')
      .eq('course_id', COURSE_ID)
      .order('position', { ascending: true });

    if (reorderError) throw reorderError;
    const orderedIds = (reordered ?? []).map((unit) => unit.id);
    if (orderedIds[0] !== unitIds[1]) {
      throw new Error('rpc_reorder_course_units no aplico orden');
    }
  });
  await test('Org admin puede crear lesson (RPC)', async () => {
    const unitTitle = 'Seed Unit A';
    const { data: unitRows, error: unitError } = await orgAdmin
      .from('course_units')
      .select('id')
      .eq('course_id', COURSE_ID)
      .eq('title', unitTitle)
      .limit(1);

    if (unitError) throw unitError;
    const unitId = unitRows?.[0]?.id;
    if (!unitId) throw new Error('Unit seed no encontrada');

    const lessonTitle = 'Seed Lesson A';
    const { data: lessonRows, error: lessonError } = await orgAdmin
      .from('lessons')
      .select('id')
      .eq('unit_id', unitId)
      .eq('title', lessonTitle)
      .limit(1);

    if (lessonError) throw lessonError;
    if (lessonRows?.[0]?.id) return;

    const { data, error } = await orgAdmin.rpc('rpc_create_unit_lesson', {
      p_unit_id: unitId,
      p_title: lessonTitle,
      p_lesson_type: 'text',
      p_is_required: true,
    });

    if (error) throw error;
    if (!data) throw new Error('rpc_create_unit_lesson no retorno lesson_id');
  });
  await test('Org admin puede reordenar lessons (RPC)', async () => {
    const unitTitle = 'Seed Unit A';
    const { data: unitRows, error: unitError } = await orgAdmin
      .from('course_units')
      .select('id')
      .eq('course_id', COURSE_ID)
      .eq('title', unitTitle)
      .limit(1);

    if (unitError) throw unitError;
    const unitId = unitRows?.[0]?.id;
    if (!unitId) throw new Error('Unit seed no encontrada');

    const lessonTitles = ['Seed Lesson A', 'Seed Lesson B'];
    const lessonIds = [];

    for (const title of lessonTitles) {
      const { data: lessonRows, error: lessonError } = await orgAdmin
        .from('lessons')
        .select('id')
        .eq('unit_id', unitId)
        .eq('title', title)
        .limit(1);

      if (lessonError) throw lessonError;
      if (lessonRows?.[0]?.id) {
        lessonIds.push(lessonRows[0].id);
        continue;
      }

      const { data, error } = await orgAdmin.rpc('rpc_create_unit_lesson', {
        p_unit_id: unitId,
        p_title: title,
        p_lesson_type: 'text',
        p_is_required: true,
      });

      if (error) throw error;
      lessonIds.push(data);
    }

    const { data: lessons, error: lessonsError } = await orgAdmin
      .from('lessons')
      .select('id, position')
      .eq('unit_id', unitId)
      .order('position', { ascending: true });

    if (lessonsError) throw lessonsError;
    const existingLessonIds = (lessons ?? []).map((lesson) => lesson.id);
    const remaining = existingLessonIds.filter((id) => !lessonIds.includes(id));
    const newOrder = [lessonIds[1], lessonIds[0], ...remaining].filter(Boolean);

    const { error } = await orgAdmin.rpc('rpc_reorder_unit_lessons', {
      p_unit_id: unitId,
      p_lesson_ids: newOrder,
    });

    if (error) throw error;

    const { data: reordered, error: reorderError } = await orgAdmin
      .from('lessons')
      .select('id, position')
      .eq('unit_id', unitId)
      .order('position', { ascending: true });

    if (reorderError) throw reorderError;
    const orderedIds = (reordered ?? []).map((lesson) => lesson.id);
    if (orderedIds[0] !== lessonIds[1]) {
      throw new Error('rpc_reorder_unit_lessons no aplico orden');
    }
  });
  await test('Org admin ve org local detail', async () => {
    const { data: dashboard, error: dashboardError } = await orgAdmin
      .from('v_org_dashboard')
      .select('locals')
      .eq('org_id', ORG_ID)
      .single();

    if (dashboardError) throw dashboardError;
    const localId = dashboard?.locals?.[0]?.local_id;
    if (!localId) {
      console.log('ℹ️  Org local detail sin locals (no data)');
      return;
    }

    const { data, error } = await orgAdmin
      .from('v_org_local_detail')
      .select('local_id, learners')
      .eq('local_id', localId)
      .single();

    if (error) throw error;
    if (!data?.local_id) throw new Error('Org local detail sin local_id');
    if (!Array.isArray(data.learners)) {
      throw new Error('Org local detail learners no es array');
    }
  });
  await test('Org admin ve org learner detail', async () => {
    const { data: localDetail, error: localDetailError } = await orgAdmin
      .from('v_org_local_detail')
      .select('learners')
      .limit(1)
      .maybeSingle();

    if (localDetailError) throw localDetailError;
    const learnerId = localDetail?.learners?.[0]?.learner_id;
    if (!learnerId) {
      console.log('ℹ️  Org learner detail sin learners (no data)');
      return;
    }

    const { data, error } = await orgAdmin
      .from('v_org_learner_detail')
      .select('learner_id, locals, courses, quizzes, recent_activity')
      .eq('learner_id', learnerId)
      .single();

    if (error) throw error;
    if (!data?.learner_id) throw new Error('Org learner detail sin learner_id');
    if (!Array.isArray(data.locals)) {
      throw new Error('Org learner detail locals no es array');
    }
    if (!Array.isArray(data.courses)) {
      throw new Error('Org learner detail courses no es array');
    }
    if (!Array.isArray(data.quizzes)) {
      throw new Error('Org learner detail quizzes no es array');
    }
    if (!Array.isArray(data.recent_activity)) {
      throw new Error('Org learner detail recent_activity no es array');
    }
  });
  await test('Org admin no ve learner de otro org', async () => {
    const otherLearner = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await orgAdmin
      .from('v_org_learner_detail')
      .select('learner_id')
      .eq('learner_id', otherLearner);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Org admin ve learner de otro org (NO debería)');
    }
  });
  await test('Org admin no ve local de otro org', async () => {
    const otherLocal = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await orgAdmin
      .from('v_org_local_detail')
      .select('local_id')
      .eq('local_id', otherLocal);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Org admin ve local de otro org (NO debería)');
    }
  });
  await test('Org admin no ve otro org', async () => {
    const otherOrg = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await orgAdmin
      .from('v_org_dashboard')
      .select('org_id')
      .eq('org_id', otherOrg);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Org admin ve otro org (NO debería)');
    }
  });
  await test('Org admin no ve alerts de otro org', async () => {
    const otherOrg = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await orgAdmin
      .from('v_org_alerts')
      .select('org_id')
      .eq('org_id', otherOrg);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Org admin ve alerts de otro org (NO debería)');
    }
  });
  await test('Org admin no ve courses de otro org', async () => {
    const otherOrg = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await orgAdmin
      .from('v_org_courses')
      .select('org_id')
      .eq('org_id', otherOrg);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Org admin ve courses de otro org (NO debería)');
    }
  });
  await test('Org admin no ve course outline de otro org', async () => {
    const otherCourse = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await orgAdmin
      .from('v_org_course_outline')
      .select('course_id')
      .eq('course_id', otherCourse);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Org admin ve course outline de otro org (NO debería)');
    }
  });
  await test('Org admin no ve local courses de otro org', async () => {
    const { data, error } = await orgAdmin
      .from('v_org_local_courses')
      .select('course_id')
      .eq('local_id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Org admin ve local courses de otro org (NO debería)');
    }
  });
  await test('Org admin no ve quiz detail de otro org', async () => {
    const otherQuiz = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await orgAdmin
      .from('v_org_quiz_detail')
      .select('quiz_id')
      .eq('quiz_id', otherQuiz);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Org admin ve quiz detail de otro org (NO debería)');
    }
  });
  await test('Org admin no puede editar quiz de otro org (RPC)', async () => {
    const { error } = await orgAdmin.rpc('rpc_update_quiz_metadata', {
      p_quiz_id: '00000000-0000-0000-0000-000000000000',
      p_title: 'Org admin update',
      p_description: null,
      p_pass_score_pct: null,
      p_shuffle_questions: null,
      p_show_correct_answers: null,
    });

    if (!error) {
      throw new Error('Org admin pudo editar quiz de otro org');
    }
  });
  await test('Org admin no puede crear quiz en curso ajeno (RPC)', async () => {
    const { error } = await orgAdmin.rpc('rpc_create_final_quiz', {
      p_course_id: '00000000-0000-0000-0000-000000000000',
    });

    if (!error) {
      throw new Error('Org admin pudo crear quiz en curso ajeno');
    }
  });
  await test('Org admin no puede setear cursos en local ajeno (RPC)', async () => {
    const { error } = await orgAdmin.rpc('rpc_set_local_courses', {
      p_local_id: '00000000-0000-0000-0000-000000000000',
      p_course_ids: [COURSE_ID],
    });

    if (!error) {
      throw new Error('Org admin pudo setear cursos en local ajeno');
    }
  });
  await test('Org admin no ve lesson detail de otro org', async () => {
    const otherLesson = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await orgAdmin
      .from('v_org_lesson_detail')
      .select('lesson_id')
      .eq('lesson_id', otherLesson);

    if (error) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Org admin ve lesson detail de otro org (NO debería)');
    }
  });
  await test('Org admin no puede crear unit en curso ajeno', async () => {
    const { error } = await orgAdmin.rpc('rpc_create_course_unit', {
      p_course_id: '00000000-0000-0000-0000-000000000000',
      p_title: 'Unit invalid',
    });

    if (!error) {
      throw new Error('Org admin pudo crear unit en curso ajeno');
    }
  });
  await test('Org admin NO ve superadmin orgs', async () => {
    const { data, error } = await orgAdmin
      .from('v_superadmin_organizations')
      .select('org_id')
      .limit(1);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Org admin ve superadmin orgs (NO debería)');
    }
  });
  await test('Org admin NO ve superadmin org detail', async () => {
    const { data, error } = await orgAdmin
      .from('v_superadmin_organization_detail')
      .select('org_id')
      .eq('org_id', ORG_ID);

    if (error && !isRlsViolation(error)) throw error;
    if ((data ?? []).length > 0) {
      throw new Error('Org admin ve superadmin org detail (NO debería)');
    }
  });
  await test('Org admin NO puede crear organizacion (RPC)', async () => {
    const { error } = await orgAdmin.rpc('rpc_create_organization', {
      p_name: `OrgAdmin Org ${Date.now()}`,
      p_description: null,
    });

    if (!error) {
      throw new Error('Org admin pudo crear organizacion (NO debería)');
    }
  });

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
  await test(
    'Superadmin ve org dashboard (si aplica)',
    async () => {
      const { data, error } = await superadmin
        .from('v_org_dashboard')
        .select('org_id')
        .limit(1);

      if (error) throw error;
      if ((data ?? []).length === 0) {
        throw new Error('Superadmin no ve org_dashboard');
      }
    },
    { critical: false },
  );
  await test(
    'Superadmin ve org local detail (si aplica)',
    async () => {
      const { data, error } = await superadmin
        .from('v_org_local_detail')
        .select('local_id')
        .limit(1);

      if (error) throw error;
      if ((data ?? []).length === 0) {
        throw new Error('Superadmin no ve org local detail');
      }
    },
    { critical: false },
  );
  await test(
    'Superadmin ve org lesson detail (si aplica)',
    async () => {
      const { data, error } = await superadmin
        .from('v_org_lesson_detail')
        .select('lesson_id')
        .eq('lesson_id', LESSON_ID)
        .maybeSingle();

      if (error) throw error;
      if (!data?.lesson_id) {
        console.log('ℹ️  Superadmin org lesson detail sin data (no row)');
      }
    },
    { critical: false },
  );
  await test(
    'Superadmin ve org quiz detail (si aplica)',
    async () => {
      if (!orgQuizId) {
        console.log('ℹ️  Superadmin org quiz detail sin quiz_id (no data)');
        return;
      }
      const { data, error } = await superadmin
        .from('v_org_quiz_detail')
        .select('quiz_id')
        .eq('quiz_id', orgQuizId)
        .maybeSingle();

      if (error) throw error;
      if (!data?.quiz_id) {
        console.log('ℹ️  Superadmin org quiz detail sin data (no row)');
      }
    },
    { critical: false },
  );
  await test(
    'Superadmin puede editar quiz (RPC) (si aplica)',
    async () => {
      if (!orgQuizId) {
        console.log('ℹ️  Superadmin quiz RPC sin quiz_id (no data)');
        return;
      }
      const { error } = await superadmin.rpc('rpc_update_quiz_metadata', {
        p_quiz_id: orgQuizId,
        p_title: 'Superadmin Quiz Update',
        p_description: null,
        p_pass_score_pct: null,
        p_shuffle_questions: null,
        p_show_correct_answers: null,
      });

      if (error) throw error;
    },
    { critical: false },
  );
  await test(
    'Superadmin puede crear quiz (RPC) (si aplica)',
    async () => {
      const { error } = await superadmin.rpc('rpc_create_final_quiz', {
        p_course_id: COURSE_ID,
      });

      if (error) throw error;
    },
    { critical: false },
  );
  await test(
    'Superadmin puede setear cursos (RPC) (si aplica)',
    async () => {
      const { error } = await superadmin.rpc('rpc_set_local_courses', {
        p_local_id: LOCAL_A,
        p_course_ids: [COURSE_ID],
      });

      if (error) throw error;
    },
    { critical: false },
  );
  await test(
    'Superadmin ve org learner detail (si aplica)',
    async () => {
      const { data, error } = await superadmin
        .from('v_org_learner_detail')
        .select('learner_id')
        .limit(1);

      if (error) throw error;
      if ((data ?? []).length === 0) {
        throw new Error('Superadmin no ve org learner detail');
      }
    },
    { critical: false },
  );
  await test(
    'Superadmin ve org alerts (si aplica)',
    async () => {
      const { data, error } = await superadmin
        .from('v_org_alerts')
        .select('org_id')
        .limit(1);

      if (error) throw error;
      if ((data ?? []).length === 0) {
        console.log('ℹ️  Superadmin org alerts sin rows (no data)');
        return;
      }
    },
    { critical: false },
  );
  await test(
    'Superadmin ve org courses (si aplica)',
    async () => {
      const { data, error } = await superadmin
        .from('v_org_courses')
        .select('org_id')
        .limit(1);

      if (error) throw error;
      if ((data ?? []).length === 0) {
        console.log('ℹ️  Superadmin org courses sin rows (no data)');
        return;
      }
    },
    { critical: false },
  );
  await test('Superadmin ve superadmin orgs', async () => {
    const { data, error } = await superadmin
      .from('v_superadmin_organizations')
      .select('org_id')
      .limit(1);

    if (error) throw error;
    if ((data ?? []).length === 0) {
      throw new Error('Superadmin no ve superadmin orgs');
    }
  });
  await test('Superadmin ve superadmin org detail', async () => {
    const { data, error } = await superadmin
      .from('v_superadmin_organization_detail')
      .select('org_id, locals, admins, courses')
      .eq('org_id', ORG_ID)
      .maybeSingle();

    if (error) throw error;
    if (!data?.org_id) {
      throw new Error('Superadmin no ve superadmin org detail');
    }
    if (!Array.isArray(data.locals)) {
      throw new Error('superadmin org detail locals no es array');
    }
    if (!Array.isArray(data.admins)) {
      throw new Error('superadmin org detail admins no es array');
    }
    if (!Array.isArray(data.courses)) {
      throw new Error('superadmin org detail courses no es array');
    }
  });
  await test('Superadmin puede crear organizacion (RPC)', async () => {
    const orgName = `Smoke Org ${Date.now()}`;
    const { data, error } = await superadmin.rpc('rpc_create_organization', {
      p_name: orgName,
      p_description: null,
    });

    if (error) throw error;
    createdOrgId = data;
    if (!createdOrgId) {
      throw new Error('rpc_create_organization sin org_id');
    }

    const { data: list, error: listError } = await superadmin
      .from('v_superadmin_organizations')
      .select('org_id')
      .eq('org_id', createdOrgId)
      .limit(1);

    if (listError) throw listError;
    if ((list ?? []).length === 0) {
      throw new Error('Org creada no aparece en v_superadmin_organizations');
    }

    const { data: detail, error: detailError } = await superadmin
      .from('v_superadmin_organization_detail')
      .select('org_id')
      .eq('org_id', createdOrgId)
      .maybeSingle();

    if (detailError) throw detailError;
    if (!detail?.org_id) {
      throw new Error(
        'Org creada no aparece en v_superadmin_organization_detail',
      );
    }
  });
  await test(
    'Superadmin ve org local courses (si aplica)',
    async () => {
      const { data, error } = await superadmin
        .from('v_org_local_courses')
        .select('local_id')
        .eq('local_id', LOCAL_A)
        .limit(1);

      if (error) throw error;
      if ((data ?? []).length === 0) {
        console.log('ℹ️  Superadmin org local courses sin rows (no data)');
      }
    },
    { critical: false },
  );
  await test(
    'Superadmin ve org course outline (si aplica)',
    async () => {
      const { data, error } = await superadmin
        .from('v_org_course_outline')
        .select('course_id')
        .eq('course_id', COURSE_ID)
        .maybeSingle();

      if (error) throw error;
      if (!data?.course_id) {
        console.log('ℹ️  Superadmin org course outline sin data (no row)');
        return;
      }
    },
    { critical: false },
  );
  await test(
    'Superadmin puede crear unit (RPC)',
    async () => {
      const { data, error } = await superadmin.rpc('rpc_create_course_unit', {
        p_course_id: COURSE_ID,
        p_title: 'Seed Unit Superadmin',
      });

      if (error) throw error;
      if (!data) {
        throw new Error('Superadmin rpc_create_course_unit sin id');
      }
    },
    { critical: false },
  );

  if (failures > 0) {
    process.exit(1);
  }
}

run()
  .then(() => {
    console.log(`\nTests executed: ${executed}`);
    console.log(`Failures: ${failures}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ FAIL: Unhandled error in smoke tests');
    console.error(err?.message ?? err);
    process.exit(1);
  });
