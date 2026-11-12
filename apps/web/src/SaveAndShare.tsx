/**
 * The planner's controls for keeping a scenario: copy a link to it, save it
 * to a file, open a file; and, when the page itself is opened from a link,
 * opening the scenario that link holds. Everything goes through the storage
 * module (scenario-storage.ts); this file knows nothing of how a scenario is
 * encoded.
 */
import type { Scenario } from "@traffic-simulator/scenario";
import { useEffect, useRef, useState } from "react";
import type { ScenarioStorage } from "./scenario-storage";
import "./save-and-share.css";

/** What the planner was last told. A problem is announced as an alert and stays until the next action. */
type Notice = { kind: "done" | "problem"; text: string };

export function SaveAndShare({
  scenario,
  storage,
  onOpen,
}: {
  /** The scenario as the planner sees it now: the proposal, which holds the baseline too. */
  scenario: Scenario;
  storage: ScenarioStorage;
  /** A scenario was opened from a link or a file and should replace the one shown. */
  onOpen: (scenario: Scenario) => void;
}) {
  const [notice, setNotice] = useState<Notice>();
  const [link, setLink] = useState<string>();
  const filePicker = useRef<HTMLInputElement>(null);
  const opened = useRef(onOpen);
  opened.current = onOpen;

  // The page's own address may hold a scenario: when the page is opened from a link, and whenever a link is
  // pasted into the address bar of a page that is already open.
  useEffect(() => {
    let current = true;
    const openFromAddress = async () => {
      const read = await storage.openLink(window.location.href);
      if (!current || !read) return;
      if (read.ok) {
        opened.current(read.value);
        setLink(undefined);
        setNotice({ kind: "done", text: `Opened the scenario "${read.value.name}" from the link.` });
        // The scenario shown may now be changed, so the address must not go on naming the one it was opened from.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } else {
        setNotice({ kind: "problem", text: `${read.message} The scenario shown is unchanged.` });
      }
    };
    void openFromAddress();
    window.addEventListener("hashchange", openFromAddress);
    return () => {
      current = false;
      window.removeEventListener("hashchange", openFromAddress);
    };
  }, [storage]);

  // A link shown for an earlier state of the scenario would open something else; take it away.
  useEffect(() => setLink(undefined), [scenario]);

  const copyLink = async () => {
    const shared = await storage.shareLink(scenario);
    if (!shared.ok) {
      setLink(undefined);
      setNotice({ kind: "problem", text: shared.message });
      return;
    }
    setLink(shared.value);
    const length = `It is ${shared.value.length} characters long.`;
    try {
      await navigator.clipboard.writeText(shared.value);
      setNotice({ kind: "done", text: `Link copied. ${length}` });
    } catch {
      // The browser may not let a page write to the clipboard; the link is shown to be copied by hand.
      setNotice({ kind: "done", text: `The browser did not allow copying. Copy the link below. ${length}` });
    }
  };

  const saveFile = async () => {
    const saved = await storage.saveFile(scenario);
    setNotice(saved.ok ? { kind: "done", text: `Saved to the file ${saved.value}.` } : { kind: "problem", text: saved.message });
  };

  const openFile = async (file: File) => {
    const read = await storage.openFile(file);
    if (read.ok) {
      opened.current(read.value);
      setLink(undefined);
      setNotice({ kind: "done", text: `Opened the scenario "${read.value.name}" from the file ${file.name}.` });
    } else {
      setNotice({ kind: "problem", text: `${read.message} The scenario shown is unchanged.` });
    }
  };

  return (
    <div className="save-and-share">
      <div className="save-and-share-actions">
        <button type="button" data-testid="copy-link" onClick={copyLink}>
          Copy link
        </button>
        <button type="button" data-testid="save-file" onClick={saveFile}>
          Save to file
        </button>
        <button type="button" data-testid="open-file" onClick={() => filePicker.current?.click()}>
          Open file…
        </button>
        <input
          ref={filePicker}
          data-testid="open-file-input"
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          aria-label="Scenario file to open"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clear the choice, so that choosing the same file again opens it again.
            event.target.value = "";
            if (file) void openFile(file);
          }}
        />
      </div>
      {link && (
        <input
          className="save-and-share-link"
          data-testid="scenario-link"
          aria-label="Link to this scenario"
          readOnly
          value={link}
          onFocus={(event) => event.target.select()}
        />
      )}
      {notice && (
        <p
          className={notice.kind === "problem" ? "save-and-share-problem" : "hint"}
          data-testid={notice.kind === "problem" ? "storage-problem" : "storage-done"}
          role={notice.kind === "problem" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      )}
      <p className="hint">
        The link and the file hold the baseline and the proposal with its changes. Nothing is sent anywhere, and no
        account is needed.
      </p>
    </div>
  );
}
