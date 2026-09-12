/* Локальный интерфейс: учётные данные GitHub остаются на компьютере. */
'use strict';
const $ = selector => document.querySelector(selector);
const token = $('meta[name="manager-token"]').content;
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  left: '<path d="m15 5-7 7 7 7"/>', right: '<path d="m9 5 7 7-7 7"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  edit: '<path d="m16 3 5 5-13 13H3v-5L16 3Zm-3 3 5 5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  settings: '<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  restore: '<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7M12 7v5l3 2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.image}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = esc;
const countWord = (n, one, few, many) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many}`;
const frames = n => countWord(n, 'кадр', 'кадра', 'кадров');
const size = bytes => `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
let albums = [], status = {}, current = null, query = '', selected = new Set(), modal = null, dirty = false, uploading = false, locked = false, polling = false;
let deploymentChecked = 0, lastConnectionError = false;
const album = () => albums.find(a => a.name === current);
const cover = a => a.shots.find(s => s.name === a.cover) || a.shots[0];
const actionButton = (action, label, type = 'secondary-button', symbol = '', extra = '') => `<button type="button" class="${type}" data-action="${action}" ${extra}>${symbol ? icon(symbol) : ''}${esc(label)}</button>`;
async function api(route, data, options = {}) {
  const response = await fetch('/api/' + route, { method: data === undefined ? 'GET' : 'POST', headers: { 'X-Manager-Token': token, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }), ...options });
  let result;
  try { result = await response.json(); } catch { throw new Error('Менеджер перестал отвечать. Запустите его снова и обновите окно.'); }
  if (!response.ok) throw new Error(result.error || 'Операция не завершена.');
  return result;
}
function toast(message, error = false, restoreId = null) {
  const item = document.createElement('div'); item.className = `toast${error ? ' error' : ''}`;
  item.textContent = message;
  if (restoreId) { const button = document.createElement('button'); button.textContent = 'Вернуть'; button.dataset.action = 'restore'; button.dataset.id = restoreId; item.append(button); }
  $('#toasts').append(item); setTimeout(() => item.remove(), error ? 15000 : 6500);
}
async function refresh({ renderPage = true } = {}) {
  const result = await api('library'); albums = result.albums; status = result.status;
  if (current && !album()) current = null;
  renderNav(); renderStatus(); if (renderPage) renderMain();
}
function renderNav() {
  $('#total-count').textContent = albums.reduce((sum, a) => sum + a.shots.length, 0);
  $('.nav-overview[data-action="overview"]').classList.toggle('active', !current);
  $('#albums-nav').innerHTML = albums.map(a => `<button class="album-nav${a.name === current ? ' active' : ''}" data-action="album" data-album="${attr(a.name)}" ${a.name === current ? 'aria-current="page"' : ''}>${cover(a) ? `<img src="${attr(cover(a).image)}" alt="" loading="lazy">` : '<span class="nav-placeholder"></span>'}<span class="album-nav-text"><b>${esc(a.title)}</b><small>${esc(a.place)}</small></span><span class="nav-count">${String(a.shots.length).padStart(2, '0')}</span></button>`).join('');
}
function renderMain() {
  const a = album();
  $('#breadcrumb').textContent = a ? a.title.toUpperCase() : 'КОЛЛЕКЦИЯ';
  const error = status.error ? `<div class="error-box"><strong>Изменения сохранены. Публикация требует внимания.</strong>${esc(status.error)}</div>` : '';
  const foot = `<div class="page-note"><span>GAME GALLERY · CURATED BY OLEG</span><span>Миры, в которые хочется вернуться.</span></div><button class="quit-button" data-action="quit">Завершить работу студии</button>`;
  if (!a) {
    const total = albums.reduce((n, x) => n + x.shots.length, 0);
    $('#main').innerHTML = `${error}<section class="intro"><div><span class="eyebrow">ЛИЧНАЯ КОЛЛЕКЦИЯ</span><h1>Ваш взгляд.<br><em>Ваши миры.</em></h1><p>Сохраняйте моменты, ради которых стоит остановиться.</p><div class="collection-stats"><span><strong>${String(albums.length).padStart(2, '0')}</strong>альбомов</span><span><strong>${total}</strong>скриншотов</span></div></div>${actionButton('new-album', 'Новый альбом', 'primary-button', 'plus')}</section><div class="toolbar"><div class="toolbar-label"><h2>Все альбомы</h2><span class="count-badge">${albums.length}</span></div><span class="view-label">${icon('grid')} Ваша коллекция</span></div><div class="shot-grid">${albums.map(x => `<button class="album-card" data-action="album" data-album="${attr(x.name)}">${cover(x) ? `<img src="${attr(cover(x).image)}" alt="${attr(x.title)}" loading="lazy">` : '<div class="empty-cover"></div>'}<div class="album-card-body"><div><h2>${esc(x.title)}</h2><p>${esc(x.place)} &nbsp; · &nbsp; ${frames(x.shots.length)}</p></div>${icon('arrow')}</div></button>`).join('')}</div>${foot}`;
    return;
  }
  $('#main').innerHTML = `${error}<section class="album-hero">${cover(a) ? `<img src="${attr(cover(a).image)}" alt="">` : ''}<span class="hero-index">COLLECTION / ${String(albums.indexOf(a) + 1).padStart(2, '0')}</span><div class="hero-content"><span class="eyebrow">ВЫБРАННЫЙ АЛЬБОМ</span><h1>${esc(a.full)}</h1><p>${esc(a.place)} &nbsp; / &nbsp; ${a.year} &nbsp; / &nbsp; ${frames(a.shots.length)}</p></div><div class="hero-tools">${actionButton('metadata', 'Оформление', 'secondary-button', 'settings')}</div></section><div class="toolbar"><div class="toolbar-label"><h2>Скриншоты</h2><span class="count-badge">${a.shots.length}</span></div><div class="toolbar-right"><label class="search-box">${icon('search')}<input id="search" type="search" placeholder="Найти кадр…" aria-label="Поиск скриншотов" value="${attr(query)}"></label>${actionButton('upload', 'Добавить кадры', 'primary-button', 'plus')}</div></div><div id="upload-progress" class="upload-progress" hidden></div><div id="selection"></div><div id="shot-grid" class="shot-grid"></div>${foot}`;
  renderGrid();
}
function renderGrid() {
  const a = album(); if (!a || !$('#shot-grid')) return;
  $('#selection').innerHTML = selected.size ? `<div class="selection-bar"><span>Выбрано: ${selected.size}</span>${actionButton('select-all', 'Выбрать все', 'quiet-button')}${actionButton('clear-selection', 'Снять выбор', 'quiet-button')}${actionButton('delete-selected', 'Удалить', 'danger-button', 'trash')}</div>` : '';
  const shots = a.shots.filter(s => `${s.name} ${s.caption}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  $('#shot-grid').innerHTML = shots.map(s => `<article class="shot-card${selected.has(s.name) ? ' selected' : ''}"><label class="shot-select"><input type="checkbox" data-select="${attr(s.name)}" aria-label="Выбрать ${attr(s.name)}" ${selected.has(s.name) ? 'checked' : ''}></label><button class="shot-image" data-action="shot" data-name="${attr(s.name)}" aria-label="Открыть ${attr(s.name)}"><img src="${attr(s.image)}" alt="${attr(s.caption || s.name)}" loading="lazy"><span class="shot-shade"></span><span class="shot-number">${String(a.shots.indexOf(s) + 1).padStart(2, '0')}</span></button>${cover(a)?.name === s.name ? `<span class="cover-label">${icon('star')} ОБЛОЖКА</span>` : ''}<div class="shot-caption"><div class="caption-text"><p class="${s.caption ? '' : 'empty'}">${esc(s.caption || 'Добавить историю кадра…')}</p><small>${esc(s.name)}</small></div><div class="card-actions">${actionButton('shot', '', 'icon-button', 'edit', `data-name="${attr(s.name)}" aria-label="Редактировать подпись ${attr(s.name)}" title="Редактировать подпись"`)}${actionButton('delete-one', '', 'icon-button', 'trash', `data-name="${attr(s.name)}" aria-label="Удалить ${attr(s.name)}" title="В корзину"`)}</div></div></article>`).join('') + (!query ? `<button class="upload-tile" data-action="upload">${icon('upload')}<strong>Добавить новые кадры</strong><small>Перетащите сюда или выберите файлы</small><small>JPG, PNG, WebP · до 64 МБ</small></button>` : shots.length ? '' : '<div class="empty-state"><h2>Ничего не нашлось</h2><p>Попробуйте другое название или слово из подписи.</p></div>');
}
function renderStatus() {
  let title = 'Коллекция сохранена', detail = 'Готово к новым историям', indicator = '';
  const deploy = status.deployment;
  if (status.error) { title = 'Не удалось опубликовать'; detail = 'Кадры сохранены · нажмите «Повторить публикацию»'; indicator = 'error'; }
  else if (status.busy) { title = 'Публикую изменения…'; detail = 'Отправляю коллекцию на GitHub'; indicator = 'working'; }
  else if (status.pending?.length || status.outgoing) { title = status.autoPublish && !status.outgoing ? 'Изменения готовы к отправке' : 'Есть неопубликованные изменения'; detail = status.outgoing ? 'Предыдущую отправку можно продолжить' : status.autoPublish ? 'Автоматически отправлю через несколько секунд' : 'Нажмите «Опубликовать», когда будете готовы'; indicator = 'working'; }
  else if (status.lastPublished) {
    if (deploy?.status === 'completed' && deploy.conclusion === 'success') { title = 'Изменения на сайте'; detail = 'Последняя публикация успешно завершена'; }
    else if (deploy?.status === 'completed') { title = 'GitHub получил кадры, но сайт не обновился'; detail = 'Откройте отчёт сборки'; indicator = 'error'; }
    else if (deploy?.status === 'unknown') { title = 'Отправлено на GitHub'; detail = 'Статус сайта доступен в отчёте сборки'; }
    else { title = 'GitHub обновляет сайт…'; detail = 'Кадры отправлены · обычно это занимает 1–3 минуты'; indicator = 'working'; }
  }
  $('#status-title').textContent = title; $('#status-detail').textContent = detail;
  if (deploy?.url && !status.pending?.length && !status.error && !status.busy) {
    const link = document.createElement('a'); link.href = deploy.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = ' · отчёт'; $('#status-detail').append(link);
  }
  $('#status-indicator').className = 'status-indicator ' + indicator;
  $('#auto-publish').checked = !!status.autoPublish; $('#auto-publish').disabled = !!status.busy || uploading;
  const button = $('#publish-button');
  button.innerHTML = icon(status.busy ? 'upload' : status.error || status.outgoing ? 'restore' : 'upload') + (status.busy ? 'Публикую…' : status.error || status.outgoing ? 'Повторить публикацию' : 'Опубликовать');
  button.disabled = !!status.busy || uploading || locked || (!status.pending?.length && !status.outgoing);
}
function openModal(kind, content, data = {}) {
  modal = { kind, ...data }; dirty = false; $('#dialog-content').innerHTML = content;
  if (!$('#dialog').open) $('#dialog').showModal();
}
function closeModal(force = false) {
  if (locked) return false;
  if (dirty && !force && !window.confirm('Закрыть без сохранения изменений?')) return false;
  $('#dialog').close(); modal = null; dirty = false; return true;
}
function modalHead(title, eyebrow = 'GAME GALLERY STUDIO') {
  return `<div class="modal-header"><div><span class="eyebrow">${esc(eyebrow)}</span><h2 id="dialog-title">${esc(title)}</h2></div>${actionButton('close', '', 'icon-button', 'close', 'aria-label="Закрыть"')}</div>`;
}
function inputField(name, label, value, type = 'text', extra = '') { return `<label class="form-field"><span>${esc(label)}</span><input name="${name}" type="${type}" value="${attr(value)}" ${extra}></label>`; }
function newAlbum() {
  openModal('new', `<form id="new-form">${modalHead('Новый мир в коллекции')}<div class="modal-body">${inputField('name', 'Название игры', '', 'text', 'required maxlength="160" placeholder="Например, Red Dead Redemption 2"')}${inputField('place', 'Место действия', '', 'text', 'maxlength="200" placeholder="Например, The American Frontier"')}<p class="modal-help">После создания добавьте кадры. Пустой альбом на сайте не показывается.</p></div><div class="modal-footer"><p class="modal-help">Оформление можно изменить в любое время.</p><button class="primary-button" type="submit">${icon('plus')}Создать альбом</button></div></form>`);
  setTimeout(() => $('input[name="name"]').focus(), 20);
}
function editMetadata() {
  const a = album();
  openModal('metadata', `<form id="metadata-form">${modalHead('Оформление альбома', a.title)}<div class="modal-body"><div class="form-row">${inputField('title', 'Короткое название', a.title, 'text', 'required maxlength="160"')}${inputField('full', 'Полное название', a.full, 'text', 'required maxlength="200"')}</div>${inputField('place', 'Место действия', a.place, 'text', 'maxlength="200"')}<div class="form-row">${inputField('year', 'Год выхода игры', a.year, 'number', 'min="1970" max="2100" required')}${inputField('accent', 'Цвет акцента на сайте', a.accent, 'color')}</div><label class="form-field"><span>Обложка альбома</span><select name="cover"><option value="">Первый кадр по имени</option>${a.shots.map(s => `<option value="${attr(s.name)}" ${s.name === a.cover ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label><p class="modal-help">Обложка также открывает альбом первой в галерее.</p></div><div class="modal-footer"><p class="modal-help">Папка: ${esc(a.name)}</p><button class="primary-button" type="submit">${icon('check')}Сохранить оформление</button></div></form>`, { album: a.name, revision: a.metaRevision });
}
function editShot(name) {
  const a = album(), s = a.shots.find(x => x.name === name); if (!s) return;
  if (dirty && !window.confirm('Перейти к другому кадру без сохранения подписи?')) return;
  const index = a.shots.indexOf(s);
  openModal('shot', `<form id="caption-form"><div class="modal-header"><div><span class="eyebrow">${esc(a.title)}</span><h2 id="dialog-title">История одного кадра</h2></div><div class="editor-nav"><small>${index + 1} / ${a.shots.length}</small>${actionButton('previous-shot', '', 'icon-button', 'left', `aria-label="Предыдущий кадр" ${index === 0 ? 'disabled' : ''}`)}${actionButton('next-shot', '', 'icon-button', 'right', `aria-label="Следующий кадр" ${index === a.shots.length - 1 ? 'disabled' : ''}`)}${actionButton('close', '', 'icon-button', 'close', 'aria-label="Закрыть"')}</div></div><img class="editor-image" src="${attr(s.image)}&full=1" alt="${attr(s.caption || s.name)}"><div class="modal-body"><div class="editor-info"><span>${esc(s.name)}</span><span>${size(s.bytes)}</span></div><label class="form-field"><span>Подпись на сайте</span><textarea name="caption" maxlength="4000" placeholder="Одна фраза, которая сохранит настроение…">${esc(s.caption)}</textarea></label><p class="modal-help">Текст появится под кадром. Пустое поле убирает подпись.</p></div><div class="modal-footer">${actionButton('make-cover', cover(a)?.name === name ? 'Обложка альбома' : 'Сделать обложкой', 'secondary-button', 'star', cover(a)?.name === name ? 'disabled' : '')}<div class="buttons"><button class="primary-button" type="submit">${icon('check')}Сохранить подпись</button></div></div></form>`, { album: a.name, name, revision: s.revision });
}
function askDelete(names) {
  if (!names.length) return;
  openModal('delete', `${modalHead(names.length === 1 ? 'Убрать кадр из альбома?' : `Убрать ${frames(names.length)}?`)}<div class="modal-body"><p class="warning-text">Кадры исчезнут с сайта после публикации. Оригиналы и подписи останутся в корзине на этом компьютере — их можно вернуть.</p><p class="modal-help">${names.slice(0, 3).map(esc).join('<br>')}${names.length > 3 ? `<br>и ещё ${names.length - 3}` : ''}</p></div><div class="modal-footer"><div class="buttons">${actionButton('close', 'Оставить')}${actionButton('confirm-delete', 'Переместить в корзину', 'danger-button', 'trash')}</div></div>`, { album: current, names });
}
async function showTrash() {
  const items = await api('trash');
  openModal('trash', `${modalHead('Корзина', 'ОРИГИНАЛЫ СОХРАНЕНЫ НА КОМПЬЮТЕРЕ')}<div class="modal-body"><div class="trash-list">${items.length ? items.map(item => `<div class="trash-item"><div><b>${esc(item.album)} · ${frames(item.names.length)}</b><small>${new Date(item.date).toLocaleString('ru-RU')} · вместе с подписями</small></div>${actionButton('restore', 'Восстановить', 'secondary-button', 'restore', `data-id="${attr(item.id)}"`)}</div>`).join('') : '<div class="empty-state"><h2>Здесь пока пусто</h2><p>Удалённые кадры будут ждать здесь.</p></div>'}</div></div>`);
}
async function perform(task) {
  if (locked) return;
  locked = true; const controls = [...$('#dialog').querySelectorAll('button')];
  const disabled = controls.map(button => button.disabled); controls.forEach(button => { button.disabled = true; }); renderStatus();
  try { await task(); } catch (error) { toast(error.message, true); }
  finally { locked = false; controls.forEach((button, i) => { button.disabled = disabled[i]; }); renderStatus(); }
}
async function importFiles(files) {
  if (uploading || locked) return;
  if (!album()) { toast('Сначала откройте альбом, в который хотите добавить кадры.', true); return; }
  const list = [...files]; if (!list.length) return;
  const targetAlbum = current; const wasAuto = status.autoPublish;
  uploading = true; renderStatus(); let added = 0; const errors = [];
  try {
    // Вся пачка уходит одной публикацией, даже при медленном чтении больших файлов.
    await api('settings', { autoPublish: false }); status.autoPublish = false;
    for (let i = 0; i < list.length; i++) {
      const file = list[i], progress = $('#upload-progress');
      if (progress) { progress.hidden = false; progress.textContent = `Добавляю ${i + 1} из ${list.length} · ${file.name}`; }
      try {
        if (file.size > 64 * 1024 * 1024) throw new Error('файл больше 64 МБ');
        if (!/\.(jpe?g|png|webp)$/i.test(file.name)) throw new Error('нужен JPG, PNG или WebP');
        const response = await fetch(`/api/upload?album=${encodeURIComponent(targetAlbum)}&name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'X-Manager-Token': token, 'Content-Type': 'application/octet-stream' }, body: file });
        const result = await response.json(); if (!response.ok) throw new Error(result.error); added++;
      } catch (error) { errors.push(`${file.name}: ${error.message}`); }
    }
  } catch (error) { errors.push(error.message); }
  finally {
    try { await api('settings', { autoPublish: wasAuto }); } catch (error) { toast(`Автопубликация осталась выключенной: ${error.message}`, true); }
    uploading = false; $('#file-input').value = ''; await refresh();
  }
  if (added) toast(`Добавлено: ${frames(added)}. ${wasAuto ? 'Готовлю публикацию.' : 'Можно подписать и опубликовать.'}`);
  if (errors.length) toast(errors.join('\n'), true);
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled || locked) return;
  const action = button.dataset.action;
  try {
    if (uploading && !['shot', 'close'].includes(action)) return;
    if (action === 'album' || action === 'overview') {
      current = action === 'album' ? button.dataset.album : null; query = ''; selected.clear();
      window.localStorage.setItem('gallery-studio-album', current || ''); renderNav(); renderMain(); window.scrollTo({ top: 0 });
    } else if (action === 'new-album') newAlbum();
    else if (action === 'metadata') editMetadata();
    else if (action === 'upload') $('#file-input').click();
    else if (action === 'shot') editShot(button.dataset.name);
    else if (action === 'close') closeModal();
    else if (action === 'previous-shot' || action === 'next-shot') {
      const shots = album().shots, index = shots.findIndex(s => s.name === modal.name);
      if (shots[index + (action === 'next-shot' ? 1 : -1)]) editShot(shots[index + (action === 'next-shot' ? 1 : -1)].name);
    } else if (action === 'select-all') { selected = new Set(album().shots.filter(s => `${s.name} ${s.caption}`.toLowerCase().includes(query.toLowerCase())).map(s => s.name)); renderGrid(); }
    else if (action === 'clear-selection') { selected.clear(); renderGrid(); }
    else if (action === 'delete-one') askDelete([button.dataset.name]);
    else if (action === 'delete-selected') askDelete([...selected]);
    else if (action === 'confirm-delete') await perform(async () => { const result = await api('delete', { album: modal.album, names: modal.names }); selected.clear(); dirty = false; $('#dialog').close(); modal = null; await refresh(); toast('Кадры перемещены в корзину.', false, result.id); });
    else if (action === 'trash') await showTrash();
    else if (action === 'restore') await perform(async () => { await api('restore', { id: button.dataset.id }); await refresh(); if (modal?.kind === 'trash') await showTrash(); toast('Кадры и подписи восстановлены.'); });
    else if (action === 'make-cover') await perform(async () => {
      const a = album(), name = modal.name, caption = $('textarea[name="caption"]').value;
      await api('metadata', { title: a.title, full: a.full, place: a.place, year: a.year, accent: a.accent, album: a.name, revision: a.metaRevision, cover: name });
      await refresh(); dirty = false; editShot(name); $('textarea[name="caption"]').value = caption; dirty = caption !== a.shots.find(s => s.name === name).caption;
      toast('Обложка альбома обновлена.');
    });
    else if (action === 'publish') await perform(async () => { status.busy = true; renderStatus(); try { const result = await api('publish', {}); toast(result.unchanged ? 'Коллекция уже сохранена.' : 'Изменения отправлены. GitHub обновляет сайт.'); } finally { await refresh(); } });
    else if (action === 'quit') { await api('quit', {}); $('#main').innerHTML = '<div class="initial-loading"><h1>До следующего кадра.</h1><p>Студия закрыта. Эту вкладку можно закрыть.</p></div>'; clearInterval(pollTimer); $('.publication-bar').hidden = true; $('.sidebar').inert = true; }
  } catch (error) { toast(error.message, true); }
});
document.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target, values = Object.fromEntries(new FormData(form));
  perform(async () => {
    if (form.id === 'new-form') { const result = await api('albums', values); current = result.name; query = ''; selected.clear(); toast('Альбом создан. Добавьте первые кадры.'); }
    if (form.id === 'metadata-form') { await api('metadata', { ...values, album: modal.album, revision: modal.revision }); toast('Оформление сохранено.'); }
    if (form.id === 'caption-form') { await api('caption', { ...values, album: modal.album, name: modal.name, revision: modal.revision }); toast('Подпись сохранена.'); }
    dirty = false; $('#dialog').close(); modal = null; await refresh();
  });
});
document.addEventListener('input', event => {
  if (event.target.id === 'search') { query = event.target.value; renderGrid(); }
  if ($('#dialog').contains(event.target)) dirty = true;
});
document.addEventListener('change', async event => {
  if (event.target.dataset.select) { if (event.target.checked) selected.add(event.target.dataset.select); else selected.delete(event.target.dataset.select); renderGrid(); }
  if (event.target.id === 'file-input') importFiles(event.target.files).catch(error => toast(error.message, true));
  if (event.target.id === 'auto-publish') { try { await api('settings', { autoPublish: event.target.checked }); status = await api('status'); renderStatus(); } catch (error) { toast(error.message, true); renderStatus(); } }
  if ($('#dialog').contains(event.target)) dirty = true;
});
$('#dialog').addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && $('#dialog').open) { event.preventDefault(); if (!locked) $('#dialog form')?.requestSubmit(); } });
window.addEventListener('beforeunload', event => { if (dirty || uploading) { event.preventDefault(); event.returnValue = ''; } });
let dragDepth = 0;
document.addEventListener('dragenter', event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth++; if (album() && !$('#dialog').open && !uploading) $('#drop-overlay').hidden = false; } });
document.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#drop-overlay').hidden = true; });
document.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; $('#drop-overlay').hidden = true; if (event.dataTransfer.files.length && !$('#dialog').open) importFiles(event.dataTransfer.files).catch(error => toast(error.message, true)); });
async function poll() {
  if (polling || document.hidden) return;
  polling = true;
  try {
    const hadError = status.error;
    status = await api('status'); renderStatus();
    if (status.error && status.error !== hadError) { toast('Не удалось опубликовать: ' + status.error, true); if (!modal && !uploading) renderMain(); }
    if (status.lastPublished && (!status.deployment || status.deployment.status !== 'completed') && Date.now() - deploymentChecked > 15000) {
      deploymentChecked = Date.now(); status.deployment = await api('deployment', {}); renderStatus();
    }
    lastConnectionError = false;
  } catch {
    $('#status-title').textContent = 'Менеджер недоступен'; $('#status-detail').textContent = 'Откройте запускной файл снова и обновите окно'; $('#status-indicator').className = 'status-indicator error';
    if (!lastConnectionError) { toast('Соединение со студией прервано. Сохранённые файлы остались на компьютере.', true); lastConnectionError = true; }
  } finally { polling = false; }
}
window.addEventListener('focus', () => { if (!modal && !uploading && !locked) refresh().catch(() => {}); });
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
const pollTimer = setInterval(poll, 2500);
(async () => {
  try { current = window.localStorage.getItem('gallery-studio-album') || null; await refresh(); }
  catch (error) { $('#main').innerHTML = `<div class="empty-state"><h2>Не удалось открыть коллекцию</h2><p>${esc(error.message)}</p></div>`; }
})();
