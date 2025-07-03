# Integration Testing Guide

This project includes comprehensive integration tests for the SFCC MCP Server search endpoints that make actual OCAPI calls to validate real-world functionality.

## Integration Tests

The integration tests are located in `tests/integration-search.test.ts` and test all search endpoints:
- `product_search`
- `catalog_search`
- `campaign_search` 
- `promotion_search`
- `coupon_search`
- `custom_objects_search`

### Prerequisites

To run integration tests, you need valid SFCC credentials configured as environment variables:

```bash
# Required environment variables
SFCC_ADMIN_CLIENT_ID=your_client_id
SFCC_ADMIN_CLIENT_SECRET=your_client_secret
SFCC_API_BASE=https://hostname.commercecloud.salesforce.com
```

Optional:
```bash
OCAPI_VERSION=v24_5  # defaults to v24_5 if not specified
```

### Running Integration Tests

1. **With environment variables set**: Tests will run against your SFCC instance
   ```bash
   npm test -- --testPathPatterns=integration-search.test.ts
   ```

2. **Without credentials**: Tests will be skipped automatically
   ```bash
   # Integration tests are skipped: SFCC credentials not found in environment variables
   npm test -- --testPathPatterns=integration-search.test.ts
   ```

3. **Using .env file**: Create a `.env` file in the project root with your credentials
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   npm test -- --testPathPatterns=integration-search.test.ts
   ```

### Test Coverage

The integration tests validate:

#### Search Functionality
- **Basic search**: Each endpoint with no parameters (falls back to `match_all_query`)
- **Text search**: Using name/code filters for finding specific entities
- **Term filters**: Exact matching on IDs, status fields, classes
- **Boolean filters**: enabled/disabled, online/offline flags
- **Multiple filters**: Complex queries combining multiple criteria
- **Pagination**: count and start parameters

#### Error Handling
- Invalid site IDs
- Invalid object types
- Graceful handling of OCAPI errors

#### Response Validation
- Presence of required fields (`hits`, `count`, `start`)
- No OCAPI fault responses
- Proper array structures
- Pagination behavior

### Test Environment Considerations

- Tests use `SiteGenesis` as the default site ID (standard demo site)
- Custom object tests use `SitePreferences` object type (commonly available)
- Search terms use generic values likely to exist in most environments
- Tests are designed to be non-destructive (read-only operations)
- 30-second timeout per test to accommodate network latency

### Example Test Run

```bash
$ npm test -- --testPathPatterns=integration-search.test.ts

> sfcc-mcp-server@1.0.12 test
> jest --testPathPatterns=integration-search.test.ts

 PASS  tests/integration-search.test.ts (25.123 s)
  Search Endpoints Integration Tests
    Product Search Integration
      ✓ should handle product search with no parameters (match_all) (2341 ms)
      ✓ should handle product search with name filter (1876 ms)
      ✓ should handle product search with pagination (1923 ms)
      ✓ should handle product search with multiple filters (2156 ms)
    Catalog Search Integration
      ✓ should handle catalog search with no parameters (match_all) (1654 ms)
      ✓ should handle catalog search with name filter (1789 ms)
      ✓ should handle catalog search with online_flag filter (1698 ms)
    Campaign Search Integration
      ✓ should handle campaign search with no parameters (match_all) (1876 ms)
      ✓ should handle campaign search with name filter (1823 ms)
      ✓ should handle campaign search with enabled filter (1756 ms)
      ✓ should handle campaign search with multiple filters (1945 ms)
    ...

Test Suites: 1 passed, 1 total
Tests:       27 passed, 27 total
Snapshots:   0 total
Time:        25.123 s
```

### Troubleshooting

1. **Tests are skipped**: Ensure environment variables are set correctly
2. **Authentication errors**: Verify client ID and secret are valid
3. **Network timeouts**: Check SFCC_API_BASE URL and network connectivity
4. **OCAPI errors**: Ensure your client has proper permissions for OCAPI data access

The integration tests provide confidence that the search query generation works correctly with actual SFCC environments and don't just pass unit tests.