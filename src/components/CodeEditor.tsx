'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { OnMount } from '@monaco-editor/react';

// Dynamic import to prevent SSR issues with Monaco
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// ── Language definitions ───────────────────────────────────────────────────
export interface Language {
  id: number;
  label: string;
  monacoLang: string;
  boilerplate: string;
}

export const LANGUAGES: Language[] = [
  {
    id: 71,
    label: 'Python 3',
    monacoLang: 'python',
    // sys.stdin.read().split() reads ALL stdin at once into a list of tokens.
    // This avoids EOFError that input() raises in Judge0's non-TTY sandbox.
    boilerplate: `import sys
data = sys.stdin.read().split()
idx = 0  # advance this pointer as you consume tokens

# Example: read a list of n integers on line 1, then a target on line 2
# n = int(data[idx]); idx += 1          # or just use positional indices
# nums = [int(data[idx+i]) for i in range(n)]; idx += n
# target = int(data[idx]); idx += 1

# Your solution here

`,
  },
  {
    id: 63,
    label: 'JavaScript (Node.js)',
    monacoLang: 'javascript',
    // process.stdin is non-interactive in Judge0; collect all chunks then solve.
    boilerplate: `process.stdin.resume();
process.stdin.setEncoding('utf8');
let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  const tokens = input.trim().split(/\\s+/);
  let idx = 0;
  const next = () => tokens[idx++];
  const nextInt = () => parseInt(next(), 10);

  // Your solution here — use next() / nextInt() to read tokens

});
`,
  },
  {
    id: 54,
    label: 'C++ 17',
    monacoLang: 'cpp',
    boilerplate: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // cin works reliably in Judge0 — read tokens normally
    // e.g.: int n; cin >> n;

    return 0;
}
`,
  },
  {
    id: 62,
    label: 'Java',
    monacoLang: 'java',
    boilerplate: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StreamTokenizer st = new StreamTokenizer(br);
        // st.nextToken(); int n = (int) st.nval;  // read next token as int

        // Your solution here

    }
}
`,
  },
  {
    id: 50,
    label: 'C',
    monacoLang: 'c',
    boilerplate: `#include <stdio.h>
#include <stdlib.h>

int main() {
    // scanf works reliably in Judge0
    // e.g.: int n; scanf("%d", &n);

    return 0;
}
`,
  },
];

// ── Props ──────────────────────────────────────────────────────────────────
interface CodeEditorProps {
  value: string;
  languageId: number;
  onChange: (code: string) => void;
  onLanguageChange: (lang: Language) => void;
  disabled?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function CodeEditor({
  value,
  languageId,
  onChange,
  onLanguageChange,
  disabled = false,
}: CodeEditorProps) {
  const selectedLang = LANGUAGES.find((l) => l.id === languageId) ?? LANGUAGES[0];
  const [editorMounted, setEditorMounted] = useState(false);

  const handleEditorMount: OnMount = useCallback((_editor, monaco) => {
    setEditorMounted(true);
    monaco.editor.defineTheme('mentimeter-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
      ],
      colors: {
        'editor.background': '#0F172A',
        'editor.foreground': '#E2E8F0',
        'editorLineNumber.foreground': '#334155',
        'editorLineNumber.activeForeground': '#64748B',
        'editor.selectionBackground': '#1E3A5F',
        'editor.lineHighlightBackground': '#1E293B',
        'editorIndentGuide.background': '#1E293B',
        'editorCursor.foreground': '#818CF8',
        'editor.inactiveSelectionBackground': '#1E293B',
      },
    });
    monaco.editor.setTheme('mentimeter-dark');
  }, []);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = LANGUAGES.find((l) => l.id === parseInt(e.target.value));
    if (lang) {
      onLanguageChange(lang);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-800 border-b border-slate-700">
        {/* Language indicator dots */}
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
          <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs font-medium">Language:</span>
          <select
            id="language-selector"
            value={selectedLang.id}
            onChange={handleLanguageChange}
            disabled={disabled}
            className="bg-slate-700 border border-slate-600 text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:border-slate-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          {!editorMounted && (
            <span className="animate-pulse text-slate-500">Loading editor...</span>
          )}
          {editorMounted && (
            <span className="text-emerald-500/70">● Ready</span>
          )}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className={`transition-opacity duration-300 ${disabled ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
        <MonacoEditor
          height="400px"
          language={selectedLang.monacoLang}
          value={value}
          onChange={(val) => onChange(val ?? '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", "Consolas", monospace',
            fontLigatures: true,
            lineHeight: 22,
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 4,
            insertSpaces: true,
            automaticLayout: true,
            renderWhitespace: 'selection',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            readOnly: disabled,
            contextmenu: false,
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          }}
          theme="mentimeter-dark"
        />
      </div>
    </div>
  );
}
