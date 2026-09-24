from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
for path in [ROOT/'PTU_Companion_Windows_Source/static-preview/app.js',ROOT/'PTU_Companion_Android_Tauri/www/app.js']:
    text=path.read_text(encoding='utf-8')
    desired="${k==='move_keywords'?MOVE_KEYWORD_CATALOG.length:(counts[k]??'—')}"
    if desired in text:
        print(f'Library Move Keyword count already prepared in {path.relative_to(ROOT)}')
        continue
    anchor="${counts[k]??'—'}"
    if text.count(anchor)!=1:
        raise RuntimeError(f'Expected one Library count anchor in {path}, found {text.count(anchor)}')
    path.write_text(text.replace(anchor,desired,1),encoding='utf-8')
    print(f'Prepared Library Move Keyword count in {path.relative_to(ROOT)}')
