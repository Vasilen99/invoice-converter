# Manual Organization Creation - Implementation Summary

## Overview

Implemented complete logic for manually creating organizations without external API calls. The system now supports both API-based search and manual entry, with full data validation and storage in both `Organization` and `CompanyRegistryCache` tables.

## Changes Made

### 1. **Validation Helper** (`utility/company-registry-helpers.ts`)

Added comprehensive validation function for manual entries:

```typescript
export function validateOrganizationFormData(data: {...}): {
  isValid: boolean;
  errors: Record<string, string>;
}
```

**Validations Implemented:**

- **legalName**: Required, 2-255 characters
- **bulstat** (UIC/EIK): Required, 9-10 digits format
- **vatNumber**: Optional but if provided must match format `BG` + 9-10 digits
- **molName**: Optional, max 255 characters
- **address.country**: Optional, max 100 characters
- **address.postCode**: Optional, valid format (alphanumeric, max 20)
- **address.street**: Optional, max 255 characters

### 2. **API Route Enhancement** (`src/app/api/organizations/add/route.ts`)

**New Features:**

- Added `isManualEntry` flag to distinguish between API and manual submissions
- Input sanitization (trim whitespace)
- Data enrichment from `rawLookupData` when available
- Validation for manual entries
- Support for both workflows:
  - **API Flow**: With `rawLookupData` from CompanyBook API
  - **Manual Flow**: Without external API data

**Key Improvements:**

1. Conditional validation based on `isManualEntry` flag
2. Address formatting using `formatAddressForStorage()`
3. Raw lookup data formatting using `formatRawLookupDataForStorage()`
4. Automatic registry cache creation for both flows:
   - **API entries**: Store complete `rawLookupData`
   - **Manual entries**: Store only structured data, no `rawLookupData`
5. Proper error responses with validation errors included
6. Logging for audit trail with source indication (MANUAL vs NAP_API)

**Registry Cache Handling:**

```typescript
// For API data
if (rawLookupData && isValidCompanyData(rawLookupData) && bulstat) {
  // Upsert with complete rawLookupData
}

// For manual entries
else if (isManualEntry && bulstat) {
  // Upsert without rawLookupData
}
```

### 3. **Frontend Integration** (`src/components/Organizations.tsx`)

**Implemented `handleAddManualOrganization()` function:**

- Calls `/organizations/add` endpoint with `isManualEntry: true`
- Includes validation error handling
- Updates UI with new organization
- Resets form after successful submission
- Provides user feedback via global alert system

**Request Format:**

```typescript
{
  legalName: string,
  bulstat: string,
  vatNumber?: string,
  molName?: string,
  address: AddressObject,
  isManualEntry: true
}
```

### 4. **Data Schema Alignment**

**Database Tables Affected:**

**Organization Table:**

- `source` field: "MANUAL" for manual entries, "NAP_API" for API entries
- `registryId`: Links to cached company data
- All address and company info stored directly

**CompanyRegistryCache Table:**

- `bulstat`: Unique key
- `legalName`: Company name
- `vatNumber`: VAT number (optional)
- `address`: Structured address as JSON
- `rawLookupData`: Full API response (NULL for manual entries)
- `lastFetchedAt`: Timestamp tracking

## Information Requirements

### Required Fields

1. **legalName** - Company legal name (string, 2-255 chars)
2. **bulstat** - Bulgarian UIC/EIK (9-10 digits)

### Optional Fields

1. **vatNumber** - VAT registration (format: BG + 9-10 digits)
2. **molName** - Manager/representative name (string, max 255 chars)
3. **address** - Complete address object with fields:
   - country, countryCode
   - district, municipality, settlement
   - street, streetNumber
   - block, entrance, floor, apartment
   - postCode

### System Fields (Auto-managed)

1. **invoiceSeriesPrefix** - Defaults to "INV"
2. **accountId** - Linked to current user's account
3. **source** - Set based on submission type
4. **registryId** - References cache entry if created
5. **createdAt** / **updatedAt** - Timestamps

## Error Handling

### Validation Errors

Returns 400 status with detailed error messages:

```json
{
  "data": null,
  "alert": {
    "status": "error",
    "header": "Validation failed",
    "message": "Please fix the following errors"
  },
  "validationErrors": {
    "bulstat": "BULSTAT must be 9 or 10 digits",
    "vatNumber": "VAT number must be in format BG followed by 9-10 digits"
  }
}
```

### Duplicate Prevention

- Checks if organization with same BULSTAT already exists in user's account
- Returns 200 status with info alert if duplicate found

### Registry Cache Failures

- Non-critical: Continues even if registry cache creation fails
- Logs error for debugging but doesn't break organization creation

## API Request Examples

### Manual Entry Request

```bash
POST /api/organizations/add
{
  "legalName": "MY COMPANY LLC",
  "bulstat": "207880021",
  "vatNumber": "BG207880021",
  "molName": "John Doe",
  "address": {
    "country": "Bulgaria",
    "district": "Sofia",
    "municipality": "Sofia",
    "settlement": "Sofia",
    "street": "Main Street",
    "streetNumber": "123",
    "postCode": "1000"
  },
  "isManualEntry": true
}
```

### API Search Result Request

```bash
POST /api/organizations/add
{
  "bulstat": "207880021",
  "legalName": "УЕБ СЪРВИСИС БЪЛГАРИЯ",
  "vatNumber": "BG207880021",
  "address": { /* ... */ },
  "molName": "Vasilen Minkov",
  "rawLookupData": { /* Complete CompanyData from API */ },
  "isManualEntry": false
}
```

## Testing Checklist

- [ ] Manual entry with all required fields
- [ ] Manual entry with validation errors (invalid BULSTAT, VAT format)
- [ ] Manual entry creates registry cache entry
- [ ] API entry still works with rawLookupData enrichment
- [ ] Duplicate BULSTAT prevention works
- [ ] Form resets after successful submission
- [ ] User feedback (alerts) displays correctly
- [ ] Registry cache queries work for both manual and API entries
- [ ] Address formatting works correctly with all fields
- [ ] Validation error messages display to user

## Future Enhancements

1. **Field-level Validation UI**: Show real-time validation errors in form
2. **Address Autocomplete**: Integrate with Bulgarian address database
3. **Bulk Import**: Support CSV/Excel uploads for multiple organizations
4. **Edit Organizations**: Implement edit functionality (currently shows TODO)
5. **Organization Lookup Cache**: Check if manual entry matches existing registry
6. **Audit Trail**: Track all manual entries separately for compliance
