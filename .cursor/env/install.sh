#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

sudo debconf-set-selections <<'EOF' || true
fuse fuse/conflict select keep_current
EOF

sudo apt-get update -qq
sudo apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" \
  locales \
  unzip \
  libwebkit2gtk-4.1-0 \
  libglu1-mesa \
  libunwind8 \
  libicu74 \
  fontconfig \
  libgsf-bin \
  fuse3 \
  xdg-desktop-portal \
  xdg-desktop-portal-gtk

if compgen -G '/opt/1cv8t/x86_64/*/1cv8t' > /dev/null; then
  echo "1C: training platform found under /opt/1cv8t"
else
  echo "NOTE: 1C platform is not installed on this VM." >&2
  echo "Install from releases.1c.ru or add ONEC_USERNAME/ONEC_PASSWORD for automated download." >&2
fi

echo "install.sh finished OK"
