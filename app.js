(function () {
  'use strict';

  const STORAGE_KEY = 'github-tool-box.tools.v1';
  const elements = {
    addButton: document.getElementById('add-tool-button'),
    cancelButton: document.getElementById('cancel-dialog-button'),
    closeButton: document.getElementById('close-dialog-button'),
    dialog: document.getElementById('tool-dialog'),
    form: document.getElementById('tool-form'),
    title: document.getElementById('dialog-title'),
    id: document.getElementById('tool-id'),
    name: document.getElementById('tool-name'),
    url: document.getElementById('tool-url'),
    description: document.getElementById('tool-description'),
    tags: document.getElementById('tool-tags'),
    nameError: document.getElementById('name-error'),
    urlError: document.getElementById('url-error'),
    search: document.getElementById('search-input'),
    sort: document.getElementById('sort-select'),
    filters: document.getElementById('tag-filters'),
    list: document.getElementById('tool-list'),
    count: document.getElementById('tool-count'),
    sidebarCount: document.getElementById('sidebar-count'),
    resultsCount: document.getElementById('results-count')
  };

  let tools = loadTools();
  let selectedTag = '';

  function loadTools() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter(isValidTool) : [];
    } catch (error) {
      return [];
    }
  }

  function isValidTool(tool) {
    return tool && typeof tool.id === 'string' && typeof tool.name === 'string' &&
      typeof tool.url === 'string' && Array.isArray(tool.tags);
  }

  function saveTools() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tools));
      return true;
    } catch (error) {
      window.alert('保存できませんでした。ブラウザの保存領域をご確認ください。');
      return false;
    }
  }

  function createElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function normalizeUrl(value) {
    try {
      const url = new URL(value.trim());
      if (url.protocol !== 'https:' || !['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) return '';
      if (url.pathname === '/' || url.pathname.split('/').filter(Boolean).length < 2) return '';
      return url.toString();
    } catch (error) {
      return '';
    }
  }

  function getFilteredTools() {
    const query = elements.search.value.trim().toLocaleLowerCase();
    const filtered = tools.filter(function (tool) {
      const searchable = [tool.name, tool.url, tool.description || '', ...(tool.tags || [])].join(' ').toLocaleLowerCase();
      return (!query || searchable.includes(query)) && (!selectedTag || tool.tags.includes(selectedTag));
    });

    filtered.sort(function (first, second) {
      if (elements.sort.value === 'name') return first.name.localeCompare(second.name, 'ja');
      if (elements.sort.value === 'oldest') return (first.createdAt || 0) - (second.createdAt || 0);
      return (second.createdAt || 0) - (first.createdAt || 0);
    });
    return filtered;
  }

  function renderFilters() {
    elements.filters.replaceChildren();
    const tags = [...new Set(tools.flatMap(function (tool) { return tool.tags || []; }))].sort(function (a, b) {
      return a.localeCompare(b, 'ja');
    });
    if (!tags.length) return;

    const allButton = createElement('button', 'filter-chip' + (selectedTag ? '' : ' is-selected'), 'すべて');
    allButton.type = 'button';
    allButton.addEventListener('click', function () { selectedTag = ''; render(); });
    elements.filters.append(allButton);

    tags.forEach(function (tag) {
      const button = createElement('button', 'filter-chip' + (selectedTag === tag ? ' is-selected' : ''), tag);
      button.type = 'button';
      button.addEventListener('click', function () { selectedTag = selectedTag === tag ? '' : tag; render(); });
      elements.filters.append(button);
    });
  }

  function renderTool(tool, index) {
    const card = createElement('article', 'tool-card');
    card.style.animationDelay = Math.min(index * 35, 210) + 'ms';
    const avatar = createElement('div', 'tool-avatar', tool.name.trim().charAt(0) || '?');
    avatar.setAttribute('aria-hidden', 'true');

    const main = createElement('div', 'tool-main');
    const titleLine = createElement('div', 'tool-title-line');
    titleLine.append(createElement('h3', 'tool-title', tool.name));
    const link = createElement('a', 'repo-link', tool.url.replace(/^https:\/\/(www\.)?github\.com\//, '').replace(/\/$/, ''));
    link.href = tool.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(createElement('span', 'external-icon', '↗'));
    titleLine.append(link);
    main.append(titleLine);

    if (tool.description) main.append(createElement('p', 'tool-description', tool.description));
    if (tool.tags.length) {
      const tagList = createElement('div', 'tool-tags');
      tool.tags.forEach(function (tag) { tagList.append(createElement('span', 'tool-tag', tag)); });
      main.append(tagList);
    }

    const actions = createElement('div', 'tool-actions');
    const editButton = createElement('button', 'icon-button', '✎');
    editButton.type = 'button';
    editButton.setAttribute('aria-label', tool.name + ' を編集');
    editButton.title = '編集';
    editButton.addEventListener('click', function () { openDialog(tool); });
    const deleteButton = createElement('button', 'icon-button delete-button', '×');
    deleteButton.type = 'button';
    deleteButton.setAttribute('aria-label', tool.name + ' を削除');
    deleteButton.title = '削除';
    deleteButton.addEventListener('click', function () { deleteTool(tool); });
    actions.append(editButton, deleteButton);
    card.append(avatar, main, actions);
    return card;
  }

  function renderEmptyState(hasTools) {
    const empty = createElement('div', 'empty-state');
    const mark = createElement('div', 'empty-mark', hasTools ? '⌕' : '</>');
    mark.setAttribute('aria-hidden', 'true');
    empty.append(mark);
    empty.append(createElement('h3', '', hasTools ? '見つかりませんでした' : 'コレクションはまだ空です'));
    empty.append(createElement('p', '', hasTools ? '検索ワードやタグを変えて試してみてください。' : '気になるGitHubリポジトリを追加して、\n自分だけのツール箱を作りましょう。'));
    if (!hasTools) {
      const button = createElement('button', 'button button-primary', '+ ツールを追加');
      button.type = 'button';
      button.addEventListener('click', function () { openDialog(); });
      empty.append(button);
    }
    elements.list.append(empty);
  }

  function render() {
    const filtered = getFilteredTools();
    elements.count.textContent = String(tools.length);
    elements.sidebarCount.textContent = String(tools.length);
    elements.resultsCount.textContent = filtered.length + ' 件';
    renderFilters();
    elements.list.replaceChildren();
    if (!filtered.length) {
      renderEmptyState(tools.length > 0);
      return;
    }
    filtered.forEach(function (tool, index) { elements.list.append(renderTool(tool, index)); });
  }

  function clearErrors() {
    elements.nameError.textContent = '';
    elements.urlError.textContent = '';
  }

  function openDialog(tool) {
    elements.form.reset();
    clearErrors();
    if (tool) {
      elements.title.textContent = 'ツールを編集';
      elements.id.value = tool.id;
      elements.name.value = tool.name;
      elements.url.value = tool.url;
      elements.description.value = tool.description || '';
      elements.tags.value = (tool.tags || []).join(', ');
    } else {
      elements.title.textContent = 'ツールを追加';
      elements.id.value = '';
    }
    elements.dialog.showModal();
    elements.name.focus();
  }

  function closeDialog() {
    elements.dialog.close();
  }

  function handleSubmit(event) {
    event.preventDefault();
    clearErrors();
    const name = elements.name.value.trim();
    const url = normalizeUrl(elements.url.value);
    let valid = true;
    if (!name) {
      elements.nameError.textContent = '名前を入力してください。';
      valid = false;
    }
    if (!url) {
      elements.urlError.textContent = 'https://github.com/owner/repo の形式で入力してください。';
      valid = false;
    }
    if (!valid) return;

    const existing = tools.find(function (tool) { return tool.id === elements.id.value; });
    const tags = [...new Set(elements.tags.value.split(',').map(function (tag) { return tag.trim(); }).filter(Boolean))];
    const updated = {
      id: existing ? existing.id : (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      name: name,
      url: url,
      description: elements.description.value.trim(),
      tags: tags,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now()
    };
    const previousTools = tools;
    tools = existing ? tools.map(function (tool) { return tool.id === existing.id ? updated : tool; }) : [updated, ...tools];
    if (!saveTools()) {
      tools = previousTools;
      return;
    }
    closeDialog();
    render();
  }

  function deleteTool(tool) {
    if (!window.confirm('「' + tool.name + '」を削除しますか？')) return;
    const previousTools = tools;
    tools = tools.filter(function (item) { return item.id !== tool.id; });
    if (!saveTools()) {
      tools = previousTools;
      return;
    }
    if (selectedTag && !tools.some(function (item) { return item.tags.includes(selectedTag); })) selectedTag = '';
    render();
  }

  elements.addButton.addEventListener('click', function () { openDialog(); });
  elements.cancelButton.addEventListener('click', closeDialog);
  elements.closeButton.addEventListener('click', closeDialog);
  elements.form.addEventListener('submit', handleSubmit);
  elements.search.addEventListener('input', render);
  elements.sort.addEventListener('change', render);
  document.addEventListener('keydown', function (event) {
    if (event.key === '/' && !elements.dialog.open && document.activeElement !== elements.search && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      elements.search.focus();
    }
  });

  render();
}());