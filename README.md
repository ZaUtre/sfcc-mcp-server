# SFCC MCP Server

A Model Context Protocol (MCP) server for interacting with Salesforce Commerce Cloud (SFCC) APIs.

## Features

- Dynamic endpoint registration based on `endpoints.json` configuration
- Automatic handling of path and query parameters
- OCAPI authentication using client credentials flow
- Support for all SFCC GET Data API endpoints

## Installation

```bash
# Install dependencies
npm install

# Build the server
npm run build
```

## Configuration

Create a `.env` file in the project root directory with the following variables:

```
# SFCC API Configuration
SFCC_API_BASE=https://your-instance.api.commercecloud.salesforce.com/
SFCC_SITE_ID=your_site_id  # optional, defaults to "RefArch"

# Admin API Credentials (Client credentials flow)
SFCC_ADMIN_CLIENT_ID=your_admin_client_id
SFCC_ADMIN_CLIENT_SECRET=your_admin_client_secret
```

## OCAPI Configuration

To use the SFCC Data APIs, you need to configure an API client in SFCC with the proper permissions:

1. In SFCC Business Manager, go to Administration > Site Development > Open Commerce API Settings
2. Create a new API client or edit an existing one
3. Configure the OAuth settings:
   - OAuth Client ID: (your client ID)
   - OAuth Client Secret: (your client secret)
   - Default scopes: Include the scopes needed for your endpoints
   - Token Endpoint Auth Method: `client_secret_post`
4. Configure API client roles:
   - Assign appropriate roles to access the required data
   

## Usage

Start the server:

```bash
node build/index.js
```

## Endpoint Configuration

Endpoints are configured in `src/endpoints.json`. Each endpoint has the following structure:

```json
{
    "path": "/your/endpoint/{param}",
    "description": "Description of what this endpoint does",
    "params": [
        {
            "name": "param",
            "description": "Description of the parameter",
            "type": "string",
            "required": true
        }
    ]
}
```

- `path`: The API endpoint path, with path parameters in curly braces
- `description`: A description of what the endpoint does
- `params`: Array of parameter definitions
  - `name`: Parameter name
  - `description`: Parameter description
  - `type`: Parameter type (currently only string)
  - `required`: Whether the parameter is required

Parameters that appear in the path (e.g., `{param}`) are used for path substitution. Other parameters are automatically added as query parameters.

## Tool Names

Tool names are automatically generated from endpoint paths:
- Path separators are replaced with underscores
- Path parameters are replaced with "by_param"
- Names are truncated to 64 characters if needed
- Uniqueness is ensured with numeric suffixes if needed

Example: `/catalogs/{id}/products` becomes `catalogs_by_id_products`

## License

MIT