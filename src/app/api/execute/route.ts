import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

const PISTON_URL = 'https://emkc.org/api/v2/piston';

// ── Normalize output: strip whitespace/newlines for comparison ──
function normalizeOutput(str: string): string {
  return (str || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line: string) => line.trimEnd())
    .join('\n')
    .trim();
}

// ── Language map: language_id → Piston config ──
const LANGUAGE_MAP: Record<number, {
  language: string;
  version: string;
  extension: string;
}> = {
  71: { language: 'python',     version: '3.10.0',  extension: 'py'   },
  63: { language: 'javascript', version: '18.15.0', extension: 'js'   },
  62: { language: 'java',       version: '15.0.2',  extension: 'java' },
  54: { language: 'c++',        version: '10.2.0',  extension: 'cpp'  },
  50: { language: 'c',          version: '10.2.0',  extension: 'c'    },
  60: { language: 'go',         version: '1.16.2',  extension: 'go'   },
  73: { language: 'rust',       version: '1.50.0',  extension: 'rs'   },
};

// ── Force output: ensure code ALWAYS produces something ──
function forceOutput(code: string, language: string): string {
  switch (language) {
    case 'python': {
      // If no print statement exists, wrap last expression
      if (!code.includes('print(') && !code.includes('sys.stdout')) {
        const lines = code.trim().split('\n');
        const last = lines[lines.length - 1].trim();
        // If last line looks like an expression (not a statement), print it
        if (
          last &&
          !last.startsWith('def ') &&
          !last.startsWith('class ') &&
          !last.startsWith('import ') &&
          !last.startsWith('from ') &&
          !last.startsWith('#') &&
          !last.startsWith('if ') &&
          !last.startsWith('for ') &&
          !last.startsWith('while ') &&
          !last.includes('=')
        ) {
          lines[lines.length - 1] = `print(${last})`;
          return lines.join('\n');
        }
        // Otherwise append fallback
        return code + '\nprint("Code executed successfully")';
      }
      return code;
    }

    case 'javascript': {
      if (
        !code.includes('console.log') &&
        !code.includes('console.error') &&
        !code.includes('process.stdout')
      ) {
        // Wrap in try/catch and print result
        return `
try {
  const __result__ = (() => {
    ${code}
  })();
  if (__result__ !== undefined) console.log(__result__);
  else console.log("Code executed successfully");
} catch (e) {
  console.error("Error:", e.message);
}
`.trim();
      }
      return code;
    }

    case 'java': {
      // Java needs to have System.out.println or we can't easily wrap
      // Just return as-is — Java will error if no main method anyway
      return code;
    }

    case 'c++':
    case 'c': {
      // C/C++ needs to compile — return as-is
      return code;
    }

    default:
      return code;
  }
}

// ── Merge driver code template with user code ──
function mergeWithDriver(userCode: string, driverCode: string): string {
  if (!driverCode || !driverCode.trim()) return userCode;
  if (driverCode.includes('{{USER_CODE}}')) {
    return driverCode.replace('{{USER_CODE}}', userCode);
  }
  // If no placeholder, append user code before driver
  return `${userCode}\n\n${driverCode}`;
}

// ── Main handler ──
export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    source_code,
    language_id,
    stdin = '',
    expected_output = '',
    driver_code = '',
  } = body;

  if (!source_code || !language_id) {
    return NextResponse.json(
      { error: 'source_code and language_id are required' },
      { status: 400 }
    );
  }

  const langConfig = LANGUAGE_MAP[parseInt(language_id)];
  if (!langConfig) {
    return NextResponse.json(
      { error: `Unsupported language_id: ${language_id}` },
      { status: 400 }
    );
  }

  // Step 1: Merge driver code if present
  let finalCode = driver_code
    ? mergeWithDriver(source_code, driver_code)
    : source_code;

  // Step 2: Force output guarantee
  finalCode = forceOutput(finalCode, langConfig.language);

  // Step 3: Build EXACT Piston request format
  const pistonRequest = {
    language: langConfig.language,
    version: langConfig.version,
    files: [
      {
        name: `solution.${langConfig.extension}`,
        content: finalCode,
      },
    ],
    stdin: stdin || '',
    run_timeout: 10000,   // 10 second timeout
    compile_timeout: 15000,
  };

  // Debug log — remove in production if needed
  console.log('=== PISTON REQUEST ===');
  console.log('Language:', langConfig.language, langConfig.version);
  console.log('Code:\n', finalCode);
  console.log('=====================');

  let pistonData: any;

  try {
    const pistonRes = await fetch(`${PISTON_URL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pistonRequest),
    });

    if (!pistonRes.ok) {
      const errText = await pistonRes.text();
      console.error('Piston HTTP error:', pistonRes.status, errText);
      return NextResponse.json(
        { error: `Piston API error: ${pistonRes.status}`, details: errText },
        { status: 502 }
      );
    }

    pistonData = await pistonRes.json();

    // Debug log
    console.log('=== PISTON RESPONSE ===');
    console.log(JSON.stringify(pistonData, null, 2));
    console.log('=======================');

  } catch (err: any) {
    console.error('Piston fetch error:', err.message);
    return NextResponse.json(
      { error: 'Could not reach Piston API', details: err.message },
      { status: 503 }
    );
  }

  // Step 4: Parse response — ONLY use run.stdout and run.stderr
  const runData = pistonData?.run;

  if (!runData) {
    console.error('Piston returned no run object:', pistonData);
    return NextResponse.json({
      stdout: '',
      stderr: '',
      output: 'Execution engine returned no response — please try again',
      isCorrect: false,
      isError: true,
      compile_output: pistonData?.compile?.stderr || '',
    });
  }

  const stdout: string = runData.stdout || '';
  const stderr: string = runData.stderr || '';
  const exitCode: number = runData.code ?? -1;
  const compileOutput: string = pistonData?.compile?.stderr || '';

  // Step 5: Determine output to show user
  let displayOutput: string;

  if (stdout.trim()) {
    displayOutput = stdout;
  } else if (stderr.trim()) {
    displayOutput = stderr;
  } else if (compileOutput.trim()) {
    displayOutput = `Compilation Error:\n${compileOutput}`;
  } else {
    // FAILSAFE — never show empty
    displayOutput = exitCode === 0
      ? 'Code executed successfully but produced no output'
      : 'Code execution failed with no output';
  }

  // Step 6: Compare with expected output
  const normalizedActual = normalizeOutput(stdout);
  const normalizedExpected = normalizeOutput(expected_output);

  let isCorrect = false;
  if (exitCode === 0) {
    if (!normalizedExpected) {
      // No expected output set — any successful run is correct
      isCorrect = true;
    } else {
      isCorrect = normalizedActual === normalizedExpected;
    }
  }

  const isError = exitCode !== 0 || !!compileOutput;

  return NextResponse.json({
    stdout,
    stderr,
    compile_output: compileOutput,
    output: displayOutput,
    exitCode,
    isCorrect,
    isError,
    normalizedActual,
    normalizedExpected,
    language: langConfig.language,
    version: langConfig.version,
  });
}
