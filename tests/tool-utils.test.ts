import { ToolNameGenerator, ToolSchemaBuilder } from '../src/tool-utils';
import { EndpointParam } from '../src/types';

describe('ToolNameGenerator', () => {
  let generator: ToolNameGenerator;

  beforeEach(() => {
    generator = new ToolNameGenerator();
  });

  describe('createToolName', () => {
    it('should return custom name when provided', () => {
      const result = generator.createToolName('/test/path', 'custom_name');
      expect(result).toBe('custom_name');
    });

    it('should generate name from path when no custom name provided', () => {
      const result = generator.createToolName('/catalogs/products');
      expect(result).toBe('catalogs_products');
    });

    it('should replace path parameters with "by_param" pattern', () => {
      const result = generator.createToolName('/catalogs/{id}/products/{productId}');
      expect(result).toBe('catalogs_by_id_products_by_productId');
    });

    it('should remove leading slash from path', () => {
      const result = generator.createToolName('/simple');
      expect(result).toBe('simple');
    });

    it('should handle truncation for long names', () => {
      const longPath = '/very/long/path/with/many/segments/that/exceeds/the/maximum/length/limit/for/tool/names';
      const result = generator.createToolName(longPath);
      
      // The current implementation generates a string within the 64-character limit
      expect(result.length).toBeLessThanOrEqual(64);
      // Check that it contains both start and end of the path
      expect(result).toContain('very_long_path_with_many_se');
      expect(result).toContain('length_limit_for_tool_names');
    });

    it('should ensure uniqueness by adding numeric suffix', () => {
      const firstResult = generator.createToolName('/test');
      const secondResult = generator.createToolName('/test');
      
      expect(firstResult).toBe('test');
      expect(secondResult).toBe('test_1');
    });

    it('should handle multiple duplicates', () => {
      const first = generator.createToolName('/duplicate');
      const second = generator.createToolName('/duplicate');
      const third = generator.createToolName('/duplicate');
      
      expect(first).toBe('duplicate');
      expect(second).toBe('duplicate_1');
      expect(third).toBe('duplicate_2');
    });
  });
});

describe('ToolSchemaBuilder', () => {
  describe('buildSchema', () => {
    it('should build schema for empty parameters', () => {
      const params: EndpointParam[] = [];
      const result = ToolSchemaBuilder.buildSchema(params);
      
      expect(result).toEqual({});
    });

    it('should handle required string parameters', () => {
      const params: EndpointParam[] = [
        {
          name: 'site_id',
          description: 'Site identifier',
          type: 'string',
          required: true
        }
      ];
      
      const result = ToolSchemaBuilder.buildSchema(params);
      
      expect(result.site_id).toBeDefined();
      expect(result.site_id._def.description).toBe('Site identifier');
      // Note: We can't easily test Zod schema internals, but we can verify structure
    });

    it('should handle optional string parameters', () => {
      const params: EndpointParam[] = [
        {
          name: 'expand',
          description: 'Fields to expand',
          type: 'string',
          required: false
        }
      ];
      
      const result = ToolSchemaBuilder.buildSchema(params);
      
      expect(result.expand).toBeDefined();
      expect(result.expand._def.description).toBe('Fields to expand');
    });

    it('should handle number parameters', () => {
      const params: EndpointParam[] = [
        {
          name: 'count',
          description: 'Number of results',
          type: 'number',
          required: true
        },
        {
          name: 'start',
          description: 'Starting index',
          type: 'integer',
          required: false
        }
      ];
      
      const result = ToolSchemaBuilder.buildSchema(params);
      
      expect(result.count).toBeDefined();
      expect(result.start).toBeDefined();
    });

    it('should handle object parameters', () => {
      const params: EndpointParam[] = [
        {
          name: 'requestBody',
          description: 'Request body object',
          type: 'object',
          required: true
        }
      ];
      
      const result = ToolSchemaBuilder.buildSchema(params);
      
      expect(result.requestBody).toBeDefined();
      expect(result.requestBody._def.description).toBe('Request body object');
    });

    it('should handle mixed parameter types', () => {
      const params: EndpointParam[] = [
        {
          name: 'site_id',
          description: 'Site ID',
          type: 'string',
          required: true
        },
        {
          name: 'count',
          description: 'Result count',
          type: 'number',
          required: false
        },
        {
          name: 'query',
          description: 'Query object',
          type: 'object',
          required: false
        }
      ];
      
      const result = ToolSchemaBuilder.buildSchema(params);
      
      expect(Object.keys(result)).toEqual(['site_id', 'count', 'query']);
      expect(result.site_id).toBeDefined();
      expect(result.count).toBeDefined();
      expect(result.query).toBeDefined();
    });
  });
});