"use strict";

const stages = [
  {
    id: "interview", label: "访谈准备", file: "01_采购者访谈提纲.md", type: "FIELDWORK",
    title: "明天到现场，<br>知道该追问哪一件事。",
    description: "围绕采购者没有续单的具体交易，把研究问题展开成新人也能使用的提纲。",
    input: "我想弄清餐饮采购者为什么没有继续采购这批梨。已有供货者的一段访谈记录。",
    badges: ["明确对象", "追问分支", "记录与检查"],
    caption: "一次具体事件，比一个笼统的原因更值得追问。",
    content: `<div class="artifact-overline">示例产地梨 / 未续单事件</div><h4>从最近一次采购开始问</h4><div class="artifact-role-tabs" aria-label="选择访谈对象"><button type="button" data-role="buyer" aria-pressed="true">采购者</button><button type="button" data-role="supplier" aria-pressed="false">供货者</button><button type="button" data-role="cooperative" aria-pressed="false">合作社</button></div><ol class="question-list" id="role-questions"></ol><div class="artifact-foot"><i class="tiny-dot" aria-hidden="true"></i>记录对应订单与原话位置，访谈后检查缺口。</div>`
  },
  {
    id: "evidence", label: "证据整理", file: "02_交易证据记录.md", type: "EVIDENCE",
    title: "把不同说法<br>放回同一次交易。",
    description: "保留每个角色的原话与出处，区分已经核对的事实、当前解释和仍待取得的材料。",
    input: "供货者提到价格，采购者提到规格。哪种说法已有支持，下一步该核对什么？",
    badges: ["来源可回查", "陈述与推断分开", "补证任务"],
    caption: "不同角色的陈述，先放在相同条件下核对。",
    content: `<div class="artifact-overline">示例记录 / E01—E03</div><h4>这一次没有续单，我们知道什么</h4><div class="evidence-list"><div class="evidence-row"><span class="evidence-kind sand">陈述</span><div><p>供货者认为采购商觉得价格高。</p><small>P01 访谈 · 第 3 段 · 尚未交叉核对</small></div></div><div class="evidence-row"><span class="evidence-kind">陈述</span><div><p>采购者提到规格混装，后厨难以分配。</p><small>B01 访谈 · 第 2 段 · 尚未交叉核对</small></div></div><div class="evidence-row"><span class="evidence-kind lime">待取证</span><div><p>取得同一笔订单、规格约定和验收记录。</p><small>比较时同时核对数量、账期与配送条件</small></div></div></div><div class="evidence-question">当前判断：价格与规格都需要继续核验。</div>`
  },
  {
    id: "positioning", label: "定位推敲", file: "03_定位价值证据卡.md", type: "POSITIONING",
    title: "顾客为什么选你，<br>每一项都能继续追问。",
    description: "把目标人群、使用场景、替代选择与兑现条件连在一起，再提炼值得验证的定位。",
    input: "如果规格稳定影响后厨使用，面向哪些采购者、怎样的产品承诺值得先验证？",
    badges: ["消费者选择", "同条件比较", "兑现证据"],
    caption: "定位的表达，建立在价值与兑现条件的论证上。",
    content: `<div class="artifact-overline">候选方向 / 需要试供验证</div><h4>一张可以继续核验的价值证据卡</h4><dl class="position-table"><div><dt>服务谁</dt><dd>需要固定规格的餐饮后厨采购者</dd></div><div><dt>使用场景</dt><dd>分餐备料，按份稳定出品</dd></div><div><dt>替代选择</dt><dd>同级产地梨、市场混装货</dd></div><div><dt>候选价值</dt><dd class="highlight">规格清楚，减少后厨二次分拣</dd></div><div><dt>兑现条件</dt><dd>分级规则、装箱检查、到货验收</dd></div><div><dt>下一验证</dt><dd>记录试供分拣时间与异常，再问是否续单</dd></div></dl>`
  },
  {
    id: "operation", label: "经营设计", file: "04_首轮试供行动清单.md", type: "OPERATION",
    title: "让一句承诺<br>变成各方能做的动作。",
    description: "把候选价值接到分级、成交与交付，每一步都有责任角色、材料和检查条件。",
    input: "先围绕规格稳定做一轮试供。需要谁参与，怎样留记录，出现异常怎么处理？",
    badges: ["责任主体", "检查条件", "收益与现金"],
    caption: "产品、渠道与交付，共同兑现顾客选择的理由。",
    content: `<div class="artifact-overline">首轮试供 / 操作安排示例</div><h4>从分级到复盘，沿同一承诺展开</h4><ol class="operation-list"><li><span class="step-id">01</span><div><strong>约定规格与装箱方式</strong><p>材料：分级表、样品、装箱检查单</p></div><span class="owner">供货者</span></li><li><span class="step-id">02</span><div><strong>确认试供条件与验收</strong><p>核对：单价、数量、账期、到货窗口</p></div><span class="owner">采购者</span></li><li><span class="step-id">03</span><div><strong>记录使用与异常处理</strong><p>观察：分拣时间、规格异常、处理责任</p></div><span class="owner">共同记录</span></li><li><span class="step-id">04</span><div><strong>比较结果并决定是否继续</strong><p>结合使用反馈、单笔贡献与回款安排</p></div><span class="owner">经营者</span></li></ol>`
  },
  {
    id: "delivery", label: "完整交付", file: "05_研究成果与交接.md", type: "DELIVERABLES",
    title: "研究继续深入，<br>成果也能够接着用。",
    description: "从一份现场提纲逐步形成诊断、专题和决策汇报，保持事实、判断与行动相互对应。",
    input: "把已确认的判断整合成下一阶段材料，明确依据、负责人、执行顺序与检查方法。",
    badges: ["1+4+1", "步骤与样例", "持续更新"],
    caption: "从一次访谈到完整规划，按本轮目标选择交付深度。",
    content: `<div class="artifact-overline">按任务形成成果 / 交接入口</div><h4>每份成果都说明怎样继续</h4><div class="file-list"><div class="file-row"><span class="file-icon" aria-hidden="true"></span><div><strong>访谈提纲与调研日报</strong><small>原始材料、当前判断与下一取证</small></div><span class="file-mark">研究材料</span></div><div class="file-row"><span class="file-icon" aria-hidden="true"></span><div><strong>品牌总体规划</strong><small>十二章覆盖诊断、定位与经营安排</small></div><span class="file-mark">1 份</span></div><div class="file-row"><span class="file-icon" aria-hidden="true"></span><div><strong>供应链 · 电商 · 场景 · 渠道</strong><small>按选定方向深化责任与具体动作</small></div><span class="file-mark">4 类专题</span></div><div class="file-row"><span class="file-icon" aria-hidden="true"></span><div><strong>决策汇报与行动清单</strong><small>策略依据、安排与待决事项</small></div><span class="file-mark">1 份</span></div></div>`
  }
];

const interviewRoles = {
  buyer: [
    ["请回想最近一次采购这批梨。", "记录日期、规格、数量与当时准备怎样使用。"],
    ["当时比较了哪些选择？最后怎样决定？", "追问同规格报价、账期、配送与验收条件。"],
    ["到货后发生了什么？哪一项影响了续单？", "取得对应记录；再问什么变化会让你愿意重试。"]
  ],
  supplier: [
    ["请从那笔没有续单的订单讲起。", "核对报价、数量、规格承诺与双方确认记录。"],
    ["装箱和发货前，怎样检查规格？", "请展示分级规则、现场记录和异常处理方式。"],
    ["采购者具体反馈了什么？你怎样回应？", "区分对方原话、自己的理解与已经采取的动作。"]
  ],
  cooperative: [
    ["这批梨从哪些农户收来，怎样分级？", "核对收购批次、规格记录与谁负责检查。"],
    ["规格有变化时，收购与装箱怎样处理？", "围绕一次具体异常，追问责任和损耗承担。"],
    ["稳定供货需要哪些参与条件？", "比较收购规则、农户收益与当前执行能力。"]
  ]
};

const tabs = Array.from(document.querySelectorAll("[data-stage]"));
const panels = Array.from(document.querySelectorAll(".demo-panel"));
let activeStage = 0;

function renderStage(stage) {
  const panel = document.getElementById(`panel-${stage.id}`);
  panel.innerHTML = `<div class="demo-left"><span class="sample-tag">方法演示 · 虚构项目</span><h3>${stage.title}</h3><p>${stage.description}</p><div class="input-note"><span>YOUR QUESTION / 当前输入</span><p>${stage.input}</p></div><div class="demo-badges">${stage.badges.map((badge) => `<span>${badge}</span>`).join("")}</div></div><div class="artifact"><div class="artifact-top"><span aria-hidden="true">▤</span><span>${stage.file}</span><span class="artifact-type">${stage.type}</span></div><div class="artifact-body">${stage.content}</div></div>`;
}

stages.forEach(renderStage);

function selectStage(index, focusTab = false) {
  activeStage = (index + stages.length) % stages.length;
  tabs.forEach((tab, tabIndex) => {
    const selected = tabIndex === activeStage;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panels[tabIndex].hidden = !selected;
  });
  document.getElementById("demo-caption").textContent = stages[activeStage].caption;
  if (focusTab) {
    tabs[activeStage].focus({ preventScroll: true });
    tabs[activeStage].scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectStage(index));
  tab.addEventListener("keydown", (event) => {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = index + 1;
    if (event.key === "ArrowLeft") nextIndex = index - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex !== undefined) {
      event.preventDefault();
      selectStage(nextIndex, true);
    }
  });
});
document.getElementById("next-stage").addEventListener("click", () => selectStage(activeStage + 1));

function selectRole(role) {
  document.querySelectorAll("[data-role]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.role === role)));
  document.getElementById("role-questions").innerHTML = interviewRoles[role].map(([question, note]) => `<li><div>${question}<small>${note}</small></div></li>`).join("");
}
document.querySelectorAll("[data-role]").forEach((button) => button.addEventListener("click", () => selectRole(button.dataset.role)));
selectRole("buyer");

const deliveryCost = document.getElementById("delivery-cost");
function updateEconomics() {
  const delivery = Number(deliveryCost.value);
  const contribution = 100 - 60 - 5 - delivery - 3;
  document.getElementById("delivery-value").textContent = delivery;
  document.getElementById("delivery-legend").textContent = delivery;
  document.getElementById("contribution-value").textContent = contribution;
  document.getElementById("break-even-value").textContent = Math.ceil(2000 / contribution);
  document.getElementById("cost-delivery-bar").style.width = `${delivery}%`;
  document.getElementById("cost-margin-bar").style.width = `${contribution}%`;
}
deliveryCost.addEventListener("input", updateEconomics);
updateEconomics();

let statusTimer;
function announce(message) {
  const status = document.getElementById("live-status");
  clearTimeout(statusTimer);
  status.textContent = message;
  status.classList.add("is-visible");
  statusTimer = setTimeout(() => status.classList.remove("is-visible"), 4200);
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  const originalLabel = button.textContent;
  let resetTimer;
  button.addEventListener("click", async () => {
    const text = document.getElementById(button.dataset.copy === "clone" ? "clone-command" : "start-prompt").textContent;
    if (!navigator.clipboard || !window.isSecureContext) {
      button.dataset.state = "error";
      announce("当前浏览器无法访问剪贴板，请选择文字后手动复制。");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "已复制";
      button.dataset.state = "success";
      announce(button.dataset.copy === "clone" ? "已复制项目克隆命令。" : "已复制开始提示词，请替换实际技能路径后使用。");
    } catch (error) {
      button.dataset.state = "error";
      announce("浏览器未允许复制，请选择文字后手动复制。");
    }
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      button.textContent = originalLabel;
      delete button.dataset.state;
    }, 2200);
  });
});

document.getElementById("download-template").addEventListener("click", () => {
  const template = `# 采购者访谈提纲与记录模板\n\n演示用虚构项目：示例产地梨。将内容替换为获准使用的项目材料。\n\n## 本轮要决定的事\n\n采购者为什么没有续单？哪些变化值得进入首轮试供？\n\n## 访谈前准备\n\n1. 确认受访者参与过对应交易，并取得访谈与记录同意。\n2. 准备该笔订单、规格说明、报价与验收记录；材料缺失时标记待取得。\n3. 先记录目标、来源编号、日期与受访者角色。\n\n## 围绕具体事件提问\n\n1. 请回想最近一次采购这批梨：什么时候、什么规格、多少数量、准备怎样使用？\n2. 当时比较了哪些选择，最后怎样决定？追问同规格报价、账期、配送和验收条件。\n3. 到货后发生了什么？哪项影响续单？请对应原话、记录或现场观察。\n4. 什么变化会让你愿意重试？区分明确条件与研究者自己的推断。\n\n## 记录字段\n\n| 来源编号 | 原话或观察 | 对应事件与材料位置 | 当前解释 | 其他解释 | 待取证 | 下一动作 |\n|---|---|---|---|---|---|---|\n| B01 | 采购者提到规格混装 | 访谈第2段；订单待取得 | 规格可能影响使用 | 价格或交付也可能影响 | 分级、验收与同条件报价 | 核对同一笔订单后继续补访 |\n\n## 访谈后检查\n\n1. 已区分受访者陈述、观察、已核验事实和研究者推断。\n2. 每项关键判断均能回到来源位置。\n3. 尚缺材料写明取得对象与下一步。\n4. 说明新证据怎样改变下一轮提问或试供决定。\n\n方法来源：https://github.com/qingmingyiyang/brand-strategy-analysis\n`;
  const url = URL.createObjectURL(new Blob([template], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "品牌研究-采购者访谈模板.md";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce("已生成访谈模板，请查看浏览器下载记录。");
});

const videoDialog = document.getElementById("video-dialog");
const introVideo = document.getElementById("intro-video");
let videoOpener;
document.querySelectorAll("[data-open-video]").forEach((button) => {
  button.addEventListener("click", () => {
    videoOpener = button;
    videoDialog.showModal();
    document.body.style.overflow = "hidden";
    document.getElementById("close-video").focus();
  });
});
document.getElementById("close-video").addEventListener("click", () => videoDialog.close());
videoDialog.addEventListener("click", (event) => {
  if (event.target === videoDialog) {
    const bounds = videoDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) videoDialog.close();
  }
});
videoDialog.addEventListener("close", () => {
  introVideo.pause();
  document.body.style.overflow = "";
  if (videoOpener) videoOpener.focus({ preventScroll: true });
});
introVideo.addEventListener("error", () => {
  document.getElementById("video-status").textContent = "视频暂时无法加载，请检查网络或通过项目文件下载后播放。";
});

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const animationTargets = Array.from(document.querySelectorAll("[data-animate]"));
const visibleAnimationTargets = new Set();
function updateAnimationState() {
  animationTargets.forEach((target) => target.classList.toggle("is-running", visibleAnimationTargets.has(target) && !document.hidden && !reducedMotion.matches));
}

if ("IntersectionObserver" in window) {
  if (!reducedMotion.matches) document.documentElement.classList.add("motion-enabled");
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach((target) => revealObserver.observe(target));
  const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visibleAnimationTargets.add(entry.target);
      else visibleAnimationTargets.delete(entry.target);
    });
    updateAnimationState();
  }, { threshold: 0.15 });
  animationTargets.forEach((target) => animationObserver.observe(target));
}
document.addEventListener("visibilitychange", updateAnimationState);
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) document.documentElement.classList.remove("motion-enabled");
  updateAnimationState();
});
