#!/usr/bin/env node
// Repository guards, run in CI (.github/workflows/ci.yml, job `build`) and
// locally with `pnpm guards`. Each guard prints a read-proof (how many files
// it read) and its findings as `file:line rule`, never the matched text.
//
//   test discovery    every tracked unit test runs (scripts/run-unit-tests.mjs)
//   licence (R86)     removed non-commercial symbol library; vendored set licences
//   llm egress (R88)  model-vendor hosts, SDK imports, vendor API-key variables
//   hygiene           private addresses, cluster DNS, operator SSH host,
//                     tunnel ids, staff addresses
//
// Exit 1 when any guard finds something or reads too little to be credible.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hygieneHits } from './hygiene.mjs';
import { checkVendoredSymbolSets, licenceHits } from './licence.mjs';
import { REPO_ROOT, readText, trackedFiles } from './lib.mjs';
import { llmEgressHits } from './llm-egress.mjs';
import { checkTestDiscovery } from './test-discovery.mjs';

const MIN_FILES = 500; // read-proof: the repo tracks thousands of files

function report(name, read, findings) {
  const status = findings.length === 0 ? 'OK  ' : 'FAIL';
  console.log(`${status} ${name}: read=${read} findings=${findings.length}`);
  for (const f of findings) console.log(`     ${f}`);
  return findings.length === 0;
}

function main() {
  const files = trackedFiles();
  let ok = true;

  const discovery = checkTestDiscovery(files);
  console.log(
    `     test discovery: before-discovery lists=${discovery.baseline} discovered=${discovery.discovered} tracked=${discovery.tracked}`,
  );
  ok = report('test discovery', discovery.tracked, discovery.problems) && ok;

  const licence = [];
  const egress = [];
  const hygiene = [];
  let textFiles = 0;
  for (const rel of files) {
    const text = readText(rel);
    if (text != null) textFiles += 1;
    for (const h of licenceHits(rel, text)) licence.push(`${rel}:${h.line} ${h.rule}`);
    for (const h of llmEgressHits(rel, text)) egress.push(`${rel}:${h.line} ${h.rule}`);
    for (const h of hygieneHits(rel, text)) hygiene.push(`${rel}:${h.line} ${h.rule}`);
  }
  if (files.length < MIN_FILES) {
    console.log(`FAIL read-proof: only ${files.length} tracked files listed (expected >= ${MIN_FILES})`);
    ok = false;
  }

  let notice = '';
  try {
    notice = readFileSync(path.join(REPO_ROOT, 'NOTICE'), 'utf8');
  } catch {
    licence.push('NOTICE: missing');
  }
  const sets = checkVendoredSymbolSets(files, notice);
  console.log(`     vendored symbol sets: ${sets.sets.length ? sets.sets.join(', ') : 'none'}`);
  licence.push(...sets.problems);

  console.log(`     tracked files=${files.length} text files read=${textFiles}`);
  ok = report('licence (R86)', textFiles, licence) && ok;
  ok = report('llm egress (R88)', textFiles, egress) && ok;
  ok = report('public-repo hygiene', textFiles, hygiene) && ok;

  if (!ok) {
    console.log('\nSee AGENTS.md "Guards" for what each rule protects and how to allowlist a file.');
    process.exit(1);
  }
}

main();
