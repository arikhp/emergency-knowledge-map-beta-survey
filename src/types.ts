export interface TaskAnswer {
  ease: string;
  completion: string;
  notes: string;
}

export interface FormValues {
  participantName: string;
  participantRole: string;
  participantDate: string;
  userType: string;
  background: string[];
  frequency: string;
  tasks: Record<string, TaskAnswer>;
  statements: Record<string, string>;
  nps: string;
  open: Record<string, string>;
  summaryScore: string;
  followUp: string;
}
