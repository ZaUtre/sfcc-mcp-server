import { z } from "zod";
import { Endpoint, EndpointParam } from './types.js';

export class ToolNameGenerator {
  private static maxToolNameLength = 54;

  private usedToolNames = new Set<string>();

  public createToolName(path: string, customName?: string): string {
    if (customName) {
      return this.ensureUniqueness(customName);
    }

    // Remove leading slash and replace path separators with underscores
    let name = path.replace(/^\//, '').replace(/\//g, '_');
    // Replace parameter placeholders with 'by' to create a more readable function name
    name = name.replace(/\{([^}]+)\}/g, 'by_$1');
    
    // If name is longer than 54 chars (limit for MCP server name + tool name is 60 chars), truncate it
    if (name.length > ToolNameGenerator.maxToolNameLength) {
      name = `${name.slice(0, ToolNameGenerator.maxToolNameLength / 2)}_${name.slice(-ToolNameGenerator.maxToolNameLength / 2)}`;
    }
    
    return this.ensureUniqueness(name);
  }

  private ensureUniqueness(name: string): string {
    let uniqueName = name;
    let counter = 1;
    
    while (this.usedToolNames.has(uniqueName)) {
      const suffix = `_${counter}`;
      if (name.length + suffix.length > 64) {
        name = name.slice(0, 64 - suffix.length);
      }
      uniqueName = name + suffix;
      counter++;
    }
    
    this.usedToolNames.add(uniqueName);
    return uniqueName;
  }
}

export class ToolSchemaBuilder {
  public static buildSchema(params: EndpointParam[]): Record<string, any> {
    const schema: Record<string, any> = {};
    
    params.forEach((param: EndpointParam) => {
      if (param.type === 'object') {
        schema[param.name] = param.required 
          ? z.object({}).passthrough().describe(param.description)
          : z.object({}).passthrough().optional().describe(param.description);
      } else if (param.type === 'number' || param.type === 'integer') {
        schema[param.name] = param.required
          ? z.number().describe(param.description)
          : z.number().optional().describe(param.description);
      } else {
        // Default to string for all other types
        schema[param.name] = param.required
          ? z.string().describe(param.description)
          : z.string().optional().describe(param.description);
      }
    });
    
    return schema;
  }
}
