import type { FormValues } from '../types';

export function flattenForm(values: FormValues): Record<string, string> {
  const flat: Record<string, string> = {
    timestamp: new Date().toISOString(),
    participantName: values.participantName,
    participantRole: values.participantRole,
    participantDate: values.participantDate,
    userType: values.userType,
    background: (values.background ?? []).join(', '),
    frequency: values.frequency,
    nps: values.nps,
    summaryScore: values.summaryScore,
    followUp: values.followUp,
  };

  for (const [id, ans] of Object.entries(values.tasks ?? {})) {
    flat[`${id}_ease`] = ans.ease ?? '';
    flat[`${id}_completion`] = ans.completion ?? '';
    flat[`${id}_notes`] = ans.notes ?? '';
  }

  for (const [id, val] of Object.entries(values.statements ?? {})) {
    flat[id] = val ?? '';
  }

  for (const [id, val] of Object.entries(values.open ?? {})) {
    flat[id] = val ?? '';
  }

  return flat;
}
