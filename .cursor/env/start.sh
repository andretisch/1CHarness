#!/usr/bin/env bash
set -euo pipefail

mkdir -p /tmp/cursor/start-user

{
  echo "start.sh: $(date -Is)"
  if compgen -G '/opt/1cv8t/x86_64/*/1cv8t' > /dev/null; then
    echo "1C training client: OK"
  else
    echo "1C training client: not installed"
  fi
  if test -f /workspace/index.html; then
    echo "1CHarness UI: index.html present"
  fi
} >> /tmp/cursor/start-user/start-user.log

exit 0
