
// 企劃書 PDF：依學校範本的版面（A4、邊界 1.5cm、標楷體、字級與縮排）在瀏覽器排版並分頁，
// 再用 html2canvas + jsPDF 輸出。用法：ProposalPdf.build(data, { logo, graphic }) -> Promise<Blob>
(function (root) {
  var PX = 96 / 72;                     // pt -> px
  var W = 794, H = 1123, M = 57;        // A4 @96dpi，邊界 851twip ≈ 57px
  var CW = W - 2 * M;                   // 內容寬
  var FOOT = 38;                        // 頁尾距底 567twip
  var BODY_BOTTOM = H - M;              // 內文可用到的位置
  var FONT = "DFKai-SB,'標楷體',BiauKai,'BiauKai TC','LXGW WenKai TC','AR PL UKai TW',serif";
  var INK = '#221F1F', RED = '#FF0000';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function nl(s) { return esc(s).replace(/\n/g, '<br>'); }
  function roc(d) { if (!d) return '○○年○月○日'; var p = d.split('-'); return (Number(p[0]) - 1911) + '年' + Number(p[1]) + '月' + Number(p[2]) + '日'; }
  function hm(t) { if (!t) return '○○時○○分'; var p = t.split(':'); return p[0] + '時' + p[1] + '分'; }
  function money(n) { return Number(n || 0).toLocaleString('en-US'); }
  function v(val, fb) { return val ? '<span style="color:' + INK + '">' + nl(val) + '</span>' : '<span style="color:' + RED + '">' + esc(fb) + '</span>'; }
  function h(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }

  var NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七'];

  function build(data, assets) {
    var f = data.f || {};
    var host = h('div', 'position:fixed;left:-20000px;top:0;width:' + W + 'px;pointer-events:none;');
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
    var pages = [];
    var pageNo = 0;

    function newPage(numbered) {
      var pg = h('div', 'position:relative;width:' + W + 'px;height:' + H + 'px;background:#fff;overflow:hidden;font-family:' + FONT + ';color:' + INK + ';box-sizing:border-box;');
      var body = h('div', 'position:absolute;left:' + M + 'px;top:' + M + 'px;width:' + CW + 'px;');
      pg.appendChild(body);
      if (numbered) {
        pageNo += 1;
        pg.appendChild(h('div', 'position:absolute;left:0;right:0;bottom:' + (FOOT - 4) + 'px;text-align:center;font-size:' + (10 * PX) + 'px;', '第' + pageNo + '頁'));
      }
      host.appendChild(pg);
      pages.push(pg);
      return body;
    }
    // 依序放入區塊，超出就換頁；表格列換頁時重複表頭
    function flow(blocks) {
      var body = newPage(true), tableHead = null;
      blocks.forEach(function (b) {
        if (b.kind === 'thead') tableHead = b;
        if (b.kind === 'endtable') { tableHead = null; return; }
        var el = b.el.cloneNode(true);
        body.appendChild(el);
        if (body.offsetTop + body.offsetHeight > BODY_BOTTOM - 8 && body.childNodes.length > 1) {
          body.removeChild(el);
          body = newPage(true);
          if (b.kind === 'row' && tableHead) body.appendChild(tableHead.el.cloneNode(true));
          body.appendChild(el);
        }
      });
    }

    // ---------- 封面 ----------
    (function () {
      var body = newPage(false), pg = pages[0];
      var hdr = h('div', 'position:absolute;left:' + (M - 2) + 'px;top:' + (M - 2) + 'px;width:' + (CW + 4) + 'px;display:grid;grid-template-columns:47% 53%;border:2px solid #FBC415;box-sizing:border-box;font-weight:700;font-size:' + (10 * PX) + 'px;line-height:1.35;');
      hdr.innerHTML = '<div style="border-right:1px solid #FFD454;display:flex;align-items:center;justify-content:center;padding:4px 8px;">' +
        (assets.logo ? '<img src="' + assets.logo + '" style="width:269px;height:70px;display:block">' : '南臺科技大學') + '</div>' +
        '<div style="background:#FFFFBB;display:flex;flex-direction:column;">' +
        '<div style="padding:5px 8px;border-bottom:1px solid #FFD454;">南臺科技大學 學務處--課外活動組/06-253-3131#2211<br>臺南市永康區南台街一號/ http：//www.stust.edu.tw/</div>' +
        '<div style="padding:5px 8px;color:#C45911;">活動負責人 ' + esc(f.leader || '○○') + ' / 電話' + esc(f.phone || '○○') + '</div></div>';
      pg.appendChild(hdr);
      var tsz = 16 * PX;
      var titles = h('div', 'position:absolute;left:' + M + 'px;width:' + CW + 'px;top:' + (M + 84) + 'px;text-align:center;font-weight:700;font-size:' + tsz + 'px;line-height:1.5;');
      titles.innerHTML = '<div>南臺科技大學' + esc(f.year || '○○○') + '學年度' + esc(f.term || '第一學期') + '</div>' +
        '<div>' + v(f.org, '○○社') + '辦理「' + v(f.type, '○○') + '」活動企劃書</div>' +
        '<div>活動名稱：『' + v(f.name, '○○活動') + '』</div>';
      pg.appendChild(titles);
      titles.style.top = (hdr.offsetTop + hdr.offsetHeight + 4) + 'px';
      var imgs = data.images || {};
      if (imgs.cover && imgs.cover.src) {
        // 使用者封面圖：置中、等比縮放，最大 14 × 10 公分
        var kc = Math.min(529 / (imgs.cover.w || 1), 378 / (imgs.cover.h || 1));
        var cw = (imgs.cover.w || 1) * kc, ch = (imgs.cover.h || 1) * kc;
        var ci = h('img', 'position:absolute;width:' + cw + 'px;height:' + ch + 'px;left:' + (389 - cw / 2) + 'px;top:' + (540 - ch / 2) + 'px;');
        ci.src = imgs.cover.src;
        pg.appendChild(ci);
      } else if (assets.graphic) {
        // 範本封面預設圖：學生會圓章 6.5 × 6.5 公分（245.7px），中心約在 (389, 540)
        var g = h('img', 'position:absolute;width:245.7px;height:245.7px;left:' + (389 - 122.85) + 'px;top:' + (540 - 122.85) + 'px;');
        g.src = assets.graphic;
        pg.appendChild(g);
      }
      var time = (f.date && f.start && f.end) ? v(roc(f.date) + hm(f.start) + '至' + hm(f.end)) : '<span style="color:' + RED + '">' + roc(f.date) + hm(f.start) + '至' + hm(f.end) + '</span>';
      var info = h('div', 'position:absolute;left:107px;top:762px;font-weight:700;font-size:' + (14 * PX) + 'px;line-height:' + (22 * PX) + 'px;');
      info.innerHTML = '<div>指導單位：' + v(f.guide || '學務處課外活動組') + '</div>' +
        '<div>主辦單位：' + v(f.org, '○○社') + '</div>' +
        '<div>協辦單位：' + v(f.coOrg || '無') + '</div>' +
        '<div>活動時間：' + time + '</div>' +
        '<div>活動地點：' + v(f.place, '○○') + '</div>' +
        '<div style="display:flex;align-items:center;gap:4px">指導老師簽章：' + ((data.images && data.images.advisorSign && data.images.advisorSign.src) ? '<img src="' + data.images.advisorSign.src + '" style="height:49px;max-width:227px;object-fit:contain">' : '') + '</div>';
      pg.appendChild(info);
      body.remove();
    })();

    // ---------- 內文 ----------
    var B = 12 * PX, LH = 17 * PX, S = 12 * PX, SLH = 17 * PX, S2 = 11 * PX;
    function item(i, label, html) {
      return { el: h('div', 'font-size:' + B + 'px;line-height:' + LH + 'px;padding-left:50px;text-indent:-50px;',
        '<b>' + NUM[i] + '、' + label + '</b>' + (html || '')) };
    }
    function sub(mark, html, left, hang) {
      return { el: h('div', 'font-size:' + S + 'px;line-height:' + SLH + 'px;padding-left:' + left + 'px;text-indent:-' + hang + 'px;', mark + html) };
    }
    var sc = Number(f.staffCount || 0), pc = Number(f.participants || 0);
    var timeOk = f.date && f.start && f.end;
    var t = [];
    t.push(item(0, '活動主旨：', v(f.purpose, '請簡略說明辦理此活動之主要目的。')));
    t.push(item(1, '指導單位：', v(f.guide || '學務處課外活動組') + '。'));
    t.push(item(2, '主辦單位：', v(f.org, '○○社') + '。'));
    t.push(item(3, '協辦單位：', v(f.coOrg || '無') + '。'));
    t.push(item(4, '指導/帶隊老師：', v(f.advisor, '○○老師') + '。'));
    var ppl = (f.target ? '對象為' + f.target + '，' : '') + '工作人員' + (f.staffCount || '○○') + '人，預計參與' + (f.participants || '○○') + '人，合計' + (sc + pc) + '人。';
    t.push(item(5, '活動對象與人數：', '<span style="color:' + (f.staffCount && f.participants ? INK : RED) + '">' + esc(ppl) + '</span>'));
    t.push(item(6, '活動時間：', '<span style="color:' + (timeOk ? INK : RED) + '">' + roc(f.date) + hm(f.start) + '至' + hm(f.end) + '。</span>'));
    t.push(item(7, '活動地點：', v(f.place, '○○') + '。'));
    t.push(item(8, '有無收費：', esc(f.fee === '有收費' ? '有收費，' + (f.feeNote || '') + '（詳見預計收支明細表）' : '無收費。')));
    t.push(item(9, '實施方式與內容：', v(f.method, '請簡略說明活動進行方式、競賽規定、辦理內容等。')));
    t.push(item(10, '一般規定或注意事項：', ''));
    var S1L = 90, S1H = 24;
    [['(一)', '活動前實施宣導及叮嚀有關性別平等宣導課程強化性別平等觀念，以預防學生活動發生疑似校園性侵害、性騷擾或性霸凌事件，並於辦理活動時在工作及人際互動上，應尊重他人及自己之性或身體之自主，勿有涉及霸凌、性別歧視、性騷擾、性侵害等名稱及內容之活動。'],
     ['(二)', '如活動中有使用危險器材(化學藥物、用火等等)，均需將相關防護及急救措施都要完整寫出來，確保傷害降到最低，也讓工作人員能依此去做到相對應的防護動作，並做行前訓練確保活動安全。'],
     ['(三)', '活動中請隨時注意參加人員之身體狀況，適時提出協助及詢問狀況，並提醒避免單獨行動以免發生危險。']]
      .forEach(function (x) { t.push(sub(x[0], x[1], S1L, S1H)); });
    if (f.extraNotes) t.push(sub('(四)', nl(f.extraNotes), S1L, S1H));
    t.push(item(11, '預期效益：', v(f.benefit, '請說明預計達成之質量化目標。')));
    t.push(item(12, '緊急應變措施：', ''));
    t.push(sub('(一)', '如遇緊急狀況立即撥打119並通知帶隊老師後回報校安中心。', S1L, S1H));
    t.push(sub('(二)', '性平宣導：', S1L, S1H));
    ['注意性別平等意識與人際互動界線，當你的行為讓他人覺得不舒服的時候要立即停止，別人不拒絕不代表你可以。',
     '禁止嘲笑、性意味的雙關語、攻擊他人長相或身體等，或其它與性相關的言語騷擾。',
     '禁止對他人毛手毛腳、偷窺、偷拍等騷擾行為。',
     '若遇到不友善行為，立即表明自己感受及離開現場，並告知師長。',
     '若發生性侵害、性騷擾及性霸凌，可能面臨學校記過、退學懲處，也面臨法律責任，良民證留下刑事紀錄。',
     '若發現上述性平事件，向校安中心(06-301-0000)申訴及求助。'].forEach(function (x, i) { t.push(sub((i + 1) + '、', x, 125, 21)); });
    t.push(item(13, '人員配置表：', '附件一。'));
    t.push(item(14, '活動流程表：', '附件二。'));
    t.push(item(15, '經費預算表：', '附件三。'));
    t.push(item(16, '【注意事項】', '請依項目勾選，並由負責人詳閱後簽章。'));
    flow(t);

    // ---------- 表格工具 ----------
    var CELL = 'border-left:1px solid #000;padding:4px 5px;display:flex;align-items:center;justify-content:center;text-align:center;word-break:break-all;';
    function row(cols, cells, opts) {
      opts = opts || {};
      var html = cells.map(function (c, i) {
        var css = CELL + (i === 0 ? 'border-left:0;' : '') + (opts.align && opts.align[i] ? 'justify-content:' + opts.align[i] + ';text-align:' + (opts.align[i] === 'flex-end' ? 'right' : opts.align[i] === 'flex-start' ? 'left' : 'center') + ';' : '');
        return '<div style="' + css + '">' + c + '</div>';
      }).join('');
      return h('div', 'display:grid;grid-template-columns:' + cols + ';border:1.5px solid #000;border-top:' + (opts.top ? '1.5px' : '0') + ' solid #000;min-height:' + (opts.minH || 32) + 'px;font-size:' + (opts.size || B) + 'px;line-height:1.35;' + (opts.bold ? 'font-weight:700;' : ''), html);
    }
    function caption(text) { return { el: h('div', 'font-size:' + B + 'px;line-height:' + (22 * PX) + 'px;margin-top:6px;', esc(text)) }; }
    function gap(px) { return { el: h('div', 'height:' + px + 'px') }; }

    // ---------- 附件一、二 ----------
    var a = [];
    a.push(caption('附件一、人員配置表'));
    var sCols = '13% 16% 16% minmax(0,1fr) 16%';
    a.push({ kind: 'thead', el: row(sCols, ['職稱', '姓名', '學號', '工作內容', '備註'], { top: true, bold: true }) });
    (data.staff || []).forEach(function (r) { a.push({ kind: 'row', el: row(sCols, [esc(r.title), esc(r.name), esc(r.sid), esc(r.job), esc(r.note)], { align: [0, 0, 0, 'flex-start', 0] }) }); });
    a.push({ kind: 'endtable', el: null });
    a.push(gap(18));
    a.push(caption('附件二、活動流程表(含前置作業、場復)'));
    var fCols = '10% 17% minmax(0,1fr) 22% 14%';
    a.push({ kind: 'thead', el: row(fCols, ['日期', '時間', '活動內容', '地點', '備註'], { top: true, bold: true }) });
    var fl = (data.flow || []).filter(function (r) { return r.date || r.time || r.content || r.place || r.note; });
    while (fl.length < 8) fl.push({});
    fl.forEach(function (r) { a.push({ kind: 'row', el: row(fCols, [esc(r.date), esc(r.time), esc(r.content), esc(r.place), esc(r.note)]) }); });
    a.push({ kind: 'endtable', el: null });
    flow(a);

    // ---------- 附件三、注意事項 ----------
    var c = [];
    c.push(caption('附件三、經費預算表'));
    var bCols = '6% 15% 11% 11% 12% minmax(0,1fr)';
    var head = h('div', '');
    head.appendChild(row('1fr', [v(f.name, '○○活動') + '&nbsp;&nbsp;經費預算表'], { top: true, bold: true, size: 13 * PX }));
    head.appendChild(row(bCols, ['項<br>次', '項目', '單價', '數量', '金額', '備註'], { bold: true }));
    c.push({ kind: 'thead', el: head });
    var total = 0, sub1 = 0, sub2 = 0, i1 = [], i2 = [];
    (data.budget || []).filter(function (b) { return b.item || b.price; }).forEach(function (b, i) {
      var amt = Number(b.price || 0) * Number(b.qty || 0), idx = i + 1, unit = b.unit || '';
      total += amt;
      if (b.source === '學輔支應') { sub1 += amt; i1.push(idx); } else { sub2 += amt; i2.push(idx); }
      var note = '<div style="text-align:left;width:100%">【' + esc(b.source) + '】<br>' + esc((b.note || b.item) + money(b.price) + '元*' + (b.qty || 0) + unit + '=' + money(amt) + '元') + '</div>';
      c.push({ kind: 'row', el: row(bCols, [idx, esc(b.item), money(b.price), esc((b.qty || '') + unit), money(amt), note], { align: [0, 0, 'flex-end', 0, 'flex-end', 'flex-start'], minH: 40 }) });
    });
    function span(a) { if (!a.length) return ''; var cc = a[a.length - 1] - a[0] === a.length - 1; return '(項次' + (cc && a.length > 1 ? a[0] + '-' + a[a.length - 1] : a.join('、')) + ') '; }
    c.push({ kind: 'row', el: row('21% minmax(0,1fr)', ['經費總計', money(total) + '元']) });
    c.push({ kind: 'row', el: row('21% minmax(0,1fr)', ['經費來源', '<div style="text-align:left;width:100%">學輔支應：' + span(i1) + money(sub1) + '元<br>社團自籌：' + span(i2) + money(sub2) + '元</div>']) });
    c.push({ kind: 'endtable', el: null });
    c.push(gap(18));
    c.push(caption('【注意事項】'));
    var qs = ['是否已在社團課程管理系統建立活動？', '是否已完成借用場地或教室？', '是否已完成留校申請？(<b>超過22:00之活動</b>)', '是否已完成投保及備妥相關資料？(<b>校外活動</b>)',
      '是否申請學校經費補助？', '是否已提供估價單？(<b>1萬元以上經費項目</b>)', '是否已確實了解核銷流程？ <span style="color:#0563C1;text-decoration:underline">連結</span>', '是否有其他須協助之事項？'];
    var opts = [['是', '否'], ['是', '否', '無須借用'], ['是', '否', '無須申請'], ['是', '否', '無須申請'], ['是', '否'], ['是', '否', '無須提供'], ['是', '否'], ['是', '否']];
    var ck = data.checks || [];
    var ansHtml = opts.map(function (o, i) {
      return (i + 1) + '.&nbsp;' + o.map(function (x) { var box = ck[i] === x ? '■' : '□'; return x === '是' && i === 7 ? '是' + box + '(請於下方說明)' : x + box; }).join(' ');
    }).join('<br>');
    var qHtml = qs.map(function (q, i) { return (i + 1) + '.&nbsp;&nbsp;' + q; }).join('<br>');
    var ckCols = '12% minmax(0,1fr) 30%';
    var L = 'style="text-align:left;width:100%;line-height:1.45"';
    c.push({ kind: 'row', el: row(ckCols, ['項目', '內容', '請勾選'], { top: true, size: S2 }) });
    c.push({ kind: 'row', el: row(ckCols, ['自我檢核', '<div ' + L + '>' + qHtml + '</div>', '<div ' + L + '>' + ansHtml + '</div>'], { size: S2 }) });
    c.push({ kind: 'row', el: row('12% minmax(0,1fr)', ['說明', '<div style="width:100%;text-align:left;min-height:64px;display:flex;flex-direction:column;justify-content:space-between"><div>' + nl(f.checkNote || '') + '</div><div style="display:flex;justify-content:flex-end;align-items:center;gap:6px;padding-right:20px;min-height:44px">負責人(總召)簽章：' + ((data.images && data.images.leaderSign && data.images.leaderSign.src) ? '<img src="' + data.images.leaderSign.src + '" style="height:43px;max-width:151px;object-fit:contain">' : '<span style="display:inline-block;width:151px"></span>') + '</div></div>'], { size: S2, minH: 72 }) });
    flow(c);

    return { host: host, pages: pages };
  }

  function waitImages(host) {
    var imgs = Array.prototype.slice.call(host.querySelectorAll('img'));
    return Promise.all(imgs.map(function (im) { return im.complete ? null : new Promise(function (r) { im.onload = im.onerror = r; }); }));
  }

  function toPdf(data, assets) {
    assets = assets || {};
    var prog = assets.onProgress || function () {};
    var tick = function () { return new Promise(function (r) { setTimeout(r, assets.delay || 0); }); };
    var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    prog('layout');
    return tick().then(function () { return fontsReady; }).then(function () {
      var built = build(data, assets);
      return waitImages(built.host).then(function () {
        var n = built.pages.length;
        prog('paged', 0, n);
        var pdf = new root.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
        var chain = tick();
        built.pages.forEach(function (pg, i) {
          chain = chain.then(function () {
            return root.html2canvas(pg, { scale: assets.scale || 2, backgroundColor: '#ffffff', logging: false, width: W, height: H });
          }).then(function (cv) {
            if (i) pdf.addPage('a4', 'portrait');
            pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
            // 縮圖給介面即時顯示
            var t = document.createElement('canvas'); t.width = 150; t.height = 212;
            t.getContext('2d').drawImage(cv, 0, 0, 150, 212);
            prog('page', i + 1, n, t.toDataURL('image/jpeg', 0.8));
            return tick();
          });
        });
        return chain.then(function () { prog('pack', n, n); return tick(); }).then(function () { return pdf.output('blob'); });
      }).finally(function () { built.host.remove(); });
    });
  }

  root.ProposalPdf = { toPdf: toPdf, build: build };
})(this);

