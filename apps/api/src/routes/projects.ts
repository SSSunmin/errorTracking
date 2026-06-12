import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { buildDsn } from "@errortracking/shared";
import { db } from "../db/client";
import { projects } from "../db/schema";
import { requireAuth } from "../lib/session";

type Project = typeof projects.$inferSelect;

/** DSN 표시용 — 운영에서는 PUBLIC_BASE_URL로 외부 노출 주소 고정 */
function toDsn(req: FastifyRequest, project: Project): string {
  const base =
    process.env.PUBLIC_BASE_URL ??
    `${req.protocol}://${req.headers.host ?? "localhost"}`;
  const url = new URL(base);
  return buildDsn({
    protocol: url.protocol === "https:" ? "https" : "http",
    publicKey: project.publicKey,
    host: url.host,
    projectId: String(project.id),
  });
}

function serialize(req: FastifyRequest, p: Project) {
  return {
    id: p.id,
    name: p.name,
    platform: p.platform,
    publicKey: p.publicKey,
    dsn: toDsn(req, p),
    createdAt: p.createdAt,
  };
}

export function registerProjectRoutes(app: FastifyInstance): void {
  app.get("/api/projects", { preHandler: requireAuth }, async (req, reply) => {
    const rows = await db.select().from(projects).orderBy(projects.id);
    return reply.send(rows.map((p) => serialize(req, p)));
  });

  app.post("/api/projects", { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as { name?: unknown; platform?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return reply.code(400).send({ error: "name required" });
    }
    const platform =
      typeof body?.platform === "string" && body.platform.trim()
        ? body.platform.trim()
        : "javascript";
    const [created] = await db
      .insert(projects)
      .values({ name, platform, publicKey: randomBytes(16).toString("hex") })
      .returning();
    return reply.code(201).send(serialize(req, created!));
  });

  app.get<{ Params: { id: string } }>(
    "/api/projects/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const project = await findProject(req.params.id);
      if (!project) return reply.code(404).send({ error: "unknown project" });
      return reply.send(serialize(req, project));
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/api/projects/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const project = await findProject(req.params.id);
      if (!project) return reply.code(404).send({ error: "unknown project" });
      const body = req.body as { name?: unknown; platform?: unknown } | null;
      const patch: Partial<Pick<Project, "name" | "platform">> = {};
      if (typeof body?.name === "string" && body.name.trim()) {
        patch.name = body.name.trim();
      }
      if (typeof body?.platform === "string" && body.platform.trim()) {
        patch.platform = body.platform.trim();
      }
      if (Object.keys(patch).length === 0) {
        return reply.code(400).send({ error: "nothing to update" });
      }
      const [updated] = await db
        .update(projects)
        .set(patch)
        .where(eq(projects.id, project.id))
        .returning();
      return reply.send(serialize(req, updated!));
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/projects/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const project = await findProject(req.params.id);
      if (!project) return reply.code(404).send({ error: "unknown project" });
      // FK cascade로 이슈/이벤트/릴리즈도 함께 삭제됨
      await db.delete(projects).where(eq(projects.id, project.id));
      return reply.send({ ok: true });
    },
  );
}

async function findProject(idParam: string): Promise<Project | undefined> {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return undefined;
  return db.query.projects.findFirst({ where: eq(projects.id, id) });
}
