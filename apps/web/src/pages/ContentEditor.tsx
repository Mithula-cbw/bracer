import { useParams } from 'react-router-dom';

export function ContentEditor() {
  const { id, schemaId } = useParams();
  return (
    <div className="flex items-center justify-center h-screen text-[var(--text-muted)] text-sm">
      ContentEditor — project <code className="font-mono mx-1">{id}</code>/content
      <code className="font-mono ml-1">{schemaId}</code>
    </div>
  );
}
