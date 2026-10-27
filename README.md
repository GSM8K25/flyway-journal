# Flyway Journal: getting it on the App Store

This folder is Flyway Journal set up as a real iPhone app (built with Capacitor). The same `www/` folder is still the website/PWA version and can be dropped on Netlify exactly like before.

**What's inside**
| Path | What it is |
|---|---|
| `www/` | The app itself (your files plus the iPhone changes below). Also deploy this to Netlify. |
| `www/native.js` | iPhone features: native GPS, haptics, share sheet, saving to Files, automatic backup |
| `www/privacy.html`, `www/support.html` | The privacy policy and support pages Apple requires as web links |
| `capacitor.config.json` | App ID, name and launch settings |
| `scripts/setup-ios.sh` | Creates the Xcode project and applies the iPhone settings (permissions, icon, portrait-only) |
| `ios-resources/` | 1024px App Store icon and launch screen |
| `.github/workflows/testflight.yml` | Builds and uploads the app from GitHub's Macs, if you don't have a Mac |
| `app-store/listing.md` | Everything to paste into App Store Connect: name, description, keywords, privacy answers, review notes |
| `app-store/screenshots/` | Five 6.9-inch iPhone screenshots, ready to upload |

---

## Step 1. Decide two things before the first upload (they're permanent)
1. **Bundle ID**: currently `com.gregmifflin.flywayjournal` in `capacitor.config.json`. Change it now if you want something else. It can't be changed after the first upload.
2. **Support email**: replace every `SUPPORT_EMAIL` in `www/privacy.html` and `www/support.html` (2 in each). A dedicated address, like a new Gmail just for the app, keeps your personal inbox off the App Store page.

Also check that `webUrl` at the top of `www/native.js` matches your Netlify address.

## Step 2. Put the website up (privacy and support links)
Drag the `www` folder onto https://app.netlify.com/drop, or onto your existing Flyway site's **Deploys** page to update it. Confirm these open:
- `https://<your-site>/privacy.html`
- `https://<your-site>/support.html`

Those two links go into App Store Connect.

## Step 3. Join the Apple Developer Program
https://developer.apple.com/programs/enroll/ costs $99/year. Enroll as an **Individual** with your Apple ID (two-factor authentication must be on). Approval usually takes a day or two. Your legal name appears as the seller on the App Store.

## Step 4. Build the app (pick ONE route)

### Route A: you have a Mac (best, because you can test on your iPhone first)
1. Install **Xcode 26 or newer** from the Mac App Store. Open it once and let it install its components. Apple rejects uploads built with older Xcode.
2. Install **Node 22+** from https://nodejs.org.
3. In Terminal, `cd` into this folder and run:
   ```
   bash scripts/setup-ios.sh
   npx cap open ios
   ```
4. In Xcode, click **App** (top of the left sidebar) › **Signing & Capabilities** › **Team**, and pick your developer account.
5. Plug in your iPhone, choose it at the top of the window, and press ▶ (Run). On the phone, go to Settings › General › VPN & Device Management and trust your developer profile the first time. Test with the checklist in Step 5.
6. To upload: set the top device to **Any iOS Device (arm64)**, then **Product › Archive**. When the Organizer window opens, choose **Distribute App › App Store Connect › Distribute**.

### Route B: no Mac (GitHub builds it for you)
1. Create a **private** repository on github.com and upload this whole folder, including the hidden `.github` folder.
2. In App Store Connect (after Step 6 below creates the app), go to **Users and Access › Integrations › App Store Connect API**, generate a key with the **Admin** role, and download the `.p8` file. You can only download it once.
3. In the GitHub repo, go to **Settings › Secrets and variables › Actions** and add four secrets:
   `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, and `ASC_KEY_P8` (paste the whole text of the .p8 file).
4. Go to the **Actions** tab › **Build & upload to TestFlight** › **Run workflow**. It takes about 15–25 minutes. The build then appears in App Store Connect › TestFlight.
5. Install the **TestFlight** app on your iPhone to test the build (Step 5).

## Step 5. Test on your iPhone (TestFlight or Xcode)
- [ ] Location prompt appears with the Flyway wording, and Start today's hunt fills in the spot and weather
- [ ] + / − counters give a little haptic tap
- [ ] Take photo (camera prompt) and From library both work
- [ ] Mark here, Map tab (satellite and street layers), drop a pin
- [ ] Season › Save backup opens the share sheet, and the file shows in **Files › On My iPhone › Flyway**
- [ ] Season › Restore backup brings data back
- [ ] Share summary and Share this app work
- [ ] Privacy policy link opens in Safari
- [ ] Phone in light mode and dark mode both look right

Add Sarah or hunting buddies as TestFlight testers (App Store Connect › TestFlight › Internal Testing) to get a few more phones on it.

## Step 6. Create the app in App Store Connect
https://appstoreconnect.apple.com › **Apps › +  › New App**: platform iOS, name **Flyway Journal**, language English (U.S.), the bundle ID from Step 1 (on Route A it appears after your first Xcode archive; on Route B register it first at developer.apple.com › Identifiers), SKU `flyway-journal-ios`.

Then fill everything in from `app-store/listing.md`:
- **App Information**: subtitle, categories, content rights, **Age Rating** questionnaire
- **Pricing and Availability**: Free, all countries. For the EU, declare that you're **not a trader** (a free app with no business behind it). If you'd rather skip that, untick the EU countries.
- **App Privacy**: privacy policy URL, then "Data Not Collected"
- **Version 1.0**: screenshots, promotional text, description, keywords, support URL, copyright, the build (pick the one from TestFlight), and the **App Review notes**
- Export compliance is already answered in the app ("uses no non-exempt encryption"), so Apple won't ask.

## Step 7. Submit
Click **Add for Review › Submit**. Review usually takes 1–3 days. If Apple sends questions, they show in App Store Connect › **App Review** (Resolution Center). Reply there.

## Step 8. After it's approved
1. Copy your App Store link (App Store Connect › App Information › "View on App Store", or `https://apps.apple.com/app/id<Apple ID>`).
2. Paste it into `appStoreUrl` at the top of `www/native.js` so the in-app **Share this app** QR code points to the App Store.
3. Release it as 1.0.1 (see "Updating" below).

---

## Updating the app later
1. Edit files in `www/`.
2. Raise the version: Xcode › App › General › **Version** (e.g. 1.0.1). The **Build** number must go up on every upload. Route B sets it automatically.
3. Route A: `npx cap sync ios`, then Product › Archive › Distribute. Route B: commit and run the workflow again.
4. Redeploy `www/` to Netlify so the website version matches.

## Don't change these after release
- The bundle ID.
- The app's local address (Capacitor's default `capacitor://localhost`). The journal database lives under that address, and changing it would make existing users' hunts disappear. The automatic backup in Files would restore them, but don't rely on it.

## What changed from the website version
- **Native GPS, haptics, share sheet and saving to Files** through Capacitor plugins. These give it real iPhone features, which helps with Apple's rule against apps that are "just a website" (guideline 4.2).
- **Automatic backup**: every change is mirrored into `Files › On My iPhone › Flyway › Flyway Autobackup`. If iOS ever clears the app's storage, or someone restores onto a new phone, the journal rebuilds itself from that folder on launch.
- **Fonts bundled** in `www/fonts/` (SIL Open Font License), so the app looks right with no signal. The website benefits too.
- **Street map in the iPhone app uses Esri tiles**. OpenStreetMap's free tile servers don't allow use inside published apps. The website keeps OpenStreetMap, and satellite is Esri in both.
- **Weather grid** is 2×2 on all phones, so wind and sky no longer cut off on larger iPhones.
- **Privacy policy link** added in Season › Your data.
- iPhone-only and portrait-only, so only iPhone screenshots are needed.

## Good to know
- **Map and weather terms.** Esri's basemaps and Open-Meteo's free API are both meant for non-commercial use. A free app with no ads fits. If you ever charge for the app or add ads, switch to their paid plans (or another provider) first.
- **Possible review pushback.** Apple sometimes rejects apps built on web code under guideline 4.2. If that happens, reply in the Resolution Center and point to the native features: GPS hunt tagging, haptic counters, the Files-app backup and offline use. That usually resolves it. Ask me if you want help drafting the reply.
