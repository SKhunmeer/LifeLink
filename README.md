# BloodLink AI — Real-Time Smart Blood Bank & Emergency Donor Network

BloodLink AI is a production-style healthcare web application designed to connect patients, accredited hospitals, regional blood banks, and eligible voluntary blood donors in real time during acute transfusion emergencies.

---

## Key Highlights & Architecture

- **Privacy-First Relational Architecture**: Physical separation of sensitive personal data (`donor_private_profiles`) from operational matching data (`donor_matching_profiles`). Zero PII leakage.
- **Component-Specific Transfusion Logic**: Differentiates Red Blood Cells (PRBC: O- universal donor, AB+ universal recipient) from Plasma (FFP: AB universal donor, O universal recipient) and Platelets.
- **Atomic Inventory Control**: Concurrency-safe transactions that prevent double-booking and overselling of critical blood inventory.
- **Twilio SMS & Mock Sandbox Mode**: Actual Twilio SMS support when credentials are present; automatic fallback to an interactive Mock Sandbox for local development & demonstrations.
- **Clinical 56-Day Recovery Rule**: Dynamic safety interval calculator preventing unsafe repeat donations.
- **Optional Web3 Trust Layer**: Solidity `DonationEligibilityRegistry` smart contract deployed on Polygon Amoy for decentralized, anonymous interval tracking.

---

## Quick Start (Run Locally)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Test Suite
```bash
npm run test
```
*Executes all 26 unit and integration tests across compatibility matrices, smart contracts, and backend APIs.*

### 3. Build All Workspaces
```bash
npm run build
```

### 4. Start Full-Stack Application
```bash
npm run dev
```
Or start each service independently:
- **Backend API**: `npm run dev:api` (Runs on `http://localhost:4000`)
- **Frontend Web**: `npm run dev:web` (Runs on `http://localhost:3000`)

---

## Seed Demonstration Roles & Credentials

Default test password for all seeded accounts: `BloodLink2026!`

| Role | Email | Description |
| :--- | :--- | :--- |
| **Platform Admin** | `admin@bloodlink.ai` | System health, hospital verification, tamper-evident audit logs |
| **Hospital Staff** | `metro.staff@bloodlink.ai` | Blood bank director at Metro General Trauma Center |
| **Patient Attendant** | `patient.attendant@bloodlink.ai` | Submitting emergency blood requests for acute surgical cases |
| **Universal Donor (O-)** | `donor.oneg@bloodlink.ai` | Universal red cell donor eligible for emergency outreach |
| **Donor (A+)** | `donor.apos@bloodlink.ai` | Voluntary donor with 56-day safety interval tracking |

---

## Location and Nearby Hospital Search

The facility map requests device location through the browser Geolocation API when opened. Location requires HTTPS in production (localhost is permitted for development); denial, timeout, and unavailable-device errors can be retried from the map. If device GPS is unavailable, the user can explicitly search for and select a place (the manual area is approximate, not GPS); the map initially suggests Medchal, Telangana, based on the user-provided area. Coordinates are sent to the backend and searched through OpenStreetMap Overpass within 5 km by default, with a 10 km option. If Overpass is temporarily unavailable, a spatially bounded OpenStreetMap Nominatim search is used as a live fallback. Place search is also provided by Nominatim. No Places API key is required. Backend-only `OVERPASS_API_URL` and `NOMINATIM_API_URL` variables can override the public endpoints.

Nearby place records can include mapped names, addresses, and phone numbers; the source does not verify transfusion services or current blood inventory, so availability is shown as unknown. The emergency-request form offers live hospitals around the chosen location as receiving facilities. Before saving, the API revalidates the selected facility against live nearby results, stores its OSM provenance as unverified, and saves the request location and whether it came from device GPS or a manually selected approximate area. These external listings do not imply BloodLink registration, clinical service verification, or available stock. Compatible-unit counts are shown separately and only from verified BloodLink hospital inventory within 25 km, avoiding distant demo facilities being presented as nearby. Emergency requests are persisted in the configured SQLite database (`DATABASE_PATH`) and use the signed-in account's validated phone number for follow-up.

---

## Project Structure

```
bloodlink-ai/
├── apps/
│   ├── api/             # Node.js + Express REST API + WebSocket Hub
│   │   ├── src/
│   │   │   ├── db.ts               # Relational engine with auto-seeding
│   │   │   ├── services/           # Inventory, Matching, Notification, Audit
│   │   │   ├── routes/             # Auth, Inventory, Requests, Donors, Hospitals
│   │   │   └── server.ts           # Express app & WebSocket hub
│   └── web/             # Next.js 14 App with Tailwind CSS & Leaflet
│       └── src/
│           ├── app/                # Main dashboard & layout
│           └── components/         # Inventory, Requests, Donor, Admin, Simulator
├── packages/
│   ├── shared/          # Types, interfaces, Zod schemas, utility helpers
│   ├── compatibility/   # Clinical blood compatibility & 56-day rule logic
│   └── contracts/       # Hardhat + Solidity DonationEligibilityRegistry
├── supabase/
│   ├── migrations/      # 001_initial_schema.sql (PostgreSQL DDL & RLS)
│   └── seed.sql         # Realistic clinical seed dataset
├── docs/                # Architecture, API docs, and workflow guide
└── docker-compose.yml   # Multi-container orchestration (Postgres, API, Web)
```
