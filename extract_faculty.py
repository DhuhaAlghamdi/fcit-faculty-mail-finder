"""Extract only name/email pairs displayed inside the same archived faculty card."""
import re
import json
import html
from pathlib import Path
from fetch_sources import PAGES

def text(value):
    return ' '.join(html.unescape(re.sub('<[^>]+>', ' ', value)).split())

records = []
for department, timestamp, short in PAGES:
    source = Path(f'{short}-source.html').read_text(encoding='utf-8-sig')
    section_start = re.search(r'<div[^>]+id="tab1"', source).start()
    female_start = re.search(r'<div[^>]+id="tab2"', source).start()
    cards = list(re.finditer(r'<div class="team maxwidth400">', source))
    for index, marker in enumerate(cards):
        assert marker.start() > section_start
        section = 'female' if marker.start() > female_start else 'male'
        card = source[marker.end():cards[index + 1].start() if index + 1 < len(cards) else len(source)]
        # The card ends at its details link; never inspect a following card or footer.
        card = card.split('تفاصيل</a>')[0]
        headings = re.findall(r'<h4\b[^>]*>(.*?)</h4>', card, re.S)
        assert headings, department
        name = text(headings[0])
        if name == 'Test User Amr':
            continue  # Explicit test account in the archive, not a faculty member.
        envelope = re.search(r'<p>\s*<i class="fa fa-envelope"></i>(.*?)</p>', card, re.S)
        raw_email = text(envelope[1]) if envelope else ''
        email = raw_email if re.fullmatch(r'[A-Za-z0-9._%+\-]+@kau\.edu\.sa', raw_email, re.I) else None
        if raw_email and not email:
            print('Unavailable or malformed email:', department, ascii(name), ascii(raw_email))
        record = dict(name=name, department=department, student_section=section, email=email,
                      source_url=f'https://web.archive.org/web/{timestamp}/https://fcitweb.kau.edu.sa/fcitwebsite/faculty{short}ar-new.php',
                      archive_snapshot_date=f'{timestamp[:4]}-{timestamp[4:6]}-{timestamp[6:8]}')
        if re.search('[A-Za-z]', name):
            record['english_name'] = name
        records.append(record)
    print(department, sum(r['department'] == department for r in records), 'records')
Path('faculty.json').write_text(json.dumps(records, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Total:', len(records), 'Missing email:', sum(r['email'] is None for r in records))
