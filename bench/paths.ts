import { relative } from 'node:path';

/**
 * Display form for a filesystem path.
 *
 * The bench report is a judge-facing artefact that gets pasted into DEMO.md, so it
 * must never print an absolute path: `/Users/<someone>/…/build` leaks both a username
 * and the private directory layout above the repo. Anything inside the working
 * directory is shown relative to it; anything outside is shown as-is, because at that
 * point the location genuinely is the information.
 */
export function displayPath(path: string, cwd: string = process.cwd()): string {
  const rel = relative(cwd, path);
  if (rel === '') return '.';
  return rel.startsWith('..') ? path : rel;
}
