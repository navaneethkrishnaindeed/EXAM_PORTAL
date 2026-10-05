import raw from "../data/sample-exam.json";
import { parseExam } from "./parse";
import type { Exam } from "../types/exam";

const parsed = parseExam(raw);
if (!parsed.exam || parsed.errors.length) {
  throw new Error(parsed.errors.join("\n") || "Sample exam failed to parse.");
}

export const sampleExam: Exam = parsed.exam;
export const SAMPLE_ID = sampleExam.id;
