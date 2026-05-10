import { useParams } from 'react-router-dom';

export function SchemaEditor() {
  const { id, schemaId } = useParams();
  return (
    <div className="flex items-center justify-center h-screen text-[var(--text-muted)] text-sm">
      SchemaEditor — project <code className="font-mono mx-1">{id}</code>/schema
      <code className="font-mono ml-1">{schemaId}</code>
    </div>
  );
}
