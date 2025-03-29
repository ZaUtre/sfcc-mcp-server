# SFCC MCP Server Development Guidelines

## Build & Run Commands
- Build: `npm run build`
- Run server: `node build/index.js`
- Debug mode: `node --inspect build/index.js`
- Run with environment: `dotenv -e .env node build/index.js`

## Code Style Guidelines
- **TypeScript**: Strict typing with explicit interfaces for all data structures
- **Imports**: ES module imports with `.js` extension in import paths
- **Error Handling**: Use try/catch blocks with specific error types and informative messages
- **Naming**: 
  - Functions: camelCase, descriptive verb phrases (e.g., `getAuthToken`)
  - Interfaces: PascalCase, descriptive nouns (e.g., `CatalogsResponse`)
  - Constants: UPPER_SNAKE_CASE for global constants (e.g., `SFCC_CLIENT_ID`)
- **Formatting**: 2-space indentation, trailing commas in multiline objects
- **API Interactions**: Centralize in helper functions with proper error handling

## MCP Protocol Standards
- Register tools with descriptive names and clear documentation
- Use Zod for input parameter validation
- Structure responses with `content` array containing typed content blocks
- Include error handling in all tool implementations