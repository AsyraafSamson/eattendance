import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..');
const templatePath = path.join(appRoot, 'wrangler.template.jsonc');
const outputPath = path.join(appRoot, 'wrangler.jsonc');
const devVarsPath = path.join(appRoot, '.dev.vars');

function parseSimpleEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) return null;
        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
      .filter(Boolean)
  );
}

function readExistingDatabaseId() {
  if (!fs.existsSync(outputPath)) {
    return null;
  }

  const match = fs.readFileSync(outputPath, 'utf8').match(/"database_id"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

const envFileValues = parseSimpleEnvFile(devVarsPath);
const databaseId =
  process.env.D1_DATABASE_ID ||
  process.env.CF_D1_DATABASE_ID ||
  process.env.CLOUDFLARE_D1_DATABASE_ID ||
  envFileValues.D1_DATABASE_ID ||
  envFileValues.CF_D1_DATABASE_ID ||
  envFileValues.CLOUDFLARE_D1_DATABASE_ID ||
  readExistingDatabaseId();

if (!databaseId) {
  console.error(
    'Missing D1 database ID. Set D1_DATABASE_ID (or CF_D1_DATABASE_ID / CLOUDFLARE_D1_DATABASE_ID) in your shell or apps/api/.dev.vars before running Wrangler commands.'
  );
  process.exit(1);
}

const template = fs.readFileSync(templatePath, 'utf8');
const rendered = template.replace('__D1_DATABASE_ID__', databaseId);

fs.writeFileSync(outputPath, rendered);
console.log('Generated wrangler.jsonc from template.');
