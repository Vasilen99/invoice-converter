# AI Convertor: Logic and Data Flow

This document describes the end-to-end behavior for `/dashboard/ai-convertor`.

## 1) Page bootstrapping

- Route: `src/app/dashboard/ai-convertor/page.tsx`
- Server action: `src/app/dashboard/ai-convertor/action.ts`
- `getAccountData()` resolves the authenticated user's account (`id`, `creditBalance`, `composer_name`).
- The page renders `InvoiceUploader` with the resolved account data.

## 2) Upload and extraction flow

Main component: `src/components/InvoiceUploader.tsx`

1. User uploads one or many PDFs.
2. Each file is added to local `invoices` state with status `extracting`.
3. For each file, `/api/extract-invoice` is called.
4. On success:
   - invoice data is stored in local state (`status: extracted`),
   - invoice number is prepared from DB-derived baseline + local max sequence per seller,
   - source PDF upload is triggered in background via `/api/upload-document`.
5. After all files settle, component calls `/api/organizations/missing-from-invoices`.

## 3) Missing entities discovery (`/api/organizations/missing-from-invoices`)

Current behavior is **EIK-only missing detection**:

Inputs:

- `eiks`: seller organization candidates
- `invoicePairs`: extracted seller/buyer EIK relations

Checks:

1. Existing account organizations by seller EIK.
2. Existing contragents by `(organizationId, buyerEIK)` relation.
3. `CompanyRegistryCache` existence by EIK for unresolved organizations and unresolved contragents.

Outputs (`data`):

- `missingOrganizations`: array of `{ bulstat }` not found in account organizations and not present in cache.
- `missingContragents`: array of `{ organizationId, organizationBulstat, organizationName, bulstat }` relations not found in organization contragents and not present in cache.
- `missingOrganizationBulstats`: unique EIK list for missing organizations.
- `missingContragentBulstats`: unique EIK list for missing contragents.

No external API call is performed here.

## 4) Generation pre-validation (required EIK/BULSTAT)

Before generation starts (`single` and `bulk`):

- Seller EIK and buyer EIK are required.
- If any invoice has missing EIK fields, generation is blocked immediately.
- Alert is shown through `useGlobalStore().setAlertStatus` with localized text (`messages/en.json`, `messages/bg.json`).

UI-level required marking:

- Seller and buyer EIK fields are marked with `*` in `InvoicesLayoutSection`.

## 5) PDF generation and persistence

For each valid invoice:

1. `/api/generate-pdf` generates the output PDF blob.
2. Browser auto-download starts.
3. Generated PDF upload is triggered in background via `/api/upload-document`.
4. Invoice persistence is triggered via `/api/record-invoice`.

All recoverable background persistence failures show warning alerts via global store, without blocking user download.

## 6) Recording invoice (`/api/record-invoice`)

Responsibilities:

- Validate payload (`invoiceData`) and required seller/buyer EIK.
- Resolve user -> DB user -> account membership.
- Resolve/create organization and contragent.
- Persist source document + generated invoice + line items in transaction.
- Move `organization.current_inv_number` forward only (existing logic preserved).

### Organization / Contragent creation strategy

When missing records are created:

1. Try external CompanyBook API by EIK (`COMPANY_BOOK_API_KEY`).
2. If found, use external data (name, VAT, address, MOL, email), set source `NAP_API`.
3. If not found, fallback to form data from extracted/edited invoice, set source `MANUAL`.
4. Upsert `CompanyRegistryCache` in both cases and attach `registryId`.

## 7) Alerting model

- Client alerts should use `useGlobalStore().setAlertStatus`.
- API endpoints used by `callApi` should return:
  - success: `{ data: ... }`
  - error: `{ data: null, alert: { status, header, message } }`
- Explicit route `404` status responses were removed from touched APIs in favor of `notFound()` (or non-404 empty results where domain-appropriate).

## 8) Related APIs in this flow

- `POST /api/extract-invoice`
- `POST /api/organizations/missing-from-invoices`
- `POST /api/generate-pdf`
- `POST /api/upload-document`
- `POST /api/record-invoice`

## 9) Notes on data integrity

- Contragent uniqueness is scoped by `(organizationId, bulstat)`.
- Invoice uniqueness is `(organizationId, invoiceSeries, invoiceNumber)`.
- Re-recording an existing invoice updates core fields and rewrites line items.
- Missing-entity detector intentionally does not enrich/resolve data, it only flags missing EIKs and missing seller->buyer relations.
