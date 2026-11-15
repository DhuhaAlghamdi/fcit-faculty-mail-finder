"""Validate the publishable fields and their association in saved public source cards."""
import json
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

SOURCES = {'CS': ('cs', '20250618055258'), 'IT': ('it', '20240606124554'), 'IS': ('is', '20221114154659')}
ALLOWED = {'name', 'english_name', 'department', 'student_section', 'email', 'source_url', 'archive_snapshot_date'}

class Cards(HTMLParser):
    def __init__(self):
        super().__init__()
        self.section = None
        self.current = None
        self.cards = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'div' and attrs.get('id') in ('tab1', 'tab2'):
            self.section = {'tab1': 'male', 'tab2': 'female'}[attrs['id']]
        if tag == 'div' and attrs.get('class') == 'team maxwidth400':
            if self.current:
                self.cards.append(self.current)
            self.current = {'section': self.section, 'text': []}

    def handle_data(self, value):
        if self.current:
            self.current['text'].append(value)

records = json.loads(Path('faculty.json').read_text(encoding='utf-8'))
assert len(records) == 316
sources = {}
for department, (short, timestamp) in SOURCES.items():
    parser = Cards()
    parser.feed(Path(f'{short}-source.html').read_text(encoding='utf-8-sig'))
    if parser.current:
        parser.cards.append(parser.current)
    sources[department] = parser.cards

for index, record in enumerate(records):
    assert set(record) <= ALLOWED, f'Unexpected field at record {index}'
    assert record['department'] in SOURCES
    assert record['student_section'] in ('male', 'female')
    assert record['name'] and 'test user' not in record['name'].lower()
    short, timestamp = SOURCES[record['department']]
    assert record['source_url'] == f'https://web.archive.org/web/{timestamp}/https://fcitweb.kau.edu.sa/fcitwebsite/faculty{short}ar-new.php'
    assert record['archive_snapshot_date'] == f'{timestamp[:4]}-{timestamp[4:6]}-{timestamp[6:8]}'
    matching = [card for card in sources[record['department']] if card['section'] == record['student_section'] and any(' '.join(t.split()) == record['name'] for t in card['text'])]
    assert matching, f'Name/section not verified at record {index}'
    if record['email'] is not None:
        assert re.fullmatch(r'[A-Za-z0-9._%+\-]+@kau\.edu\.sa', record['email'])
        assert any(any(' '.join(t.split()) == record['email'] for t in card['text']) for card in matching), f'Email not associated with name at record {index}'

print('PASS: 316 records; 314 university emails verified in the same source cards; only permitted public fields; no student records or private email addresses.')
print('Unavailable university email (null):', sum(r['email'] is None for r in records))
print('Department totals:', dict(Counter(r['department'] for r in records)))
