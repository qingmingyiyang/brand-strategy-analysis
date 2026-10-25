"use strict";

(() => {
  const canvas = document.getElementById("film");
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  const audio = document.getElementById("narration");
  const playButton = document.getElementById("play");
  const seek = document.getElementById("seek");
  const clock = document.getElementById("clock");
  const status = document.getElementById("status");
  const W = 1920;
  const H = 1080;
  const C = { bg: "#F6F3E9", paper: "#FFFEF7", edge: "#E4E5DA", ink: "#2B3D34", muted: "#657468", accent: "#526F5C", sage: "#718F7B", pale: "#DEE7DA", line: "#C9D2C4", brass: "#92856B" };
  const FONT = '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif';
  const SERIF = '"SimSun", "Songti SC", "Noto Serif SC", serif';
  const MONO = '"Cascadia Mono", Consolas, monospace';
  const assets = {};
  let timeline;
  let duration;
  let recording = false;
  let previewRunning = false;
  let previewRequest = 0;
  let audioContext;
  let audioSource;
  let currentTime = 0;
  let sceneName = "question";
  let bodyLayer = false;
  let lastFrameInfo;
  const textIssues = [];
  let frameTexts = [];
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const ease = (v) => 1 - Math.pow(1 - clamp(v), 3);
  const smooth = (v) => { const t = clamp(v); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * clamp(t);
  const reveal = (p, at = 0, span = .14) => ease((p - at) / span);

  const paperTexture = document.createElement("canvas");
  paperTexture.width = W; paperTexture.height = H;
  const grain = paperTexture.getContext("2d", { willReadFrequently: true });
  let seed = 30721;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 12500; i += 1) {
    const x = random() * W, y = random() * H;
    grain.strokeStyle = i % 2 ? "rgba(114,105,80,0.025)" : "rgba(255,255,255,0.16)";
    grain.lineWidth = .5;
    grain.beginPath(); grain.moveTo(x, y); grain.lineTo(x + random() * 4 + 1, y + random() * 1.4); grain.stroke();
  }

  function background(index) {
    const wash = ctx.createLinearGradient(0, 0, W, H);
    wash.addColorStop(0, "#FCFAF3"); wash.addColorStop(.56, C.bg); wash.addColorStop(1, index % 2 ? "#F1F2E9" : "#F2F0E5");
    ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);
    const daylight = ctx.createRadialGradient(300, 30, 0, 300, 30, 1500);
    daylight.addColorStop(0, "rgba(255,255,255,0.46)"); daylight.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = daylight; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(paperTexture, 0, 0);
    if (sceneName === "question") ctx.drawImage(assets.stage, 0, 0, W, H);
    ctx.save(); ctx.globalAlpha = .24; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 875); ctx.bezierCurveTo(450, 847, 1250, 886, 1920, 842); ctx.stroke(); ctx.restore();
  }

  function label(value, x, y, size = 26, color = C.ink, weight = 400, family = FONT) {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${family}`; ctx.textBaseline = "top";
    const width = ctx.measureText(value).width;
    const left = ctx.textAlign === "center" ? x - width / 2 : ctx.textAlign === "right" ? x - width : x;
    if (ctx.globalAlpha > .96 && value) {
      const transform = ctx.getTransform();
      const corners = [[left, y], [left + width, y], [left + width, y + size * 1.22], [left, y + size * 1.22]].map(([cx, cy]) => transform.transformPoint({ x: cx, y: cy }));
      const bounds = { left: Math.min(...corners.map(point => point.x)), right: Math.max(...corners.map(point => point.x)), top: Math.min(...corners.map(point => point.y)), bottom: Math.max(...corners.map(point => point.y)) };
      frameTexts.push({ text: String(value), alpha: ctx.globalAlpha, ...bounds });
      if (bounds.left < 18 || bounds.right > W - 18 || bounds.top < 8 || bounds.bottom > H - 8 || (bodyLayer && bounds.bottom > 882)) textIssues.push({ value, scene: sceneName, ...bounds, reason: "文字超出内容安全区" });
    }
    ctx.fillText(value, x, y);
  }

  function lines(value, maxWidth, size = 28, weight = 400, family = FONT) {
    ctx.font = `${weight} ${size}px ${family}`;
    const result = [];
    for (const paragraph of String(value).split("\n")) {
      let line = "";
      for (const char of paragraph) {
        if (line && ctx.measureText(line + char).width > maxWidth) { result.push(line); line = char; } else line += char;
      }
      result.push(line);
    }
    return result;
  }

  function paragraph(value, x, y, maxWidth, size = 28, color = C.muted, lineHeight = 1.6, weight = 400, maxLines = 20) {
    const wrapped = lines(value, maxWidth, size, weight);
    if (ctx.globalAlpha > .96 && wrapped.length > maxLines) textIssues.push({ value, scene: sceneName, reason: "文字超过约定行数" });
    wrapped.forEach((line, i) => label(line, x, y + i * size * lineHeight, size, color, weight));
    return wrapped.length * size * lineHeight;
  }

  function rounded(x, y, w, h, radius = 12, fill = C.paper, stroke = null) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  function rule(x, y, width, color = C.line, thickness = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + width, y); ctx.stroke();
  }

  function paper(x, y, w, h, options, draw) {
    const { angle = 0, depth = 5, fold = false, shadow = .09 } = options || {};
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(angle); ctx.translate(-w / 2, -h / 2);
    ctx.save(); ctx.shadowColor = `rgba(48,57,42,${shadow})`; ctx.shadowBlur = 28; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 14;
    rounded(0, depth, w, h, 5, C.edge); ctx.restore();
    rounded(0, 0, w, h, 5, C.paper, "rgba(125,135,115,0.13)");
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(4, 2, w - 8, 1);
    if (fold) {
      ctx.beginPath(); ctx.moveTo(0, h - 17); ctx.lineTo(w, h - 17); ctx.lineTo(w - 22, h); ctx.lineTo(20, h); ctx.closePath();
      ctx.fillStyle = "#F0EFE4"; ctx.fill(); rule(20, h - 17, w - 42, "#DFE3D6");
    }
    draw?.(w, h); ctx.restore();
  }

  function enter(p, at, draw, options = {}) {
    const amount = reveal(p, at, options.span || .15);
    if (amount <= 0) return;
    ctx.save(); ctx.globalAlpha *= amount;
    ctx.translate((1 - amount) * (options.x || 0), (1 - amount) * (options.y ?? 35));
    draw(amount); ctx.restore();
  }

  function path(points, progress, color = C.sage, width = 2) {
    if (progress <= 0) return;
    const distances = points.slice(1).map((point, i) => Math.hypot(point[0] - points[i][0], point[1] - points[i][1]));
    let remaining = distances.reduce((sum, value) => sum + value, 0) * clamp(progress);
    ctx.beginPath(); ctx.moveTo(...points[0]);
    for (let i = 0; i < distances.length; i += 1) {
      const ratio = Math.min(1, remaining / Math.max(.001, distances[i]));
      ctx.lineTo(lerp(points[i][0], points[i + 1][0], ratio), lerp(points[i][1], points[i + 1][1], ratio));
      remaining -= distances[i]; if (remaining <= 0) break;
    }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
  }

  function thread(points, progress = 1, color = C.sage) {
    path(points, progress, color, 2);
    if (progress > .98) {
      const point = points[points.length - 1]; ctx.beginPath(); ctx.arc(point[0], point[1], 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    }
  }

  function check(x, y, progress = 1) { path([[x, y + 8], [x + 10, y + 19], [x + 31, y - 6]], progress, C.accent, 2.8); }

  function tag(value, x, y, color = C.accent, size = 23) {
    ctx.font = `400 ${size}px ${FONT}`; const width = ctx.measureText(value).width + 26;
    rounded(x, y, width, 41, 4, C.pale); label(value, x + 13, y + 8, size, color);
  }

  function picture(name, x, y, w, h, options = {}) {
    const image = assets[name];
    if (!image) throw new Error(`缺少必需图层: ${name}`);
    const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
    const iw = image.naturalWidth * scale, ih = image.naturalHeight * scale;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(options.angle || 0);
    ctx.shadowColor = "rgba(54,65,43,0.06)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 10;
    ctx.drawImage(image, -iw / 2, -ih / 2, iw, ih); ctx.restore();
  }

  const motionModes = { question: "同一订单连接三方视角", perspectives: "三方陈述横向移焦", facts: "来源、材料、解释与目标分离", minimum: "执行单元逐项展开", principle: "原则章页与关系图逐层展开", outcomes: "原则进入研究成果", closing: "研究单元收拢与留白" };
  function cameraAt(scene, p, number = 0) {
    const move = smooth(Math.min(1, p / .7));
    const poses = {
      question: { scale: lerp(1.025, 1, move), x: lerp(12, 0, move), y: 0 },
      perspectives: { scale: 1, x: lerp(35, 0, move), y: 0 },
      facts: { scale: lerp(.98, 1, move), x: 0, y: lerp(16, 0, move) },
      minimum: { scale: lerp(1.02, 1, move), x: lerp(-18, 0, move), y: 0 },
      principle: { scale: lerp(number % 2 ? .98 : 1.025, 1, move), x: lerp(number % 2 ? 25 : -25, 0, move), y: lerp(10, 0, move) },
      outcomes: { scale: lerp(1.03, 1, move), x: 0, y: lerp(12, 0, move) },
      closing: { scale: lerp(1.025, 1, move), x: lerp(20, 0, move), y: 0 }
    };
    return poses[scene];
  }

  function world(scene, p, draw, number = 0) {
    const camera = cameraAt(scene, p, number), cx = camera.cx || 960, cy = camera.cy || 570;
    ctx.save(); ctx.translate(cx + camera.x, cy + camera.y); ctx.scale(camera.scale, camera.scale); ctx.translate(-cx, -cy); draw(); ctx.restore();
  }

  function chrome(index) {
    label("品牌战略分析", 96, 58, 25, C.ink, 400, SERIF);
    label("BRAND STRATEGY ANALYSIS", 298, 67, 16, C.muted, 400, MONO);
    ctx.textAlign = "right"; label(String(index + 1).padStart(2, "0") + " / " + timeline.segments.length, 1824, 65, 20, C.muted, 400, MONO); ctx.textAlign = "left";
    rule(96, 108, 1728, "#DFE3D7");
    label("研究理念 · 最小单元 · 八项基石", 96, 1035, 18, C.muted);
    ctx.fillStyle = C.line; ctx.fillRect(1580, 1044, 244, 1); ctx.fillStyle = C.sage; ctx.fillRect(1580, 1043, (index + 1) * 244 / timeline.segments.length, 2);
  }

  function heading(kicker, title, subtitle) {
    label(kicker, 100, 151, 20, C.muted, 400, MONO);
    label(title, 96, 196, 59, C.ink, 400, SERIF);
    if (subtitle) label(subtitle, 100, 283, 27, C.muted);
  }

  function question(p) {
    label("从不同视角理解同一个问题", 103, 167, 25, C.accent);
    label("同一笔订单", 96, 213, 90, C.ink, 400, SERIF);
    label("为什么有三种解释？", 96, 326, 75, C.ink, 400, SERIF);
    label("调研从保留不同视角开始", 104, 452, 30, C.muted);
    label("一笔交易  三方陈述  原因待核验", 104, 543, 23, C.accent);
    world("question", p, () => {
      const voices = [["供货者", "价格？"], ["采购者", "规格？"], ["合作社", "分级成本？"]];
      voices.forEach((item, i) => {
        const x = 108 + i * 312;
        thread([[1118, 743], [1066, 743], [1066, 828], [x + 140, 828], [x + 140, 780]], reveal(p, .02 + i * .06, .22));
      });
      paper(1118, 665, 680, 156, { angle: -.006, depth: 6 }, () => {
        label("订单 P-014", 29, 25, 31, C.ink, 400, SERIF);
        label("未续单", 493, 30, 25, C.accent);
        rule(29, 77, 622); label("同一笔交易 · 原因待核验", 29, 102, 26, C.muted);
      });
      voices.forEach((item, i) => paper(108 + i * 312, 600, 280, 180, { angle: (i - 1) * .006, depth: 5 }, () => {
        label(item[0], 24, 23, 25, C.muted);
        enter(p, .02 + i * .09, () => label(item[1], 24, 71, 36, C.ink, 400, SERIF), { y: 8, span: .14 });
        rule(24, 124, 232); label("来源陈述", 24, 141, 21, C.accent);
      }));
    });
  }

  function perspectives(p) {
    heading("FIELDWORK / 多方视角", "每个人看到的部分不同", "保留原话，也追问角色的利益与信息范围。");
    label("订单 P-014 · 同一笔交易的三方陈述", 104, 337, 20, C.accent);
    world("perspectives", p, () => {
      const voices = [["供货者", "归因于价格", "看到报价与供货压力", "核对报价、分级与装箱"], ["采购者", "提到规格混装", "关心验收与实际使用", "核对约定、验收与替代选择"], ["合作社", "关心分级成本", "面对收购与农户参与", "核对批次、分级与费用承担"]];
      voices.forEach((item, i) => enter(p, .02 + i * .13, amount => paper(112 + i * 594, 382, 510, 365, { angle: (i - 1) * .028 * (1 - amount) }, () => {
        tag(item[0], 28, 28); label(item[1], 28, 111, 38, C.ink, 400, SERIF);
        label(item[2], 28, 179, 27, C.muted); rule(28, 239, 450);
        paragraph(item[3], 28, 271, 451, 24, C.accent, 1.6);
      }), { x: 35, y: 20 }));
      enter(p, .5, () => label("共同追问：具体是哪一次事件？", 645, 803, 31, C.accent), { y: 9 });
    });
  }

  function facts(p) {
    heading("EVIDENCE / 事实与解释", "让判断回到同一事件与同一口径", "分开记录事实、归因与目标，也检查研究者的预设。");
    label("订单 P-014 · 回查同一事件与核验口径", 104, 337, 20, C.accent);
    world("facts", p, () => {
      const columns = [["来源陈述", "谁在何时说了什么", "保留原话与角色信息"], ["可核材料", "订单、验收与交付", "逐项确认是否相互支持"], ["当前解释", "价格、规格或分级成本", "写明依据与反例"], ["各方目标", "选择、收益与能力", "说明各自关注什么"]];
      columns.forEach((item, i) => enter(p, .025 + i * .11, amount => paper(103 + i * 444, 389, 382, 353, { angle: (i % 2 ? .02 : -.02) * (1 - amount) }, () => {
        label("0" + (i + 1), 26, 25, 23, C.accent, 400, MONO); label(item[0], 26, 83, 38, C.ink, 400, SERIF);
        rule(26, 149, 330); paragraph(item[1], 26, 182, 325, 27, C.ink, 1.7);
        paragraph(item[2], 26, 268, 325, 23, C.muted, 1.6);
      }), { y: 28 }));
      thread([[294, 755], [294, 782], [1626, 782], [1626, 755]], reveal(p, .4, .25));
      enter(p, .58, () => {
        ctx.textAlign = "center"; label("研究者自己的预设也接受同样核验", 960, 819, 29, C.accent); ctx.textAlign = "left";
      }, { y: 8 });
    });
  }

  function minimum(p) {
    heading("MINIMUM UNIT / 最小单元化", "把专家省略的判断与动作展开", "验收标准：完全没有经验的人  照着材料也能完成。");
    world("minimum", p, () => {
      enter(p, .01, amount => paper(110, 381, 473, 414, { angle: -.022 * (1 - amount) }, () => {
        label("一个可完成的单元", 30, 30, 33, C.ink, 400, SERIF);
        paragraph("围绕一次具体交易\n完成访谈与可回查记录", 30, 113, 400, 31, C.ink, 1.7);
        rule(30, 245, 409); paragraph("材料、分支、样例和检查\n都能找到对应入口", 30, 280, 409, 27, C.accent, 1.7);
      }), { x: -22, y: 20 });
      const fields = [["做什么", "明确本轮结果"], ["拿什么做", "提供材料与工具"], ["按什么顺序", "逐步完成动作"], ["分支怎样选择", "不同回答怎样继续"], ["完成样例", "看得见合格结果"], ["怎样检查", "依据明确条件核对"], ["卡住怎么办", "提供下一步与求助入口"]];
      fields.forEach((item, i) => {
        const x = 658 + (i % 2) * 573, y = 374 + Math.floor(i / 2) * 116;
        enter(p, .06 + i * .075, amount => paper(x, y, i === 6 ? 1099 : 526, 92, { depth: 3, angle: (1 - amount) * .01 }, () => {
          label(String(i + 1).padStart(2, "0"), 22, 23, 22, C.accent, 400, MONO);
          label(item[0], 74, 18, 27, C.ink); label(item[1], i === 6 ? 308 : 74, i === 6 ? 23 : 55, i === 6 ? 26 : 21, C.muted);
        }), { x: 23, y: 10 });
      });
      thread([[584, 595], [617, 583], [658, 594]], reveal(p, .25, .3));
    });
  }

  const principles = [
    ["事实与理论支撑判断", "概念、前提与推导可以被检查", ["具体事实", "概念与理论", "可检验解释"]],
    ["事实优先与独立分析", "各方接受相同的证据标准", ["用户与专家", "政府与主体", "研究者自己"]],
    ["判断随证据迭代", "写明支持、反证与重审条件", ["当前解释", "新证据进入", "回查判断与行动"]],
    ["消费者选择与主体激励共同成立", "选择理由与参与条件共同支持承诺", ["顾客为什么选", "主体为什么做", "能力能否兑现"]],
    ["战略聚焦并作出取舍", "让资源围绕关键问题展开", ["当前关键问题", "选择服务对象", "明确暂缓事项"]],
    ["小切口与大纵深", "沿同一主线增加解释力", ["具体事件", "过程与原因", "条件与反例"]],
    ["最小单元与能力成长", "从完成一个单元走向复杂判断", ["白话与示范", "操作与检查", "反馈后继续"]],
    ["框架服务目标与克制执行", "按目标调用方法并在完成处收束", ["当前目标", "选择适用方法", "完成后收束"]]
  ];

  function principleNode(p, index, x, y, title, note, width = 420) {
    enter(p, .04 + index * .14, amount => paper(x, y, width, 192, { angle: (index - 1) * .024 * (1 - amount), depth: 5 }, () => {
      label(String(index + 1).padStart(2, "0"), 27, 22, 22, C.accent, 400, MONO);
      label(title, 27, 72, 32, C.ink, 400, SERIF);
      if (note) label(note, 27, 132, 23, C.muted);
    }), { x: 20, y: 20 });
  }

  function principle(p, segment) {
    const number = segment.principle, entry = principles[number - 1];
    heading(`FOUNDATION ${String(number).padStart(2, "0")} / 八项基石原则`, entry[0], entry[1]);
    world("principle", p, () => {
      if (number === 1) {
        [["具体事实", "从疑问提出问题"], ["概念与理论", "说明关系与前提"], ["可检验解释", "检查推导是否成立"]].forEach((item, i) => principleNode(p, i, 140 + i * 585, 447, ...item));
        thread([[560, 540], [725, 540]], reveal(p, .18, .2));
        thread([[1145, 540], [1310, 540]], reveal(p, .37, .2));
      } else if (number === 2) {
        entry[2].forEach((name, i) => principleNode(p, i, 139 + i * 585, 398, name, "保留原话与依据"));
        [349, 934, 1519].forEach((x, i) => thread([[x, 595], [x, 673], [960, 716]], reveal(p, .29 + i * .06, .25)));
        enter(p, .5, () => paper(510, 715, 900, 93, { depth: 4 }, () => label("同一事件  同一口径  同一证据标准", 99, 27, 32, C.accent)), { y: 12 });
      } else if (number === 3) {
        principleNode(p, 0, 153, 436, "当前解释", "哪些材料支持它？", 445);
        principleNode(p, 1, 749, 388, "新证据", "什么发现会推翻它？", 445);
        principleNode(p, 2, 1315, 470, "修正判断与行动", "回查受影响的安排", 445);
        thread([[598, 529], [674, 529], [674, 484], [749, 484]], reveal(p, .2, .22));
        thread([[1194, 484], [1254, 484], [1254, 566], [1315, 566]], reveal(p, .38, .22));
        path([[1540, 671], [1540, 764], [376, 764], [376, 636]], reveal(p, .55, .2), C.sage, 2);
      } else if (number === 4) {
        principleNode(p, 0, 146, 418, "顾客为什么选择", "具体场景与替代选择", 555);
        principleNode(p, 1, 1219, 418, "主体为什么参与", "收益、能力与责任", 555);
        thread([[701, 515], [960, 657], [1219, 515]], reveal(p, .25, .3));
        enter(p, .5, () => paper(592, 679, 736, 116, { depth: 5 }, () => {
          label("共同兑现价值", 235, 23, 36, C.ink, 400, SERIF); label("真实参与条件支持持续承诺", 191, 77, 25, C.accent);
        }), { y: 17 });
      } else if (number === 5) {
        ["价格", "规格", "分级成本"].forEach((name, i) => enter(p, .02 + i * .08, () => tag(name + "解释", 157, 392 + i * 112, C.muted, 26), { x: -15, y: 0 }));
        [429, 541, 653].forEach((y, i) => thread([[340, y], [622, 550]], reveal(p, .19 + i * .08, .2)));
        enter(p, .27, () => paper(623, 420, 573, 262, { depth: 6 }, () => {
          label("最影响目标的关键问题", 31, 29, 34, C.ink, 400, SERIF); rule(31, 93, 511);
          label("服务谁  靠什么兑现", 31, 131, 30, C.accent); label("比较候选方向后作出选择", 31, 198, 24, C.muted);
        }), { x: 20, y: 18 });
        enter(p, .48, () => paper(1326, 535, 431, 179, { angle: .012, depth: 4 }, () => {
          label("暂缓事项", 29, 26, 32, C.ink, 400, SERIF); label("明确本轮投入边界", 29, 101, 25, C.muted);
        }), { x: 30, y: 12 });
        thread([[1196, 550], [1260, 550], [1260, 624], [1326, 624]], reveal(p, .53, .2));
      } else if (number === 6) {
        const depths = [["一笔交易", "时间、对象与经过"], ["过程与原因", "为什么反复发生"], ["条件与反例", "什么情况下解释不成立"]];
        depths.forEach((item, i) => enter(p, .04 + i * .16, amount => paper(142 + i * 422, 378 + i * 123, 780, 143, { depth: 5, angle: -.015 * (1 - amount) }, () => {
          label(String(i + 1).padStart(2, "0"), 25, 25, 22, C.accent, 400, MONO); label(item[0], 92, 24, 33, C.ink, 400, SERIF);
          label(item[1], 92, 86, 26, C.muted);
        }), { x: 22, y: 18 }));
      } else if (number === 7) {
        ["白话", "示范", "操作", "反馈"].forEach((name, i) => {
          const y = 581 - i * 56;
          enter(p, .025 + i * .13, () => paper(138 + i * 433, y, 340, 174, { depth: 6 }, () => {
            label(String(i + 1).padStart(2, "0"), 26, 22, 22, C.accent, 400, MONO); label(name, 26, 79, 43, C.ink, 400, SERIF);
          }), { y: 20 });
          if (i < 3) thread([[478 + i * 433, y + 85], [571 + i * 433, y + 29]], reveal(p, .2 + i * .13, .2));
        });
        enter(p, .62, () => label("完成一个单元  组合下一层能力", 674, 808, 30, C.accent), { y: 10 });
      } else {
        principleNode(p, 0, 147, 427, "当前目标", "明确做到什么程度", 430);
        principleNode(p, 1, 743, 427, "选择适用方法", "采用、试点或后置", 430);
        principleNode(p, 2, 1339, 427, "完成后收束", "保留反馈与继续入口", 430);
        thread([[577, 523], [743, 523]], reveal(p, .2, .2));
        thread([[1173, 523], [1339, 523]], reveal(p, .39, .2));
        enter(p, .53, () => {
          ["框架", "专题", "工程"].forEach((name, i) => tag(name, 685 + i * 180, 714, C.accent, 24));
          label("按需调用", 835, 794, 29, C.muted);
        }, { y: 12 });
      }
    }, number);
  }

  function outcomes(p) {
    heading("RESEARCH / 从理念到成果", "原则贯穿访谈、分析与方案", "每个判断有依据  每次行动有检查  每轮研究能修正。");
    world("outcomes", p, () => {
      const groups = [["访谈与记录", "多方视角与可核材料"], ["分析与方案", "依据、取舍与验证"], ["规划与汇报", "总体、专题与决策"]];
      groups.forEach((item, i) => enter(p, .03 + i * .14, amount => paper(133 + i * 590, 423, 480, 317, { angle: (i - 1) * .04 * (1 - amount), depth: 7 }, () => {
        label("0" + (i + 1), 30, 29, 25, C.accent, 400, MONO); label(item[0], 30, 98, 40, C.ink, 400, SERIF);
        rule(30, 169, 420); label(item[1], 30, 208, 28, C.muted);
        rule(30, 278, 420, "#D8DDCF");
      }), { y: 31 }));
      thread([[614, 583], [723, 583]], reveal(p, .19, .2));
      thread([[1204, 583], [1313, 583]], reveal(p, .38, .2));
      enter(p, .58, () => label("判断与行动持续接受事实检查", 696, 810, 29, C.accent), { y: 10 });
    });
  }

  function closing(p) {
    world("closing", p, () => {
      [0, 1, 2].forEach(i => enter(p, .02 + i * .05, amount => paper(161 + i * 130, 403 + i * 26, 330, 355, { angle: (-.12 + i * .055) * amount, depth: 5 }, () => {
        label(["多方视角", "事实与解释", "最小单元"][i], 28, 34, 33, C.ink, 400, SERIF); rule(28, 98, 274); rule(28, 141, 237); rule(28, 181, 254); rule(28, 221, 207);
        ctx.fillStyle = C.pale; ctx.fillRect(270, 0, 22, 65);
      }), { x: 20, y: 35 }));
      enter(p, .16, () => picture("pear", 525, 578, 237, 260), { y: 15 });
      thread([[652, 716], [788, 690], [881, 711], [938, 711]], reveal(p, .18, .36));
    });
    label("品牌战略分析", 910, 271, 70, C.ink, 400, SERIF);
    label("在调研中形成自己的判断", 913, 382, 44, C.ink, 400, SERIF);
    paragraph("在不同视角之间核验事实\n在最小单元中理解与成长", 917, 488, 820, 33, C.muted, 1.7);
    enter(p, .15, () => {
      rule(917, 639, 850, C.line);
      label("github.com/qingmingyiyang/brand-strategy-analysis", 917, 676, 28, C.accent, 400, MONO);
      paragraph("OPEN SOURCE  /  在能够读取本地文件的 AI 助手中使用", 917, 754, 840, 22, C.muted, 1.5);
    }, { y: 10 });
  }

  const scenes = { question, perspectives, facts, minimum, principle, outcomes, closing };

  function captionLines(value) {
    const wrapped = lines(value, 1630, 39, 400);
    if (wrapped.length < 2) return wrapped;
    const characters = [...value];
    const candidates = [];
    characters.forEach((character, index) => {
      if (!"，、；：？！。".includes(character) || index >= characters.length - 1) return;
      const first = characters.slice(0, index + 1).join("");
      const second = characters.slice(index + 1).join("");
      const firstWidth = ctx.measureText(first).width;
      const secondWidth = ctx.measureText(second).width;
      if (Math.max(firstWidth, secondWidth) <= 1630) candidates.push({ lines: [first, second], difference: Math.abs(firstWidth - secondWidth) });
    });
    candidates.sort((first, second) => first.difference - second.difference);
    return candidates.length ? candidates[0].lines : wrapped;
  }

  function caption(seconds) {
    const cue = timeline.segments.flatMap(segment => segment.captions || []).find(item => seconds >= item.start && seconds < item.end);
    if (!cue) return;
    const wrapped = captionLines(cue.text);
    if (wrapped.length > 2) throw new Error(`字幕超过两行：${cue.text}`);
    const firstY = wrapped.length === 1 ? 927 : 901;
    ctx.textAlign = "center"; wrapped.forEach((line, i) => label(line, 960, firstY + i * 52, 39, C.ink, 400)); ctx.textAlign = "left";
  }

  function renderFrame(seconds) {
    if (!timeline) throw new Error("时间线尚未读取。");
    if (!Number.isFinite(seconds)) throw new Error("影片时间必须为有限数字。");
    currentTime = clamp(seconds, 0, duration);
    // 每帧使用独立的绘图状态，使任意时间定位得到相同画面。
    ctx.reset();
    frameTexts = [];
    // 段间停顿延续上一镜头，字幕与时间线独立。
    const index = Math.max(0, timeline.segments.findLastIndex(item => currentTime >= item.start));
    const segment = timeline.segments[index]; sceneName = segment.scene;
    const localTime = Math.max(0, currentTime - segment.start), progress = clamp(localTime / (segment.end - segment.start));
    background(index); bodyLayer = false; chrome(index); bodyLayer = true;
    scenes[sceneName](progress, segment);
    if (["question", "perspectives", "facts", "minimum"].includes(sceneName)) { ctx.textAlign = "right"; label("虚构教学示例", 1818, 157, 20, C.muted); ctx.textAlign = "left"; }
    bodyLayer = false; caption(currentTime);
    if (currentTime < 1) {
      ctx.save(); ctx.globalAlpha = clamp(2 - currentTime * 2);
      ctx.drawImage(assets.cover, 0, 0, W, H); ctx.restore();
    }
    seek.value = String(currentTime); clock.value = `${currentTime.toFixed(1)} / ${duration.toFixed(1)}s`;
    lastFrameInfo = { time: currentTime, scene: sceneName, segment: segment.id, principle: segment.principle || null, localTime, progress, camera: cameraAt(sceneName, progress, segment.principle), motion: motionModes[sceneName], texts: frameTexts };
    return lastFrameInfo;
  }

  function previewTick() {
    if (!previewRunning) return;
    renderFrame(Math.min(duration, 1 + audio.currentTime));
    if (audio.ended) { previewRunning = false; playButton.textContent = "重新播放"; renderFrame(duration); }
    else previewRequest = requestAnimationFrame(previewTick);
  }

  playButton.addEventListener("click", async () => {
    await window.filmReady;
    if (recording) throw new Error("录制期间不能启动预览。");
    if (previewRunning) { audio.pause(); previewRunning = false; cancelAnimationFrame(previewRequest); playButton.textContent = "继续播放"; return; }
    if (audio.ended || currentTime >= duration) audio.currentTime = 0; else audio.currentTime = Math.max(0, currentTime - 1);
    await audio.play(); previewRunning = true; playButton.textContent = "暂停"; previewTick();
  });
  seek.addEventListener("input", () => {
    if (recording) throw new Error("录制期间不能改变影片时间。");
    const target = Number(seek.value); audio.currentTime = Math.max(0, Math.min(audio.duration, target - 1)); renderFrame(target);
  });

  async function recordFilm() {
    await window.filmReady;
    if (recording) throw new Error("影片已经在录制。");
    if (previewRunning) { audio.pause(); previewRunning = false; cancelAnimationFrame(previewRequest); }
    recording = true; playButton.disabled = true; seek.disabled = true; audio.currentTime = 0;
    audioContext ||= new AudioContext({ sampleRate: 48000 }); await audioContext.resume();
    if (!audioSource) { audioSource = audioContext.createMediaElementSource(audio); audioSource.connect(audioContext.destination); }
    const audioDestination = audioContext.createMediaStreamDestination(); audioSource.connect(audioDestination);
    const stream = canvas.captureStream(timeline.fps), audioTracks = audioDestination.stream.getAudioTracks();
    if (audioTracks.length !== 1) throw new Error("旁白音轨创建失败。");
    stream.addTrack(audioTracks[0]);
    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus"].find(candidate => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) throw new Error("当前浏览器不支持包含声音的 WebM 录制。");
    const chunks = [], recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 10000000, audioBitsPerSecond: 192000 });
    const stopped = new Promise((resolve, reject) => {
      recorder.addEventListener("dataavailable", event => { if (event.data.size) chunks.push(event.data); });
      recorder.addEventListener("stop", resolve, { once: true }); recorder.addEventListener("error", event => reject(event.error || new Error("媒体录制失败。")), { once: true });
    });
    let request, audioEndedAt, startedAudio = false;
    const start = performance.now(); renderFrame(0); recorder.start(1000);
    const completed = new Promise((resolve, reject) => {
      const tick = async () => {
        try {
          const elapsed = (performance.now() - start) / 1000;
          if (elapsed < 1) renderFrame(elapsed);
          else {
            if (!startedAudio) { startedAudio = true; await audio.play(); }
            if (audio.ended) {
              audioEndedAt ??= performance.now(); renderFrame(Math.min(duration, 1 + audio.duration + (performance.now() - audioEndedAt) / 1000));
              if ((performance.now() - audioEndedAt) / 1000 >= 3) { resolve(); return; }
            } else renderFrame(1 + audio.currentTime);
          }
          request = requestAnimationFrame(tick);
        } catch (error) { reject(error); }
      };
      request = requestAnimationFrame(tick);
    });
    try {
      await completed; recorder.stop(); await stopped;
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size < 100000) throw new Error("录制结果异常小，无法作为成片使用。");
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(reader.error);
        reader.onload = () => { const value = String(reader.result), marker = value.indexOf(";base64,"); if (marker < 0) { reject(new Error("媒体导出缺少Base64标记。")); return; } resolve(value.slice(marker + 8)); };
        reader.readAsDataURL(blob);
      });
      return { base64, mimeType, duration: (performance.now() - start) / 1000, timelineDuration: duration, audioDuration: audio.duration, bytes: blob.size };
    } finally {
      cancelAnimationFrame(request); if (recorder.state !== "inactive") recorder.stop(); stream.getTracks().forEach(track => track.stop()); audioSource.disconnect(audioDestination);
      recording = false; playButton.disabled = false; seek.disabled = false;
    }
  }

  window.renderFrame = renderFrame;
  window.recordFilm = recordFilm;
  window.filmFrameInfo = () => lastFrameInfo;
  window.filmDiagnostics = () => ({ duration, audioDuration: audio.duration, segments: timeline.segments.length, principles: principles.map((entry, index) => ({ number: index + 1, title: entry[0] })), minimumFields: ["做什么", "拿什么做", "按什么顺序", "分支怎样选择", "完成样例", "怎样检查", "卡住怎么办"], backgroundStyle: "ivory-silk-paper", palette: C, motionModes, assets: Object.keys(assets), captionCount: timeline.segments.reduce((sum, item) => sum + (item.captions || []).length, 0), textIssues: [...new Map(textIssues.map(item => [item.scene + item.value + item.reason, item])).values()] });
  window.filmReady = (async () => {
    const response = await fetch("timeline.json"); if (!response.ok) throw new Error(`时间线读取失败：HTTP ${response.status}`);
    timeline = await response.json();
    if (timeline.width !== W || timeline.height !== H || timeline.fps !== 30) throw new Error("时间线尺寸与帧率必须为 1920×1080、30fps。");
    if (!Array.isArray(timeline.segments) || timeline.segments.length < 1) throw new Error("时间线必须包含完整语义段。");
    const principleNumbers = timeline.segments.filter(segment => segment.scene === "principle").map(segment => segment.principle);
    if (principleNumbers.length !== 8 || principleNumbers.some((number, index) => number !== index + 1)) throw new Error("八项基石原则必须按1至8依次完整出现。");
    for (const required of ["question", "perspectives", "facts", "minimum", "outcomes", "closing"]) if (!timeline.segments.some(segment => segment.scene === required)) throw new Error(`缺少理念分镜：${required}`);
    for (const segment of timeline.segments) {
      if (!scenes[segment.scene] || !(segment.end > segment.start)) throw new Error(`无效分镜：${segment.id}`);
      for (const cue of segment.captions || []) if (!(cue.end > cue.start) || cue.start < segment.start || cue.end > segment.end + .01) throw new Error(`字幕时间超出分镜：${segment.id}`);
    }
    const orderedCues = timeline.segments.flatMap(segment => segment.captions || []);
    for (let i = 1; i < orderedCues.length; i += 1) if (orderedCues[i].start < orderedCues[i - 1].end - .001) throw new Error("中文字幕时间发生重叠。");
    await Promise.all([["pear", "assets/pear.png"], ["cover", "../cover.png?v=cover-20261025-1"], ["stage", "assets/opening-stage.png"]].map(async ([name, path]) => {
      const image = new Image(); image.src = path;
      await image.decode().catch(error => { throw new Error(`必需图层读取失败: ${path}: ${error.message}`); }); assets[name] = image;
    }));
    await document.fonts.ready;
    audio.src = timeline.audioFile || "narration.wav";
    await new Promise((resolve, reject) => { audio.addEventListener("loadedmetadata", resolve, { once: true }); audio.addEventListener("error", () => reject(new Error("真实旁白文件读取失败。")), { once: true }); audio.load(); });
    if (!(audio.duration > 0)) throw new Error("旁白时长无效。");
    duration = Math.max(Number(timeline.duration) || 0, 1 + audio.duration + 3); seek.max = String(duration); playButton.disabled = false; renderFrame(0);
    status.textContent = "多方视角、最小单元、八项原则与真实旁白已读取。";
    return { duration, audioDuration: audio.duration, segments: timeline.segments.length };
  })();
  window.filmReady.catch(error => { status.textContent = error.message; });
})();
