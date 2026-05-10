import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './providers/ThemeProvider';
import { ProjectDashboard } from './pages/ProjectDashboard';
import { ProjectView } from './pages/ProjectView';
import { SchemaEditor } from './pages/SchemaEditor';
import { ContentEditor } from './pages/ContentEditor';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProjectDashboard />} />
          <Route path="/project/:id" element={<ProjectView />} />
          <Route path="/project/:id/schema/:schemaId" element={<SchemaEditor />} />
          <Route path="/project/:id/content/:schemaId" element={<ContentEditor />} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
