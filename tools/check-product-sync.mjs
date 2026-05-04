#!/usr/bin/env node
// Validates PRODUCT.md ↔ inputs.yml alignment and checks for private tag leakage

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const errors = [];

const productPath = resolve(ROOT, "docs/PRODUCT.md");
const inputsPath = resolve(ROOT, "inputs.yml");

if (!existsSync(productPath)) {
  console.error("❌ docs/PRODUCT.md not found");
  process.exit(1);
}

if (!existsSync(inputsPath)) {
  console.error("❌ inputs.yml not found");
  process.exit(1);
}

const product = readFileSync(productPath, "utf-8");
const inputs = readFileSync(inputsPath, "utf-8");

const requiredSections = [
  { label: "App Name / App Identity", patterns: ["App Name", "App Identity"] },
  { label: "Purpose / Problem Statement", patterns: ["Purpose", "Problem Statement"] },
  { label: "Core Entities / Data Entities", patterns: ["Core Entities", "Data Entities", "Entities"] },
  { label: "User Roles / Roles", patterns: ["User Roles", "Roles"] },
  { label: "Tenancy", patterns: ["Tenancy"] },
  { label: "Environments", patterns: ["Environments"] },
  { label: "Data Sensitivity", patterns: ["Data Sensitivity"] },
  { label: "Main Workflows / Core User Flows", patterns: ["Main Workflows", "Core User Flows", "User Flows"] },
  { label: "Target Users", patterns: ["Target Users", "Users"] },
];

for (const { label, patterns } of requiredSections) {
  const found = patterns.some((p) => product.includes(p));
  if (!found) {
    errors.push(`PRODUCT.md missing required section: ${label}`);
  }
}

if (inputs.includes("slug:")) {
  const slugMatch = inputs.match(/slug:\s*["']?(\w+)/);
  if (slugMatch) {
    const slug = slugMatch[1];
    if (!product.toLowerCase().includes(slug.toLowerCase())) {
      errors.push(
        `inputs.yml slug "${slug}" not referenced anywhere in PRODUCT.md`
      );
    }
  }
}

const privateRegex = /<private>([\s\S]*?)<\/private>/g;
const privateBlocks = [];
let match;

while ((match = privateRegex.exec(product)) !== null) {
  const content = match[1].trim();
  if (content.length > 0) {
    const keywords = content
      .split(/\s+/)
      .filter((w) => w.length > 6)
      .slice(0, 10);
    privateBlocks.push(...keywords);
  }
}

if (privateBlocks.length > 0) {
  const governanceDocs = [
    "docs/CHANGELOG_AI.md",
    "docs/DECISIONS_LOG.md",
    "docs/IMPLEMENTATION_MAP.md",
    ".cline/memory/agent-log.md",
    ".cline/memory/lessons.md",
  ];

  for (const docPath of governanceDocs) {
    const fullPath = resolve(ROOT, docPath);
    if (!existsSync(fullPath)) continue;
    const docContent = readFileSync(fullPath, "utf-8");
    for (const keyword of privateBlocks) {
      if (docContent.includes(keyword)) {
        errors.push(
          `Private tag content leaked into ${docPath}: keyword "${keyword}" found`
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error("❌ PRODUCT.md sync check failed:");
  for (const err of errors) {
    console.error(`   - ${err}`);
  }
  process.exit(1);
}

console.log("✅ PRODUCT.md ↔ inputs.yml sync check passed");
