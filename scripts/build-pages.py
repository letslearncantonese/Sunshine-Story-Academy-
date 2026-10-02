"""Generate static navigation pages. Python standard library only."""
import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / 'catalog.json').read_text())
ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23fff4cc'/%3E%3Ccircle cx='32' cy='32' r='19' fill='%23ffbc32'/%3E%3Cpath d='M23 36q9 10 18 0' fill='none' stroke='%2377441b' stroke-width='3'/%3E%3Ccircle cx='25' cy='27' r='2'/%3E%3Ccircle cx='39' cy='27' r='2'/%3E%3C/svg%3E"

def page(title, body, prefix='', cls='picture-page'):
    return f'''<!doctype html>
<html lang="zh-HK"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{escape(title)}</title><meta name="description" content="陽光故事學園：一齊玩遊戲、郁身體、學數學！"><meta name="theme-color" content="#d4eff9"><link rel="icon" href="{ICON}"><link rel="stylesheet" href="{prefix}assets/site.css"></head><body class="{cls}">{body}</body></html>
'''

(ROOT / 'index.html').write_text(page(catalog['title'], '''<main class="picture"><h1 class="sr-only">陽光故事學園</h1><img src="assets/home.jpg" width="1536" height="864" alt="陽光故事學園：忍者數學冒險、科學探險號、成語彩虹王國"><a class="hotspot ninja-link" href="ninja-math/" aria-label="進入忍者數學冒險"><span class="sr-only">進入忍者數學冒險</span></a><a class="hotspot idiom-link" href="idiom-rainbow/" aria-label="進入成語彩虹王國"><span class="sr-only">進入成語彩虹王國</span></a></main>'''))
for world in catalog['worlds']:
    folder = ROOT / world['id']
    folder.mkdir(exist_ok=True)
    is_idiom = world['id'] == 'idiom-rainbow'
    hotspot_class = 'garden-link' if is_idiom else 'castle-link'
    chapter_links = ''.join(f'<a class="hotspot {hotspot_class}" href="{escape(c["id"])}/" aria-label="進入{escape(c["title"])}"><span class="sr-only">進入{escape(c["title"])}</span></a>' for c in world['chapters'])
    home = '<a class="book-home" href="../" aria-label="返回故事書首頁"><span aria-hidden="true">📖</span><span>首頁</span></a>' if is_idiom else '<a class="hotspot home-link" href="../" aria-label="返學園首頁"><span class="sr-only">返學園首頁</span></a>'
    map_class = 'picture idiom-map' if is_idiom else 'picture'
    body = f'<main class="{map_class}"><h1 class="sr-only">{escape(world["title"])}</h1><img src="../{escape(world["image"])}" alt="{escape(world["title"])}地圖">{chapter_links}{home}</main>'
    (folder / 'index.html').write_text(page(world['title'], body, '../'))
    for chapter in world['chapters']:
        dest = folder / chapter['id']
        dest.mkdir(exist_ok=True)
        cards = ''.join(f'<a class="game-card" href="../../{escape(g["path"])}" aria-label="{escape(g["title"])}"><img src="../../{escape(g["thumbnail"])}" alt="{escape(g["title"])}"></a>' for g in chapter['games'])
        body = f'<main class="selection"><header class="selection-header"><a class="back" href="../" aria-label="返{escape(world["title"])}地圖">← 返地圖</a><h1>{escape(chapter["title"])}</h1><a class="back selection-home" href="../../" aria-label="返回故事書首頁">📖 首頁</a></header><nav class="game-grid" aria-label="揀一關開始玩">{cards}</nav></main>'
        (dest / 'index.html').write_text(page(chapter['title'] + '｜' + world['title'], body, '../../', 'selection-page'))
print('Generated homepage, world map and chapter pages.')
