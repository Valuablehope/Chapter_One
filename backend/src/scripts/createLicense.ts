/**
 * CLI script to generate a Chapter One POS license via Convex.
 * Usage:
 *   npm run create-license
 *   npm run create-license -- --plan yearly --days 365 --name "Ali Talib" --email "ali@example.com" --company "Cubiq" --store "Main Store"
 */

import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag: string, fallback?: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const plan          = getArg('--plan',    'yearly');
const validityDays  = parseInt(getArg('--days', '365')!, 10);
const customerName  = getArg('--name');
const customerEmail = getArg('--email');
const companyName   = getArg('--company');
const storeName     = getArg('--store');
const createdBy     = getArg('--by', 'system-admin');

const CONVEX_MUTATION_URL = 'https://wonderful-spider-492.eu-west-1.convex.cloud/api/mutation';

// ── Validate ──────────────────────────────────────────────────────────────────
if (isNaN(validityDays) || validityDays < 1) {
  console.error('❌  --days must be a positive integer');
  process.exit(1);
}

// ── Call Convex ───────────────────────────────────────────────────────────────
async function main() {
  console.log('\n📋  Generating license:');
  console.log(`    plan:          ${plan}`);
  console.log(`    validityDays:  ${validityDays}`);
  if (customerName)  console.log(`    customerName:  ${customerName}`);
  if (customerEmail) console.log(`    customerEmail: ${customerEmail}`);
  if (companyName)   console.log(`    companyName:   ${companyName}`);
  if (storeName)     console.log(`    storeName:     ${storeName}`);
  console.log('');

  const endpoint = CONVEX_MUTATION_URL;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'generateLicense:generateLicense',
      args: {
        plan,
        validityDays,
        product:   'chapterone_pos',
        createdBy,
        ...(customerName  ? { customerName }  : {}),
        ...(customerEmail ? { customerEmail } : {}),
        ...(companyName   ? { companyName }   : {}),
        ...(storeName     ? { storeName }     : {}),
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  const body = await response.json() as any;

  if (body.status === 'error') {
    console.error('❌  Convex error:', body.errorMessage);
    process.exit(1);
  }

  const result = body.value;

  console.log('✅  License generated successfully!\n');
  console.log('╔══════════════════════════════════════════╗');
  console.log(`║  LICENSE KEY:   ${result.licenseKey.padEnd(26)}║`);
  console.log(`║  PREFIX:        ${result.licensePrefix.padEnd(26)}║`);
  console.log(`║  PLAN:          ${result.plan.padEnd(26)}║`);
  console.log(`║  VALIDITY:      ${String(result.validityDays + ' days').padEnd(26)}║`);
  console.log(`║  ISSUED AT:     ${new Date(result.issuedAt).toLocaleDateString().padEnd(26)}║`);
  console.log(`║  CONVEX ID:     ${result.licenseId.slice(0, 26)}║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('\n⚠️   This is the ONLY time the license key is shown.');
  console.log('    Copy it now — it cannot be recovered from Convex.\n');
}

main().catch((err) => {
  console.error('❌  Unexpected error:', err.message);
  process.exit(1);
});
