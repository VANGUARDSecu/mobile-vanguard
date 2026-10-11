# Vanguard Mobile (`mobile-vanguard`)

Vanguard Security Mobile Application — Built with React Native & Expo SDK 57, delivering Zero-Trust Identity, SSO Application Launchpad, and Authenticator Vault capabilities for iOS, Android, and Web.

---

## 🛠️ Prerequisites & Requirements

- **Node.js**: `v20.x` or `v22.x`+ (LTS recommended, tested on `v24.19.x`)
- **Package Manager**: `npm` (v10+)
- **Expo CLI**: bundled via `npx expo`
- **Mobile Platforms**:
  - iOS Simulator (macOS + Xcode) or Physical Device via Expo Go
  - Android Emulator (Android Studio SDK) or Physical Device via Expo Go
  - Web Browser (Chrome, Firefox, Safari, Edge)

---

## ⚙️ Environment Configuration

The application works out-of-the-box with offline local storage and pre-seeded enterprise/connected SSO applications. To connect to a live Vanguard backend server (for live SSO session synchronization and OAuth connected app inspection):

| Variable | Description | Default |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | Vanguard Identity Provider backend URL | `http://localhost:3000` |

*Note for physical devices or Android emulators: Set `EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:3000` (or `http://10.0.2.2:3000` on Android emulator).*

---

## 📦 Installation & Setup

1. **Navigate to Repository**:
   ```bash
   cd mobile-vanguard
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

   *Core Dependencies included:*
   - `expo`: `~57.0.24`
   - `expo-router`: `~57.0.22`
   - `expo-web-browser`: `~57.0.3`
   - `expo-linking`: `~57.0.10`
   - `expo-clipboard`: `~57.0.2`
   - `@react-native-async-storage/async-storage`: `2.2.0`
   - `react-native`: `0.86.3`
   - `react`: `19.2.3`

---

## 🚀 Running the Application

### Development Server & Bundler
Start the Metro bundler:
```bash
npm start
# or
npx expo start
```

### Platform-Specific Launch Targets
- **Web Preview**:
  ```bash
  npm run web
  ```
- **Android Emulator / Device**:
  ```bash
  npm run android
  ```
- **iOS Simulator**:
  ```bash
  npm run ios
  ```

---

## 🧪 Testing & Code Quality

### Automated Test Suites
Run the full automated test suite verifying authentication, OTP/TOTP two-step verification, sign out workflow, data models, UI components, SSO integrations, personal apps, enterprise requests, browser launchers, and end-to-end workflows (81 automated tests):
```bash
npm test
```

#### Test Suite Breakdown
| Suite File | Scope & Capabilities Verified |
| :--- | :--- |
| `src/__tests__/auth.test.ts` | Demo account credentials, email/password validation, 2-step MFA initiation, session persistence, logout |
| `src/__tests__/otp-auth.test.ts` | Email OTP verification (8-digit/6-digit), Authenticator TOTP validation, resend cooldown timer, dev test bypass codes (`123456`/`12345678`) |
| `src/__tests__/logout-auth.test.ts` | Sign out button touch handling, session clearance, backend `/auth/logout` dispatching, duplicate invocation guards, and unauthenticated root layout gating |
| `src/__tests__/apps-data.test.ts` | SaaS app deduplication, connected app deduplication by origin/client ID, category filtering, URL prefix normalization |
| `src/__tests__/apps-ui.test.ts` | Dynamic category counters, vault auto-fill badge computation, live connection indicators, workspace-aware empty states |
| `src/__tests__/connected-apps.test.ts` | Active SSO client discovery, Acme Dummy Web OIDC metadata, disconnection handling, active client counter badges |
| `src/__tests__/personal-app-modal.test.ts` | Quick app presets (Figma, GitHub, Notion, etc.), input validation, protocol formatting, auto-fill domain extraction |
| `src/__tests__/request-app-modal.test.ts` | Enterprise app suggestions, business justification validation, user metadata association, pending request creation |
| `src/__tests__/governance-queue.test.ts` | Access request states (`Pending`, `Approved`, `Rejected`), launch guard enforcement, zero-trust blocked banners |
| `src/__tests__/app-launcher.test.ts` | URL normalization, in-app browser dispatching, external linking fallback, personal vault domain matching |
| `src/__tests__/my-apps-screen.test.ts` | Header titles, workspace switching, pull-to-refresh lifecycle, bottom tab navigation triggers |
| `src/__tests__/e2e-workflow.test.ts` | Complete end-to-end user journey across authentication, app addition, enterprise request, SSO launch, and logout |

### Static Analysis & Type Checking
- Run ESLint:
  ```bash
  npm run lint
  ```
- Run TypeScript Type Check:
  ```bash
  npx tsc --noEmit
  ```

---

## 🔐 Authentication, Authorization & 2-Step Verification (OTP / TOTP)

The application features a complete Zero-Trust continuous authentication architecture mirrored from `frontend-vanguard`, connected directly to `backend-vanguard` with mandatory second-factor verification.

### Authentication & MFA Endpoints
| Endpoint | Method | Payload / Contract | Description |
| :--- | :--- | :--- | :--- |
| `/auth/login` | `POST` | `{ email, password }` | Authenticates primary credentials; triggers MFA challenge (`requireMfa: true`) |
| `/auth/verify-otp` | `POST` | `{ email, token, type: 'email' }` | Verifies dynamic 8-digit or 6-digit email OTP; issues session JWT |
| `/auth/verify-totp` | `POST` | `{ email, code }` | Verifies 6-digit Authenticator App (Google Authenticator / Microsoft Authenticator) TOTP code |
| `/auth/resend-otp` | `POST` | `{ email, type: 'email' }` | Dispatches fresh verification code with a 45-second cooldown throttle |
| `/auth/logout` | `POST` | `{}` | Revokes active server session and invalidates session token |

### Developer & Offline Testing Bypass Codes
For local development, automated testing, or offline Expo Go preview:
- **Email OTP Bypass**: Enter `123456` or `12345678` into the verification digit boxes.
- **Auto-Fill Buttons**: Tap the quick-fill buttons on the verification card for 1-tap testing.

### Pre-Configured Demo Accounts
| Account | Email | Password | Role / Department | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Ellen Ripley** | `ellen.ripley@weyland.corp` | `Password123!` | User / Engineering | Connected to Acme Dummy Web SSO portal |
| **John Manayon** | `user@company.com` | `Password123!` | User / Engineering | Standard corporate user profile |
| **SecOps Admin** | `admin@vanguard.security` | `Password123!` | Admin / Security Operations | Privileged administrative credentials |

- **Master Credential Authentication**: Enter email and master password to trigger the 2-step verification challenge.
- **Quick Demo Account Selector**: Tap any demo user chip on the login card to auto-fill credentials for 1-tap testing.
- **Two-Step Verification Screen**: Auto-advancing digit inputs, backspace navigation, paste handling, resend timer, and method switcher (Email OTP vs Authenticator TOTP).
- **Pinned User Session Header & Sign Out ⎋**: Pinned outside the scrollable area with dedicated `hitSlop`, `cursor: 'pointer'`, loading spinner, and immediate unauthenticated layout transition back to `LoginScreen`.
- **User-Scoped SSO Integrations**: Active SSO connected applications and OAuth authorizations are dynamically scoped and filtered to the logged-in user account.

---

## 🏛️ Architecture & Modules

- `src/models/auth.models.ts`: TypeScript interfaces for `AuthUser`, `LoginCredentials`, `LoginResult`, `MfaChallengeResponse`, `VerifyOtpRequest`, `VerifyTotpRequest`, and `AuthResponse`.
- `src/models/apps.models.ts`: Core TypeScript definitions for SaaS applications, connected SSO clients, access requests, and personal bookmarks.
- `src/services/auth.service.ts`: Authentication service supporting local directory fallback, live backend API authentication (`POST /auth/login`, `POST /auth/verify-otp`, `POST /auth/verify-totp`, `POST /auth/resend-otp`), SSO federation, and AsyncStorage token/user session management.
- `src/services/apps-storage.service.ts`: Offline persistence layer backed by `@react-native-async-storage/async-storage` with seed data, live backend synchronization (`/oauth/connected-apps`), and deduplication safeguards.
- `src/services/app-launcher.service.ts`: Centralized application launch dispatcher integrating Expo's in-app browser (`expo-web-browser`) and external linking (`expo-linking`) with Cyber Dark theme styling, URL normalization, and personal vault credential matching.
- `src/context/auth-context.tsx`: Reactive authentication provider (`AuthProvider` and `useAuth`) managing session state, login, 2-step OTP/TOTP verification, and logout.
- `src/context/apps-context.tsx`: Reactive React Context (`AppsProvider` and `useApps`) providing workspace mode switching (Personal vs. Enterprise), category filtering, active SSO connected apps management, and request queueing scoped to current user.
- `src/screens/verify-otp-screen.tsx`: Cyber Dark 2-Step Verification screen with auto-advancing digit inputs, paste support, timer countdown, and test bypass chips.
- `src/app/verify-otp.tsx`: Route entry point mounting `VerifyOtpScreen`.
- `src/app/login.tsx`: Cyber Dark login screen with email/password validation, show/hide password toggle, and seamless 2-step verification transition.
- `src/app/index.tsx`: Clean route mounting `MyAppsScreen` as the primary launchpad entry point.
- `src/screens/my-apps-screen.tsx`: Unified applications launchpad combining live user session banner, workspace switching (Personal Bookmarks vs. Enterprise SSO), category navigation, active SSO connected clients, governance requests queue, application cards, and interactive modal sheets.
- `src/components/app-tabs.tsx`: Cyber-styled bottom navigation tab bar using Cyber Dark background and cyan accent glows, mapping the default route to the Vanguard Applications portal.
- `src/constants/cyber-theme.ts`: Cyber Dark palette design tokens (`#0a0e17`, `#00e5ff`, `#10b981`, `#6366f1`, translucent glass cards).
- `src/components/apps/`: Reusable applications directory UI components:
  - `PulseDot`: Animated pulsing green status LED indicator.
  - `ConnectedAppCard`: Active SSO integration card displaying live connection pill, protocol tag, client ID with copy action, redirect URI, authorized scopes chips, last active timestamp, and launch/disconnect actions.
  - `ConnectedAppsSection`: Header banner with pulsing active count badge (`X Active Connection(s)`), live sync button, and responsive connected client card list.
  - `AddPersonalAppModal`: Slide-up cyber bottom sheet modal for personal application creation with quick presets (Figma, Facebook, GitHub, Notion, Google, Custom), URL format normalization, category selector, and error alerts.
  - `RequestAppModal`: Modal bottom sheet for enterprise organization mode allowing users to request access to corporate SaaS tools (Figma Enterprise, Salesforce CRM, Snowflake, Datadog, Splunk) with business justification and live governance queueing.
  - `RequestCard`: Governance queue card rendering status-based visual themes (`Pending Approval`, `Approved`, `Rejected`), protocol tags, audit dates, disabled launch guards, zero-trust assertion blocked badges, and admin rejection notes.
  - `RequestedAppsSection`: Organization queue section with counter badge (`X Pending Review`) and reactive list of submitted access requests.
  - `CategoryFilterBar`: Horizontal category scroll bar with active cyber glow and count indicators.
  - `AppCard`: Translucent cyber card with icon box, group badges, auto-fill indicator, live connected pill, and launch action.
  - `EmptyAppsState`: Contextual empty state with workspace-aware messaging and call-to-action buttons.
- `src/__tests__/`: Automated unit and integration test specifications (`auth.test.ts`, `otp-auth.test.ts`, `apps-data.test.ts`, `apps-ui.test.ts`, `connected-apps.test.ts`, `personal-app-modal.test.ts`, `request-app-modal.test.ts`, `governance-queue.test.ts`, `app-launcher.test.ts`, `my-apps-screen.test.ts`, `e2e-workflow.test.ts`).


