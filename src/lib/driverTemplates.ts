// Driver code templates for function-based problems
// Use {{USER_CODE}} as placeholder for student's code
// The driver calls the function and prints the result

export const DRIVER_TEMPLATES: Record<string, string> = {

  python: `{{USER_CODE}}

# Driver — auto-executes and prints result
import sys

try:
    # Detect and call the first defined function
    import inspect
    _local_funcs = [(name, obj) for name, obj in list(locals().items()) 
                    if callable(obj) and not name.startswith('_')]
    if _local_funcs:
        _func_name, _func = _local_funcs[0]
        _sig = inspect.signature(_func)
        _params = list(_sig.parameters.keys())
        if len(_params) == 0:
            _result = _func()
        else:
            _result = _func(*([None] * len(_params)))
        print(_result)
except Exception as e:
    print(f"Driver error: {e}", file=sys.stderr)
`,

  javascript: `{{USER_CODE}}

// Driver — auto-executes and prints result
try {
  // The student's function should be defined above
  // This driver attempts to call it with test input
  const __funcNames__ = Object.getOwnPropertyNames(global)
    .filter(k => typeof global[k] === 'function' && !['setTimeout','setInterval','clearTimeout','clearInterval','require','process','console'].includes(k));
  
  if (__funcNames__.length > 0) {
    const __fn__ = global[__funcNames__[0]];
    const __result__ = __fn__();
    if (__result__ !== undefined) console.log(__result__);
    else console.log("Function executed successfully");
  } else {
    console.log("Code executed successfully");
  }
} catch (e) {
  console.error("Error:", e.message);
}
`,

};

// Get driver template for a language
export function getDriverTemplate(language: string): string {
  return DRIVER_TEMPLATES[language] || '{{USER_CODE}}';
}

// Merge user code with driver template
export function mergeWithDriver(userCode: string, driverCode: string): string {
  if (!driverCode || !driverCode.trim()) return userCode;
  if (driverCode.includes('{{USER_CODE}}')) {
    return driverCode.replace('{{USER_CODE}}', userCode);
  }
  return `${userCode}\n\n${driverCode}`;
}
