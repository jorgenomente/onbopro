'use client';

import { useRouter } from 'next/navigation';

export default function OrgCourseEditPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
        <button
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-700"
          type="button"
          onClick={() => router.push('/org/courses')}
        >
          ← Back to Courses
        </button>
        <h1 className="mt-4 text-2xl font-semibold text-zinc-900">
          Edit Course
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Coming soon.</p>
      </div>
    </div>
  );
}
