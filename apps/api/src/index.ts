import { buildServer } from "./server";

const port = Number(process.env.PORT ?? 4000);

const app = await buildServer();
await app.listen({ port, host: "0.0.0.0" });
