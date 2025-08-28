const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

export function stringToFunction(jsCode: string | Function, silent: boolean = false): Function | null {
    if (typeof jsCode === 'function') {
        return jsCode;
    }
    if (typeof jsCode !== 'string' || !jsCode.trim()) {
        return null;
    }

    let body = jsCode.trim();
    
    const isAsync = /\bawait\b/.test(body);
    
    // If the code is a full function definition, extract just the body.
    const fullFunctionMatch = body.match(/^(?:async\s+)?function\s*\([^\)]*\)\s*\{([\s\S]*)\}/);
    if (fullFunctionMatch) {
        body = fullFunctionMatch[1].trim();
    }
    
    const params = 'item, data, api, app, moment, event';
    const constructor = isAsync ? AsyncFunction : Function;

    try {
        return new constructor(params, body);
    } catch (e) {
        if (!silent) {
            console.error("DataBlock Error: Failed to parse code as a function body.", { code: body, error: e });
        }
        return null;
    }
}

export function debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number,
    immediate = false
): (...args: Parameters<T>) => void {
    let timeout: number | null;
    return function (this: unknown, ...args: Parameters<T>) {
        const context = this;
        const later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        if (timeout) clearTimeout(timeout);
        timeout = window.setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}
export function functionToString(func: Function | string): string {
    if (typeof func === 'string') {
        return func;
    }
    if (typeof func === 'function') {
        // This might happen if the value was never edited.
        // We should format it nicely.
        return functionToCodeBlock(func);
    }
    return '';
}


export function functionToCodeBlock(func: Function | string | undefined): string {
    if (!func) {
        return '';
    }

    let code: string;

    if (typeof func === 'string') {
        const trimmed = func.trim();
        const fullFunctionMatch = trimmed.match(/^(?:async\s+)?function\s*\([^\)]*\)\s*\{([\s\S]*)\}/);
        if (fullFunctionMatch) {
            code = fullFunctionMatch[1].trim();
        } else {
            code = trimmed;
        }
    } else if (typeof func === 'function') {
        code = functionBodyToString(func);
    } else {
        return '';
    }

    if (!code.trim()) {
        return '';
    }
    
    const hasAwait = /\bawait\b/.test(code);
    const indentedBody = code.split('\n').map(line => `  ${line}`).join('\n');

    if (hasAwait) {
        return `async function(item, data, api) {\n${indentedBody}\n}`;
    } else {
        return `function(item) {\n${indentedBody}\n}`;
    }
}


export function functionBodyToString(func: Function): string {
    const funcString = func.toString();
    const bodyMatch = funcString.match(/\{([\s\S]*)\}/);
    if (!bodyMatch) return '';
    return bodyMatch[1].trim();
}

export function deepCloneWithFunctions(obj: any, seen = new WeakMap()): any {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (seen.has(obj)) {
        return seen.get(obj);
    }

    if (obj instanceof Date) {
        return new Date(obj);
    }

    if (obj instanceof RegExp) {
        return new RegExp(obj);
    }
    
    if (typeof obj === 'function') {
        return obj; // Return functions as-is
    }

    const clone = Array.isArray(obj) ? [] : {};
    seen.set(obj, clone);

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            (clone as any)[key] = deepCloneWithFunctions(obj[key], seen);
        }
    }

    return clone;
}
export async function resolvePossiblePromise(value: any): Promise<any> {
    if (value instanceof Promise || (typeof value === 'object' && value !== null && typeof value.then === 'function')) {
        try {
            return await value;
        } catch (error) {
            console.error("DataBlock Error: Promise resolved with an error.", error);
            return `Promise Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    return value;
}