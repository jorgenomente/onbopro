type ProgressStatus = 'pending' | 'in_progress' | 'completed';
type QuizAttemptStatus = 'not_started' | 'in_progress' | 'submitted';

export function formatStatusLabel(status: ProgressStatus | string) {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'in_progress':
      return 'En curso';
    case 'completed':
      return 'Completado';
    default:
      return status;
  }
}

export function formatQuizStatusLabel(status: QuizAttemptStatus | string) {
  switch (status) {
    case 'not_started':
      return 'No iniciado';
    case 'in_progress':
      return 'En progreso';
    case 'submitted':
      return 'Enviado';
    default:
      return status;
  }
}
