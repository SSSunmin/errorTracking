import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { buildDsn } from "@errortracking/shared";
import { db, pool } from "../db/client";
import { projects } from "../db/schema";

/** 로컬 테스트용 프로젝트 1개 생성 (이미 있으면 재사용) — DSN 출력 */
const NAME = "dev-test";

const existing = await db.query.projects.findFirst({
  where: eq(projects.name, NAME),
});

const project =
  existing ??
  (
    await db
      .insert(projects)
      .values({ name: NAME, publicKey: randomBytes(16).toString("hex") })
      .returning()
  )[0]!;

console.log(`project id:  ${project.id}`);
console.log(`public_key:  ${project.publicKey}`);
console.log(
  `DSN:         ${buildDsn({
    protocol: "http",
    publicKey: project.publicKey,
    host: `localhost:${process.env.PORT ?? 4000}`,
    projectId: String(project.id),
  })}`,
);

await pool.end();
