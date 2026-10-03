#!/bin/sh
# Run the site's tests under JavaScriptCore, which ships with macOS.
# Exits non-zero on any failure, so it can go in a pre-commit hook.
#
#   tests/run_tests.sh

set -e
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
[ -x "$JSC" ] || { echo "JavaScriptCore not found at $JSC" >&2; exit 1; }

OUT=$("$JSC" data/profile_options.js data/questions.js data/rules.js quick_engine.js \
  data/policy_questions.js policy_engine.js data/pulse_questions.js pulse_engine.js data/profile_effects.js profile_engine.js \
  data/tool_questions.js data/tool_rules.js tool_engine.js data/risk_matrix.js risk_engine.js data/done_when.js answers_engine.js data/record.js record_engine.js \
  ui_common.js progress_bar.js data/storage_keys.js privacy_engine.js \
  tests/quick_rules_test.js tests/quick_policy_test.js tests/quick_pulse_test.js tests/profile_test.js tests/tool_check_test.js tests/risk_test.js tests/answers_test.js tests/record_test.js tests/fake_page.js tests/privacy_test.js tests/industry_test.js tests/print_report.js)
echo "$OUT"
echo "$OUT" | grep -q '^FAIL' && exit 1
exit 0
