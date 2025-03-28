# SFCC MCP Server

A Model Context Protocol (MCP) server for interacting with Salesforce Commerce Cloud (SFCC) APIs.

## Features

- Get product details using the Shopper Products API
- Get catalog information using the Admin Catalogs API
- Simple weather demonstration tool (mock data)

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
# SFCC API Configuration - Shared
SFCC_API_BASE=https://your-instance.api.commercecloud.salesforce.com/
SFCC_ORGANIZATION_ID=your_org_id
SFCC_SHORT_CODE=your_instance_id
SFCC_SITE_ID=your_site_id

# Shopper API Credentials (SLAS authentication)
SFCC_CLIENT_ID=your_shopper_client_id
SFCC_CLIENT_SECRET=your_shopper_client_secret

# Admin API Credentials (Client credentials flow)
SFCC_ADMIN_CLIENT_ID=your_admin_client_id
SFCC_ADMIN_CLIENT_SECRET=your_admin_client_secret
```

## Admin API Configuration

To use the Catalogs API, you need to configure an API client in SFCC with the proper permissions:

1. In SFCC Business Manager, go to Administration > Site Development > Open Commerce API Settings
2. Create a new API client or edit an existing one
3. Configure the OAuth settings:
   - OAuth Client ID: (your client ID)
   - OAuth Client Secret: (your client secret)
   - Default scopes: Include `sfcc.catalogs.rw`
   - Token Endpoint Auth Method: `client_secret_post`
4. Configure API client roles:
   - Assign appropriate roles to access catalog data
   - Required roles may include "Catalogs Manager" or similar
   
If you encounter a 403 Forbidden error with the Catalogs API, check that:
1. The API client has the correct scope (`sfcc.catalogs.rw`)
2. The API client has the necessary role assignments
3. The client has access to the specific catalogs in your organization
4. The organization_id and short_code values are correct

## Usage

You can run the server directly:

```bash
node build/index.js
```

Or use the test scripts:

```bash
# Test weather tool
npm run test:weather

# Test product tool
npm run test:product

# Test catalogs tool
npm run test:catalogs
```

## Mock Server

For development and testing, you can use the mock server:

```bash
# Run mock server
npm run mock

# Test specific tools with mock server
npm run mock:weather
npm run mock:product
npm run mock:catalogs
```

## API Tools

### get-weather

Gets weather information for a location (mock data).

```json
{
  "type": "request",
  "id": "123",
  "toolId": "get-weather",
  "toolInput": {
    "location": "San Francisco"
  }
}
```

### get-product-by-id

Gets product details by ID.

```json
{
  "type": "request",
  "id": "124",
  "toolId": "get-product-by-id",
  "toolInput": {
    "id": "5",
    "locale": "en_US",
    "currency": "USD"
  }
}
```

### get-catalogs

Gets available catalogs.

```json
{
  "type": "request",
  "id": "125",
  "toolId": "get-catalogs",
  "toolInput": {}
}
```

## License

MIT