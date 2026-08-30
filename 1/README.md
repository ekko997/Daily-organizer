# Daily Organizer (React Native / Expo)

A minimalist daily organiser — work meetings, appointments, birthdays,
anniversaries, reminders, and country/region-specific public holidays —
built to be buildable and submittable to the App Store **entirely from
your phone**, no Mac required.

## Why this stack

- **React Native + Expo** compiles to a real native iOS app — not a web
  wrapper. It goes on the App Store like any other app.
- **EAS Build** (Expo's cloud build service) compiles the actual iOS
  binary on Expo's servers. You never need Xcode or a Mac.
- **EAS Submit** sends the built binary straight to App Store Connect
  from the same cloud pipeline.

## Everything you need, phone-only

1. **A GitHub account** (free) — github.com, works fine from mobile Safari/Chrome.
2. **An Expo account** (free) — expo.dev.
3. **An Apple Developer Program account** ($99/year) — developer.apple.com.
   Sign-up is a web form, works from your phone.
4. **GitHub Codespaces** — a full cloud dev environment that runs *in your
   phone's browser*. This is where you'll type the handful of commands
   below. No app to install — go to github.com, open this repo, tap
   **Code → Codespaces → Create codespace**.

## One-time setup (inside a Codespace)

```bash
npm install -g eas-cli
npm install
eas login
eas build:configure
```

`eas build:configure` will ask a few questions and set up your Apple
credentials — it can generate and manage your iOS signing certificates
for you automatically (no manual certificate wrangling needed).

## Building and submitting

```bash
# Build the real iOS binary in Expo's cloud
eas build --platform ios --profile production

# Once the build finishes, submit it straight to App Store Connect
eas submit --platform ios --latest
```

Both commands run entirely in the cloud — your phone (or the Codespace
browser tab) just needs to stay connected long enough to kick them off.
You'll get a build progress link you can check from your phone at any time.

## Previewing the app while you build (before App Store review)

Install **Expo Go** from the App Store on your iPhone, then from your
Codespace run:

```bash
npx expo start
```

Scan the QR code it prints with your iPhone camera — the app opens live
in Expo Go so you can test as you go, no build needed for quick iteration.

## Project structure

```
App.tsx                          # Root navigation + shared event state
app.json                         # Expo app config (name, icon, bundle ID)
eas.json                         # Cloud build profiles
src/
  models/Event.ts                # Types, categories, reminder options
  services/
    storageService.ts            # AsyncStorage-backed event persistence
    recurrenceEngine.ts           # Expands recurring events into occurrences
    holidayService.ts             # Fetches + caches holidays (Nager.Date API)
    notificationService.ts        # Schedules local reminder notifications
  screens/
    CalendarScreen.tsx            # Month grid + day detail
    AgendaScreen.tsx              # Upcoming events grouped by day
    AddEditEventModal.tsx         # Add/edit event form
    SettingsScreen.tsx            # Country/region picker for holidays
  utils/
    dateUtils.ts                  # Calendar grid math
    EventsContext.tsx             # Shared React context
assets/icon-1024.png              # App icon (reused from the earlier build)
```

## Before you submit for real

- Update `bundleIdentifier` in `app.json` to your own reverse-DNS ID
  (e.g. `com.yourname.dailyorganizer`).
- Add screenshots and a listing description in App Store Connect (web-based).
- A short privacy policy URL is required — the app only talks to
  `date.nager.at` for holiday data (no key, no user data sent) and stores
  everything else on-device, so this can be a simple one-pager. I can
  draft the text for you.
- Test the full flow in Expo Go first, then build a `preview` profile
  and install it on your own device via TestFlight before going to
  `production`.

## Not yet ported from the native build

- The home screen widget (WidgetKit is iOS-native only; Expo has a
  config plugin path for this, but it's a separate build step — ask if
  you want it added).
- iCloud sync.
