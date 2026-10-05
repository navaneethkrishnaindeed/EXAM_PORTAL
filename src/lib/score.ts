import type { Exam, Marks, Question, QuestionImage, QuestionType, Section, TextMatch } from "../types/exam";
import { flatten } from "./flatten";
import { formatMarks, round2 } from "./format";

export type Outcome = "correct" | "incorrect" | "partial" | "unanswered";

export interface Scored {
  awarded: number;
  max: number;
  outcome: Outcome;
  scheme: string;
}

export interface ScoreLine extends Scored {
  key: string;
  subjectId: string;
  subjectName: string;
  groupName: string;
  sectionName: string;
  number: number;
  prompt: string;
  images?: QuestionImage[];
  type: QuestionType;
  yours: string;
  keyText: string;
}

export interface SubjectScore {
  id: string;
  name: string;
  awarded: number;
  max: number;
}

export interface ScoreReport {
  total: number;
  max: number;
  bySubject: SubjectScore[];
  lines: ScoreLine[];
}

export function effectiveMarks(section: Section, question: Question): Marks {
  if (question.marks) {
    return {
      correct: question.marks.correct ?? section.marks.correct,
      negative: 0,
      partialPerCorrect: question.marks.partialPerCorrect,
    };
  }
  return { ...section.marks, negative: 0 };
}

export function isPartial(question: Question, marks: Marks): boolean {
  return question.type === "multi" && (marks.partialPerCorrect ?? 0) > 0;
}

export function maxMarks(question: Question, marks: Marks): number {
  if (isPartial(question, marks)) {
    const ids = unique(question.correct);
    return round2(ids.length * (marks.partialPerCorrect ?? 0));
  }
  return marks.correct;
}

export function displayMarks(section: Section, question: Question): {
  correct: number;
  negative: number;
  note: string | null;
} {
  const marks = effectiveMarks(section, question);
  if (isPartial(question, marks)) {
    return {
      correct: maxMarks(question, marks),
      negative: 0,
      note: `Partial credit: +${formatMarks(marks.partialPerCorrect ?? 0)} for each correct option. A wrong option scores 0.`,
    };
  }
  return { correct: marks.correct, negative: 0, note: null };
}

export function isTaken(taken: string[] | null | undefined): boolean {
  if (!taken) return false;
  return taken.some((value) => value.trim() !== "");
}

function unique(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function textRule(question: Question): string {
  const mode: TextMatch = question.textMatch ?? "exact";
  if (mode === "caseInsensitive") return "case-insensitive text";
  if (mode === "numericTolerance") {
    return `numeric, tolerance ±${formatMarks(question.tolerance ?? 0)}`;
  }
  return "exact text";
}

export function schemeText(question: Question, marks: Marks): string {
  if (isPartial(question, marks)) {
    return `+${formatMarks(marks.partialPerCorrect ?? 0)} per correct option. Wrong options score 0. Unanswered is 0.`;
  }
  const how =
    question.type === "text"
      ? textRule(question)
      : question.type === "multi"
        ? "all options must match"
        : "one correct option";
  return `+${formatMarks(marks.correct)} if right, 0 if wrong (${how}). Unanswered is 0.`;
}

function textMatches(question: Question, raw: string): boolean {
  const value = raw.trim();
  const mode: TextMatch = question.textMatch ?? "exact";
  const accepted = question.correct.map((item) => item.trim()).filter(Boolean);
  if (mode === "numericTolerance") {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    const tol = question.tolerance ?? 0;
    return accepted.some((item) => {
      const target = Number(item);
      return Number.isFinite(target) && Math.abs(n - target) <= tol + 1e-9;
    });
  }
  if (mode === "caseInsensitive") {
    const folded = value.toLowerCase();
    return accepted.some((item) => item.toLowerCase() === folded);
  }
  return accepted.includes(value);
}

export function formatAnswer(question: Question, values: string[] | null | undefined): string {
  if (!isTaken(values)) return "—";
  const list = (values ?? []).map((value) => value.trim()).filter(Boolean);
  if (question.type === "text") return list.join(", ");
  const labels = new Map((question.options ?? []).map((option) => [option.id, option.text]));
  return list.map((id) => labels.get(id) ?? id).join(", ");
}

export function scoreQuestion(section: Section, question: Question, taken: string[] | null): Scored {
  const marks = effectiveMarks(section, question);
  const max = maxMarks(question, marks);
  const scheme = schemeText(question, marks);
  if (!isTaken(taken)) {
    return { awarded: 0, max, outcome: "unanswered", scheme };
  }
  const values = (taken ?? []).map((value) => value.trim()).filter(Boolean);

  if (question.type === "text") {
    const ok = textMatches(question, values[0] ?? "");
    return {
      awarded: ok ? marks.correct : 0,
      max,
      outcome: ok ? "correct" : "incorrect",
      scheme,
    };
  }

  if (question.type === "single") {
    const ok = values.length === 1 && question.correct.includes(values[0]);
    return {
      awarded: ok ? marks.correct : 0,
      max,
      outcome: ok ? "correct" : "incorrect",
      scheme,
    };
  }

  const chosen = new Set(values);
  const correct = new Set(unique(question.correct));
  if (isPartial(question, marks)) {
    let awarded = 0;
    for (const id of chosen) {
      if (correct.has(id)) awarded += marks.partialPerCorrect ?? 0;
    }
    awarded = round2(awarded);
    let outcome: Outcome = "incorrect";
    if (awarded > 0 && awarded + 1e-9 >= max) outcome = "correct";
    else if (awarded > 0) outcome = "partial";
    return { awarded, max, outcome, scheme };
  }

  const same = chosen.size === correct.size && [...correct].every((id) => chosen.has(id));
  return {
    awarded: same ? marks.correct : 0,
    max,
    outcome: same ? "correct" : "incorrect",
    scheme,
  };
}

export function scoreExam(exam: Exam, answers: Record<string, string[] | null>): ScoreReport {
  const lines: ScoreLine[] = flatten(exam).map((item) => {
    const scored = scoreQuestion(item.section, item.question, answers[item.key] ?? null);
    return {
      ...scored,
      key: item.key,
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      groupName: item.groupName,
      sectionName: item.sectionName,
      number: item.number,
      prompt: item.question.prompt,
      images: item.question.images,
      type: item.question.type,
      yours: formatAnswer(item.question, answers[item.key] ?? null),
      keyText: formatAnswer(item.question, item.question.correct),
    };
  });

  const bySubjectMap = new Map<string, SubjectScore>();
  for (const line of lines) {
    const current = bySubjectMap.get(line.subjectId) ?? {
      id: line.subjectId,
      name: line.subjectName,
      awarded: 0,
      max: 0,
    };
    current.awarded = round2(current.awarded + line.awarded);
    current.max = round2(current.max + line.max);
    bySubjectMap.set(line.subjectId, current);
  }

  const bySubject = [...bySubjectMap.values()];
  const total = round2(lines.reduce((sum, line) => sum + line.awarded, 0));
  const max = round2(lines.reduce((sum, line) => sum + line.max, 0));
  return { total, max, bySubject, lines };
}
