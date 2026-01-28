#!/usr/bin/env node
'use strict';



// Das ist der Befehl um die eintraäge abzufrgen: 
// node src/scripts/ipc-audit.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

// Allowlist source of truth (main)
const ALLOWLIST_PATH = path.join(ROOT, 'src', 'main', 'ipc', 'ipc.allowlist.js');

function readAllowlist() {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const allow = require(ALLOWLIST_PATH);

  return {
    send: new Set(Array.isArray(allow.send) ? allow.send : []),
    invoke: new Set(Array.isArray(allow.invoke) ? allow.invoke : []),
    listen: new Set(Array.isArray(allow.listen) ? allow.listen : []),
    listenPrefixes: new Set(Array.isArray(allow.listenPrefixes) ? allow.listenPrefixes : []),
    dataSuffix: allow.allowDataEventsEndingWith || 'Data',
  };
}

function listFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (
  e.name === 'node_modules' ||
  e.name === 'dist' ||
  e.name === 'build' ||
  e.name === '.git' ||
  e.name === '.venv' ||
  e.name === 'venv' ||
  e.name === 'out' ||
  e.name === 'release' ||
  e.name === 'coverage'
) continue;

      listFiles(p, out);
    } else if (e.isFile()) {
      if (p.endsWith('.js') || p.endsWith('.cjs') || p.endsWith('.mjs')) out.push(p);
    }
  }
  return out;
}

function addMatches(set, text, re) {
  let m;
  while ((m = re.exec(text)) !== null) set.add(m[1]);
}

function main() {
  const allow = readAllowlist();

  // Scan entire project root (structure-proof)
// We already skip node_modules/dist/build/.git inside listFiles().
    const scanDirs = [ROOT];


  const files = scanDirs.flatMap(d => listFiles(d));

  const found = {
    rendererSend: new Set(),
    rendererInvoke: new Set(),
    rendererListen: new Set(),
  };

  // Direct ipcRenderer.* usage
  const reIpcSend = /\bipcRenderer\.send\(\s*['"]([^'"]+)['"]/g;
  const reIpcInvoke = /\bipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g;
  const reIpcListen = /\bipcRenderer\.(?:on|once)\(\s*['"]([^'"]+)['"]/g;

  // Your real contract: window.api.*
  const reApiSend = /\bwindow\.api\.send\(\s*['"]([^'"]+)['"]/g;
  const reApiInvoke = /\bwindow\.api\.invoke\(\s*['"]([^'"]+)['"]/g;
  const reApiListen = /\bwindow\.api\.(?:on|once|receive)\(\s*['"]([^'"]+)['"]/g;

  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');

    addMatches(found.rendererSend, txt, reIpcSend);
    addMatches(found.rendererSend, txt, reApiSend);

    addMatches(found.rendererInvoke, txt, reIpcInvoke);
    addMatches(found.rendererInvoke, txt, reApiInvoke);

    addMatches(found.rendererListen, txt, reIpcListen);
    addMatches(found.rendererListen, txt, reApiListen);
  }

  const missingSend = [...found.rendererSend].filter(ch => !allow.send.has(ch));
  const missingInvoke = [...found.rendererInvoke].filter(ch => !allow.invoke.has(ch));

  function coveredByPrefix(ch) {
    for (const p of allow.listenPrefixes) {
      if (typeof p === 'string' && p.length && ch.startsWith(p)) return true;
    }
    return false;
  }

  const missingListen = [...found.rendererListen].filter(ch => {
    if (allow.listen.has(ch)) return false;
    if (typeof ch === 'string' && ch.endsWith(allow.dataSuffix)) return false;
    if (coveredByPrefix(ch)) return false;
    return true;
  });

  const hasMissing = missingSend.length || missingInvoke.length || missingListen.length;

  console.log('--- IPC AUDIT ---');
  console.log('Allowlist:', path.relative(ROOT, ALLOWLIST_PATH));
  console.log('Scanned dirs:', scanDirs.map(d => path.relative(ROOT, d)).join(', '));
  console.log('Found renderer send:', found.rendererSend.size);
  console.log('Found renderer invoke:', found.rendererInvoke.size);
  console.log('Found renderer listen:', found.rendererListen.size);
  console.log('');

  if (missingSend.length) {
    console.log('MISSING allowlist.send:');
    missingSend.sort().forEach(ch => console.log('  -', ch));
    console.log('');
  }
  if (missingInvoke.length) {
    console.log('MISSING allowlist.invoke:');
    missingInvoke.sort().forEach(ch => console.log('  -', ch));
    console.log('');
  }
  if (missingListen.length) {
    console.log('MISSING allowlist.listen (or prefixes/suffix):');
    missingListen.sort().forEach(ch => console.log('  -', ch));
    console.log('');
  }

  if (!hasMissing) {
    console.log('OK: No missing allowlist entries detected.');
  } else {
    process.exitCode = 2;
  }
}

main();
