import { z } from "zod";
import { Endpoint, EndpointParam } from './types.js';

export class ToolNameGenerator {
  private static maxToolNameLength = 54;

  private usedToolNames = new Set<string>();

  // Common abbreviations for SFCC terminology
  private abbreviations = new Map([
    ['preference_groups', 'pref_groups'],
    ['preferences', 'prefs'],
    ['variation_groups', 'var_groups'],
    ['variation_attributes', 'var_attrs'],
    ['product_options', 'prod_opts'],
    ['product_inventory_records', 'inventory'],
    ['custom_objects', 'custom_obj'],
    ['custom_object_definitions', 'custom_obj_defs'],
    ['attribute_definitions', 'attr_defs'],
    ['gift_certificates', 'gift_certs'],
    ['customer_groups', 'cust_groups'],
    ['customer_no', 'cust_no'],
    ['customers', 'custs'],
    ['addresses', 'addrs'],
    ['instance_type', 'inst_type'],
    ['object_type', 'obj_type'],
    ['master_product_id', 'master_id'],
    ['product_id', 'prod_id'],
    ['inventory_list_id', 'inv_list_id'],
    ['option_id', 'opt_id'],
    ['attribute_id', 'attr_id'],
    ['merchant_id', 'merch_id'],
    ['library_id', 'lib_id'],
    ['content_id', 'cont_id'],
    ['catalog_id', 'cat_id'],
    ['group_id', 'grp_id'],
    ['site_id', 'site_id'], // Keep site_id as is since it's already short
    ['list_id', 'list_id']  // Keep list_id as is since it's already short
  ]);

  public createToolName(path: string, customName?: string): string {
    if (customName) {
      return this.ensureUniqueness(customName);
    }

    // Remove leading slash and replace path separators with underscores
    let name = path.replace(/^\//, '').replace(/\//g, '_');
    // Replace parameter placeholders with 'by' to create a more readable function name
    name = name.replace(/\{([^}]+)\}/g, 'by_$1');
    
    // Apply abbreviations to reduce length while maintaining readability
    name = this.applyAbbreviations(name);
    
    // If still too long, use intelligent truncation
    if (name.length > ToolNameGenerator.maxToolNameLength) {
      name = this.intelligentTruncate(name);
    }
    
    return this.ensureUniqueness(name);
  }

  private applyAbbreviations(name: string): string {
    let result = name;
    for (const [full, abbrev] of this.abbreviations) {
      result = result.replace(new RegExp(full, 'g'), abbrev);
    }
    return result;
  }

  private intelligentTruncate(name: string): string {
    const parts = name.split('_');
    
    // Strategy 1: Remove redundant 'by' connectors if we have many
    if (parts.filter(p => p === 'by').length > 2) {
      // Keep only essential 'by' connectors, remove others
      let newParts = [];
      let byCount = 0;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === 'by') {
          byCount++;
          // Keep first and last 'by', skip middle ones
          if (byCount === 1 || i === parts.length - 2) {
            newParts.push(parts[i]);
          }
        } else {
          newParts.push(parts[i]);
        }
      }
      name = newParts.join('_');
    }
    
    // Strategy 2: If still too long, prioritize keeping the main resource and action
    if (name.length > ToolNameGenerator.maxToolNameLength) {
      const parts = name.split('_');
      
      // Keep the first part (main resource) and last few parts (specific action/target)
      if (parts.length > 4) {
        const firstPart = parts[0];
        const lastParts = parts.slice(-2); // Keep last 2 parts to make room
        name = [firstPart, ...lastParts].join('_');
      }
    }
    
    // Strategy 3: Final fallback - truncate preserving word boundaries
    if (name.length > ToolNameGenerator.maxToolNameLength) {
      const parts = name.split('_');
      let result = '';
      
      for (const part of parts) {
        if ((result + '_' + part).length <= ToolNameGenerator.maxToolNameLength) {
          result += (result ? '_' : '') + part;
        } else {
          break;
        }
      }
      
      // If we couldn't fit anything meaningful, use the original truncation but smarter
      if (result.length < 20) {
        const target = ToolNameGenerator.maxToolNameLength - 3; // Reserve space for ...
        result = name.substring(0, target) + '...';
      }
      
      name = result;
    }
    
    return name;
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
