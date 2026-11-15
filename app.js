const departments = {CS: 'علوم الحاسب', IT: 'تقنية المعلومات', IS: 'نظم المعلومات'};
const sections = {male: 'طلاب', female: 'طالبات'};
function normalize(value) {
  return String(value).toLowerCase().normalize('NFKD')
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0300-\u036fـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/\b(?:dr|prof)\b\s*\.?\s*/gi, ' ')
    .replace(/(^|\s)(?:ا\s*\.\s*د\s*\.?|د\s*\.|ا\s*\.)\s*/g, '$1')
    .replace(/\s+/g, ' ').trim();
}
function matches(record, query, department = '', section = '') {
  const parts = normalize(query).split(' ').filter(Boolean);
  const matchesName = name => {
    const normalized = normalize(name);
    let cursor = 0;
    return parts.every(part => {
      const position = normalized.indexOf(part, cursor);
      if (position === -1) return false;
      cursor = position + part.length;
      return true;
    });
  };
  return (!department || record.department === department) &&
    (!section || record.student_section === section) &&
    [record.name, record.english_name].filter(Boolean).some(matchesName);
}
let faculty = [], selected = '', selectedSection = '', toastTimer;
const search = document.querySelector('#search');
const results = document.querySelector('#results');
const status = document.querySelector('#status');
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
async function copyEmail(email, button) {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(email);
    else {
      const field = element('textarea'); field.value = email; field.dir = 'ltr';
      field.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.append(field); field.select();
      let success;
      try { success = document.execCommand('copy'); } finally { field.remove(); button.focus(); }
      if (!success) throw new Error('Copy failed');
    }
    const toast = document.querySelector('#toast');
    toast.textContent = 'تم نسخ البريد'; toast.classList.add('visible');
    button.textContent = 'تم النسخ';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
    setTimeout(() => { button.textContent = 'نسخ'; }, 2500);
  } catch { status.textContent = 'تعذّر نسخ البريد. يمكن تحديد البريد ونسخه يدويًا.'; }
}
function render() {
  const active = Boolean(search.value.trim() || selected || selectedSection);
  document.querySelector('.directory').hidden = !active;
  if (!active) { results.replaceChildren(); status.textContent = ''; document.querySelector('#count').textContent = '0'; return; }
  const filtered = faculty.filter(record => matches(record, search.value, selected, selectedSection));
  document.querySelector('#count').textContent = filtered.length;
  status.textContent = filtered.length ? '' : 'لا توجد نتائج مطابقة';
  status.className = filtered.length ? '' : 'empty';
  const fragment = document.createDocumentFragment();
  for (const record of filtered) {
    const card = element('article', 'card');
    const top = element('div', 'card-top');
    const badge = element('span', `badge ${record.department}`);
    const code = element('b', '', record.department); code.dir = 'ltr';
    badge.append(element('span', '', departments[record.department]), code);
    top.append(element('span', 'avatar', record.name.split(' ').slice(0, 2).map(n => n[0]).join(' ')), badge);
    card.append(top, element('h3', '', record.name), element('p', 'department', `القسم الدراسي: ${sections[record.student_section]}`));
    if (record.english_name && record.english_name !== record.name) { const english = element('p', 'department', record.english_name); english.dir = 'ltr'; card.append(english); }
    const row = element('div', 'email-row');
    if (record.email) {
      const link = element('a', '', record.email); link.href = `mailto:${record.email}`; link.dir = 'ltr';
      const copy = element('button', 'copy', 'نسخ'); copy.type = 'button';
      copy.setAttribute('aria-label', `نسخ بريد ${record.name}`);
      copy.addEventListener('click', () => copyEmail(record.email, copy)); row.append(copy, link);
    } else row.append(element('span', 'missing', 'البريد الجامعي غير متاح في المصدر'));
    const source = element('div', 'source');
    const sourceLink = element('a', '', 'المصدر المؤرشف ↗'); sourceLink.href = record.source_url; sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer';
    const date = element('time', '', record.archive_snapshot_date); date.dateTime = record.archive_snapshot_date; date.dir = 'ltr';
    source.append(sourceLink, date); card.append(row, source); fragment.append(card);
  }
  results.replaceChildren(fragment);
}
search.addEventListener('input', render);
document.querySelectorAll('[data-department]').forEach(button => button.addEventListener('click', () => {
  selected = selected === button.dataset.department ? '' : button.dataset.department;
  document.querySelectorAll('[data-department]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.department === selected)));
  render();
}));
document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => {
  selectedSection = selectedSection === button.dataset.section ? '' : button.dataset.section;
  document.querySelectorAll('[data-section]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.section === selectedSection)));
  render();
}));
document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); search.focus(); } });
fetch('./faculty.json').then(response => { if (!response.ok) throw new Error(response.status); return response.json(); })
  .then(data => { faculty = data; search.disabled = false; document.querySelectorAll('.filters button').forEach(button => { button.disabled = false; }); document.querySelector('#load-status').textContent = ''; render(); })
  .catch(() => { document.querySelector('#load-status').textContent = 'تعذّر تحميل الدليل. يرجى تحديث الصفحة أو تشغيل الموقع عبر خادم محلي.'; });
