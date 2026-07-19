#!/usr/bin/env node
// CLI wrapper around checkTool.
//
//   node cli.mjs <check> <projectRoot> [--json]
//     check ∈ validate | security | privacy | policy | all
//
// Exits non-zero when a blocking finding is present.
import { checkTool } from './index.mjs';

const CATEGORY_MAP = {
  validate: ['validate'],
  security: ['security'],
  privacy: ['privacy'],
  policy: ['policy'],
  all: ['policy'],
};

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const positional = args.filter((a) => !a.startsWith('--'));
  const check = positional[0];
  const root = positional[1] || '.';
  const categories = CATEGORY_MAP[check];
  if (!categories) {
    console.error(`usage: cli.mjs <validate|security|privacy|policy|all> <projectRoot> [--json]`);
    process.exit(2);
  }

  const report = await checkTool(root, { categories });

  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    const label = `${check}: ${report.tool}`;
    if (report.findings.length === 0) {
      console.log(`✓ ${label} — no findings`);
    } else {
      console.log(`${report.ok ? '⚠' : '✗'} ${label} — ${report.errorCount} error(s), ${report.warningCount} warning(s)`);
      for (const f of report.findings) {
        const mark = f.severity === 'error' ? '✗' : f.severity === 'warning' ? '⚠' : 'ℹ';
        console.log(`  ${mark} [${f.code}] ${f.file}: ${f.message}`);
      }
    }
  }
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => { console.error('validation cli:', err.message); process.exit(2); });
