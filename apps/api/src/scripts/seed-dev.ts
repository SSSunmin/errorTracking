import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { buildDsn } from "@errortracking/shared";
import { db, pool } from "../db/client";
import { projects, users } from "../db/schema";
import { hashPassword } from "../lib/password";

/** 로컬 테스트용 프로젝트 + admin 유저 생성 (이미 있으면 재사용) */
const NAME = "dev-test";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "admin@local.dev").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234";

const existingAdmin = await db.query.users.findFirst({
  where: eq(users.email, ADMIN_EMAIL),
});
if (existingAdmin) {
  console.log(`admin:       ${ADMIN_EMAIL} (기존 유저, 비밀번호 변경 없음)`);
} else {
  await db.insert(users).values({
    email: ADMIN_EMAIL,
    passwordHash: await hashPassword(ADMIN_PASSWORD),
    name: "admin",
  });
  console.log(`admin:       ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

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
