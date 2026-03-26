#!/bin/bash
set -e
cd /Users/antonioduarteruiz/personal/sportykids
echo "=== SportyKids Sprint 1-2 Validation ==="
echo ""
node specs/product-owner-proposals/validation/validate.mjs
echo ""
echo "Report: specs/product-owner-proposals/validation-assets/validation-report-run-1.md"
