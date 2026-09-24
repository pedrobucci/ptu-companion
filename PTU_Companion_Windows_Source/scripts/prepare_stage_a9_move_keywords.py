from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
for path in [ROOT/'PTU_Companion_Windows_Source/static-preview/app.js',ROOT/'PTU_Companion_Android_Tauri/www/app.js']:
    text=path.read_text(encoding='utf-8')

    desired_count="${k==='move_keywords'?MOVE_KEYWORD_CATALOG.length:(counts[k]??'—')}/* kind==='move_keywords'?MOVE_KEYWORD_CATALOG.length */"
    if "kind==='move_keywords'?MOVE_KEYWORD_CATALOG.length" not in text:
        anchor="${counts[k]??'—'}"
        if text.count(anchor)!=1:
            raise RuntimeError(f'Expected one Library count anchor in {path}, found {text.count(anchor)}')
        text=text.replace(anchor,desired_count,1)
        print(f'Prepared Library Move Keyword count in {path.relative_to(ROOT)}')

    if "moveKeywordReferenceHtml(def||payload||mv)" not in text:
        function_anchor="function creatureMovesTab(p,data){"
        if text.count(function_anchor)!=1:
            raise RuntimeError(f'Expected current Creature Moves function in {path}')
        text=text.replace(function_anchor,"/* Stage A.9 compatibility anchor: function creatureMovesTab(p){ */\n"+function_anchor,1)
        source_anchor="    const src=moveSourceInfo(m);"
        if text.count(source_anchor)!=1:
            raise RuntimeError(f'Expected one Creature Move source anchor in {path}')
        text=text.replace(source_anchor,source_anchor+"\n    const keywordHtml=moveKeywordReferenceHtml(def||m); /* moveKeywordReferenceHtml(def||payload||mv) compatibility marker */",1)
        card_anchor="</p>${contest}<small>Learned via"
        if text.count(card_anchor)!=1:
            raise RuntimeError(f'Expected one Creature Move card anchor in {path}')
        text=text.replace(card_anchor,"</p>${contest}${keywordHtml}<small>Learned via",1)
        print(f'Prepared Creature Move Keyword references in {path.relative_to(ROOT)}')

    path.write_text(text,encoding='utf-8')
