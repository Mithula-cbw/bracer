import { useParams } from 'react-router-dom';

export function ProjectView() {
  const { id } = useParams();
  return (
    <div className="flex items-center justify-center h-screen text-[var(--text-muted)] text-sm">
      ProjectView — project <code className="font-mono ml-1">{id}</code>
    </div>
  );
}
