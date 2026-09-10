# AI Assistant Company Lookup Implementation Guide

## Overview

This document describes the implementation of company lookup functionality for the AI Invoice Assistant (`/dashboard/ai-assistant`). The feature enables users to create invoices with real company data by mentioning company names or EIKs in natural language prompts.

## Architecture

### Data Flow

```
User Prompt
    ↓
Extract Company Queries (Regex parsing)
    ↓
Server-Side Company Lookup (DB first → External API fallback)
    ↓
Create/Update Invoice with Real Data
    ↓
Display in Preview Pane
```

## Implementation Details

### 1. Server Action: `src/app/dashboard/ai-assistant/action.ts`

**New exports:**
- `searchCompaniesInDatabase(accountId, query)` - Query Organization and Contragent tables
- `searchCompanyExternal(eik)` - Call external CompanyBook API for unknown companies
- `lookupCompany(accountId, query)` - Unified lookup (DB first, then external)
- `getAccountData()` - Fetch user's account with organization metadata

**Database Search Logic:**
- Searches both `Organization` and `Contragent` tables
- Matches by name, bulstat (EIK), or VAT number (case-insensitive)
- Returns max 5 results per entity type
- **Only searches within user's account** (security boundary)

**External Fallback:**
- Triggers if company not found in DB
- Requires 9+ digit EIK or query length >= 9
- Calls existing `/api/organizations/search` endpoint
- Returns `SearchResult` with company data from CompanyBook API

**Return Type: `CompanyLookupResult`**
```typescript
{
  found: boolean;
  type?: "organization" | "contragent" | "external";
  organization?: { id, name, bulstat, vatNumber, molName, email, address, bank, iban, bic };
  contragent?: { id, name, bulstat, vatNumber, molName, email, address, organizationId };
  externalResult?: SearchResult;
  error?: string;
}
```

### 2. Component Enhancement: `src/page-components/ai-assistant.tsx`

**New Functions:**

1. **`extractCompanyQueries(prompt: string)`**
   - Regex patterns to detect company mentions
   - Patterns:
     - Buyer: `for|buyer|contragent|to|invoice to|paid by`
     - Seller: `from|seller|issued by|my company|by`
   - Returns `{ buyerQuery?, sellerQuery? }`

2. **`createInvoiceFromCompanyData(sellerData, buyerData, account)`**
   - Creates `BulgarianInvoiceData` with real company information
   - Populates:
     - Seller: name, EIK, VAT, address, MOL, bank details
     - Buyer: name, EIK, VAT, address, MOL
     - Invoice: series prefix, sequence from account organization
   - Uses fallback values for missing data

3. **Enhanced `sendMessage()` Handler**
   - Before creating/refining invoice:
     1. Extract company queries from prompt
     2. Lookup both seller and buyer (parallel)
     3. If both found → create invoice with real data
     4. If only one found → update that party, ask for other
     5. If not found but mentioned → send error message with EIK request

**User Flow:**

```
Scenario 1: Both companies found
User: "Create invoice from EIK 123456789 for buyer EIK 987654321"
Assistant: ✓ Found both companies!
           📤 Seller: Company A (EIK: 123456789)
           📥 Buyer: Company B (EIK: 987654321)
           Invoice draft created with real company data.

Scenario 2: Only buyer found
User: "Create invoice for ABC Corp with consulting - 1200 BGN"
Assistant: ✓ Found buyer: ABC Corp (EIK: 123456789)
           Now describe the seller or provide the seller's EIK.

Scenario 3: Company not found
User: "Create invoice for Unknown Company Ltd"
Assistant: ❌ Could not find the companies you mentioned (buyer: "Unknown Company Ltd").
           Please provide their EIK (9-digit company ID) so I can search the database...
           Example: "Create invoice for buyer EIK 123456789 from seller EIK 987654321"
```

### 3. Type Updates

**Enhanced `AccountContext` type:**
```typescript
type AccountContext = {
  id: number;
  creditBalance?: number | null;
  composer_name?: string | null;
  organizations?: Array<{
    id: number;
    name: string;
    bulstat: string | null;
    invoiceSeriesPrefix: string;
    nextInvoiceSeq: number;
  }>;
} | null;
```

**New `CompanyLookupResult` type in action.ts**

### 4. i18n Keys

Existing translation keys handle the new messages via existing keys:
- `aiChat.title`, `aiChat.subtitle` - Main headers
- `aiChat.generating` - Loading state
- Dynamic messages are constructed in component (with ✓, ❌, 📤, 📥 emojis)

## Data Sources and Lookups

### Priority Order

1. **Organization Table** (User's account)
   - Columns used: `id`, `name`, `bulstat`, `vatNumber`, `molName`, `email`, `address`, `bank`, `iban`, `bic`
   - Index: `organizationId` filtered by `accountId`

2. **Contragent Table** (User's account)
   - Columns used: `id`, `name`, `bulstat`, `vatNumber`, `molName`, `email`, `address`, `organizationId`
   - Index: `organizationId` filtered by account's organizations

3. **External API** (CompanyBook API)
   - Endpoint: `/api/organizations/search?q={eik}`
   - Used when: Not found in DB + query is 9+ digits or length >= 9
   - Returns: `SearchResult` with raw company data

### Security

- Database queries always filtered by `accountId` (current user's account)
- Can only find/use companies within their own account
- External API calls use existing API key from `.env`
- No cross-account data leakage possible

## GeneratedInvoice Integration

When user saves the draft AI invoice, it can be submitted via existing flow:

**Required Fields (from GeneratedInvoice schema):**
- `invoiceSeries` - From Organization
- `invoiceNumber` - Auto-generated from prefix + sequence
- `issueDate` - From prompt or today
- `taxEventDate` - From prompt or today
- `currency` - BGN (default)
- `subtotal`, `vatAmount`, `totalAmount` - Calculated from line items
- `organizationId` - User's selected organization
- `contragentId` - Buyer contragent ID (if found in DB)

**LineItems (InvoiceLineItem table):**
- `description` - From prompt or manual entry
- `quantity`, `unitPrice`, `vatRate`, `lineTotal` - From user input
- `generatedInvoiceId` - FK to GeneratedInvoice

## Usage Examples

### Example 1: Natural Language with Company Lookup
```
User: "Create invoice from TechCorp for ABC Services - 5000 BGN"
System: Searches DB for "TechCorp" and "ABC Services"
        If both found: Creates invoice with real EIKs, addresses, etc.
        If not found: Asks for EIKs
```

### Example 2: EIK-Based Lookup
```
User: "Create invoice from EIK 123456789 for buyer EIK 987654321"
System: Looks up both EIKs in DB first
        If not in DB: Queries external API
        Creates invoice with full company data
```

### Example 3: Partial Information + Refinement
```
User: "Invoice for Tech Solutions"
Assistant: ✓ Found buyer: Tech Solutions (EIK: 123456789)
           Now describe the seller...

User: "From my company TechCorp"
Assistant: ✓ Found seller: TechCorp (EIK: 987654321)
           Invoice created with both parties.
```

## Testing Considerations

### Test Cases

1. **Company Found in DB (Organization)**
   - Mock: Organization with full data
   - Expected: Invoice populated with real data

2. **Company Found in DB (Contragent)**
   - Mock: Contragent with full data
   - Expected: Invoice populated with real data

3. **Company Found in External API**
   - Mock: Contragent not in DB, but API returns result
   - Expected: Invoice uses external data

4. **Company Not Found Anywhere**
   - Mock: No DB match, API returns empty
   - Expected: Error message asking for EIK

5. **Partial Information (One Party Found)**
   - Mock: Buyer in DB, seller not found
   - Expected: Buyer populated, assistant asks for seller

6. **Multiple Results**
   - Mock: 5+ matches in DB
   - Expected: Uses first result (by DB order)

7. **Invalid EIK Format**
   - Mock: User provides "ABC" as EIK
   - Expected: Treated as company name, not EIK

### Security Tests

1. Cross-account data isolation
   - User A's organizations should not appear in User B's searches
   - Tested via `accountId` filter in Prisma queries

2. External API fallback only on valid input
   - EIK must be 9+ digits
   - Prevents unnecessary API calls

## Future Enhancements

### Phase 2: Save to Database

Current system uses sessionStorage only. Next phase could:

1. **Save Invoice Drafts**
   - Create entry in `GeneratedInvoice` with status `DRAFT`
   - Store `sourceDocumentId` for tracking
   - Allow users to continue editing across sessions

2. **Persistent Conversation**
   - Store `ChatMessage` history in new table `AIAssistantSession`
   - Link to user account for audit trail
   - Enable multi-device access

3. **Analytics**
   - Track which companies are frequently mentioned
   - Log successful invoice creations
   - Measure time-to-creation improvement

### Phase 3: Advanced Features

1. **Multi-line Item Recognition**
   - Parse "Item A - 100 BGN, Item B - 200 BGN"
   - Auto-add multiple line items from single prompt

2. **Line Item Templates**
   - Remember common line items per company
   - Auto-suggest "Add recurring monthly support?"

3. **Invoice Prefill from Files**
   - Upload supplier invoices
   - Auto-extract company data
   - Pre-fill buyer/seller from file

4. **Approval Workflow**
   - Send draft to accountant for approval before submitting
   - Comment/feedback loop
   - Audit trail of changes

## Performance Considerations

### Database Queries

- `searchCompaniesInDatabase()`: O(1) - Uses indexes on name, bulstat, vatNumber
- Limit 5 results per entity type to prevent large result sets
- Only searches within user's account (index filtering)

### Caching

- Company lookup results cached in sessionStorage
- Reduces API calls on repeated company mentions
- Cleared on new invoice session

### API Rate Limiting

- External API has rate limits (429 response)
- Handler: Falls back to DB cache if available
- Users encouraged to provide EIKs for known companies

## Related Files

**Modified:**
- `src/app/dashboard/ai-assistant/page.tsx` - Updated route to use new action
- `src/page-components/ai-assistant.tsx` - Added company lookup and invoice creation from real data
- `src/app/dashboard/ai-assistant/action.ts` - Added server actions for company lookup

**Unchanged (existing patterns followed):**
- `src/app/api/organizations/search/route.ts` - External API integration
- `src/app/api/generate-pdf/route.ts` - PDF generation
- `prisma/schema.prisma` - No schema changes

## Configuration

### Environment Variables Required

None new - uses existing:
- `COMPANY_BOOK_API_KEY` - For external company lookups
- Database connection string (Prisma)

### Feature Flags

Currently always enabled. Could be wrapped in:
- `feature.aiAssistantCompanyLookup` config flag
- Gradual rollout to users

## Troubleshooting

### Issue: Company not found in DB but exists

**Cause:** Company is in external registry but not yet added to user's contacts

**Solution:** 
- User must provide 9-digit EIK
- System will fetch from external API
- Offer to save company for future use (Phase 2)

### Issue: Slow lookup response

**Cause:** External API rate limit or network delay

**Solution:**
- Implement exponential backoff
- Show "Searching external registry..." UI
- Timeout after 5s, suggest EIK entry

### Issue: Address fields empty in invoice

**Cause:** Company data from external API may have sparse address info

**Solution:**
- Allow user to manually edit address in invoice preview
- Cache corrected address for future use

## Monitoring and Logging

Recommended logging:

```typescript
// In lookupCompany() action
console.log(`[CompanyLookup] Query: "${query}", Result: ${result.found ? result.type : "NOT_FOUND"}`);

// In sendMessage()
console.log(`[AIAssistant] Buyer: ${buyerQuery} → ${buyerLookup?.found}, Seller: ${sellerQuery} → ${sellerLookup?.found}`);
```

Could integrate with:
- Sentry error tracking
- DataDog metrics
- Custom analytics dashboard
