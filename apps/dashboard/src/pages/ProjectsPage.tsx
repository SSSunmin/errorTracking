import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Project } from "../api/types";

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .listProjects()
      .then(setProjects)
      .catch(() => setError("프로젝트 목록을 불러오지 못했습니다"));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await api.createProject(name.trim());
      setProjects((prev) => [...(prev ?? []), created]);
      setName("");
    } catch {
      setError("프로젝트 생성에 실패했습니다");
    } finally {
      setCreating(false);
    }
  }

  if (error) return <div className="error-box">{error}</div>;
  if (!projects) return <div className="loading">불러오는 중...</div>;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">프로젝트</h1>
        <span className="page-sub">{projects.length}개</span>
      </div>

      <form className="project-create" onSubmit={onCreate}>
        <input
          type="text"
          placeholder="새 프로젝트 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" type="submit" disabled={creating || !name.trim()}>
          + 생성
        </button>
      </form>

      <div className="project-grid">
        {projects.map((p, i) => (
          <ProjectCard key={p.id} project={p} index={i} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const [copied, setCopied] = useState(false);

  async function copyDsn() {
    try {
      await navigator.clipboard.writeText(project.dsn);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard 권한 없으면 무시
    }
  }

  return (
    <div className="project-card" style={{ animationDelay: `${index * 60}ms` }}>
      <h3>
        <Link to={`/projects/${project.id}`}>{project.name}</Link>
      </h3>
      <span className="platform-chip">{project.platform}</span>
      <div className="dsn-row">
        <code title={project.dsn}>{project.dsn}</code>
        <button className={`copy-btn${copied ? " copied" : ""}`} onClick={copyDsn}>
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
    </div>
  );
}
