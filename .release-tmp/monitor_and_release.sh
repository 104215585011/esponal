#!/bin/bash
# 监控 esponal APK 构建并在成功后发布 mobile-v0.6.0 Release
set -u
REPO="104215585011/esponal"
RUN_ID="43496744151"
TAG="mobile-v0.6.0"
WORK="/c/e/.release-tmp"
mkdir -p "$WORK"

TOKEN=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill 2>/dev/null | grep '^password=' | cut -d= -f2-)
if [ -z "$TOKEN" ]; then echo "FATAL: no github token"; exit 1; fi

auth=(-H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json")

# 1. 轮询构建状态,最多 50 分钟
for i in $(seq 1 50); do
  STATUS=$(curl -s "${auth[@]}" "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID" | python -c "import json,sys; d=json.load(sys.stdin); print(d.get('status'), d.get('conclusion'))" 2>/dev/null)
  echo "[$i] $STATUS"
  if [[ "$STATUS" == *"completed"* ]]; then
    break
  fi
  sleep 60
done

if [[ "$STATUS" != *"completed success"* ]]; then
  echo "FATAL: build did not succeed: $STATUS"
  exit 1
fi

# 2. 找到 artifact
ART=$(curl -s "${auth[@]}" "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID/artifacts" | python -c "
import json,sys
d=json.load(sys.stdin)
items=[a for a in d.get('artifacts',[]) if a['name']=='esponal-apk']
print(items[0]['archive_download_url'] if items else '')
")
if [ -z "$ART" ]; then echo "FATAL: artifact not found"; exit 1; fi

# 3. 下载并解出 APK
curl -sL "${auth[@]}" -o "$WORK/apk.zip" "$ART"
cd "$WORK" && unzip -o apk.zip -d apk_out >/dev/null
APKFILE=$(ls apk_out/*.apk 2>/dev/null | head -1)
if [ -z "$APKFILE" ]; then echo "FATAL: no apk in artifact"; exit 1; fi
APKNAME="esponal-v0.6.0.apk"
cp "$APKFILE" "$WORK/$APKNAME"
ls -lh "$WORK/$APKNAME"

# 4. 创建 Release(已存在则复用)
REL_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "${auth[@]}" "https://api.github.com/repos/$REPO/releases/tags/$TAG")
if [ "$REL_CHECK" != "200" ]; then
  curl -s "${auth[@]}" -X POST "https://api.github.com/repos/$REPO/releases" \
    -d "{\"tag_name\":\"$TAG\",\"target_commitish\":\"mobile\",\"name\":\"v0.6.0\",\"body\":\"## v0.6.0\\n\\n- 播放页:新增进度条,可拖动控制播放位置;时长探测;拖动时字幕跟随暂停\\n- 点词查词:修复查询内容不显示的问题,补齐词法讲解/用法/相关词组/变位等字段,无释义时空态提示\\n- 错误提示:接口错误不再显示 [object Object]\\n- 服务端:查词接口改双通道鉴权,已收藏状态与限流按用户生效\"}" > /dev/null
  sleep 3
fi

# 5. 上传 APK 资产
UPLOAD_URL=$(curl -s "${auth[@]}" "https://api.github.com/repos/$REPO/releases/tags/$TAG" | python -c "import json,sys; print(json.load(sys.stdin).get('upload_url','').split('{')[0])")
if [ -z "$UPLOAD_URL" ]; then echo "FATAL: no upload url"; exit 1; fi

ASSET_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "${auth[@]}" "https://api.github.com/repos/$REPO/releases/tags/$TAG")
EXISTING=$(curl -s "${auth[@]}" "https://api.github.com/repos/$REPO/releases/tags/$TAG" | python -c "
import json,sys
d=json.load(sys.stdin)
names=[a['name'] for a in d.get('assets',[])]
print(names[0] if names else '')
")
if [ -n "$EXISTING" ]; then
  REL_ID=$(curl -s "${auth[@]}" "https://api.github.com/repos/$REPO/releases/tags/$TAG" | python -c "import json,sys; print(json.load(sys.stdin)['id'])")
  ASSET_ID=$(curl -s "${auth[@]}" "https://api.github.com/repos/$REPO/releases/tags/$TAG" | python -c "
import json,sys
d=json.load(sys.stdin)
print([a['id'] for a in d.get('assets',[]) if a['name']=='$APKNAME'][0])
" 2>/dev/null)
  [ -n "$ASSET_ID" ] && curl -s "${auth[@]}" -X DELETE "https://api.github.com/repos/$REPO/releases/assets/$ASSET_ID" > /dev/null
fi

curl -s "${auth[@]}" -X POST --data-binary @"$WORK/$APKNAME" \
  -H "Content-Type: application/vnd.android.package-archive" \
  "$UPLOAD_URL?name=$APKNAME" | python -c "
import json,sys
d=json.load(sys.stdin)
print('ASSET:', d.get('name'), d.get('browser_download_url', d.get('errors','?')))
"

echo "RELEASE_DONE"
