#!/usr/bin/env node
/**
 * Reader for probe_en-send-bytes-2026-09-28.html — turns a DELIVERED payload
 * into verdicts. Never judge this probe from the render; judge the source.
 *
 * Usage (from the repo root):
 *   node archive/probes/probe_en-send-bytes-2026-09-28.read.mjs <delivered> [--path paste|block]
 *   node archive/probes/probe_en-send-bytes-2026-09-28.read.mjs --measures <got.json> [--path paste|block]
 *   node archive/probes/probe_en-send-bytes-2026-09-28.read.mjs --print-measure
 *
 * <delivered> is either the HTML from EoA's delivered-source view
 * (/app/acidtest/display/email_html/<TEST_ID>) saved to a file, or the
 * received message source (.eml) — the text/html part is found and decoded
 * (quoted-printable or base64). --path says which send it was: `paste`
 * (Send A, the whole document; default) or `block` (Send B,
 * probe_en-send-bytes-2026-09-28.block-paste.html pasted into an EN Code/RAW
 * HTML block — the head is then the template's, so the head and CSS canaries
 * are skipped). The pasted file is read from beside this script and is the
 * reference for every "sent" figure.
 *
 * When the delivered bytes cannot leave the browser (EoA's view is behind a
 * sign-in; 2026-09-28 the built-in browser blocked a hand-off to localhost),
 * run `measure` INSIDE the EoA page instead: `--print-measure` prints its
 * exact source plus a hash of that source; paste it into the page, call
 * `await measure(await (await fetch(url)).text())`, compare the returned
 * `sourceSha` with the printed one (proof the pasted copy is exact), save
 * the JSON and feed it back with `--measures`. `measure` is self-contained
 * and returns only numbers, booleans, short codes and short hashes — nothing
 * that could be mistyped on the way back without it showing.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every delivered-side fact the verdicts need, from one HTML string. Runs
 * unchanged in Node and in a browser page. Keep it self-contained: its own
 * source text is hashed to prove a pasted copy is exact.
 */
async function measure(h) {
  const enc = new TextEncoder();
  const bytes = (s) => enc.encode(s).length;
  const sha = async (s) =>
    s == null
      ? null
      : [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))]
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
          .slice(0, 16);
  // Comments end where an HTML tokenizer ends them (as in compact.ts)
  const COMMENT_RE = /<!--(?:>|->|[\s\S]*?--!?>)/g;
  const isConditional = (c) => /^<!--\s*(?:\[if|<!\[endif)/i.test(c);
  const headOf = (x) => x.slice(0, Math.max(0, x.search(/<\/head\s*>/i)));
  const bodyOf = (x) => x.slice(Math.max(0, x.search(/<body\b/i)));
  const span = (x, a, b) => {
    const s = x.indexOf(a);
    const e = x.indexOf(b, s + 1);
    return s === -1 || e === -1 ? null : x.slice(s, e + b.length);
  };
  const lineOf = (x, token) => {
    const i = x.indexOf(token);
    if (i === -1) return null;
    const s = x.lastIndexOf('\n', i) + 1;
    const e = x.indexOf('\n', i);
    return x.slice(s, e === -1 ? x.length : e);
  };
  // White space as a run-length code: 17 spaces -> "17s", 3 tabs -> "3t", none -> ""
  const code = (ws) => (ws.match(/ +|\t+|[^ \t]+/g) ?? []).map((r) => (r[0] === ' ' ? `${r.length}s` : r[0] === '\t' ? `${r.length}t` : `${r.length}?`)).join('');
  const body = bodyOf(h);
  // C7's attribute text is not a comment (that is what C7 tests) — never count it
  const prose = (body.split('title="PROBE-C7 <!-- not a comment -->"').join('').match(COMMENT_RE) ?? []).filter((c) => !isConditional(c));
  const styles = [...headOf(h).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const w1 = lineOf(h, 'PROBE-W1');
  const w2 = lineOf(h, 'PROBE-W2');
  const w3 = lineOf(h, 'PROBE-W3');
  const w4 = span(h, 'PROBE-W4-A', 'PROBE-W4-B');
  const w6 = lineOf(h, 'PROBE-W6 ');
  const r1 = span(h, 'PROBE-R1-BEGIN', 'PROBE-R1-END');
  const r2 = span(h, 'PROBE-R2-BEGIN', 'PROBE-R2-END');
  return {
    sourceSha: await sha(measure.toString()),
    bytes: bytes(h),
    lspaceTds: (h.match(/<td\b[^>]*style="[^"]*mso-table-lspace/gi) ?? []).length,
    has: Object.fromEntries(
      [
        'PROBE-W1', 'PROBE-H1', 'PROBE-C1', 'PROBE-C2', 'PROBE-C3', 'START: PROBE-C4', 'END: PROBE-C4',
        'PROBE-C5', '<!--[if !mso]><!--><span>PROBE-C6', 'PROBE-C6',
        'title="PROBE-C7 <!-- not a comment -->"', 'PROBE-C7',
        '<span>PROBE-W5-A</span><span>PROBE-W5-B</span>', 'one  two   three',
      ].map((t) => [t, h.includes(t)]),
    ),
    c2Words: /alpha\s*beta/.test(h.replace(COMMENT_RE, '')),
    c3Sha: await sha((h.match(/<!--\s*PROBE-C3[\s\S]*?-->/) ?? [null])[0]),
    c3Bytes: bytes((h.match(/<!--\s*PROBE-C3[\s\S]*?-->/) ?? [''])[0]),
    c5Sha: await sha((h.match(/<!--\[if mso \| IE\]><span>PROBE-C5[\s\S]*?<!\[endif\]-->/) ?? [null])[0]),
    w1Lead: w1 == null ? null : code(/^[ \t]*/.exec(w1)[0]),
    w2Lead: w2 == null ? null : code(/^[ \t]*/.exec(w2)[0]),
    w3Trail: w3 == null ? null : code(/[ \t]*$/.exec(w3)[0]),
    w4Blanks: w4 == null ? null : (w4.match(/\n[ \t]*(?=\n)/g) ?? []).length,
    w6OneLine: w6 == null ? null : w6.includes('PROBE-W6-END'),
    longestLine: Math.max(...h.split('\n').map(bytes)),
    headCssComments: styles.map((s) => (s.match(/\/\*[\s\S]*?\*\//g) ?? []).length).reduce((a, b) => a + b, 0),
    headHas: {
      'footer-cta': /footer-cta/.test(headOf(h)),
      'inset-gutter': /inset-gutter/.test(headOf(h)),
      'social-link': /social-link/.test(headOf(h)),
    },
    bodyProse: prose.length,
    bodyProseBytes: prose.reduce((n, c) => n + bytes(c), 0),
    bodyIndentBytes: (body.match(/^[ \t]+/gm) ?? []).reduce((n, s) => n + s.length, 0),
    r1Bytes: r1 == null ? null : bytes(r1),
    r2Bytes: r2 == null ? null : bytes(r2),
  };
}

/** The text/html part of a message source, decoded; plain HTML passes through */
function htmlOf(raw) {
  const text = raw.replace(/\r\n/g, '\n');
  if (/^\s*(<!doctype|<html)/i.test(text)) return text;
  const at = text.search(/^Content-Type:\s*text\/html/im);
  if (at === -1) return text;
  const headersEnd = text.indexOf('\n\n', at);
  const headers = text.slice(at, headersEnd);
  const rest = text.slice(headersEnd + 2);
  const boundary = rest.search(/\n--[^\s]+(?:--)?\n/);
  const bodyText = boundary === -1 ? rest : rest.slice(0, boundary);
  const enc = (/Content-Transfer-Encoding:\s*([\w-]+)/i.exec(headers)?.[1] ?? '').toLowerCase();
  if (enc === 'base64') return Buffer.from(bodyText.replace(/\s+/g, ''), 'base64').toString('utf8');
  if (enc === 'quoted-printable') {
    const latin = bodyText.replace(/=\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    return Buffer.from(latin, 'latin1').toString('utf8');
  }
  return bodyText;
}

const fmt = (n) => n.toLocaleString('en-US');
const pct = (a, b) => (b ? `${((100 * (b - a)) / b).toFixed(1)}%` : 'n/a');
const describe = (c) =>
  c == null ? '?' : c === '' ? 'none' : c.replace(/(\d+)s/g, (_, n) => `${n} space${n > 1 ? 's' : ''} `).replace(/(\d+)t/g, (_, n) => `${n} tab${n > 1 ? 's' : ''} `).trim();

/** Verdicts from two measures: what was pasted (S) and what was delivered (G) */
function report(S, G, path, label) {
  const out = [];
  const say = (s = '') => out.push(s);
  const rows = [];
  const row = (id, what, verdict, detail = '') => rows.push([id, what, verdict, detail]);
  const throughEN = G.lspaceTds > S.lspaceTds;
  say(`EN send-bytes probe — reading ${label} (${path} path)`);
  say(`Went through EN's inliner: ${throughEN ? 'YES' : 'NO'} (${G.lspaceTds} tds carry an inlined mso-table-lspace; the paste had ${S.lspaceTds})`);
  if (!throughEN) say('  STOP: no inliner fingerprint — this payload bypassed EN and proves nothing (guide §8 6g).');
  if (!G.has['PROBE-W1']) {
    say('  STOP: no probe canary in this file — wrong message, or the HTML part was not found.');
    return { text: out.join('\n'), ok: false };
  }

  if (path === 'paste') row('H1', 'head prose comment', G.has['PROBE-H1'] ? 'KEPT' : 'STRIPPED');
  row('C1', 'own-line body comment', G.has['PROBE-C1'] ? 'KEPT' : 'STRIPPED');
  row('C2', 'inline comment between words', G.has['PROBE-C2'] ? 'KEPT' : 'STRIPPED', G.c2Words ? 'words still render "alphabeta"' : 'the words themselves changed');
  row('C3', 'multi-line prose comment', G.c3Sha && G.c3Sha === S.c3Sha ? 'KEPT verbatim' : G.has['PROBE-C3'] ? 'KEPT, altered' : 'STRIPPED', `${fmt(S.c3Bytes)} bytes pasted`);
  row('C4', 'START/END marker pair', G.has['START: PROBE-C4'] && G.has['END: PROBE-C4'] ? 'KEPT' : 'STRIPPED');
  row('C5', 'hidden conditional [if mso]', G.c5Sha && G.c5Sha === S.c5Sha ? 'KEPT verbatim' : G.has['PROBE-C5'] ? 'KEPT, altered' : 'STRIPPED');
  row('C6', 'revealed conditional [if !mso]', G.has['<!--[if !mso]><!--><span>PROBE-C6'] ? 'KEPT verbatim' : G.has['PROBE-C6'] ? 'content kept, wrapper altered' : 'STRIPPED');
  row('C7', '"<!--" inside an attribute value', G.has['title="PROBE-C7 <!-- not a comment -->"'] ? 'KEPT verbatim' : G.has['PROBE-C7'] ? 'KEPT, escaped/altered' : 'STRIPPED');

  const ws = (id, what, want, got) => row(id, what, got === want ? 'KEPT' : got === '' ? 'STRIPPED' : 'CHANGED', `delivered: ${describe(got)}`);
  ws('W1', 'indent: 17 spaces', S.w1Lead, G.w1Lead);
  ws('W2', 'indent: 3 tabs', S.w2Lead, G.w2Lead);
  ws('W3', 'trailing: 3 spaces', S.w3Trail, G.w3Trail);
  row('W4', 'blank lines: 4', G.w4Blanks === S.w4Blanks ? 'KEPT' : G.w4Blanks === 0 ? 'STRIPPED' : 'CHANGED', `delivered: ${G.w4Blanks ?? '?'} blank line(s)`);
  const w5 = G.has['<span>PROBE-W5-A</span><span>PROBE-W5-B</span>'];
  row('W5', 'two tags, one line, no gap', w5 ? 'KEPT' : 'REFLOWED', w5 ? '' : 'EN re-serialises markup onto its own lines');
  row('W6', 'one 1,1xx-byte line', G.w6OneLine ? 'ONE LINE' : 'WRAPPED', `longest delivered line: ${fmt(G.longestLine)} bytes`);
  row('W7', 'runs of spaces inside text', G.has['one  two   three'] ? 'KEPT' : 'COLLAPSED');

  if (path === 'paste') {
    row('S1', 'CSS comments in head <style>', G.headCssComments === 0 ? 'STRIPPED' : 'KEPT', `${S.headCssComments} pasted -> ${G.headCssComments} delivered`);
    row('S2', '.footer-cta a (plain rule, matches nothing)', G.headHas['footer-cta'] ? 'KEPT' : 'PRUNED', 'removed from styles.css 2026-09-27');
    row('S3', '.inset-gutter … (inside @media max-width)', G.headHas['inset-gutter'] ? 'KEPT' : 'PRUNED', 'removed from styles.css 2026-09-27');
    row('S4', '.social-link table (inside dark @media ×2)', G.headHas['social-link'] ? 'KEPT' : 'PRUNED', 'removed from styles.css 2026-09-27');
  }

  say('');
  for (const [id, what, verdict, detail] of rows) say(`${id.padEnd(4)}${what.padEnd(44)}${verdict.padEnd(16)}${detail}`);
  say('');
  say(`Body prose comments: ${S.bodyProse} pasted (${fmt(S.bodyProseBytes)} B) -> ${G.bodyProse} delivered (${fmt(G.bodyProseBytes)} B)`);
  say(`Body line indentation: ${fmt(S.bodyIndentBytes)} B pasted -> ${fmt(G.bodyIndentBytes)} B delivered`);
  say(`Whole message: ${fmt(S.bytes)} B pasted -> ${fmt(G.bytes)} B delivered (EN adds its own preheader, tracking and inlined styles)`);
  if (S.r1Bytes && S.r2Bytes && G.r1Bytes && G.r2Bytes) {
    say('');
    say('Real block, Signature Card (photo):');
    say(`  R1 before compaction  ${fmt(S.r1Bytes).padStart(7)} B pasted -> ${fmt(G.r1Bytes).padStart(7)} B delivered`);
    say(`  R2 after compaction   ${fmt(S.r2Bytes).padStart(7)} B pasted -> ${fmt(G.r2Bytes).padStart(7)} B delivered`);
    say(`  Saving that reached the inbox: ${fmt(G.r1Bytes - G.r2Bytes)} B (${pct(G.r2Bytes, G.r1Bytes)} of the delivered block); pasted saving was ${fmt(S.r1Bytes - S.r2Bytes)} B (${pct(S.r2Bytes, S.r1Bytes)})`);
  } else {
    say('R1/R2 band labels not both found — the block comparison cannot be read from this payload.');
  }

  const kept = (id) => rows.find((x) => x[0] === id)?.[2].startsWith('KEPT');
  say('');
  if (!throughEN) {
    say('VERDICT withheld: this payload never passed through EN (see STOP above).');
    return { text: out.join('\n'), ok: false };
  }
  say('VERDICT');
  say(`  HTML comments: EN ${kept('C1') && kept('C3') ? 'DELIVERS them — stripping them at import is a real inbox saving' : 'STRIPS them — the comment half of the compaction only shrinks what EN stores'}.`);
  const wsKept = kept('W1') && kept('W2');
  const wsGone = rows.find((x) => x[0] === 'W1')[2] === 'STRIPPED';
  say(`  Indentation: EN ${wsKept ? 'DELIVERS it — stripping it at import is a real inbox saving' : wsGone ? 'STRIPS it — the white-space half of the compaction only shrinks what EN stores' : 'CHANGES it (re-indents) — compare the R1/R2 delivered bytes above for the real effect'}.`);
  return { text: out.join('\n'), ok: true };
}

// ---- command line ----
const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f) => args.indexOf(f);
const valueOf = (f) => (flag(f) === -1 ? undefined : args[flag(f) + 1]);
const path = valueOf('--path') === 'block' ? 'block' : 'paste';

if (flag('--print-measure') !== -1) {
  const src = measure.toString();
  const enc = new TextEncoder();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(src)))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  console.log(`// measure() source sha: ${digest}\n${src}`);
  process.exit(0);
}

const sentM = await measure(readFileSync(join(HERE, 'probe_en-send-bytes-2026-09-28.html'), 'utf8'));
let gotM;
let label;
if (valueOf('--measures')) {
  label = valueOf('--measures');
  gotM = JSON.parse(readFileSync(label, 'utf8'));
  if (gotM.sourceSha !== sentM.sourceSha) {
    console.error(`measure() source mismatch: the JSON was produced by a different copy (${gotM.sourceSha} vs ${sentM.sourceSha}). Re-run --print-measure and paste it again.`);
    process.exit(2);
  }
} else {
  label = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--path');
  if (!label) {
    console.error('usage: node archive/probes/probe_en-send-bytes-2026-09-28.read.mjs <delivered.html|.eml> [--path paste|block]');
    process.exit(2);
  }
  gotM = await measure(htmlOf(readFileSync(label, 'utf8')));
}
const { text, ok } = report(sentM, gotM, path, label);
console.log(text);
process.exit(ok ? 0 : 1);
