(function(){
  const appEl = document.getElementById("app");
  const root = document.getElementById("root");
  const btnReset = document.getElementById("btn-reset");
  const btnHome = document.getElementById("btn-home");

  const tests = window.TESTS || {};

  // --- persistence keys ---
  const STORAGE_KEY = "xhs_tests_state_v3";

  // --- state ---
  const state = {
    screen: "home", // home | intro | quiz | result
    testKey: null,  // relationship | emotional
    qIndex: 0,
    answers: [],
    result: null,
    nickname: "",
    startedAt: null,
    autoNextDelayMs: 220,
    fromShare: false
  };

  btnReset.addEventListener("click", () => hardReset());
  btnHome.addEventListener("click", () => goHome());

  // --- utilities ---
  function nowISO(){
    try{ return new Date().toISOString(); }catch{ return ""; }
  }
  function toast(msg){
    let el = document.getElementById("toast");
    if(!el){
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1400);
  }

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      toast("已复制");
    }catch(e){
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast("已复制");
    }
  }

  function el(tag, attrs={}, children=[]){
    const node = document.createElement(tag);
    for(const [k,v] of Object.entries(attrs)){
      if(k === "class") node.className = v;
      else if(k === "html") node.innerHTML = v;
      else if(k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
      else if(k === "value") node.value = v;
      else node.setAttribute(k, v);
    }
    for(const c of (Array.isArray(children) ? children : [children])){
      if(c === null || c === undefined) continue;
      if(typeof c === "string") node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
    return node;
  }

  function withFade(node){
    node.classList.add("fade-enter");
    return node;
  }

  // --- base64url for share links ---
  function b64urlEncode(str){
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function b64urlDecode(str){
    let s = str.replace(/-/g,'+').replace(/_/g,'/');
    while(s.length % 4) s += '=';
    const raw = atob(s);
    return decodeURIComponent(escape(raw));
  }

  function parseHash(){
    const h = location.hash ? location.hash.slice(1) : "";
    const params = new URLSearchParams(h);
    return params;
  }
  function setHash(params){
    const str = params.toString();
    location.hash = str ? ("#" + str) : "";
  }

  // --- template renderer (supports {{a.b[0]}} ) ---
  function getByPath(obj, path){
    const parts = path.split(".").filter(Boolean);
    let cur = obj;
    for(const part of parts){
      if(cur == null) return "";
      const m = part.match(/^([A-Za-z0-9_]+)(\[(\d+)\])?$/);
      if(!m) return "";
      const key = m[1];
      cur = cur[key];
      if(m[2]){
        const idx = parseInt(m[3], 10);
        cur = (Array.isArray(cur) ? cur[idx] : "");
      }
    }
    if(cur == null) return "";
    return String(cur);
  }

  function renderTemplate(str, ctx){
    return String(str).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expr) => getByPath(ctx, expr.trim()));
  }
  function renderTemplateArray(arr, ctx){
    return (arr || []).map(s => renderTemplate(s, ctx));
  }

  // --- persistence ---
  function loadSaved(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      return null;
    }
  }
  function saveProgress(){
    try{
      const all = loadSaved() || {};
      if(!state.testKey) return;

      all[state.testKey] = {
        qIndex: state.qIndex,
        answers: state.answers,
        nickname: state.nickname,
        startedAt: state.startedAt,
        updatedAt: nowISO()
      };
      all._last = { testKey: state.testKey, updatedAt: nowISO() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }catch(e){
      // ignore
    }
  }
  function clearProgress(){
    try{
      localStorage.removeItem(STORAGE_KEY);
    }catch(e){}
  }

  // --- scoring ---
  function scoreAnswer(q, ans){
    if(ans == null) return 0;
    if(q.reverse) return 6 - ans;
    return ans;
  }

  function computeRelationship(test, answers){
    const dims = {};
    for(const d of test.dimensions) dims[d.code] = { raw: 0, to100: 0, meta: d };

    for(let i=0;i<test.questions.length;i++){
      const q = test.questions[i];
      const ans = answers[i];
      const s = scoreAnswer(q, ans);
      dims[q.dim].raw += s * (q.weight || 1);
    }

    for(const code of Object.keys(dims)){
      const raw = dims[code].raw;
      dims[code].to100 = Math.round((raw - 3) / 12 * 100);
    }

    const sorted = Object.values(dims).sort((a,b) => b.raw - a.raw);
    const primary = sorted[0];
    const secondary = sorted[1];
    const diff = primary.raw - secondary.raw;
    const isMix = diff <= (test.scoring?.ranking?.mixThresholdRawDiff ?? 2);

    let resultTitle = "";
    let result = null;

    if(!isMix){
      const t = test.results.singleTypes[primary.meta.code];
      resultTitle = t.poster?.title || t.name;
      result = {
        kind: "single",
        code: primary.meta.code,
        primaryCode: primary.meta.code,
        secondaryCode: secondary.meta.code,
        diff,
        dims,
        content: t
      };
    }else{
      const ctx = { primary: primary.meta, secondary: secondary.meta };
      const mt = test.results.mixTemplates;
      const poster = mt.poster ? {
        title: renderTemplate(mt.poster.title, ctx),
        subtitle: renderTemplate(mt.poster.subtitle, ctx),
        lines: renderTemplateArray(mt.poster.lines, ctx),
        hashtags: mt.poster.hashtags || [],
        footer: mt.poster.footer || ""
      } : null;

      const content = {
        title: renderTemplate(mt.title, ctx),
        subtitle: renderTemplate(mt.subtitle, ctx),
        body: renderTemplateArray(mt.body, ctx),
        shareCopy: renderTemplate(mt.shareCopy, ctx),
        poster
      };
      resultTitle = content.title;
      result = {
        kind: "mix",
        code: primary.meta.code + "x" + secondary.meta.code,
        primaryCode: primary.meta.code,
        secondaryCode: secondary.meta.code,
        diff,
        dims,
        content
      };
    }

    // share caption
    const hashtags = (test.share?.defaultHashtags || []).join(" ");
    const needLine = (test.dimensions.find(d => d.code === result.primaryCode)?.coreNeed) || "";
    const captionTpl = (test.share?.captionTemplates || [])[0] || "我的结果：{{resultTitle}}\n{{hashtags}}";
    const caption = renderTemplate(captionTpl, {
      resultTitle: resultTitle.replace("安全感密码：", ""),
      needLine,
      hashtags
    });
    result.share = { caption, hashtags };

    // compact payload for share link
    result.sharePayload = {
      v: 1,
      testKey: "relationship",
      nickname: state.nickname || "",
      ts: nowISO(),
      kind: result.kind,
      primary: result.primaryCode,
      secondary: result.secondaryCode,
      diff: result.diff,
      dims100: Object.fromEntries(Object.entries(result.dims).map(([k,v]) => [k, v.to100]))
    };

    return result;
  }

  function pickTier(eli, tiers){
    for(const t of (tiers || [])){
      if(eli >= t.min && eli <= t.max) return t.label;
    }
    return "未知";
  }

  function evalCondition(dim100, cond){
    const v = dim100[cond.dim];
    if(v == null) return false;
    switch(cond.op){
      case ">=": return v >= cond.value;
      case "<=": return v <= cond.value;
      case ">": return v > cond.value;
      case "<": return v < cond.value;
      case "==": return v === cond.value;
      default: return false;
    }
  }

  function matchArchetype(dim100, arche){
    const when = arche.when || {};
    const all = when.all || [];
    const any = when.any || [];
    const allOk = all.every(c => evalCondition(dim100, c));
    const anyOk = any.length ? any.some(c => evalCondition(dim100, c)) : true;
    return allOk && anyOk;
  }

  function computeEmotional(test, answers){
    const dims = {};
    for(const d of test.dimensions) dims[d.code] = { raw: 0, to100: 0, meta: d };

    for(let i=0;i<test.questions.length;i++){
      const q = test.questions[i];
      const ans = answers[i];
      const s = scoreAnswer(q, ans);
      dims[q.dim].raw += s * (q.weight || 1);
    }

    const dim100 = {};
    for(const code of Object.keys(dims)){
      const raw = dims[code].raw;
      const to100 = Math.round((raw - 4) / 16 * 100);
      dims[code].to100 = to100;
      dim100[code] = to100;
    }

    const exhaustion = Math.round((dim100.OUT + dim100.MASK + dim100.FIX) / 3);
    const protection = Math.round((dim100.BND + dim100.REC + dim100.EXP) / 3);
    const ELI = Math.round(0.7 * exhaustion + 0.3 * (100 - protection));
    const tier = pickTier(ELI, test.scoring?.indexes?.tiers || []);

    // driver and weak
    const driverCandidates = ["OUT","MASK","FIX"].map(code => ({ code, v: dim100[code] })).sort((a,b)=> b.v - a.v);
    const driver = driverCandidates[0];
    const weakCandidates = ["BND","REC","EXP"].map(code => ({ code, v: dim100[code] })).sort((a,b)=> a.v - b.v);
    const weak = weakCandidates[0];

    // archetype
    let arche = null;
    for(const a of (test.results?.archetypes || [])){
      if(matchArchetype(dim100, a)){ arche = a; break; }
    }
    if(!arche){
      const map = test.results?.fallback?.driverToArchetype || {};
      const fallbackCode = map[driver.code] || (test.results?.archetypes?.[0]?.code);
      arche = (test.results?.archetypes || []).find(x => x.code === fallbackCode) || (test.results?.archetypes || [])[0];
    }

    const driverMeta = test.dimensions.find(d => d.code === driver.code);
    const weakMeta = test.dimensions.find(d => d.code === weak.code);
    const weakFix = (weakMeta?.microFix || [])[0] || "先从一个小动作开始";

    const chips = test.results?.personalizationChips || {};
    const chipCtx = {
      driverName: driverMeta?.name || driver.code,
      driverMeaning: driverMeta?.meaning || "",
      weakName: weakMeta?.name || weak.code,
      weakFix,
      ELI: String(ELI),
      tier
    };
    const driverLine = renderTemplate(chips.driverLineTemplate || "主消耗：{{driverName}}", chipCtx);
    const weakLine = renderTemplate(chips.weakLineTemplate || "短板：{{weakName}}", chipCtx);
    const eliLine = renderTemplate(chips.eliLineTemplate || "指数：{{ELI}}（{{tier}}）", chipCtx);

    // share caption
    const hashtags = (test.share?.defaultHashtags || []).join(" ");
    const oneAction = (arche.repair || [])[0] || weakFix;
    const captionTpl = (test.share?.captionTemplates || [])[0] || "我的情绪劳动指数：{{ELI}}（{{tier}}）\n{{hashtags}}";
    const caption = renderTemplate(captionTpl, {
      ELI: String(ELI),
      tier,
      archetypeName: arche.name,
      driverName: driverMeta?.name || driver.code,
      weakName: weakMeta?.name || weak.code,
      oneAction,
      hashtags
    });

    const result = {
      kind: "archetype",
      dims,
      dim100,
      exhaustion,
      protection,
      ELI,
      tier,
      driver: { ...driver, meta: driverMeta },
      weak: { ...weak, meta: weakMeta },
      archetype: arche,
      chips: { eliLine, driverLine, weakLine },
      share: { caption, hashtags }
    };

    result.sharePayload = {
      v: 1,
      testKey: "emotional",
      nickname: state.nickname || "",
      ts: nowISO(),
      ELI,
      tier,
      archetypeCode: arche.code,
      driver: driver.code,
      weak: weak.code,
      dim100
    };

    return result;
  }

  // --- share link encode/decode ---
  function buildShareLink(payload){
    const base = location.href.split("#")[0];
    const code = b64urlEncode(JSON.stringify(payload));
    return base + "#share=" + encodeURIComponent(code);
  }

  function loadFromShare(){
    const params = parseHash();
    const share = params.get("share");
    if(!share) return false;

    try{
      const decoded = b64urlDecode(decodeURIComponent(share));
      const payload = JSON.parse(decoded);

      if(payload?.testKey === "relationship"){
        state.testKey = "relationship";
        state.nickname = payload.nickname || "";
        // reconstruct a minimal result using codes and test templates
        const test = tests.relationship;
        const primaryMeta = test.dimensions.find(d=>d.code===payload.primary);
        const secondaryMeta = test.dimensions.find(d=>d.code===payload.secondary);
        const isMix = (payload.kind === "mix") || ((payload.diff ?? 99) <= (test.scoring?.ranking?.mixThresholdRawDiff ?? 2));

        let res = null;
        if(!isMix){
          const t = test.results.singleTypes[payload.primary];
          res = {
            kind: "single",
            code: payload.primary,
            primaryCode: payload.primary,
            secondaryCode: payload.secondary,
            diff: payload.diff ?? 99,
            dims: Object.fromEntries(Object.entries(payload.dims100 || {}).map(([k,v]) => [k, { to100: v, raw: 0, meta: test.dimensions.find(d=>d.code===k) } ])),
            content: t,
            share: { caption: t.shareCopy || "", hashtags: (test.share?.defaultHashtags||[]).join(" ") },
            sharePayload: payload
          };
        }else{
          const mt = test.results.mixTemplates;
          const ctx = { primary: primaryMeta, secondary: secondaryMeta };
          const poster = mt.poster ? {
            title: renderTemplate(mt.poster.title, ctx),
            subtitle: renderTemplate(mt.poster.subtitle, ctx),
            lines: renderTemplateArray(mt.poster.lines, ctx),
            hashtags: mt.poster.hashtags || [],
            footer: mt.poster.footer || ""
          } : null;

          const content = {
            title: renderTemplate(mt.title, ctx),
            subtitle: renderTemplate(mt.subtitle, ctx),
            body: renderTemplateArray(mt.body, ctx),
            shareCopy: renderTemplate(mt.shareCopy, ctx),
            poster
          };
          res = {
            kind: "mix",
            code: payload.primary + "x" + payload.secondary,
            primaryCode: payload.primary,
            secondaryCode: payload.secondary,
            diff: payload.diff ?? 0,
            dims: Object.fromEntries(Object.entries(payload.dims100 || {}).map(([k,v]) => [k, { to100: v, raw: 0, meta: test.dimensions.find(d=>d.code===k) } ])),
            content,
            share: { caption: content.shareCopy || "", hashtags: (test.share?.defaultHashtags||[]).join(" ") },
            sharePayload: payload
          };
        }

        state.result = res;
        state.screen = "result";
        state.fromShare = true;
        appEl.dataset.screen = "result";
        render();
        toast("已打开分享结果");
        return true;
      }

      if(payload?.testKey === "emotional"){
        state.testKey = "emotional";
        state.nickname = payload.nickname || "";
        const test = tests.emotional;

        const arche = (test.results?.archetypes || []).find(a => a.code === payload.archetypeCode) || (test.results?.archetypes || [])[0];

        const driverMeta = test.dimensions.find(d => d.code === payload.driver);
        const weakMeta = test.dimensions.find(d => d.code === payload.weak);
        const weakFix = (weakMeta?.microFix || [])[0] || "先从一个小动作开始";

        const chips = test.results?.personalizationChips || {};
        const chipCtx = {
          driverName: driverMeta?.name || payload.driver,
          driverMeaning: driverMeta?.meaning || "",
          weakName: weakMeta?.name || payload.weak,
          weakFix,
          ELI: String(payload.ELI),
          tier: payload.tier
        };
        const driverLine = renderTemplate(chips.driverLineTemplate || "主消耗：{{driverName}}", chipCtx);
        const weakLine = renderTemplate(chips.weakLineTemplate || "短板：{{weakName}}", chipCtx);
        const eliLine = renderTemplate(chips.eliLineTemplate || "指数：{{ELI}}（{{tier}}）", chipCtx);

        const res = {
          kind: "archetype",
          dim100: payload.dim100 || {},
          exhaustion: null,
          protection: null,
          ELI: payload.ELI,
          tier: payload.tier,
          driver: { code: payload.driver, meta: driverMeta },
          weak: { code: payload.weak, meta: weakMeta },
          archetype: arche,
          chips: { eliLine, driverLine, weakLine },
          share: { caption: "", hashtags: (test.share?.defaultHashtags||[]).join(" ") },
          sharePayload: payload
        };

        state.result = res;
        state.screen = "result";
        state.fromShare = true;
        appEl.dataset.screen = "result";
        render();
        toast("已打开分享结果");
        return true;
      }
    }catch(e){
      toast("分享链接解析失败");
      return false;
    }

    return false;
  }

  // --- navigation ---
  function goHome(){
    state.screen = "home";
    state.testKey = null;
    state.qIndex = 0;
    state.answers = [];
    state.result = null;
    state.fromShare = false;
    appEl.dataset.screen = "home";
    // keep hash clean (optional)
    // setHash(new URLSearchParams());
    render();
  }

  function startIntro(key){
    const test = tests[key];
    if(!test){ toast("未找到题库"); return; }
    state.screen = "intro";
    state.testKey = key;
    state.qIndex = 0;
    state.answers = [];
    state.result = null;
    state.startedAt = nowISO();
    state.fromShare = false;
    appEl.dataset.screen = "intro";
    render();
  }

  function startTest(key, fromResume=false){
    const test = tests[key];
    if(!test){ toast("未找到题库"); return; }

    // initialize answers
    if(!fromResume){
      state.answers = new Array(test.questions.length).fill(null);
      state.qIndex = 0;
      state.startedAt = nowISO();
    }

    state.screen = "quiz";
    state.testKey = key;
    state.result = null;
    state.fromShare = false;
    appEl.dataset.screen = "quiz";
    saveProgress();
    render();
  }

  function finishTest(){
    const test = tests[state.testKey];
    const firstNull = state.answers.findIndex(a => a == null);
    if(firstNull >= 0){
      state.qIndex = firstNull;
      saveProgress();
      toast("还有题没答完哦～");
      render();
      return;
    }

    // fake loading (product feel)
    showModal("正在生成你的结果…", "再等一下下，我们在把你的答案翻译成更清晰的“你需要什么”。");

    setTimeout(() => {
      hideModal();
      let res = null;
      if(state.testKey === "relationship") res = computeRelationship(test, state.answers);
      else res = computeEmotional(test, state.answers);

      state.result = res;
      state.screen = "result";
      appEl.dataset.screen = "result";
      saveProgress(); // keep
      render();

      // also store result in hash? we only do when user clicks "复制分享链接"
    }, 520);
  }

  function hardReset(){
    clearProgress();
    // clear hash
    setHash(new URLSearchParams());
    toast("已重置");
    goHome();
  }

  // --- Modal ---
  function ensureModal(){
    let m = document.getElementById("modal");
    if(m) return m;

    m = document.createElement("div");
    m.id = "modal";
    m.className = "modal";
    m.innerHTML = `
      <div class="panel">
        <h3 id="modal-title"></h3>
        <p id="modal-body"></p>
        <div style="margin-top:12px; display:flex; justify-content:flex-end; gap:10px;">
          <button id="modal-close" class="btn ghost small">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(m);
    m.querySelector("#modal-close").addEventListener("click", hideModal);
    m.addEventListener("click", (e) => { if(e.target === m) hideModal(); });
    return m;
  }

  function showModal(title, body){
    const m = ensureModal();
    m.querySelector("#modal-title").textContent = title || "";
    m.querySelector("#modal-body").textContent = body || "";
    m.classList.add("show");
  }
  function hideModal(){
    const m = document.getElementById("modal");
    if(m) m.classList.remove("show");
  }

  // --- poster export (PNG) ---
  function wrapText(ctx, text, x, y, maxWidth, lineHeight){
    const words = String(text).split("");
    let line = "";
    const lines = [];
    for(const ch of words){
      const testLine = line + ch;
      const w = ctx.measureText(testLine).width;
      if(w > maxWidth && line){
        lines.push(line);
        line = ch;
      }else{
        line = testLine;
      }
    }
    if(line) lines.push(line);

    for(let i=0;i<lines.length;i++){
      ctx.fillText(lines[i], x, y + i * lineHeight);
    }
    return lines.length;
  }

  function wrapLines(ctx, text, maxWidth){
    const chars = String(text ?? "").split("");
    let line = "";
    const lines = [];
    for(const ch of chars){
      const testLine = line + ch;
      const w = ctx.measureText(testLine).width;
      if(w > maxWidth && line){
        lines.push(line);
        line = ch;
      }else{
        line = testLine;
      }
    }
    if(line) lines.push(line);
    return lines;
  }

  function drawWrapped(ctx, text, x, y, maxWidth, lineHeight){
    const lines = wrapLines(ctx, text, maxWidth);
    for(let i=0;i<lines.length;i++){
      ctx.fillText(lines[i], x, y + i * lineHeight);
    }
    return lines.length;
  }

  function drawPill(ctx, text, x, y, style){
    const s = style || {};
    const font = s.font || ("800 24px " + getFontStack());
    const padX = s.padX ?? 22;
    const h = s.h ?? 46;
    const radius = s.radius ?? 999;
    ctx.save();
    ctx.font = font;
    const tw = ctx.measureText(text).width;
    const w = tw + padX * 2;
    ctx.fillStyle = s.bg || "rgba(0,0,0,0.05)";
    roundRect(ctx, x, y, w, h, radius, true, false);
    ctx.strokeStyle = s.stroke || "rgba(0,0,0,0.10)";
    ctx.lineWidth = s.lineWidth ?? 2;
    roundRect(ctx, x, y, w, h, radius, false, true);
    ctx.fillStyle = s.color || "rgba(0,0,0,0.60)";
    // baseline
    const textY = y + Math.floor(h * 0.70);
    ctx.fillText(text, x + padX, textY);
    ctx.restore();
    return { w, h };
  }

  function drawDivider(ctx, x, y, w){
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.restore();
  }

  function drawBulletList(ctx, items, x, y, maxWidth, opts){
    const o = opts || {};
    const dotR = o.dotR ?? 7;
    const gap = o.gap ?? 18;
    const lineHeight = o.lineHeight ?? 44;
    const textX = x + (o.indent ?? 26);
    const textW = maxWidth - (textX - x);

    ctx.save();
    for(const item of (items || [])){
      // dot
      ctx.fillStyle = o.dotColor || "rgba(124,92,255,0.85)";
      ctx.beginPath();
      ctx.arc(x + dotR, y - 10, dotR, 0, Math.PI * 2);
      ctx.fill();

      // text
      ctx.fillStyle = o.textColor || "#111";
      const lines = wrapLines(ctx, item, textW);
      for(let i=0;i<lines.length;i++){
        ctx.fillText(lines[i], textX, y + i * lineHeight);
      }
      y += lines.length * lineHeight + gap;
    }
    ctx.restore();
    return y;
  }

  function drawBarList(ctx, rows, x, y, w, opts){
    const o = opts || {};
    const rowH = o.rowH ?? 54;
    const nameW = o.nameW ?? 220;
    const valueW = o.valueW ?? 70;
    const trackH = o.trackH ?? 16;
    const gap = o.gap ?? 14;

    const trackX = x + nameW + 14;
    const trackW = w - nameW - valueW - 14 - 10;

    ctx.save();
    for(const r of (rows || [])){
      const name = r.name || "";
      const v = Math.max(0, Math.min(100, r.value ?? 0));

      // name
      ctx.fillStyle = o.nameColor || "rgba(0,0,0,0.60)";
      ctx.font = o.nameFont || ("800 24px " + getFontStack());
      ctx.fillText(name, x, y + 34);

      // track
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      roundRect(ctx, trackX, y + 18, trackW, trackH, 999, true, false);

      // fill (gradient)
      const g = ctx.createLinearGradient(trackX, 0, trackX + trackW, 0);
      g.addColorStop(0, "rgba(255,77,109,0.75)");
      g.addColorStop(0.55, "rgba(124,92,255,0.78)");
      g.addColorStop(1, "rgba(43,217,198,0.65)");
      ctx.fillStyle = g;
      roundRect(ctx, trackX, y + 18, trackW * (v/100), trackH, 999, true, false);

      // value
      ctx.fillStyle = o.valueColor || "rgba(0,0,0,0.55)";
      ctx.font = o.valueFont || ("800 24px " + getFontStack());
      const valText = String(v);
      ctx.fillText(valText, x + w - valueW, y + 34);

      y += rowH + gap;
    }
    ctx.restore();
    return y;
  }

  // --- Poster export (1080x1440, more XHS-like) ---
  function downloadPosterPNG(poster, opts){
    const w = 1080;
    const h = 1440;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    // light background (XHS-friendly)
    const bg = ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0, "#fff6fb");
    bg.addColorStop(0.45, "#ffffff");
    bg.addColorStop(1, "#f2fbff");
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,w,h);

    // soft blobs
    function glow(cx, cy, r, color){
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, color);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.fill();
    }
    glow(220, 160, 360, "rgba(255,77,109,.16)");
    glow(880, 220, 420, "rgba(124,92,255,.18)");
    glow(760, 1180, 480, "rgba(43,217,198,.14)");

    // main card
    const pad = 72;
    const cardX = pad, cardY = 150, cardW = w - pad*2, cardH = h - 260;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    roundRect(ctx, cardX, cardY, cardW, cardH, 34, true, false);
    ctx.restore();

    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, 34, false, true);

    // top badge
    const badge = (opts?.testName ? opts.testName : "情绪价值测试") + " · 结果";
    drawPill(ctx, badge, cardX + 46, cardY + 40, {
      font: "900 24px " + getFontStack(),
      bg: "rgba(0,0,0,0.04)",
      stroke: "rgba(0,0,0,0.08)",
      color: "rgba(0,0,0,0.60)",
      h: 46
    });

    // title
    ctx.fillStyle = "#111";
    ctx.font = "950 58px " + getFontStack();
    const title = poster?.title || "你的结果海报";
    const used1 = drawWrapped(ctx, title, cardX + 46, cardY + 132, cardW - 92, 70);

    // subtitle
    ctx.fillStyle = "rgba(0,0,0,0.56)";
    ctx.font = "800 30px " + getFontStack();
    const subtitle = poster?.subtitle || "";
    const used2 = drawWrapped(ctx, subtitle, cardX + 46, cardY + 132 + used1*70 + 12, cardW - 92, 42);

    // divider
    const divY = cardY + 132 + used1*70 + 12 + used2*42 + 28;
    drawDivider(ctx, cardX + 46, divY, cardW - 92);

    // bullets
    ctx.fillStyle = "#111";
    ctx.font = "850 34px " + getFontStack();
    let y = divY + 70;
    const lines = (poster?.lines || []).slice(0, 5);
    y = drawBulletList(ctx, lines, cardX + 46, y, cardW - 92, {
      dotR: 7,
      indent: 30,
      lineHeight: 46,
      gap: 22,
      dotColor: "rgba(124,92,255,0.85)",
      textColor: "#111"
    });

    // hashtags
    const tags = (poster?.hashtags || []).slice(0, 10);
    ctx.fillStyle = "rgba(0,0,0,0.56)";
    ctx.font = "800 28px " + getFontStack();
    const tagLine = tags.map(t => (t.startsWith("#") ? t : ("#" + t))).join("  ");
    const tagY = Math.min(cardY + cardH - 200, y + 10);
    drawWrapped(ctx, tagLine, cardX + 46, tagY, cardW - 92, 40);

    // footer + meta
    const footer = poster?.footer || "仅供自我探索｜不构成诊断";
    const nickname = (opts?.nickname || "").trim();
    const dateText = (opts?.dateText || "").trim();

    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.font = "700 24px " + getFontStack();
    const meta = [nickname ? ("昵称：" + nickname) : "", dateText].filter(Boolean).join(" · ");
    if(meta){
      ctx.fillText(meta, cardX + 46, cardY + cardH - 84);
    }
    ctx.fillText(footer, cardX + 46, cardY + cardH - 46);

    // download
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = (opts?.filename || "poster") + ".png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast("海报已下载");
  }

  // --- Long report export (full result page as a single long image) ---
  function downloadRelationshipReportPNG(res, opts){
    const test = tests.relationship;
    const w = 1080;
    const tmpH = 4200;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = tmpH;
    const ctx = canvas.getContext("2d");

    // bg
    const bg = ctx.createLinearGradient(0,0,w,tmpH);
    bg.addColorStop(0, "#fff6fb");
    bg.addColorStop(0.45, "#ffffff");
    bg.addColorStop(1, "#f2fbff");
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,w,tmpH);

    // decorative blobs
    function glow(cx, cy, r, color){
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, color);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.fill();
    }
    glow(220, 180, 420, "rgba(255,77,109,.14)");
    glow(900, 240, 520, "rgba(124,92,255,.16)");
    glow(780, 1680, 640, "rgba(43,217,198,.12)");

    const pad = 72;
    let y = 90;

    // header
    drawPill(ctx, (test.meta.title || "亲密关系安全感来源测试") + " · 结果报告", pad, y, {
      font: "900 26px " + getFontStack(),
      bg: "rgba(255,255,255,0.70)",
      stroke: "rgba(0,0,0,0.08)",
      color: "rgba(0,0,0,0.60)",
      h: 50
    });
    y += 90;

    // compute content
    let headerTitle = "";
    let headerSub = "";
    let comfort = "";
    let strengths = [];
    let pitfalls = [];
    let repair = [];

    if(res.kind === "single"){
      const t = test.results.singleTypes[res.primaryCode || res.code];
      headerTitle = t?.poster?.title || t?.name || "你的结果";
      headerSub = t?.tagline || test.meta.subtitle || "";
      comfort = t?.comfort || "";
      strengths = (t?.strengths || []).slice(0, 6);
      pitfalls = (t?.pitfalls || []).slice(0, 6);
      repair = (t?.repair || []).slice(0, 6);
    }else{
      headerTitle = res.content?.title || "你的结果";
      headerSub = res.content?.subtitle || test.meta.subtitle || "";
      comfort = "你不是“作”，你只是有明确的安全感证据偏好。把它说清楚，关系会更省力。";
      strengths = ["更清楚自己需要什么","更容易把情绪翻译成可执行动作","更容易建立可持续的相处规则"];
      pitfalls = ["主需求被触发时，容易高估风险","对方不懂你的证据语言时，容易误会"];
      repair = ["把主需求写成一个可执行动作","把次需求当作加分项而不是考试题","先要可预期，再谈浪漫"];
    }

    // title
    ctx.fillStyle = "#111";
    ctx.font = "950 60px " + getFontStack();
    const usedT = drawWrapped(ctx, headerTitle, pad, y, w - pad*2, 72);
    y += usedT*72 + 10;

    // subtitle
    ctx.fillStyle = "rgba(0,0,0,0.56)";
    ctx.font = "800 30px " + getFontStack();
    const usedS = drawWrapped(ctx, headerSub, pad, y, w - pad*2, 42);
    y += usedS*42 + 18;

    // meta
    const nickname = (opts?.nickname || "").trim();
    const dateText = (opts?.dateText || "").trim();
    const meta = [nickname ? ("昵称：" + nickname) : "", dateText].filter(Boolean).join(" · ");
    if(meta){
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.font = "700 24px " + getFontStack();
      ctx.fillText(meta, pad, y + 26);
      y += 52;
    }

    drawDivider(ctx, pad, y, w - pad*2);
    y += 56;

    // dimension bars
    ctx.fillStyle = "#111";
    ctx.font = "900 34px " + getFontStack();
    ctx.fillText("维度得分（0-100）", pad, y);
    y += 26;

    const rows = (test.dimensions || []).map(d => {
      const v = res.dims?.[d.code]?.to100 ?? (res.sharePayload?.dims100?.[d.code] ?? 0);
      return { name: d.shortName || d.name || d.code, value: v };
    });
    y += 18;
    y = drawBarList(ctx, rows, pad, y, w - pad*2, { rowH: 50, gap: 10, nameW: 240, valueW: 60 });

    y += 10;
    drawDivider(ctx, pad, y, w - pad*2);
    y += 56;

    // top3
    const dims100 = Object.fromEntries(rows.map(r => [r.name, r.value]));
    const top3 = rows.slice().sort((a,b)=>b.value-a.value).slice(0,3).map(r => `${r.name} ${r.value}`);
    ctx.fillStyle = "#111";
    ctx.font = "900 34px " + getFontStack();
    ctx.fillText("你最强的 3 个安全感证据", pad, y);
    y += 52;

    ctx.font = "850 32px " + getFontStack();
    y = drawBulletList(ctx, top3, pad, y, w - pad*2, { dotR: 7, indent: 30, lineHeight: 44, gap: 14 });

    y += 6;
    drawDivider(ctx, pad, y, w - pad*2);
    y += 56;

    // sections
    function section(title, bodyText, list){
      ctx.fillStyle = "#111";
      ctx.font = "900 34px " + getFontStack();
      ctx.fillText(title, pad, y);
      y += 52;

      if(bodyText){
        ctx.fillStyle = "rgba(0,0,0,0.70)";
        ctx.font = "750 30px " + getFontStack();
        const used = drawWrapped(ctx, bodyText, pad, y, w - pad*2, 44);
        y += used*44 + 18;
      }

      if(list && list.length){
        ctx.fillStyle = "#111";
        ctx.font = "800 30px " + getFontStack();
        y = drawBulletList(ctx, list, pad, y, w - pad*2, { dotR: 6, indent: 28, lineHeight: 42, gap: 12, dotColor: "rgba(255,77,109,0.70)" });
      }

      y += 6;
      drawDivider(ctx, pad, y, w - pad*2);
      y += 56;
    }

    section("安慰句", comfort, null);
    section("你的优势", null, strengths);
    section("容易踩的雷区", null, pitfalls);
    section("微修复建议（今天就能做）", null, repair);

    // hashtags + footer
    const tags = (test.share?.defaultHashtags || []).slice(0, 10).map(t => (t.startsWith("#") ? t : ("#" + t))).join("  ");
    ctx.fillStyle = "rgba(0,0,0,0.56)";
    ctx.font = "800 28px " + getFontStack();
    const usedH = drawWrapped(ctx, tags, pad, y, w - pad*2, 40);
    y += usedH*40 + 18;

    ctx.fillStyle = "rgba(0,0,0,0.40)";
    ctx.font = "650 24px " + getFontStack();
    const foot = "仅供自我探索｜不构成心理/医学诊断｜建议把需求说成“可执行动作”";
    const usedF = drawWrapped(ctx, foot, pad, y, w - pad*2, 34);
    y += usedF*34 + 60;

    // crop
    const outH = Math.min(tmpH, Math.max(1400, Math.ceil(y)));
    const out = document.createElement("canvas");
    out.width = w;
    out.height = outH;
    out.getContext("2d").drawImage(canvas, 0, 0, w, outH, 0, 0, w, outH);

    const url = out.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = (opts?.filename || "relationship_report") + ".png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast("长图已导出");
  }

  function downloadEmotionalReportPNG(res, opts){
    const test = tests.emotional;
    const w = 1080;
    const tmpH = 4200;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = tmpH;
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0,0,w,tmpH);
    bg.addColorStop(0, "#fff6fb");
    bg.addColorStop(0.45, "#ffffff");
    bg.addColorStop(1, "#f2fbff");
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,w,tmpH);

    function glow(cx, cy, r, color){
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, color);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.fill();
    }
    glow(240, 180, 420, "rgba(124,92,255,.14)");
    glow(900, 240, 520, "rgba(255,77,109,.14)");
    glow(760, 1680, 640, "rgba(43,217,198,.12)");

    const pad = 72;
    let y = 90;

    drawPill(ctx, (test.meta.title || "情绪劳动指数测试") + " · 结果报告", pad, y, {
      font: "900 26px " + getFontStack(),
      bg: "rgba(255,255,255,0.70)",
      stroke: "rgba(0,0,0,0.08)",
      color: "rgba(0,0,0,0.60)",
      h: 50
    });
    y += 90;

    const a = res.archetype || {};
    const title = `情绪劳动指数：${res.ELI}（${res.tier}）`;
    const sub = `画像：${a.name || "未命名"}｜${a.tagline || ""}`;

    ctx.fillStyle = "#111";
    ctx.font = "950 60px " + getFontStack();
    const usedT = drawWrapped(ctx, title, pad, y, w - pad*2, 72);
    y += usedT*72 + 10;

    ctx.fillStyle = "rgba(0,0,0,0.56)";
    ctx.font = "800 30px " + getFontStack();
    const usedS = drawWrapped(ctx, sub, pad, y, w - pad*2, 42);
    y += usedS*42 + 18;

    const nickname = (opts?.nickname || "").trim();
    const dateText = (opts?.dateText || "").trim();
    const meta = [nickname ? ("昵称：" + nickname) : "", dateText].filter(Boolean).join(" · ");
    if(meta){
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.font = "700 24px " + getFontStack();
      ctx.fillText(meta, pad, y + 26);
      y += 52;
    }

    drawDivider(ctx, pad, y, w - pad*2);
    y += 56;

    // chips
    ctx.fillStyle = "#111";
    ctx.font = "900 34px " + getFontStack();
    ctx.fillText("三句话说明你为什么会累", pad, y);
    y += 52;

    ctx.fillStyle = "rgba(0,0,0,0.70)";
    ctx.font = "800 30px " + getFontStack();
    const chipLines = [
      res.chips?.eliLine || "",
      res.chips?.driverLine || "",
      res.chips?.weakLine || ""
    ].filter(Boolean).slice(0,3);
    y = drawBulletList(ctx, chipLines, pad, y, w - pad*2, { dotR: 6, indent: 28, lineHeight: 42, gap: 12, dotColor: "rgba(124,92,255,0.75)" });

    y += 6;
    drawDivider(ctx, pad, y, w - pad*2);
    y += 56;

    // bars
    ctx.fillStyle = "#111";
    ctx.font = "900 34px " + getFontStack();
    ctx.fillText("可视化：消耗 vs 保护（0-100）", pad, y);
    y += 52;

    const cost = ["OUT","MASK","FIX"].map(code => ({
      name: (test.dimensions.find(d=>d.code===code)?.name || code),
      value: res.dim100?.[code] ?? 0
    }));
    const protect = ["BND","REC","EXP"].map(code => ({
      name: (test.dimensions.find(d=>d.code===code)?.name || code),
      value: res.dim100?.[code] ?? 0
    }));

    ctx.font = "850 30px " + getFontStack();
    ctx.fillStyle = "rgba(0,0,0,0.70)";
    ctx.fillText("消耗项（越高越累）", pad, y);
    y += 20;
    y = drawBarList(ctx, cost, pad, y + 10, w - pad*2, { rowH: 50, gap: 10, nameW: 300, valueW: 60 });

    y += 12;
    ctx.fillText("保护项（越高越能扛）", pad, y);
    y = drawBarList(ctx, protect, pad, y + 20, w - pad*2, { rowH: 50, gap: 10, nameW: 300, valueW: 60 });

    y += 6;
    drawDivider(ctx, pad, y, w - pad*2);
    y += 56;

    // sections
    function section(title, bodyText, list){
      ctx.fillStyle = "#111";
      ctx.font = "900 34px " + getFontStack();
      ctx.fillText(title, pad, y);
      y += 52;

      if(bodyText){
        ctx.fillStyle = "rgba(0,0,0,0.70)";
        ctx.font = "750 30px " + getFontStack();
        const used = drawWrapped(ctx, bodyText, pad, y, w - pad*2, 44);
        y += used*44 + 18;
      }

      if(list && list.length){
        ctx.fillStyle = "#111";
        ctx.font = "800 30px " + getFontStack();
        y = drawBulletList(ctx, list, pad, y, w - pad*2, { dotR: 6, indent: 28, lineHeight: 42, gap: 12, dotColor: "rgba(255,77,109,0.70)" });
      }

      y += 6;
      drawDivider(ctx, pad, y, w - pad*2);
      y += 56;
    }

    section("安慰句", a.comfort || "你不是脆弱，你只是长期超负荷。", null);
    section("你的优势", null, (a.strengths || []).slice(0, 6));
    section("容易踩的雷区", null, (a.pitfalls || []).slice(0, 6));
    section("微修复建议（今天先做一条）", `今天先做：${(a.repair || [])[0] || "先停一下"}`, (a.repair || []).slice(0, 6));

    const tags = (test.share?.defaultHashtags || []).slice(0, 10).map(t => (t.startsWith("#") ? t : ("#" + t))).join("  ");
    ctx.fillStyle = "rgba(0,0,0,0.56)";
    ctx.font = "800 28px " + getFontStack();
    const usedH = drawWrapped(ctx, tags, pad, y, w - pad*2, 40);
    y += usedH*40 + 18;

    ctx.fillStyle = "rgba(0,0,0,0.40)";
    ctx.font = "650 24px " + getFontStack();
    const foot = "仅供自我探索｜不构成心理/医学诊断｜如果你长期高负荷，请优先把休息公开化";
    const usedF = drawWrapped(ctx, foot, pad, y, w - pad*2, 34);
    y += usedF*34 + 60;

    const outH = Math.min(tmpH, Math.max(1400, Math.ceil(y)));
    const out = document.createElement("canvas");
    out.width = w;
    out.height = outH;
    out.getContext("2d").drawImage(canvas, 0, 0, w, outH, 0, 0, w, outH);

    const url = out.toDataURL("image/png");
    const aEl = document.createElement("a");
    aEl.href = url;
    aEl.download = (opts?.filename || "eli_report") + ".png";
    document.body.appendChild(aEl);
    aEl.click();
    document.body.removeChild(aEl);
    toast("长图已导出");
  }

  function downloadReportPNG(res, opts){
    const key = opts?.testKey || state.testKey;
    if(key === "relationship") return downloadRelationshipReportPNG(res, opts);
    return downloadEmotionalReportPNG(res, opts);
  }
  function roundRect(ctx, x, y, w, h, r, fill, stroke){
    const radius = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    if(fill) ctx.fill();
    if(stroke) ctx.stroke();
  }

  function getFontStack(){
    // Use system fonts; canvas will pick available
    return `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC"`;
  }

  // --- chart helpers ---
  function radarSVG(dimList, values, size=240){
    // dimList: [{code, label}]
    // values: map code -> 0..100
    const cx = size/2, cy = size/2;
    const r = size * 0.40;
    const n = dimList.length;

    function pt(i, rad){
      const ang = (-Math.PI/2) + (i * 2*Math.PI/n);
      return [cx + Math.cos(ang)*rad, cy + Math.sin(ang)*rad];
    }

    // grid rings
    const rings = [0.25, 0.5, 0.75, 1].map(k => {
      const pts = dimList.map((_,i)=>pt(i, r*k).join(",")).join(" ");
      return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1" />`;
    }).join("");

    // axes
    const axes = dimList.map((d,i)=>{
      const [x2,y2] = pt(i, r*1.05);
      return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.10)" stroke-width="1" />`;
    }).join("");

    // labels
    const labels = dimList.map((d,i)=>{
      const [x,y] = pt(i, r*1.23);
      const anchor = (x < cx - 10) ? "end" : ((x > cx + 10) ? "start" : "middle");
      return `<text x="${x}" y="${y}" fill="rgba(232,234,240,0.70)" font-size="11" text-anchor="${anchor}" dominant-baseline="middle">${d.label}</text>`;
    }).join("");

    // data polygon
    const polyPts = dimList.map((d,i)=>{
      const v = Math.max(0, Math.min(100, values[d.code] ?? 0));
      const [x,y] = pt(i, r*(v/100));
      return `${x},${y}`;
    }).join(" ");

    const poly = `
      <polygon points="${polyPts}" fill="rgba(124,92,255,0.22)" stroke="rgba(124,92,255,0.85)" stroke-width="2" />
      <circle cx="${cx}" cy="${cy}" r="2.5" fill="rgba(43,217,198,0.9)" />
    `;

    return `
      <svg class="radar-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="维度雷达图" preserveAspectRatio="xMidYMid meet">
        ${rings}
        ${axes}
        ${poly}
        ${labels}
      </svg>
    `;
  }

  // --- UI ---
  function renderHome(){
    const saved = loadSaved() || {};
    const last = saved._last?.testKey || null;

    const g = el("div", {class:"grid"});
    const intro = withFade(el("div", {class:"card pad intro"}, [
      el("h2", {}, "选择一个测试"),
      el("p", {}, "更像线上产品的版本：✅ 断点续答 ✅ 自动下一题 ✅ 分享链接 ✅ 下载海报 PNG。"),
      el("div", {class:"meta"}, [
        el("span", {class:"pill"}, "建议手机打开体验更像产品"),
        el("span", {class:"pill"}, "可直接部署为静态站")
      ]),
      (last && saved[last]?.answers?.length) ? el("div", {class:"btnrow"}, [
        el("button", {class:"btn ok", onClick:()=>resumeTest(last)}, `继续上次：${tests[last]?.meta?.title || last} →`)
      ]) : null
    ]));

    g.appendChild(intro);

    g.appendChild(testCard("relationship"));
    g.appendChild(testCard("emotional"));

    return g;
  }

  function testCard(key){
    const t = tests[key];
    const saved = loadSaved() || {};
    const hasProgress = saved[key]?.answers?.some(a => a != null);

    return withFade(el("div", {class:"card pad home-card"}, [
      el("h2", {}, t?.meta?.title || key),
      el("p", {}, t?.meta?.subtitle || ""),
      el("div", {class:"meta"}, [
        el("span", {class:"pill"}, `${t?.meta?.questionCount || 0} 题`),
        el("span", {class:"pill"}, `${t?.meta?.estimatedTimeMinutes || 0} 分钟`),
        el("span", {class:"pill"}, key === "relationship" ? "主×次混合型" : "指数+画像"),
        hasProgress ? el("span", {class:"pill"}, "可续答") : null
      ].filter(Boolean)),
      el("div", {class:"btnrow"}, [
        el("button", {class:"btn primary", onClick:()=>startIntro(key)}, "开始 →"),
        hasProgress ? el("button", {class:"btn ghost", onClick:()=>resumeTest(key)}, "继续上次") : null
      ].filter(Boolean))
    ]));
  }

  function renderIntro(){
    const t = tests[state.testKey];
    const saved = loadSaved() || {};
    const prevNick = saved[state.testKey]?.nickname || "";
    if(!state.nickname && prevNick) state.nickname = prevNick;

    const isRel = state.testKey === "relationship";
    const expects = isRel ? [
      { t: "主×次安全感密码", d: "你最容易安心的“证据语言”是什么（主×次混合型）。" },
      { t: "雷区预警清单", d: "哪些细节最容易触发你的不安，提前避雷更省力。" },
      { t: "一条沟通句", d: "把需求从“情绪”翻译成“可执行动作”，马上能用。" }
    ] : [
      { t: "情绪劳动指数（0-100）", d: "你现在的负荷到底有多高（低/中/高）。" },
      { t: "主消耗来源", d: "你累主要来自：输出/面具/补位，找到“真凶”。" },
      { t: "今天就能减负的一步", d: "给你一条微修复动作：先让自己回到可持续状态。" }
    ];

    // pick a preview poster from config
    let previewPoster = null;
    try{
      if(isRel){
        const first = t.dimensions?.[0]?.code;
        previewPoster = t.results?.singleTypes?.[first]?.poster || null;
      }else{
        previewPoster = t.results?.archetypes?.[0]?.poster || null;
      }
    }catch(e){ previewPoster = null; }

    const g = el("div", {class:"grid"});

    const steps = el("div", {class:"steps"}, [
      el("div", {class:"step"}, [ el("span", {class:"n"}, "1"), "直觉作答" ]),
      el("div", {class:"step"}, [ el("span", {class:"n"}, "2"), "立即出结果" ]),
      el("div", {class:"step"}, [ el("span", {class:"n"}, "3"), "海报&长图可晒" ])
    ]);

    const card1 = withFade(el("div", {class:"card pad intro"}, [
      el("h2", {}, t.meta.title),
      el("p", {}, "3秒告诉你：测完你会得到什么👇"),
      steps,
      el("div", {class:"meta"}, [
        el("span", {class:"pill"}, `${t.meta.questionCount} 题`),
        el("span", {class:"pill"}, `约 ${t.meta.estimatedTimeMinutes} 分钟`),
        el("span", {class:"pill"}, "选完自动下一题"),
        el("span", {class:"pill"}, "可下载海报(1080×1440)"),
        el("span", {class:"pill"}, "可导出结果长图")
      ]),
      el("div", {class:"feature-grid"}, expects.map(x =>
        el("div", {class:"feature"}, [
          el("div", {class:"t"}, x.t),
          el("div", {class:"d"}, x.d)
        ])
      )),
      el("div", {class:"field"}, [
        el("div", {class:"label"}, "给海报加个昵称（可选）"),
        el("input", {
          class:"input",
          placeholder: "比如：小鱼 / 甜心 / 你的昵称",
          value: state.nickname,
          onInput: (e)=>{ state.nickname = e.target.value.slice(0, 12); saveProgress(); }
        })
      ]),
      el("div", {class:"privacy"}, [
        el("strong", {}, "隐私小提示："),
        " 你的作答只保存在本地浏览器（localStorage），不会上传到服务器。"
      ]),
      el("div", {class:"btnrow"}, [
        el("button", {class:"btn primary", onClick:()=>startTest(state.testKey, false)}, "开始答题 →"),
        el("button", {class:"btn ghost", onClick:()=>goHome()}, "返回选择")
      ])
    ]));

    const card2 = withFade(el("div", {class:"card pad intro"}, [
      el("h2", {}, "测完你会得到这样的可晒图"),
      el("p", {}, "建议：复制文案 → 配海报/长图 → 直接发小红书（更像线上产品）。"),
      previewPoster ? posterView(previewPoster) : el("p", {}, "（题库未配置海报预览）")
    ]));

    g.appendChild(card1);
    g.appendChild(card2);
    return g;
  }

  function resumeTest(key){
    const saved = loadSaved() || {};
    const p = saved[key];
    if(!p || !Array.isArray(p.answers)){
      toast("没有可续答的进度");
      startIntro(key);
      return;
    }
    state.testKey = key;
    state.answers = p.answers;
    state.qIndex = Math.min(p.qIndex ?? 0, (tests[key].questions.length-1));
    state.nickname = p.nickname || "";
    state.startedAt = p.startedAt || nowISO();
    startTest(key, true);
    toast("已续答");
  }

  function renderQuiz(){
    const test = tests[state.testKey];
    const q = test.questions[state.qIndex];
    const total = test.questions.length;
    const idx = state.qIndex + 1;

    const wrap = el("div", {class:"grid"});
    const card = withFade(el("div", {class:"card pad quiz"}));

    const top = el("div", {class:"quiz-top"}, [
      el("div", {class:"left"}, [
        el("button", {class:"btn ghost small", onClick:()=>prevQuestion()}, "← 上一题")
      ]),
      el("div", {class:"qindex"}, `${idx}/${total}`),
      el("div", {class:"right"}, [
        el("button", {class:"btn ghost small", onClick:()=>exitQuiz()}, "退出")
      ])
    ]);
    card.appendChild(top);

    const prog = el("div", {class:"progress"}, [ el("div") ]);
    prog.firstChild.style.width = `${Math.round((idx)/total*100)}%`;
    card.appendChild(prog);

    card.appendChild(el("div", {class:"qtitle"}, q.text));

    const choices = el("div", {class:"choices"});
    const scale = test.meta.scale.choices;
    const current = state.answers[state.qIndex];

    for(const c of scale){
      const id = `q${q.id}_v${c.value}`;
      const radio = el("input", {type:"radio", name:"q"+q.id, id, value:String(c.value)});
      if(current === c.value) radio.checked = true;

      radio.addEventListener("change", () => {
        state.answers[state.qIndex] = c.value;
        saveProgress();

        // auto next (product feel)
        const last = (state.qIndex >= total-1);
        setTimeout(() => {
          if(last) finishTest();
          else nextQuestion();
        }, state.autoNextDelayMs);
      });

      const row = el("label", {class:"choice", for:id}, [
        radio,
        el("div", {class:"labelrow"}, [
          el("div", {class:"l"}, c.label),
          el("div", {class:"r"}, `${c.value}分`)
        ])
      ]);
      choices.appendChild(row);
    }
    card.appendChild(choices);

    card.appendChild(el("div", {class:"notice"}, [
      el("strong", {}, "手势："),
      " 左滑下一题（需已选择），右滑上一题。"
    ]));

    // touch gestures
    let x0 = null;
    card.addEventListener("touchstart", (e) => { x0 = e.touches?.[0]?.clientX ?? null; }, {passive:true});
    card.addEventListener("touchend", (e) => {
      if(x0 == null) return;
      const x1 = e.changedTouches?.[0]?.clientX ?? null;
      if(x1 == null) return;
      const dx = x1 - x0;
      if(Math.abs(dx) < 50) return;
      if(dx < 0){
        // left
        if(state.answers[state.qIndex] == null){
          toast("先选择一个选项");
          return;
        }
        if(state.qIndex >= total-1) finishTest();
        else nextQuestion();
      }else{
        prevQuestion();
      }
    }, {passive:true});

    wrap.appendChild(card);
    return wrap;
  }

  function prevQuestion(){
    if(state.qIndex > 0){
      state.qIndex--;
      saveProgress();
      render();
    }else{
      toast("已经是第一题");
    }
  }
  function nextQuestion(){
    const test = tests[state.testKey];
    if(state.qIndex < test.questions.length-1){
      state.qIndex++;
      saveProgress();
      render();
    }else{
      finishTest();
    }
  }
  function exitQuiz(){
    showModal("要退出吗？", "进度已自动保存，下次可以继续答。");
    // in modal, user can close or click home
    // We'll allow home via toast
  }

  function posterView(poster){
    if(!poster) return el("div", {}, "");
    const tags = (poster.hashtags || []).map(t => el("span", {class:"tag"}, t));
    const dateText = new Date().toLocaleDateString("zh-CN");
    const nick = state.nickname ? ("昵称：" + state.nickname) : "昵称：未填写";

    return el("div", {class:"poster xhs"}, [
      el("div", {class:"ptitle"}, poster.title || ""),
      el("div", {class:"psub"}, poster.subtitle || ""),
      el("ul", {class:"plines"}, (poster.lines || []).map(x => el("li", {}, x))),
      el("div", {class:"ptags"}, tags),
      el("div", {class:"pmeta"}, [
        el("span", {class:"pill"}, nick),
        el("span", {class:"pill"}, dateText)
      ]),
      el("div", {class:"pfoot"}, poster.footer || "")
    ]);
  }

  function renderBars(title, rows){
    // rows: [{name, value}]
    const wrap = el("div", {class:"chart-wrap"}, [
      el("div", {class:"chart-title"}, title),
      el("div", {class:"bars"}, rows.map(r => {
        const fill = el("div", {class:"fill"});
        fill.style.width = Math.max(0, Math.min(100, r.value)) + "%";
        return el("div", {class:"bar"}, [
          el("div", {class:"name"}, r.name),
          el("div", {class:"track"}, [ fill ]),
          el("div", {class:"val"}, String(r.value))
        ]);
      }))
    ]);
    return wrap;
  }

  function renderResultRelationship(res){
    const test = tests.relationship;

    // Pick poster
    let poster = null;
    let headerTitle = "";
    let headerSub = "";
    let comfort = "";
    let strengths = [];
    let pitfalls = [];
    let repair = [];
    let shareCopy = "";

    if(res.kind === "single"){
      const t = test.results.singleTypes[res.primaryCode];
      poster = t.poster;
      headerTitle = t.poster?.title || t.name;
      headerSub = t.tagline || test.meta.subtitle || "";
      comfort = t.comfort || "";
      strengths = t.strengths || [];
      pitfalls = t.pitfalls || [];
      repair = t.repair || [];
      shareCopy = res.share?.caption || t.shareCopy || "";
    }else{
      poster = res.content.poster;
      headerTitle = res.content.title;
      headerSub = res.content.subtitle;
      comfort = "你不是“作”，你只是有明确的安全感证据偏好。把它说清楚，关系会更省力。";
      strengths = ["更清楚自己需要什么", "更容易把情绪翻译成可执行动作", "更容易建立可持续的相处规则"];
      pitfalls = ["主需求被触发时，容易高估风险", "对方不懂你的证据语言时，容易误会"];
      repair = ["把主需求写成一个可执行动作", "把次需求当作加分项而不是考试题", "先要可预期，再谈浪漫"];
      shareCopy = res.share?.caption || res.content.shareCopy || "";
    }

    // Radar chart values
    const dims100 = Object.fromEntries(Object.entries(res.dims || {}).map(([k,v]) => [k, v.to100]));
    const dimList = test.dimensions.map(d => ({ code: d.code, label: d.shortName || d.code }));
    const radar = radarSVG(dimList, dims100, 280);

    // top 3 dims
    const top3 = Object.entries(dims100).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([code,val])=>{
      const meta = test.dimensions.find(d=>d.code===code);
      return `${meta?.shortName || meta?.name || code} ${val}`;
    });

    const caption = shareCopy;
    const shareLink = buildShareLink(res.sharePayload);
    const dateText = new Date().toLocaleDateString("zh-CN");

    const posterText = [
      poster?.title || "",
      poster?.subtitle || "",
      ...(poster?.lines || []),
      "",
      ...(poster?.hashtags || []),
      poster?.footer ? ("\n" + poster.footer) : ""
    ].filter(Boolean).join("\n");

    const posterFilename = "relationship_" + (res.kind === "single" ? res.primaryCode : res.code);

    return withFade(el("div", {class:"card"}, [
      el("div", {class:"result-header"}, [
        el("div", {class:"result-title"}, headerTitle),
        el("p", {class:"result-sub"}, headerSub)
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "维度概览（更像线上产品的可视化）"),
        el("div", {class:"grid result-overview-grid"}, [
          el("div", {class:"chart-wrap result-overview-radar"}, [
            el("div", {class:"chart-title"}, "安全感雷达图（0-100）"),
            el("div", {html: radar})
          ]),
          el("div", {class:"chart-wrap result-overview-text"}, [
            el("div", {class:"chart-title"}, "你最强的 3 个“安全感证据”"),
            el("ul", {class:"list"}, top3.map(x => el("li", {}, x))),
            el("div", {class:"notice"}, [
              el("strong", {}, "解读："),
              " 分数高不代表好坏，只代表“你最容易安心的证据语言”。"
            ])
          ])
        ])
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "安慰句"),
        el("p", {}, comfort)
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "你的优势"),
        el("ul", {class:"list"}, strengths.map(s => el("li", {}, s)))
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "容易踩的雷区"),
        el("ul", {class:"list"}, pitfalls.map(s => el("li", {}, s)))
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "微修复建议（今天就能做）"),
        el("ul", {class:"list"}, repair.map(s => el("li", {}, s)))
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "结果海报（可截图 / 可下载 PNG）"),
        posterView(poster),
        el("div", {class:"btnrow"}, [
          el("button", {class:"btn primary", onClick:()=>copyText(caption)}, "复制小红书文案"),
          el("button", {class:"btn ok", onClick:()=>copyText(shareLink)}, "复制分享链接"),
          el("button", {class:"btn ok", onClick:()=>downloadPosterPNG(poster, { filename: posterFilename, nickname: state.nickname, dateText, testName: tests.relationship.meta.title })}, "下载海报 PNG"),
          el("button", {class:"btn ok", onClick:()=>downloadReportPNG(state.result, { testKey:"relationship", filename: posterFilename + "_report", nickname: state.nickname, dateText })}, "导出结果长图"),
          el("button", {class:"btn ghost", onClick:()=>startIntro("relationship")}, "再测一次"),
          el("button", {class:"btn ghost", onClick:()=>goHome()}, "回到首页")
        ])
      ])
    ]));
  }

  function renderResultEmotional(res){
    const test = tests.emotional;
    const a = res.archetype || {};
    const poster = a.poster || null;

    // bar data
    const cost = ["OUT","MASK","FIX"].map(code => ({ name: (test.dimensions.find(d=>d.code===code)?.name || code), value: res.dim100?.[code] ?? 0 }));
    const protect = ["BND","REC","EXP"].map(code => ({ name: (test.dimensions.find(d=>d.code===code)?.name || code), value: res.dim100?.[code] ?? 0 }));

    const caption = res.share?.caption || "";
    const shareLink = buildShareLink(res.sharePayload);
    const dateText = new Date().toLocaleDateString("zh-CN");
    const posterFilename = "eli_" + (a.code || "result");

    const posterText = [
      poster?.title || "",
      poster?.subtitle || "",
      ...(poster?.lines || []),
      "",
      ...(poster?.hashtags || []),
      poster?.footer ? ("\n" + poster.footer) : ""
    ].filter(Boolean).join("\n");

    return withFade(el("div", {class:"card"}, [
      el("div", {class:"result-header"}, [
        el("div", {class:"result-title"}, `你的情绪劳动指数：${res.ELI}（${res.tier}）`),
        el("p", {class:"result-sub"}, `画像：${a.name || "未命名"}｜${a.tagline || ""}`)
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "三句话说明你为什么会累"),
        el("div", {class:"kv"}, [
          el("div", {class:"item"}, [ el("div", {class:"k"}, "指数"), el("div", {class:"v"}, res.chips?.eliLine || "") ]),
          el("div", {class:"item"}, [ el("div", {class:"k"}, "主消耗"), el("div", {class:"v"}, res.chips?.driverLine || "") ]),
          el("div", {class:"item"}, [ el("div", {class:"k"}, "保护短板"), el("div", {class:"v"}, res.chips?.weakLine || "") ])
        ])
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "可视化：消耗 vs 保护（0-100）"),
        el("div", {class:"grid", style:"grid-template-columns: repeat(12, 1fr); gap: 12px;"}, [
          el("div", {style:"grid-column: span 6;"}, [ renderBars("消耗项（越高越累）", cost) ]),
          el("div", {style:"grid-column: span 6;"}, [ renderBars("保护项（越高越能扛）", protect) ])
        ])
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "安慰句"),
        el("p", {}, a.comfort || "你不是脆弱，你只是长期超负荷。")
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "你的优势"),
        el("ul", {class:"list"}, (a.strengths || []).map(s => el("li", {}, s)))
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "容易踩的雷区"),
        el("ul", {class:"list"}, (a.pitfalls || []).map(s => el("li", {}, s)))
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "微修复建议（今天先做一条）"),
        el("p", {}, `今天先做：${(a.repair || [])[0] || "先停一下"}`),
        el("ul", {class:"list"}, (a.repair || []).map(s => el("li", {}, s)))
      ]),
      el("div", {class:"section"}, [
        el("h3", {}, "结果海报（可截图 / 可下载 PNG）"),
        posterView(poster),
        el("div", {class:"btnrow"}, [
          el("button", {class:"btn primary", onClick:()=>copyText(caption)}, "复制小红书文案"),
          el("button", {class:"btn ok", onClick:()=>copyText(shareLink)}, "复制分享链接"),
          el("button", {class:"btn ok", onClick:()=>downloadPosterPNG(poster, { filename: posterFilename, nickname: state.nickname, dateText, testName: tests.emotional.meta.title })}, "下载海报 PNG"),
          el("button", {class:"btn ok", onClick:()=>downloadReportPNG(state.result, { testKey:"emotional", filename: posterFilename + "_report", nickname: state.nickname, dateText })}, "导出结果长图"),
          el("button", {class:"btn ghost", onClick:()=>startIntro("emotional")}, "再测一次"),
          el("button", {class:"btn ghost", onClick:()=>goHome()}, "回到首页")
        ])
      ])
    ]));
  }

  function renderResult(){
    if(!state.result) return withFade(el("div", {class:"card pad"}, "未生成结果"));
    if(state.testKey === "relationship") return renderResultRelationship(state.result);
    return renderResultEmotional(state.result);
  }

  function render(){
    root.innerHTML = "";
    let node = null;

    if(state.screen === "home") node = renderHome();
    else if(state.screen === "intro") node = renderIntro();
    else if(state.screen === "quiz") node = renderQuiz();
    else if(state.screen === "result") node = renderResult();
    else node = renderHome();

    root.appendChild(node);
  }

  // --- boot ---
  // 1) If share link exists, open result
  if(loadFromShare()){
    // keep
  }else{
    // 2) default home
    goHome();
  }
})();
