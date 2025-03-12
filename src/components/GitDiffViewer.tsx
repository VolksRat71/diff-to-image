import React, { useState, useRef, useEffect } from 'react';

// Define types for our diff data structures
interface DiffHunk {
  id: string;
  header: string;
  lines: string[];
  selected: boolean;
}

interface DiffFile {
  id: string;
  header: string;
  path: string;
  hunks: DiffHunk[];
  selected: boolean;
}

interface SavedDiff {
  id: string;
  name: string;
  timestamp: number;
  diffText: string;
  parsedDiff: DiffFile[];
}

const MAX_STORAGE_SIZE = 1000000; // ~1MB max for local storage diff
const MAX_SAVED_DIFFS = 10;

const GitDiffViewer: React.FC = () => {
  const [diffText, setDiffText] = useState<string>('');
  const [parsedDiff, setParsedDiff] = useState<DiffFile[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<number>(14); // Default font size
  const [containerWidth, setContainerWidth] = useState<number>(100); // Default width percentage
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [selectMode, setSelectMode] = useState<'files' | 'hunks'>('files');
  const [selectionSummary, setSelectionSummary] = useState<string>('');
  const [savedDiffs, setSavedDiffs] = useState<SavedDiff[]>([]);
  const [showSavedDiffs, setShowSavedDiffs] = useState<boolean>(false);
  const [exportName, setExportName] = useState<string>('');
  const [currentDiffId, setCurrentDiffId] = useState<string>('');
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(false);

  const diffContainerRef = useRef<HTMLDivElement>(null);

  // Load saved diffs from local storage on component mount
  useEffect(() => {
    try {
      const savedDiffsStr = localStorage.getItem('gitDiffViewerSavedDiffs');
      if (savedDiffsStr) {
        const loadedDiffs = JSON.parse(savedDiffsStr) as SavedDiff[];
        setSavedDiffs(loadedDiffs);
      }
    } catch (error) {
      console.error('Error loading saved diffs:', error);
    }
  }, []);

  // Save current diff to local storage when it changes
  useEffect(() => {
    if (diffText && parsedDiff.length > 0) {
      // Only save if diff isn't too large
      if (diffText.length <= MAX_STORAGE_SIZE) {
        saveDiffToLocalStorage();
      }
    }
  }, [diffText, parsedDiff]);

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

        // Set default export name based on file name
        setExportName(file.name.replace(/\.(diff|txt)$/, ''));
      }
    };
    reader.readAsText(file);
  };

  // Save current diff to local storage
  const saveDiffToLocalStorage = () => {
    try {
      // Generate a unique ID if we don't have one
      const id = currentDiffId || `diff-${Date.now()}`;
      const name = exportName || `Diff ${new Date().toLocaleString()}`;

      const newDiff: SavedDiff = {
        id,
        name,
        timestamp: Date.now(),
        diffText,
        parsedDiff
      };

      // Update or add the current diff
      let updatedDiffs = [...savedDiffs];
      const existingIndex = updatedDiffs.findIndex(d => d.id === id);

      if (existingIndex >= 0) {
        updatedDiffs[existingIndex] = newDiff;
      } else {
        updatedDiffs = [newDiff, ...updatedDiffs];
        setCurrentDiffId(id);
      }

      // Keep only the most recent MAX_SAVED_DIFFS
      if (updatedDiffs.length > MAX_SAVED_DIFFS) {
        updatedDiffs = updatedDiffs.slice(0, MAX_SAVED_DIFFS);
      }

      setSavedDiffs(updatedDiffs);
      localStorage.setItem('gitDiffViewerSavedDiffs', JSON.stringify(updatedDiffs));
    } catch (error) {
      console.error('Error saving diff to local storage:', error);
    }
  };

  // Load a saved diff
  const loadSavedDiff = (diffId: string) => {
    const diff = savedDiffs.find(d => d.id === diffId);
    if (diff) {
      setDiffText(diff.diffText);
      setParsedDiff(diff.parsedDiff);
      setExportName(diff.name);
      setCurrentDiffId(diff.id);
      setShowSavedDiffs(false);
    }
  };

  // Delete a saved diff
  const deleteSavedDiff = (diffId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    const updatedDiffs = savedDiffs.filter(d => d.id !== diffId);
    setSavedDiffs(updatedDiffs);
    localStorage.setItem('gitDiffViewerSavedDiffs', JSON.stringify(updatedDiffs));

    // If the current diff is deleted, clear it
    if (currentDiffId === diffId) {
      setDiffText('');
      setParsedDiff([]);
      setExportName('');
      setCurrentDiffId('');
    }
  };

  // Rename a saved diff
  const renameSavedDiff = (diffId: string, newName: string) => {
    if (!newName.trim()) return;

    const updatedDiffs = savedDiffs.map(diff => {
      if (diff.id === diffId) {
        return { ...diff, name: newName };
      }
      return diff;
    });

    setSavedDiffs(updatedDiffs);
    localStorage.setItem('gitDiffViewerSavedDiffs', JSON.stringify(updatedDiffs));

    // If we're renaming the current diff, update export name too
    if (currentDiffId === diffId) {
      setExportName(newName);
    }
  };

  // Parse the diff text
  const parseDiff = (text: string) => {
    const lines = text.split('\n');
    const diffFiles: DiffFile[] = [];

    let currentFile: DiffFile | null = null;
    let currentHunk: DiffHunk | null = null;
    let fileId = 0;
    let hunkId = 0;

    lines.forEach((line: string) => {
      // New file
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          diffFiles.push(currentFile);
        }
        fileId++;
        currentFile = {
          id: `file-${fileId}`,
          header: line,
          path: extractFilePath(line),
          hunks: [],
          selected: true
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
          hunkId++;
          currentHunk = {
            id: `hunk-${hunkId}`,
            header: line,
            lines: [],
            selected: true
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
    updateSelectionSummary(diffFiles);
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

  // Calculate line numbers for a hunk
  const calculateLineNumbers = (hunk: DiffHunk): { oldLineNum: number; newLineNum: number }[] => {
    // Extract line numbers from hunk header
    // Format is @@ -oldStart,oldCount +newStart,newCount @@
    const match = hunk.header.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (!match) return [];

    let oldLineNum = parseInt(match[1]);
    let newLineNum = parseInt(match[2]);

    return hunk.lines.map(line => {
      const result = { oldLineNum, newLineNum };

      if (!line.startsWith('+')) {
        oldLineNum++;
      }

      if (!line.startsWith('-')) {
        newLineNum++;
      }

      return result;
    });
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
        setExportName(file.name.replace(/\.(diff|txt)$/, ''));
      }
    };
    reader.readAsText(file);
  };

  // Toggle file selection
  const toggleFileSelection = (fileId: string) => {
    const updatedDiff = parsedDiff.map(file => {
      if (file.id === fileId) {
        const newSelected = !file.selected;
        return {
          ...file,
          selected: newSelected,
          hunks: file.hunks.map(hunk => ({
            ...hunk,
            selected: newSelected
          }))
        };
      }
      return file;
    });

    setParsedDiff(updatedDiff);
    updateSelectionSummary(updatedDiff);
  };

  // Toggle hunk selection
  const toggleHunkSelection = (fileId: string, hunkId: string) => {
    const updatedDiff = parsedDiff.map(file => {
      if (file.id === fileId) {
        const updatedHunks = file.hunks.map(hunk => {
          if (hunk.id === hunkId) {
            return { ...hunk, selected: !hunk.selected };
          }
          return hunk;
        });

        // Check if all hunks are selected or none are selected
        const allHunksSelected = updatedHunks.every(hunk => hunk.selected);
        const noHunksSelected = updatedHunks.every(hunk => !hunk.selected);

        return {
          ...file,
          hunks: updatedHunks,
          // Update file selection state based on hunks
          selected: allHunksSelected
        };
      }
      return file;
    });

    setParsedDiff(updatedDiff);
    updateSelectionSummary(updatedDiff);
  };

  // Select or deselect all files/hunks
  const selectAll = (select: boolean) => {
    const updatedDiff = parsedDiff.map(file => ({
      ...file,
      selected: select,
      hunks: file.hunks.map(hunk => ({
        ...hunk,
        selected: select
      }))
    }));

    setParsedDiff(updatedDiff);
    updateSelectionSummary(updatedDiff);
  };

  // Update selection summary text
  const updateSelectionSummary = (files: DiffFile[]) => {
    const selectedFiles = files.filter(file => file.selected).length;
    const totalFiles = files.length;

    const selectedHunks = files.reduce((sum, file) =>
      sum + file.hunks.filter(hunk => hunk.selected).length, 0);
    const totalHunks = files.reduce((sum, file) => sum + file.hunks.length, 0);

    setSelectionSummary(`${selectedFiles}/${totalFiles} files, ${selectedHunks}/${totalHunks} hunks selected`);
  };

  // Function to manually recreate the diff view on a canvas for download
  const downloadAsImage = async () => {
    setIsGeneratingImage(true);

    // Get selected files and hunks
    const selectedFiles = parsedDiff.filter(file =>
      file.selected || file.hunks.some(hunk => hunk.selected)
    ).map(file => ({
      ...file,
      hunks: file.hunks.filter(hunk => hunk.selected)
    })).filter(file => file.hunks.length > 0);

    if (!diffContainerRef.current || !selectedFiles.length) {
      setIsGeneratingImage(false);
      return;
    }

    try {
      // First, calculate the total height needed
      const lineHeight = fontSize + 2;
      const hunkSpacing = 5; // Reduced from 10
      const fileSpacing = 10; // Reduced from 20
      const xPadding = 20;
      const topPadding = 10; // Reduced from 20
      const bottomPadding = 10;

      // Additional padding when line numbers are shown
      const lineNumberPadding = showLineNumbers ? 80 : 0;

      let totalHeight = topPadding; // Start with top padding

      // Calculate height for all content
      selectedFiles.forEach(file => {
        totalHeight += fontSize + 8; // File header (reduced padding)

        file.hunks.forEach((hunk, hunkIndex) => {
          totalHeight += fontSize + 4; // Hunk header (reduced padding)
          totalHeight += hunk.lines.length * lineHeight; // All lines

          // Only add hunk spacing if not the last hunk in the file
          if (hunkIndex < file.hunks.length - 1) {
            totalHeight += hunkSpacing;
          }
        });

        // Only add file spacing if not the last file
        if (selectedFiles.indexOf(file) < selectedFiles.length - 1) {
          totalHeight += fileSpacing;
        }
      });

      // Add bottom padding
      totalHeight += bottomPadding;

      // Create a canvas with precise dimensions
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('Could not get 2D context');
        setIsGeneratingImage(false);
        return;
      }

      const container = diffContainerRef.current;

      // Set canvas size - width from container, calculated height
      canvas.width = container.offsetWidth;
      canvas.height = totalHeight;

      // Fill background
      ctx.fillStyle = darkMode ? '#1e293b' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw a border
      ctx.strokeStyle = darkMode ? '#334155' : '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // Set text properties
      ctx.font = `${fontSize}px monospace`;
      ctx.textBaseline = 'top';

      let yOffset = topPadding; // Start with padding

      // Manually draw the diff content (only selected files and hunks)
      selectedFiles.forEach((file, fileIndex) => {
        // File header background
        const fileHeaderHeight = fontSize + 8; // Reduced padding
        ctx.fillStyle = darkMode ? '#334155' : '#f3f4f6';
        ctx.fillRect(0, yOffset, canvas.width, fileHeaderHeight);

        // File header text
        ctx.fillStyle = darkMode ? '#e2e8f0' : '#1f2937';
        ctx.fillText(file.path, xPadding, yOffset + 4);
        yOffset += fileHeaderHeight;

        file.hunks.forEach((hunk, hunkIndex) => {
          // Hunk header background
          const hunkHeaderHeight = fontSize + 4; // Reduced padding
          ctx.fillStyle = darkMode ? '#1f2937' : '#f9fafb';
          ctx.fillRect(0, yOffset, canvas.width, hunkHeaderHeight);

          // Hunk header text
          ctx.fillStyle = darkMode ? '#94a3b8' : '#6b7280';
          ctx.fillText(hunk.header, xPadding, yOffset + 2);
          yOffset += hunkHeaderHeight;

          // Calculate line numbers if needed
          const lineNumbers = showLineNumbers ? calculateLineNumbers(hunk) : null;

          // Draw lines
          hunk.lines.forEach((line, lineIndex) => {
            // Set line background based on content
            if (line.startsWith('+')) {
              ctx.fillStyle = darkMode ? '#064e3b' : '#d1fae5';
            } else if (line.startsWith('-')) {
              ctx.fillStyle = darkMode ? '#7f1d1d' : '#fee2e2';
            } else {
              ctx.fillStyle = 'transparent';
            }

            if (line.startsWith('+') || line.startsWith('-')) {
              ctx.fillRect(0, yOffset, canvas.width, lineHeight);
            }

            let contentXPosition = xPadding;

            // Draw line numbers if enabled
            if (showLineNumbers && lineNumbers && lineNumbers[lineIndex]) {
              const numbers = lineNumbers[lineIndex];
              ctx.fillStyle = darkMode ? '#94a3b8' : '#9ca3af';

              // Old line number (left)
              if (!line.startsWith('+')) {
                ctx.fillText(numbers.oldLineNum.toString(), xPadding, yOffset + 1);
              }

              // New line number (right)
              if (!line.startsWith('-')) {
                ctx.fillText(numbers.newLineNum.toString(), xPadding + 40, yOffset + 1);
              }

              // Draw vertical divider lines for line numbers
              const dividerColor = darkMode ? '#475569' : '#e5e7eb'; // Use a color that matches the UI border
              ctx.strokeStyle = dividerColor;
              ctx.lineWidth = 1;

              // First divider (after old line number)
              if (!line.startsWith('+')) {
                ctx.beginPath();
                ctx.moveTo(xPadding + 35, yOffset);
                ctx.lineTo(xPadding + 35, yOffset + lineHeight);
                ctx.stroke();
              }

              // Second divider (after new line number)
              ctx.beginPath();
              ctx.moveTo(xPadding + 75, yOffset);
              ctx.lineTo(xPadding + 75, yOffset + lineHeight);
              ctx.stroke();

              // Third divider (after line prefix)
              ctx.beginPath();
              ctx.moveTo(xPadding + lineNumberPadding + 15, yOffset);
              ctx.lineTo(xPadding + lineNumberPadding + 15, yOffset + lineHeight);
              ctx.stroke();

              // Adjust starting position for content
              contentXPosition = xPadding + lineNumberPadding;
            } else {
              // When line numbers are not shown, still draw the divider after the prefix
              ctx.strokeStyle = darkMode ? '#475569' : '#e5e7eb';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(xPadding + 15, yOffset);
              ctx.lineTo(xPadding + 15, yOffset + lineHeight);
              ctx.stroke();
            }

            // Set text color for prefix and content
            ctx.fillStyle = darkMode ? '#e2e8f0' : '#1f2937';

            // Draw line prefix
            ctx.fillText(getLinePrefix(line), contentXPosition, yOffset + 1);

            // Draw line content
            const content = line.startsWith('+') || line.startsWith('-') ? line.substring(1) : line;
            ctx.fillText(content, contentXPosition + 20, yOffset + 1);

            yOffset += lineHeight;
          });

          // Only add spacing between hunks (not after the last hunk in a file)
          if (hunkIndex < file.hunks.length - 1) {
            yOffset += hunkSpacing;

            // Draw separator line between hunks
            ctx.strokeStyle = darkMode ? '#334155' : '#e5e7eb';
            ctx.beginPath();
            ctx.moveTo(0, yOffset - hunkSpacing / 2);
            ctx.lineTo(canvas.width, yOffset - hunkSpacing / 2);
            ctx.stroke();
          }
        });

        // Only add spacing between files (not after the last file)
        if (fileIndex < selectedFiles.length - 1) {
          // Draw thick separator between files
          ctx.fillStyle = darkMode ? '#334155' : '#e5e7eb';
          ctx.fillRect(0, yOffset, canvas.width, 2);
          yOffset += fileSpacing;
        }
      });

      // Convert canvas to image and trigger download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;

      // Use custom name if available, otherwise use timestamp
      const filename = exportName ?
        `${exportName}.png` :
        `git-diff-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;

      link.download = filename;
      link.click();

    } catch (error) {
      console.error('Error generating image:', error);
      alert('Could not generate image. Try taking a screenshot instead.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // Toggle preview
  const togglePreview = () => {
    setShowPreview(prev => !prev);
  };

  // Toggle line numbers
  const toggleLineNumbers = () => {
    setShowLineNumbers(prev => !prev);
  };

  // Toggle selection mode between files and hunks
  const toggleSelectionMode = () => {
    setSelectMode(prev => prev === 'files' ? 'hunks' : 'files');
  };

  return (
    <div className={`flex flex-col w-full max-w-6xl mx-auto p-4 transition-colors duration-300 ${darkMode ? 'bg-slate-800 text-gray-200' : 'bg-white text-gray-800'}`} style={{ fontFamily: 'monospace' }}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Git Diff Viewer</h1>
      </div>

      {/* Saved Diffs Panel */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${showSavedDiffs ? 'max-h-[500px] opacity-100 mb-4' : 'max-h-0 opacity-0'}`}
      >
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <h2 className="text-lg font-bold mb-2">Saved Diffs</h2>

          {savedDiffs.length === 0 ? (
            <p className="text-center py-2">No saved diffs yet. Upload a diff file to get started.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {savedDiffs.map((diff) => (
                <div
                  key={diff.id}
                  onClick={() => loadSavedDiff(diff.id)}
                  className={`p-2 mb-1 rounded cursor-pointer flex justify-between items-center transition-colors duration-200 ${diff.id === currentDiffId
                      ? darkMode ? 'bg-blue-800' : 'bg-blue-100'
                      : darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                >
                  <div className="flex-1 truncate">
                    <span className="font-medium">{diff.name}</span>
                    <span className="text-xs ml-2 opacity-70">
                      {new Date(diff.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex space-x-1">
                    {diff.id === currentDiffId && (
                      <input
                        type="text"
                        value={exportName}
                        onChange={(e) => setExportName(e.target.value)}
                        onBlur={() => renameSavedDiff(diff.id, exportName)}
                        onClick={(e) => e.stopPropagation()}
                        className={`text-sm px-2 py-1 rounded mr-1 w-40 transition-colors duration-200 ${darkMode ? 'bg-gray-700 text-gray-200 focus:bg-gray-600' : 'bg-white text-gray-800 focus:bg-gray-50'}`}
                        placeholder="Rename diff..."
                      />
                    )}
                    <button
                      onClick={(e) => deleteSavedDiff(diff.id, e)}
                      className={`p-1 rounded transition-colors duration-200 ${darkMode ? 'bg-red-900 hover:bg-red-800' : 'bg-red-100 hover:bg-red-200'}`}
                      title="Delete diff"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Controls & Buttons - Sticky */}
      <div className={`mb-4 p-4 rounded-lg transition-colors duration-300 sticky top-2 z-10 shadow-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
        {/* Main action buttons */}
        <div className="flex flex-wrap justify-between items-center mb-4 border-b border-gray-600 pb-4">
          <div className="flex flex-wrap gap-2 items-center mb-2 md:mb-0">
            <button
              onClick={toggleDarkMode}
              className={`px-3 py-1 rounded-md transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-50 ${darkMode ? 'bg-gray-600 text-gray-200 focus:ring-gray-400' : 'bg-gray-300 text-gray-800 focus:ring-gray-500'}`}
              title="Toggle dark/light mode"
            >
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </button>

            <button
              onClick={() => setShowSavedDiffs(!showSavedDiffs)}
              className={`px-3 py-1 rounded-md transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-50 ${darkMode ? 'bg-gray-600 text-gray-200 focus:ring-gray-400' : 'bg-gray-300 text-gray-800 focus:ring-gray-500'}`}
              title="Show saved diffs"
            >
              📂 {showSavedDiffs ? 'Hide Saved' : 'Show Saved'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className={`transition-all duration-300 ${parsedDiff.length > 0 ? 'opacity-100' : 'opacity-50'}`}>
              <button
                onClick={toggleLineNumbers}
                disabled={parsedDiff.length === 0}
                className={`px-3 py-1 rounded-md transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-50 ${darkMode ? 'bg-gray-600 text-gray-200 focus:ring-gray-400' : 'bg-gray-300 text-gray-800 focus:ring-gray-500'} ${parsedDiff.length === 0 ? 'cursor-not-allowed' : ''}`}
                title="Toggle line numbers"
              >
                {showLineNumbers ? '🔢 Hide Numbers' : '🔢 Show Numbers'}
              </button>
            </div>

            {parsedDiff.length > 0 && (
              <>
                <button
                  onClick={togglePreview}
                  className={`px-3 py-1 rounded-md transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-50 ${darkMode ? 'bg-gray-600 text-gray-200 focus:ring-gray-400' : 'bg-gray-300 text-gray-800 focus:ring-gray-500'}`}
                  title="Toggle preview mode"
                >
                  {showPreview ? '🔍 Hide Preview' : '🔍 Show Preview'}
                </button>
                <button
                  onClick={downloadAsImage}
                  disabled={isGeneratingImage}
                  className={`px-3 py-1 rounded-md transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-50 ${darkMode ? 'bg-blue-700 text-white focus:ring-blue-400' : 'bg-blue-500 text-white focus:ring-blue-300'} ${isGeneratingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Download as image"
                >
                  {isGeneratingImage ? '⏳ Generating...' : '📷 Download Image'}
                </button>
              </>
            )}
          </div>
        </div>

        {parsedDiff.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-2">Font Size: {fontSize}px</label>
                <input
                  type="range"
                  min="8"
                  max="24"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full transition-opacity duration-200 hover:opacity-80"
                />
              </div>
              <div>
                <label className="block mb-2">Width: {containerWidth}%</label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={containerWidth}
                  onChange={(e) => setContainerWidth(parseInt(e.target.value))}
                  className="w-full transition-opacity duration-200 hover:opacity-80"
                />
              </div>
            </div>

            {/* Export name input */}
            <div className="flex flex-wrap items-center mb-4">
              <label className="font-medium mr-2">Export Name:</label>
              <input
                type="text"
                value={exportName}
                onChange={(e) => setExportName(e.target.value)}
                placeholder="Enter name for export..."
                className={`flex-1 px-3 py-1 rounded transition-colors duration-200 ${darkMode ? 'bg-gray-600 text-gray-200 focus:bg-gray-500' : 'bg-white text-gray-800 focus:bg-gray-50'}`}
              />
            </div>

            {/* Selection controls */}
            <div className="border-t border-gray-600 pt-4 mt-2">
              <div className="flex flex-wrap justify-between items-center mb-2">
                <div className="flex items-center space-x-4 mb-2 md:mb-0">
                  <span className="font-medium">Selection Mode:</span>
                  <button
                    onClick={toggleSelectionMode}
                    className={`px-3 py-1 rounded-md transition-all duration-200 ${darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-300 text-gray-800 hover:bg-gray-200'}`}
                  >
                    {selectMode === 'files' ? '📁 Files' : '📑 Hunks'}
                  </button>
                  <span className="text-sm">{selectionSummary}</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => selectAll(true)}
                    className={`px-3 py-1 rounded-md transition-all duration-200 transform hover:scale-105 ${darkMode ? 'bg-green-800 text-white hover:bg-green-700' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => selectAll(false)}
                    className={`px-3 py-1 rounded-md transition-all duration-200 transform hover:scale-105 ${darkMode ? 'bg-red-800 text-white hover:bg-red-700' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            </div>

            {/* Preview notice */}
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${showPreview ? 'max-h-20 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}
            >
              <div className="p-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                <p>
                  <strong>Preview Mode:</strong> This view shows how your selections will appear in the downloaded image.
                  Only selected files and hunks will be included in the download.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-6 mb-6 text-center cursor-pointer transition-all duration-200 transform hover:scale-[1.01] ${darkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => {
          const uploadElement = document.getElementById('file-upload');
          if (uploadElement) {
            uploadElement.click();
          }
        }}
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

      <div
        ref={diffContainerRef}
        style={{
          fontSize: `${fontSize}px`,
          width: `${containerWidth}%`,
          margin: '0 auto',
          maxWidth: '100%',
          overflowX: 'auto'
        }}
        className={`transition-all duration-300 mt-4 ${showPreview ? "relative" : ""}`}
      >
        {parsedDiff.length > 0 ? (
          <div className={`border rounded-lg overflow-hidden transition-colors duration-300 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            {parsedDiff.map((file, fileIndex) => (
              <div
                key={fileIndex}
                className={`mb-4 transition-opacity duration-300 ${(!file.selected && !file.hunks.some(h => h.selected)) && showPreview ? 'opacity-30' : ''}`}
              >
                {/* File header */}
                <div
                  className={`p-2 border-b font-medium flex justify-between items-center transition-colors duration-200 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}
                >
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleFileSelection(file.id)}
                      className={`mr-2 w-5 h-5 flex items-center justify-center rounded transition-colors duration-200 ${file.selected
                        ? (darkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-blue-500 text-white hover:bg-blue-400')
                        : (darkMode ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' : 'bg-gray-300 text-gray-600 hover:bg-gray-200')}`}
                      title={file.selected ? "Deselect file" : "Select file"}
                    >
                      {file.selected ? '✓' : ''}
                    </button>
                    {file.path}
                  </div>
                  <span className="text-xs">
                    {file.hunks.filter(h => h.selected).length}/{file.hunks.length} hunks
                  </span>
                </div>

                {/* Hunks */}
                {(selectMode === 'hunks' || showPreview) &&
                  file.hunks.map((hunk, hunkIndex) => (
                    <div
                      key={hunkIndex}
                      className={`border-t transition-all duration-200 ${darkMode ? 'border-gray-700' : 'border-gray-200'} ${!hunk.selected && showPreview ? 'opacity-30' : ''}`}
                    >
                      {/* Hunk header */}
                      <div
                        className={`px-4 py-1 flex justify-between items-center transition-colors duration-200 ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-50 text-gray-500'}`}
                      >
                        <div className="flex items-center">
                          <button
                            onClick={() => toggleHunkSelection(file.id, hunk.id)}
                            className={`mr-2 w-4 h-4 flex items-center justify-center rounded transition-colors duration-200 ${hunk.selected
                              ? (darkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-blue-500 text-white hover:bg-blue-400')
                              : (darkMode ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' : 'bg-gray-300 text-gray-600 hover:bg-gray-200')}`}
                            title={hunk.selected ? "Deselect hunk" : "Select hunk"}
                          >
                            {hunk.selected ? '✓' : ''}
                          </button>
                          <span className="truncate">{hunk.header}</span>
                        </div>
                        <span className="text-xs ml-2">
                          {hunk.lines.length} lines
                        </span>
                      </div>

                      {/* Code lines - only show if file and hunk are selected in preview mode */}
                      {(!showPreview || (file.selected || hunk.selected)) && (
                        <div>
                          <table className="w-full table-fixed">
                            <tbody>
                              {hunk.lines.map((line, lineIndex) => {
                                // Calculate line numbers when they're needed
                                const lineNumbers = showLineNumbers ? calculateLineNumbers(hunk)[lineIndex] : null;

                                return (
                                  <tr key={lineIndex} className={`${getLineColor(line)} transition-colors duration-150 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                                    {/* Line numbers (when enabled) - fixed width with visibility animation instead of width animation */}
                                    <td className={`py-0 px-1 text-right select-none w-12 border-r transition-all duration-300 ease-in-out ${darkMode ? 'text-gray-400 border-gray-600' : 'text-gray-500 border-gray-200'} ${showLineNumbers ? 'opacity-100 visible' : 'opacity-0 hidden'} ${line.startsWith('+') ? 'border-r-0' : ''}`}>
                                      {!line.startsWith('+') ? lineNumbers?.oldLineNum : ''}
                                    </td>
                                    <td className={`py-0 px-1 text-right select-none w-12 border-r transition-all duration-300 ease-in-out ${darkMode ? 'text-gray-400 border-gray-600' : 'text-gray-500 border-gray-200'} ${showLineNumbers ? 'opacity-100 visible' : 'opacity-0 hidden'}`}>
                                      {!line.startsWith('-') ? lineNumbers?.newLineNum : ''}
                                    </td>
                                    {/* Line prefix (+/-/space) */}
                                    <td className={`py-0 pl-2 pr-1 text-right select-none w-8 border-r transition-colors duration-200 ${darkMode ? 'text-gray-400 border-gray-600' : 'text-gray-500 border-gray-200'}`}>
                                      {getLinePrefix(line)}
                                    </td>
                                    {/* Line content */}
                                    <td className="py-0 px-2 whitespace-normal break-all">
                                      {line.startsWith('+') || line.startsWith('-') ? line.substring(1) : line}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        ) : diffText ? (
          <div className={`text-center py-4 transition-colors duration-300 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No changes detected in this file. Please check the format.
          </div>
        ) : null}

        {!diffText && (
          <div className={`text-center py-4 animate-pulse transition-colors duration-300 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Upload a git diff file to view changes
          </div>
        )}

        {/* Preview overlay */}
        {showPreview && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-md pointer-events-none animate-fade-in">
            Preview Mode
          </div>
        )}
      </div>
    </div>
  );
};

export default GitDiffViewer;
