/**
 * Upgrade steps: one for every older version of the scenario description,
 * each turning that version into the next. A saved scenario of any older
 * version is brought to the current one by running the steps in turn, so old
 * links and files keep loading (ADR 0001).
 *
 * A step receives what was saved, unchecked, and must not assume it is well
 * formed: it only adds, renames or rewrites what changed between the two
 * versions. All checking happens afterwards, once, against the current
 * version (read.ts).
 *
 * To add version N+1: raise SCENARIO_FORMAT_VERSION, add step N here, and add
 * a saved example of version N to test/fixtures with a test in
 * test/older-versions.test.ts. Never edit an existing step or example.
 */
type Saved = Record<string, unknown>;

export const UPGRADE_STEPS: Record<number, (older: Saved) => Saved> = {
  // Version 1 had no lane discipline: every scenario ran as mixed traffic.
  1: (version1) => ({ ...version1, formatVersion: 2, laneDiscipline: false }),
};
