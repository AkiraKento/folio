export function toDate(input?: Date | number): Date {
  if (!input) return new Date();
  return typeof input === 'number' ? new Date(input) : new Date(input.getTime());
}

export function getStudyDayStart(date?: Date | number, rolloverHour: number = 4): number {
  const d = toDate(date);
  const currentHour = d.getHours();

  const start = new Date(d);
  start.setHours(rolloverHour, 0, 0, 0);

  if (currentHour < rolloverHour) {
    // Antes da virada: o dia de estudo começou no dia anterior às rolloverHour
    start.setDate(start.getDate() - 1);
  }

  return start.getTime();
}

export function getStudyDayCutoff(date?: Date | number, rolloverHour: number = 4): number {
  const startMs = getStudyDayStart(date, rolloverHour);
  const start = new Date(startMs);
  start.setDate(start.getDate() + 1);
  return start.getTime();
}

export function getStudyDayRange(
  date?: Date | number,
  rolloverHour: number = 4
): { startMs: number; endMs: number } {
  const startMs = getStudyDayStart(date, rolloverHour);
  const endMs = getStudyDayCutoff(date, rolloverHour);
  return { startMs, endMs };
}

export function formatInterval(intervalOrDueMs: number, nowMs?: number): string {
  let diffMs = intervalOrDueMs;
  if (nowMs !== undefined) {
    diffMs = intervalOrDueMs - nowMs;
  }

  if (diffMs < 0) {
    diffMs = 0;
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) {
    return '< 1 min';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  if (hours < 24) {
    return `${hours} h`;
  }
  if (days < 30) {
    return `${days} d`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} m`;
  }
  const years = Math.floor(days / 365);
  return `${years} a`;
}
