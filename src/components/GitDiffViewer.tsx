import React, { useState, useRef } from 'react';
import { toPng } from 'html-to-image';

// Define types for our diff data structures
interface DiffHunk {
  header: string;
  lines: string[];
}

interface DiffFile {
  header: string;
  path: string;
  hunks: DiffHunk[];
}

const GitDiffViewer: React.FC = () => {
  const [diffText, setDiffText] = useState<string>('');
  const [parsedDiff, setParsedDiff] = useState<DiffFile[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const diffContainerRef = useRef<HTMLDivElement>(null);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target && e.target.result) {
        const text = e.target.result as string;
        setDiffText(text);
        parseDiff(text);
      }
    };
    reader.readAsText(file);
  };

  // Parse the diff text
  const parseDiff = (text: string) => {
    const lines = text.split('\n');
    const diffFiles: DiffFile[] = [];

    let currentFile: DiffFile | null = null;
    let currentHunk: DiffHunk | null = null;

    lines.forEach((line) => {
      // New file
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          diffFiles.push(currentFile);
        }
        currentFile = {
          header: line,
          path: extractFilePath(line),
          hunks: []
        };
      }
      // File metadata
      else if (line.startsWith('---') || line.startsWith('+++')) {
        if (currentFile) {
          currentFile.header += '\n' + line;
        }
      }
      // Hunk header
      else if (line.startsWith('@@')) {
        if (currentFile) {
          currentHunk = {
            header: line,
            lines: []
          };
          currentFile.hunks.push(currentHunk);
        }
      }
      // Content lines
      else {
        if (currentHunk) {
          currentHunk.lines.push(line);
        }
      }
    });

    // Add the last file
    if (currentFile) {
      diffFiles.push(currentFile);
    }

    setParsedDiff(diffFiles);
  };

  // Extract file path from diff --git line
  const extractFilePath = (line: string): string => {
    const match = line.match(/diff --git a\/(.*) b\/(.*)/);
    return match ? match[2] : 'unknown';
  };

  // Determine line background color based on content and theme
  const getLineColor = (line: string): string => {
    if (line.startsWith('+')) return darkMode ? 'bg-green-900' : 'bg-green-100';
    if (line.startsWith('-')) return darkMode ? 'bg-red-900' : 'bg-red-100';
    return '';
  };

  // Determine line number display
  const getLinePrefix = (line: string): string => {
    if (line.startsWith('+')) return '+';
    if (line.startsWith('-')) return '-';
    return ' ';
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target && e.target.result) {
        const text = e.target.result as string;
        setDiffText(text);
        parseDiff(text);
      }
    };
    reader.readAsText(file);
  };

  // Function to download the diff as an image using html-to-image
  const downloadAsImage = async () => {
    if (!diffContainerRef.current) return;

    try {
      const dataUrl = await toPng(diffContainerRef.current, {
        backgroundColor: darkMode ? '#1e293b' : '#ffffff',
        quality: 1
      });

      const link = document.createElement('a');
      link.download = 'git-diff.png';
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error creating image:', error);
      alert('Could not generate image. Try taking a screenshot instead.');
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  return (
    <div className={`flex flex-col w-full max-w-4xl mx-auto p-4 font-mono text-sm transition-colors duration-300 ${darkMode ? 'bg-slate-800 text-gray-200' : 'bg-white text-gray-800'}`}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Git Diff Viewer</h1>
        <div className="flex space-x-2">
          <button
            onClick={toggleDarkMode}
            className={`px-3 py-1 rounded-md ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>

          {parsedDiff.length > 0 && (
            <button
              onClick={downloadAsImage}
              className={`px-3 py-1 rounded-md ${darkMode ? 'bg-blue-700 text-white' : 'bg-blue-500 text-white'}`}
            >
              📷 Download Image
            </button>
          )}
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-6 mb-6 text-center cursor-pointer ${darkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <input
          id="file-upload"
          type="file"
          accept=".txt,.diff"
          onChange={handleFileUpload}
          className="hidden"
        />
        <p className="mb-2 font-semibold">Drop your diff file here</p>
        <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>or click to browse</p>
      </div>

      <div ref={diffContainerRef} className="relative overflow-auto">
        {parsedDiff.length > 0 ? (
          <div className={`border rounded-lg overflow-hidden ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            {parsedDiff.map((file, fileIndex) => (
              <div key={fileIndex} className="mb-4">
                {/* File header */}
                <div className={`p-2 border-b font-medium ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>
                  {file.path}
                </div>

                {/* Hunks */}
                {file.hunks.map((hunk, hunkIndex) => (
                  <div key={hunkIndex} className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    {/* Hunk header */}
                    <div className={`px-4 py-1 ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                      {hunk.header}
                    </div>

                    {/* Code lines */}
                    <div>
                      <table className="w-full table-fixed">
                        <tbody>
                          {hunk.lines.map((line, lineIndex) => (
                            <tr key={lineIndex} className={`${getLineColor(line)} ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                              <td className={`py-0 pl-2 pr-1 text-right select-none w-8 border-r ${darkMode ? 'text-gray-400 border-gray-600' : 'text-gray-500 border-gray-200'}`}>
                                {getLinePrefix(line)}
                              </td>
                              <td className="py-0 px-2 whitespace-normal break-all">
                                {line.startsWith('+') || line.startsWith('-') ? line.substring(1) : line}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : diffText ? (
          <div className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No changes detected in this file. Please check the format.
          </div>
        ) : null}

        {!diffText && (
          <div className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Upload a git diff file to view changes
          </div>
        )}
      </div>
    </div>
  );
};

export default GitDiffViewer;
