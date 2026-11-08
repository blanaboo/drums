// Minimal browser test runner: register tests, run them (sync or async), print a summary into the page.

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message ? `${message}: ` : ''}expected ${e}, got ${a}`);
}

export function assertClose(actual, expected, tolerance, message = '') {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${message ? `${message}: ` : ''}expected ${expected} ± ${tolerance}, got ${actual}`);
  }
}

export async function run() {
  const out = document.getElementById('out');
  const summary = document.getElementById('summary');
  let passed = 0;
  const failures = [];
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      out.append(`✓ ${name}\n`);
    } catch (e) {
      failures.push(name);
      const line = document.createElement('span');
      line.className = 'fail';
      line.textContent = `✗ ${name}\n    ${e.message}\n`;
      out.append(line);
    }
  }
  const text = `${passed} bestanden, ${failures.length} fehlgeschlagen`;
  summary.textContent = text;
  summary.className = failures.length ? 'fail' : 'pass';
  document.title = failures.length ? `FAIL – ${text}` : `PASS – ${text}`;
  document.body.dataset.done = 'true';
}
