import React from 'react';
import './App.css';
import GitDiffViewer from './components/GitDiffViewer';

function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <GitDiffViewer />
    </div>
  );
}

export default App;
