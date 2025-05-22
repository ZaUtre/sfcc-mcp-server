# SFCC MCP Server - Custom Handlers

This document provides an overview of the custom handlers feature implemented in the SFCC MCP Server.

## Implementation Overview

The custom handlers feature allows you to create specialized behavior for specific endpoints by:

1. Defining a custom tool name in the endpoint configuration
2. Creating handler functions that will be called instead of the default handler

## Key Components

### 1. Endpoint Configuration

You can specify a custom tool name in the endpoint definition:

```json
{
  "path": "/product_search",
  "toolName": "product_search",
  "description": "Search for products...",
  "params": [...]
}
```

### 2. Custom Handler Implementation

Create a function named `handler_[toolName]` that will be automatically used instead of the default handler:

```typescript
export async function handler_product_search(endpoint, params) {
  // Custom implementation
  // ...
}
```

### 3. Handler Execution Flow

When an endpoint is called:

1. The system checks if there's a custom handler function named `handler_[toolName]` for the endpoint
2. If a custom handler exists, it's called instead of the default handler
3. The custom handler can:
   - Call the default handler with modified parameters
   - Implement completely custom behavior
   - Process the result from the default handler

## Example Use Cases

### Pre-Processing Requests

```typescript
export async function handler_product_search(endpoint, params) {
  // Modify request parameters
  if (params.requestBody) {
    params.requestBody.custom_field = 'Added by custom handler';
  }
  
  // Call the default handler with modified params
  return await getDefaultHandler()(endpoint, params);
}
```

### Post-Processing Results

```typescript
export async function handler_product_details(endpoint, params) {
  // Call the default handler
  const result = await getDefaultHandler()(endpoint, params);
  
  // Enhance the result
  result.enhanced_by_custom_handler = true;
  result.related_products = [...];
  
  return result;
});
```

### Complete Override

```typescript
export async function handler_custom_endpoint(endpoint, params) {
  // Custom implementation without calling the default handler
  return {
    custom_data: true,
    result: 'Custom implementation'
  };
}
```

## Implementing Custom Handlers

### Step 1: Define a Custom Tool Name

In your `endpoints.json` file, specify a custom `toolName` for the endpoint you want to customize:

```json
{
  "path": "/product_search",
  "toolName": "product_search",
  "description": "Search for products...",
  "method": "POST",
  "params": [...]
}
```

### Step 2: Create a Handler Function

Create a handler function directly in your `index.ts` file with the naming pattern `handler_[toolName]`:

```typescript
async function handler_product_search(endpoint, params) {
  // Your custom implementation
}

// Make the handler accessible globally
(global as any).handler_product_search = handler_product_search;
```

### Step 3: Implement Your Custom Logic

You have three main patterns for implementation:

1. **Pre-processing:** Modify the request parameters before calling the default handler
2. **Post-processing:** Process the results from the default handler before returning
3. **Complete override:** Implement custom logic without calling the default handler

## Testing and Debugging Custom Handlers

You can test your custom handlers using the following approaches:

1. Run the server with `npm run serve` and call the endpoint
2. Add logging statements to track execution flow:
   ```typescript
   console.log('Custom handler called with params:', JSON.stringify(params));
   ```
3. Use try-catch blocks to handle and log errors:
   ```typescript
   try {
     // Your handler code
   } catch (error) {
     console.error('Error in custom handler:', error);
     throw error;  // Re-throw to ensure the error is properly reported
   }
   ```
4. Check the server logs to see if your custom handler is being called

## Best Practices

1. Keep custom handlers focused on a single responsibility
2. Use meaningful tool names that describe the endpoint's purpose
3. Document the behavior of your custom handlers
4. Implement error handling in your custom handlers
5. Consider performance implications, especially for high-traffic endpoints
6. Use TypeScript interfaces for better type checking:
   ```typescript
   interface CustomEndpointParams {
     id: string;
     expand?: string;
   }
   
   export async function handler_custom_endpoint(endpoint: any, params: CustomEndpointParams) {
     // Type-safe implementation
   }
   ```
