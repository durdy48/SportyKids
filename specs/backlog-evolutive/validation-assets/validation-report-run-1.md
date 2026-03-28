# Validation Report — Run 1

**Date**: 2026-03-27T17:32:43.111Z
**Summary**: 13 PASS / 0 FAIL / 0 SKIP

---

## Schema & Seed

✅ **Video sources catalog**: PASS — 21 sources, 8 sports

✅ **Seed reels still work**: PASS — 50 reels returned, total=70

## Video Aggregator

✅ **Manual sync**: PASS — processed=60, created=1, approved=1

✅ **New reels after sync**: PASS — 20 reels, youtube_embed found, all approved

✅ **Safety filter**: PASS — Only approved reels returned

## API Endpoints

✅ **Sources list**: PASS — 21 active sources

✅ **Add custom source**: PASS — Created id=cmn96ixet001z26vsr1g293nk

✅ **Delete custom source**: PASS — Deleted id=cmn96ixet001z26vsr1g293nk

## Ordering

✅ **publishedAt desc order**: PASS — 10 dated reels in correct order

## i18n

✅ **Translation keys present**: PASS — sources_title found in both es.json and en.json

## Tests

✅ **Full test suite**: PASS — 16 tests passing, 0 failures

## Code Quality

✅ **No Spanish in API routes**: PASS — Zero Spanish route paths found

✅ **No hardcoded Spanish in UI**: PASS — Zero inline locale ternaries in UI components

