

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = Object.assign(this.blank(), { dlStatus: 'browser', libsOk: false, intro: true });
  }

  blank() {
    var roles = ['總召', '副召', '美宣', '行政', '器材', '文書', '宣傳', '公關', '總務'];
    return {
      step: 0,
      toast: '',
      page: null,
      pageStep: -1,
      zoom: false,
      busy: null,
      dl: null,
      job: null,
      f: { year: '115', term: '第一學期', org: '', coOrg: '', type: '', name: '', leader: '', phone: '', advisor: '', guide: '學務處課外活動組',
        date: '', start: '', end: '', place: '', target: '', staffCount: '', participants: '', fee: '無收費', feeNote: '',
        purpose: '', method: '', benefit: '', extraNotes: '', checkNote: '', fileName: '' },
      staff: roles.map(function (t) { return { title: t, name: '', sid: '', job: '', note: t === '總召' ? '主要聯繫人' : '' }; }),
      flow: [{ date: '', time: '', content: '', place: '', note: '' }],
      budget: [{ item: '', price: '', qty: '', unit: '', source: '學輔支應', note: '' }],
      checks: [null, null, null, null, null, null, null, null],
      imgs: { cover: null, leaderSign: null, advisorSign: null },
      imgBusy: null
    };
  }

  sample() {
    var s = this.blank();
    s.f = Object.assign(s.f, { org: '資訊工程系學會', coOrg: '', type: '幹部訓練', name: '幹部訓練', leader: '[負責人]', phone: '[電話]', advisor: '[指導老師]',
      date: '2026-09-26', start: '08:00', end: '17:30', place: '三連堂', target: '各社團及系學會幹部', staffCount: '10', participants: '200',
      purpose: '辦理全校性幹部訓練，邀集各社團及系學會共同參與研習，以提升學生社團活動量能。',
      method: '[請說明活動進行方式與內容]',
      benefit: '透過辦理全校性幹部訓練，提升各社團及系學會幹部職能，強化社團與系學會活動連結，增進校內青春洋溢氣息，彰顯本校組織特色，預計參與人次達200人。' });
    s.flow = [
      { date: '9/26', time: '08:00~09:00', content: '場地佈置、簽到', place: '三連堂', note: '' },
      { date: '9/26', time: '17:00~17:30', content: '場復作業、賦歸', place: '三連堂', note: '' }
    ];
    s.budget = [
      { item: '交通費', price: '10000', qty: '1', unit: '台', source: '學輔支應', note: '(臺南-高雄)遊覽車一台' },
      { item: '報名費', price: '2000', qty: '1', unit: '式', source: '學輔支應', note: '個人賽*1隊' },
      { item: '設備租賃費', price: '50000', qty: '1', unit: '式', source: '學輔支應', note: '燈光音響舞台租賃' },
      { item: '保險費', price: '37', qty: '50', unit: '人', source: '社團自籌', note: '旅平險' },
      { item: '膳食費', price: '100', qty: '50', unit: '人', source: '社團自籌', note: '午餐' },
      { item: '材料費', price: '1000', qty: '1', unit: '批', source: '社團自籌', note: '依實際購買內容填寫' },
      { item: '印刷費', price: '800', qty: '1', unit: '式', source: '社團自籌', note: '依實際印刷內容填寫' },
      { item: '鐘點費', price: '800', qty: '4', unit: '小時', source: '社團自籌', note: '外聘講師1人' }
    ];
    s.step = 1;
    return s;
  }

  componentDidMount() {
    var self = this;
    // 安卓 App 的返回鍵：先關放大預覽，再回上一步；都沒有才交給 App（離開）
    window.__appBack = function () {
      if (window.__closeSheet && window.__closeSheet()) return true;
      if (self.state.zoom) { self.setState({ zoom: false }); return true; }
      if (self.state.step > 0) { self.setState({ step: self.state.step - 1 }); return true; }
      return false;
    };
    this._it = setTimeout(function () { self.setState({ intro: false }); }, 1400);
    // 下載方式：安卓 App 交給 App 存檔，其他一律瀏覽器直接下載
    this.setState({ dlStatus: window.ProposalApp ? 'app' : 'browser' });
    // 偵測匯出元件是否載入
    var tries = 0;
    var check = function () {
      tries += 1;
      var ok = self.libsReady();
      if (ok !== self.state.libsOk) self.setState({ libsOk: ok });
      if (!ok && tries < 60) self._lt = setTimeout(check, 500);
    };
    check();
  }

  componentWillUnmount() {
    clearTimeout(this._t); clearTimeout(this._lt);
    if (this.state.dl && this.state.dl.url) URL.revokeObjectURL(this.state.dl.url);
  }

  payload() {
    var s = this.state;
    return { f: s.f, staff: s.staff, flow: s.flow, budget: s.budget, checks: s.checks, images: s.imgs };
  }

  libsReady() {
    return !!(window.JSZip && window.ProposalFiller && window.ProposalPdf && window.html2canvas && window.jspdf && window.STUST_PROPOSAL_TEMPLATE_B64);
  }

  makeDocx(data, onProgress) {
    var raw = atob(window.STUST_PROPOSAL_TEMPLATE_B64), bin = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
    return window.ProposalFiller.fillProposal(window.JSZip, bin, data, { DOMParser: DOMParser, XMLSerializer: XMLSerializer, onProgress: onProgress, delay: 350 })
      .then(function (u8) { return new Blob([u8], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }); });
  }

  makePdf(data, onProgress) {
    var a = window.STUST_ASSETS || {};
    return window.ProposalPdf.toPdf(data, { logo: a.logo, graphic: a.graphic, scale: 2, onProgress: onProgress, delay: 200 });
  }

  // ---- 匯出過程（畫面上逐步顯示） ----
  jobStages(kind, data, missingCount) {
    var f = data.f;
    var staffN = data.staff.filter(function (r) { return r.title || r.name; }).length;
    var flowN = data.flow.filter(function (r) { return r.content; }).length;
    var budN = data.budget.filter(function (r) { return r.item || r.price; }).length;
    var chkN = data.checks.filter(function (c) { return c; }).length;
    var imgN = ['cover', 'leaderSign', 'advisorSign'].filter(function (k) { return data.images && data.images[k]; }).length;
    var check = { key: 'check', label: '檢查填寫內容', detail: (missingCount ? missingCount + ' 項未填，會以紅字「○○」保留在檔案裡' : '必填資料都齊了') + (imgN ? '；附 ' + imgN + ' 張圖片／簽名' : '') };
    if (kind === 'docx') return [check,
      { key: 'template', label: '讀取學校原始範本', detail: '校徽、頁首、標楷體與表格版面原封不動' },
      { key: 'fill', label: '把資料填進範本', detail: '封面、內文十七項、人員 ' + staffN + ' 人、流程 ' + flowN + ' 項、經費 ' + budN + ' 項、自我檢核 ' + chkN + '/8' },
      { key: 'pack', label: '打包成 Word 檔', detail: '同時夾帶填寫資料，之後可以匯入回來繼續改' },
      { key: 'save', label: '下載', detail: '' }];
    return [check,
      { key: 'layout', label: '依範本排版', detail: 'A4、邊界 1.5 cm、標楷體、範本字級與縮排' },
      { key: 'paged', label: '自動分頁', detail: '' },
      { key: 'page', label: '轉成 PDF', detail: '' },
      { key: 'save', label: '下載', detail: '' }];
  }

  stage(key, status, detail) {
    var job = this.state.job; if (!job) return;
    var reached = false;
    var stages = job.stages.map(function (s) {
      var n = Object.assign({}, s);
      if (s.key === key) { reached = true; n.status = status; if (detail != null) n.detail = detail; }
      else if (!reached && status !== 'error' && n.status !== 'done') n.status = 'done';
      return n;
    });
    this.setState({ job: Object.assign({}, job, { stages: stages }) });
  }

  doExport(kind, baseName, missingCount) {
    var self = this;
    if (this.state.busy) return;
    var name = (baseName || '活動企劃書').replace(/[\\/:*?"<>|]/g, '_') + '.' + kind;
    var data = this.payload();
    var stages = this.jobStages(kind, data, missingCount).map(function (s) { return Object.assign({ status: 'todo' }, s); });
    if (this.state.dl && this.state.dl.url) URL.revokeObjectURL(this.state.dl.url);
    this.setState({ busy: kind, dl: null, job: { kind: kind, name: name, stages: stages, thumbs: [], state: 'run', error: '' } });
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var onProgress = function (step, i, n, thumb) {
      if (kind === 'docx') { self.stage(step, 'active'); return; }
      if (step === 'layout') self.stage('layout', 'active');
      else if (step === 'paged') self.stage('paged', 'done', '共 ' + n + ' 頁（封面不編頁碼，內文從第 1 頁起）');
      else if (step === 'page') {
        self.stage('page', 'active', '第 ' + i + ' / ' + n + ' 頁');
        var job = self.state.job;
        self.setState({ job: Object.assign({}, job, { thumbs: job.thumbs.concat([{ src: thumb, label: i === 1 ? '封面' : '第 ' + (i - 1) + ' 頁' }]) }) });
      } else if (step === 'pack') self.stage('page', 'done', n + ' 頁全部完成');
    };
    this.stage('check', 'active');
    wait(400).then(function () {
      if (!self.libsReady()) {
        var miss = [['JSZip', window.JSZip], ['範本填寫', window.ProposalFiller], ['PDF 排版', window.ProposalPdf], ['html2canvas', window.html2canvas], ['jsPDF', window.jspdf], ['學校範本', window.STUST_PROPOSAL_TEMPLATE_B64]]
          .filter(function (x) { return !x[1]; }).map(function (x) { return x[0]; });
        throw new Error('匯出元件沒有載入：' + miss.join('、') + '。請重新整理頁面再試');
      }
      self.stage('check', 'done');
      return kind === 'docx' ? self.makeDocx(data, onProgress) : self.makePdf(data, onProgress);
    }).then(function (blob) {
      var kb = blob.size / 1024, size = kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.round(kb) + ' KB';
      self.stage('save', 'active', name + '（' + size + '）');
      return self.deliver(blob, name, size);
    }).then(function (msg) {
      self.stage('save', 'done', msg);
      self.setState({ job: Object.assign({}, self.state.job, { state: 'done' }) });
    }).catch(function (e) {
      var msg = (e && (e.message || e.code)) || String(e);
      var job = self.state.job, act = job.stages.filter(function (s) { return s.status === 'active'; })[0];
      self.stage(act ? act.key : 'save', 'error', '出錯了：' + msg);
      self.setState({ job: Object.assign({}, self.state.job, { state: 'error', error: msg }) });
    }).then(function () { self.setState({ busy: null }); });
  }

  // 回傳一句給「下載」步驟顯示的結果；失敗時丟出錯誤，讓過程面板標紅
  deliver(blob, name, size) {
    this._last = { blob: blob, name: name, size: size };
    this.setState({ dl: { name: name, size: size } });
    if (window.ProposalApp && typeof window.ProposalApp.saveFile === 'function') {
      // 安卓 App：交給 App 存到手機的「下載/企劃書」（WebView 不支援 blob 下載）
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () {
          var b64 = String(fr.result).split(',')[1] || '';
          var msg = window.ProposalApp.saveFile(name, blob.type || 'application/octet-stream', b64);
          if (/^ERR:/.test(msg)) reject(new Error('儲存失敗：' + msg.slice(4)));
          else resolve(name + '（' + size + '）' + msg);
        };
        fr.onerror = function () { reject(new Error('讀取檔案失敗')); };
        fr.readAsDataURL(blob);
      });
    }
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    return Promise.resolve(name + '（' + size + '）已下載，請看瀏覽器的下載清單');
  }

  redownload() {
    var self = this, l = this._last;
    if (!l || this.state.busy) return;
    this.setState({ busy: 'save' });
    this.deliver(l.blob, l.name, l.size).then(function (m) { self.say(m); }, function (e) { self.say('下載失敗：' + e.message); })
      .then(function () { self.setState({ busy: null }); });
  }

  // 讀圖片：封面轉 JPEG；簽名去掉白底、裁掉空白，存成透明 PNG
  processImage(file, kind) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('沒有選到檔案'));
      if (!/^image\//.test(file.type || '')) return reject(new Error('請選擇圖片檔（JPG、PNG）'));
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('讀不到這個檔案')); };
      fr.onload = function () {
        var im = new Image();
        im.onerror = function () { reject(new Error('這個圖片格式無法讀取，請改用 JPG 或 PNG')); };
        im.onload = function () {
          var max = kind === 'cover' ? 1600 : 1200;
          var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
          var w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
          var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          var cx = cv.getContext('2d');
          if (kind === 'cover') {
            cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
            return resolve({ src: cv.toDataURL('image/jpeg', 0.9), w: w, h: h, name: file.name });
          }
          cx.drawImage(im, 0, 0, w, h);
          var id = cx.getImageData(0, 0, w, h), d = id.data;
          var x0 = w, y0 = h, x1 = -1, y1 = -1;
          for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
            var i = (y * w + x) * 4, lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            var a = d[i + 3];
            if (lum >= 210) a = 0; else if (lum > 140) a = Math.round(a * (210 - lum) / 70);
            d[i + 3] = a;
            if (a > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          }
          if (x1 < 0) return reject(new Error('看不到簽名筆跡，請用深色筆在白紙上簽，再拍清楚一點'));
          cx.putImageData(id, 0, 0);
          var pad = 6; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
          var cw = x1 - x0 + 1, ch = y1 - y0 + 1;
          var out = document.createElement('canvas'); out.width = cw; out.height = ch;
          out.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
          resolve({ src: out.toDataURL('image/png'), w: cw, h: ch, name: file.name });
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  pickImage(kind, e) {
    var self = this, input = e.target, file = input.files && input.files[0];
    if (!file) return;
    this.setState({ imgBusy: kind });
    this.processImage(file, kind).then(function (img) {
      var imgs = Object.assign({}, self.state.imgs); imgs[kind] = img;
      self.setState({ imgs: imgs, imgBusy: null });
      self.say({ cover: '封面圖片', leaderSign: '總召簽名', advisorSign: '導師簽名' }[kind] + '已放上去');
    }, function (err) {
      self.setState({ imgBusy: null });
      self.say(err.message);
    });
    try { input.value = ''; } catch (er) { /* 允許重選同一張 */ }
  }

  importDocx(file) {
    var self = this;
    if (!file) return;
    if (!this.libsReady()) { this.say('匯入元件還在載入，請幾秒後再試一次'); return; }
    file.arrayBuffer().then(function (buf) {
      return window.ProposalFiller.parseProposal(window.JSZip, buf, { DOMParser: DOMParser });
    }).then(function (res) {
      var b = self.blank(), d = res.data || {};
      var f = Object.assign({}, b.f, d.f || {});
      Object.keys(f).forEach(function (k) { if (f[k] == null) f[k] = ''; });
      var str = function (x) { return x == null ? '' : String(x); };
      var staff = (d.staff || []).map(function (r) { return { title: str(r.title), name: str(r.name), sid: str(r.sid), job: str(r.job), note: str(r.note) }; });
      var flow = (d.flow || []).map(function (r) { return { date: str(r.date), time: str(r.time), content: str(r.content), place: str(r.place), note: str(r.note) }; });
      var budget = (d.budget || []).map(function (r) { return { item: str(r.item), price: str(r.price), qty: str(r.qty), unit: str(r.unit), source: r.source === '學輔支應' ? '學輔支應' : '社團自籌', note: str(r.note) }; });
      var checks = []; for (var i = 0; i < 8; i++) checks.push((d.checks || [])[i] || null);
      var di = d.images || {}, okImg = function (x) { return x && typeof x.src === 'string' && /^data:image\/(png|jpeg);base64,/.test(x.src) ? { src: x.src, w: Number(x.w) || 1, h: Number(x.h) || 1, name: str(x.name) } : null; };
      var imgs = { cover: okImg(di.cover), leaderSign: okImg(di.leaderSign), advisorSign: okImg(di.advisorSign) };
      self.setState({ f: f, staff: staff.length ? staff : b.staff, flow: flow.length ? flow : b.flow, budget: budget.length ? budget : b.budget, checks: checks, imgs: imgs, step: 1 });
      self.say('已讀取「' + file.name + '」，內容已帶回各步驟');
    }).catch(function (e) {
      self.say('讀不到這個檔案的內容：' + ((e && e.message) || e) + '（請用本工具匯出的 .docx）');
    });
  }

  say(msg) {
    var self = this;
    this.setState({ toast: msg });
    clearTimeout(this._t);
    this._t = setTimeout(function () { self.setState({ toast: '' }); }, 3600);
  }

  setF(k, v) { var f = Object.assign({}, this.state.f); f[k] = v; this.setState({ f: f }); }

  setRow(list, i, k, v) {
    var rows = this.state[list].slice();
    rows[i] = Object.assign({}, rows[i]); rows[i][k] = v;
    var o = {}; o[list] = rows; this.setState(o);
  }

  addRow(list, row) { var o = {}; o[list] = this.state[list].concat([row]); this.setState(o); }

  removeRow(list, i) {
    var rows = this.state[list].slice(); rows.splice(i, 1);
    var o = {}; o[list] = rows; this.setState(o);
  }

  rows(list, keys) {
    var self = this;
    return this.state[list].map(function (r, i) {
      var on = {};
      keys.forEach(function (k) { on[k] = function (e) { self.setRow(list, i, k, e.target.value); }; });
      return Object.assign({}, r, { idx: i + 1, on: on, remove: function () { self.removeRow(list, i); } });
    });
  }

  roc(d) {
    if (!d) return '○○年○月○日';
    var p = d.split('-');
    return (Number(p[0]) - 1911) + '年' + Number(p[1]) + '月' + Number(p[2]) + '日';
  }

  hm(t) {
    if (!t) return '○○時○○分';
    var p = t.split(':');
    return p[0] + '時' + p[1] + '分';
  }

  money(n) { return Number(n || 0).toLocaleString('en-US'); }

  stepDone(n) {
    var s = this.state, f = s.f;
    if (n === 1) return !!(f.org && f.type && f.name && f.leader && f.phone && f.advisor);
    if (n === 2) return !!(f.date && f.start && f.end && f.place && f.staffCount && f.participants);
    if (n === 3) return !!(f.purpose && f.method && f.benefit);
    if (n === 4) return s.staff.some(function (r) { return r.title === '總召' && r.name; });
    if (n === 5) return s.flow.some(function (r) { return r.content; });
    if (n === 6) return s.budget.some(function (r) { return r.item && Number(r.price) > 0; });
    if (n === 7) return s.checks.every(function (c) { return c !== null; });
    if (n === 8) return false;
    return false;
  }

  idxRange(arr) {
    if (!arr.length) return '無';
    return '項次' + arr.join('、');
  }

  renderVals() {
    var self = this, s = this.state, f = s.f;
    var labels = ['基本資料', '時間地點與人數', '活動內容', '人員配置表', '活動流程表', '經費預算表', '自我檢核', '預覽與匯出'];
    var hints = [
      '這些會出現在企劃書抬頭與第 2–5 點。',
      '日期時間會自動換成民國年格式。',
      '企劃書第 1、10、12 點，學校最常退件的地方，寫具體一點。',
      '附件一。預設帶入學校範本的九個職稱，可增刪。',
      '附件二，記得包含前置作業與場復。',
      '附件三。金額自動計算，依經費來源分別加總。',
      '【注意事項】請依項目勾選，由負責人詳閱後簽章。',
      '確認缺漏後匯出，Word 與 PDF 都套學校原始範本。'
    ];

    var on = {};
    Object.keys(f).forEach(function (k) { on[k] = function (e) { self.setF(k, e.target.value); }; });

    var steps = labels.map(function (label, i) {
      var n = i + 1, cur = s.step === n, done = self.stepDone(n);
      return { n: n, nn: (n < 10 ? '0' : '') + n, cls: cur ? 'is-cur' : '', label: label, done: done, notDone: !done, aria: cur ? 'step' : 'false',
        go: function () { self.setState({ step: n }); } };
    });
    var doneCount = steps.filter(function (x) { return x.done; }).length;

    var budgetRows = this.rows('budget', ['item', 'price', 'qty', 'unit', 'source', 'note']).map(function (r) {
      var amt = Number(r.price || 0) * Number(r.qty || 0);
      return Object.assign(r, { amount: amt, amountStr: self.money(amt) });
    });
    var total = 0, subsidy = 0, selfFund = 0, subIdx = [], selfIdx = [], needQuote = false;
    budgetRows.forEach(function (r) {
      total += r.amount;
      if (r.amount >= 10000) needQuote = true;
      if (r.source === '學輔支應') { subsidy += r.amount; subIdx.push(r.idx); } else { selfFund += r.amount; selfIdx.push(r.idx); }
    });

    var checkDefs = [
      ['是否已在社團課程管理系統建立活動？', '', ['是', '否']],
      ['是否已完成借用場地或教室？', '', ['是', '否', '無須借用']],
      ['是否已完成留校申請？', '（超過 22:00 之活動）', ['是', '否', '無須申請']],
      ['是否已完成投保及備妥相關資料？', '（校外活動）', ['是', '否', '無須申請']],
      ['是否申請學校經費補助？', '', ['是', '否']],
      ['是否已提供估價單？', needQuote ? '（你有 1 萬元以上的項目）' : '（1 萬元以上經費項目）', ['是', '否', '無須提供']],
      ['是否已確實了解核銷流程？', '', ['是', '否']],
      ['是否有其他須協助之事項？', '（選是請於下方說明）', ['是', '否']]
    ];
    var checks = checkDefs.map(function (d, i) {
      return { n: i + 1, nn: '0' + (i + 1), q: d[0], hint: d[1], opts: d[2].map(function (label) {
        var picked = s.checks[i] === label;
        return { label: label, on: picked ? 'true' : 'false', cls: picked ? 'is-on' : '',
          pick: function () { var c = s.checks.slice(); c[i] = label; self.setState({ checks: c }); } };
      }) };
    });
    var checkedCount = s.checks.filter(function (c) { return c !== null; }).length;

    var feeYesOn = f.fee === '有收費';

    var missing = [];
    var need = [
      [1, f.org, '主辦單位'], [1, f.type, '活動類型'], [1, f.name, '活動名稱'], [1, f.leader, '負責人'], [1, f.phone, '負責人電話'], [1, f.advisor, '指導老師'],
      [2, f.date, '活動日期'], [2, f.start && f.end, '活動時間'], [2, f.place, '活動地點'], [2, f.participants, '參與人數'],
      [3, f.purpose, '活動主旨'], [3, f.method, '實施方式'], [3, f.benefit, '預期效益'],
      [4, this.stepDone(4), '總召姓名'], [5, this.stepDone(5), '活動流程'], [6, this.stepDone(6), '經費項目'], [7, this.stepDone(7), '自我檢核']
    ];
    need.forEach(function (x) { if (!x[1]) missing.push({ text: x[2], go: function () { self.setState({ step: x[0] }); } }); });

    var q = function (v) { return v ? v : '○○'; };
    var staffCount = Number(f.staffCount || 0), part = Number(f.participants || 0);
    var timeStr = this.roc(f.date) + this.hm(f.start) + '至' + this.hm(f.end);
    var fileName = f.fileName || ((f.org || '○○') + '-「' + (f.name || '○○活動') + '」活動企劃書');

    var RED = '#E00000', INK = '#221F1F';
    var P = function (v, fb) { return { t: v ? v : fb, c: v ? INK : RED }; };
    var timeOk = !!(f.date && f.start && f.end);
    var preview = {
      year: P(f.year, '○○○'), term: f.term, org: P(f.org, '○○社'), type: P(f.type, '幹部訓練/校內展演/成果發表…'),
      name: P(f.name, '○○活動'), leader: P(f.leader, '○○'), phone: P(f.phone, '○○'),
      guide: P(f.guide, '學務處課外活動組'), coOrg: { t: f.coOrg || '無', c: INK }, advisor: P(f.advisor, '○○老師'),
      place: P(f.place, '○○'), time: { t: timeStr, c: timeOk ? INK : RED },
      people: { t: (f.target ? '對象為' + f.target + '，' : '') + '工作人員' + q(f.staffCount) + '人，預計參與' + q(f.participants) + '人，合計' + (staffCount + part) + '人。',
        c: f.staffCount && f.participants ? INK : RED },
      fee: feeYesOn ? '有收費，' + (f.feeNote || '') + '（詳見預計收支明細表）' : '無收費。',
      purpose: P(f.purpose, '請簡略說明辦理此活動之主要目的。'),
      method: P(f.method, '請簡略說明活動進行方式、競賽規定、辦理內容等。'),
      benefit: P(f.benefit, '請說明預計達成之質量化目標。'),
      hasExtra: !!f.extraNotes, extra: f.extraNotes
    };

    // 預覽頁
    var st0 = s.step;
    var autoPage = st0 <= 2 ? 0 : st0 === 3 ? 1 : st0 <= 5 ? 2 : st0 <= 7 ? 3 : 0;
    var curPage = (s.page !== null && s.pageStep === s.step) ? s.page : autoPage;
    var pageLabels = ['封面', '內文', '附件一、二', '附件三・注意事項'];
    var pages = pageLabels.map(function (label, i) {
      var sel = curPage === i;
      return { label: label, sel: sel ? 'true' : 'false', cls: sel ? 'is-on' : '',
        go: function () { self.setState({ page: i, pageStep: s.step }); } };
    });
    var zoom = !!s.zoom;
    var pz = zoom
      ? { pos: 'fixed', inset: '0', z: '50', bg: 'var(--bg)', ov: 'auto', pad: '24px 16px 48px', barW: '794px', font: 16, btn: '關閉放大', cap: 'var(--muted)', head: 'inherit' }
      : { pos: 'static', inset: 'auto', z: 'auto', bg: 'transparent', ov: 'visible', pad: '0', barW: '100%', font: 7.6, btn: '放大檢視', cap: 'var(--muted)', head: 'inherit' };

    var staffPv = s.staff.map(function (r) { return r; });
    var flowPv = s.flow.slice();
    while (flowPv.length < 8) flowPv.push({ date: '', time: '', content: '', place: '', note: '' });
    var budgetPv = budgetRows.map(function (r) {
      var unit = r.unit || '';
      var formula = (r.note ? r.note : r.item) + (r.price ? self.money(r.price) + '元*' + (r.qty || 0) + unit + '=' + r.amountStr + '元' : '');
      return { idx: r.idx, item: r.item, priceStr: r.price ? self.money(r.price) : '', qtyStr: (r.qty || '') + unit, amountStr: r.amount ? r.amountStr : '', source: r.source, formula: formula };
    });
    var span = function (arr) {
      if (!arr.length) return '';
      var contiguous = arr[arr.length - 1] - arr[0] === arr.length - 1;
      return '(項次' + (contiguous && arr.length > 1 ? arr[0] + '-' + arr[arr.length - 1] : arr.join('、')) + ') ';
    };
    var checkPv = checkDefs.map(function (d, i) {
      var marks = d[2].map(function (o) {
        var box = s.checks[i] === o ? '☑' : '□';
        return o === '是' && i === 7 ? '是' + box + '(請於下方說明)' : o + box;
      }).join(' ');
      return { n: i + 1, q: d[0].replace(/？$/, '？'), bold: ['', '', '(超過22:00之活動)', '(校外活動)', '', '(1萬元以上經費項目)', '', ''][i], marks: marks };
    });

    var jobView = null;
    if (s.job) {
      var doneN = 0;
      var jst = s.job.stages.map(function (g, i) {
        if (g.status === 'done') doneN += 1;
        return { cls: 'is-' + (g.status || 'todo'), label: g.label, detail: g.detail, aria: g.status === 'active' ? 'step' : 'false' };
      });
      var st = s.job.state;
      jobView = { title: s.job.kind === 'docx' ? '匯出 Word' : '匯出 PDF', en: s.job.kind === 'docx' ? 'DOCX EXPORT' : 'PDF EXPORT', barCls: st === 'done' ? 'done' : '', stages: jst,
        pct: st === 'done' ? 100 : Math.round(doneN / jst.length * 100),
        statusText: st === 'done' ? '完成' : st === 'error' ? '失敗' : '進行中…', statusColor: st === 'done' ? 'var(--ok)' : st === 'error' ? 'var(--late)' : 'var(--ink)',
        thumbs: s.job.thumbs, hasThumbs: s.job.thumbs.length > 0, isDone: st === 'done' };
    }
    var IM = s.imgs || {};
    var slotDefs = [
      ['cover', '封面圖片', 'COVER', '取代封面中間的裝飾圖', '置中放在封面標題下方，最大 14 × 10 公分'],
      ['leaderSign', '總召簽名', 'LEADER', '注意事項表「負責人(總召)簽章」', '白紙黑字拍照即可，會自動去背、裁掉空白'],
      ['advisorSign', '導師簽名', 'ADVISOR', '封面「指導老師簽章」', '白紙黑字拍照即可，會自動去背、裁掉空白']];
    var imgSlots = slotDefs.map(function (d) {
      var im = IM[d[0]], busy = s.imgBusy === d[0];
      return { key: d[0], label: d[1], en: d[2], where: '會放在：' + d[3], note: d[4], has: !!im, empty: !im, src: im ? im.src : '',
        cls: busy ? 'is-busy' : im ? 'has' : '', pickLabel: busy ? '處理中…' : im ? '換一張' : '選擇圖片',
        pick: function (e) { self.pickImage(d[0], e); },
        clear: function () { var n = Object.assign({}, self.state.imgs); n[d[0]] = null; self.setState({ imgs: n }); } };
    });
    var iv = { cover: IM.cover ? IM.cover.src : '', leaderSign: IM.leaderSign ? IM.leaderSign.src : '', advisorSign: IM.advisorSign ? IM.advisorSign.src : '' };
    var step = s.step;
    return {
      imgSlots: imgSlots, iv: iv,
      hasCoverImg: !!IM.cover, noCoverImg: !IM.cover, hasAdvisorSign: !!IM.advisorSign, hasLeaderSign: !!IM.leaderSign, noLeaderSign: !IM.leaderSign,
      introCls: s.intro ? 'intro' : '',
      stepEn: step > 0 ? ['BASIC', 'SCHEDULE', 'CONTENT', 'STAFF', 'TIMELINE', 'BUDGET', 'CHECKLIST', 'EXPORT'][step - 1] : 'START',
      stepNum: (step < 10 ? '0' : '') + step,
      heroPill: step > 0 ? 'STEP ' + (step < 10 ? '0' : '') + step : 'START',
      heroPillZh: step > 0 ? labels[step - 1] : '開始',
      feeYesCls: f.fee === '有收費' ? 'is-on' : '', feeNoCls: f.fee === '有收費' ? '' : 'is-on',
      f: f, on: on, step: step, steps: steps, doneCount: doneCount,
      isS0: step === 0, isS1: step === 1, isS2: step === 2, isS3: step === 3, isS4: step === 4,
      isS5: step === 5, isS6: step === 6, isS7: step === 7, isS8: step === 8,
      inStep: step > 0, notLast: step > 0 && step < 8,
      stepTitle: step > 0 ? labels[step - 1] : '', stepHint: step > 0 ? hints[step - 1] : '',
      nextLabel: step > 0 && step < 8 ? labels[step] : '',
      totalPeople: staffCount + part,
      feeYesOn: feeYesOn, feeNoOn: !feeYesOn,
      feeYes: function () { self.setF('fee', '有收費'); }, feeNo: function () { self.setF('fee', '無收費'); },
      staffRows: this.rows('staff', ['title', 'name', 'sid', 'job', 'note']),
      flowRows: this.rows('flow', ['date', 'time', 'content', 'place', 'note']),
      budgetRows: budgetRows,
      totalStr: this.money(total), subsidyStr: this.money(subsidy), selfStr: this.money(selfFund),
      subsidyIdx: this.idxRange(subIdx), selfIdx: this.idxRange(selfIdx), needQuote: needQuote,
      checks: checks, checkedCount: checkedCount,
      missing: missing, missingCount: missing.length, hasMissing: missing.length > 0, noMissing: missing.length === 0,
      fileName: fileName,
      staffFilled: s.staff.filter(function (r) { return r.name; }).length,
      flowFilled: s.flow.filter(function (r) { return r.content; }).length,
      pv: preview, pz: pz, pages: pages,
      isP1: curPage === 0, isP2: curPage === 1, isP3: curPage === 2, isP4: curPage === 3,
      hasPageNo: curPage > 0, pageNo: curPage,
      staffPv: staffPv, flowPv: flowPv, budgetPv: budgetPv, checkPv: checkPv,
      srcSub: span(subIdx) + this.money(subsidy) + '元', srcSelf: span(selfIdx) + this.money(selfFund) + '元',
      toggleZoom: function () { self.setState({ zoom: !self.state.zoom }); },
      toast: s.toast, hasToast: !!s.toast,
      addStaff: function () { self.addRow('staff', { title: '', name: '', sid: '', job: '', note: '' }); },
      addFlow: function () { self.addRow('flow', { date: '', time: '', content: '', place: '', note: '' }); },
      addBudget: function () { self.addRow('budget', { item: '', price: '', qty: '', unit: '', source: '社團自籌', note: '' }); },
      addPrePost: function () {
        var d = f.date ? Number(f.date.split('-')[1]) + '/' + Number(f.date.split('-')[2]) : '';
        var rows = self.state.flow.filter(function (r) { return r.content || r.time; });
        rows.unshift({ date: d, time: '', content: '場地佈置、簽到', place: f.place, note: '前置作業' });
        rows.push({ date: d, time: '', content: '場復作業、賦歸', place: f.place, note: '場復' });
        self.setState({ flow: rows });
      },
      prev: function () { self.setState({ step: Math.max(0, step - 1) }); },
      next: function () { self.setState({ step: Math.min(8, step + 1) }); },
      goStart: function () { self.setState({ step: 0 }); },
      startNew: function () { self.setState(Object.assign(self.blank(), { step: 1, dlStatus: self.state.dlStatus, libsOk: self.state.libsOk })); },
      loadSample: function () { self.setState(Object.assign(self.sample(), { dlStatus: self.state.dlStatus, libsOk: self.state.libsOk })); self.say('已載入學校範本裡的範例資料，方括號 [ ] 的地方請換成你的內容'); },
      onImport: function (e) {
        var input = e.target, file = input.files && input.files[0];
        self.importDocx(file);
        try { input.value = ''; } catch (err) { /* 允許再次選同一個檔 */ }
      },
      busyAny: !!s.busy, hasJob: !!jobView, job: jobView || { title: '', stages: [], pct: 0, statusText: '', statusColor: 'var(--muted)', thumbs: [], hasThumbs: false, isDone: false },
      wordLabel: s.busy === 'docx' ? '產生 Word 中…' : '下載 Word（.docx）',
      pdfLabel: s.busy === 'pdf' ? '排版 PDF 中…' : '下載 PDF',
      hasDl: !!s.dl, dl: s.dl || { name: '', size: '' },
      redownload: function () { self.redownload(); },
      sysLine: (s.libsOk ? '匯出元件：已就緒' : '匯出元件：載入中…') + '　·　' + (s.dlStatus === 'app' ? '下載：存到手機的「下載/企劃書」' : '下載：瀏覽器直接下載'),
      sysColor: 'var(--muted)', sysDot: s.libsOk ? 'ok-dot' : 'todo-dot',
      exportWord: function () { self.doExport('docx', fileName, missing.length); },
      exportPdf: function () { self.doExport('pdf', fileName, missing.length); }
    };
  }
}

window.addEventListener('DOMContentLoaded', function () {
  window.__app = mountDC(Component, document.getElementById('dc-tpl'), document.getElementById('dc-root'), {});
});
