import type { BreadcrumbItem } from '@/app/components/Breadcrumbs';

export const coursesIndexCrumbs = (): BreadcrumbItem[] => [{ label: 'Cursos' }];

export const courseOutlineCrumbs = ({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle?: string | null;
}): BreadcrumbItem[] => [
  { label: 'Cursos', href: '/org/courses' },
  { label: courseTitle ?? 'Curso', href: `/org/courses/${courseId}/outline` },
  { label: 'Outline' },
];

export const courseAnalyticsCrumbs = ({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle?: string | null;
}): BreadcrumbItem[] => [
  { label: 'Cursos', href: '/org/courses' },
  { label: courseTitle ?? 'Curso', href: `/org/courses/${courseId}/outline` },
  { label: 'Analytics' },
];

export const localDetailCrumbs = ({
  localId,
  localName,
}: {
  localId: string;
  localName?: string | null;
}): BreadcrumbItem[] => [
  { label: 'Dashboard', href: '/org/dashboard' },
  { label: localName ?? 'Local', href: `/org/locals/${localId}` },
];

export const localInviteCrumbs = ({
  localId,
  localName,
}: {
  localId: string;
  localName?: string | null;
}): BreadcrumbItem[] => [
  { label: 'Dashboard', href: '/org/dashboard' },
  { label: localName ?? 'Local', href: `/org/locals/${localId}` },
  { label: 'Invitar' },
];
