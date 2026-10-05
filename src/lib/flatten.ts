import type { Exam, Question, Section } from "../types/exam";

export interface FlatQuestion {
  key: string;
  subjectId: string;
  subjectName: string;
  groupId: string;
  groupName: string;
  sectionId: string;
  sectionName: string;
  section: Section;
  question: Question;
  number: number;
}

export function questionKey(
  subjectId: string,
  groupId: string,
  sectionId: string,
  questionId: string,
): string {
  return `${subjectId}::${groupId}::${sectionId}::${questionId}`;
}

export function flatten(exam: Exam): FlatQuestion[] {
  const out: FlatQuestion[] = [];
  for (const subject of exam.subjects) {
    for (const group of subject.groups) {
      for (const section of group.sections) {
        section.questions.forEach((question, index) => {
          out.push({
            key: questionKey(subject.id, group.id, section.id, question.id),
            subjectId: subject.id,
            subjectName: subject.name,
            groupId: group.id,
            groupName: group.name,
            sectionId: section.id,
            sectionName: section.name,
            section,
            question,
            number: index + 1,
          });
        });
      }
    }
  }
  return out;
}

export function findFlat(exam: Exam, key: string): FlatQuestion | undefined {
  return flatten(exam).find((q) => q.key === key);
}

export function sectionQuestions(exam: Exam, subjectId: string, groupId: string, sectionId: string): FlatQuestion[] {
  return flatten(exam).filter(
    (q) => q.subjectId === subjectId && q.groupId === groupId && q.sectionId === sectionId,
  );
}

export function neighborKey(exam: Exam, key: string, dir: -1 | 1): string | null {
  const list = flatten(exam);
  const index = list.findIndex((q) => q.key === key);
  if (index < 0) return null;
  const next = list[index + dir];
  return next ? next.key : null;
}

export function firstKeyOfSubject(exam: Exam, subjectId: string): string | null {
  return flatten(exam).find((q) => q.subjectId === subjectId)?.key ?? null;
}
