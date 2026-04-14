/**
 * @file src/lib/code-assembler.ts
 *
 * Code assembly pipeline for function-based problems.
 *
 * Responsibilities:
 *   1. Validate that the student's code contains the expected function.
 *   2. Security checks — reject code that tries to override driver logic.
 *   3. Assemble the final executable: student_code + "\n\n" + driver_code.
 *   4. No regex hacks, no string replacements on student code, no guessing.
 *
 * The assembler is intentionally simple — it concatenates, it does not
 * transform the student's code in any way.
 */

import { execSync } from 'child_process';
import * as acorn from 'acorn';

// ─────────────────────────────────────────────────────────────────────────────
// § 1  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AssemblyInput {
  /** Student's source code (exactly as typed in the editor) */
  studentCode: string;
  /** Hidden driver code that reads stdin, calls the function, prints output */
  driverCode: string;
  /** Expected function name (e.g. "twoSum", "solve") */
  functionName: string;
  /** Piston language name for language-specific validation */
  language: string;
  /** Expected number of parameters (-1 means variable/unknown, skip check) */
  expectedParamCount?: number;
}

export interface AssemblyResult {
  /** Whether assembly succeeded */
  ok: boolean;
  /** The final assembled code (only set when ok = true) */
  code?: string;
  /** Human-readable error (only set when ok = false) */
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2  Function-existence validators (per language)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Language-specific checks that the student's code defines the expected
 * function matching exact structural boundaries (parameters, sync enforcement).
 *
 * Returns an error message string if the function is Invalid, or null
 * if everything looks good.
 */
async function validateFunctionExists(
  studentCode: string,
  functionName: string,
  language: string,
  expectedParamCount: number = -1
): Promise<string | null> {
  switch (language) {
    case 'python': {
      // Python: Use deep AST parsing via local python process
      const pythonScript = `
import ast
import sys
import json

def validate():
    code = sys.stdin.read()
    expected_func = sys.argv[1]
    expected_params = int(sys.argv[2])
    
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        print(json.dumps({"error": f"Syntax Error: {str(e)}"}))
        sys.exit(0)
        
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name == expected_func:
                if isinstance(node, ast.AsyncFunctionDef):
                    print(json.dumps({"error": "Type Violation: Please provide a synchronous function, not an \`async\` function."}))
                    sys.exit(0)
                
                actual_params = len(node.args.args)
                if expected_params != -1 and actual_params != expected_params:
                    print(json.dumps({"error": f"Signature Mismatch: Function \`{expected_func}\` expects {expected_params} parameters, but your definition specifies {actual_params}."}))
                    sys.exit(0)
                    
                print(json.dumps({"ok": True}))
                sys.exit(0)
                
    print(json.dumps({"error": f"Missing Function: Your code must define a function named \`{expected_func}\`."}))
    sys.exit(0)

if __name__ == '__main__':
    validate()
`;
      try {
        const stdout = execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}" "${functionName}" ${expectedParamCount}`, {
          input: studentCode,
          timeout: 2000, // 2 second max constraint for parser
          encoding: 'utf-8'
        });
        const result = JSON.parse(stdout.trim());
        if (result.error) return result.error;
        return null;
      } catch (err: unknown) {
        // Fallback for execution error (python not found, timeout) or unparseable JSON
        console.error("Python AST execution proxy error:", err);
        return "Internal Error: Unable to perform rigorous Python static analysis structure validation.";
      }
    }

    case 'javascript':
    case 'typescript': {
      // JS/TS: Use acorn JS parser checking AST statically for matching blocks
      try {
          const ast = acorn.parse(studentCode, { ecmaVersion: 'latest', sourceType: 'script' }) as any;
          let found = false;
          let pCount = 0;
          let isSync = true;
          
          for (const node of ast.body) {
              if (node.type === 'FunctionDeclaration' && node.id && node.id.name === functionName) {
                  found = true;
                  pCount = node.params.length;
                  isSync = !node.async;
                  break;
              } else if (node.type === 'VariableDeclaration') {
                  for (const decl of node.declarations) {
                      if (decl.id && decl.id.name === functionName && decl.init && (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')) {
                          found = true;
                          pCount = decl.init.params.length;
                          isSync = !decl.init.async;
                          break;
                      }
                  }
                  if (found) break;
              }
          }
          
          if (!found) return `Missing Function: Your code must define a function named \`${functionName}\`. Expected: \`function ${functionName}(...)\``;
          if (!isSync) return `Type Violation: Please provide a synchronous function, not an \`async\` function.`;
          if (expectedParamCount !== -1 && pCount !== expectedParamCount) return `Signature Mismatch: Function \`${functionName}\` expects ${expectedParamCount} parameters, but your definition specifies ${pCount}.`;
          
          return null;
      } catch (e: any) {
          return `Syntax Error: We could not interpret your code structure cleanly. ${e.message}`;
      }
    }

    case 'c++':
    case 'c': {
      // C/C++: look for `functionName(`
      // This is a loose check — we can't easily validate C/C++ signatures
      // without a parser, but it catches the common case.
      const marker = `${functionName}(`;
      if (!studentCode.includes(marker)) {
        return `Your code must define a function named \`${functionName}\`. Expected: \`... ${functionName}(...)\``;
      }
      return null;
    }

    case 'java': {
      // Java: look for the function name followed by `(`
      const marker = `${functionName}(`;
      if (!studentCode.includes(marker)) {
        return `Your code must define a method named \`${functionName}\`. Expected: \`public static ... ${functionName}(...)\``;
      }
      return null;
    }

    default:
      // For unknown languages, skip validation
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3  Security checks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blacklisted tokens in student code that could interfere with the driver.
 * Returns an error message if any are found, null otherwise.
 */
function securityCheck(
  studentCode: string,
  language: string
): string | null {
  // Python: prevent overriding the driver entry point
  if (language === 'python') {
    if (studentCode.includes('__driver_main__')) {
      return 'Your code must not define or reference `__driver_main__`. This is a reserved name.';
    }
  }

  // JS/TS: prevent tampering with the IIFE driver
  if (language === 'javascript' || language === 'typescript') {
    // Check for attempts to override console.log
    if (studentCode.includes('console.log = ') || studentCode.includes('console.log=')) {
      return 'Your code must not override `console.log`.';
    }
  }

  // C/C++: prevent student from defining main()
  if (language === 'c' || language === 'c++') {
    // Check for `int main` or `void main` — the driver provides main()
    if (studentCode.includes('int main') || studentCode.includes('void main')) {
      return 'Your code must not define `main()`. The platform handles program entry.';
    }
  }

  // Java: prevent student from defining a Main class (driver provides it)
  if (language === 'java') {
    if (studentCode.includes('class Main')) {
      return 'Your code must not define a `Main` class. The platform handles program entry.';
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4  Assembler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assembles the final executable code from student code + driver code.
 *
 * Steps:
 *   1. Validate that the student's code defines the expected function.
 *   2. Run security checks.
 *   3. Concatenate: student_code + "\n\n" + driver_code
 *
 * No regex hacks. No string replacements on student code. Deterministic.
 */
export async function assembleCode(input: AssemblyInput): Promise<AssemblyResult> {
  const { studentCode, driverCode, functionName, language, expectedParamCount = -1 } = input;

  // 1. Basic validation
  if (!studentCode.trim()) {
    return { ok: false, error: 'Your code is empty. Please write your solution.' };
  }

  if (!functionName.trim()) {
    return { ok: false, error: 'Internal error: function name not configured for this problem.' };
  }

  if (!driverCode.trim()) {
    return { ok: false, error: 'Internal error: driver code not configured for this problem.' };
  }

  // 2. Validate function exists via AST parsing natively
  const fnError = await validateFunctionExists(studentCode, functionName, language, expectedParamCount);
  if (fnError) {
    return { ok: false, error: fnError };
  }

  // 3. Security checks
  const secError = securityCheck(studentCode, language);
  if (secError) {
    return { ok: false, error: secError };
  }

  // 4. Assemble — simple concatenation, driver always executes after student code
  const finalCode = studentCode + '\n\n' + driverCode;

  return { ok: true, code: finalCode };
}
