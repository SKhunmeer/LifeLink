# BloodLink AI: Complete API Documentation

Base URL: `http://localhost:4000/api`

---

## 1. Authentication & Identity (`/api/auth`)

### `POST /api/auth/register`
Registers a new user account. For donors, automatically establishes pseudonymous matching profile and isolated encrypted contact vault.
- **Request Body**:
  ```json
  {
    "email": "donor@example.com",
    "password": "SecurePassword123!",
    "fullName": "Jane Doe",
    "phone": "+1 (415) 555-0199",
    "role": "donor",
    "bloodGroup": "O-",
    "approxCity": "San Francisco",
    "lat": 37.7749,
    "lng": -122.4194,
    "notificationConsent": true
  }
  ```
- **Response `201`**: `{ "user": { ... }, "token": "JWT_BEARER_TOKEN" }`

### `POST /api/auth/login`
- **Request Body**: `{ "email": "admin@bloodlink.ai", "password": "BloodLink2026!" }`
- **Response `200`**: `{ "user": { ... }, "token": "JWT_BEARER_TOKEN" }`

### `GET /api/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response `200`**: Returns current profile, role permissions, and linked facility/donor credentials.

### `GET /api/auth/demo-accounts`
Returns all seeded demo roles (Admin, Hospital Staff, Patient Attendant, Donors) for instant hackathon presentation role switching.

### `POST /api/auth/switch-demo`
- **Request Body**: `{ "userId": "u0000000-0000-0000-0000-000000000002" }`
- **Response `200`**: `{ "user": { ... }, "token": "JWT_TOKEN" }`

---

## 2. Blood Inventory & Atomic Stock Control (`/api/inventory`)

### `GET /api/inventory`
Lists real-time inventory items.
- **Query Parameters**:
  - `hospitalId` (optional): Filter by facility UUID
  - `bloodGroup` (optional): `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`
  - `component` (optional): `packed_red_blood_cells`, `platelets`, `plasma`, `whole_blood`, `cryoprecipitate`
  - `status` (optional): `available`, `reserved`, `quarantined`, `expired`
- **Response `200`**: `{ "inventory": [ ... ] }`

### `POST /api/inventory` (Hospital Staff & Admin)
Intakes a new verified blood batch.
- **Request Body**:
  ```json
  {
    "hospitalId": "h0000000-0000-0000-0000-000000000001",
    "bloodGroup": "O-",
    "component": "packed_red_blood_cells",
    "unitsCount": 4,
    "status": "available",
    "batchNumber": "B-SF-2026-901",
    "storageLocation": "Emergency Trauma Frig 1",
    "collectionDate": "2026-10-01",
    "expiryDate": "2026-11-12"
  }
  ```

### `POST /api/inventory/adjust` (Hospital Staff & Admin)
Executes an atomic database transaction to prevent overselling or race conditions.
- **Actions**: `reserve`, `issue`, `quarantine`, `expire`, `add`
- **Request Body**:
  ```json
  {
    "inventoryId": "i0000000-0000-0000-0000-000000000001",
    "action": "reserve",
    "units": 2,
    "reason": "Reserved for Trauma Case #104",
    "referenceRequestId": "r0000000-0000-0000-0000-000000000001"
  }
  ```

### `GET /api/inventory/analytics`
Returns aggregate inventory distributions, shortage warnings, and component breakdowns.

---

## 3. Emergency Requests & Workflow (`/api/requests`)

### `POST /api/requests`
Submits an urgent patient blood request. Returns nearest compatible facilities ranked by distance and stock.
- **Request Body**:
  ```json
  {
    "patientDisplayName": "Trauma ICU Case #942",
    "bloodGroup": "O-",
    "component": "packed_red_blood_cells",
    "unitsRequired": 2,
    "urgency": "critical",
    "hospitalId": "h0000000-0000-0000-0000-000000000001",
    "requiredByTime": "2026-10-09T18:00:00Z",
    "clinicalNotes": "Acute hemorrhagic shock; urgent crossmatch."
  }
  ```
- **Response `201`**: `{ "success": true, "requestId": "...", "facilityMatches": [ ... ] }`

### `POST /api/requests/:id/verify` (Hospital Staff)
Verifies patient medical necessity before releasing blood.

### `POST /api/requests/:id/reserve` (Hospital Staff)
Atomically locks units from available inventory to this emergency request.

### `POST /api/requests/:id/donor-outreach` (Hospital Staff)
When inventory is insufficient, executes the intelligent matching algorithm against pseudonymous donor profiles within geographic radius and dispatches consent-based emergency SMS alerts.

### `POST /api/requests/:id/fulfill` (Hospital Staff)
Marks request fulfilled upon unit administration.

---

## 4. Donor Portal & Eligibility (`/api/donors`)

### `GET /api/donors/profile`
Returns donor's matching stats, preferences, and dynamically calculated 56-day safety interval.

### `PATCH /api/donors/availability`
Updates `isAvailable` (boolean) and `serviceRadiusKm`.

### `GET /api/donors/matching-requests`
Lists verified emergency cases matching this donor.

### `POST /api/donors/respond`
- **Request Body**: `{ "matchId": "...", "response": "accepted" }`
- Broadcasts real-time event directly to the hospital operations dashboard.

---

## 5. Emergency SMS & Notifications (`/api/notifications`)

### `GET /api/notifications`
Retrieves masked audit dispatch logs (`+1 ***-***-0201`).

### `POST /api/notifications/test`
Dispatches a test emergency alert via Twilio or Sandbox Mock.
