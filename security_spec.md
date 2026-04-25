# Security Specification

## Data Invariants
1. A true user must exist in the `users` collection to operate the application.
2. Only Admins can modify other users' roles.
3. Sales data (`sales` collection) has no specific owner, it is organization-wide data. Thus, access relies strictly on Global Roles (Admin, Analyst, Standard).
4. Standard users (Viewers) can only Read. They cannot create, update, or delete sales records.
5. Analysts can read, create (upload Excel), and update specific manual fields (`dataCancelamento`, `cotasCanceladas`, `cotasRetidas`). They cannot delete.
6. Admins have full CRUD access over `sales`.
7. Every sale document must have a `cpfDataKey` ensuring integrity.

## The "Dirty Dozen" Payloads
1. **Anon_Read**: Unauthenticated user attempts to list sales. -> DENY.
2. **Viewer_Write**: Authenticated standard user attempts to create a sale. -> DENY.
3. **Analyst_Delete**: Authenticated analyst role attempts to delete a sale. -> DENY.
4. **Analyst_Poisoning**: Analyst attempts to update `quantVenda` (an immutable field from Excel). -> DENY (via `hasOnly` enforcement / `diff`).
5. **Self_Escalation**: User attempts to update their own `users` document to set `role: 'admin'`. -> DENY (only Admins can update roles, or immutable on self).
6. **Ghost_Field**: Admin attempts to insert a sale document with an unmapped field `malicious_script: true`. -> DENY (schema enforcement).
7. **Type_Poisoning**: Admin attempts to save a sale with `cotasCanceladas` as a 1MB string instead of a number. -> DENY (type enforcement).
8. **Size_Exhaustion**: Analyst attempts to upload a `cliente` name string larger than 250 chars. -> DENY.
9. **Role_Spoofing**: User passes a payload claiming `existing().role == 'admin'` manually in a create request. -> DENY.
10. **ID_Poisoning**: Request with a document ID containing special path characters or massive size to break wildcard routing. -> DENY (`isValidId`).
11. **Spoof_Email_Creation**: Someone tries to create an admin profile using a fake unverified email payload. -> DENY (enforce Request Auth checking vs UID).
12. **Missing_Keys**: Creating a sale without required variables like `cpfDataKey` or `houveVenda`. -> DENY.

## The Test Runner
See `firestore.rules.test.ts`.
