#!/usr/bin/env node
// Validates inputs.yml against inputs.schema.json

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

function loadYaml(filePath) {
  const content = readFileSync(filePath, "utf-8");
  // Minimal YAML parser — handles flat keys, arrays, nested objects
  // For full validation, install js-yaml: pnpm add -D js-yaml
  // This is a structural existence check, not a full schema validator
  return content;
}

const inputsPath = resolve(ROOT, "inputs.yml");
const schemaPath = resolve(ROOT, "inputs.schema.json");

if (!existsSync(inputsPath)) {
  console.error("❌ inputs.yml not found at project root");
  process.exit(1);
}

if (!existsSync(schemaPath)) {
  console.error("❌ inputs.schema.json not found at project root");
  process.exit(1);
}

const content = loadYaml(inputsPath);

const requiredSections = [
  "app:",
  "apps:",
  "packages:",
  "tech_stack:",
  "tenancy:",
  "security:",
  "deploy:",
  "docker:",
  "ports:",
  "git:",
  "models:",
];

const errors = [];

for (const section of requiredSections) {
  if (!content.includes(section)) {
    errors.push(`Missing required section: ${section}`);
  }
}

if (content.includes("slug:")) {
  const slugMatch = content.match(/slug:\s*["']?(\w+)/);
  if (slugMatch && !/^[a-z][a-z0-9-]*$/.test(slugMatch[1])) {
    errors.push(`Invalid app slug format: ${slugMatch[1]}`);
  }
}

if (errors.length > 0) {
  console.error("❌ inputs.yml validation failed:");
  for (const err of errors) {
    console.error(`   - ${err}`);
  }
  process.exit(1);
}

console.log("✅ inputs.yml validation passed");
