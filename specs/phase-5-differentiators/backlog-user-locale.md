# Backlog: User locale/country configuration

## Problem

Currently the app locale is stored in localStorage (`sportykids_locale`) and defaults to Spanish. There is no way for the user to configure their preferred language or country during onboarding or in settings. The content language depends entirely on the RSS sources selected, not on user preference.

## Proposed solution

### 1. Add locale/country to User model
- Add `locale String @default("es")` and `country String @default("ES")` to User in Prisma schema
- Set during onboarding (new step or integrated into step 1)
- Editable from user settings/profile

### 2. Onboarding integration
- Step 1: Add language selector (Spanish/English) alongside name and age
- The selected locale determines:
  - UI language (already works via i18n)
  - Default RSS sources pre-selection (prioritize sources matching user's language)
  - AI summary language preference
  - Quiz question language

### 3. Content filtering by language
- Filter news by source language matching user locale
- Or show all sources but prioritize matching language

### 4. Affected components
- `User` model (Prisma)
- `OnboardingWizard.tsx` (step 1)
- `UserProvider` / `user-context.tsx` (sync locale from server)
- `HomeFeedClient.tsx` (pass locale to API)
- Quiz generation (generate in user's locale)
- Summary generation (generate in user's locale)

## Priority

Medium — improves UX for multi-language users. Should be implemented before M6 (Smart Feed) for best results.
