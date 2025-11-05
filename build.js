#!/usr/bin/env node

/**
 * Simple build script using package APIs directly (no npx)
 * Minifies JS and CSS, then copies everything to dist/
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  statSync,
  rmSync,
} from "fs";
import { join, dirname, extname, relative } from "path";
import { fileURLToPath } from "url";
import { minify } from "terser";
import CleanCSS from "clean-css";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = __dirname;
const distDir = join(rootDir, "dist");

// Configuration
const EXCLUDED_DIRS = ["node_modules", "dist", ".git", "spec", ".github"];

const EXCLUDED_FILES = [
  "package.json",
  "package-lock.json",
  "vitest.config.js",
  "vite.config.js",
  "build.js",
];

const EXCLUDED_PATTERNS = [".test.js", ".md", ".DS_Store"];

// File processors
const processors = {
  async ".js"(srcPath, destPath) {
    const code = readFileSync(srcPath, "utf8");
    const result = await minify(code, { compress: true, mangle: true });
    writeFileSync(destPath, result.code);
    return "Minified JS";
  },

  async ".css"(srcPath, destPath) {
    const css = readFileSync(srcPath, "utf8");
    const minified = new CleanCSS({}).minify(css);
    if (minified.errors.length > 0) {
      console.warn(`⚠ CSS warnings for ${srcPath}:`, minified.errors);
    }
    writeFileSync(destPath, minified.styles);
    return "Minified CSS";
  },
};

// Helper functions
function shouldExclude(entry) {
  if (EXCLUDED_DIRS.includes(entry) || EXCLUDED_FILES.includes(entry)) {
    return true;
  }
  return EXCLUDED_PATTERNS.some((pattern) => entry.endsWith(pattern));
}

async function processFile(srcPath, destPath, ext) {
  mkdirSync(dirname(destPath), { recursive: true });

  const processor = processors[ext];
  if (!processor) {
    // Copy file as-is
    copyFileSync(srcPath, destPath);
    return `Copied ${relative(rootDir, destPath)} as-is`;
  }

  try {
    const action = await processor(srcPath, destPath);
    return action;
  } catch (error) {
    console.warn(
      `⚠ Could not process ${srcPath}, copying as-is:`,
      error.message
    );
    copyFileSync(srcPath, destPath);
    return "Copied (fallback)";
  } finally {
    console.log(`✓ Copied ${relative(rootDir, destPath)}`);
  }
}

async function processDir(src, dest) {
  const entries = readdirSync(src);

  for (const entry of entries) {
    if (shouldExclude(entry)) continue;

    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      await processDir(srcPath, destPath);
    } else {
      const ext = extname(entry).toLowerCase();
      const action = await processFile(srcPath, destPath, ext);
      console.log(`✓ ${action}: ${relative(rootDir, srcPath)}`);
    }
  }
}

// Main build function
async function build() {
  // Clean dist directory
  try {
    rmSync(distDir, { recursive: true, force: true });
  } catch {}
  mkdirSync(distDir, { recursive: true });

  console.log("🚀 Building...\n");
  await processDir(rootDir, distDir);
  console.log("\n✅ Build complete! Output in dist/");
}

// Run build
build().catch((error) => {
  console.error("❌ Build failed:", error);
  process.exit(1);
});
