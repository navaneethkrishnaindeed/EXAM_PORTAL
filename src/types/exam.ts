export const ALL_ACTIONS = [
  "saveNext",
  "markReviewNext",
  "clear",
  "previous",
  "submit",
] as const;

export type ActionId = (typeof ALL_ACTIONS)[number];

export const ACTION_LABELS: Record<ActionId, string> = {
  saveNext: "Save & Next",
  markReviewNext: "Mark for Review & Next",
  clear: "Clear Response",
  previous: "Previous",
  submit: "Submit",
};

export type QuestionType = "single" | "multi" | "text";
export type IntakePolicy = "onSave" | "onSelect";
export type TextMatch = "exact" | "caseInsensitive" | "numericTolerance";
export type TimerMode = "exam" | "perSubject";
export type PaletteStatus =
  | "notVisited"
  | "notAnswered"
  | "answered"
  | "marked"
  | "answeredMarked";

export interface Marks {
  correct: number;
  negative: number;
  partialPerCorrect?: number;
  wrongOptionPenalty?: number;
}

export interface Option {
  id: string;
  text: string;
}

export interface QuestionImage {
  src: string;
  alt?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  images?: QuestionImage[];
  options?: Option[];
  /** Option ids, or accepted text answers. */
  correct: string[];
  marks?: Marks;
  intake?: IntakePolicy;
  textMatch?: TextMatch;
  tolerance?: number;
}

export interface Section {
  id: string;
  name: string;
  marks: Marks;
  questions: Question[];
}

export interface Group {
  id: string;
  name: string;
  sections: Section[];
}

export interface Subject {
  id: string;
  name: string;
  durationMinutes?: number;
  groups: Group[];
}

export interface Exam {
  id: string;
  title: string;
  instructions: string;
  usefulData: string;
  durationMinutes: number;
  timerMode: TimerMode;
  autoSubmit: boolean;
  actions: ActionId[];
  intake: IntakePolicy;
  candidateName: string;
  subjects: Subject[];
}

export interface QuestionState {
  visited: boolean;
  marked: boolean;
  /** Committed answer. null means never saved. */
  taken: string[] | null;
  draft: string[];
}

export interface Attempt {
  startedAt: number;
  endedAt: number | null;
  closed: boolean;
  autoClosed: boolean;
  timeUp: boolean;
  currentKey: string;
  lastKeyBySubject: Record<string, string>;
  questions: Record<string, QuestionState>;
  /** Absolute deadline for a whole-paper timer. */
  deadline: number | null;
  subjectRemainingMs: Record<string, number>;
  activeSubjectId: string | null;
  activeDeadline: number | null;
  lockedSubjects: string[];
}

export interface Sitting {
  exam: Exam;
  attempt: Attempt;
}
