const stack = [];
const fwdStack = [];
let root, dragSrc = null, activeMenu = null;

const COLORS = ['#e74c3c','#e67e22','#2ecc71','#3498db','#9b59b6','#1abc9c','#e91e63','#f39c12'];

function favicon(url) {
  const wrap = document.createElement('div');
  wrap.className = 'favicon-wrap';
  try {
    const u = new URL(url);
    const ph = document.createElement('div');
    ph.className = 'favicon-ph';
    ph.textContent = u.hostname.replace(/^www\./, '')[0].toUpperCase();
    ph.style.background = COLORS[u.hostname.charCodeAt(0) % COLORS.length];
    wrap.append(ph);
    const img = document.createElement('img');
    img.onload = () => ph.replaceWith(img);
    img.src = `${u.origin}/favicon.ico`;
    img.onerror = () => { img.onerror = null; img.src = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(url)}&size=32`; };
  } catch(e) {}
  return wrap;
}

function closeMenu() {
  if (activeMenu) { activeMenu.remove(); activeMenu = null; }
}

function getAllFolders(node, list = []) {
  (node.children || []).forEach(c => { if (!c.url) { list.push(c); getAllFolders(c, list); } });
  return list;
}

function showEditModal({ title = '', url, onSave }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  const modal = document.createElement('div');
  modal.className = 'modal';

  const h = document.createElement('h3');
  h.textContent = url !== undefined ? (title ? '编辑书签' : '新建书签') : (title ? '编辑文件夹' : '新建文件夹');

  const titleInput = document.createElement('input');
  titleInput.type = 'text'; titleInput.value = title; titleInput.placeholder = '标题';
  modal.append(h, titleInput);

  let urlInput;
  if (url !== undefined) {
    urlInput = document.createElement('input');
    urlInput.type = 'url'; urlInput.value = url || ''; urlInput.placeholder = '网址';
    modal.append(urlInput);
  }

  const actions = document.createElement('div');
  actions.className = 'modal-actions';

  const cancel = document.createElement('button');
  cancel.textContent = '取消'; cancel.className = 'btn-secondary';
  cancel.onclick = () => overlay.remove();

  const save = document.createElement('button');
  save.textContent = '保存'; save.className = 'btn-primary';
  save.onclick = () => {
    const t = titleInput.value.trim();
    if (!t) { titleInput.focus(); return; }
    const result = { title: t };
    if (urlInput) result.url = urlInput.value.trim();
    onSave(result);
    overlay.remove();
  };

  actions.append(cancel, save);
  modal.append(actions);
  overlay.append(modal);
  document.body.append(overlay);
  titleInput.focus(); titleInput.select();
  modal.addEventListener('keydown', e => {
    if (e.key === 'Enter') save.click();
    if (e.key === 'Escape') overlay.remove();
  });
}

function showMenu(e, child) {
  e.preventDefault(); e.stopPropagation();
  closeMenu();
  const current = stack[stack.length - 1];
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.style.cssText = `position:fixed;top:${e.clientY}px;left:${e.clientX}px`;
  activeMenu = menu;
  document.body.append(menu);

  function item(label, fn) {
    const d = document.createElement('div');
    d.className = 'menu-item'; d.textContent = label;
    d.onclick = ev => { ev.stopPropagation(); closeMenu(); fn(); };
    menu.append(d);
  }

  item('编辑', () => showEditModal({
    title: child.title, url: child.url,
    onSave: upd => chrome.bookmarks.update(child.id, upd, () => render(current))
  }));

  item('移动到', () => {
    const folders = getAllFolders(root);
    const sub = document.createElement('div');
    sub.className = 'menu';
    sub.style.cssText = `position:fixed;top:${e.clientY}px;left:${e.clientX}px;max-height:300px;overflow-y:auto`;
    activeMenu = sub;
    document.body.append(sub);
    folders.forEach(f => {
      const d = document.createElement('div');
      d.className = 'menu-item'; d.textContent = f.title;
      d.onclick = ev => { ev.stopPropagation(); closeMenu(); chrome.bookmarks.move(child.id, { parentId: f.id }, () => render(current)); };
      sub.append(d);
    });
  });

  item('删除', () => {
    (child.url ? chrome.bookmarks.remove : chrome.bookmarks.removeTree)
      .call(chrome.bookmarks, child.id, () => render(current));
  });
}

function makeCard(child) {
  const el = document.createElement(child.url ? 'a' : 'div');
  el.className = 'card' + (child.url ? '' : ' folder');
  if (child.url) {
    el.href = child.url; el.title = child.title;
    el.append(favicon(child.url));
  } else {
    const icon = document.createElement('div');
    icon.className = 'folder-icon'; icon.textContent = '📁';
    el.append(icon);
    el.addEventListener('click', e => {
      if (e.target.closest('.menu-btn')) return;
      fwdStack.length = 0; stack.push(child); render(child);
    });
  }
  const span = document.createElement('span');
  span.textContent = child.title;
  el.append(span);

  const btn = document.createElement('button');
  btn.className = 'menu-btn'; btn.textContent = '⋮';
  btn.addEventListener('click', e => { e.preventDefault(); showMenu(e, child); });
  el.append(btn);

  el.draggable = true;
  el.addEventListener('dragstart', e => { dragSrc = child; e.dataTransfer.effectAllowed = 'move'; });
  el.addEventListener('dragenter', e => { e.preventDefault(); el.classList.add('drag-over'); });
  el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over'); });
  el.addEventListener('dragover', e => e.preventDefault());
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('drag-over');
    if (!dragSrc || dragSrc.id === child.id) return;
    const cur = stack[stack.length - 1];
    if (!child.url) {
      chrome.bookmarks.move(dragSrc.id, { parentId: child.id }, () => render(cur));
    } else {
      const idx = (cur.children || []).findIndex(c => c.id === child.id);
      chrome.bookmarks.move(dragSrc.id, { parentId: cur.id, index: idx }, () => render(cur));
    }
    dragSrc = null;
  });
  return el;
}

function render(node) {
  const app = document.getElementById('app');
  app.innerHTML = '';

  if (stack.length > 1) {
    const nav = document.createElement('nav');
    stack.forEach((n, i) => {
      if (i > 0) nav.append(document.createTextNode(' › '));
      const s = document.createElement('span');
      s.textContent = n.title || '主页';
      s.className = 'crumb' + (i < stack.length - 1 ? ' link' : '');
      if (i < stack.length - 1)
        s.onclick = () => { fwdStack.length = 0; stack.splice(i + 1); render(stack[stack.length - 1]); };
      nav.append(s);
    });
    app.append(nav);
  }

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.addEventListener('dragover', e => e.preventDefault());
  grid.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragSrc) return;
    chrome.bookmarks.move(dragSrc.id, { parentId: node.id }, () => render(node));
    dragSrc = null;
  });
  (node.children || []).forEach(child => grid.append(makeCard(child)));

  const addEl = document.createElement('div');
  addEl.className = 'card add';
  [['书签', false], ['文件夹', true]].forEach(([label, isFolder], i) => {
    const half = document.createElement('div');
    half.className = 'add-half' + (i ? ' add-half-r' : '');
    const icon = document.createElement('div');
    icon.className = 'add-icon'; icon.textContent = '+';
    const span = document.createElement('span'); span.textContent = label;
    half.append(icon, span);
    half.onclick = e => { e.stopPropagation(); showEditModal({
      title: '', url: isFolder ? undefined : '',
      onSave: data => chrome.bookmarks.create(
        { parentId: node.id || '1', title: data.title, ...(data.url ? { url: data.url } : {}) },
        () => render(node)
      )
    }); };
    addEl.append(half);
  });
  grid.append(addEl);
  app.append(grid);
}

document.addEventListener('mousedown', e => { if (e.button === 3 || e.button === 4) e.preventDefault(); });
document.addEventListener('mouseup', e => {
  if (e.button === 3 && stack.length > 1) { fwdStack.push(stack.pop()); render(stack[stack.length - 1]); }
  else if (e.button === 4 && fwdStack.length > 0) { stack.push(fwdStack.pop()); render(stack[stack.length - 1]); }
});
document.addEventListener('click', e => { if (activeMenu && !activeMenu.contains(e.target)) closeMenu(); });

chrome.bookmarks.getTree(([rootNode]) => {
  root = { title: '主页', children: [] };
  rootNode.children.forEach(t => root.children.push(...(t.children || [])));
  stack.push(root);
  render(root);
});
