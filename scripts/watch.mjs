#!/usr/bin/env node
/**
 * Watch src/ and re-run the full build (annotate → mjml → assets) on change.
 * Replaces `mjml -w`, which can't see the .build/ annotation step.
 */
import { watch } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function build() {
  try {
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
  } catch {
    // build errors already printed; keep watching
  }
}

build();
let timer;
watch(join(root, 'src'), { recursive: true }, (event, file) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log(`\nchange: ${file} — rebuilding…`);
    build();
  }, 150);
});
console.log('\nwatching src/ for changes (Ctrl-C to stop)…');
