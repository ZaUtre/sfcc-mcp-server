# Enhanced Search Endpoints

This document describes the enhanced search functionality implemented for all SFCC MCP Server search endpoints.

## Overview

Previously, search endpoints only supported returning all results via `match_all_query`. Now, all search endpoints support meaningful search criteria and filtering options while maintaining backward compatibility.

## Search Endpoints

### 1. Product Search (`product_search`)
**Path:** `/product_search`

**Search Parameters:**
- `product_name`: Search by product name (text search)
- `category_id`: Filter by category ID
- `min_price` / `max_price`: Price range filtering
- `expand`: Comma-separated list of resources to expand
- `inventory_ids`: Comma-separated list of inventory list IDs
- `count` / `start`: Pagination

### 2. Catalog Search (`catalog_search`)
**Path:** `/catalog_search`

**Search Parameters:**
- `catalog_name`: Search by catalog name (text search)
- `catalog_id`: Filter by catalog ID
- `online_flag`: Filter by online status (true/false)
- `count` / `start`: Pagination

### 3. Campaign Search (`campaign_search`)
**Path:** `/sites/{site_id}/campaign_search`

**Search Parameters:**
- `campaign_name`: Search by campaign name (text search)
- `campaign_id`: Filter by campaign ID
- `enabled`: Filter by enabled status (true/false)
- `customer_groups`: Comma-separated list of customer group IDs
- `count` / `start`: Pagination

### 4. Promotion Search (`promotion_search`)
**Path:** `/sites/{site_id}/promotion_search`

**Search Parameters:**
- `promotion_name`: Search by promotion name (text search)
- `promotion_id`: Filter by promotion ID
- `enabled`: Filter by enabled status (true/false)
- `promotion_class`: Filter by promotion class (product, order, shipping)
- `count` / `start`: Pagination

### 5. Coupon Search (`coupon_search`)
**Path:** `/sites/{site_id}/coupon_search`

**Search Parameters:**
- `coupon_code`: Search by coupon code (text search)
- `coupon_id`: Filter by coupon ID
- `enabled`: Filter by enabled status (true/false)
- `single_use`: Filter by single use flag (true/false)
- `count` / `start`: Pagination

### 6. Custom Objects Search (`custom_objects_search`)
**Path:** `/custom_objects/{object_type}`

**Search Parameters:**
- `key_pattern`: Search by key pattern (supports wildcards with `*`)
- `custom_field`: Search by custom field (format: `field_name:value`)
- `count` / `start`: Pagination

## Query Structure

All search endpoints use SFCC OCAPI query format:

### Text Search
```json
{
  "query": {
    "text_query": {
      "fields": ["name"],
      "search_phrase": "search term"
    }
  }
}
```

### Term Query (Exact Match)
```json
{
  "query": {
    "term_query": {
      "fields": ["id"],
      "operator": "is",
      "values": ["exact_value"]
    }
  }
}
```

### Boolean Query (Multiple Filters)
```json
{
  "query": {
    "bool_query": {
      "must": [
        {
          "text_query": {
            "fields": ["name"],
            "search_phrase": "search term"
          }
        },
        {
          "term_query": {
            "fields": ["enabled"],
            "operator": "is",
            "values": ["true"]
          }
        }
      ]
    }
  }
}
```

### Prefix Query (Wildcard Support)
```json
{
  "query": {
    "prefix_query": {
      "field": "key",
      "prefix": "config_"
    }
  }
}
```

## Fallback Behavior

When no search criteria are provided, all endpoints fall back to the original behavior:

```json
{
  "query": {
    "match_all_query": {}
  }
}
```

## Examples

### Search for Enabled Campaigns
```bash
# Using the endpoint
POST /sites/SiteGenesis/campaign_search
{
  "campaign_name": "summer",
  "enabled": true,
  "count": 10
}
```

### Search Custom Objects by Key Pattern
```bash
# Using the endpoint
POST /custom_objects/SitePreferences
{
  "key_pattern": "config_*",
  "count": 20
}
```

### Search Promotions by Class
```bash
# Using the endpoint
POST /sites/SiteGenesis/promotion_search
{
  "promotion_class": "product",
  "enabled": true
}
```

## Implementation Details

- All search handlers are implemented in `src/handler-registry.ts`
- Reusable base search handler pattern for consistency
- Comprehensive test coverage in `tests/search-handlers.test.ts`
- Query building follows SFCC OCAPI standards
- Consistent logging and error handling across all endpoints