from pathlib import Path

path=Path(__file__).with_name('apply_stage_b_forms_foundation.py')
text=path.read_text(encoding='utf-8')
old="after=replace_once(after,old,new,path)"
new="""if old not in after:
            raise RuntimeError(f'Could not find endpoint-local species anchor in {path}: {old[:120]!r}')
        after=after.replace(old,new,1)"""
count=text.count(old)
if count:
    text=text.replace(old,new)
    path.write_text(text,encoding='utf-8')
    print(f'Updated Stage B patcher endpoint replacements ({count})')
else:
    print('Stage B patcher endpoint replacements already current')
