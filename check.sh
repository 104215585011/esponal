#!/bin/bash
cd /c/e || exit 1
./node_modules/.bin/tsc --noEmit 2>&1 | head -10
echo "tsc_exit=$?"
npx expo export --platform android --output-dir .metro-check 2>&1 | tail -4
rm -rf .metro-check
