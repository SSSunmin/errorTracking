#!/usr/bin/env node
import { collectSourceMaps } from "./collect";
import { uploadSourceMaps } from "./upload";

interface Args {
  dsn?: string;
  secret?: string;
  release?: string;
  dist?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => argv[++i];
    if (a === "--dsn") args.dsn = next();
    else if (a === "--secret") args.secret = next();
    else if (a === "--release") args.release = next();
    else if (a === "--dist") args.dist = next();
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dsn = args.dsn ?? process.env.ERRTRACK_DSN;
  const secret = args.secret ?? process.env.ERRTRACK_SECRET;
  const release = args.release ?? process.env.ERRTRACK_RELEASE;
  const dist = args.dist ?? "dist";

  if (!dsn || !secret || !release) {
    console.error(
      "usage: errtrack-upload --dsn <dsn> --secret <key> --release <version> [--dist dist]",
    );
    console.error("  (또는 ERRTRACK_DSN / ERRTRACK_SECRET / ERRTRACK_RELEASE)");
    process.exit(1);
  }

  const files = collectSourceMaps(dist);
  if (files.length === 0) {
    console.error(`소스맵(.map)을 찾지 못함: ${dist}`);
    process.exit(1);
  }

  const results = await uploadSourceMaps({ dsn, secretKey: secret, release, files });
  const ok = results.filter((r) => r.ok).length;
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.name} (${r.status})`);
  }
  console.log(`업로드 완료: ${ok}/${results.length} (release ${release})`);
  if (ok < results.length) process.exit(1);
}

void main();
