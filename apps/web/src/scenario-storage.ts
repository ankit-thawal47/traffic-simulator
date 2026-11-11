/**
 * The storage module (ADR 0001): every save and every load of a scenario in
 * the app goes through the ScenarioStorage interface below, and nothing else
 * in the app knows how a scenario is kept.
 *
 * v1 has no backend, so the one implementation keeps a scenario in a link
 * (in the fragment of the page's address) or in a file the browser downloads.
 * A backend can later implement the same interface (a link then being a
 * short address the server resolves) without the rest of the app changing;
 * that is why every method is asynchronous.
 *
 * The encoding and all checking of what is read live in the scenario package
 * (scenarioToLink, scenarioFromLink, scenarioToText, scenarioFromText), which
 * is pure and tested from the command line. This file adds only the browser.
 */
import {
  scenarioFromLink,
  scenarioFromText,
  scenarioToLink,
  scenarioToText,
  type Outcome,
  type Scenario,
} from "@traffic-simulator/scenario";

export interface ScenarioStorage {
  /** A link that opens the product with this scenario, or why there cannot be one. */
  shareLink(scenario: Scenario): Promise<Outcome<string>>;
  /** The scenario an address holds, or why it cannot be opened. Undefined when the address holds none. */
  openLink(address: string): Promise<Outcome<Scenario> | undefined>;
  /** Save the scenario to a file. Gives the file's name, or why it was not saved. */
  saveFile(scenario: Scenario): Promise<Outcome<string>>;
  /** The scenario a file holds, or why it cannot be opened. */
  openFile(file: Blob): Promise<Outcome<Scenario>>;
}

/** The two things the link-and-file storage needs from the browser. */
export interface BrowserForStorage {
  /** The address of the page the planner is on. */
  pageAddress(): string;
  /** Hand the planner a text file to keep. */
  download(fileName: string, text: string): void;
}

/** Files larger than this are refused before being read. Matches the limit on a scenario file's text. */
const LARGEST_FILE_BYTES = 5_000_000;

/** A file name from a scenario's name: lower-case letters and digits joined by hyphens. */
function fileNameFor(scenario: Scenario): string {
  const words = scenario.name.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return `${words.join("-").slice(0, 60) || "scenario"}.scenario.json`;
}

export function createLinkAndFileStorage(browser: BrowserForStorage): ScenarioStorage {
  return {
    async shareLink(scenario) {
      return scenarioToLink(scenario, browser.pageAddress());
    },
    async openLink(address) {
      return scenarioFromLink(address);
    },
    async saveFile(scenario) {
      const text = scenarioToText(scenario);
      if (!text.ok) return text;
      const fileName = fileNameFor(scenario);
      browser.download(fileName, text.value);
      return { ok: true, value: fileName };
    },
    async openFile(file) {
      if (file.size > LARGEST_FILE_BYTES) {
        return { ok: false, message: "This file cannot be opened. It is too large to be a scenario file." };
      }
      let text: string;
      try {
        text = await file.text();
      } catch {
        return { ok: false, message: "This file cannot be opened. The browser could not read it." };
      }
      return scenarioFromText(text);
    },
  };
}

/** The storage the app uses: links to this page, and files downloaded by this browser. */
export function createBrowserStorage(): ScenarioStorage {
  return createLinkAndFileStorage({
    pageAddress: () => window.location.href,
    download(fileName, text) {
      const address = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = address;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // The browser has taken the file by the time the click returns; release the memory shortly after.
      setTimeout(() => URL.revokeObjectURL(address), 1000);
    },
  });
}
