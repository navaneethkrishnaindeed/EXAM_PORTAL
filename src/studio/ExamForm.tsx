import { useState } from "react";
import { QuestionImages } from "../components/QuestionImages";
import { blankGroup, blankQuestion, blankSection, blankSubject, nextOptionId } from "../lib/blank";
import { readImageFile } from "../lib/images";
import { effectiveMarks, schemeText } from "../lib/score";
import { ALL_ACTIONS, ACTION_LABELS, type ActionId, type Exam, type Group, type IntakePolicy, type Marks, type Question, type QuestionImage, type QuestionType, type Section, type Subject, type TextMatch } from "../types/exam";

interface ExamFormProps {
  exam: Exam;
  onChange: (exam: Exam) => void;
}

function moveItem<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const next = index + dir;
  if (next < 0 || next >= items.length) return items;
  const copy = items.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}

function changeType(question: Question, type: QuestionType): Question {
  if (question.type === type) return question;
  if (type === "text") {
    return {
      id: question.id,
      type,
      prompt: question.prompt,
      correct: [""],
      textMatch: "exact",
      tolerance: 0,
      marks: question.marks,
      intake: question.intake,
      images: question.images,
    };
  }
  const options = question.options?.length
    ? question.options
    : [
        { id: "a", text: "" },
        { id: "b", text: "" },
        { id: "c", text: "" },
        { id: "d", text: "" },
      ];
  return {
    id: question.id,
    type,
    prompt: question.prompt,
    options,
    correct: type === "single" ? [options[0]?.id ?? "a"] : [],
    marks: question.marks,
    intake: question.intake,
    images: question.images,
  };
}

export function ExamForm({ exam, onChange }: ExamFormProps) {
  function patch(partial: Partial<Exam>) {
    onChange({ ...exam, ...partial });
  }

  function updateSubject(subjectId: string, fn: (subject: Subject) => Subject) {
    onChange({ ...exam, subjects: exam.subjects.map((subject) => (subject.id === subjectId ? fn(subject) : subject)) });
  }

  function updateGroup(subjectId: string, groupId: string, fn: (group: Group) => Group) {
    updateSubject(subjectId, (subject) => ({
      ...subject,
      groups: subject.groups.map((group) => (group.id === groupId ? fn(group) : group)),
    }));
  }

  function updateSection(subjectId: string, groupId: string, sectionId: string, fn: (section: Section) => Section) {
    updateGroup(subjectId, groupId, (group) => ({
      ...group,
      sections: group.sections.map((section) => (section.id === sectionId ? fn(section) : section)),
    }));
  }

  function updateQuestion(
    subjectId: string,
    groupId: string,
    sectionId: string,
    questionId: string,
    fn: (question: Question) => Question,
  ) {
    updateSection(subjectId, groupId, sectionId, (section) => ({
      ...section,
      questions: section.questions.map((question) => (question.id === questionId ? fn(question) : question)),
    }));
  }

  function toggleAction(action: ActionId) {
    const actions = exam.actions.includes(action)
      ? exam.actions.filter((item) => item !== action)
      : [...exam.actions, action];
    patch({ actions });
  }

  return (
    <div className="exam-form">
      <section className="card">
        <h2>Paper</h2>
        <div className="form-grid">
          <label>
            Title
            <input value={exam.title} onChange={(event) => patch({ title: event.target.value })} />
          </label>
          <label>
            Candidate name
            <input value={exam.candidateName} onChange={(event) => patch({ candidateName: event.target.value })} />
          </label>
          <label>
            Duration (minutes)
            <input
              type="number"
              min={0.05}
              step={0.05}
              value={exam.durationMinutes}
              onChange={(event) => patch({ durationMinutes: Number(event.target.value) })}
            />
          </label>
          <label>
            Timer
            <select
              value={exam.timerMode}
              onChange={(event) => patch({ timerMode: event.target.value as Exam["timerMode"] })}
            >
              <option value="exam">One timer for the paper</option>
              <option value="perSubject">A timer for each subject</option>
            </select>
          </label>
          <label>
            Answer intake
            <select value={exam.intake} onChange={(event) => patch({ intake: event.target.value as IntakePolicy })}>
              <option value="onSave">On save — store when Save or Mark for Review is pressed</option>
              <option value="onSelect">On select — store as soon as an answer is chosen</option>
            </select>
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={exam.autoSubmit}
              onChange={(event) => patch({ autoSubmit: event.target.checked })}
            />
            Auto-submit when the timer ends
          </label>
        </div>
        <fieldset className="actions-set">
          <legend>Actions</legend>
          {ALL_ACTIONS.map((action) => (
            <label key={action}>
              <input type="checkbox" checked={exam.actions.includes(action)} onChange={() => toggleAction(action)} />
              {ACTION_LABELS[action]}
            </label>
          ))}
        </fieldset>
        <label>
          Instructions
          <textarea rows={5} value={exam.instructions} onChange={(event) => patch({ instructions: event.target.value })} />
        </label>
        <label>
          Useful data
          <textarea rows={4} value={exam.usefulData} onChange={(event) => patch({ usefulData: event.target.value })} />
        </label>
      </section>

      {exam.subjects.map((subject, subjectIndex) => (
        <section key={subject.id} className="card">
          <div className="card-head">
            <h2>Subject</h2>
            <div className="icon-row">
              <button type="button" onClick={() => patch({ subjects: moveItem(exam.subjects, subjectIndex, -1) })} disabled={subjectIndex === 0}>Up</button>
              <button type="button" onClick={() => patch({ subjects: moveItem(exam.subjects, subjectIndex, 1) })} disabled={subjectIndex === exam.subjects.length - 1}>Down</button>
              <button type="button" onClick={() => patch({ subjects: exam.subjects.filter((item) => item.id !== subject.id) })}>Remove</button>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Name
              <input
                value={subject.name}
                onChange={(event) => updateSubject(subject.id, (item) => ({ ...item, name: event.target.value }))}
              />
            </label>
            {exam.timerMode === "perSubject" && (
              <label>
                Subject duration (minutes)
                <input
                  type="number"
                  min={0.05}
                  step={0.05}
                  value={subject.durationMinutes ?? 0}
                  onChange={(event) =>
                    updateSubject(subject.id, (item) => ({ ...item, durationMinutes: Number(event.target.value) }))
                  }
                />
              </label>
            )}
          </div>

          {subject.groups.map((group, groupIndex) => (
            <div key={group.id} className="nest">
              <div className="card-head">
                <h3>Group</h3>
                <div className="icon-row">
                  <button type="button" disabled={groupIndex === 0} onClick={() => updateSubject(subject.id, (item) => ({ ...item, groups: moveItem(item.groups, groupIndex, -1) }))}>Up</button>
                  <button type="button" disabled={groupIndex === subject.groups.length - 1} onClick={() => updateSubject(subject.id, (item) => ({ ...item, groups: moveItem(item.groups, groupIndex, 1) }))}>Down</button>
                  <button type="button" onClick={() => updateSubject(subject.id, (item) => ({ ...item, groups: item.groups.filter((g) => g.id !== group.id) }))}>Remove</button>
                </div>
              </div>
              <label>
                Group name
                <input value={group.name} onChange={(event) => updateGroup(subject.id, group.id, (item) => ({ ...item, name: event.target.value }))} />
              </label>

              {group.sections.map((section, sectionIndex) => (
                <div key={section.id} className="nest section-nest">
                  <div className="card-head">
                    <h3>Section</h3>
                    <div className="icon-row">
                      <button type="button" disabled={sectionIndex === 0} onClick={() => updateGroup(subject.id, group.id, (item) => ({ ...item, sections: moveItem(item.sections, sectionIndex, -1) }))}>Up</button>
                      <button type="button" disabled={sectionIndex === group.sections.length - 1} onClick={() => updateGroup(subject.id, group.id, (item) => ({ ...item, sections: moveItem(item.sections, sectionIndex, 1) }))}>Down</button>
                      <button type="button" onClick={() => updateGroup(subject.id, group.id, (item) => ({ ...item, sections: item.sections.filter((s) => s.id !== section.id) }))}>Remove</button>
                    </div>
                  </div>
                  <label>
                    Section name
                    <input value={section.name} onChange={(event) => updateSection(subject.id, group.id, section.id, (item) => ({ ...item, name: event.target.value }))} />
                  </label>
                  <MarksFields
                    marks={section.marks}
                    onChange={(marks) => updateSection(subject.id, group.id, section.id, (item) => ({ ...item, marks }))}
                  />
                  {section.questions.map((question, questionIndex) => (
                    <details key={question.id} className="q-edit">
                      <summary>
                        Q{questionIndex + 1} · {question.type} · {question.prompt || "Untitled question"}
                      </summary>
                      <div className="icon-row">
                        <button type="button" disabled={questionIndex === 0} onClick={() => updateSection(subject.id, group.id, section.id, (item) => ({ ...item, questions: moveItem(item.questions, questionIndex, -1) }))}>Up</button>
                        <button type="button" disabled={questionIndex === section.questions.length - 1} onClick={() => updateSection(subject.id, group.id, section.id, (item) => ({ ...item, questions: moveItem(item.questions, questionIndex, 1) }))}>Down</button>
                        <button type="button" onClick={() => updateSection(subject.id, group.id, section.id, (item) => ({ ...item, questions: item.questions.filter((q) => q.id !== question.id) }))}>Remove</button>
                      </div>
                      <label>
                        Type
                        <select
                          value={question.type}
                          onChange={(event) =>
                            updateQuestion(subject.id, group.id, section.id, question.id, (item) =>
                              changeType(item, event.target.value as QuestionType),
                            )
                          }
                        >
                          <option value="single">Radio — one answer</option>
                          <option value="multi">Multi select</option>
                          <option value="text">Text box</option>
                        </select>
                      </label>
                      <label>
                        Prompt
                        <textarea
                          rows={3}
                          value={question.prompt}
                          onChange={(event) =>
                            updateQuestion(subject.id, group.id, section.id, question.id, (item) => ({
                              ...item,
                              prompt: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <ImageFields
                        question={question}
                        onChange={(next) => updateQuestion(subject.id, group.id, section.id, question.id, () => next)}
                      />
                      {question.type === "text" ? (
                        <TextKey
                          question={question}
                          onChange={(next) => updateQuestion(subject.id, group.id, section.id, question.id, () => next)}
                        />
                      ) : (
                        <OptionKey
                          radioName={`${subject.id}-${group.id}-${section.id}-${question.id}`}
                          question={question}
                          onChange={(next) => updateQuestion(subject.id, group.id, section.id, question.id, () => next)}
                        />
                      )}
                      <label>
                        Intake override
                        <select
                          value={question.intake ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateQuestion(subject.id, group.id, section.id, question.id, (item) => ({
                              ...item,
                              intake: value ? (value as IntakePolicy) : undefined,
                            }));
                          }}
                        >
                          <option value="">Inherit ({exam.intake === "onSave" ? "on save" : "on select"})</option>
                          <option value="onSave">On save</option>
                          <option value="onSelect">On select</option>
                        </select>
                      </label>
                      <label className="check-line">
                        <input
                          type="checkbox"
                          checked={!!question.marks}
                          onChange={(event) =>
                            updateQuestion(subject.id, group.id, section.id, question.id, (item) => ({
                              ...item,
                              marks: event.target.checked ? { ...section.marks } : undefined,
                            }))
                          }
                        />
                        Custom marking scheme
                      </label>
                      {question.marks && (
                        <MarksFields
                          marks={question.marks}
                          onChange={(marks) =>
                            updateQuestion(subject.id, group.id, section.id, question.id, (item) => ({ ...item, marks }))
                          }
                        />
                      )}
                      <p className="scheme-preview">{schemeText(question, effectiveMarks(section, question))}</p>
                    </details>
                  ))}
                  <div className="add-row">
                    <button type="button" onClick={() => updateSection(subject.id, group.id, section.id, (item) => ({ ...item, questions: [...item.questions, blankQuestion("single")] }))}>
                      Add radio
                    </button>
                    <button type="button" onClick={() => updateSection(subject.id, group.id, section.id, (item) => ({ ...item, questions: [...item.questions, blankQuestion("multi")] }))}>
                      Add multi select
                    </button>
                    <button type="button" onClick={() => updateSection(subject.id, group.id, section.id, (item) => ({ ...item, questions: [...item.questions, blankQuestion("text")] }))}>
                      Add text box
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => updateGroup(subject.id, group.id, (item) => ({ ...item, sections: [...item.sections, blankSection(`Section${item.sections.length + 1}`)] }))}>
                Add section
              </button>
            </div>
          ))}
          <button type="button" onClick={() => updateSubject(subject.id, (item) => ({ ...item, groups: [...item.groups, blankGroup(`Group ${item.groups.length + 1}`)] }))}>
            Add group
          </button>
        </section>
      ))}
      <button type="button" className="add-subject" onClick={() => patch({ subjects: [...exam.subjects, blankSubject(`Subject ${exam.subjects.length + 1}`)] })}>
        Add subject
      </button>
    </div>
  );
}

function MarksFields({ marks, onChange }: { marks: Marks; onChange: (marks: Marks) => void }) {
  function publish(correct: number, partial: number | undefined) {
    const next: Marks = { correct, negative: 0 };
    if (partial !== undefined && partial > 0) next.partialPerCorrect = partial;
    onChange(next);
  }
  return (
    <div className="mark-grid">
      <label>
        Correct marks
        <input
          type="number"
          step="0.5"
          min={0}
          value={marks.correct}
          onChange={(event) => publish(event.target.value === "" ? 0 : Number(event.target.value), marks.partialPerCorrect)}
        />
      </label>
      <label>
        Partial per correct option
        <input
          type="number"
          step="0.5"
          min={0}
          value={marks.partialPerCorrect ?? ""}
          placeholder="All or nothing"
          onChange={(event) =>
            publish(marks.correct, event.target.value === "" ? undefined : Number(event.target.value))
          }
        />
      </label>
      <p className="scheme-preview">Wrong answers score 0. Unanswered questions score 0.</p>
    </div>
  );
}

function OptionKey({
  question,
  onChange,
  radioName,
}: {
  question: Question;
  onChange: (question: Question) => void;
  radioName: string;
}) {
  const options = question.options ?? [];
  return (
    <div className="options">
      <p>Tick the correct option{question.type === "multi" ? "s" : ""}.</p>
      {options.map((option) => (
        <div key={option.id} className="option-row">
          <input
            type={question.type === "multi" ? "checkbox" : "radio"}
            name={radioName}
            checked={question.correct.includes(option.id)}
            onChange={() => {
              const correct =
                question.type === "single"
                  ? [option.id]
                  : question.correct.includes(option.id)
                    ? question.correct.filter((id) => id !== option.id)
                    : [...question.correct, option.id];
              onChange({ ...question, correct });
            }}
            aria-label={`Correct ${option.id}`}
          />
          <span className="opt-id">{option.id}</span>
          <input
            value={option.text}
            aria-label={`Option ${option.id}`}
            onChange={(event) =>
              onChange({
                ...question,
                options: options.map((item) => (item.id === option.id ? { ...item, text: event.target.value } : item)),
              })
            }
          />
          <button
            type="button"
            disabled={options.length <= 2}
            onClick={() => {
              const nextOptions = options.filter((item) => item.id !== option.id);
              onChange({ ...question, options: nextOptions, correct: question.correct.filter((id) => id !== option.id) });
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...question,
            options: [...options, { id: nextOptionId(options.map((option) => option.id)), text: "" }],
          })
        }
      >
        Add option
      </button>
    </div>
  );
}

function TextKey({ question, onChange }: { question: Question; onChange: (question: Question) => void }) {
  const answers = question.correct.length ? question.correct : [""];
  return (
    <div className="options">
      <label>
        How to mark text
        <select
          value={question.textMatch ?? "exact"}
          onChange={(event) => onChange({ ...question, textMatch: event.target.value as TextMatch })}
        >
          <option value="exact">Exact match</option>
          <option value="caseInsensitive">Ignore case</option>
          <option value="numericTolerance">Number with tolerance</option>
        </select>
      </label>
      {(question.textMatch ?? "exact") === "numericTolerance" && (
        <label>
          Tolerance
          <input
            type="number"
            min={0}
            step="0.001"
            value={question.tolerance ?? 0}
            onChange={(event) => onChange({ ...question, tolerance: Number(event.target.value) })}
          />
        </label>
      )}
      <p>Accepted answers. Any one match scores full marks.</p>
      {answers.map((answer, index) => (
        <div key={index} className="option-row">
          <input
            value={answer}
            aria-label={`Accepted answer ${index + 1}`}
            onChange={(event) => {
              const correct = answers.slice();
              correct[index] = event.target.value;
              onChange({ ...question, correct });
            }}
          />
          <button
            type="button"
            disabled={answers.length <= 1}
            onClick={() => onChange({ ...question, correct: answers.filter((_, item) => item !== index) })}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...question, correct: [...answers, ""] })}>
        Add accepted answer
      </button>
    </div>
  );
}

function ImageFields({ question, onChange }: { question: Question; onChange: (question: Question) => void }) {
  const images = question.images ?? [];
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  function setImages(next: QuestionImage[]) {
    onChange({ ...question, images: next.length ? next : undefined });
  }

  return (
    <div className="image-editor">
      <p>Figures</p>
      <QuestionImages images={images} compact />
      {images.map((image, index) => (
        <div key={`${index}-${image.src.slice(0, 24)}`} className="image-row">
          <img src={image.src} alt="" />
          <input
            value={image.alt ?? ""}
            placeholder="Caption"
            aria-label={`Caption for figure ${index + 1}`}
            onChange={(event) => {
              const next = images.slice();
              const alt = event.target.value;
              next[index] = alt.trim() ? { src: image.src, alt } : { src: image.src };
              setImages(next);
            }}
          />
          <button type="button" disabled={index === 0} onClick={() => setImages(moveItem(images, index, -1))}>Up</button>
          <button type="button" disabled={index === images.length - 1} onClick={() => setImages(moveItem(images, index, 1))}>Down</button>
          <button type="button" onClick={() => setImages(images.filter((_, item) => item !== index))}>Remove</button>
        </div>
      ))}
      <div className="url-row">
        <input
          value={url}
          placeholder="https://example.com/figure.png"
          aria-label="Image URL"
          onChange={(event) => setUrl(event.target.value)}
        />
        <input
          value={caption}
          placeholder="Caption"
          aria-label="Caption for the new image"
          onChange={(event) => setCaption(event.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            const src = url.trim();
            if (!src) return;
            const image: QuestionImage = caption.trim() ? { src, alt: caption.trim() } : { src };
            setImages([...images, image]);
            setUrl("");
            setCaption("");
            setError(null);
          }}
        >
          Add URL
        </button>
        <label className="file-btn">
          Upload images
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              if (!files.length) return;
              void Promise.all(files.map((file) => readImageFile(file)))
                .then((loaded) => {
                  setImages([...images, ...loaded]);
                  setError(null);
                })
                .catch((reason: unknown) => {
                  setError(reason instanceof Error ? reason.message : "Could not add the image.");
                });
            }}
          />
        </label>
      </div>
      {error && <p className="image-error">{error}</p>}
    </div>
  );
}
