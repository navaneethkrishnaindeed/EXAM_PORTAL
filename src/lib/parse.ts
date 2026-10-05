import { ALL_ACTIONS, type ActionId, type Exam, type Group, type IntakePolicy, type Marks, type Option, type Question, type QuestionImage, type QuestionType, type Section, type Subject, type TextMatch, type TimerMode } from "../types/exam";
import { flatten } from "./flatten";
import { uid } from "./format";

export interface ParseResult {
  exam: Exam | null;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function optNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

const INTAKES = new Set<IntakePolicy>(["onSave", "onSelect"]);
const TYPES = new Set<QuestionType>(["single", "multi", "text"]);
const MATCHES = new Set<TextMatch>(["exact", "caseInsensitive", "numericTolerance"]);
const TIMERS = new Set<TimerMode>(["exam", "perSubject"]);
const ACTION_SET = new Set<string>(ALL_ACTIONS);

function parseMarks(value: unknown, fallback: Marks): Marks {
  if (!isRecord(value)) return fallback;
  const marks: Marks = {
    correct: num(value.correct, fallback.correct),
    negative: 0,
  };
  const partial = optNum(value.partialPerCorrect);
  if (partial !== undefined && partial > 0) marks.partialPerCorrect = partial;
  return marks;
}

function parseImages(value: unknown): QuestionImage[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const images: QuestionImage[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      images.push({ src: item.trim() });
      continue;
    }
    if (!isRecord(item) || typeof item.src !== "string" || !item.src.trim()) continue;
    const image: QuestionImage = { src: item.src.trim() };
    if (typeof item.alt === "string" && item.alt.trim()) image.alt = item.alt.trim();
    images.push(image);
  }
  return images.length ? images : undefined;
}

function parseQuestion(value: unknown, errors: string[], where: string): Question | null {
  if (!isRecord(value)) {
    errors.push(`${where} is not an object.`);
    return null;
  }
  const typeRaw = str(value.type, "single");
  const type: QuestionType = TYPES.has(typeRaw as QuestionType) ? (typeRaw as QuestionType) : "single";
  if (!TYPES.has(typeRaw as QuestionType)) errors.push(`${where} has an unknown type.`);
  const options: Option[] = [];
  if (Array.isArray(value.options)) {
    value.options.forEach((option, index) => {
      if (!isRecord(option)) {
        errors.push(`${where} option ${index + 1} is not an object.`);
        return;
      }
      options.push({ id: str(option.id, String.fromCharCode(97 + index)), text: str(option.text) });
    });
  }
  const question: Question = {
    id: str(value.id, uid("q")),
    type,
    prompt: str(value.prompt),
    correct: strList(value.correct),
  };
  if (type !== "text") question.options = options;
  const images = parseImages(value.images);
  if (images) question.images = images;
  if (isRecord(value.marks)) question.marks = parseMarks(value.marks, { correct: 1, negative: 0 });
  const intake = str(value.intake);
  if (intake) {
    if (INTAKES.has(intake as IntakePolicy)) question.intake = intake as IntakePolicy;
    else errors.push(`${where} has an unknown intake policy.`);
  }
  const textMatch = str(value.textMatch);
  if (type === "text") {
    question.textMatch = MATCHES.has(textMatch as TextMatch) ? (textMatch as TextMatch) : "exact";
    if (textMatch && !MATCHES.has(textMatch as TextMatch)) errors.push(`${where} has an unknown text match.`);
    const tolerance = optNum(value.tolerance);
    if (tolerance !== undefined) question.tolerance = tolerance;
  }
  return question;
}

function parseSection(value: unknown, errors: string[], where: string): Section | null {
  if (!isRecord(value)) {
    errors.push(`${where} is not an object.`);
    return null;
  }
  const marks = parseMarks(value.marks, { correct: 1, negative: 0 });
  const questions: Question[] = [];
  if (Array.isArray(value.questions)) {
    value.questions.forEach((question, index) => {
      const parsed = parseQuestion(question, errors, `${where} question ${index + 1}`);
      if (parsed) questions.push(parsed);
    });
  }
  return {
    id: str(value.id, uid("sec")),
    name: str(value.name, "Section"),
    marks,
    questions,
  };
}

function parseGroup(value: unknown, errors: string[], where: string): Group | null {
  if (!isRecord(value)) {
    errors.push(`${where} is not an object.`);
    return null;
  }
  const sections: Section[] = [];
  if (Array.isArray(value.sections)) {
    value.sections.forEach((section, index) => {
      const parsed = parseSection(section, errors, `${where} section ${index + 1}`);
      if (parsed) sections.push(parsed);
    });
  }
  return { id: str(value.id, uid("grp")), name: str(value.name, "Group"), sections };
}

function parseSubject(value: unknown, errors: string[], index: number): Subject | null {
  if (!isRecord(value)) {
    errors.push(`Subject ${index + 1} is not an object.`);
    return null;
  }
  const groups: Group[] = [];
  if (Array.isArray(value.groups)) {
    value.groups.forEach((group, groupIndex) => {
      const parsed = parseGroup(group, errors, `Subject ${index + 1} group ${groupIndex + 1}`);
      if (parsed) groups.push(parsed);
    });
  }
  const subject: Subject = {
    id: str(value.id, uid("sub")),
    name: str(value.name, `Subject ${index + 1}`),
    groups,
  };
  const duration = optNum(value.durationMinutes);
  if (duration !== undefined) subject.durationMinutes = duration;
  return subject;
}

function flagDuplicates(ids: string[], label: string, errors: string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`Duplicate ${label} id "${id}".`);
    seen.add(id);
  }
}

export function validateExam(exam: Exam): string[] {
  const errors: string[] = [];
  if (!exam.title.trim()) errors.push("Give the paper a title.");
  if (!(exam.durationMinutes > 0)) errors.push("Paper duration must be greater than 0.");
  if (!exam.subjects.length) errors.push("Add at least one subject.");
  if (exam.timerMode === "perSubject") {
    exam.subjects.forEach((subject) => {
      if (!((subject.durationMinutes ?? 0) > 0)) {
        errors.push(`${subject.name || "A subject"} needs its own duration above 0.`);
      }
    });
  }
  if (!exam.autoSubmit && !exam.actions.includes("submit")) {
    errors.push("Turn on Submit or auto-submit so the paper can be finished.");
  }
  const subjectIds = exam.subjects.map((subject) => subject.id);
  flagDuplicates(subjectIds, "subject", errors);
  for (const subject of exam.subjects) {
    flagDuplicates(
      subject.groups.map((group) => group.id),
      `group in ${subject.name || "a subject"}`,
      errors,
    );
    for (const group of subject.groups) {
      flagDuplicates(
        group.sections.map((section) => section.id),
        `section in ${subject.name || "a subject"} / ${group.name || "a group"}`,
        errors,
      );
    }
  }
  const seen = new Set<string>();
  let questionCount = 0;
  for (const item of flatten(exam)) {
    questionCount += 1;
    if (seen.has(item.key)) errors.push(`Duplicate question id in ${item.sectionName}.`);
    seen.add(item.key);
    const where = `${item.subjectName} / ${item.sectionName} / Q${item.number}`;
    if (!item.question.prompt.trim()) errors.push(`${where} needs a prompt.`);
    const marks = item.question.marks ?? item.section.marks;
    if (marks.correct < 0) errors.push(`${where}: correct marks must be 0 or greater.`);
    if ((marks.partialPerCorrect ?? 0) < 0) errors.push(`${where} partial marks cannot be below 0.`);
    if (item.question.type === "text") {
      const accepted = item.question.correct.map((value) => value.trim()).filter(Boolean);
      if (!accepted.length) errors.push(`${where} needs an accepted answer.`);
      if ((item.question.textMatch ?? "exact") === "numericTolerance") {
        if ((item.question.tolerance ?? 0) < 0) errors.push(`${where} tolerance cannot be below 0.`);
        if (accepted.some((value) => !Number.isFinite(Number(value)))) {
          errors.push(`${where} numeric answers must be numbers.`);
        }
      }
      continue;
    }
    const options = item.question.options ?? [];
    if (options.length < 2) errors.push(`${where} needs at least two options.`);
    const ids = new Set<string>();
    options.forEach((option) => {
      if (!option.text.trim()) errors.push(`${where} has an empty option.`);
      if (ids.has(option.id)) errors.push(`${where} has a repeated option id.`);
      ids.add(option.id);
    });
    const correct = item.question.correct.filter((id) => ids.has(id));
    if (item.question.type === "single" && correct.length !== 1) {
      errors.push(`${where} needs exactly one correct option.`);
    }
    if (item.question.type === "multi" && correct.length < 1) {
      errors.push(`${where} needs at least one correct option.`);
    }
  }
  if (questionCount === 0) errors.push("Add at least one question.");
  return errors;
}

export function parseExam(input: unknown): ParseResult {
  if (!isRecord(input)) return { exam: null, errors: ["Exam must be a JSON object."] };
  const errors: string[] = [];
  if (!Array.isArray(input.subjects)) return { exam: null, errors: ["Exam needs a subjects array."] };

  const subjects: Subject[] = [];
  input.subjects.forEach((subject, index) => {
    const parsed = parseSubject(subject, errors, index);
    if (parsed) subjects.push(parsed);
  });

  const timerRaw = str(input.timerMode, "exam");
  const timerMode: TimerMode = TIMERS.has(timerRaw as TimerMode) ? (timerRaw as TimerMode) : "exam";
  if (!TIMERS.has(timerRaw as TimerMode)) errors.push("timerMode must be exam or perSubject.");

  const intakeRaw = str(input.intake, "onSave");
  const intake: IntakePolicy = INTAKES.has(intakeRaw as IntakePolicy) ? (intakeRaw as IntakePolicy) : "onSave";
  if (!INTAKES.has(intakeRaw as IntakePolicy)) errors.push("intake must be onSave or onSelect.");

  let actions: ActionId[] = [...ALL_ACTIONS];
  if (Array.isArray(input.actions)) {
    const next: ActionId[] = [];
    input.actions.forEach((action) => {
      if (typeof action === "string" && ACTION_SET.has(action)) next.push(action as ActionId);
      else errors.push(`Unknown action: ${String(action)}`);
    });
    actions = next;
  }

  const exam: Exam = {
    id: str(input.id, uid("paper")),
    title: str(input.title, "Untitled paper"),
    instructions: str(input.instructions),
    usefulData: str(input.usefulData),
    durationMinutes: num(input.durationMinutes, 30),
    timerMode,
    autoSubmit: typeof input.autoSubmit === "boolean" ? input.autoSubmit : true,
    actions,
    intake,
    candidateName: str(input.candidateName, "Candidate"),
    subjects,
  };
  errors.push(...validateExam(exam));
  return { exam, errors };
}
