const stack = [];
let root;

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
      if (i < stack.length - 1) {
        s.onclick = () => { stack.splice(i + 1); render(stack[stack.length - 1]); };
      }
      nav.append(s);
    });
    app.append(nav);
  }

  const grid = document.createElement('div');
  grid.className = 'grid';

  (node.children || []).forEach(child => {
    if (child.url) {
      const a = document.createElement('a');
      a.href = child.url;
      a.className = 'card';
      a.title = child.title;
      const img = document.createElement('img');
      try {
        const u = new URL(child.url);
        img.src = `${u.origin}/favicon.ico`;
        img.onerror = () => {
          img.onerror = () => img.style.visibility = 'hidden';
          img.src = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
        };
      } catch(e) {}
      a.append(img);
      const span = document.createElement('span');
      span.textContent = child.title;
      a.append(span);
      grid.append(a);
    } else {
      const div = document.createElement('div');
      div.className = 'card folder';
      const icon = document.createElement('div');
      icon.className = 'folder-icon';
      icon.textContent = '📁';
      const span = document.createElement('span');
      span.textContent = child.title;
      div.append(icon, span);
      div.onclick = () => { stack.push(child); render(child); };
      grid.append(div);
    }
  });

  app.append(grid);
}

chrome.bookmarks.getTree(([rootNode]) => {
  root = { title: '主页', children: [] };
  rootNode.children.forEach(t => root.children.push(...(t.children || [])));
  stack.push(root);
  render(root);
});
