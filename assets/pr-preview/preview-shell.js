(() => {
  'use strict';

  const { title, scenes, execution } = JSON.parse(document.getElementById('preview-data').textContent);
  // This URL gate identifies the upstream controlled entry. It does not create
  // or attest a network sandbox; the fixed boundary log belongs to that runner.
  const interactive = execution.mode === 'external-isolation' &&
    location.href.split('#')[0] === execution.entryUrl;
  const byId = id => document.getElementById('preview-' + id);
  const sceneSelect = byId('scene');
  const versionSelect = byId('version');
  const localeSelect = byId('locale');
  const widthSelect = byId('width');
  const evidence = byId('evidence');
  const stage = byId('stage');
  const versionNames = {base:'改前', head:'改后'};
  const sourceNames = {
    'original-page':'原页面产物',
    'original-component':'原组件隔离产物',
    reconstruction:'源码重建产物'
  };
  const roleNames = {source:'原源码',layout:'布局',style:'样式',dictionary:'字典',comparison:'对照记录'};
  let scene;
  let version;
  let locale;
  let width;
  let frame;

  document.title = title;
  byId('title').textContent = title;
  byId('execution').textContent = interactive
    ? '外部隔离入口：产品脚本已启用。网络与凭据隔离由上游执行环境保证，外壳不提供网络沙箱。'
    : '静态预览：产品脚本关闭，动态内容可能未生成；交互未验。需要交互时使用有实际禁网和无凭据证据的受控入口。';

  function option(value, label, disabled = false) {
    const item = document.createElement('option');
    item.value = value;
    item.textContent = label;
    item.disabled = disabled;
    return item;
  }

  function readScene() {
    const id = location.hash.slice(1);
    return scenes.find(item => item.id === id) ?? scenes[0];
  }

  function renderOptions() {
    sceneSelect.value = scene.id;
    versionSelect.replaceChildren(...Object.entries(versionNames).map(([key, label]) => {
      const available = Object.hasOwn(scene.versions[key] ?? {}, locale);
      return option(key, available ? label : label + '（该语言无产物）', !available);
    }));
    versionSelect.value = version;
    localeSelect.replaceChildren(...Object.keys(scene.versions[version]).map(key => option(key, key)));
    localeSelect.value = locale;
    widthSelect.replaceChildren(...scene.widths.map(value => option(value, value + ' px')));
    widthSelect.value = String(width);
  }

  function list(items) {
    return items.length ? items.join('\n') : '调用方未记录';
  }

  function renderEvidence() {
    const { source, artifact } = scene.versions[version][locale];
    const details = [
      ['场景', scene.label],
      ['平台及视口', scene.platform + ' · ' + width + ' CSS px · ' + locale],
      ['版本与来源', versionNames[version] + ' · ' + sourceNames[source.kind] + '\n' + source.repo + ' @ ' + source.sha],
      ['产物指纹', artifact.sha256],
      ['执行范围', interactive
        ? '外部隔离入口 · 产品脚本启用；隔离由上游保证，外壳不提供网络沙箱'
        : '静态预览 · 产品脚本关闭 · 动态内容可能未生成 · 交互未验'],
      ['来源材料', source.materials.map(item => roleNames[item.role] + ' · ' + item.path + '\n' + item.sha256).join('\n')],
      ['模拟范围', list(source.mocks)],
      ['待核实', list(source.unverified)]
    ];
    if (execution.mode === 'external-isolation') details.push(
      ['受控入口',execution.entryUrl + (interactive ? '\n当前入口匹配' : '\n当前入口不匹配，产品脚本保持关闭')],
      ['上游边界日志',execution.boundaryEvidence.path + '\n' + execution.boundaryEvidence.sha256 +
        '\n' + execution.mechanism + '\n' + execution.credentialBoundary + '\n' + execution.observations.join('\n')]
    );
    evidence.replaceChildren(...details.flatMap(([label, value]) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      return [term, description];
    }));
  }

  function openVariant() {
    const { artifact } = scene.versions[version][locale];
    frame = document.createElement('iframe');
    frame.title = scene.label + ' · ' + versionNames[version];
    frame.setAttribute('sandbox', interactive ? 'allow-scripts allow-forms' : artifact.fragmentLinks ? 'allow-same-origin' : '');
    frame.referrerPolicy = 'no-referrer';
    frame.width = String(width);
    frame.height = String(scene.height);
    const productFrame = frame;
    if (!interactive && artifact.fragmentLinks) productFrame.addEventListener('load', () => {
      if (frame !== productFrame || !productFrame.isConnected) return;
      const product = productFrame.contentDocument;
      // Script execution remains sandbox-disabled. This outer-shell listener
      // preserves original href attributes/CSS while resolving native fragments
      // within this document rather than against srcdoc's inherited file base.
      product.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest?.('a,area');
        const fragment = (link?.getAttribute('href') ?? link?.getAttribute('xlink:href'))?.trim();
        if (!fragment?.startsWith('#')) return;
        event.preventDefault();
        const unchanged = product.defaultView.location.hash === fragment;
        product.defaultView.location.hash = fragment;
        if (fragment === '#') product.defaultView.scrollTo(0,0);
        else if (unchanged) {
          let id = fragment.slice(1);
          try {id = decodeURIComponent(id);} catch {}
          (product.getElementById(id) ?? product.getElementsByName(id)[0])?.scrollIntoView();
        }
      }, true);
    });
    frame.srcdoc = artifact.html;
    stage.replaceChildren(frame);
    renderOptions();
    renderEvidence();
  }

  function restoreScene() {
    scene = readScene();
    version = scene.initialVersion;
    locale = scene.initialLocale;
    width = scene.initialWidth;
    openVariant();
  }

  sceneSelect.replaceChildren(...scenes.map(item => option(item.id, item.label)));
  sceneSelect.addEventListener('change', () => {
    if (sceneSelect.value !== scene.id) location.hash = sceneSelect.value;
  });
  versionSelect.addEventListener('change', () => {
    if (!Object.hasOwn(scene.versions[versionSelect.value] ?? {}, locale)) return;
    version = versionSelect.value;
    openVariant();
  });
  localeSelect.addEventListener('change', () => {
    if (!Object.hasOwn(scene.versions[version], localeSelect.value)) return;
    locale = localeSelect.value;
    openVariant();
  });
  widthSelect.addEventListener('change', () => {
    const selected = Number(widthSelect.value);
    if (!scene.widths.includes(selected)) return;
    width = selected;
    frame.width = String(width);
    renderEvidence();
  });
  byId('reset').addEventListener('click', openVariant);
  addEventListener('hashchange', restoreScene);
  restoreScene();
})();
