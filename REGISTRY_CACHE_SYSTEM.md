# Company Registry Cache System

## Overview

The company registry cache system is designed to efficiently manage external API data from the CompanyBook API. It stores complete company information locally for quick retrieval and fallback scenarios.

## Architecture

### Core Components

#### 1. **CompanyRegistryCache Model** (Prisma)

Located in `prisma/schema.prisma`:

```prisma
model CompanyRegistryCache {
  id            Int            @id @default(autoincrement())
  bulstat       String         @unique
  legalName     String
  vatNumber     String?
  address       Json?
  rawLookupData Json?
  lastFetchedAt DateTime       @default(now())
  createdAt     DateTime       @default(now())
}
```

**Fields:**

- `bulstat`: Unique identifier (Bulgarian business registration number)
- `legalName`: Company legal name
- `vatNumber`: VAT registration number (optional)
- `address`: Structured address data (JSON)
- `rawLookupData`: Complete CompanyData object from API (JSON)
- `lastFetchedAt`: Timestamp of last API fetch
- `createdAt`: Record creation timestamp

#### 2. **Helper Functions** (`utility/company-registry-helpers.ts`)

##### `transformAddressFromCompanyData(company: CompanyData)`

Extracts and normalizes address data from API response into a consistent format.

**Fields extracted:**

- country, countryCode
- district, municipality, settlement
- street, streetNumber
- block, entrance, floor, apartment
- postCode

##### `extractVatNumber(company: CompanyData): string | null`

Extracts VAT number from `company.registerInfo.vat`

##### `extractManagerName(company: CompanyData): string`

Extracts primary manager/representative name from first manager in `company.managers`

##### `enrichOrganizationDataFromRegistry(organizationData, rawLookupData)`

Enriches incomplete organization data with cached company information:

- Fills missing legalName
- Fills missing vatNumber
- Fills missing address fields
- Fills missing molName (manager name)

##### `isValidCompanyData(data): boolean`

Type guard to validate CompanyData structure contains required fields.

#### 3. **Registry Cache Utilities** (`utility/registry-cache.ts`)

##### `getCachedCompanyData(bulstat: string): Promise<CompanyData | null>`

Retrieves cached company data by BULSTAT. Used by search and add operations.

```typescript
// Example usage
const cachedData = await getCachedCompanyData("207880021");
if (cachedData) {
  // Use cached data
}
```

##### `getOrCreateRegistryCache(bulstat, legalName, rawLookupData)`

Ensures a registry entry exists, creating if necessary.

##### `updateRegistryCacheTimestamp(bulstat: string)`

Updates the `lastFetchedAt` timestamp for an entry.

##### `isRegistryCacheStale(bulstat: string, staleDays: number = 30): boolean`

Checks if cached data needs refresh based on age.

##### `cleanupOldRegistryCache(olderThanDays: number = 90)`

Removes entries older than specified days. Useful for database maintenance.

## API Integration

### Search Endpoint (`/api/organizations/search`)

**Flow:**

1. **Check Cache First** (unless `?skipCache=true`)
   - Queries `getCachedCompanyData()`
   - If found, returns immediately (fast response)

2. **Fallback to API** if cache miss
   - Calls CompanyBook API
   - Stores result in registry cache

3. **Fallback Chain on Errors:**
   - Rate limited (429)? → Try cache
   - API error? → Try cache
   - No cache available? → Return error

**Example:**

```bash
# Use cache if available
GET /api/organizations/search?q=207880021

# Force fresh data from API
GET /api/organizations/search?q=207880021&skipCache=true
```

### Add Organization Endpoint (`/api/organizations/add`)

**Flow:**

1. Receives organization data with optional `rawLookupData`
2. **Data Enrichment:**
   - If `rawLookupData` provided and valid, enriches sparse fields
   - Validates all required fields present
3. **Registry Cache Creation:**
   - Stores `rawLookupData` in `CompanyRegistryCache`
   - Links `Organization` to registry via `registryId`
4. **Organization Creation:**
   - Creates `Organization` record with enriched data
   - Sets `source: "NAP_API"` (external API source)

**Request Payload:**

```typescript
{
  bulstat: "207880021",
  legalName: "УЕБ СЪРВИСИС БЪЛГАРИЯ",
  vatNumber: "BG207880021",
  address: { /* ... */ },
  molName: "ВАСИЛЕН КРАСИСЛАВОВ МИНКОВ",
  rawLookupData: { /* Full CompanyData from API */ }
}
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Search Request                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Check Cache First?  │
        └──────┬────────┬──────┘
               │        │
        Cache Hit      Cache Miss
               │        │
               │        ▼
               │    ┌──────────────────┐
               │    │  Call API        │
               │    │  CompanyBook     │
               │    └────────┬─────────┘
               │             │
               │             ▼
               │  ┌──────────────────────┐
               │  │  Cache Result in DB  │
               │  │  (CompanyRegistryCache)
               │  └────────┬─────────────┘
               │           │
               └───────┬───┘
                       │
                       ▼
        ┌──────────────────────────┐
        │ Transform to SearchResult │
        └──────────┬────────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │  Return to Frontend      │
        └──────────────────────────┘
                   │
                   ▼
        User selects result
                   │
                   ▼
        ┌──────────────────────────┐
        │  POST /organizations/add │
        └──────────┬───────────────┘
                   │
                   ▼
        ┌────────────────────────────────┐
        │ Enrich data from rawLookupData  │
        └──────────┬─────────────────────┘
                   │
                   ▼
        ┌────────────────────────────────┐
        │ Update/Create Registry Cache   │
        └──────────┬─────────────────────┘
                   │
                   ▼
        ┌────────────────────────────────┐
        │ Create Organization Record     │
        │ (source: NAP_API)              │
        └────────────────────────────────┘
```

## Benefits

1. **Performance:**
   - Cached searches return instantly
   - Reduces external API calls

2. **Reliability:**
   - Fallback to cache when API is unavailable
   - Graceful degradation on rate limiting

3. **Data Consistency:**
   - Complete company data preserved
   - Facilitates data enrichment and validation

4. **Cost Efficiency:**
   - Fewer API calls = lower costs
   - Reduced bandwidth usage

5. **Audit Trail:**
   - `lastFetchedAt` tracks data freshness
   - Complete raw data stored for reference

## Usage Examples

### Search with automatic caching

```typescript
// First call hits API and caches
const result1 = await fetch("/api/organizations/search?q=207880021");

// Second call uses cache (instant)
const result2 = await fetch("/api/organizations/search?q=207880021");
```

### Force fresh data

```typescript
// Bypass cache and hit API
const result = await fetch(
  "/api/organizations/search?q=207880021&skipCache=true",
);
```

### Check if data is stale

```typescript
import { isRegistryCacheStale } from "@/utility/registry-cache";

const stale = await isRegistryCacheStale("207880021", 30); // 30 days
if (stale) {
  // Refresh data from API
}
```

### Cleanup old entries

```typescript
import { cleanupOldRegistryCache } from "@/utility/registry-cache";

// Remove entries not accessed in 90 days (good for cron job)
const cleaned = await cleanupOldRegistryCache(90);
console.log(`Cleaned up ${cleaned} old entries`);
```

## Database Schema Notes

The `rawLookupData` field stores the complete `CompanyData` object as JSON:

```typescript
type CompanyData = {
  uic: string;
  companyName?: { name: string };
  legalForm: string;
  status: string;
  seat?: AddressData;
  correspondenceSeat?: AddressData;
  managers?: Person[];
  registerInfo?: RegisterInfo;
  // ... and many other fields
};
```

This ensures we can reconstruct complete organization information without additional API calls.

## Monitoring & Maintenance

### Key Metrics to Track

- Cache hit rate: `(cached_results) / (total_searches)`
- Data freshness: Age of most recently fetched entries
- Cache size: Number of entries in `CompanyRegistryCache`

### Recommended Maintenance

- Run `cleanupOldRegistryCache(90)` weekly or monthly
- Monitor `lastFetchedAt` timestamps
- Track API error rates to optimize fallback strategy

## Error Handling

The system implements a multi-level fallback:

1. Try cache (instant)
2. Try API with full data
3. Try cache again (fallback)
4. Return error with helpful message

This ensures maximum availability even when external APIs are unreliable.
