import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Runs a python script safely by writing it to a temporary file.
 * This avoids shell escaping issues that occur with `python -c`.
 */
export function runPythonScript(script: string, args: string[], input: string): string {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `piston_script_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);
  
  try {
    fs.writeFileSync(tmpFile, script);
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const argString = args.map(a => `"${a.toString().replace(/"/g, '\\"')}"`).join(' ');
    
    return execSync(`${pythonCmd} "${tmpFile}" ${argString}`, {
      input,
      timeout: 5000,
      encoding: 'utf-8'
    });
  } finally {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch { /* ignore */ }
  }
}
