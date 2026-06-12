/**
 * DSN 규칙: `{protocol}://{public_key}@{host}/{project_id}`
 * 예: https://abc123@errors.example.com/1
 */

export interface DsnComponents {
  protocol: "http" | "https";
  publicKey: string;
  /** host 또는 host:port */
  host: string;
  projectId: string;
}

const DSN_REGEX = /^(https?):\/\/([\w-]+)@([\w.-]+(?::\d+)?)\/(\d+)$/;

export function parseDsn(dsn: string): DsnComponents {
  const match = DSN_REGEX.exec(dsn.trim());
  if (!match) {
    throw new Error(
      "Invalid DSN: expected {protocol}://{public_key}@{host}/{project_id}",
    );
  }
  const [, protocol, publicKey, host, projectId] = match;
  return {
    protocol: protocol as DsnComponents["protocol"],
    publicKey: publicKey!,
    host: host!,
    projectId: projectId!,
  };
}

export function buildDsn(c: DsnComponents): string {
  return `${c.protocol}://${c.publicKey}@${c.host}/${c.projectId}`;
}

/** 이벤트 수집 엔드포인트 — POST /api/{project_id}/store/ */
export function storeEndpoint(c: DsnComponents): string {
  return `${c.protocol}://${c.host}/api/${c.projectId}/store/`;
}
