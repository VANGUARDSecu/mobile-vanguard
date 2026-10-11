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
Run the full automated test suite verifying authentication, OTP/TOTP two-step verification, sign out workflow, data models, UI components, SSO integrations, personal apps, enterprise requests, browser launchers, Authenticator Vault, and end-to-end workflows (99 automated tests):
```bash
npm test
```

#### Test Suite Breakdown
| Suite File | Scope & Capabilities Verified |
| :--- | :--- |
| `src/__tests__/authenticator-cyber-theme.test.ts` | Design tokens (`#0a0e17`, `#00e5ff`, `#10b981`, `#6366f1`, glass cards), reusable cyber components, Vault CRUD, RFC 6238 TOTP generation, Base32 validation, and screen navigation transitions (SCRUM-17) |
| `src/__tests__/auth.test.ts` | Supabase database credentials, email/password validation, rejection of unregistered accounts, 2-step MFA challenge |
| `src/__tests__/otp-auth.test.ts` | Email OTP verification, Authenticator TOTP validation, resend cooldown timer, rejection of invalid/bypass codes (SCRUM-79) |
| `src/__tests__/logout-auth.test.ts` | Sign out button touch handling, session clearance, backend `/auth/logout` dispatching, duplicate invocation guards, and unauthenticated root layout gating |
| `src/__tests__/auth-responsiveness.test.ts` | Root layout `isInitializing` isolation preserving MFA submission state, sign out tactile feedback, and splash overlay non-blocking hit testing |
| `src/__tests__/app-navigation.test.ts` | Anchored bottom tab bar layout (`bottom: 0`), pointer pass-through, non-obstructed session header, and Expo Starter banner removal |
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

## 🛡️ Authenticator Vault & Dark Cyber Theme System (SCRUM-17)

The mobile application features a standalone air-gapped **Authenticator Vault** implementing zero-trust local hardware attestation, continuous TOTP code rotation, and a comprehensive cyber dark design system mirroring Vanguard's web identity portal.

### 🎨 Cyber Dark Design Tokens (`src/constants/cyber-theme.ts`)
- **Base Background**: `#0a0e17`
- **Surface Cards**: `#0f172a`, secondary `#131d31`, hover `#1e293b`
- **Cyber Accents**: `#00e5ff` (Cyan), `#10b981` (Emerald), `#6366f1` (Indigo), `#f59e0b` (Amber), `#ef4444` (Red)
- **Glassmorphism**: Translucent card backgrounds (`rgba(15, 23, 42, 0.75)`), subtle borders (`rgba(30, 41, 59, 0.8)`), cyan glows, and layered modals.

### 🧩 Reusable Cyber UI Components (`src/components/cyber/`)
1. **`CyberButton`**: Multi-variant interactive buttons (`primary`, `secondary`, `success`, `danger`, `ghost`, `outline`) with glowing shadows, accessible touch feedback, size presets (`sm`, `md`, `lg`), and loading indicators.
2. **`CyberCard`**: Translucent glassmorphic card containers (`glass`, `default`, `glow`, `accent`, `danger`) with optional header/footer slots and clickability.
3. **`Badge`**: Status and tag badges (`cyan`, `green`, `indigo`, `amber`, `red`, `muted`) with glowing borders and rounded pill geometry.
4. **`StatusIndicator`**: Real-time status LED indicators with pulsating animation loops (`active`, `synced`, `pending`, `offline`, `error`, `warning`).
5. **`ModalHeader`**: Standardized cyber modal and screen header with icon, title, subtitle, status badge, and touchable close trigger.

### 🔑 Authenticator Vault Screens & Navigation
1. **Vault Screen (`src/screens/vault-screen.tsx`)**:
   - Live 6-digit TOTP codes with 30-second rotation countdown bar.
   - One-tap clipboard copy with tactile feedback (`COPIED! ✓`).
   - Real-time search filter by account identifier or service issuer.
   - Quick navigation triggers to Add Account and Security Settings.
2. **Account Detail Screen (`src/screens/account-detail-screen.tsx`)**:
   - Comprehensive token specifications (Algorithm, Digits, Period, Storage).
   - Base32 secret key inspection with toggleable mask (`•••• ••••`) and copy action.
   - Emergency recovery codes preview.
   - Token deletion workflow with confirmation guard.
3. **Add Account Screen (`src/screens/add-account-screen.tsx`)**:
   - **Manual Entry**: Account identifier, issuer, Base32 key validation (RFC 4648), icon selector, and algorithm options (`SHA1`, `SHA256`).
   - **QR Scanner View**: Cyber camera viewfinder simulation with simulated QR barcode decode capability.
4. **Security Settings Screen (`src/screens/security-settings-screen.tsx`)**:
   - Hardware enclave zero-trust attestation diagnostics.
   - Biometrics toggle (Face ID / Touch ID / Fingerprint lock).
   - Inactivity auto-lock selectors (`Instant`, `1 min`, `5 min`, `15 min`).
   - Clipboard auto-clear timeout (`15s`, `30s`, `60s`).
   - Encrypted JSON vault export & emergency factory wipe.
5. **Screen Transitions (`src/screens/authenticator-navigator.tsx`)**:
   - Smooth animated transitions across `VaultScreen` ⇄ `AccountDetailScreen` ⇄ `AddAccountScreen` ⇄ `SecuritySettingsScreen`.

---

## 🔐 Authentication, Authorization & 2-Step Verification (OTP / TOTP)

The application features a complete Zero-Trust continuous authentication architecture mirrored from `frontend-vanguard`, connected directly to `backend-vanguard` and the live Supabase authentication database with mandatory second-factor verification.

### Authentication & MFA Endpoints
| Endpoint | Method | Payload / Contract | Description |
| :--- | :--- | :--- | :--- |
| `/auth/login` | `POST` | `{ email, password }` | Authenticates primary credentials against Supabase Auth; triggers MFA challenge (`requireMfa: true`) |
| `/auth/verify-otp` | `POST` | `{ email, token, type: 'email' }` | Verifies dynamic 8-digit or 6-digit email OTP; issues session JWT |
| `/auth/verify-totp` | `POST` | `{ email, code }` | Verifies 6-digit Authenticator App (Google Authenticator / Microsoft Authenticator) TOTP code |
| `/auth/resend-otp` | `POST` | `{ email, type: 'email' }` | Dispatches fresh verification code with a 45-second cooldown throttle |
| `/auth/logout` | `POST` | `{}` | Revokes active server session and invalidates session token |

### Production Supabase Database Authentication (SCRUM-79)
All simulated quick demo accounts and developer test shortcuts have been removed:
- **Direct Database Authentication**: Users log in using genuine accounts registered or provisioned in the Supabase authentication database.
- **Error Propagation**: Invalid or unregistered credentials return clear backend error alerts directly on the login screen (`⚠️ Invalid login credentials`) without masking errors or advancing to OTP.
- **Mandatory Second Factor**: Users enter the dynamic verification code delivered to their email or generated by their Authenticator app.
- **Two-Step Verification Screen**: Auto-advancing digit inputs, backspace navigation, paste handling, resend timer, and method switcher (Email OTP vs Authenticator TOTP).
- **Pinned User Session Header & Sign Out ⎋**: Pinned outside the scrollable area with dedicated `hitSlop`, `cursor: 'pointer'`, loading spinner, and immediate unauthenticated layout transition back to `LoginScreen`.
- **User-Scoped SSO Integrations**: Active SSO connected applications and OAuth authorizations are dynamically scoped and filtered to the logged-in user account.

---

## 🏛️ Architecture & Modules

- `src/models/auth.models.ts`: TypeScript interfaces for `AuthUser`, `LoginCredentials`, `LoginResult`, `MfaChallengeResponse`, `VerifyOtpRequest`, `VerifyTotpRequest`, and `AuthResponse`.
- `src/models/apps.models.ts`: Core TypeScript definitions for SaaS applications, connected SSO clients, access requests, and personal bookmarks.
- `src/models/vault.models.ts`: TypeScript models for `TotpAccount`, `VaultSecuritySettings`, `AddTotpAccountInput`, and `AuthenticatorScreenName`.
- `src/services/auth.service.ts`: Authentication service supporting local directory fallback, live backend API authentication (`POST /auth/login`, `POST /auth/verify-otp`, `POST /auth/verify-totp`, `POST /auth/resend-otp`), SSO federation, and AsyncStorage token/user session management.
- `src/services/vault.service.ts`: Standalone local Authenticator Vault service with RFC 6238 TOTP computation, Base32 key validation, local storage persistence, and zero external cloud database dependencies.
- `src/services/apps-storage.service.ts`: Offline persistence layer backed by `@react-native-async-storage/async-storage` with seed data, live backend synchronization (`/oauth/connected-apps`), and deduplication safeguards.
- `src/services/app-launcher.service.ts`: Centralized application launch dispatcher integrating Expo's in-app browser (`expo-web-browser`) and external linking (`expo-linking`) with Cyber Dark theme styling, URL normalization, and personal vault credential matching.
- `src/context/auth-context.tsx`: Reactive authentication provider (`AuthProvider` and `useAuth`) managing session state, login, 2-step OTP/TOTP verification, and logout.
- `src/context/apps-context.tsx`: Reactive React Context (`AppsProvider` and `useApps`) providing workspace mode switching (Personal vs. Enterprise), category filtering, active SSO connected apps management, and request queueing scoped to current user.
- `src/constants/cyber-theme.ts`: Cyber Dark palette design tokens (`#0a0e17`, `#00e5ff`, `#10b981`, `#6366f1`, translucent glass cards, shadows, radius).
- `src/components/cyber/`: Reusable cyber design system UI components (`CyberButton`, `CyberCard`, `Badge`, `StatusIndicator`, `ModalHeader`).
- `src/screens/vault-screen.tsx`: Air-gapped TOTP authenticator screen with live codes, countdown timer, and search filter.
- `src/screens/account-detail-screen.tsx`: Authenticator detail screen with secret key inspection and token removal.
- `src/screens/add-account-screen.tsx`: Manual Base32 token entry and simulated camera QR scanner.
- `src/screens/security-settings-screen.tsx`: Biometrics lock, inactivity timeout, clipboard sanitization, and encrypted backup export.
- `src/screens/authenticator-navigator.tsx`: Screen coordinator managing clean transitions across vault screens.
- `src/screens/verify-otp-screen.tsx`: Cyber Dark 2-Step Verification screen with auto-advancing digit inputs, paste support, timer countdown, and test bypass chips.
- `src/app/vault.tsx`: Route mounting `AuthenticatorNavigator`.
- `src/app/verify-otp.tsx`: Route entry point mounting `VerifyOtpScreen`.
- `src/app/login.tsx`: Cyber Dark login screen with email/password validation, show/hide password toggle, and seamless 2-step verification transition.
- `src/app/index.tsx`: Clean route mounting `MyAppsScreen` as the primary launchpad entry point.
- `src/screens/my-apps-screen.tsx`: Unified applications launchpad combining live user session banner, workspace switching (Personal Bookmarks vs. Enterprise SSO), category navigation, active SSO connected clients, governance requests queue, application cards, and interactive modal sheets.
- `src/components/app-tabs.tsx`: Cyber-styled bottom navigation tab bar mapping Vault, Apps, and Security tabs.
- `src/components/apps/`: Reusable applications directory UI components (`PulseDot`, `ConnectedAppCard`, `ConnectedAppsSection`, `AddPersonalAppModal`, `RequestAppModal`, `RequestCard`, `RequestedAppsSection`, `CategoryFilterBar`, `AppCard`, `EmptyAppsState`).
- `src/__tests__/`: Automated unit and integration test specifications (`authenticator-cyber-theme.test.ts`, `auth.test.ts`, `otp-auth.test.ts`, `apps-data.test.ts`, `apps-ui.test.ts`, `connected-apps.test.ts`, `personal-app-modal.test.ts`, `request-app-modal.test.ts`, `governance-queue.test.ts`, `app-launcher.test.ts`, `my-apps-screen.test.ts`, `e2e-workflow.test.ts`).



