// 主逻辑 v1.0：五大功能模块演示（复用 modules.js 检索与校验核心）
(function () {
  const D = window.DATA, L = window.LLM, SH = window.SH;
  const $ = (s, r = document) => r.querySelector(s);
  const DEMO_URL = 'https://c8219.github.io/shanhaipufa-demo/';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function speak(text, code) {
    try {
      if (!('speechSynthesis' in window) || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (code) u.lang = code;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
  const BOUNDARY = '<div class="boundary">ℹ️ 本回答为人工编写的科普示例，<b>不构成法律意见</b>；具体事项请咨询 12348 或执业律师。</div>';

  /* ---------- ① 智能咨询：复用 modules.js 检索核心 ---------- */
  const chatEl = $('#chat');
  function appendUser(q) {
    const u = document.createElement('div'); u.className = 'msg';
    u.innerHTML = '<div class="who">您</div><div class="bubble user">' + esc(q) + '</div>';
    chatEl.appendChild(u); scroll();
  }
  function appendTyping() {
    const t = document.createElement('div'); t.className = 'msg'; t.id = 'typing';
    t.innerHTML = '<div class="who">山海普法通</div><div class="typing">正在检索法律知识库<i></i><i></i><i></i></div>';
    chatEl.appendChild(t); scroll();
  }
  function replaceTyping(html) {
    const t = $('#typing'); if (t) t.outerHTML = html; scroll();
  }
  function scroll() { chatEl.scrollTop = chatEl.scrollHeight; }

  // 预置模式：不再用关键词子串硬匹配，改为 modules.js 的混合检索
  function matchPreset(q) {
    const r = SH.retrieve(q, { hybrid: true, topN: 3 });
    const t = r.hits[0];
    if (!t || (t.ngram < SH.GATE_NGRAM && t.keyword < SH.GATE_KEYWORD)) return { item: null, hits: r.hits };
    return { item: D.consult[t.id], hits: r.hits, score: t.score };
  }

  function traceHtml(hits, v) {
    if (!hits || !hits.length) return '';
    const top = hits[0];
    return '<div class="hint">🔍 <b>可复核链路</b>（复用同一份 modules.js）：混合检索 Top3 = ' +
      hits.map(h => '#' + h.id + '(' + h.score + ')').join(' / ') +
      '　·　BM25 ' + top.bm25 + ' ＋ n-gram ' + top.ngram + '　·　法条校验：' +
      (v.ok ? '<span class="tag ok">全部通过</span>' : '<span class="tag bad">已拦截</span>') +
      '</div>';
  }

  function renderPreset(item, fuzzy, hits) {
    const v = SH.validateCitation((item.cites || []).join(' '));
    const cites = (item.cites || []).map(x => '<span class="cite">' + esc(x) + '</span>').join('');
    let body = '<div class="who">山海普法通</div><div class="bubble">' + esc(item.a) + '<br>' + cites +
      '<span class="conf ' + item.conf + '">' + ({ high: '置信度：高', mid: '置信度：中', low: '置信度：低' }[item.conf]) + '</span></div>';
    if (item.human) body += '<div class="human">⚠️ 紧迫/敏感问题已中断实体结论生成，转人工：12348 公共法律服务热线 / 110 报警，并生成工单闭环。</div>';
    body += traceHtml(hits, v) + BOUNDARY;
    replaceTyping('<div class="msg">' + body + '</div>');
  }

  // 实时模式：模型输出必须回到法条校验器，未通过则明确标红，不再绕过校验直接打引用标签
  function renderLive(answer) {
    const v = SH.validateCitation(answer);
    const low = /人身安全|报警|生命|紧急|无法确认|建议拨打/.test(answer);
    let body = '<div class="who">山海普法通（实时模型 · 原始输出，仅供审阅）</div><div class="bubble">' + esc(answer) +
      '<span class="conf ' + (v.ok && !low ? 'mid' : 'low') + '">' + (v.ok ? 'AI 生成 · 建议核实' : '未通过法条校验') + '</span></div>';
    const rows = v.cites.length ? v.cites.map(c =>
      '<tr><td>' + esc(c.raw) + '</td><td><span class="tag ' + (c.status === 'pass' ? 'ok' : 'bad') + '">' + esc(c.status) + '</span></td><td>' + esc(c.reason) + '</td></tr>').join('')
      : '<tr><td colspan="3" class="dim">未检出任何《…》第X条格式的法条引用</td></tr>';
    body += '<div class="verdict ' + (v.ok ? 'ok' : 'bad') + '">法条校验器：' +
      (v.ok ? 'PASS，引用通过本地索引核验' : 'BLOCK，本次输出不予作为合规结论展示，应触发重写或转人工') +
      '　·　' + esc(v.summary) + '</div>' +
      '<table class="mini"><thead><tr><th>引用原文</th><th>状态</th><th>判定依据</th></tr></thead><tbody>' + rows + '</tbody></table>';
    if (low) body += '<div class="human">⚠️ 涉及人身或紧迫事项，请优先拨打 110 或 12348 公共法律服务热线。</div>';
    body += BOUNDARY;
    replaceTyping('<div class="msg">' + body + '</div>');
  }

  function ask(q) {
    q = (q || '').trim();
    if (!q) return;
    appendUser(q);
    const exact = D.consult.find(x => x.q === q);
    const m = matchPreset(q);
    const preset = exact || m.item;
    if (L.isLive()) {
      appendTyping();
      L.chat(q).then(renderLive).catch(() => {
        if (preset) renderPreset(preset, !exact, m.hits);
        else replaceTyping('<div class="msg"><div class="who">山海普法通</div><div class="bubble">实时模型调用失败，且预置库无相近问题，请稍后重试或在「⚙ 模型设置」中检查配置。</div></div>');
      });
    } else {
      appendTyping();
      setTimeout(() => {
        if (preset) renderPreset(preset, !exact, m.hits);
        else replaceTyping('<div class="msg"><div class="who">山海普法通</div><div class="bubble">演示预置模式仅内置 ' + D.consult.length +
          ' 个示例问题，当前问题未通过低置信闸门（判定为知识库范围外），按「不臆造答案」原则不输出实体结论。可在右上角配置实时模型查看检索闸门参数。</div>' + BOUNDARY + '</div>');
      }, 500);
    }
  }

  const inputEl = $('#consultInput'), sendEl = $('#consultSend');
  function sendInput() { const v = inputEl.value; inputEl.value = ''; ask(v); }
  sendEl.onclick = sendInput;
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendInput(); });
  $('#consultChips').innerHTML = D.consult.map(x => '<span class="chip" data-q="' + esc(x.q) + '">' + esc(x.q) + '</span>').join('');
  document.querySelectorAll('#consultChips .chip').forEach(c => c.onclick = () => ask(c.dataset.q));

  /* ---------- ② 山歌：校验结果实时计算 ---------- */
  $('#songBox').innerHTML = D.songs.map(s => {
    const r = SH.songCheck(s.text);
    const badges = r.checks.map(c => '<span class="tag ' + (c.ok ? 'ok' : 'bad') + '">' + (c.ok ? '✔ ' : '✘ ') + esc(c.name) + '</span>').join(' ');
    return '<div class="song">' +
      '<div style="font-weight:700;margin-bottom:6px">' + esc(s.title) + '</div>' + esc(s.text) +
      '<div style="font-size:12.5px;color:var(--muted);margin-top:8px">— ' + esc(s.note) + '</div>' +
      '<div style="margin-top:9px">' + badges + '</div></div>';
  }).join('');

  /* ---------- ③ 答题 ---------- */
  $('#quizBox').innerHTML = D.quiz.map((it, i) =>
    '<div class="quiz" data-i="' + i + '"><div style="font-weight:700;margin-bottom:8px">【' + esc(it.cat) + ' · 单选】' + esc(it.q) + '</div>' +
    it.opts.map((o, j) => '<button class="opt" data-j="' + j + '">' + esc(o) + '</button>').join('') +
    '<div class="explain">✅ ' + esc(it.explain) + '</div></div>').join('');
  document.querySelectorAll('#quizBox .quiz').forEach(q => {
    const it = D.quiz[+q.dataset.i];
    q.querySelectorAll('.opt').forEach(b => {
      b.onclick = () => {
        q.querySelectorAll('.opt').forEach(x => x.disabled = true);
        const j = +b.dataset.j;
        if (j === it.ok) b.classList.add('ok');
        else { b.classList.add('bad'); q.querySelector(".opt[data-j='" + it.ok + "']").classList.add('ok'); }
        q.querySelector('.explain').style.display = 'block';
      };
    });
  });

  /* ---------- ④ 数字人播报 ---------- */
  let bi = 0;
  $('#broadcastBtn').onclick = () => {
    const cap = $('#cap');
    cap.textContent = D.broadcasts[bi % D.broadcasts.length];
    cap.style.display = 'block'; bi++;
  };
  $('#broadcastSpeak').onclick = () => {
    if ($('#cap').style.display === 'none') $('#broadcastBtn').click();
    setTimeout(() => speak($('#cap').textContent, 'zh-CN'), 60);
  };

  /* ---------- ⑤ 多语种：译文与语音能力边界如实标注 ---------- */
  const LANGS = [
    { key: 'zh', name: '中文', flag: '🇨🇳', code: 'zh-CN' },
    { key: 'za', name: '壮语', flag: '🪶', code: null },
    { key: 'en', name: '英语', flag: '🇬🇧', code: 'en-US' },
    { key: 'vi', name: '越南语', flag: '🇻🇳', code: 'vi-VN' },
    { key: 'th', name: '泰语', flag: '🇹🇭', code: 'th-TH' },
    { key: 'lo', name: '老挝语', flag: '🇱🇦', code: 'lo-LA' },
    { key: 'my', name: '缅甸语', flag: '🇲🇲', code: 'my-MM' },
    { key: 'km', name: '柬埔寨语', flag: '🇰🇭', code: 'km-KH' }
  ];
  let activeLang = 'vi';
  $('#langBar').innerHTML = LANGS.map(l => '<button class="lchip" data-k="' + l.key + '">' + l.flag + ' ' + l.name + '</button>').join('');
  function renderCross() {
    const L0 = LANGS.find(l => l.key === activeLang);
    $('#crossBox').innerHTML = D.cross.map((c, i) => {
      const tr = c[L0.key] || '';
      const canSpeak = !!L0.code;
      return '<div class="xcard">' +
        '<div class="xtitle">场景 ' + (i + 1) + ' · ' + esc(c.t) + '</div>' +
        '<div class="xrow"><span class="xflag">🇨🇳 中文</span><p>' + esc(c.zh) + '</p></div>' +
        '<div class="xrow xact"><span class="xflag">' + L0.flag + ' ' + L0.name + '</span>' +
        '<button class="speak" data-i="' + i + '"' + (canSpeak ? '' : ' disabled') +
        ' title="' + (canSpeak ? '浏览器 Web Speech 第三方能力，非自研 TTS' : '浏览器暂无该语言语音包') + '">🔊</button>' +
        '<p>' + esc(tr) + '</p></div></div>';
    }).join('');
    document.querySelectorAll('#crossBox .speak').forEach(b => {
      b.onclick = () => { const c = D.cross[+b.dataset.i]; speak(c[activeLang], L0.code); };
    });
    $('#langNote').textContent = '当前语种：' + L0.name +
      '。朗读为浏览器 Web Speech 第三方能力（' +
      (L0.code ? '语音包 ' + L0.code : '该语种无可用语音包，按钮置灰') + '），本项目未自研 TTS。';
  }
  document.querySelectorAll('#langBar .lchip').forEach(b => {
    b.onclick = () => {
      activeLang = b.dataset.k;
      document.querySelectorAll('#langBar .lchip').forEach(x => x.classList.toggle('on', x.dataset.k === activeLang));
      renderCross();
    };
  });
  document.querySelectorAll('#langBar .lchip').forEach(b => b.classList.toggle('on', b.dataset.k === activeLang));
  renderCross();


  /* ---------- 进场动画（不再有从 0 滚到目标值的假计数） ---------- */
  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) e.target.style.animation = 'rise .5s ease both'; });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(s => io.observe(s));



  /* ---------- 告知同意弹窗 ---------- */
  const consent = $('#consentModal');
  const CONSENT_KEY = 'shanhaipufa.consent.v1';
  function showConsent() { consent.classList.add('show'); }
  function hideConsent(remember) {
    consent.classList.remove('show');
    if (remember) { try { localStorage.setItem(CONSENT_KEY, new Date().toISOString()); } catch (e) {} }
  }
  $('#closeConsent').onclick = () => hideConsent(false);
  $('#consentLater').onclick = () => hideConsent(false);
  $('#consentOk').onclick = () => hideConsent(true);
  consent.onclick = e => { if (e.target === consent) hideConsent(false); };
  try { if (!localStorage.getItem(CONSENT_KEY)) setTimeout(showConsent, 350); } catch (e) { setTimeout(showConsent, 350); }

  /* ---------- 模型设置弹窗 ---------- */
  const modal = $('#settingsModal'), presetSel = $('#cfgPreset');
  presetSel.innerHTML = Object.keys(L.PRESETS).map(k => '<option value="' + k + '">' + esc(L.PRESETS[k].name) + '</option>').join('');
  function openModal() {
    const c = L.load();
    presetSel.value = c.preset || 'deepseek';
    $('#cfgBase').value = c.baseUrl || L.PRESETS[presetSel.value].baseUrl;
    $('#cfgModel').value = c.model || L.PRESETS[presetSel.value].model;
    $('#cfgKey').value = c.apiKey || '';
    modal.classList.add('show');
  }
  presetSel.onchange = () => {
    const p = L.PRESETS[presetSel.value];
    $('#cfgBase').value = p.baseUrl; $('#cfgModel').value = p.model;
  };
  $('#gearBtn').onclick = openModal;
  $('#closeModal').onclick = () => modal.classList.remove('show');
  modal.onclick = e => { if (e.target === modal) modal.classList.remove('show'); };
  $('#cfgSave').onclick = () => {
    const cfg = { preset: presetSel.value, baseUrl: $('#cfgBase').value.trim(), model: $('#cfgModel').value.trim(), apiKey: $('#cfgKey').value.trim() };
    if (cfg.apiKey && cfg.baseUrl && cfg.model) { L.save(cfg); $('#cfgStatus').textContent = '已保存，已切换实时模式。'; $('#cfgStatus').style.color = 'var(--jade)'; }
    else { L.save({}); $('#cfgStatus').textContent = '未填写完整，保持预置模式。'; $('#cfgStatus').style.color = 'var(--warn)'; }
    updateMode();
    setTimeout(() => modal.classList.remove('show'), 900);
  };
  $('#cfgClear').onclick = () => { L.save({}); $('#cfgKey').value = ''; $('#cfgStatus').textContent = '已清除，回到预置模式。'; updateMode(); };

  function updateMode() {
    const live = L.isLive();
    $('#modePill').textContent = live ? '实时模式' : '预置模式';
    $('#topbar').textContent = live
      ? '演示原型 · 已接入实时模型（密钥仅存本地）· 回答仍经法条校验器 · 非实测结论'
      : '演示原型 · 静态预置结果 · 实时生成默认关闭 · 不连接生产 API、不采集真实用户数据';
  }
  updateMode();
})();
