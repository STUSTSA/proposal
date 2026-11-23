
// 企劃書範本填寫引擎：把資料直接寫進學校原始 .docx 範本（瀏覽器與 Node 共用）
// 用法：fillProposal(JSZip, templateBuffer, data, { DOMParser, XMLSerializer }) -> Promise<Uint8Array>
(function (root) {
  var WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var INK = '221F1F', RED = 'FF0000';
  var AFTER_COLOR = ['w:spacing', 'w:w', 'w:kern', 'w:position', 'w:sz', 'w:szCs', 'w:highlight', 'w:u', 'w:effect', 'w:bdr', 'w:shd', 'w:fitText', 'w:vertAlign', 'w:rtl', 'w:cs', 'w:em', 'w:lang', 'w:eastAsianLayout', 'w:specVanish', 'w:oMath'];

  function fillProposal(JSZip, templateBuf, data, env) {
    var prog = env.onProgress || function () {};
    var pause = function () { return new Promise(function (r) { setTimeout(r, env.delay || 0); }); };
    var zip;
    prog('template');
    return pause().then(function () { return JSZip.loadAsync(templateBuf); }).then(function (z) {
      zip = z;
      return Promise.all([zip.file('word/document.xml').async('string'), zip.file('word/_rels/document.xml.rels').async('string')]);
    }).then(function (parts) {
      var xml = parts[0], relsXml = parts[1];
      prog('fill');
      return pause().then(function () {
        var doc = new env.DOMParser().parseFromString(xml, 'text/xml');
        var rels = new env.DOMParser().parseFromString(relsXml, 'text/xml');
        var imgN = 0;
        // 把使用者圖片放進 word/media，回傳關聯 id
        var ctx = {
          env: env,
          addImage: function (dataUrl) {
            var m = /^data:image\/(png|jpeg);base64,(.*)$/.exec(dataUrl || '');
            if (!m) return null;
            var ext = m[1] === 'jpeg' ? 'jpeg' : 'png';
            var raw = (typeof atob === 'function' ? atob : function (b) { return Buffer.from(b, 'base64').toString('binary'); })(m[2]);
            var bytes = new Uint8Array(raw.length);
            for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
            imgN += 1;
            var name = 'proposal_img' + imgN + '.' + ext, id = 'rIdProposal' + imgN;
            zip.file('word/media/' + name, bytes);
            var r = rels.createElementNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship');
            r.setAttribute('Id', id);
            r.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
            r.setAttribute('Target', 'media/' + name);
            rels.documentElement.appendChild(r);
            ctx.usedJpeg = ctx.usedJpeg || ext === 'jpeg';
            return id;
          }
        };
        fillDocument(doc, data, ctx);
        zip.file('word/document.xml', new env.XMLSerializer().serializeToString(doc));
        zip.file('word/_rels/document.xml.rels', new env.XMLSerializer().serializeToString(rels));
        env.__usedJpeg = ctx.usedJpeg;
        // 夾帶原始資料，之後匯入可以完整還原（Word 另存後若被移除，改用內文解析）
        zip.file('proposal/data.json', JSON.stringify({ v: 1, data: data }));
        return zip.file('[Content_Types].xml').async('string');
      });
    }).then(function (ct) {
      if (ct.indexOf('Extension="json"') < 0) ct = ct.replace('<Default ', '<Default Extension="json" ContentType="application/json"/><Default ');
      if (env.__usedJpeg && ct.indexOf('Extension="jpeg"') < 0) ct = ct.replace('<Default ', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default ');
      zip.file('[Content_Types].xml', ct);
      prog('pack');
      return pause();
    }).then(function () {
      return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    });
  }

  // ---------- 匯入：從本工具匯出的 .docx 還原資料 ----------
  function parseProposal(JSZip, buf, env) {
    return JSZip.loadAsync(buf).then(function (zip) {
      var j = zip.file('proposal/data.json');
      var docP = zip.file('word/document.xml').async('string');
      return Promise.all([j ? j.async('string') : Promise.resolve(null), docP]).then(function (r) {
        var doc = new env.DOMParser().parseFromString(r[1], 'text/xml');
        var parsed = parseDocument(doc);
        if (r[0]) {
          try {
            var saved = JSON.parse(r[0]).data;
            // 以內文為準（使用者可能在 Word 裡改過），內文解析不到的才用夾帶資料補
            return { data: mergeData(saved, parsed), source: 'embedded+text' };
          } catch (e) { /* fallthrough */ }
        }
        return { data: parsed, source: 'text' };
      });
    });
  }

  function mergeData(saved, parsed) {
    var f = Object.assign({}, saved.f || {});
    Object.keys(parsed.f).forEach(function (k) { if (parsed.f[k]) f[k] = parsed.f[k]; });
    return {
      f: f,
      staff: parsed.staff.length ? parsed.staff : (saved.staff || []),
      flow: parsed.flow.length ? parsed.flow : (saved.flow || []),
      budget: parsed.budget.length ? parsed.budget : (saved.budget || []),
      checks: parsed.checks.some(function (c) { return c; }) ? parsed.checks : (saved.checks || []),
      images: saved.images || {}
    };
  }

  function parseDocument(doc) {
    function kids(el, name) { var a = []; for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeName === name) a.push(n); return a; }
    function textOf(el) {
      var s = '', walk = function (n) {
        for (var c = n.firstChild; c; c = c.nextSibling) {
          if (c.nodeName === 'w:t') s += c.textContent;
          else if (c.nodeName === 'w:br' || c.nodeName === 'w:cr') s += '\n';
          else if (c.nodeName === 'w:tab') s += '\t';
          else if (c.nodeName !== 'mc:AlternateContent' && c.nodeName !== 'w:drawing') walk(c);
        }
      };
      walk(el); return s;
    }
    function clean(v, keepDot) { v = (v || '').trim(); if (!keepDot) v = v.replace(/。$/, ''); return /^[○\s]*$/.test(v) || /^○+(社|老師|活動)?$/.test(v) || v.indexOf('請簡略說明') === 0 || v.indexOf('請說明預計') === 0 ? '' : v; }
    var body = doc.getElementsByTagName('w:body')[0];
    var paras = kids(body, 'w:p').map(textOf), tbls = kids(body, 'w:tbl');
    function after(label, nth) {
      var hits = paras.filter(function (t) { return t.replace(/^\s+/, '').indexOf(label) === 0; });
      var t = hits[nth || 0]; if (t == null) return '';
      return t.replace(/^\s+/, '').slice(label.length);
    }
    var f = {};
    var m;
    var y = paras.filter(function (t) { return /^南臺科技大學.+學年度/.test(t); })[0] || '';
    if ((m = y.match(/南臺科技大學(\d+)學年度(.+)$/))) { f.year = m[1]; f.term = m[2].trim(); }
    var tl = paras.filter(function (t) { return t.indexOf('活動企劃書') >= 0 && t.indexOf('辦理') >= 0; })[0] || '';
    if ((m = tl.match(/^(.*)辦理「(.*)」活動企劃書/))) { f.org = clean(m[1]); f.type = clean(m[2]); }
    if ((m = after('活動名稱：').match(/『(.*)』/))) f.name = clean(m[1]);
    var hdr = tbls[0] ? textOf(tbls[0]) : '';
    if ((m = hdr.match(/活動負責人\s*(.*?)\s*\/\s*電話\s*(.*)$/m))) { f.leader = clean(m[1]); f.phone = clean(m[2]); }
    f.guide = clean(after('指導單位：', 1)) || clean(after('指導單位：', 0));
    var co = clean(after('協辦單位：', 1)); f.coOrg = co === '無' ? '' : co;
    f.advisor = clean(after('指導/帶隊老師：'));
    var ppl = after('活動對象與人數：');
    if ((m = ppl.match(/對象為(.+?)，/))) f.target = m[1];
    if ((m = ppl.match(/工作人員(\d+)人/))) f.staffCount = m[1];
    if ((m = ppl.match(/預計參與(\d+)人/))) f.participants = m[1];
    var tm = after('活動時間：', 1);
    if ((m = tm.match(/(\d+)年(\d+)月(\d+)日(\d+)時(\d+)分至(\d+)時(\d+)分/))) {
      var p2 = function (n) { return ('0' + n).slice(-2); };
      f.date = (Number(m[1]) + 1911) + '-' + p2(m[2]) + '-' + p2(m[3]);
      f.start = p2(m[4]) + ':' + p2(m[5]); f.end = p2(m[6]) + ':' + p2(m[7]);
    }
    f.place = clean(after('活動地點：', 1));
    var fee = after('有無收費：');
    if (fee.indexOf('有收費') === 0) { f.fee = '有收費'; f.feeNote = fee.replace(/^有收費，?/, '').replace(/（詳見預計收支明細表）。?$/, ''); } else f.fee = '無收費';
    f.purpose = clean(after('活動主旨：'), true);
    f.method = clean(after('實施方式與內容：'), true);
    f.benefit = clean(after('預期效益：'), true);
    var ex = paras.filter(function (t) { return t.indexOf('(四)') === 0; })[0];
    f.extraNotes = ex ? ex.slice(3) : '';

    function rowsOf(t) { return t ? kids(t, 'w:tr').map(function (tr) { return kids(tr, 'w:tc').map(function (tc) { return kids(tc, 'w:p').map(textOf); }); }) : []; }
    var staff = rowsOf(tbls[1]).slice(1).map(function (c) { return { title: c[0].join(''), name: c[1].join(''), sid: c[2].join(''), job: c[3].join(''), note: c[4].join('') }; })
      .filter(function (r) { return r.title || r.name || r.sid || r.job || r.note; });
    var flow = rowsOf(tbls[2]).slice(1).map(function (c) { return { date: c[0].join(''), time: c[1].join(''), content: c[2].join(''), place: c[3].join(''), note: c[4].join('') }; })
      .filter(function (r) { return r.date || r.time || r.content || r.place || r.note; });
    var budget = [];
    rowsOf(tbls[3]).forEach(function (c) {
      if (c.length < 6 || !/^\d+$/.test(c[0].join('').trim())) return;
      var qtyRaw = c[3].join('').trim(), qm = qtyRaw.match(/^([\d.]+)\s*(.*)$/);
      var noteLines = c[5].filter(function (x) { return x.trim(); });
      var src = (noteLines[0] || '').match(/【(.+?)】/);
      var note = noteLines.slice(src ? 1 : 0).join('\n').replace(/[\d,]+元\*[\d.]+.*?=[\d,]+元$/, '').trim();
      budget.push({ item: c[1].join('').trim(), price: c[2].join('').replace(/[^\d.]/g, ''), qty: qm ? qm[1] : '', unit: qm ? qm[2] : qtyRaw,
        source: src && src[1] === '學輔支應' ? '學輔支應' : '社團自籌', note: note });
    });
    var checks = [];
    var cr = rowsOf(tbls[4])[1];
    if (cr && cr[2]) cr[2].forEach(function (t) {
      var mm = t.match(/(是|否|無須借用|無須申請|無須提供)(?:\(請於下方說明\))?\s*[■☑☒✓✔]/);
      checks.push(mm ? mm[1] : null);
    });
    var noteRow = rowsOf(tbls[4])[2];
    f.checkNote = noteRow ? noteRow[1].filter(function (t) { return t.trim() && t.indexOf('簽章') < 0; }).join('\n') : '';
    Object.keys(f).forEach(function (k) { if (f[k] == null) f[k] = ''; });
    return { f: f, staff: staff, flow: flow, budget: budget, checks: checks };
  }

  function fillDocument(doc, data, ctx) {
    var f = data.f;
    // ---------- DOM helpers ----------
    function kids(el, name) { var a = []; for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeName === name) a.push(n); return a; }
    function textOf(el) { var ts = el.getElementsByTagName('w:t'), s = ''; for (var i = 0; i < ts.length; i++) s += ts[i].textContent; return s; }
    function isSpecial(r) { return r.getElementsByTagName('w:drawing').length || r.getElementsByTagName('w:pict').length || r.getElementsByTagName('mc:AlternateContent').length; }
    function el(name) { return doc.createElementNS(WNS, name); }
    function setColor(r, color) {
      if (!color) return;
      var rPr = kids(r, 'w:rPr')[0];
      if (!rPr) { rPr = el('w:rPr'); r.insertBefore(rPr, r.firstChild); }
      var c = kids(rPr, 'w:color')[0];
      if (!c) {
        c = el('w:color');
        var before = null;
        for (var n = rPr.firstChild; n && !before; n = n.nextSibling) if (AFTER_COLOR.indexOf(n.nodeName) >= 0) before = n;
        rPr.insertBefore(c, before);
      }
      c.setAttribute('w:val', color);
      var th = ['w:themeColor', 'w:themeShade', 'w:themeTint'];
      th.forEach(function (a) { if (c.hasAttribute(a)) c.removeAttribute(a); });
    }
    function makeRun(tpl, text, color) {
      var r = tpl ? tpl.cloneNode(true) : el('w:r');
      for (var n = r.firstChild; n;) { var nx = n.nextSibling; if (n.nodeName !== 'w:rPr') r.removeChild(n); n = nx; }
      String(text).split('\n').forEach(function (line, i) {
        if (i) r.appendChild(el('w:br'));
        var t = el('w:t'); t.setAttribute('xml:space', 'preserve'); t.appendChild(doc.createTextNode(line)); r.appendChild(t);
      });
      setColor(r, color);
      return r;
    }
    function runsOf(p) { return kids(p, 'w:r'); }
    function firstTextRun(p) { var rs = runsOf(p); for (var i = 0; i < rs.length; i++) if (!isSpecial(rs[i])) return rs[i]; return null; }
    function runTplFromPPr(p) {
      var pPr = kids(p, 'w:pPr')[0], rPr = pPr && kids(pPr, 'w:rPr')[0];
      var r = el('w:r'); if (rPr) r.appendChild(rPr.cloneNode(true)); return r;
    }
    // 整段換成一段文字（保留圖片/文字方塊）
    function setParaText(p, text, color) {
      var tpl = firstTextRun(p) || runTplFromPPr(p);
      tpl = tpl.cloneNode(true);
      runsOf(p).forEach(function (r) { if (!isSpecial(r)) p.removeChild(r); });
      if (text !== '' && text != null) p.appendChild(makeRun(tpl, text, color));
    }
    // 保留「標籤：」那幾個 run，後面換成值
    function setAfterLabel(p, label, text, color) {
      var rs = runsOf(p), acc = '', k = -1;
      for (var i = 0; i < rs.length; i++) {
        acc += textOf(rs[i]);
        if (acc.replace(/\s/g, '').length >= label.length && acc.indexOf(label) >= 0) { k = i; break; }
      }
      if (k < 0) throw new Error('找不到標籤：' + label);
      var rest = rs.slice(k + 1).filter(function (r) { return !isSpecial(r); });
      var tpl = rest[0] || rs[k];
      tpl = tpl.cloneNode(true);
      if (!rest.length) { var rPr = kids(tpl, 'w:rPr')[0]; if (rPr) ['w:b', 'w:bCs'].forEach(function (b) { kids(rPr, b).forEach(function (x) { rPr.removeChild(x); }); }); }
      rest.forEach(function (r) { p.removeChild(r); });
      var newRun = makeRun(tpl, text, color);
      var anchor = rs[k].nextSibling;
      p.insertBefore(newRun, anchor);
    }
    function setCell(tc, text, color) {
      var ps = kids(tc, 'w:p');
      ps.slice(1).forEach(function (p) { tc.removeChild(p); });
      setParaText(ps[0], text == null ? '' : text, color || INK);
    }
    function val(v, fb) { return v ? { t: String(v), c: INK } : { t: fb, c: RED }; }

    // ---------- 定位 ----------
    var body = doc.getElementsByTagName('w:body')[0];
    var paras = kids(body, 'w:p');
    var tbls = kids(body, 'w:tbl');
    function findParas(label) { return paras.filter(function (p) { return textOf(p).replace(/^\s+/, '').indexOf(label) === 0; }); }
    function pAt(label, nth) { var a = findParas(label); if (!a[nth || 0]) throw new Error('找不到段落：' + label); return a[nth || 0]; }

    // 只含換頁的空段落 → 改成下一段「段前分頁」，避免內容剛好滿頁時多出空白頁
    paras.forEach(function (p) {
      var brs = p.getElementsByTagName('w:br'), onlyBreak = brs.length === 1 && brs[0].getAttribute('w:type') === 'page' && textOf(p) === '';
      var next = p.nextSibling; while (next && next.nodeType !== 1) next = next.nextSibling;
      if (!onlyBreak || !next || next.nodeName !== 'w:p') return;
      var pPr = kids(next, 'w:pPr')[0];
      if (!pPr) { pPr = el('w:pPr'); next.insertBefore(pPr, next.firstChild); }
      if (!kids(pPr, 'w:pageBreakBefore').length) {
        var before = null;
        for (var n = pPr.firstChild; n && !before; n = n.nextSibling) if (n.nodeType === 1 && ['w:pStyle', 'w:keepNext', 'w:keepLines'].indexOf(n.nodeName) < 0) before = n;
        pPr.insertBefore(el('w:pageBreakBefore'), before);
      }
      p.parentNode.removeChild(p);
    });
    paras = kids(body, 'w:p');

    // ---------- 計算 ----------
    function roc(d) { if (!d) return '○○年○月○日'; var p = d.split('-'); return (Number(p[0]) - 1911) + '年' + Number(p[1]) + '月' + Number(p[2]) + '日'; }
    function hm(t) { if (!t) return '○○時○○分'; var p = t.split(':'); return p[0] + '時' + p[1] + '分'; }
    function money(n) { return Number(n || 0).toLocaleString('en-US'); }
    var time = { t: roc(f.date) + hm(f.start) + '至' + hm(f.end), c: (f.date && f.start && f.end) ? INK : RED };
    var sc = Number(f.staffCount || 0), pc = Number(f.participants || 0);
    var org = val(f.org, '○○社'), name = val(f.name, '○○活動'), type = val(f.type, '○○'), place = val(f.place, '○○');
    var coOrg = { t: f.coOrg || '無', c: INK };

    // ---------- 封面 ----------
    var hdrRow = kids(tbls[0], 'w:tr')[1];
    var hdrCell = kids(hdrRow, 'w:tc')[1];
    setParaText(kids(hdrCell, 'w:p')[0], '活動負責人 ' + (f.leader || '○○') + ' / 電話' + (f.phone || '○○'));

    setParaText(pAt('南臺科技大學'), '南臺科技大學' + (f.year || '○○○') + '學年度' + (f.term || '第一學期'), INK);
    var titleP = findParas('').filter(function (p) { return textOf(p).indexOf('活動企劃書') >= 0; })[0];
    setParaText(titleP, org.t + '辦理「' + type.t + '」活動企劃書', f.org && f.type ? INK : RED);
    setParaText(pAt('活動名稱：'), '活動名稱：『' + name.t + '』', name.c);

    setAfterLabel(pAt('指導單位：', 0), '指導單位：', f.guide || '學務處課外活動組', INK);
    setAfterLabel(pAt('主辦單位', 0), '主辦單位：', org.t, org.c);
    setAfterLabel(pAt('協辦單位：', 0), '協辦單位：', coOrg.t, coOrg.c);
    setAfterLabel(pAt('活動時間：', 0), '活動時間：', time.t, time.c);
    setAfterLabel(pAt('活動地點：', 0), '活動地點：', place.t, place.c);

    // ---------- 內文 ----------
    var purpose = val(f.purpose, '請簡略說明辦理此活動之主要目的。');
    setAfterLabel(pAt('活動主旨：'), '活動主旨：', purpose.t, purpose.c);
    setAfterLabel(pAt('指導單位：', 1), '指導單位：', (f.guide || '學務處課外活動組') + '。', INK);
    setAfterLabel(pAt('主辦單位：', 1), '主辦單位：', org.t + '。', org.c);
    setAfterLabel(pAt('協辦單位：', 1), '協辦單位：', coOrg.t + '。', coOrg.c);
    var adv = val(f.advisor, '○○老師');
    setAfterLabel(pAt('指導/帶隊老師：'), '指導/帶隊老師：', adv.t + '。', adv.c);
    setAfterLabel(pAt('活動對象與人數：'), '活動對象與人數：',
      (f.target ? '對象為' + f.target + '，' : '') + '工作人員' + (f.staffCount || '○○') + '人，預計參與' + (f.participants || '○○') + '人，合計' + (sc + pc) + '人。',
      f.staffCount && f.participants ? INK : RED);
    setAfterLabel(pAt('活動時間：', 1), '活動時間：', time.t + '。', time.c);
    setAfterLabel(pAt('活動地點：', 1), '活動地點：', place.t + '。', place.c);
    setAfterLabel(pAt('有無收費：'), '有無收費：', f.fee === '有收費' ? '有收費，' + (f.feeNote || '') + '（詳見預計收支明細表）' : '無收費。', INK);
    var method = val(f.method, '請簡略說明活動進行方式、競賽規定、辦理內容等。');
    setAfterLabel(pAt('實施方式與內容：'), '實施方式與內容：', method.t, method.c);
    var benefit = val(f.benefit, '請說明預計達成之質量化目標。');
    setAfterLabel(pAt('預期效益：'), '預期效益：', benefit.t, benefit.c);
    if (f.extraNotes) {
      var p3 = pAt('(三)活動中請隨時注意');
      var p4 = p3.cloneNode(true);
      setParaText(p4, '(四)' + f.extraNotes, INK);
      p3.parentNode.insertBefore(p4, p3.nextSibling);
    }

    // ---------- 附件一：人員配置 ----------
    (function () {
      var t = tbls[1], rows = kids(t, 'w:tr'), proto = rows[1];
      rows.slice(1).forEach(function (r) { t.removeChild(r); });
      var list = data.staff.length ? data.staff : [{ title: '', name: '', sid: '', job: '', note: '' }];
      list.forEach(function (s) {
        var r = proto.cloneNode(true), cs = kids(r, 'w:tc');
        [s.title, s.name, s.sid, s.job, s.note].forEach(function (v, i) { setCell(cs[i], v || ''); });
        t.appendChild(r);
      });
    })();

    // ---------- 附件二：活動流程 ----------
    (function () {
      var t = tbls[2], rows = kids(t, 'w:tr'), proto = rows[1];
      rows.slice(1).forEach(function (r) { t.removeChild(r); });
      var list = data.flow.filter(function (r) { return r.date || r.time || r.content || r.place || r.note; });
      while (list.length < 8) list.push({});
      list.forEach(function (s) {
        var r = proto.cloneNode(true), cs = kids(r, 'w:tc');
        [s.date, s.time, s.content, s.place, s.note].forEach(function (v, i) { setCell(cs[i], v || ''); });
        t.appendChild(r);
      });
    })();

    // ---------- 附件三：經費 ----------
    (function () {
      var t = tbls[3], rows = kids(t, 'w:tr');
      var titleCell = kids(rows[0], 'w:tc')[0];
      setCell(titleCell, name.t + '  經費預算表', name.c);
      var proto = rows[2], totalRow = rows[rows.length - 2], srcRow = rows[rows.length - 1];
      rows.slice(2, rows.length - 2).forEach(function (r) { t.removeChild(r); });
      var total = 0, sub = 0, self = 0, subIdx = [], selfIdx = [];
      var items = data.budget.filter(function (b) { return b.item || b.price; });
      items.forEach(function (b, i) {
        var amt = Number(b.price || 0) * Number(b.qty || 0), idx = i + 1, unit = b.unit || '';
        total += amt;
        if (b.source === '學輔支應') { sub += amt; subIdx.push(idx); } else { self += amt; selfIdx.push(idx); }
        var r = proto.cloneNode(true), cs = kids(r, 'w:tc');
        setCell(cs[0], String(idx)); setCell(cs[1], b.item); setCell(cs[2], money(b.price));
        setCell(cs[3], (b.qty || '') + unit); setCell(cs[4], money(amt));
        var ps = kids(cs[5], 'w:p');
        ps.slice(2).forEach(function (p) { cs[5].removeChild(p); });
        setParaText(ps[0], '【' + b.source + '】', INK);
        setParaText(ps[1], (b.note || b.item) + money(b.price) + '元*' + (b.qty || 0) + unit + '=' + money(amt) + '元', INK);
        t.insertBefore(r, totalRow);
      });
      function span(a) { if (!a.length) return ''; var c = a[a.length - 1] - a[0] === a.length - 1; return '(項次' + (c && a.length > 1 ? a[0] + '-' + a[a.length - 1] : a.join('、')) + ') '; }
      setCell(kids(totalRow, 'w:tc')[1], money(total) + '元');
      var sps = kids(kids(srcRow, 'w:tc')[1], 'w:p');
      setParaText(sps[0], '學輔支應：' + span(subIdx) + money(sub) + '元', INK);
      setParaText(sps[1], '社團自籌：' + span(selfIdx) + money(self) + '元', INK);
    })();

    // ---------- 注意事項：勾選 ----------
    (function () {
      var t = tbls[4], rows = kids(t, 'w:tr');
      var ansPs = kids(kids(rows[1], 'w:tc')[2], 'w:p');
      (data.checks || []).forEach(function (ans, i) {
        if (!ans || !ansPs[i]) return;
        var ts = ansPs[i].getElementsByTagName('w:t');
        for (var j = 0; j < ts.length; j++) {
          var s = ts[j].textContent;
          var re = new RegExp('(^|\\s)' + ans + '□');
          if (re.test(s)) { ts[j].textContent = s.replace(re, '$1' + ans + '■'); break; }
        }
      });
      if (data.f.checkNote) {
        var noteCell = kids(rows[2], 'w:tc')[1];
        var p0 = kids(noteCell, 'w:p')[0];
        var np = el('w:p');
        var pPr = kids(p0, 'w:pPr')[0]; if (pPr) np.appendChild(pPr.cloneNode(true));
        var rs = runsOf(p0), tpl = rs[rs.length - 1];
        np.appendChild(makeRun(tpl, data.f.checkNote, INK));
        noteCell.insertBefore(np, p0);
      }
    })();

    // ---------- 圖片：封面圖、導師簽名、總召簽名 ----------
    (function () {
      var imgs = data.images || {};
      if (!ctx || !ctx.addImage) return;
      var NS = 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
      var docPrId = 9100;
      function fit(im, maxW, maxH) {
        var w = im.w || 1, h = im.h || 1, k = Math.min(maxW / w, maxH / h);
        return { cx: Math.round(w * k), cy: Math.round(h * k) };
      }
      function picXml(rid, cx, cy, name) {
        docPrId += 1;
        return '<a:graphic ' + NS + '><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="' + docPrId + '" name="' + name + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
          '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
          '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>';
      }
      function frag(xmlStr) {
        var d = new ctx.env.DOMParser().parseFromString('<w:r xmlns:w="' + WNS + '" ' + NS + '><w:rPr><w:noProof/></w:rPr><w:drawing>' + xmlStr + '</w:drawing></w:r>', 'text/xml');
        return doc.importNode(d.documentElement, true);
      }
      function inlineRun(rid, cx, cy, name) {
        return frag('<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="' + (docPrId + 1) + '" name="' + name + '"/><wp:cNvGraphicFramePr><a:graphicFrameLocks ' + NS + ' noChangeAspect="1"/></wp:cNvGraphicFramePr>' + picXml(rid, cx, cy, name) + '</wp:inline>');
      }
      function anchorRun(rid, cx, cy, x, y, name) {
        return frag('<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251670000" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/>' +
          '<wp:positionH relativeFrom="column"><wp:posOffset>' + x + '</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>' + y + '</wp:posOffset></wp:positionV>' +
          '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="' + (docPrId + 1) + '" name="' + name + '"/><wp:cNvGraphicFramePr><a:graphicFrameLocks ' + NS + ' noChangeAspect="1"/></wp:cNvGraphicFramePr>' + picXml(rid, cx, cy, name) + '</wp:anchor>');
      }
      var EMU_CM = 360000;

      // 封面圖：換掉範本裡旋轉的裝飾圖，置中、等比縮放（最大 14 × 10 公分）
      if (imgs.cover && imgs.cover.src) {
        var rid = ctx.addImage(imgs.cover.src);
        var anchors = doc.getElementsByTagName('wp:anchor'), target = null;
        for (var i = 0; i < anchors.length && !target; i++) if (anchors[i].getElementsByTagName('pic:pic').length) target = anchors[i];
        if (rid && target) {
          var sz = fit(imgs.cover, 14 * EMU_CM, 10 * EMU_CM);
          var colW = (11906 - 851 * 2) * 635, centerY = 413884 + Math.round(3292947 / 2) + 905000;   // 封面圖中心：標題與下方單位資料之間的正中間
          var setTxt = function (parent, tag, val) { var e = parent.getElementsByTagName(tag)[0]; if (e) e.textContent = String(val); };
          setTxt(kids(target, 'wp:positionH')[0], 'wp:posOffset', Math.round((colW - sz.cx) / 2));
          setTxt(kids(target, 'wp:positionV')[0], 'wp:posOffset', Math.round(centerY - sz.cy / 2));
          var ext = kids(target, 'wp:extent')[0]; ext.setAttribute('cx', sz.cx); ext.setAttribute('cy', sz.cy);
          var ee = kids(target, 'wp:effectExtent')[0]; if (ee) ['l', 't', 'r', 'b'].forEach(function (k) { ee.setAttribute(k, '0'); });
          var xf = target.getElementsByTagName('a:xfrm')[0];
          if (xf) { xf.removeAttribute('rot'); var aext = xf.getElementsByTagName('a:ext')[0]; aext.setAttribute('cx', sz.cx); aext.setAttribute('cy', sz.cy); }
          target.getElementsByTagName('a:blip')[0].setAttribute('r:embed', rid);
        }
      }

      // 導師簽名：封面「指導老師簽章：」後面（高約 1.3 公分）
      if (imgs.advisorSign && imgs.advisorSign.src) {
        var rid2 = ctx.addImage(imgs.advisorSign.src);
        var ps = paras.filter(function (p) { return textOf(p).replace(/\s/g, '').indexOf('指導老師簽章') === 0; });
        if (rid2 && ps[0]) {
          var s2 = fit(imgs.advisorSign, 6 * EMU_CM, 1.3 * EMU_CM);
          ps[0].appendChild(inlineRun(rid2, s2.cx, s2.cy, '指導老師簽名'));
        }
      }

      // 總召簽名：注意事項表「負責人(總召)簽章：」文字方塊右邊
      if (imgs.leaderSign && imgs.leaderSign.src) {
        var rid3 = ctx.addImage(imgs.leaderSign.src);
        var rows = kids(tbls[4], 'w:tr'), cell = kids(rows[2], 'w:tc')[1];
        var host = null;
        kids(cell, 'w:p').forEach(function (p) { if (!host && p.getElementsByTagName('w:txbxContent').length) host = p; });
        host = host || kids(cell, 'w:p')[0];
        if (rid3 && host) {
          var s3 = fit(imgs.leaderSign, 4 * EMU_CM, 1.15 * EMU_CM);
          // 有簽名時把「負責人(總召)簽章：」文字方塊往左移，讓出簽名空間
          var shift = 800000, boxX = 3096895;
          var tb = host.getElementsByTagName('wp:anchor')[0];
          if (tb) { var po = kids(kids(tb, 'wp:positionH')[0], 'wp:posOffset')[0]; boxX = Number(po.textContent) - shift; po.textContent = String(boxX); }
          var labelX = boxX + 91440 + Math.round(9 * 11 * 12700) + 120000; // 文字方塊位置 + 內距 + 9 個 11pt 字
          var labelMidY = 267335 + 45720 + Math.round(11 * 12700 * 0.65);
          host.appendChild(anchorRun(rid3, s3.cx, s3.cy, labelX, Math.round(labelMidY - s3.cy / 2), '總召簽名'));
        }
      }
    })();
  }

  var api = { fillProposal: fillProposal, fillDocument: fillDocument, parseProposal: parseProposal, parseDocument: parseDocument };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ProposalFiller = api;
})(this);

