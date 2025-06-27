# SFCC MCP Server - Endpoint Reduction

This document explains the endpoint reduction performed to address tool registration limits in MCP agents.

## Summary

- **Original endpoints**: 65 tools
- **Reduced endpoints**: 26 tools  
- **Reduction**: 60% fewer tools
- **Goal**: Stay within agent tool limits while preserving essential SFCC functionality

## Reduction Strategy

### Kept (Essential Tools)
1. **Product Operations**
   - `product_search` - Primary product search functionality
   - `product_details` - Get detailed product information with expansion options

2. **Catalog Management**
   - `catalogs` - List all catalogs
   - `catalog_by_id` - Get specific catalog details
   - `catalog_search` - Search catalogs
   - `catalog_categories` - Browse catalog categories
   - `catalog_category_by_id` - Get specific category details

3. **Site Management**
   - `sites` - List all sites
   - `site_by_id` - Get specific site details

4. **Campaign & Promotion Management**
   - `campaign_search` - Search campaigns by site
   - `campaign_by_id` - Get campaign details
   - `promotion_search` - Search promotions by site
   - `promotion_by_id` - Get promotion details
   - `coupon_search` - Search coupons by site
   - `coupon_by_id` - Get coupon details

5. **Inventory Management**
   - `inventory_lists` - List inventory lists
   - `inventory_list_by_id` - Get inventory list details
   - `product_inventory_record` - Get product inventory details

6. **Customer Management**
   - `customer_list_by_id` - Get customer list details
   - `customer_by_number` - Get specific customer
   - `customer_groups` - List customer groups by site
   - `customer_group_by_id` - Get customer group details

7. **Custom Objects**
   - `custom_objects_search` - Search custom objects by type
   - `custom_object_by_key` - Get specific custom object

8. **System Information**
   - `locales` - Get available locales
   - `code_versions` - List code versions

### Removed (Redundant/Granular Tools)

1. **Highly Granular Product Endpoints** (removed 15+ endpoints)
   - Product option values by ID
   - Variation attribute values by ID
   - Individual variation groups and variations
   - These can be accessed via the main `product_details` endpoint with proper `expand` parameters

2. **Redundant Category Access** (removed 1 endpoint)
   - `category_search` - Categories can be found via catalog endpoints

3. **Granular Catalog Sub-resources** (removed 4 endpoints)
   - Shared product options and variation attributes by ID
   - These are less commonly needed and can be accessed programmatically

4. **Site Sub-resource Details** (removed 15+ endpoints)
   - Deep drill-down endpoints for coupons, campaigns, stores, preferences
   - Many site-specific resource details that can be found via search

5. **Customer Sub-resources** (removed 2 endpoints)
   - Customer addresses and detailed customer group members
   - Can be accessed via main customer endpoints

6. **Miscellaneous Specific Access** (removed 5+ endpoints)
   - Library content, global preferences, gift certificates
   - Less commonly used endpoints

## Impact Assessment

### ✅ Preserved Functionality
- All major search capabilities (products, campaigns, promotions, coupons)
- Core product and catalog browsing
- Essential site and inventory management
- Customer and custom object access
- System configuration access

### 🔄 Modified Access Patterns
- Granular product details now accessed via `product_details` with `expand` parameter
- Some sub-resources now require multiple API calls instead of direct access
- Deep catalog navigation may require multiple calls through category hierarchy

### ⚠️ Trade-offs
- Agents may need to make multiple API calls for some detailed operations
- Less direct access to very specific sub-resources
- Some convenience endpoints removed in favor of more general search-based approaches

## Migration Notes

If you were using removed endpoints, here are the recommended alternatives:

1. **Product variations/options**: Use `product_details` with `expand=variations,options`
2. **Category access**: Use `catalog_categories` or navigate through catalog hierarchy
3. **Site sub-resources**: Use respective search endpoints then get details by ID
4. **Customer details**: Use main customer endpoints and make additional calls as needed

## Future Considerations

- Monitor agent usage patterns to identify if any removed endpoints should be restored
- Consider creating custom handlers for common multi-step operations
- Evaluate adding composite endpoints that combine multiple operations if needed