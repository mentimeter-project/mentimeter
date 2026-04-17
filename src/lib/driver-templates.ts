/**
 * @file src/lib/driver-templates.ts
 *
 * Default starter code + driver code generators for function-based problems.
 *
 * Architecture:
 *   - Students only write the function body (starter code is shown to them).
 *   - The driver code is hidden; it reads JSON from stdin, calls the student's
 *     function, and prints the result in a deterministic format.
 *   - At execution time the assembler concatenates:
 *       final_code = student_code + "\n\n" + driver_code
 *
 * Input convention:
 *   Test case `input` is always a **JSON array of positional arguments**.
 *   Example: for `twoSum(nums, target)`, input = `[[1,2,3], 9]`
 *
 * Output convention:
 *   - Primitives (int, float, string): plain text via print()
 *   - Booleans: lowercase `true` / `false`
 *   - Complex types (list, dict): JSON via json.dumps / JSON.stringify
 *   - null/None: `"null"`
 */

// ─────────────────────────────────────────────────────────────────────────────
// § 1  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LanguageTemplate {
  /** What the student sees in the editor */
  starterCode: string;
  /** Hidden code appended after the student's code at execution time */
  driverCode: string;
}

export interface TemplateGenerator {
  /** Generate starter + driver for a given function name */
  generate(functionName: string): LanguageTemplate;
  /** Judge0 language ID */
  languageId: number;
  /** Human label */
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2  Placeholder token
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Placeholder replaced at template generation time — NOT at execution time.
 * By the time code reaches the assembler, the actual function name is baked in.
 */
const FN = '{{FUNCTION_NAME}}';

// ─────────────────────────────────────────────────────────────────────────────
// § 3  Python (id 71)
// ─────────────────────────────────────────────────────────────────────────────

const pythonGenerator: TemplateGenerator = {
  languageId: 71,
  label: 'Python 3',
  generate(functionName: string): LanguageTemplate {
    const starterCode = `def ${functionName}():
    # Write your solution here
    pass
`;

    // Wrapped in a scoped function to avoid variable collision with student code.
    // Uses underscore-prefixed imports so student's `import json` etc. still work.
    const driverCode = `{{USER_CODE}}

# ── Driver (hidden) ──────────────────────────────────────────────────────────
import sys as _sys, json as _json

def __driver_main__():
    _raw = _sys.stdin.read().strip()
    _args = _json.loads(_raw) if _raw else []
    if not isinstance(_args, list):
        _args = [_args]
        
    try:
        _result = ${functionName}(*_args)
        if isinstance(_result, bool):
            print("true" if _result else "false")
        elif isinstance(_result, (list, dict)):
            print(_json.dumps(_result))
        elif isinstance(_result, tuple):
            print(_json.dumps(list(_result)))
        elif _result is None:
            print("null")
        else:
            print(_result)
    except Exception as e:
        import traceback
        _sys.stderr.write(traceback.format_exc())

if __name__ == '__main__':
    __driver_main__()
`;
    return { starterCode, driverCode };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// § 4  JavaScript / Node.js (id 63)
// ─────────────────────────────────────────────────────────────────────────────

const javascriptGenerator: TemplateGenerator = {
  languageId: 63,
  label: 'JavaScript (Node.js)',
  generate(functionName: string): LanguageTemplate {
    const starterCode = `function ${functionName}() {
  // Write your solution here

}
`;

    // IIFE prevents variable leakage. Leading semicolon guards against missing
    // semicolons in student code.
    const driverCode = `{{USER_CODE}}

// ── Driver (hidden) ──────────────────────────────────────────────────────────
const _fs = require('fs');

function __driver_main__() {
    try {
        const _raw = _fs.readFileSync('/dev/stdin', 'utf-8').trim();
        const _parsed = _raw ? JSON.parse(_raw) : [];
        const _args = Array.isArray(_parsed) ? _parsed : [_parsed];
        
        const _result = ${functionName}(..._args);
        
        if (_result === null || _result === undefined) {
            console.log("null");
        } else if (typeof _result === 'boolean') {
            console.log(_result ? "true" : "false");
        } else if (typeof _result === 'object') {
            console.log(JSON.stringify(_result));
        } else {
            console.log(_result);
        }
    } catch (err) {
        console.error(err);
    }
}

__driver_main__();
`;
    return { starterCode, driverCode };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// § 5  C++ 17 (id 54)
// ─────────────────────────────────────────────────────────────────────────────

const cppGenerator: TemplateGenerator = {
  languageId: 54,
  label: 'C++ 17',
  generate(functionName: string): LanguageTemplate {
    // C++ is statically typed — the default template handles the most common
    // pattern: function receives a vector<int> and returns a value.
    // Admin should customise the driver for other signatures.
    const starterCode = `#include <bits/stdc++.h>
using namespace std;

// Modify the signature as needed for the problem
int ${functionName}(vector<int>& nums) {
    // Write your solution here
    return 0;
}
`;

    // The default C++ driver parses a JSON array of ints from stdin.
    // For problems with different signatures, admin should provide custom driver.
    const driverCode = `{{USER_CODE}}

// ── Driver (hidden) ──────────────────────────────────────────────────────────
#include <sstream>

// Minimal JSON array-of-int parser (no external lib needed)
vector<int> __parse_int_array(const string& s) {
    vector<int> result;
    stringstream ss(s);
    char c;
    int num;
    while (ss >> c) {
        if (c == '[' || c == ',' || c == ']') continue;
        ss.putback(c);
        if (ss >> num) result.push_back(num);
    }
    return result;
}

int main() {
    string _line, _input;
    while (getline(cin, _line)) _input += _line;

    // Default: parse as single array of ints, call function
    vector<int> _nums = __parse_int_array(_input);
    auto _result = ${functionName}(_nums);

    // Output handling
    if constexpr (is_same_v<decltype(_result), vector<int>>) {
        cout << "[";
        for (size_t i = 0; i < _result.size(); i++) {
            if (i > 0) cout << ",";
            cout << _result[i];
        }
        cout << "]" << endl;
    } else if constexpr (is_same_v<decltype(_result), bool>) {
        cout << (_result ? "true" : "false") << endl;
    } else if constexpr (is_same_v<decltype(_result), string>) {
        cout << _result << endl;
    } else {
        cout << _result << endl;
    }
    return 0;
}
`;
    return { starterCode, driverCode };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// § 6  Java (id 62)
// ─────────────────────────────────────────────────────────────────────────────

const javaGenerator: TemplateGenerator = {
  languageId: 62,
  label: 'Java',
  generate(functionName: string): LanguageTemplate {
    // Java's static typing means the default handles int[] → result.
    // Admin should customise for other signatures.
    const starterCode = `import java.util.*;

public class Solution {
    // Modify the signature as needed for the problem
    public static int ${functionName}(int[] nums) {
        // Write your solution here
        return 0;
    }
}
`;

    // Java driver reads JSON array from stdin and calls the static method.
    // Placed in a separate Main class that imports Solution.
    // Since Piston compiles all classes in one file, Main must come after Solution.
    const driverCode = `{{USER_CODE}}

// ── Driver (hidden) ──────────────────────────────────────────────────────────
class Main {
    public static void main(String[] args) throws Exception {
        java.io.BufferedReader _br = new java.io.BufferedReader(new java.io.InputStreamReader(System.in));
        StringBuilder _sb = new StringBuilder();
        String _line;
        while ((_line = _br.readLine()) != null) _sb.append(_line);
        String _input = _sb.toString().trim();

        // Default: parse as JSON array of ints
        _input = _input.replaceAll("[\\\\[\\\\]\\\\s]", "");
        String[] _parts = _input.isEmpty() ? new String[0] : _input.split(",");
        int[] _nums = new int[_parts.length];
        for (int i = 0; i < _parts.length; i++) {
            _nums[i] = Integer.parseInt(_parts[i].trim());
        }

        Object _result = Solution.${functionName}(_nums);

        if (_result instanceof int[]) {
            int[] _arr = (int[]) _result;
            StringBuilder _out = new StringBuilder("[");
            for (int i = 0; i < _arr.length; i++) {
                if (i > 0) _out.append(",");
                _out.append(_arr[i]);
            }
            _out.append("]");
            System.out.println(_out.toString());
        } else if (_result instanceof Boolean) {
            System.out.println(((Boolean) _result) ? "true" : "false");
        } else {
            System.out.println(_result);
        }
    }
}
`;
    return { starterCode, driverCode };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// § 7  C (id 50)
// ─────────────────────────────────────────────────────────────────────────────

const cGenerator: TemplateGenerator = {
  languageId: 50,
  label: 'C',
  generate(functionName: string): LanguageTemplate {
    const starterCode = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Modify the signature as needed for the problem
int ${functionName}(int* nums, int numsSize) {
    // Write your solution here
    return 0;
}
`;

    const driverCode = `{{USER_CODE}}

// ── Driver (hidden) ──────────────────────────────────────────────────────────
int main() {
    char _buf[65536];
    int _len = 0, _ch;
    while ((_ch = getchar()) != EOF && _len < 65535) _buf[_len++] = (char)_ch;
    _buf[_len] = '\\0';

    // Default: parse comma-separated ints from JSON array
    int _nums[10000], _n = 0;
    char* _p = _buf;
    while (*_p && *_p != '[') _p++;
    if (*_p == '[') _p++;
    while (*_p && *_p != ']') {
        while (*_p == ' ' || *_p == ',') _p++;
        if (*_p == ']' || !*_p) break;
        _nums[_n++] = atoi(_p);
        while (*_p && *_p != ',' && *_p != ']') _p++;
    }

    int _result = ${functionName}(_nums, _n);
    printf("%d\\n", _result);
    return 0;
}
`;
    return { starterCode, driverCode };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// § 8  Registry — lookup by Judge0 language ID
// ─────────────────────────────────────────────────────────────────────────────

/** All registered template generators keyed by Judge0 language_id */
export const TEMPLATE_GENERATORS: Record<number, TemplateGenerator> = {
  71: pythonGenerator,
  63: javascriptGenerator,
  54: cppGenerator,
  62: javaGenerator,
  50: cGenerator,
};

/** All supported language IDs for function-based problems */
export const FUNCTION_MODE_LANGUAGE_IDS = Object.keys(TEMPLATE_GENERATORS).map(Number);

/**
 * Generate starter + driver templates for a given function name and language.
 * Returns null if the language ID is not supported for function mode.
 */
export function generateTemplates(
  functionName: string,
  languageId: number
): LanguageTemplate | null {
  const generator = TEMPLATE_GENERATORS[languageId];
  if (!generator) return null;
  return generator.generate(functionName);
}

/**
 * Generate templates for ALL supported languages at once.
 * Returns a map of languageId → LanguageTemplate.
 */
export function generateAllTemplates(
  functionName: string
): Record<number, LanguageTemplate> {
  const result: Record<number, LanguageTemplate> = {};
  for (const [id, gen] of Object.entries(TEMPLATE_GENERATORS)) {
    result[Number(id)] = gen.generate(functionName);
  }
  return result;
}
