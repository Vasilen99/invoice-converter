# AI Invoice Assistant - Complete Workflow Documentation

**Last Updated**: September 2026  
**System**: AI-Powered Bulgarian Invoice Generator  
**Framework**: Next.js 14+ with TypeScript, Prisma ORM  
**AI Model**: OpenAI gpt-5.6-luna with responses API  
**Status**: Production Ready ✓

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture & Data Flow](#architecture--data-flow)
3. [Page Flow Diagram](#page-flow-diagram)
4. [Detailed Component Breakdown](#detailed-component-breakdown)
5. [Data Types & Interfaces](#data-types--interfaces)
6. [Server-Side Logic](#server-side-logic)
7. [Client-Side Logic](#client-side-logic)
8. [Company Resolution Pipeline](#company-resolution-pipeline)
9. [Invoice Patch Strategies](#invoice-patch-strategies)
10. [Error Handling & Status Codes](#error-handling--status-codes)
11. [Database Operations](#database-operations)
12. [API Endpoints Reference](#api-endpoints-reference)

---

## System Overview

The AI Invoice Assistant is a multi-turn conversational interface that enables users to create and edit Bulgarian invoices through natural language prompts. The system leverages OpenAI's language model to extract invoice intent and data from user input, resolve company information from multiple sources (user account DB, cache, external API), and progressively build invoice documents.

### Key Features

- **Natural Language Processing**: Converts user prompts to invoice operations
- **Multi-Source Company Resolution**: DB → Cache → External API with automatic persistence
- **Edit-Safe Invoice Patching**: Prevents unintended data overwrites in multi-turn conversations
- **Real-Time Collaboration**: Maintains draft state across turns with field change tracking
- **PDF Generation & Download**: Generate, upload, and download invoice PDFs
- **Automatic Company Persistence**: External API results automatically saved to database

---

## Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────┐
│                     User Browser (React)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ AIAssistantPage                                            │ │
│  │  • Chat message state                                      │ │
│  │  • Current draft invoice                                   │ │
│  │  • Message rendering (user + assistant)                   │ │
│  └────────────┬─────────────────────────────────────────────┘ │
└─────────────┼──────────────────────────────────────────────────┘
              │ POST /api/ai-assistant/chat-invoice
              │ (prompt, currentInvoice, accountOrgs)
              │
┌─────────────▼──────────────────────────────────────────────────┐
│          Server-Side Route Handler (Node.js/Next.js)           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ route.ts - POST Handler                                    │ │
│  │                                                             │ │
│  │ 1. Validate user + extract request body                    │ │
│  │ 2. Load accountOrgs (from client or DB)                    │ │
│  │ 3. Extract prompt data via OpenAI                          │ │
│  │    ↓ (EXTRACTION_PROMPT)                                   │ │
│  │ 4. Resolve seller (organization) company                  │ │
│  │    ↓ (4-Tier Pipeline)                                    │ │
│  │ 5. Resolve buyer (contragent) company                     │ │
│  │ 6. Build/Merge invoice with resolved data                 │ │
│  │ 7. Track changed fields                                   │ │
│  │ 8. Return updated invoice + assistant message             │ │
│  └────────────┬──────────────────────────────────────────────┘ │
│              │                                                  │
│  ┌──────────┴──────────────────────────────────────────────────┐ │
│  │ Prisma Database                                            │ │
│  │  • organizations (seller)                                  │ │
│  │  • contragents (buyer)                                     │ │
│  │  • companyRegistryCache (cached lookups)                   │ │
│  │  • invoices (persisted PDFs)                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ External Services                                          │ │
│  │  • OpenAI API (gpt-5.6-luna) - Intent extraction           │ │
│  │  • CompanyBook API - Company registry lookup               │ │
│  │  • Supabase Storage - PDF uploads                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
              │ ChatResponse JSON
              │ (invoice, changedFields, status)
              │
┌─────────────▼──────────────────────────────────────────────────┐
│                  Browser UI Update                              │
│  • Add user message to chat                                     │
│  • Display assistant response                                   │
│  • Render invoice preview inline                                │
│  • Enable Save & Download button                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Page Flow Diagram

### Initial Load

```
Page.tsx (Server Component)
│
├─ Call: getUserAccountData()
│  └─ Fetch user + organizations + contragents from Prisma
│     └─ Serialize Decimal → string
│
└─ Pass: account: AccountContext
   │
   └─ Render: AIAssistantPage { account }
      │
      └─ useEffect: Initialize with welcome message
         └─ Display: "Welcome to AI Invoice Assistant..."
```

### User Sends Message

```
User Types Message & Presses Enter (or clicks Send)
│
├─ Validate: messageInput.trim().length > 0
├─ Clear: setMessageInput("")
├─ Push: User message to chat history
├─ Set: isGenerating = true
│
└─ POST /api/ai-assistant/chat-invoice
   ├─ Body: {
   │    prompt: "Create invoice from ABC Corp for 100 BGN",
   │    currentInvoice: BulgarianInvoiceData | null,
   │    accountOrgs: AccountOrgSnapshot[]
   │  }
   │
   └─ Server Processing (see: Route Handler Flow)
      │
      └─ Return: ChatResponse { invoice, changedFields, status }
         │
         ├─ If status = "ok":
         │  ├─ setCurrentInvoice(data.invoice)
         │  ├─ Push assistant message + invoice preview
         │  └─ Show changed fields badge
         │
         ├─ If status = "unsupported":
         │  ├─ Push fallback message
         │  └─ No invoice update
         │
         ├─ If status = "missing-draft":
         │  ├─ Push: "Create an invoice first"
         │  └─ No invoice update
         │
         ├─ If status = "company-not-found":
         │  ├─ Push: "Couldn't find company..."
         │  └─ Keep current invoice
         │
         └─ If status = "invalid-input":
            ├─ Push: "Server processing error"
            └─ Keep current invoice
   │
   ├─ setIsGenerating(false)
   └─ Scroll to bottom of messages
```

### User Saves & Downloads Invoice

```
User Clicks "Save & Download" Button
│
├─ Validate: currentInvoice exists + hasSellerData + hasBuyerData
├─ Set: isSaving = true
│
├─ Step 1: Generate PDF
│  ├─ POST /api/generate-pdf
│  │  └─ Body: BulgarianInvoiceData
│  │     └─ Return: PDF Blob
│  │
│  └─ Upload to Supabase Storage
│     ├─ Path: /invoices/{accountId}/{sellerEik}/*
│     └─ Return: generatedPdfUrl (public URL)
│
├─ Step 2: Record Invoice in Database
│  ├─ POST /api/record-invoice
│  │  └─ Body: {
│  │     invoiceData: BulgarianInvoiceData,
│  │     generatedPdfUrl: string | null,
│  │     skipSourceDocumentCreation: true
│  │   }
│  │
│  ├─ Server Operations:
│  │  ├─ Resolve seller organization (external API if needed)
│  │  ├─ Auto-upsert to DB if from external API
│  │  ├─ Create invoice record with PDF URL
│  │  └─ Return: { success, invoiceId }
│  │
│  └─ If successful:
│     └─ Show: "Invoice saved successfully"
│
└─ Step 3: Download PDF to User's Computer
   ├─ Create: Blob URL from PDF
   ├─ Create: Temporary <a> link element
   ├─ Trigger: link.click()
   ├─ Cleanup: Revoke Blob URL
   └─ Show: "Invoice saved and downloaded"
```

---

## Detailed Component Breakdown

### 1. Page Component (`src/app/dashboard/ai-assistant/page.tsx`)

**Purpose**: Server-side wrapper that fetches user data and passes it to the UI component.

**Flow**:

```typescript
const Page = async () => {
  const account = await getUserAccountData()  // Server action
  if (!account) notFound()
  return <AIAssistantPage account={account} />
}
```

**Output**: `AccountContext` object with:

- `accountMembers[0].account.organizations[]` - User's registered sellers
- Each org includes: `contragents[]` - Associated buyers/contractors

---

### 2. Page Component - Server Action (`src/app/dashboard/ai-assistant/action.ts`)

**Purpose**: Fetch rich organization + contragent data with all fields needed for AI resolution.

**Database Query**:

```
User (auth_uid)
  └─ AccountMember
     └─ Account
        ├─ composer_name
        ├─ creditBalance
        └─ organizations[]
           ├─ id, name, bulstat, vatNumber
           ├─ molName (manager of law)
           ├─ address (JSON)
           ├─ bank, iban, bic
           ├─ invoiceSeriesPrefix (e.g., "В-")
           ├─ current_inv_number (Decimal → string)
           └─ contragents[]
              ├─ id, name, bulstat, vatNumber
              ├─ molName, address
              └─ organizationId
```

**Serialization**:

```typescript
// Convert Prisma Decimal to string for client compatibility
current_inv_number: org.current_inv_number?.toString() || null;
```

**Return Type**: `AccountContext` (passed to client as prop)

---

### 3. AI Assistant Page (`src/page-components/ai-assistant.tsx`)

**Purpose**: React component that renders the chat interface and manages conversation state.

#### State Management

```typescript
const [messages, setMessages] = useState<ChatMessage[]>([]); // Chat history
const [currentInvoice, setCurrentInvoice] =
  useState<BulgarianInvoiceData | null>(null);
const [isGenerating, setIsGenerating] = useState(false); // Loading state
const [isSaving, setIsSaving] = useState(false); // PDF save state
const [messageInput, setMessageInput] = useState(""); // User text input
const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false); // Confirmation dialog
```

#### Computed Values

```typescript
const latestInvoiceMessageId = useMemo(() => {
  // Find the most recent assistant message with an invoice
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant" && messages[i].invoice) {
      return messages[i].id;
    }
  }
  return null;
}, [messages]);

const hasUnsavedDraft = useMemo(
  () => Boolean(currentInvoice) || messages.some((m) => m.role === "user"),
  [currentInvoice, messages],
);

const isInvoiceReadyForSave = useMemo(() => {
  if (!currentInvoice) return false;
  const hasSellerData = Boolean(
    currentInvoice.sellerName?.trim() || currentInvoice.sellerEik?.trim(),
  );
  const hasBuyerData = Boolean(
    currentInvoice.buyerName?.trim() || currentInvoice.buyerEik?.trim(),
  );
  return hasSellerData && hasBuyerData;
}, [currentInvoice]);
```

#### Key Actions

**sendMessage()**

```
1. Extract text from input field
2. Push user message to chat
3. POST /api/ai-assistant/chat-invoice with:
   - prompt: user text
   - currentInvoice: existing invoice or null
   - accountOrgs: array of user's organizations + contragents (from page props)
4. Receive ChatResponse
5. Update currentInvoice if response.status === "ok"
6. Push assistant message with invoice preview
7. Display changedFields badge
```

**saveAndDownloadInvoice()**

```
1. Validate invoice has seller AND buyer
2. POST /api/generate-pdf → get PDF blob
3. Upload blob to Supabase → get URL
4. POST /api/record-invoice with URL + invoice data
5. Create download link + trigger click
6. Show success/error alert
```

**resetDraft()**

```
1. Clear all messages → show welcome message
2. Clear currentInvoice
3. Clear input field
4. Reset form state
```

#### Leave Guard

```
- User tries to navigate away with unsaved draft
- Show confirmation dialog:
  "You have unsaved changes. Are you sure?"
- If user confirms: reset draft and navigate
- If user cancels: stay on page
```

#### UI Layout (Single Column, ChatGPT Style)

```
┌─────────────────────────────┐
│  AI Invoice Assistant       │
│  (Subtitle)          [New]  │
├─────────────────────────────┤
│                             │
│  Welcome message (bot)      │
│                             │
│  User: "Create invoice..."  │
│                             │
│  Bot: "Creating your draft" │
│  ┌─────────────────────────┐│
│  │ Invoice Preview Card    ││
│  │  • seller: XYZ Corp     ││
│  │  • buyer: ABC Ltd       ││
│  │  • total: 100.00 BGN    ││
│  │                         ││
│  │ Changed: sellerName,    ││
│  │          lineItems      ││
│  │                         ││
│  │ [Save & Download] btn   ││
│  └─────────────────────────┘│
│                             │
│ ┌───────────────────────────┐│
│ │ [User typing message...] ││
│ │ [Send Button]            ││
│ │ Hint: Shift+Enter new line││
│ └───────────────────────────┘│
└─────────────────────────────┘
```

#### Message Bubble Component

**User Messages** (right-aligned):

```
     "Add buyer from XYZ Ltd"  [User Icon]
     └─ Primary bg, right-aligned
```

**Assistant Messages** (left-aligned):

```
[Bot Icon] "Updated buyer details"
           ┌──────────────────────┐
           │ Invoice Preview      │
           │ (if present)         │
           │ + Changed fields     │
           │ + Save button        │
           │ (only on latest)     │
           └──────────────────────┘
```

---

### 4. Chat Invoice Route Handler (`src/app/api/ai-assistant/chat-invoice/route.ts`)

**Purpose**: Core server logic that orchestrates intent extraction, company resolution, and invoice building.

#### POST Handler Flow

```
1. VALIDATION
   ├─ Check: user is authenticated
   ├─ Extract: prompt, currentInvoice, accountOrgs from request body
   ├─ Trim: prompt text
   └─ Validate: all required fields present

2. LOAD ACCOUNT CONTEXT
   ├─ If accountOrgs provided by client: use directly (fast path)
   └─ Else: fetch from DB
      └─ Prisma: organization.findMany() with contragents

3. AI PROMPT EXTRACTION
   ├─ Call: OpenAI gpt-5.6-luna with EXTRACTION_PROMPT
   ├─ Input: user prompt + current invoice draft
   ├─ Output: {
   │    intent: "create_invoice" | "edit_invoice" | "unsupported",
   │    organizationName: string,
   │    organizationEik: string,
   │    contragentName: string,
   │    contragentEik: string,
   │    invoicePatch: Partial<BulgarianInvoiceData>,
   │    chatResponse: string
   │  }
   └─ Error fallback: return unsupported response

4. INTENT VALIDATION
   ├─ If unsupported: return 200 with status="unsupported"
   ├─ If edit_invoice but no currentInvoice: return status="missing-draft"
   └─ Else: proceed

5. COMPANY RESOLUTION
   ├─ Resolve Seller (organization):
   │  ├─ Call: resolveCompany({ role: "organization", name, eik })
   │  └─ Returns: ResolvedCompany with source (DB|CACHE|EXTERNAL)
   │
   ├─ Resolve Buyer (contragent):
   │  ├─ Call: resolveCompany({ role: "contragent", name, eik })
   │  └─ Returns: ResolvedCompany with source
   │
   ├─ Cross-role Fallback:
   │  ├─ If only seller mentioned but not found:
   │  │  └─ Try lookup as contragent instead
   │  └─ If only buyer mentioned but not found:
   │     └─ Try lookup as organization instead
   │
   └─ Validate: both required companies found or skip
      └─ If not found & was requested: return status="company-not-found"

6. INVOICE BUILD/MERGE
   ├─ Determine: start fresh or edit existing
   │  ├─ Fresh: if no currentInvoice OR explicit "new" prompt
   │  └─ Edit: if currentInvoice exists AND not explicit "new"
   │
   ├─ If starting fresh:
   │  ├─ Create: base invoice with defaults
   │  ├─ Auto-fill: primary org data
   │  │  ├─ sellerName, sellerEik, sellerVatNumber
   │  │  ├─ bank, iban, bic
   │  │  └─ invoiceNumber (from invoiceSeriesPrefix + current_inv_number)
   │  └─ Apply: AI-extracted patch (full fields)
   │
   ├─ If editing:
   │  ├─ Keep: existing invoice
   │  └─ Apply: AI-extracted patch (only non-empty fields)
   │     └─ Prevents: overwriting with empty strings
   │
   ├─ Apply: resolved seller data
   │  ├─ sellerName, sellerEik, sellerVatNumber, sellerMol
   │  └─ sellerCity, sellerAddress (from address object)
   │
   ├─ Apply: resolved buyer data
   │  ├─ buyerName, buyerEik, buyerVatNumber, buyerMol
   │  └─ buyerCity, buyerAddress
   │
   └─ Recalculate: line items totals (subtotal, VAT, total)

7. TRACK CHANGES
   ├─ Compare: previous invoice vs updated invoice
   ├─ Collect: fields that changed
   └─ Include: lineItems if changed

8. RESPONSE
   └─ Return: ChatResponse {
      data: {
        intent: "create_invoice" | "edit_invoice",
        assistantMessage: string,
        invoice: BulgarianInvoiceData,
        changedFields: string[],
        status: "ok"
      }
    }
```

---

## Data Types & Interfaces

### Core Interfaces

#### BulgarianInvoiceData

```typescript
{
  // Document metadata
  invoiceNumber: string              // "0000000001"
  invoiceDate: string                // "2026-09-14"
  taxEventDate: string               // "2026-09-14"
  location: string                   // "Sofia"
  currency: string                   // "BGN"

  // Seller (organization)
  sellerName: string
  sellerEik: string                  // 9-13 digits (BULSTAT)
  sellerVatNumber: string | null
  sellerCity: string
  sellerAddress: string
  sellerMol: string                  // Manager of Law name

  // Buyer (contragent)
  buyerName: string
  buyerEik: string
  buyerVatNumber: string | null
  buyerCity: string
  buyerAddress: string
  buyerMol: string

  // Line items
  lineItems: [
    {
      description: string
      unit: string                   // "шт" (pieces)
      quantity: string               // "1.00"
      unitPrice: string              // "100.00"
      vatPercent: string             // "20"
      value: string                  // "100.00" (qty * price)
    }
  ]

  // Totals
  subtotal: string                   // Sum of line values
  vatAmount: string                  // Total VAT across items
  total: string                      // subtotal + vatAmount
  totalInWords: string               // "Сто лева"

  // Payment details
  bank: string
  iban: string
  bic: string

  // Internal
  composer_name: string | null       // Account holder name
}
```

#### AccountOrgSnapshot (Passed from Page to API)

```typescript
{
  id: number
  name: string                       // e.g., "ABC Corp"
  bulstat: string | null             // 9-13 digits
  vatNumber: string | null           // "BG" + 9-10 digits
  molName: string | null             // Manager of Law
  address: {
    street?: string
    settlement?: string
    postalCode?: string
    country?: string
  }
  bank: string | null                // Bank name
  iban: string | null
  bic: string | null
  invoiceSeriesPrefix: string | null // e.g., "В-"
  current_inv_number: string | number | null // "Decimal" as string

  contragents: [
    {
      id: number
      name: string
      bulstat: string | null
      vatNumber: string | null
      molName: string | null
      address: object
      organizationId: number
    }
  ]
}
```

#### ResolvedCompany (Internal)

```typescript
{
  id?: number                        // DB ID if found
  name: string
  bulstat: string                    // Normalized (digits only)
  vatNumber: string | null
  molName: string | null
  email: string | null
  address?: AddressData
  source: "DB" | "CACHE" | "EXTERNAL"
  invoiceSeriesPrefix?: string | null
  currentInvNumber?: string | null
}
```

#### ChatMessage (Client State)

```typescript
{
  id: string                         // UUID
  role: "user" | "assistant"
  content: string                    // Text message
  createdAt: string                  // ISO timestamp
  invoice?: BulgarianInvoiceData     // Associated invoice (assistant only)
  changedFields?: string[]           // Fields that changed
}
```

#### ChatResponse (API Response)

```typescript
{
  data: {
    intent: "create_invoice" | "edit_invoice" | "unsupported"
    assistantMessage: string         // Response to show user
    invoice: BulgarianInvoiceData | null
    changedFields: string[]
    status: "ok"
           | "unsupported"
           | "missing-draft"
           | "company-not-found"
           | "invalid-input"
  }
}
```

#### PromptExtraction (After AI Processing)

```typescript
{
  intent: Intent;
  organizationName: string; // Extracted seller name
  organizationEik: string; // Extracted seller EIK
  contragentName: string; // Extracted buyer name
  contragentEik: string; // Extracted buyer EIK
  invoicePatch: Partial<BulgarianInvoiceData>; // Fields to patch
  chatResponse: string; // AI's response message
}
```

---

## Server-Side Logic

### 1. AI Prompt Extraction (`extractPromptData()`)

**OpenAI Request**:

```typescript
openai.responses.create({
  model: "gpt-5.6-luna",
  input: [
    {
      role: "user",
      content: [
        { type: "input_text", text: EXTRACTION_PROMPT },
        { type: "input_text", text: `User prompt: ${userInput}` },
        {
          type: "input_text",
          text: `Current invoice: ${JSON.stringify(invoice)}`,
        },
      ],
    },
  ],
});
```

**Extraction Prompt Rules** (`EXTRACTION_PROMPT`):

1. Return ONLY valid JSON
2. intent = "create_invoice" (new) | "edit_invoice" (modify) | "unsupported"
3. If user mentions single company without role → treat as organization (seller)
4. EIK = digits only (9-13)
5. Names = plain text
6. **CRITICAL for edit_invoice**: Only include fields user explicitly asked to change
7. For create_invoice: include all fields you can extract
8. Line items: full entries with all fields
9. chatResponse = short, same language as user prompt
10. JSON only, no markdown

**Error Fallback**:

```typescript
{
  intent: "unsupported",
  organizationName: "",
  organizationEik: "",
  contragentName: "",
  contragentEik: "",
  invoicePatch: {},
  chatResponse: "I couldn't process that as invoice-related..."
}
```

### 2. Company Resolution Pipeline

The 4-tier resolution pipeline searches for company data in order of speed:

#### Tier 1: Account Context (ZERO DB LATENCY)

```typescript
resolveFromAccountContext({
  role: "organization" | "contragent",
  name?: string,
  eik?: string,
  accountOrgs: AccountOrgSnapshot[]  // Passed from client
})
```

**Search Logic**:

- If EIK provided: exact match on bulstat (normalized digits)
- If name provided: substring match on org name (case-insensitive)
- For contragents: search all orgs' contragent arrays

**Result**: `ResolvedCompany` with source="DB" OR null

**Benefit**: Client passes org snapshots → zero DB queries for lookups

---

#### Tier 2: Database EIK Lookup

```typescript
resolveFromDbByEik({
  role: "organization" | "contragent",
  accountId: number,
  eik?: string
})
```

**Query**:

- Organizations: `WHERE accountId = ? AND bulstat = ?`
- Contragents: `WHERE bulstat = ? AND organization.accountId = ?`

**Return**: Full org/contragent record with address, invoiceSeriesPrefix, etc.

---

#### Tier 3: Database Name Lookup

```typescript
resolveFromDbByName({
  role: "organization" | "contragent",
  accountId: number,
  name?: string
})
```

**Query**:

- `WHERE accountId = ? AND name LIKE ?`
- ORDER BY createdAt ASC (first match)

**Return**: First matching org/contragent

---

#### Tier 4: Cache + External API Lookup

```typescript
resolveByEikWithFallback({
  role: "organization" | "contragent",
  accountId: number,
  primaryOrgId: number | null,
  eik?: string
})
```

**Process**:

1. Check `companyRegistryCache` table
2. If not cached: call CompanyBook external API
3. Parse API response: extract name, VAT, molName, address
4. **Auto-upsert to DB** via `upsertExternalCompanyToDb()`
5. Update cache lastFetchedAt timestamp

**External API** (`fetchExternalCompanyByEik`):

```
GET https://api.companybook.bg/api/companies/{EIK}?with_data=true
Headers: X-API-Key: process.env.COMPANY_BOOK_API_KEY

Response: CompanyData {
  companyName: { name: string },
  companyNameTransliteration: { name: string },
  registerInfo: { vat: string },
  managers: [{ name: string }],
  contacts: { email: string },
  seat: { street, settlement, postalCode, country }
}
```

---

#### Auto-Upsert External Companies

```typescript
upsertExternalCompanyToDb({
  role: "organization" | "contragent",
  accountId: number,
  primaryOrgId: number | null,
  resolved: ResolvedCompany,
});
```

**For Organizations**:

```sql
INSERT INTO organizations (
  accountId, bulstat, name, vatNumber, molName,
  email, address, bank, iban, bic, source
) VALUES (...)
ON CONFLICT (bulstat) DO UPDATE SET
  name = ..., vatNumber = ..., molName = ..., ...
```

**For Contragents**:

```sql
INSERT INTO contragents (
  organizationId, bulstat, name, vatNumber, molName,
  email, address, source
) VALUES (...)
ON DUPLICATE KEY UPDATE
  name = ..., vatNumber = ..., ...
```

**Returns**: Updated ResolvedCompany with DB id

---

### 3. Invoice Patch Strategies

#### Patch Type 1: sanitizeInvoicePatch (CREATE)

```typescript
// For create_invoice intent: include all extracted fields
function sanitizeInvoicePatch(patch) {
  const sanitized = {};

  // For every field in patch:
  for (const field of PATCH_FIELDS) {
    if (field in patch) {
      sanitized[field] = normalizeText(patch[field]);
    }
  }

  // Line items: include as-is if present
  if (patch.lineItems) {
    sanitized.lineItems = sanitizeLineItems(patch.lineItems);
  }

  return sanitized;
}
```

**Behavior**:

- Includes all fields the AI extracted
- Used when creating new invoice from scratch
- Fills invoice with maximum info from prompt

---

#### Patch Type 2: sanitizeEditPatch (EDIT) - Edit-Safe

```typescript
// For edit_invoice intent: ONLY non-empty fields
function sanitizeEditPatch(patch) {
  const sanitized = {};

  // For every field in patch:
  for (const field of PATCH_FIELDS) {
    if (field in patch) {
      const val = normalizeText(patch[field]);
      // Only keep if non-empty!
      if (val) {
        sanitized[field] = val;
      }
    }
  }

  // Line items: only if present AND non-empty
  if (patch.lineItems && patch.lineItems.length > 0) {
    sanitized.lineItems = sanitizeLineItems(patch.lineItems);
  }

  return sanitized;
}
```

**Key Difference**:

- **Filters out empty strings** - prevents overwriting existing values with blanks
- **Only keeps fields user explicitly asked to change**
- Example: User says "change buyer name to XYZ"
  - AI should return: `{ buyerName: "XYZ" }`
  - NOT: `{ buyerName: "XYZ", sellerEik: "", total: "" }`

**Problem It Solves**:

- Multi-turn conversation: User creates invoice → edits buyer → AI shouldn't blank seller
- Without this: every edit could wipe existing fields

---

### 4. Invoice Merging

```typescript
function mergeInvoice(
  current: BulgarianInvoiceData,
  patch: Partial<BulgarianInvoiceData>,
): BulgarianInvoiceData {
  // Deep merge
  const merged = {
    ...current,
    ...patch,
    lineItems: patch.lineItems ?? current.lineItems,
  };

  // Recalculate totals
  const totals = recalculateTotals(merged.lineItems);

  // Sanitize and finalize
  return sanitizeInvoice({
    ...merged,
    ...totals,
  });
}
```

**Process**:

1. Spread current invoice
2. Override with patch fields
3. Keep lineItems from patch if provided, else from current
4. Recalculate: subtotal, VAT, total based on line items
5. Finalize: sanitize, normalize all text fields

---

### 5. Line Item Recalculation

```typescript
function recalculateTotals(lineItems) {
  const normalizedItems = lineItems.map((item) => {
    const qty = parseDecimal(item.quantity);
    const price = parseDecimal(item.unitPrice);
    const vatPct = parseDecimal(item.vatPercent || "20");
    const value = qty * price;

    return {
      ...item,
      quantity: normalizeText(item.quantity) || "1",
      unitPrice: normalizeText(item.unitPrice) || "0.00",
      vatPercent: normalizeText(item.vatPercent) || "20",
      value: toMoney(value),
      _valueNumber: value,
      _vatPercentNumber: vatPct,
    };
  });

  const subtotal = normalizedItems.reduce(
    (sum, item) => sum + item._valueNumber,
    0,
  );
  const vat = normalizedItems.reduce(
    (sum, item) => sum + item._valueNumber * (item._vatPercentNumber / 100),
    0,
  );

  return {
    lineItems: normalizedItems.map(
      ({ _valueNumber, _vatPercentNumber, ...rest }) => rest,
    ),
    subtotal: toMoney(subtotal),
    vatAmount: toMoney(vat),
    total: toMoney(subtotal + vat),
  };
}
```

**Handles**:

- Comma decimal separators (`,` → `.`)
- Non-numeric characters stripped
- Default to "0.00" if invalid
- Per-item VAT rates
- Total VAT across all items

---

## Client-Side Logic

### 1. Message History Management

```typescript
const [messages, setMessages] = useState<ChatMessage[]>([]);

// On first render: show welcome message
useEffect(() => {
  setMessages([buildWelcomeMessage(t)]);
}, [t]);

// Every time a new message is added: scroll to bottom
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages, isGenerating]);
```

### 2. Draft State Tracking

```typescript
const hasUnsavedDraft = useMemo(
  () => Boolean(currentInvoice) || messages.some((m) => m.role === "user"),
  [currentInvoice, messages],
);
```

**True if**:

- currentInvoice is not null (has draft data)
- OR any user messages exist in chat

**Used for**: Leave confirmation guard

---

### 3. Leave Guard Implementation

```typescript
useEffect(() => {
  const onDocumentClick = (event: MouseEvent) => {
    if (!hasUnsavedDraft || bypassLeaveGuardRef.current) return;

    const anchor = event.target?.closest("a[href]");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

    const destination = new URL(href, window.location.origin);
    const current = new URL(window.location.href);

    // Same origin + different route?
    const sameRoute = destination.pathname === current.pathname;
    if (destination.origin !== current.origin || sameRoute) return;

    // Prevent navigation and show dialog
    event.preventDefault();
    event.stopPropagation();
    pendingNavigationRef.current = destination.toString();
    setIsLeaveDialogOpen(true);
  };

  document.addEventListener("click", onDocumentClick, true);
  return () => document.removeEventListener("click", onDocumentClick, true);
}, [hasUnsavedDraft]);
```

**Only Shows Confirmation if**:

- User has unsaved draft
- User clicks a link (not a button or other element)
- Link is to a different route
- Link is same-origin (not external)

---

### 4. Send Message Flow

```typescript
const sendMessage = async () => {
  const text = messageInput.trim();
  if (!text || isGenerating) return;

  // Clear input, add user message
  setMessageInput("");
  pushMessage("user", text);
  setIsGenerating(true);

  try {
    const response = await fetch("/api/ai-assistant/chat-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: text,
        currentInvoice,
        accountOrgs: accountMember?.account.organizations ?? [], // ← Fast path
      }),
    });

    const payload = (await response.json()) as ChatApiResponse;
    const data = payload?.data;

    if (!data) {
      pushMessage("assistant", t("serverProcessingError"));
      return;
    }

    // Update draft if server returned new invoice
    if (data.invoice) {
      setCurrentInvoice(data.invoice);
    }

    // Determine assistant message
    let assistantMessage = data.assistantMessage;
    if (data.status !== "ok") {
      // Use fallback message for error statuses
      const fallbacks = {
        unsupported: t("unsupportedPromptFallback"),
        "missing-draft": t("missingDraftFallback"),
        "company-not-found": t("companyNotFoundFallback"),
        "invalid-input": t("invalidInputFallback"),
      };
      assistantMessage =
        fallbacks[data.status] ||
        assistantMessage ||
        t("serverProcessingError");
    }

    // Add assistant message with invoice preview if available
    pushMessage("assistant", assistantMessage, {
      invoice: data.status === "ok" ? data.invoice : undefined,
      changedFields: data.changedFields,
    });
  } catch (error) {
    pushMessage("assistant", t("serverProcessingError"));
  } finally {
    setIsGenerating(false);
  }
};
```

**Key Points**:

- Pass `accountOrgs` from page props → eliminates DB query on server
- Only update currentInvoice if response.status === "ok"
- Use AI's chatResponse if available, else use fallback based on status
- changedFields are displayed in the UI

---

### 5. Save & Download Flow

```typescript
const saveAndDownloadInvoice = async () => {
  if (!currentInvoice || isSaving || !isInvoiceReadyForSave) return;

  setIsSaving(true);

  try {
    // Step 1: Generate PDF from invoice data
    let generatedPdfBlob: Blob | null = null;
    let generatedPdfUrl: string | null = null;

    try {
      const pdfResponse = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentInvoice),
      });

      if (pdfResponse.ok) {
        generatedPdfBlob = await pdfResponse.blob();

        // Upload blob to Supabase
        generatedPdfUrl = await uploadPdfToSupabase(
          generatedPdfBlob,
          currentInvoice.invoiceNumber,
          accountMember?.accountId ?? undefined,
          currentInvoice.sellerEik,
        );
      }
    } catch {
      generatedPdfBlob = null;
      generatedPdfUrl = null;
      // Continue without PDF URL
    }

    // Step 2: Record invoice in database
    const recordResponse = await fetch("/api/record-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceData: currentInvoice,
        generatedPdfUrl,
        skipSourceDocumentCreation: true,
      }),
    });

    if (!recordResponse.ok) {
      setAlertStatus({
        status: "error",
        statusHeader: t("invoiceSaveFailedHeader"),
        statusContent: t("invoiceSaveFailed"),
      });
      return;
    }

    // Step 3: Download PDF to user's computer
    if (generatedPdfBlob) {
      const downloadUrl = URL.createObjectURL(generatedPdfBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `faktura-${currentInvoice.invoiceNumber}-${currentInvoice.sellerEik}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    }

    // Show success message
    const successMessage = generatedPdfBlob
      ? t("invoiceSavedAndDownloaded")
      : t("invoiceSavedNoPdf");

    setAlertStatus({
      status: "success",
      statusHeader: t("invoiceSavedHeader"),
      statusContent: successMessage,
    });
  } catch (error) {
    setAlertStatus({
      status: "error",
      statusHeader: t("invoiceSaveFailedHeader"),
      statusContent: t("invoiceSaveFailed"),
    });
  } finally {
    setIsSaving(false);
  }
};
```

**Error Handling**:

- PDF generation failure: continue without PDF (record-invoice still called)
- Supabase upload failure: continue with `generatedPdfUrl = null`
- record-invoice failure: show error alert to user
- Download failure: continue (invoice was still recorded)

---

## Company Resolution Pipeline

### Complete Resolution Example

**Scenario**: User says "Create invoice from ABC Corp to XYZ Ltd for 100 BGN"

```
Step 1: Extract from AI
├─ organizationName: "ABC Corp"
├─ organizationEik: ""
├─ contragentName: "XYZ Ltd"
└─ contragentEik: ""

Step 2: Resolve Seller (ABC Corp)
├─ Tier 1 (Account Context): Search client-supplied orgs
│  ├─ Check: org.name.includes("ABC Corp")
│  └─ Result: Found ID=5, bulstat="123456789"
│     └─ Return: ResolvedCompany { name: "ABC Corp", bulstat: "123456789", ... }
└─ (Tiers 2-4 not needed)

Step 3: Resolve Buyer (XYZ Ltd)
├─ Tier 1 (Account Context):
│  ├─ Check all orgs and contragents
│  └─ Result: NOT found (XYZ Ltd is external company)
│
├─ Tier 2 (DB EIK Lookup):
│  └─ Result: NOT found (no EIK provided)
│
├─ Tier 3 (DB Name Lookup):
│  ├─ Query: SELECT * FROM contragents WHERE name LIKE "XYZ Ltd"
│  └─ Result: NOT found
│
├─ Tier 4 (Cache + External API):
│  ├─ Cache: NOT found
│  │
│  ├─ External API:
│  │  ├─ No EIK provided, so skip
│  │  └─ Result: NOT found
│  │
│  └─ Status: company-not-found
│     └─ Return: null
│
└─ Overall: Buyer NOT found
   └─ Return status: "company-not-found"
   └─ User message: "Couldn't find XYZ Ltd. Please provide the company EIK or check the name."

---

Alternative: User provides EIK

Step 3b: Resolve Buyer (XYZ Ltd, EIK: 987654321)
├─ Tier 1: NOT found
├─ Tier 2 (DB EIK): NOT found
├─ Tier 3: Skipped (EIK takes priority)
│
├─ Tier 4 (External API):
│  ├─ Call: https://api.companybook.bg/api/companies/987654321
│  │
│  ├─ Response: {
│  │   companyName: { name: "XYZ Ltd" },
│  │   registerInfo: { vat: "BG987654321" },
│  │   managers: [{ name: "John Doe" }],
│  │   seat: { street: "Main St", settlement: "Sofia" },
│  │   ...
│  │ }
│  │
│  ├─ Parse: ResolvedCompany {
│  │   name: "XYZ Ltd",
│  │   bulstat: "987654321",
│  │   vatNumber: "BG987654321",
│  │   molName: "John Doe",
│  │   address: { street: "Main St", settlement: "Sofia" },
│  │   source: "EXTERNAL"
│  │ }
│  │
│  └─ Auto-Upsert to DB:
│     ├─ INSERT INTO contragents (
│     │   organizationId: 5,
│     │   bulstat: "987654321",
│     │   name: "XYZ Ltd",
│     │   vatNumber: "BG987654321",
│     │   molName: "John Doe",
│     │   address: { street: "Main St", settlement: "Sofia" },
│     │   source: "NAP_API"
│     │ )
│     └─ Return: ResolvedCompany with id=42, source="DB"
│
└─ Success: Buyer found + persisted to DB
   └─ Invoice built with buyer data
```

---

## Invoice Patch Strategies

### Scenario 1: Create New Invoice

**User Input**: "Create invoice from ABC Corp to XYZ Ltd, 100 BGN"

```
AI Extraction:
{
  intent: "create_invoice",
  invoicePatch: {
    sellerName: "ABC Corp",
    buyerName: "XYZ Ltd",
    lineItems: [{
      description: "Service",
      quantity: "1",
      unitPrice: "100.00",
      vatPercent: "20",
      value: "100.00"
    }]
  }
}

Patch Application (sanitizeInvoicePatch):
├─ Extract all fields: {
│   sellerName: "ABC Corp",
│   buyerName: "XYZ Ltd",
│   lineItems: [...]
│ }
├─ All other fields: undefined (not in patch)
└─ Result: Partial invoice from AI

Invoice Build:
├─ Create base: {
│   invoiceNumber: "0000000001",
│   invoiceDate: "2026-09-14",
│   all other fields: ""
│ }
├─ Auto-fill from primary org: {
│   sellerName: "ABC Corp",
│   sellerEik: "123456789",
│   bank: "DSK Bank",
│   iban: "BG80TTBB...",
│   ...
│ }
├─ Merge AI patch: {
│   buyerName: "XYZ Ltd",
│   lineItems: [...],
│   subtotal: "100.00",
│   vatAmount: "20.00",
│   total: "120.00"
│ }
└─ Resolve company data + apply: {
│   buyerEik: "987654321",
│   buyerVatNumber: "BG987654321",
│   buyerMol: "John Doe",
│   ...
│ }

Final Invoice:
{
  invoiceNumber: "0000000001",
  invoiceDate: "2026-09-14",
  taxEventDate: "2026-09-14",
  sellerName: "ABC Corp",
  sellerEik: "123456789",
  sellerVatNumber: "123456789",
  bank: "DSK Bank",
  iban: "BG80TTBB...",
  buyerName: "XYZ Ltd",
  buyerEik: "987654321",
  buyerVatNumber: "BG987654321",
  buyerMol: "John Doe",
  lineItems: [...],
  subtotal: "100.00",
  vatAmount: "20.00",
  total: "120.00",
  ...
}
```

---

### Scenario 2: Edit Existing Invoice

**Current Invoice**:

```
{
  sellerName: "ABC Corp",
  sellerEik: "123456789",
  buyerName: "XYZ Ltd",
  buyerEik: "987654321",
  lineItems: [{ quantity: "1", unitPrice: "100.00", value: "100.00" }],
  subtotal: "100.00",
  vatAmount: "20.00",
  total: "120.00"
}
```

**User Input**: "Change buyer quantity to 2"

```
AI Extraction:
{
  intent: "edit_invoice",
  invoicePatch: {
    lineItems: [{
      quantity: "2",
      unitPrice: "100.00",
      value: "200.00"
    }]
  }
}

Patch Application (sanitizeEditPatch):
├─ Only keep fields with non-empty values:
│  └─ lineItems: [{ quantity: "2", unitPrice: "100.00", value: "200.00" }]
│
└─ Result: { lineItems: [...] }  ← Only lineItems, no empty fields!

Merge with Current:
├─ Keep all existing fields
├─ Update lineItems from patch
├─ Recalculate totals:
│  ├─ subtotal: 200.00
│  ├─ vatAmount: 40.00
│  ├─ total: 240.00
│
└─ Result: Updated invoice with SAME seller & buyer info
   └─ No risk of overwriting sellerName, buyerEik, etc.

Final Invoice:
{
  sellerName: "ABC Corp",      ← UNCHANGED
  sellerEik: "123456789",      ← UNCHANGED
  buyerName: "XYZ Ltd",        ← UNCHANGED
  buyerEik: "987654321",       ← UNCHANGED
  lineItems: [{ quantity: "2", ... }],  ← UPDATED
  subtotal: "200.00",          ← RECALCULATED
  vatAmount: "40.00",          ← RECALCULATED
  total: "240.00"              ← RECALCULATED
}
```

**Why sanitizeEditPatch is Critical**:

- Without it: AI might extract `{ lineItems: [...], sellerEik: "", total: "" }`
- Result: seller data would be blanked out
- With it: empty fields are filtered out → no overwrites

---

## Error Handling & Status Codes

### Request Validation Errors

| Status | Condition              | Response                  | Next Steps               |
| ------ | ---------------------- | ------------------------- | ------------------------ |
| 400    | Empty/missing prompt   | `status: "invalid-input"` | Ask user to provide text |
| 401    | User not authenticated | `null` response           | Redirect to login        |
| 404    | Account not found      | `status: "invalid-input"` | System error             |
| 500    | Server exception       | `status: "invalid-input"` | Retry or contact support |

### Intent Resolution Errors

| Status            | Condition                          | Response          | UI Message                                |
| ----------------- | ---------------------------------- | ----------------- | ----------------------------------------- |
| unsupported       | AI intent is "unsupported"         | Full invoice kept | "I only support invoice creation/editing" |
| missing-draft     | edit_invoice but no currentInvoice | No invoice        | "Create an invoice first"                 |
| company-not-found | Seller or buyer not resolved       | No update         | "Couldn't find {company}..."              |

### Success Response

| Status | Invoice | Message                  | Action                        |
| ------ | ------- | ------------------------ | ----------------------------- |
| ok     | Updated | AI response + field list | Update chat + display invoice |

---

## Database Operations

### Schema Relevant to AI Assistant

```prisma
model Account {
  id              Int
  composer_name   String?
  creditBalance   Float
  organizations   Organization[]
  members         AccountMember[]
}

model Organization {
  id                    Int
  accountId             Int
  name                  String
  bulstat               String      // 9-13 digits
  vatNumber             String?
  molName               String?     // Manager of Law
  email                 String?
  address               Json?       // { street, settlement, postalCode, country }
  bank                  String?
  iban                  String?
  bic                   String?
  invoiceSeriesPrefix   String?     // e.g., "В-"
  current_inv_number    Decimal?    // e.g., 000001
  source                String      // "USER_INPUT" or "NAP_API"
  createdAt             DateTime
  contragents           Contragent[]
}

model Contragent {
  id              Int
  organizationId  Int
  name            String
  bulstat         String
  vatNumber       String?
  molName         String?
  email           String?
  address         Json?
  source          String      // "USER_INPUT" or "NAP_API"
  createdAt       DateTime
  organization    Organization
}

model CompanyRegistryCache {
  bulstat         String  @primary
  name            String
  vatNumber       String?
  address         Json?
  lastFetchedAt   DateTime
}

model Invoice {
  id              Int
  accountId       Int
  sellerEik       String
  invoiceNumber   String
  invoiceDate     DateTime
  data            Json      // Serialized BulgarianInvoiceData
  generatedPdfUrl String?
  createdAt       DateTime
}
```

### Key Queries Used

**1. Fetch User's Organizations** (in action.ts):

```sql
SELECT
  id, name, bulstat, vatNumber, molName, address,
  bank, iban, bic, invoiceSeriesPrefix, current_inv_number,
  (SELECT * FROM contragents WHERE organizationId = org.id)
FROM organizations
WHERE accountId = ?
ORDER BY createdAt ASC
```

**2. Resolve Organization by EIK** (in route.ts):

```sql
SELECT * FROM organizations
WHERE accountId = ? AND bulstat = ?
```

**3. Resolve Contragent by EIK** (in route.ts):

```sql
SELECT * FROM contragents
WHERE bulstat = ? AND organization.accountId = ?
```

**4. Upsert External Company** (in route.ts):

```sql
INSERT INTO organizations (...) VALUES (...)
ON CONFLICT (bulstat) DO UPDATE SET
  name = ..., vatNumber = ..., molName = ..., ...
```

**5. Update Cache Lookup Time**:

```sql
UPDATE companyRegistryCache
SET lastFetchedAt = NOW()
WHERE bulstat = ?
```

---

## API Endpoints Reference

### POST /api/ai-assistant/chat-invoice

**Request**:

```json
{
  "prompt": "Create invoice from ABC Corp for 100 BGN",
  "currentInvoice": { /* BulgarianInvoiceData */ } | null,
  "accountOrgs": [ /* AccountOrgSnapshot[] */ ]
}
```

**Response** (200 OK):

```json
{
  "data": {
    "intent": "create_invoice",
    "assistantMessage": "Creating your draft invoice from ABC Corp for 100 BGN...",
    "invoice": {
      /* BulgarianInvoiceData */
    },
    "changedFields": ["sellerName", "lineItems", "total"],
    "status": "ok"
  }
}
```

**Response** (400 Bad Request):

```json
{
  "data": {
    "intent": "unsupported",
    "assistantMessage": "Prompt is required.",
    "invoice": null,
    "changedFields": [],
    "status": "invalid-input"
  }
}
```

**Response** (401 Unauthorized):

```json
{
  "data": null
}
```

**Response** (500 Internal Server Error):

```json
{
  "data": {
    "intent": "unsupported",
    "assistantMessage": "Failed to process the request.",
    "invoice": null,
    "changedFields": [],
    "status": "invalid-input"
  }
}
```

---

### POST /api/generate-pdf

**Request**:

```json
{
  /* BulgarianInvoiceData */
}
```

**Response** (200 OK):

```
[Binary PDF Blob]
Content-Type: application/pdf
```

**Response** (500 Error):

```
[Error message]
```

---

### POST /api/record-invoice

**Request**:

```json
{
  "invoiceData": {
    /* BulgarianInvoiceData */
  },
  "generatedPdfUrl": "https://...",
  "skipSourceDocumentCreation": true
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "invoiceId": 42
}
```

**Response** (400 Bad Request):

```json
{
  "success": false,
  "error": "Missing seller data"
}
```

---

## Key Implementation Details

### Text Normalization Utilities

**normalizeText(value)**: Trim, handle non-strings

- Input: `"  ABC Corp  "` → Output: `"ABC Corp"`
- Input: `null` → Output: `""`

**normalizeEik(value)**: Strip non-digits for BULSTAT

- Input: `"123 456 789"` → Output: `"123456789"`
- Input: `"ABC"` → Output: `""`

**parseDecimal(value)**: Handle comma separators

- Input: `"100,50"` → Output: `100.5`
- Input: `"100.50"` → Output: `100.5`

**toMoney(value)**: Format to 2 decimals

- Input: `100.5` → Output: `"100.50"`
- Input: `99.999` → Output: `"100.00"` (rounded)

---

### Address Data Handling

**AddressData Type**:

```typescript
{
  street?: string        // "123 Main St"
  settlement?: string    // "Sofia"
  postalCode?: string    // "1000"
  country?: string       // "Bulgaria"
  district?: string
  municipality?: string
}
```

**Stored as JSON in Prisma**:

```prisma
address Json?
```

**Extracted from External API**:

```javascript
company.seat = {
  street: "123 Main St",
  settlement: "Sofia",
  ...
}
```

**Applied to Invoice**:

```
address → sellerAddress (street)
address.settlement → sellerCity
```

---

### Invoice Number Generation

**Pattern**: `{invoiceSeriesPrefix}{current_inv_number}`

**Example**:

- Series Prefix: `"В-"`
- Current number: `"000001"`
- Generated: `"В-000001"`

**From DB Organization**:

```typescript
invoiceNumber = generateNextInvoiceNumber(
  org.invoiceSeriesPrefix,
  org.current_inv_number,
);
```

**Fallback**: If no series, use defaults

```
DEFAULT_INVOICE_NUMBER = "0000000001"
```

---

### Changed Fields Tracking

**Compared Fields**:

- Standard: invoiceNumber, invoiceDate, taxEventDate, location, seller*, buyer*, currency, bank, iban, bic
- Special: lineItems (JSON comparison)

**Example**:

```
Previous: { sellerName: "ABC Corp", buyerName: "XYZ Ltd", total: "120.00" }
Updated:  { sellerName: "ABC Corp", buyerName: "DEF Inc", total: "150.00" }

Changed: ["buyerName", "total"]
```

**Displayed to User**:

```
Changed fields: buyerName, total
```

---

## Summary & Key Takeaways

### Architecture Strengths

1. **4-Tier Resolution Pipeline**: Fast (account context first) → Complete (external API)
2. **Edit-Safe Patches**: Prevents data loss in multi-turn conversations
3. **Automatic DB Persistence**: External API results saved for future use
4. **Client-Side Org Cache**: accountOrgs passed to server eliminates DB queries
5. **Rich Error States**: Clear status codes for different failure modes
6. **Multi-Language Support**: ChatGPT-style UI with translations (en.json, bg.json)

### Critical Features

- **No Data Loss**: sanitizeEditPatch filters out empty fields
- **Context Awareness**: AI prompt includes current invoice draft
- **Smart Fallbacks**: Can resolve single company as either seller or buyer
- **Automatic Totals**: Line items recalculated on every change
- **Session Persistence**: Messages + draft kept across turns

### Performance Optimizations

- Client passes accountOrgs → zero DB query for local orgs
- Cache table prevents repeated external API calls
- Name-based lookup before EIK (faster for common cases)
- Single base invoice creation (vs rebuilding each turn)

---

**End of Document**
