# Beta Testing Guide — Phase 5

## Overview

This guide describes the 3-week beta testing protocol for SportyKids with 2 confirmed families. The goal is to validate the full end-to-end experience (onboarding, daily use, parental controls) before store submission.

**Target:** 2 confirmed families (expandable to 5-10 if needed)

**Ideal tester profile:**
- At least 1 family with a child aged 6-8
- At least 1 family with a child aged 9-14
- Mix of sports interests (not just football)
- At least 1 family willing to test in English (i18n validation)

---

## Week 1 — Setup & First Impressions (Days 1-7)

| Day | Child Tasks | Parent Tasks |
|-----|-------------|--------------|
| 1 | Install app, complete onboarding | Install app, observe child's onboarding |
| 1 | Explore the home feed freely (15 min) | Set up parental PIN and configure restrictions |
| 2-7 | Use app daily for 10-15 min | Note any confusing UX or content concerns |

### Parent checklist (Week 1)

- [ ] App installed successfully on child's device
- [ ] Onboarding completed (name, age, sports, team)
- [ ] Parental PIN created
- [ ] Time limits configured (if desired)
- [ ] Schedule lock configured (if desired)
- [ ] Child can browse news, watch reels, take quiz

---

## Week 2 — Daily Use & Engagement (Days 8-14)

| Activity | Frequency | Who |
|----------|-----------|-----|
| Read 3+ news articles | Daily | Child |
| Complete the daily quiz | Daily | Child |
| Watch 2+ reels | Daily | Child |
| Check collection/stickers | 2-3 times/week | Child |
| Review activity in Parents tab | 2 times/week | Parent |
| Note any content concerns | Ongoing | Parent |
| Report inappropriate content (if seen) | As needed | Child (with parent) |

---

## Week 3 — Feedback Collection (Days 15-21)

### Parent questionnaire

1. How easy was it to set up parental controls? (1-5)
2. Did you feel comfortable with the content your child saw? (1-5)
3. What was the most confusing part of the setup? (open)
4. Was anything missing that you needed as a parent? (open)
5. How likely are you to recommend SportyKids to another parent? (NPS 0-10)
6. How would you rate the app overall? (1-5)
7. Did you experience any crashes or errors? (yes/no + details)
8. Any other comments? (open)

### Child questionnaire (filled with parent present)

1. What did you like the most? (options: news / quiz / reels / stickers / my team)
2. Was anything confusing or hard to understand? (open)
3. Would you use SportyKids every day? (yes / no / sometimes)
4. What sport content would you like to see more of? (open)
5. Was the app fun? (emoji scale: very fun / fun / ok / boring)

### Optional

30-minute video call with each family for qualitative feedback.

---

## Go/No-Go Criteria

Before proceeding to store submission, ALL criteria must be met:

| Criterion | Threshold | Measurement |
|-----------|-----------|-------------|
| Parent NPS | >= 7/10 average | Questionnaire Q5 |
| Parent satisfaction (controls) | >= 4/5 average | Questionnaire Q1 |
| Content safety confidence | >= 4/5 average | Questionnaire Q2 |
| Critical crashes | 0 | Sentry dashboard |
| Non-critical bugs | <= 3 open (none blocking) | Manual tracking |
| Inappropriate content reports | 0 unresolved after 24h | ContentReport table |
| E2E tests | 100% passing | CI pipeline (24 Playwright tests) |
| Store blockers | 0 open | Manual checklist |
| Beta duration | >= 14 days of active use | Activity logs |

**If criteria are NOT met:**
1. Identify the gaps (which criteria failed)
2. Create fix tasks with priority P0
3. Deploy fixes to staging
4. Extend beta by 1 week
5. Re-evaluate criteria

---

## Monitoring During Beta

### Sentry Crash Monitoring

- **Alert threshold:** Any unhandled exception triggers a Sentry alert
- **Review cadence:** Daily check of Sentry dashboard for first 7 days, then every 2 days
- **Critical crash definition:** Any crash that closes the app (unhandled native exception or JS fatal)
- **Response SLA:** Critical crashes investigated within 24 hours, fix shipped within 48 hours

### PostHog Analytics (if consent given)

- Track DAU/WAU (daily/weekly active users)
- Track feature usage: news reads, quiz completions, reel views, sticker collections
- Track onboarding completion rate
- Track retention D1, D7

### Content Report Review

- Check `ContentReport` table daily during beta via API: `GET /api/reports/parent/:userId`
- Any reported content reviewed and actioned within 24 hours
- Track moderation false positives (content that passed AI moderation but was reported by users)

---

## Distribution Setup

### TestFlight (iOS)

```bash
# Build iOS preview for TestFlight
cd apps/mobile
eas build --profile preview --platform ios

# After build completes, build production for TestFlight submission
eas build --profile production --platform ios
eas submit --platform ios --profile production
```

Invite testers:
1. In App Store Connect > TestFlight > Internal Testing, create group "Beta Families"
2. Add tester emails (max 100 internal testers)
3. Testers receive email invite, install via TestFlight app

### Google Play Internal Testing (Android)

```bash
# Build Android production AAB
cd apps/mobile
eas build --profile production --platform android

# Submit to internal testing track
eas submit --platform android --profile production
```

Invite testers:
1. In Google Play Console > Testing > Internal testing, create email list
2. Add tester Gmail addresses
3. Share the opt-in URL with testers
4. Testers install from Play Store (marked as internal test)
