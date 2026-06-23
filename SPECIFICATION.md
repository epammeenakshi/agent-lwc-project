# Lead Capture Form — Architecture Blueprint

**Branch:** `feature/lead-capture-form`  
**Date:** 2026-06-23  
**Author:** meenakshi_sharma@epam.com  
**Status:** Approved for Development

---

## 1. Overview

This document defines the full technical specification for the **Lead Capture Form** solution. The solution captures inbound lead data via a Lightning Web Component (LWC) form, persists it to Salesforce as a `Lead` record enriched with custom fields, and enforces access via a dedicated Permission Set.

---

## 2. Form Fields

The LWC form exposes the following fields. All fields map directly to `Lead` object fields unless noted.

| # | Field Label | API Name / Type | Required | Notes |
|---|-------------|-----------------|----------|-------|
| 1 | First Name | `FirstName` (Text 40) | Yes | Standard Lead field |
| 2 | Last Name | `LastName` (Text 80) | Yes | Standard Lead field |
| 3 | Company | `Company` (Text 255) | Yes | Standard Lead field |
| 4 | Email | `Email` (Email) | Yes | Standard Lead field |
| 5 | Phone | `Phone` (Phone) | No | Standard Lead field |
| 6 | Lead Source | `LeadSource` (Picklist) | No | Standard picklist; values seeded from org metadata |
| 7 | Notes | `Capture_Notes__c` (Long Text 32768) | No | Custom field — see §4 |

---

## 3. Validation Rules

### 3.1 Client-Side (LWC)

Validation executes on form submit before any server call.

| Rule | Field | Condition | Error Message |
|------|-------|-----------|---------------|
| V-01 | First Name | Blank or whitespace-only | "First Name is required." |
| V-02 | Last Name | Blank or whitespace-only | "Last Name is required." |
| V-03 | Company | Blank or whitespace-only | "Company is required." |
| V-04 | Email | Blank or whitespace-only | "Email is required." |
| V-05 | Email | Fails RFC 5322 pattern (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) | "Enter a valid email address." |
| V-06 | Phone | Present and fails E.164 digit check (7–15 digits, optional leading `+`) | "Enter a valid phone number." |

### 3.2 Server-Side (Apex)

The Apex controller re-validates before DML to guard against direct API calls.

| Rule | Field | Logic |
|------|-------|-------|
| SV-01 | LastName | `String.isBlank(lead.LastName)` → throw `AuraHandledException` |
| SV-02 | Company | `String.isBlank(lead.Company)` → throw `AuraHandledException` |
| SV-03 | Email | `String.isBlank(lead.Email)` or fails `Pattern` match → throw `AuraHandledException` |
| SV-04 | Source_Account__c | If provided, confirm record exists via SOQL before insert |

### 3.3 Salesforce Declarative Validation Rules (on Lead object)

| Rule Name | Formula | Error Message | Location |
|-----------|---------|---------------|----------|
| `Require_Email_Format` | `NOT(REGEX(Email, "^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$"))` | "Email format is invalid." | Field |
| `Require_LastName` | `ISBLANK(LastName)` | "Last Name cannot be blank." | Top of Page |

---

## 4. Custom Database Fields

Two custom fields are added to the `Lead` standard object.

### 4.1 `Source_Account__c` — Lookup to Account

| Property | Value |
|----------|-------|
| API Name | `Source_Account__c` |
| Object | `Lead` |
| Field Type | Lookup (`Account`) |
| Label | "Source Account" |
| Required | No |
| Description | Links an inbound lead to an existing Account for attribution tracking |
| Relationship Name | `Source_Account` |
| Child Relationship Label | "Leads from Account" |
| Field-Level Security | Read + Edit granted via `Lead_Capture_Access` Permission Set |

### 4.2 `Capture_Notes__c` — Long Text Area

| Property | Value |
|----------|-------|
| API Name | `Capture_Notes__c` |
| Object | `Lead` |
| Field Type | Long Text Area |
| Length | 32,768 characters |
| Label | "Capture Notes" |
| Required | No |
| Description | Free-text notes captured at the point of lead entry |
| Visible Lines | 4 |
| Field-Level Security | Read + Edit granted via `Lead_Capture_Access` Permission Set |

---

## 5. Security Layout — `Lead_Capture_Access` Permission Set

### 5.1 Permission Set Metadata

| Property | Value |
|----------|-------|
| API Name | `Lead_Capture_Access` |
| Label | "Lead Capture Access" |
| Description | Grants the minimum permissions required to submit and view Lead Capture Form data |
| License | None (user-license agnostic) |

### 5.2 Object Permissions — `Lead`

| Permission | Granted |
|------------|---------|
| Read | Yes |
| Create | Yes |
| Edit | No |
| Delete | No |
| View All | No |
| Modify All | No |

### 5.3 Field-Level Security — `Lead`

| Field API Name | Read | Edit |
|----------------|------|------|
| `FirstName` | Yes | Yes |
| `LastName` | Yes | Yes |
| `Company` | Yes | Yes |
| `Email` | Yes | Yes |
| `Phone` | Yes | Yes |
| `LeadSource` | Yes | Yes |
| `Source_Account__c` | Yes | Yes |
| `Capture_Notes__c` | Yes | Yes |

### 5.4 Apex Class Access

| Class | Access |
|-------|--------|
| `LeadCaptureController` | Enabled |

### 5.5 LWC / Aura Access

The LWC `leadCaptureForm` is exposed as a Lightning App Builder component available to all users who hold `Lead_Capture_Access`.

---

## 6. Apex Orchestration Logic

### 6.1 Class: `LeadCaptureController`

| Property | Value |
|----------|-------|
| API Name | `LeadCaptureController` |
| Type | `public with sharing` Apex class |
| Sharing Model | `with sharing` — respects org sharing rules |
| Test Class | `LeadCaptureControllerTest` |

#### 6.1.1 Method: `submitLead`

```
@AuraEnabled
public static Id submitLead(LeadCaptureInput input)
```

**Responsibility:** Validates input, maps to `Lead` SObject, performs insert, returns new Lead Id.

**Orchestration flow:**

```
submitLead(input)
  │
  ├─ [1] Validate input fields (SV-01 → SV-04)
  │       └─ throw AuraHandledException on failure
  │
  ├─ [2] Map input → Lead SObject
  │       ├─ FirstName, LastName, Company, Email, Phone, LeadSource
  │       ├─ Capture_Notes__c  ← input.notes
  │       └─ Source_Account__c ← input.sourceAccountId (nullable)
  │
  ├─ [3] If sourceAccountId provided:
  │       └─ SOQL: SELECT Id FROM Account WHERE Id = :input.sourceAccountId LIMIT 1
  │           └─ throw AuraHandledException if not found
  │
  ├─ [4] INSERT lead (bulkification-safe: single record, wrapped in try/catch DmlException)
  │
  └─ [5] Return lead.Id
```

**Governor limit considerations:**
- 1 SOQL query (Account lookup, conditional)
- 1 DML statement
- Well within limits for synchronous Apex

#### 6.1.2 Inner Class: `LeadCaptureInput`

```apex
public class LeadCaptureInput {
    @AuraEnabled public String firstName       { get; set; }
    @AuraEnabled public String lastName        { get; set; }
    @AuraEnabled public String company         { get; set; }
    @AuraEnabled public String email           { get; set; }
    @AuraEnabled public String phone           { get; set; }
    @AuraEnabled public String leadSource      { get; set; }
    @AuraEnabled public String notes           { get; set; }
    @AuraEnabled public String sourceAccountId { get; set; }
}
```

### 6.2 Class: `LeadCaptureControllerTest`

| Property | Value |
|----------|-------|
| Type | `@IsTest` class |
| Target coverage | ≥ 90% of `LeadCaptureController` |

**Required test scenarios:**

| Test Method | Scenario |
|-------------|----------|
| `testSubmitLead_success` | Valid input, all required fields, no account lookup → Lead inserted, Id returned |
| `testSubmitLead_withAccount` | Valid input + valid `sourceAccountId` → Lead inserted with lookup populated |
| `testSubmitLead_missingLastName` | Blank `lastName` → `AuraHandledException` thrown |
| `testSubmitLead_missingEmail` | Blank `email` → `AuraHandledException` thrown |
| `testSubmitLead_invalidEmail` | Malformed email → `AuraHandledException` thrown |
| `testSubmitLead_invalidAccountId` | Non-existent `sourceAccountId` → `AuraHandledException` thrown |

---

## 7. LWC Component: `leadCaptureForm`

| Property | Value |
|----------|-------|
| Component Name | `leadCaptureForm` |
| Target | `lightning__AppPage`, `lightning__RecordPage`, `lightning__HomePage` |
| Apex Wire/Imperative | Imperative call to `LeadCaptureController.submitLead` |
| State Management | Internal reactive properties; no wire adapters required |

**Component files:**

```
force-app/main/default/lwc/leadCaptureForm/
├── leadCaptureForm.html
├── leadCaptureForm.js
├── leadCaptureForm.css
└── leadCaptureForm.js-meta.xml
```

**UX behaviour:**
- Form resets to blank state after successful submission
- Success toast (`lightning/platformShowToastEvent`, variant `success`) displayed on insert
- Error toast (variant `error`) displayed for both client and server validation failures
- Submit button disabled while async call is in-flight (`isLoading` flag)

---

## 8. Metadata File Inventory

| File Path | Type | Purpose |
|-----------|------|---------|
| `force-app/main/default/lwc/leadCaptureForm/` | LWC Bundle | UI form |
| `force-app/main/default/classes/LeadCaptureController.cls` | Apex Class | Server controller |
| `force-app/main/default/classes/LeadCaptureController.cls-meta.xml` | Apex Meta | API version declaration |
| `force-app/main/default/classes/LeadCaptureControllerTest.cls` | Apex Test Class | Unit tests |
| `force-app/main/default/classes/LeadCaptureControllerTest.cls-meta.xml` | Apex Meta | API version declaration |
| `force-app/main/default/objects/Lead/fields/Source_Account__c.field-meta.xml` | Custom Field | Lookup to Account |
| `force-app/main/default/objects/Lead/fields/Capture_Notes__c.field-meta.xml` | Custom Field | Long text area |
| `force-app/main/default/permissionsets/Lead_Capture_Access.permissionset-meta.xml` | Permission Set | Access control |

---

## 9. Definition of Done

- [ ] All 8 metadata files exist and are syntactically valid XML/JS
- [ ] `LeadCaptureControllerTest` passes with ≥ 90% code coverage
- [ ] `Lead_Capture_Access` Permission Set deployed and assignable
- [ ] LWC renders without console errors in target org
- [ ] All 6 client-side validation rules fire correctly
- [ ] All 6 server-side test methods pass
- [ ] Deployment completes without errors via `sf project deploy start`
