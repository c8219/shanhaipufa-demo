/* =========================================================================
 * modules.js — 山海普法通 · 检索与法条校验核心（浏览器本地，无后端、无密钥）
 * -------------------------------------------------------------------------
 * 本文件是「智能咨询 / 山歌普法」等模块的检索与校验算法核心：
 * 各功能模块单点调用它，跑的是同一份代码、同一套参数。
 * 页面上所有数值均由本文件在本浏览器内实时计算，没有任何写死的"实测结果"。
 *
 * 对应方案：表 4（原型模块完成情况）、表 5（学生自研模块）、表 9（去重三键）
 * 覆盖维度：先进性（自研程度可复现）、实效性（现场实测）、完整性（成果链可核）
 * ========================================================================= */
(function (root) {
  'use strict';

  var DATA = root.DATA || { consult: [] };
  var VERSION = 'v1.0.0-local';

  /* ---------------------------------------------------------------------
   * 模块 1：本地法条索引 + 法条引用校验器
   * 说明：这是最小可用索引（18 条），仅用于演示"无引用不输出 / 幻觉条号拦截"。
   *       正式部署须由执业律师校准为全量现行有效法条库；条号以公开文本为准。
   * ------------------------------------------------------------------- */
  var LAW_INDEX = [
    { name: '民法典', art: '1055', title: '夫妻在婚姻家庭中地位平等' },
    { name: '民法典', art: '1062', title: '夫妻共同财产' },
    { name: '民法典', art: '1087', title: '离婚财产分割' },
    { name: '民法典', art: '667',  title: '借款合同定义' },
    { name: '民法典', art: '288',  title: '相邻关系' },
    { name: '劳动合同法', art: '21', title: '试用期解除劳动合同' },
    { name: '劳动合同法', art: '87', title: '违法解除赔偿金' },
    { name: '劳动争议调解仲裁法', art: '4',  title: '劳动争议协商与调解' },
    { name: '劳动争议调解仲裁法', art: '5',  title: '仲裁与诉讼程序' },
    { name: '劳动争议调解仲裁法', art: '27', title: '仲裁时效一年' },
    { name: '劳动保障监察条例', art: '9', title: '劳动保障监察投诉' },
    { name: '农村土地承包法', art: '27', title: '承包期内发包方不得收回承包地' },
    { name: '土地管理法', art: '14', title: '土地权属争议处理' },
    { name: '消费者权益保护法', art: '25', title: '七日无理由退货' },
    { name: '消费者权益保护法', art: '44', title: '网络交易平台责任' },
    { name: '治安管理处罚法', art: '58', title: '噪声扰民处罚' },
    { name: '反电信网络诈骗法', art: '2', title: '电信网络诈骗定义' },
    { name: '民事诉讼法', art: '67', title: '当事人举证责任' }
  ];

  var LAW_ALIAS = {
    '中华人民共和国民法典': '民法典',
    '中华人民共和国劳动合同法': '劳动合同法',
    '中华人民共和国劳动争议调解仲裁法': '劳动争议调解仲裁法',
    '中华人民共和国农村土地承包法': '农村土地承包法',
    '中华人民共和国土地管理法': '土地管理法',
    '中华人民共和国消费者权益保护法': '消费者权益保护法',
    '中华人民共和国治安管理处罚法': '治安管理处罚法',
    '中华人民共和国反电信网络诈骗法': '反电信网络诈骗法',
    '中华人民共和国民事诉讼法': '民事诉讼法'
  };

  // 条号 -> 合法归属法名，用于识别"张冠李戴"（如《劳动合同法》第1062条）
  var ART_OWNER = {};
  var LAW_ARTS = {};
  LAW_INDEX.forEach(function (x) {
    (LAW_ARTS[x.name] = LAW_ARTS[x.name] || {})[x.art] = x.title;
    (ART_OWNER[x.art] = ART_OWNER[x.art] || []).push(x.name);
  });

  function canonName(n) {
    n = String(n || '').replace(/\s/g, '');
    return LAW_ALIAS[n] || n;
  }

  var CITE_RE = /《([^》]+)》\s*(?:第\s*([0-9０-９、,，\-—~至]+)\s*条)?/g;

  /**
   * 校验一段文本中的法条引用。
   * 返回逐条状态：pass / no_article / unknown_law / unknown_article / name_mismatch
   * 决策：pass=放行；其余一律 block（不输出实体结论，触发重写或转人工）
   */
  function validateCitation(text) {
    var s = String(text || ''), m, cites = [];
    CITE_RE.lastIndex = 0;
    while ((m = CITE_RE.exec(s)) !== null) {
      var name = canonName(m[1]);
      var rawArts = (m[2] || '').replace(/[０-９]/g, function (d) {
        return String.fromCharCode(d.charCodeAt(0) - 0xFEE0);
      });
      var arts = rawArts ? rawArts.split(/[、,，\-—~至]+/).filter(Boolean) : [];
      var status = 'pass', reason = '名称与条号均在本地索引中命中', suggestion = '';

      if (!arts.length) {
        status = 'no_article';
        reason = '只写了法律名称，未写明条号，无法核验';
        suggestion = '补全条号后再输出（无引用不输出）';
      } else if (!LAW_ARTS[name]) {
        status = 'unknown_law';
        reason = '《' + name + '》不在本地法条索引中';
        suggestion = '核对法律名称或扩充法条索引';
      } else {
        for (var i = 0; i < arts.length; i++) {
          var a = arts[i];
          if (LAW_ARTS[name][a]) continue;
          var owners = ART_OWNER[a] || [];
          if (owners.length && owners.indexOf(name) === -1) {
            status = 'name_mismatch';
            reason = '第' + a + '条不属于《' + name + '》，实际归属：' + owners.join('、');
            suggestion = '拦截并重写引用';
          } else {
            status = 'unknown_article';
            reason = '《' + name + '》第' + a + '条在本地索引中不存在（疑似幻觉条号）';
            suggestion = '拦截并重写引用';
          }
          break;
        }
      }
      cites.push({ raw: m[0], name: name, arts: arts, status: status, reason: reason, suggestion: suggestion });
    }
    var bad = cites.filter(function (c) { return c.status !== 'pass'; });
    var ok = cites.length > 0 && bad.length === 0;
    return {
      ok: ok,
      cites: cites,
      blocked: cites.length === 0 || bad.length > 0,
      decision: ok ? 'pass' : 'block',
      summary: cites.length === 0
        ? '未检出任何法条引用 → 按「无引用不输出」拦截'
        : (ok ? '检出 ' + cites.length + ' 条引用，全部通过本地索引核验'
               : '检出 ' + cites.length + ' 条引用，' + bad.length + ' 条未通过 → 拦截并触发重写')
    };
  }

  /* ---------------------------------------------------------------------
   * 模块 2：BM25 + 字符 n-gram 混合检索（附原关键词匹配基线，用于消融复现）
   * ------------------------------------------------------------------- */
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
  }
  function grams(s) {
    var n = norm(s), out = [];
    for (var i = 0; i < n.length; i++) {
      out.push(n[i]);
      if (i < n.length - 1) out.push(n.slice(i, i + 2));
    }
    return out;
  }
  function bigrams(s) {
    var n = norm(s), out = [];
    for (var i = 0; i < n.length - 1; i++) out.push(n.slice(i, i + 2));
    return out;
  }
  function dice(a, b) {
    var A = {}, B = {}, i;
    bigrams(a).forEach(function (g) { A[g] = 1; });
    bigrams(b).forEach(function (g) { B[g] = 1; });
    var ka = Object.keys(A), kb = Object.keys(B), inter = 0;
    for (i = 0; i < ka.length; i++) if (B[ka[i]]) inter++;
    return (ka.length + kb.length) ? (2 * inter / (ka.length + kb.length)) : 0;
  }

  var _idx = null;
  function corpus() {
    return (DATA.consult || []).map(function (it, i) {
      return { id: i, q: it.q, text: it.q + ' ' + (it.kw || []).join(' ') };
    });
  }
  function buildIndex(docs) {
    var tks = docs.map(function (d) { return grams(d.text); });
    var df = {}, N = docs.length, total = 0;
    tks.forEach(function (t) {
      total += t.length;
      var seen = {};
      t.forEach(function (w) { if (!seen[w]) { seen[w] = 1; df[w] = (df[w] || 0) + 1; } });
    });
    var idf = {};
    Object.keys(df).forEach(function (w) {
      idf[w] = Math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5));
    });
    return { N: N, avgdl: total / N, tks: tks, idf: idf };
  }
  function bm25Scores(q, idx) {
    var qf = {};
    grams(q).forEach(function (w) { qf[w] = (qf[w] || 0) + 1; });
    return idx.tks.map(function (t) {
      var tf = {};
      t.forEach(function (w) { tf[w] = (tf[w] || 0) + 1; });
      var s = 0, k1 = 1.5, b = 0.75;
      Object.keys(qf).forEach(function (w) {
        var f = tf[w] || 0;
        if (!f) return;
        var denom = f + k1 * (1 - b + b * t.length / idx.avgdl);
        s += (idx.idf[w] || 0) * (f * (k1 + 1)) / denom;
      });
      return s;
    });
  }
  function norm01(arr) {
    var mx = Math.max.apply(null, arr.concat([0]));
    return arr.map(function (x) { return mx > 0 ? x / mx : 0; });
  }
  // 基线：原 v0.9 demo 的关键词子串匹配（app.js:52 的逻辑原样移植，用于消融对照）
  function keywordBaseline(q, item) {
    var qn = norm(q), score = 0;
    (item.kw || []).forEach(function (k) {
      if (qn.indexOf(norm(k)) !== -1) score += k.length >= 3 ? 3 : 2;
    });
    return score;
  }

  /**
   * @param {string} q 用户问题
   * @param {object} opts { hybrid:boolean, topN:number }
   * hybrid=false 时退化为"仅关键词子串匹配"基线（复现消融实验）
   */
  function retrieve(q, opts) {
    opts = opts || {};
    var hybrid = opts.hybrid !== false;
    var docs = corpus();
    if (!_idx) _idx = buildIndex(docs);
    var bm = norm01(bm25Scores(q, _idx));
    var hits = docs.map(function (d, i) {
      var dc = dice(q, d.text);
      var kw = keywordBaseline(q, DATA.consult[i] || {});
      return {
        id: d.id, q: d.q,
        bm25: +bm[i].toFixed(4),
        ngram: +dc.toFixed(4),
        keyword: kw,
        score: +(hybrid ? (0.55 * bm[i] + 0.45 * dc) : (Math.min(kw / 12, 1))).toFixed(4)
      };
    });
    hits.sort(function (a, b) { return b.score - a.score || b.ngram - a.ngram; });
    return { hybrid: hybrid, hits: hits.slice(0, opts.topN || 3), all: hits };
  }

  /* ---------------------------------------------------------------------
   * 模块 3：山歌三重校验（韵脚 / 字数句式 / 禁忌词）
   * 说明：韵脚判定基于团队自建的常用字韵辙表（演示覆盖 3 个韵部），
   *       表外字一律判"未收录 → 需母语者人工校对"，绝不伪装成通过。
   * ------------------------------------------------------------------- */
  var RHYME = {};
  ['慌', '乡', '伤', '光', '长', '堂', '场', '方', '章', '良', '强', '望', '掌', '账', '仗', '岗'].forEach(function (c) { RHYME[c] = 'ang'; });
  ['心', '人', '亲', '信', '近', '金', '今', '民', '邻', '勤', '真', '身'].forEach(function (c) { RHYME[c] = 'in'; });
  ['书', '楚', '护', '路', '苦', '清', '图', '途', '初', '度', '住', '主'].forEach(function (c) { RHYME[c] = 'u'; });
  var TABOO = ['包赢', '稳赚', '包过', '百分百', '绝对没错', '一定赢', '暴力', '赌博', '打人', '报复', '私了'];

  function songCheck(text) {
    var lines = String(text || '').split(/[\n；;]/).map(function (x) {
      return x.replace(/[，,。！!？?、\s]/g, '');
    }).filter(Boolean);
    var checks = [];

    // ① 句式：四句七言
    var badLen = lines.map(function (l, i) { return { i: i + 1, n: l.length }; }).filter(function (x) { return x.n !== 7; });
    checks.push({
      name: '字数 / 句式',
      ok: lines.length === 4 && badLen.length === 0,
      detail: lines.length + ' 句，' + (badLen.length
        ? '第 ' + badLen.map(function (x) { return x.i + '句(' + x.n + '字)'; }).join('、') + ' 非七言'
        : '每句 7 字，符合四句七言体')
    });

    // ② 韵脚：以首句末字定韵，其余句同韵
    var tails = lines.map(function (l) { return l.charAt(l.length - 1); });
    var target = RHYME[tails[0]] || null;
    var unknown = tails.filter(function (c) { return !RHYME[c]; });
    var off = [];
    if (target) tails.forEach(function (c, i) { if (RHYME[c] && RHYME[c] !== target) off.push(i + 1); });
    checks.push({
      name: '韵脚（自建韵辙表）',
      ok: !!target && off.length === 0 && unknown.length === 0 && tails.length === 4,
      detail: !target ? '首句末字「' + tails[0] + '」未收录于韵辙表 → 需人工校对'
        : (unknown.length ? '末字「' + unknown.join('、') + '」未收录 → 需人工校对'
          : (off.length ? '第 ' + off.join('、') + ' 句出韵（目标 ' + target + ' 韵）'
            : '四句同押 ' + target + ' 韵（' + tails.join('/') + '）'))
    });

    // ③ 禁忌词
    var found = TABOO.filter(function (w) { return String(text).indexOf(w) !== -1; });
    checks.push({
      name: '禁忌词 / 绝对化表述',
      ok: found.length === 0,
      detail: found.length ? '命中：' + found.join('、') + ' → 拦截' : '未命中禁忌词与绝对化承诺'
    });

    var fail = checks.filter(function (c) { return !c.ok; });
    return { pass: fail.length === 0, checks: checks, failCount: fail.length, tails: tails, target: target };
  }

  /* ---------------------------------------------------------------------
   * 模块 4：跨渠道去重（表 9 三键：匿名 ID + 30 分钟时间窗 + 主题指纹）
   * ------------------------------------------------------------------- */
  function fingerprint(ev) {
    return retrieve(ev.q, { hybrid: true, topN: 1 }).hits[0].id;
  }
  function dedupe(events, windowMin) {
    windowMin = windowMin || 30;
    var seen = {}, kept = [], removed = [];
    events.forEach(function (ev) {
      var topic = fingerprint(ev.q);
      var key = ev.uid + '|' + topic + '|' + Math.floor(ev.minute / windowMin);
      var rec = { uid: ev.uid, channel: ev.channel, minute: ev.minute, q: ev.q, topic: topic, key: key };
      if (seen[key]) removed.push(rec);
      else { seen[key] = 1; kept.push(rec); }
    });
    return { kept: kept, removed: removed, total: events.length, unique: kept.length, duplicateRate: +(removed.length / events.length).toFixed(4) };
  }

  /* ---------------------------------------------------------------------
   * 模块 5：完整推理链（检索 → 校验 → 置信度 → 转人工）
   * 推理链逐条调用的就是这个函数；各功能模块调用的也是它拆出来的每个子模块。
   * ------------------------------------------------------------------- */
  // 安全策略：只拦截"正在发生的紧迫危险"。注意：「能不能报警」属于正常咨询，
  // 不应被误判为紧急事件（v1.0.0 曾因包含「报警」二字误伤，此处已修正）。
  var RISK_RE = /人身安全|人身威胁|威胁|恐吓|打我|要杀|自残|轻生|110|急救|生命危险|被跟踪|放话要伤害/;
  // 低置信闸门：字符 n-gram 绝对相似度 < 0.04 且未命中任何领域关键词时，
  // 认为问题落在知识库范围外 → 不输出实体结论，转人工。
  // 两种检索模式共用同一闸门，保证消融对照公平。
  var GATE_NGRAM = 0.04, GATE_KEYWORD = 3;

  function pipeline(q, opts) {
    opts = opts || {};
    var t0 = (root.performance && root.performance.now) ? root.performance.now() : Date.now();
    var r = retrieve(q, opts);
    var top = r.hits[0];
    var trace = [{
      step: '混合检索',
      detail: (r.hybrid ? 'BM25 + 字符 n-gram 融合' : '仅关键词匹配（消融基线）') +
        '，Top1 = #' + (top ? top.id : '-') + '（score ' + (top ? top.score : 0) + '）'
    }];

    if (RISK_RE.test(q)) {
      trace.push({ step: '安全策略', detail: '命中紧迫/高风险词 → 中断实体结论生成，转 110 / 12348 人工' });
      return finish({ abstain: true, reason: 'risk', hits: r.hits, trace: trace });
    }
    var gatePass = top && (top.ngram >= GATE_NGRAM || top.keyword >= GATE_KEYWORD);
    if (!gatePass) {
      trace.push({
        step: '低置信闸门',
        detail: 'Top1 字符 n-gram 相似度 ' + (top ? top.ngram : 0) + '、领域关键词命中 ' +
          (top ? top.keyword : 0) + ' → 未达闸门（ngram≥' + GATE_NGRAM + ' 或 kw≥' +
          GATE_KEYWORD + '），判定范围外，不输出实体结论'
      });
      return finish({ abstain: true, reason: 'lowconf', hits: r.hits, trace: trace });
    }

    var item = (DATA.consult || [])[top.id] || {};
    if (item.human) {
      trace.push({ step: '安全策略', detail: '预置条目标记为转人工 → 仅输出求助渠道' });
      return finish({ abstain: true, reason: 'risk', hits: r.hits, trace: trace });
    }
    var v = validateCitation((item.cites || []).join(' '));
    trace.push({ step: '法条校验器', detail: v.summary });
    if (v.blocked) trace.push({ step: '输出闸门', detail: '拦截：无有效引用不输出，触发重写' });

    var conf = !v.ok ? 'low' : (top.score >= 0.45 && item.conf === 'high' ? 'high' : 'mid');
    trace.push({ step: '置信度分级', detail: '综合检索得分与法条校验结果 → ' + conf });

    return finish({
      abstain: false, blocked: v.blocked, conf: conf,
      answer: item.a || '', cites: item.cites || [], validation: v,
      gold: top.id, hits: r.hits, trace: trace
    });

    function finish(o) {
      var t1 = (root.performance && root.performance.now) ? root.performance.now() : Date.now();
      o.ms = +(t1 - t0).toFixed(3);
      o.query = q;
      o.hybrid = r.hybrid;
      return o;
    }
  }

  /* ---------------------------------------------------------------------
   * 统计工具：Cohen's Kappa（双人标注一致性）
   * ------------------------------------------------------------------- */
  function cohenKappa(pairs) {
    var labels = {}, n = pairs.length, agree = 0;
    pairs.forEach(function (p) {
      labels[p[0]] = 1; labels[p[1]] = 1;
      if (String(p[0]) === String(p[1])) agree++;
    });
    var keys = Object.keys(labels), a = {}, b = {};
    pairs.forEach(function (p) {
      a[p[0]] = (a[p[0]] || 0) + 1;
      b[p[1]] = (b[p[1]] || 0) + 1;
    });
    var pe = 0;
    keys.forEach(function (k) { pe += ((a[k] || 0) / n) * ((b[k] || 0) / n); });
    var po = agree / n;
    return { po: +po.toFixed(4), pe: +pe.toFixed(4), kappa: pe === 1 ? 1 : +((po - pe) / (1 - pe)).toFixed(4), agree: agree, n: n, categories: keys.length };
  }

  root.SH = {
    VERSION: VERSION,
    LAW_INDEX: LAW_INDEX,
    RHYME: RHYME,
    TABOO: TABOO,
    GATE_NGRAM: GATE_NGRAM,
    GATE_KEYWORD: GATE_KEYWORD,
    validateCitation: validateCitation,
    retrieve: retrieve,
    songCheck: songCheck,
    dedupe: dedupe,
    pipeline: pipeline,
    cohenKappa: cohenKappa,
    norm: norm
  };
})(typeof window !== 'undefined' ? window : globalThis);
