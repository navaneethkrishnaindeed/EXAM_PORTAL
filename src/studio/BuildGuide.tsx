import { useRef, useState } from "react";
import { BUILD_PROMPT } from "./buildPrompt";

const DOWNLOAD = "https://antigravity.google/download/";
const INSTALL = "https://antigravity.google/docs/cli/install/";
const START = "https://antigravity.google/docs/cli/getting-started";

export function BuildGuide() {
  const [copied, setCopied] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(BUILD_PROMPT);
      setCopied(true);
      setCopyNote(null);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      boxRef.current?.focus();
      boxRef.current?.select();
      setCopyNote("Clipboard is blocked. The prompt is selected — copy it with Ctrl+C.");
    }
  }

  return (
    <section className="guide">
      <h2>Turn a PDF, document, or photos into an exam</h2>
      <p>
        Use Antigravity CLI. Attach the paper there, paste the prompt below, then bring the JSON back to this studio.
        The prompt forces no negative marking: a wrong answer scores 0 and a blank scores 0.
      </p>
      <ol className="guide-steps">
        <li>
          Install Antigravity CLI. Use the{" "}
          <a href={DOWNLOAD} target="_blank" rel="noreferrer">download page</a>
          {" "}for the installer, the{" "}
          <a href={INSTALL} target="_blank" rel="noreferrer">installation and auth guide</a>
          {" "}for setup, and the{" "}
          <a href={START} target="_blank" rel="noreferrer">getting started guide</a>
          {" "}for the first session.
        </li>
        <li>
          On Windows PowerShell, install with{" "}
          <code>irm https://antigravity.google/cli/install.ps1 | iex</code>.
          Then open a new terminal. The command is <code>agy</code>.
        </li>
        <li>
          Put the PDF, document, or page photos in one folder. Open a terminal in that folder and run <code>agy</code>.
        </li>
        <li>
          Attach those files in the Antigravity session. Copy the prompt below, paste it, and send it.
        </li>
        <li>
          Copy only the JSON it returns. Open the JSON tab here, paste it, and click Apply JSON.
        </li>
        <li>Click Start test. The paper runs in this browser with the timer and the scorecard.</li>
      </ol>
      <div className="guide-bar">
        <h3>Prompt to paste into Antigravity CLI</h3>
        <button type="button" className="act save" onClick={() => void copyPrompt()}>
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>
      {copyNote && <p className="notice">{copyNote}</p>}
      <textarea
        ref={boxRef}
        className="prompt-box"
        readOnly
        spellCheck={false}
        value={BUILD_PROMPT}
        aria-label="Prompt for Antigravity CLI"
      />
    </section>
  );
}
