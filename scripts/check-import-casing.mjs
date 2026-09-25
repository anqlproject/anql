import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import process from "node:process";

const trackedFiles = execFileSync("git", ["ls-files", "-z", "--", "src"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const trackedByLowercase = new Map(
  trackedFiles.map((file) => [file.toLowerCase(), file]),
);
const extensions = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".scss",
  ".sass",
  ".json",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
];
const importPattern = /(?:import|export)\s+(?:[^'"`]*?\s+from\s+)?['"`]([^'"`]+)['"`]/g;
const sourceFiles = trackedFiles.filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
const errors = [];

for (const file of sourceFiles) {
  const source = execFileSync("git", ["show", `:${file}`], { encoding: "utf8" });
  let match;

  while ((match = importPattern.exec(source))) {
    const specifier = match[1];
    if (!specifier.startsWith("./") && !specifier.startsWith("../") && !specifier.startsWith("@/")) {
      continue;
    }

    const base = specifier.startsWith("@/")
      ? join("src", specifier.slice(2))
      : join(dirname(file), specifier);
    const candidates = extensions.map((extension) => `${base}${extension}`);
    const exactMatch = candidates.find((candidate) => trackedFiles.includes(candidate));
    if (exactMatch) continue;

    const caseInsensitiveMatch = candidates
      .map((candidate) => trackedByLowercase.get(candidate.toLowerCase()))
      .find(Boolean);

    errors.push(
      caseInsensitiveMatch
        ? `${file}: ${specifier} should match ${caseInsensitiveMatch}`
        : `${file}: ${specifier} does not resolve to a tracked file`,
    );
  }
}

if (errors.length > 0) {
  console.error("Import path validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Import path casing is consistent.");
