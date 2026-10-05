import { useRef, useState } from "react";
import { blankExam } from "../lib/blank";
import { flatten } from "../lib/flatten";
import { uid, slug } from "../lib/format";
import { parseExam, validateExam } from "../lib/parse";
import { SAMPLE_ID, sampleExam } from "../lib/sample";
import { savePapers } from "../lib/storage";
import type { Exam, Sitting } from "../types/exam";
import { BuildGuide } from "./BuildGuide";
import { ExamForm } from "./ExamForm";

interface StudioProps {
  papers: Exam[];
  setPapers: (papers: Exam[]) => void;
  sitting: Sitting | null;
  onStart: (exam: Exam) => void;
  onSampleResult: () => void;
  onResume: () => void;
  onDiscard: () => void;
}

const JSON_HELP = `title, candidateName, instructions, usefulData
durationMinutes, timerMode: "exam" | "perSubject"
autoSubmit, intake: "onSave" | "onSelect"
actions: saveNext, markReviewNext, clear, previous, submit
subjects[].name, durationMinutes
  groups[].name
    sections[].name
    sections[].marks: correct, partialPerCorrect
    negative marking is not used; wrong and unanswered score 0
      questions[]: type "single" | "multi" | "text"
        prompt, images[{src, alt}] or images["https://..."]
        options[{id,text}], correct[]
        marks, intake, textMatch, tolerance`;

export function Studio({ papers, setPapers, sitting, onStart, onSampleResult, onResume, onDiscard }: StudioProps) {
  const [draft, setDraft] = useState<Exam>(() => structuredClone(sampleExam));
  const [tab, setTab] = useState<"guide" | "form" | "json">("form");
  const [jsonText, setJsonText] = useState(() => JSON.stringify(sampleExam, null, 2));
  const [jsonDirty, setJsonDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const library = [sampleExam, ...papers.filter((paper) => paper.id !== SAMPLE_ID)];

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2500);
  }

  function select(exam: Exam) {
    const copy = structuredClone(exam);
    setDraft(copy);
    setJsonText(JSON.stringify(copy, null, 2));
    setJsonDirty(false);
    setErrors(validateExam(copy));
    setTab("form");
  }

  function edit(exam: Exam) {
    setDraft(exam);
    if (!jsonDirty) setJsonText(JSON.stringify(exam, null, 2));
    setErrors(validateExam(exam));
  }

  function save() {
    const errorsNow = validateExam(draft);
    setErrors(errorsNow);
    if (errorsNow.length) return;
    let stored = draft;
    if (stored.id === SAMPLE_ID) {
      stored = { ...draft, id: uid("paper"), title: draft.title.endsWith("(copy)") ? draft.title : `${draft.title} (copy)` };
    }
    const next = papers.some((paper) => paper.id === stored.id)
      ? papers.map((paper) => (paper.id === stored.id ? stored : paper))
      : [...papers, stored];
    setPapers(next);
    savePapers(next);
    setDraft(stored);
    setJsonDirty(false);
    setJsonText(JSON.stringify(stored, null, 2));
    flash("Saved in this browser.");
  }

  function remove(id: string) {
    if (id === SAMPLE_ID) return;
    const next = papers.filter((paper) => paper.id !== id);
    setPapers(next);
    savePapers(next);
    if (draft.id === id) select(sampleExam);
  }

  function start() {
    if (jsonDirty) {
      setErrors(["Apply the JSON edits before starting, or switch back to the form."]);
      setTab("json");
      return;
    }
    const errorsNow = validateExam(draft);
    setErrors(errorsNow);
    if (errorsNow.length) return;
    if (sitting && !sitting.attempt.closed) {
      const ok = window.confirm("A test is still in progress. Replace it with this paper?");
      if (!ok) return;
    }
    onStart(draft);
  }

  function exportJson() {
    const source = tab === "json" && jsonDirty ? jsonText : JSON.stringify(draft, null, 2);
    const blob = new Blob([source], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug(draft.title)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function applyJson() {
    let data: unknown;
    try {
      data = JSON.parse(jsonText);
    } catch {
      setErrors(["That text is not valid JSON."]);
      return;
    }
    const parsed = parseExam(data);
    if (!parsed.exam) {
      setErrors(parsed.errors);
      return;
    }
    setDraft(parsed.exam);
    setErrors(parsed.errors);
    setJsonDirty(false);
    if (!parsed.errors.length) flash("JSON applied.");
  }

  async function importFile(file: File) {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setErrors(["That file is not valid JSON."]);
      return;
    }
    const parsed = parseExam(data);
    if (!parsed.exam) {
      setErrors(parsed.errors);
      return;
    }
    const exam = parsed.exam.id === SAMPLE_ID ? { ...parsed.exam, id: uid("paper") } : parsed.exam;
    setDraft(exam);
    setJsonText(JSON.stringify(exam, null, 2));
    setJsonDirty(false);
    setErrors(parsed.errors);
    setTab("form");
    if (!parsed.errors.length) {
      const next = [...papers.filter((paper) => paper.id !== exam.id), exam];
      setPapers(next);
      savePapers(next);
      flash("Imported and saved.");
    }
  }

  function showJson() {
    if (!jsonDirty) setJsonText(JSON.stringify(draft, null, 2));
    setTab("json");
  }

  const count = flatten(draft).length;

  return (
    <div className="studio">
      <aside className="library">
        <div className="brand">
          <p>Exam Studio</p>
          <h1>Papers</h1>
        </div>
        <button type="button" className="act save wide" onClick={() => select(blankExam())}>New paper</button>
        <button type="button" className="act wide" onClick={() => fileRef.current?.click()}>Import JSON</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importFile(file);
          }}
        />
        <ul className="paper-list">
          {library.map((paper) => (
            <li key={paper.id}>
              <button
                type="button"
                className={paper.id === draft.id ? "paper active" : "paper"}
                onClick={() => select(paper)}
              >
                <strong>{paper.title}</strong>
                <span>
                  {paper.id === SAMPLE_ID ? "Sample · " : ""}
                  {flatten(paper).length} questions · {paper.subjects.length} subjects
                </span>
              </button>
              {paper.id !== SAMPLE_ID && (
                <button type="button" className="text-btn" onClick={() => remove(paper.id)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      </aside>
      <main className="editor">
        {sitting && (
          <div className="banner">
            {sitting.attempt.closed ? (
              <>
                The last paper has a result ready.
                <button type="button" onClick={onResume}>View result</button>
              </>
            ) : (
              <>
                A test is in progress.
                <button type="button" onClick={onResume}>Resume</button>
                <button type="button" onClick={onDiscard}>Discard</button>
              </>
            )}
          </div>
        )}
        <div className="editor-bar">
          <div>
            <h2>{draft.title || "Untitled paper"}</h2>
            <p>{count} questions · {draft.timerMode === "exam" ? `${draft.durationMinutes} min` : "timer per subject"} · {draft.intake === "onSave" ? "save to store" : "select to store"}</p>
          </div>
          <div className="icon-row">
            <button type="button" className="act" onClick={save}>Save</button>
            <button type="button" className="act" onClick={exportJson}>Export JSON</button>
            <button type="button" className="act save" data-testid="start-test" onClick={start}>Start test</button>
            <button
              type="button"
              className="act"
              onClick={() => {
                if (sitting && !sitting.attempt.closed) {
                  const ok = window.confirm("A test is still in progress. Replace it with the sample result?");
                  if (!ok) return;
                }
                onSampleResult();
              }}
            >
              Sample result
            </button>
          </div>
        </div>
        {notice && <p className="notice">{notice}</p>}
        {errors.length > 0 && (
          <div className="errors" role="alert">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
        <div className="tabs">
          <button type="button" className={tab === "form" ? "active" : ""} onClick={() => setTab("form")}>Form</button>
          <button type="button" className={tab === "json" ? "active" : ""} onClick={showJson}>JSON</button>
          <button type="button" className={tab === "guide" ? "active" : ""} onClick={() => setTab("guide")}>From a paper</button>
        </div>
        {tab === "guide" ? (
          <BuildGuide />
        ) : tab === "form" ? (
          <ExamForm exam={draft} onChange={edit} />
        ) : (
          <div className="json-pane">
            {jsonDirty && <p className="notice">JSON has edits that are not applied to the form yet.</p>}
            <textarea
              value={jsonText}
              spellCheck={false}
              aria-label="Exam JSON"
              onChange={(event) => {
                setJsonText(event.target.value);
                setJsonDirty(true);
              }}
            />
            <div className="icon-row">
              <button type="button" className="act save" onClick={applyJson}>Apply JSON</button>
            </div>
            <pre className="json-help">{JSON_HELP}</pre>
          </div>
        )}
      </main>
    </div>
  );
}
