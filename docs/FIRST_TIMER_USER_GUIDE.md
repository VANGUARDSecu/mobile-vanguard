# Vanguard Mobile Companion - Standard First-Timer User Guide

Welcome to the **Vanguard Mobile Companion**! This guide is designed for new corporate users and employees installing the Vanguard Mobile application on their iOS or Android smartphones.

---

## Table of Contents
1. [Introduction to Vanguard Mobile Companion](#1-introduction-to-vanguard-mobile-companion)
2. [First-Time Sign-In & Device Enrollment](#2-first-time-sign-in--device-enrollment)
3. [Biometric Hardware Lock & Auto-Lock Protection](#3-biometric-hardware-lock--auto-lock-protection)
4. [Air-Gapped Authenticator Vault (TOTP)](#4-air-gapped-authenticator-vault-totp)
5. [Out-of-Band Push Notification MFA & Number Matching](#5-out-of-band-push-notification-mfa--number-matching)
6. [Single Sign-On (SSO) Applications Launchpad](#6-single-sign-on-sso-applications-launchpad)
7. [Requesting Access to Applications](#7-requesting-access-to-applications)
8. [First-Timer Onboarding Checklist & Progress Tracking](#8-first-timer-onboarding-checklist--progress-tracking)
9. [Offline Security & Lost Device Safeguards](#9-offline-security--lost-device-safeguards)
10. [Frequently Asked Questions (FAQ)](#10-frequently-asked-questions-faq)

---

## 1. Introduction to Vanguard Mobile Companion

Vanguard Mobile Companion is your organization's **Zero-Trust Mobile Security Hub**. It pairs with your Vanguard web identity portal to provide:
- **Biometric Authentication Gate**: Ensures that only you can authorize access or view credentials.
- **Air-Gapped TOTP Authenticator**: Generates standard 6-digit rotating time-based codes locally, functioning seamlessly even on airplanes or in secure locations with zero internet connection.
- **Out-of-Band MFA Push Verification**: Protects your corporate sign-ins with cryptographic 2-digit number matching to eliminate push fatigue attacks.
- **Single Sign-On (SSO) Application Access**: Direct one-tap launch to authorized enterprise SaaS tools.

> [!NOTE]
> Vanguard Mobile Companion is strictly intended for standard corporate employees. Administrative governance tools, SCIM directory sync, LDAP/RADIUS server controls, and tenant-wide emergency killswitches remain restricted to the isolated IT Security infrastructure and are never exposed on mobile devices.

---

## 2. First-Time Sign-In & Device Enrollment

When you first open Vanguard Mobile:
1. Enter your **Corporate Email Address** and your Vanguard password.
2. If prompted, complete your secondary verification step (email OTP or initial activation code).
3. Upon successful sign-in, your mobile device establishes a secure cryptographic session token stored in your phone's hardware-backed secure storage.
4. The app will immediately present the **First-Timer User Guide & Onboarding Checklist** to guide you through initial setup.

---

## 3. Biometric Hardware Lock & Auto-Lock Protection

To prevent unauthorized access if your phone is borrowed, misplaced, or left unlocked:
- Vanguard integrates directly with **Apple Face ID / Touch ID** (iOS) and **BiometricPrompt / Fingerprint** (Android).
- Every time you open or return to the application from the background (`AppState` change), your biometric identity is verified before vault tokens or application launcher tiles are revealed.
- You can manage biometric preferences directly within the **Security Settings** tab.

---

## 4. Air-Gapped Authenticator Vault (TOTP)

Vanguard Mobile features a built-in **RFC 6238 Authenticator Vault**:
- **Zero Network Required**: TOTP secrets are derived strictly using the device's synchronized hardware clock and secret seed. No internet connection or cellular signal is required.
- **Real-Time Circular Countdown**: An animated circular progress ring visualizes the 30-second token lifetime. When the ring turns amber/red, a new code will be generated shortly.
- **One-Tap Clipboard Copy**: Tap any 6-digit code or the copy button to instantly copy the one-time code to your device clipboard with automatic feedback.

---

## 5. Out-of-Band Push Notification MFA & Number Matching

When logging into corporate web tools (e.g., Vanguard Web Portal, AWS, Slack, Jira) from your workstation, your phone may receive an Out-of-Band Push Notification.

### How Number Matching Works:
1. Your workstation browser presents a **2-digit challenge number** (for example, `68`).
2. Your phone receives an interactive push alert displaying:
   - Requesting Application Name (e.g., `Corporate GitHub Organization`)
   - Geographic origin & IP address
   - Timestamp of request
3. Tap the matching number (`68`) from the options displayed on your phone screen.
4. Authorize with your fingerprint or Face ID.

> [!WARNING]
> **Push Fatigue & Fraud Defense**: If you receive a push notification that you did not initiate, **never tap an authorization number**. Tap **"Report Fraud / Deny"** immediately. This alerts IT Security and temporarily suspends unauthorized access attempts against your account.

---

## 6. Single Sign-On (SSO) Applications Launchpad

The **My Apps** tab serves as your mobile application launchpad:
- View all corporate tools assigned to your role (e.g., Google Workspace, Salesforce, Datadog, Slack).
- Tap any application tile to open the encrypted SAML 2.0 / OIDC session in your mobile browser with seamless single sign-on.
- Live status indicators show whether each tool is active and operational.

---

## 7. Requesting Access to Applications

Need access to an application that isn't currently assigned to your team?
1. Open the **My Apps** screen.
2. Tap the **"+ Request App"** button at the top right of the launcher.
3. Select the required software from the catalog.
4. Enter your business justification and select the requested access duration (e.g., temporary 30-day access or permanent).
5. Submit the request. Your team lead and IT compliance officer will receive notification to approve or provision access.

---

## 8. First-Timer Onboarding Checklist & Progress Tracking

The built-in **First-Timer User Guide Modal** tracks your setup progress across key security milestones:
- [x] **Sign In to Vanguard Mobile Companion**: Authenticate your corporate account.
- [x] **Enable Biometric Hardware Lock**: Secure the app with Face ID, Touch ID, or Android Biometrics.
- [x] **Test Air-Gapped Authenticator (TOTP)**: Locate the Authenticator Vault and copy a rotating 6-digit code.
- [x] **Review Push Notification MFA**: Understand 2-digit number matching and how to report fraud.
- [x] **Explore Single Sign-On (SSO) Apps**: Open your application catalog and launch your first tool.
- [x] **Request Application Access**: Learn how to submit a self-service access request.
- [x] **Secure Recovery Codes on Web**: Store offline recovery codes in an encrypted safe location.

You can reopen this checklist at any time by tapping the **"📖 Guide"** button in the top user session bar on the **My Apps** screen.

---

## 9. Offline Security & Lost Device Safeguards

- **No Remote Credential Leaks**: TOTP credentials stored in the local vault are encrypted with device keys.
- **Device Loss**: If your mobile device is lost or stolen:
  1. Access the web portal at [`/dashboard`](http://localhost:4200) from your corporate laptop.
  2. Navigate to **Security & MFA > Enrolled Devices**.
  3. Click **Revoke Device** to immediately invalidate all mobile sessions and refresh tokens.
  4. Use your **Emergency Recovery Codes** to sign in if no other second factor is available.

---

## 10. Frequently Asked Questions (FAQ)

### Q: Why do my TOTP codes say "Invalid Code" when entered on my computer?
**A:** Ensure your phone's system time is set to **Automatic / Network Provided**. TOTP algorithms rely on accurate time synchronization. A clock drift of more than 30 seconds can cause codes to be rejected.

### Q: Does the mobile app drain battery in the background?
**A:** No. Vanguard Mobile relies on Apple Push Notification service (APNs) and Firebase Cloud Messaging (FCM) for push notifications, keeping background resource consumption minimal.

### Q: Can I use Vanguard Mobile on multiple phones?
**A:** Yes, you can enroll both a primary smartphone and an approved corporate tablet. Each device will have its own independent cryptographic enrollment record.

### Q: Where do I go if I need admin access or technical assistance?
**A:** Contact your internal IT Support Desk or open an IT ticket through your company's service desk portal.
