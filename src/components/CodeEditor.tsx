'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { OnMount } from '@monaco-editor/react';
import { motion } from 'framer-motion';

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
    boilerplate: `import sys
data = sys.stdin.read().split()
idx = 0

# Your solution here

`,
  },
  {
    id: 63,
    label: 'JavaScript',
    monacoLang: 'javascript',
    boilerplate: `process.stdin.resume();
process.stdin.setEncoding('utf8');
let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  const tokens = input.trim().split(/\\s+/);
  // Your solution here
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
    // Your solution here
    return 0;
}
`,
  },
];

interface CodeEditorProps {
  value: string;
  languageId: number;
  onChange: (code: string) => void;
  onLanguageChange: (lang: Language) => void;
  disabled?: boolean;
}

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
    monaco.editor.defineTheme('mentimeter-premium', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'number', foreground: 'bd93f9' },
      ],
      colors: {
        'editor.background': '#0f172a',
        'editor.foreground': '#f8f8f2',
        'editorLineNumber.foreground': '#44475a',
        'editorLineNumber.activeForeground': '#6272a4',
        'editor.selectionBackground': '#44475a80',
        'editor.lineHighlightBackground': '#44475a20',
        'editorIndentGuide.background': '#44475a40',
        'editorCursor.foreground': '#aeafad',
      },
    });
    monaco.editor.setTheme('mentimeter-premium');
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col rounded-3xl overflow-hidden bg-slate-900 border-2 border-indigo-500/10 shadow-2xl relative">
      <div className="flex items-center justify-between gap-6 px-6 py-4 bg-slate-800/40 border-b-2 border-indigo-500/10">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">Source Editor</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Lang:</span>
            <select
              value={selectedLang.id}
              onChange={(e) => {
                const lang = LANGUAGES.find((l) => l.id === parseInt(e.target.value));
                if (lang) onLanguageChange(lang);
              }}
              disabled={disabled}
              className="bg-black/40 border border-white/5 text-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-50 transition-all shadow-sm"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-slate-900 text-white">{lang.label}</option>
              ))}
            </select>
          </div>
          <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] shadow-current ${editorMounted ? 'bg-emerald-500 text-emerald-500' : 'bg-amber-500 text-amber-500 animate-pulse'}`} />
        </div>
      </div>

      <div className={`transition-all duration-700 ${disabled ? 'grayscale-[0.5] opacity-50 pointer-events-none' : 'opacity-100'}`}>
        <MonacoEditor
          height="450px"
          language={selectedLang.monacoLang}
          value={value}
          onChange={(val) => onChange(val ?? '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: '"Fira Code", "JetBrains Mono", monospace',
            lineHeight: 24,
            padding: { top: 20, bottom: 20 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 4,
            automaticLayout: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            readOnly: disabled,
            scrollbar: {
              verticalScrollbarSize: 4,
              horizontalScrollbarSize: 4,
            },
          }}
        />
      </div>
    </motion.div>
  );
}

