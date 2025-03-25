# SFCC MCP Server Development Guidelines

## Build Commands
- Build: `npm run build`
- Run server: `node build/index.js`
- Debug: `node --inspect build/index.js`

## Code Style Guidelines
- **TypeScript**: Strict typing with explicit interfaces for all data structures
- **Imports**: ES module imports, using `.js` extension in import paths
- **Error Handling**: Use try/catch blocks with specific error types and informative messages
- **Naming**: 
  - Functions: camelCase, descriptive verb phrases
  - Interfaces: PascalCase, descriptive nouns
  - Constants: UPPER_SNAKE_CASE for global constants
- **Documentation**: JSDoc comments for public APIs and complex functions
- **Formatting**: Use 2-space indentation, trailing commas in multiline objects
- **API Interactions**: Centralize in helper functions with proper error handling
- **Response Format**: Follow MCP protocol response structure consistently

## MCP Protocol Standards
- Register tools with descriptive names and clear documentation
- Use Zod for input parameter validation
- Structure responses with `content` array containing typed content blocks