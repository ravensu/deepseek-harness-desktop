#!/usr/bin/env bash
# Upload build artifacts to GitLab Generic Package Registry and create a Release.
set -euo pipefail

PACKAGE_NAME="${PACKAGE_NAME:-dsh-desktop}"
mkdir -p upload
rm -f links.raw

shopt -s nullglob
# 只上传安装包（不要 blockmap / latest*.yml）
for f in release/dsh-desktop-*.exe release/dsh-desktop-*.zip \
  release/dsh-desktop-*.dmg release/dsh-desktop-*.AppImage \
  release/dsh-desktop-*.deb; do
  [ -f "$f" ] || continue
  cp -v "$f" upload/
done

mapfile -t files < <(find upload -type f | sort)
if [ "${#files[@]}" -lt 1 ]; then
  echo "没有可发布的产物" >&2
  exit 1
fi

ASSET_ARGS=()
for f in "${files[@]}"; do
  name=$(basename "$f")
  echo "Uploading ${name}…"
  curl --fail --silent --show-error \
    --header "JOB-TOKEN: ${CI_JOB_TOKEN}" \
    --upload-file "$f" \
    "${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/generic/${PACKAGE_NAME}/${CI_COMMIT_TAG}/${name}"
  url="${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/generic/${PACKAGE_NAME}/${CI_COMMIT_TAG}/${name}"
  ASSET_ARGS+=(--assets-link "{\"name\":\"${name}\",\"url\":\"${url}\",\"link_type\":\"package\"}")
done

release-cli create \
  --name "DeepSeek Harness Desktop ${CI_COMMIT_TAG}" \
  --tag-name "${CI_COMMIT_TAG}" \
  --description "壳安装包。首次启动会从 npm 安装 Harness 核心（见 package.json → dshDesktop.seedDsh）。" \
  "${ASSET_ARGS[@]}"
