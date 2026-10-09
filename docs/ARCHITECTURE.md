# BloodLink AI: System Architecture & Privacy Design

## 1. System Overview
**BloodLink AI** is an emergency healthcare intelligence network connecting patients, accredited blood banks, hospitals, and voluntary blood donors in real time.

The system prioritizes verified institutional inventory first, only initiating consent-based emergency donor outreach when compatible units are unavailable locally.

```
       +-------------------------------------------------------+
       |             Next.js 14 Frontend Application           |
       |  (Tailwind CSS, Lucide, Leaflet Maps, Realtime Hub)   |
       +-------------------------------------------------------+
                                  |
                                  | REST APIs & WebSockets
                                  v
       +-------------------------------------------------------+
       |             Node.js / Express REST Backend            |
       |  (Zod Validation, JWT Auth, Atomic Transactions)     |
       +-------------------------------------------------------+
              /                   |                     \
             v                    v                      v
+-----------------------+ +---------------------+ +----------------------+
|  Operational DB       | | Privacy Vault       | | Emergency Dispatch   |
|  - hospitals          | | - donor_private_    | | - Twilio SMS         |
|  - blood_inventory    | |   profiles          | | - Sandbox Mock       |
|  - patient_requests   | |   (Masked PII)      | | - Realtime Broadcast |
+-----------------------+ +---------------------+ +----------------------+
```

---

## 2. Privacy-First Relational Separation

To comply with HIPAA, GDPR, and medical confidentiality standards, **BloodLink AI** strictly separates operational matching data from private identifying information:

### A. Pseudonymous Operational Engine (`donor_matching_profiles`)
- Key: Random `donor_uuid` (UUIDv4)
- Contains **zero PII**: No names, no telephone numbers, no email addresses, no exact residential coordinates.
- Stores only: `blood_group`, approximate centroid coordinates (`lat_approx`, `lng_approx`), city name, `is_available`, `is_eligible`, `last_donation_date`, `service_radius_km`.
- Publicly searchable by the backend matching engine.

### B. Encrypted Contact Vault (`donor_private_profiles`)
- Key: `donor_uuid`
- Stores: `full_name`, `phone_number`, `email`, `emergency_notification_consent`, `opt_out_status`.
- Accessible **only by the authorized internal notification service** when an accredited hospital staff member triggers emergency outreach for a verified patient case.
- Phone numbers are masked in all logs and frontend views (e.g. `+1 ***-***-0201`).

---

## 3. Blood Group & Component Compatibility Logic

Compatibility is **component-specific**:
1. **Packed Red Blood Cells (PRBC)**: Recipient antibodies react against donor antigens.
   - O- is universal PRBC donor.
   - AB+ is universal PRBC recipient.
2. **Fresh Frozen Plasma (FFP)**: Donor antibodies react against recipient red cells.
   - **AB is universal plasma donor** (plasma has neither anti-A nor anti-B antibodies).
   - O is universal plasma recipient.
3. **Platelets (PLT)**: ABO-identical preferred; compatible apheresis crossmatches permitted during shortages.

---

## 4. Concurrency & Atomic Inventory Protection

To prevent double-booking or overselling of life-critical blood units:
- Every reservation, issue, quarantine, and expiration action is executed inside an atomic SQLite/PostgreSQL transaction.
- Status transitions are logged in `blood_inventory_movements` for complete regulatory compliance and tracing.
- Immediate real-time WebSocket events inform connected hospital dashboards to update UI counters instantaneously.
