import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOW_PROD_SEED = process.env.ALLOW_PROD_SEED === 'true';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const isHosted = SUPABASE_URL.includes('supabase.co');
const isLocal =
  SUPABASE_URL.includes('localhost') || SUPABASE_URL.includes('127.0.0.1');

if (isHosted && !ALLOW_PROD_SEED) {
  console.error(
    'Refusing to run against hosted Supabase. Set ALLOW_PROD_SEED=true to override.',
  );
  process.exit(1);
}

if (!isHosted && !isLocal && !ALLOW_PROD_SEED) {
  console.error('Unknown Supabase URL. Set ALLOW_PROD_SEED=true to override.');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SEED_USERS = [
  {
    id: 'c1a7b42d-12ad-4c6b-8b2e-8c0c1c7d23f1',
    email: 'seed-alert-inactive@onbo.dev',
    name: 'SEED Alerts - Inactive',
  },
  {
    id: 'd6f34c34-4a50-4f6e-9a10-04b6b0f1aaf1',
    email: 'seed-alert-low-progress@onbo.dev',
    name: 'SEED Alerts - Low Progress',
  },
  {
    id: 'fb65bd9f-3f62-4f69-9d23-8d9e7e1fd9d2',
    email: 'seed-alert-quiz-failed@onbo.dev',
    name: 'SEED Alerts - Quiz Failed',
  },
];

const MS_IN_DAY = 1000 * 60 * 60 * 24;

async function findUserIdByEmail(email) {
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('user_id')
    .eq('email', email)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.user_id) return profile.user_id;

  let page = 1;
  const perPage = 200;
  while (page < 6) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const found = (data?.users ?? []).find((user) => user.email === email);
    if (found) return found.id;
    if (!data?.users || data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function ensureUser(user) {
  const existingId = await findUserIdByEmail(user.email);
  let userId = existingId;

  if (!userId) {
    const { data, error } = await client.auth.admin.createUser({
      email: user.email,
      password: 'Seed-Alerts-Temp#1',
      email_confirmed: true,
      user_metadata: { seeded: 'alert-scenarios' },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  if (!userId) {
    throw new Error(`Unable to resolve user id for ${user.email}`);
  }

  const { error: profileError } = await client.from('profiles').upsert(
    {
      user_id: userId,
      email: user.email,
      full_name: user.name,
    },
    { onConflict: 'user_id' },
  );
  if (profileError) throw profileError;

  return userId;
}

async function main() {
  console.log('Seeding alert scenarios (dev-only)...');

  const { data: org, error: orgError } = await client
    .from('organizations')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgError) throw orgError;
  if (!org) throw new Error('No organizations found.');

  const { data: local, error: localError } = await client
    .from('locals')
    .select('id, name, org_id')
    .eq('org_id', org.id)
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (localError) throw localError;
  if (!local) throw new Error('No locals found for org.');

  console.log(`Using org: ${org.name} (${org.id})`);
  console.log(`Using local: ${local.name} (${local.id})`);

  const { data: localCourses, error: lcError } = await client
    .from('local_courses')
    .select('course_id')
    .eq('local_id', local.id)
    .eq('status', 'active');

  if (lcError) throw lcError;
  const courseIds = (localCourses ?? []).map((row) => row.course_id);
  if (courseIds.length === 0) {
    throw new Error('No active local_courses found for local.');
  }

  const { data: units, error: unitsError } = await client
    .from('course_units')
    .select('id, course_id')
    .in('course_id', courseIds);

  if (unitsError) throw unitsError;
  const unitIds = (units ?? []).map((row) => row.id);
  if (unitIds.length === 0) {
    throw new Error('No course units found for local courses.');
  }

  const unitCourseMap = new Map(
    (units ?? []).map((row) => [row.id, row.course_id]),
  );

  const { data: lessons, error: lessonsError } = await client
    .from('lessons')
    .select('id, unit_id')
    .in('unit_id', unitIds);

  if (lessonsError) throw lessonsError;
  if (!lessons || lessons.length === 0) {
    throw new Error('No lessons found for local courses.');
  }

  const lessonRows = lessons.map((lesson) => ({
    lesson_id: lesson.id,
    unit_id: lesson.unit_id,
    course_id: unitCourseMap.get(lesson.unit_id),
  }));

  const firstLesson = lessonRows.find((row) => row.course_id);
  if (!firstLesson?.course_id) {
    throw new Error('Unable to resolve lesson course_id.');
  }

  const { data: quizzes, error: quizError } = await client
    .from('quizzes')
    .select('id, course_id')
    .in('course_id', courseIds)
    .limit(1);

  if (quizError) throw quizError;
  const quiz = quizzes?.[0];
  if (!quiz) {
    throw new Error('No quizzes found for local courses.');
  }

  const userIds = [];
  for (const user of SEED_USERS) {
    const userId = await ensureUser(user);
    userIds.push(userId);
  }

  const [inactiveId, lowProgressId, quizFailedId] = userIds;

  const { error: membershipError } = await client
    .from('local_memberships')
    .upsert(
      userIds.map((userId) => ({
        org_id: org.id,
        local_id: local.id,
        user_id: userId,
        role: 'aprendiz',
        status: 'active',
        is_primary: true,
      })),
      { onConflict: 'local_id,user_id' },
    );
  if (membershipError) throw membershipError;

  const { error: deleteAnswersError } = await client
    .from('quiz_answers')
    .delete()
    .in('user_id', userIds);
  if (deleteAnswersError) throw deleteAnswersError;

  const { error: deleteAttemptsError } = await client
    .from('quiz_attempts')
    .delete()
    .in('user_id', userIds);
  if (deleteAttemptsError) throw deleteAttemptsError;

  const { error: deleteCompletionsError } = await client
    .from('lesson_completions')
    .delete()
    .in('user_id', userIds);
  if (deleteCompletionsError) throw deleteCompletionsError;

  const now = Date.now();
  const inactiveDate = new Date(now - MS_IN_DAY * 20).toISOString();

  const { error: inactiveCompletionError } = await client
    .from('lesson_completions')
    .insert({
      org_id: org.id,
      local_id: local.id,
      course_id: firstLesson.course_id,
      unit_id: firstLesson.unit_id,
      lesson_id: firstLesson.lesson_id,
      user_id: inactiveId,
      completed_at: inactiveDate,
      created_at: inactiveDate,
    });
  if (inactiveCompletionError) throw inactiveCompletionError;

  const lowProgressAttemptDate = new Date(now - MS_IN_DAY * 1).toISOString();
  const { error: lowProgressAttemptError } = await client
    .from('quiz_attempts')
    .insert({
      org_id: org.id,
      local_id: local.id,
      course_id: quiz.course_id,
      quiz_id: quiz.id,
      user_id: lowProgressId,
      attempt_no: 1,
      score: 100,
      passed: true,
      submitted_at: lowProgressAttemptDate,
      created_at: lowProgressAttemptDate,
    });
  if (lowProgressAttemptError) throw lowProgressAttemptError;

  const quizPassedDate = new Date(now - MS_IN_DAY * 10).toISOString();
  const quizFailDates = [
    new Date(now - MS_IN_DAY * 2).toISOString(),
    new Date(now - MS_IN_DAY * 1).toISOString(),
    new Date(now - MS_IN_DAY * 0.04).toISOString(),
  ];

  const quizAttempts = [
    {
      org_id: org.id,
      local_id: local.id,
      course_id: quiz.course_id,
      quiz_id: quiz.id,
      user_id: quizFailedId,
      attempt_no: 1,
      score: 100,
      passed: true,
      submitted_at: quizPassedDate,
      created_at: quizPassedDate,
    },
    ...quizFailDates.map((date, index) => ({
      org_id: org.id,
      local_id: local.id,
      course_id: quiz.course_id,
      quiz_id: quiz.id,
      user_id: quizFailedId,
      attempt_no: index + 2,
      score: 0,
      passed: false,
      submitted_at: date,
      created_at: date,
    })),
  ];

  const { error: quizFailedAttemptError } = await client
    .from('quiz_attempts')
    .insert(quizAttempts);
  if (quizFailedAttemptError) throw quizFailedAttemptError;

  const { error: alertsError } = await client
    .from('v_org_alerts')
    .select('alert_type')
    .limit(1);

  if (alertsError) throw alertsError;
  if (SUPABASE_ANON_KEY) {
    const email = process.env.TEST_ORGADMIN_EMAIL;
    const password = process.env.TEST_ORGADMIN_PASSWORD;

    if (!email || !password) {
      console.error('Missing TEST_ORGADMIN_EMAIL or TEST_ORGADMIN_PASSWORD');
      process.exit(1);
    }

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: loginError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) throw loginError;

    const { data: alertsData, error: alertsDataError } = await anonClient
      .from('v_org_alerts')
      .select('alert_type');
    if (alertsDataError) throw alertsDataError;

    const counts = (alertsData ?? []).reduce(
      (acc, row) => {
        acc[row.alert_type] = (acc[row.alert_type] ?? 0) + 1;
        return acc;
      },
      { inactive: 0, low_progress: 0, quiz_failed: 0 },
    );

    console.log('Alert counts:', counts);

    if (
      counts.inactive === 0 ||
      counts.low_progress === 0 ||
      counts.quiz_failed === 0
    ) {
      console.error('Expected at least one alert per type.');
      process.exit(1);
    }
  } else {
    console.warn(
      'Missing SUPABASE_ANON_KEY; skipping alert counts validation.',
    );
  }

  console.log('✅ Alert scenarios seeded successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
