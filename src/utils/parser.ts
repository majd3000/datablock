import * as yaml from 'js-yaml';
import { DataBlockConfig } from 'src/types';
import { stringToFunction } from './javascript-helper';
// import { convertLegacyConfig } from './legacy-parser';
import { DataBlockSettings } from 'src/settings';

const JAVASCRIPT_FUNCTION_REGEX = /=>|function/;

function reviveFunctions(obj: any): any {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];

            // If the value is an object, recurse.
            if (typeof value === 'object' && value !== null) {
                reviveFunctions(value);
            }
            // Only convert strings that are clearly intended to be functions.
            // We now leave most JS-like strings as raw strings to be handled by the UI
            // and the executor. This preserves the original formatting.
            else if (typeof value === 'string' && (key === 'action' || (key === 'text' && JAVASCRIPT_FUNCTION_REGEX.test(value)) || key === 'data')) {
                const trimmedValue = value.trim();
                if (trimmedValue.startsWith('function') || trimmedValue.startsWith('async function') || trimmedValue.match(/^\(.*\)\s*=>/)) {
                    const func = stringToFunction(value);
                    if (func) {
                        obj[key] = func;
                    }
                }
            } else if (typeof value === 'string' && key === 'func') {
                const func = stringToFunction(value);
                if (func) {
                    obj[key] = func;
                }
            }
        }
    }
    return obj;
}


function normalizeSortConfig(config: any): any {
    if (config.sortBy && !config.sort) {
        config.sort = config.sortBy;
    }
    delete config.sortBy;

    if (config.sortOrder) {
        if (config.sort && typeof config.sort === 'string') {
            // Only apply if `sort` is a simple string, to avoid ambiguity.
            config.sort = { property: config.sort, order: config.sortOrder };
        }
        delete config.sortOrder;
    }

    // If no sorting is defined after consolidation, exit.
    if (!config.sort) {
        return config;
    }

    // 2. Ensure `sort` is an array for uniform processing.
    // Handle both single-object and array-of-objects formats.
    const sortConfigs = Array.isArray(config.sort)
        ? config.sort
        : (typeof config.sort === 'object' && config.sort !== null)
            ? [config.sort]
            : [config.sort];


    // 3. Normalize every item in the array to the canonical format.
    config.sort = sortConfigs.map((item: any) => {
        if (typeof item === 'string') {
            const parts = item.split(' ');
            return {
                property: parts[0],
                order: (parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc')
            };
        }
        if (typeof item === 'object' && item !== null) {
            const property = item.by || item.property;
            if (property) {
                return {
                    by: property,
                    order: item.order || 'asc',
                    type: item.type,
                };
            }
           }
        return null; // Invalid item format
    }).filter(Boolean); // Remove any null (invalid) entries

    // Clean up if normalization resulted in an empty array.
    if (config.sort.length === 0) {
        delete config.sort;
    }

    return config;
}

export function parseDataBlock(source: string, settings: DataBlockSettings): DataBlockConfig {
  let parsed = yaml.load(source) as any;

  if (settings.applyDefaults) {
    parsed = { ...settings.defaultDataBlockConfig, ...parsed };
  }

    if (parsed.class) {
        parsed.class = parsed.class;
        delete parsed.cssClass;
    }
  
  parsed = normalizeSortConfig(parsed);

  return reviveFunctions(parsed);
}