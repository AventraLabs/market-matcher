#!/usr/bin/env bash
# Generates short vertical (9:16) MP4 placeholder pitch videos for the demo
# dataset (see src/db/seed-demo.ts). No real brand assets, no network access
# needed — just ffmpeg drawing brand name + tagline + a colored background.
#
# Each clip is intentionally tiny (540x960, ~15s, no audio, CRF 30) so ~30 of
# them add only a few MB to the repo as static files under public/demo/videos/.
# They're referenced directly by URL (/demo/videos/<slug>.mp4) — this bypasses
# src/lib/storage.ts entirely, since these are bundled demo assets, not user
# uploads, and Next.js serves anything under public/ as a static file on
# Vercel with zero extra config (no Supabase Storage credentials needed).
set -euo pipefail

OUT_DIR="$(dirname "$0")/../public/demo/videos"
mkdir -p "$OUT_DIR"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# slug|hexbg|hexbg2|BRAND NAME|tagline
CLIPS=(
  "kolaris|0x8B0000|0xB22222|KOLARIS|Der Geschmack, der bleibt."
  "pikola|0x00008B|0x1E3A8A|PIKOLA|Frisch. Anders. Deins."
  "velocia|0x1a1a1a|0x333333|VELOCIA|Beweg dich schneller."
  "sprintex|0xFF6600|0xFF8C00|SPRINTEX|Klein, aber schnell."
  "brewhaus|0x3E2723|0x5D4037|BREWHAUS|Seit Generationen stark."
  "kornerkaffee|0x6D4C41|0x8D6E63|KORNER KAFFEE|Dein Kiez. Dein Kaffee."
  "nordwear|0x263238|0x455A64|NORDWEAR|Gebaut für jedes Wetter."
  "stitchlab|0xAD1457|0xD81B60|STITCHLAB|Mode ohne Kompromisse."
  "luxora|0x4A148C|0x6A1B9A|LUXORA|Schönheit neu gedacht."
  "glowbotanic|0x2E7D32|0x43A047|GLOW BOTANIC|Natürlich sichtbar besser."
  "nexucore|0x0D47A1|0x1565C0|NEXUCORE|Technologie, die denkt."
  "byteforge|0x212121|0x424242|BYTEFORGE|Von Nerds für Nerds."
  "autovanta|0xB71C1C|0xC62828|AUTOVANTA|Kontrolle. Kraft. Klasse."
  "voltrix|0x004D40|0x00695C|VOLTRIX|Die Zukunft fährt leise."
  "pixelrealm|0x4527A0|0x5E35B1|PIXELREALM|Spiel auf einem neuen Level."
  "questforge|0xF57F17|0xF9A825|QUESTFORGE|Kleines Studio, großer Move."
)

for entry in "${CLIPS[@]}"; do
  IFS='|' read -r slug bg1 bg2 name tagline <<< "$entry"
  out="$OUT_DIR/${slug}.mp4"
  ffmpeg -y -loglevel error \
    -f lavfi -i "gradients=s=540x960:c0=${bg1}:c1=${bg2}:x0=0:y0=0:x1=540:y1=960:d=15" \
    -vf "drawtext=fontfile=${FONT}:text='${name}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2-40:box=0,drawtext=fontfile=${FONT}:text='${tagline}':fontcolor=white@0.85:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2+50" \
    -t 15 -r 24 -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 30 -an \
    "$out"
  echo "generated $out ($(du -h "$out" | cut -f1))"
done
