/**
 * A scenario as text for a file, and as a link. Both are pure: text in, text
 * out, no browser. Everything read back goes through readScenario(), so a
 * damaged, truncated or unknown file or link gives a message and no scenario.
 *
 * What is saved is one scenario description (scenario.ts): the network as it
 * is today, the list of changes, the demand, lane discipline, the seed and a
 * name. It is the planner's whole comparison: the proposal is the description
 * as saved, and the baseline is the same description without its changes.
 *
 * A file is that description as indented JSON.
 *
 * A link carries it in the fragment of the page's address, which a browser
 * never sends to a server: `#scenario=d.<payload>`. The letter before the dot
 * names how the payload is encoded, so the encoding can change later while
 * old links keep opening. Encoding "d": the description as compact JSON in
 * UTF-8, compressed with raw DEFLATE, written in URL-safe base64.
 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import { readScenario, whyRefused, type Outcome } from "./read";
import type { Scenario } from "./scenario";

/**
 * The longest link the product makes, in characters, counting the page's own
 * address. Browsers accept far longer addresses, but chat and mail programs
 * cut or refuse to link long ones; about 2000 characters is the length that
 * survives being pasted nearly everywhere. A scenario that needs more is
 * saved as a file instead.
 */
export const LINK_LENGTH_LIMIT = 2000;

/** The largest text taken for a scenario file, in characters. Far above any real scenario. */
const FILE_LENGTH_LIMIT = 5_000_000;

const FRAGMENT_NAME = "scenario=";

function refused(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

/** Put what was being attempted in front of a reader's message. */
function prefixed<T>(prefix: string, outcome: Outcome<T>): Outcome<T> {
  return outcome.ok ? outcome : refused(`${prefix} ${outcome.message}`);
}

/**
 * The scenario as the text of a file. Refused, with the reason, for a
 * scenario the engine would not run, so that a file that cannot be opened
 * again is never written.
 */
export function scenarioToText(scenario: Scenario): Outcome<string> {
  const refusal = whyRefused(scenario);
  if (refusal) return refused(`This scenario cannot be saved. ${refusal}.`);
  return { ok: true, value: `${JSON.stringify(scenario, null, 2)}\n` };
}

/** The scenario a file's text holds, of any version, or why it cannot be opened. */
export function scenarioFromText(text: string): Outcome<Scenario> {
  const cannot = "This file cannot be opened.";
  if (text.length > FILE_LENGTH_LIMIT) return refused(`${cannot} It is too large to be a scenario file.`);
  if (text.trim() === "") return refused(`${cannot} It is empty.`);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return refused(`${cannot} It is not a scenario file, or it is damaged.`);
  }
  return prefixed(cannot, readScenario(value));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Undefined when the text is not URL-safe base64. */
function fromBase64Url(text: string): Uint8Array | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) return undefined;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
}

/** The payload of a link for any JSON-safe value, in encoding "d". */
export function linkPayload(value: unknown): string {
  return `d.${toBase64Url(deflateSync(strToU8(JSON.stringify(value)), { level: 9 }))}`;
}

/**
 * A link that opens the page with this scenario: the page's address, with the
 * scenario in its fragment. Refused, with the reason, for a scenario the
 * engine would not run, and for one too large for a link.
 */
export function scenarioToLink(scenario: Scenario, pageAddress: string): Outcome<string> {
  const refusal = whyRefused(scenario);
  if (refusal) return refused(`This scenario cannot be shared. ${refusal}.`);
  const page = pageAddress.split("#")[0]!;
  const link = `${page}#${FRAGMENT_NAME}${linkPayload(scenario)}`;
  if (link.length > LINK_LENGTH_LIMIT) {
    return refused(
      `This scenario is too large to share as a link (the link would be ${link.length} characters; ` +
        `the limit is ${LINK_LENGTH_LIMIT}). Save it as a file instead.`,
    );
  }
  return { ok: true, value: link };
}

/**
 * The scenario an address holds in its fragment, of any version, or why it
 * cannot be opened. Undefined when the address holds no scenario at all, as
 * when the page is opened plainly.
 */
export function scenarioFromLink(address: string): Outcome<Scenario> | undefined {
  const hash = address.indexOf("#");
  const fragment = hash === -1 ? "" : address.slice(hash + 1);
  if (!fragment.startsWith(FRAGMENT_NAME)) return undefined;

  const cannot = "This link cannot be opened.";
  const damaged = refused(`${cannot} It is damaged or cut short.`);
  const payload = fragment.slice(FRAGMENT_NAME.length);
  // A payload is bounded before it is decompressed, so a link cannot make the page unpack something huge.
  if (payload.length > LINK_LENGTH_LIMIT) return refused(`${cannot} It is longer than any link this product makes.`);
  if (payload === "") return damaged;
  const dot = payload.indexOf(".");
  if (dot === -1) return damaged;
  if (payload.slice(0, dot) !== "d") {
    return refused(
      `${cannot} It was made with a newer version of the product. Reload the page to get the latest version and open it again.`,
    );
  }
  const bytes = fromBase64Url(payload.slice(dot + 1));
  if (!bytes) return damaged;
  let value: unknown;
  try {
    value = JSON.parse(strFromU8(inflateSync(bytes)));
  } catch {
    return damaged;
  }
  return prefixed(cannot, readScenario(value));
}
