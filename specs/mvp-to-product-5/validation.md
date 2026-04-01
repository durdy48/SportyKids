# Phase 5 Validation Checklist

## Infrastructure
- [ ] `fly.staging.toml` exists and is valid TOML
- [ ] `scripts/setup-staging.sh` exists and is executable
- [ ] Staging app deployed: `curl -s https://sportykids-api-staging.fly.dev/api/health | jq .status` returns "ok"
- [ ] Staging DB is seeded (news, reels, quiz questions, stickers exist)
- [ ] Staging is isolated from production (different DATABASE_URL)

## Build Configuration
- [ ] `apps/mobile/app.json` version is "1.0.0"
- [ ] `apps/mobile/app.json` has ios.buildNumber "1"
- [ ] `apps/mobile/app.json` has android.versionCode 1
- [ ] `apps/mobile/app.json` has ITSAppUsesNonExemptEncryption false
- [ ] `apps/mobile/eas.json` preview points to staging URL
- [ ] `apps/mobile/eas.json` submit section has documented placeholders
- [ ] `google-service-account.json` is in `.gitignore`

## Store Metadata
- [ ] `store-metadata/es.json` has all required fields (name, subtitle, description, keywords, supportUrl, privacyPolicyUrl, shortDescription, whatsNew)
- [ ] `store-metadata/en.json` has all required fields
- [ ] `shortDescription` is <= 80 characters in both locales
- [ ] Screenshots generated for iOS (5 images at 1179x2556)
- [ ] Screenshots generated for Android (5 images at 1080x2400)
- [ ] `scripts/generate-screenshots.mjs` exists and runs without error

## Beta Distribution
- [ ] iOS preview build completes: `eas build --profile preview --platform ios`
- [ ] Android preview build completes: `eas build --profile preview --platform android`
- [ ] TestFlight group created and testers invited
- [ ] Google Play Internal Testing list created and testers invited
- [ ] Both families can install and open the app

## Beta Testing
- [ ] All families completed Week 1 (setup + first impressions)
- [ ] All families completed Week 2 (daily use)
- [ ] All families completed Week 3 (feedback questionnaire)
- [ ] Parent NPS >= 7/10 average
- [ ] Parent controls satisfaction >= 4/5
- [ ] 0 critical crashes in Sentry
- [ ] 0 unresolved content reports after 24h

## Store Submission
- [ ] Apple Developer account active
- [ ] Google Play Console account active
- [ ] `eas.json` updated with real Apple IDs (appleId, ascAppId, appleTeamId)
- [ ] `google-service-account.json` configured and tested
- [ ] iOS production build + submit successful
- [ ] Android production build + submit successful
- [ ] App Store Connect metadata complete (description, screenshots, privacy labels, age rating)
- [ ] Google Play Console metadata complete (listing, data safety, IARC, families policy)

## Post-Submission
- [ ] Apple review passed (or rejection addressed and re-submitted)
- [ ] Google review passed (or rejection addressed and re-submitted)
- [ ] Android staged rollout: 10% deployed
- [ ] Android staged rollout: 50% deployed
- [ ] Android staged rollout: 100% deployed
- [ ] Sentry crash-free rate >= 99% for first 48 hours
- [ ] No critical 1-star reviews

## Documentation
- [ ] `specs/mvp-to-product-5/review-notes.md` created
- [ ] `specs/mvp-to-product-5/beta-guide.md` created
- [ ] `specs/mvp-to-product-5/validation.md` created
- [ ] `docs/en/` and `docs/es/` updated with Phase 5 status
