# 品牌战略汇报固定模板

仅在用户需要品牌战略PPT、逐页设计或HTML演示时加载。分析与调研任务不自动制作演示。此文件是本技能品牌红演示的默认设计记录和组件规范；实际项目沿用已有设计记录，采用本模板时在其README登记本文件或项目派生规范，记录用户调整。局部修改前读取相应组件与实现。

来源：经用户指定，从历史 brand-html-ppt-design 的视觉、HTML、内容架构和质量规范选择性派生于2026-09-19。保留固定视觉，调整内容裁剪与可读性边界；不依赖安装已退役技能，不随历史源文件自动同步。

## 使用顺序

1. 从已确认报告提取本次受众要决定什么，保留判断、关键证据、限制与行动。事实不足标待核验。
2. 每页填：章节标识、判断式标题、左栏论证、右栏图形及其数据来源、页码；详细步骤放讲稿或明确指向的附件。
3. 按下表选择封面、分节页、单图内容页或双图内容页，复用下方组件。用户指定模板或已确认项目风格优先。
4. 需要HTML时生成独立文件；需要可编辑PPTX时在可用环境使用原生PPTX制作工具，按相同版式重建，不把HTML改后缀冒充PPTX。只有逐页文稿需求时交文稿即可。
5. 实际生成后打开检查目标画布、窄视口与打印；未渲染只能声明结构检查，不能声明视觉验收通过。

## 固定视觉参数

| 项目 | 默认值与组件用途 |
|---|---|
| 画布 | 1280×720，16:9，白底，无圆角；页间距20px，外围#f5f5f5 |
| 品牌色 | 主色#910101，中间红#b01a1a，亮红#d42a2a；正文#333，辅助#555，左栏#fafafa，金色#C9A96E仅少量强调 |
| 字体 | Microsoft YaHei、微软雅黑、Arial、sans-serif |
| 封面 | 135度#910101至#5a0101渐变，白字居中；标题48px/700，副标题22px，标签白色半透明描边 |
| 分节页 | 160度#910101、#b01a1a、#d42a2a渐变；编号80px，标题42px，副标题20px |
| 内容页眉 | 高72px，padding 18px 50px；135度主色至中间红；标题22px粗体，章节标识14px |
| 内容两栏 | 2:3；左栏padding 30px 38px，右侧3px主色分隔线；右栏padding 20px 22px，图间距10px |
| 左栏 | 小标题18px粗体，左侧5px主色竖线，padding-left 12px；正文13.5px，行高1.9，两端对齐，首行缩进2em |
| 图容器 | 2px中间红虚线，圆角8px；单图占满可用高度，双图等分；图注12px，标签10px |
| 页码 | 右30px、下15px，13px中间红；深色页用白色 |

以上字号沿用历史近屏阅读模板。投影、远距离观看时先检查实际可读性，必要时整体提高正文字级、拆页或减少内容，并记录项目变体；不能靠缩小字体塞满页面。标题默认无逗号。既有事实优先、呼吸感、纵深论证与最小单元要求持续有效。

## 可复制HTML母版

复制以下代码保存为UTF-8的 `.html` 文件。它展示四种页型；方括号是待替换字段，演示用SVG是结构示意，没有实际数据含义。交付真实报告前替换全部字段、来源和图形。新增页复制对应section，统一修改CSS变量与组件，不逐页手写另一套样式。

```html
<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>品牌战略汇报模板</title>
<style>
:root{--brand:#910101;--mid:#b01a1a;--bright:#d42a2a;--ink:#333}
*{box-sizing:border-box}body{margin:0;min-width:1280px;background:#f5f5f5;font-family:'Microsoft YaHei','微软雅黑',Arial,sans-serif;color:var(--ink)}
.slide{position:relative;width:1280px;height:720px;margin:20px auto;background:white;box-shadow:0 4px 20px #00000026}
.cover,.section{display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;text-align:center;padding:60px}
.cover{background:linear-gradient(135deg,#910101,#5a0101)}.cover h1{font-size:48px;letter-spacing:4px}.cover p{font-size:22px;opacity:.85}.tag{border:1px solid #ffffff80;padding:10px 24px;letter-spacing:8px}
.section{background:linear-gradient(160deg,#910101,#b01a1a 50%,#d42a2a)}.section b{font-size:80px}.section h1{font-size:42px;letter-spacing:4px}.section p{font-size:20px}
header{height:72px;padding:18px 50px;display:flex;align-items:center;justify-content:space-between;gap:24px;background:linear-gradient(135deg,var(--brand),var(--mid));color:white}header h1{margin:0;font-size:22px;letter-spacing:2px}header span{font-size:14px;opacity:.85}
.content{display:flex;height:648px}.left{flex:2;min-width:0;padding:30px 38px;background:#fafafa;border-right:3px solid var(--brand);display:flex;flex-direction:column;justify-content:center}.right{flex:3;min-width:0;padding:20px 22px 42px;display:flex;flex-direction:column;gap:10px}
h2{font-size:18px;color:var(--brand);border-left:5px solid var(--brand);padding-left:12px}.left p{font-size:13.5px;line-height:1.9;text-align:justify;text-indent:2em}
.chart{position:relative;flex:1;min-height:0;margin:0;border:2px dashed var(--mid);border-radius:8px;padding:32px 16px 12px;display:flex;flex-direction:column;justify-content:center}.label{position:absolute;top:6px;left:10px;font-size:10px;font-weight:bold;color:var(--brand);background:#ffffffd9;padding:2px 8px}.chart svg{width:100%;flex:1;min-height:0}.chart figcaption{font-size:12px;line-height:1.6;text-align:center;color:#555}
.page{position:absolute;bottom:15px;right:30px;font-size:13px;color:var(--mid)}.cover .page,.section .page{color:white}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
@media print{@page{size:1280px 720px;margin:0}body{min-width:0;background:white;overflow:visible}.slide{margin:0;box-shadow:none;break-after:page;print-color-adjust:exact}.slide:last-child{break-after:auto}}
</style>
<section class="slide cover"><div class="tag">[品牌或报告类别]</div><h1>[报告名称]</h1><p>[汇报单位与日期]</p><span class="page">01</span></section>
<section class="slide section"><b>01</b><h1>[章节名称]</h1><p>[本章要回答的问题]</p><span class="page">02</span></section>
<section class="slide"><header><h1>[一个有证据的核心判断]</h1><span>[章节标识]</span></header><div class="content"><article class="left"><h2>[分论点]</h2><p>[事实及来源。解释它如何支持判断，保留成立条件。]</p><p>[当前选择与下一动作，执行细节指向附件。]</p></article><div class="right"><figure class="chart"><span class="label">[机制图]</span><svg viewBox="0 0 700 360" preserveAspectRatio="xMidYMid meet" role="img" aria-label="待替换机制示意"><g fill="#f5f5f5" stroke="#910101" stroke-width="2"><rect x="40" y="130" width="240" height="90" rx="8"/><rect x="420" y="130" width="240" height="90" rx="8"/><path d="M280 175H415m-12-8 12 8-12 8" fill="none"/></g><g font-size="18" text-anchor="middle" fill="#333"><text x="160" y="181">[待验证条件]</text><text x="540" y="181">[预期变化]</text></g></svg><figcaption>[图名、关系含义、来源及证据状态]</figcaption></figure></div></div><span class="page">03</span></section>
<section class="slide"><header><h1>[由两组证据共同支持的判断]</h1><span>[章节标识]</span></header><div class="content"><article class="left"><h2>[判断的依据]</h2><p>[说明两图之间的比较或支撑关系，不并列两个无关主题。]</p></article><div class="right"><figure class="chart"><span class="label">[图一名称]</span><figcaption>[插入真实图表或照片并填写来源]</figcaption></figure><figure class="chart"><span class="label">[图二名称]</span><figcaption>[插入同口径图表或照片并填写来源]</figcaption></figure></div></div><span class="page">04</span></section>
</html>
```

## 图形与内容适配

先测可用绘图区，再决定图形。右栏可用宽约700px，准确值以渲染为准；N个横向节点宽度可按 `(绘图区宽度－间距×(N－1))/N` 计算。根据实际文字换行估算高度，SVG设置viewBox及 `xMidYMid meet`。出现小字或裁切时拆图、改表或拆页，不靠压缩图形补救。

流程与机制用SVG或HTML实际绘制，数据图保留单位、时期、口径和来源；照片使用真实或明确标注的概念素材。草稿允许说明素材需求，完成稿不能把图形描述当作已经绘制的图。默认静态；确有叙事需要时每页最多两处克制动效，支持减少动态效果，不自动轮播。

每页一个核心判断，跨页可以递进，也可以是同一结论下的并列证据。每页3–5项和约200字仅作密度提示，不固定节数或页数。不为缩字删掉关键因果、反证和决策所需的成本风险；必要时保留讲稿及附件入口。

## 交付检查

- 标题、左栏、右图是否共同支持同一个判断；各页是否承接本次决策问题。
- 母版字段是否替换，图形是否实际存在，数据与图片是否可追溯。
- 检查1280×720下文字、图形、页码无重叠裁切；窄屏允许横向滚动，不隐藏内容。
- 实际打开打印预览检查分页和背景；若交付PPTX，在目标软件检查可编辑元素、字体替代与分页。
- 与已有规范冲突时记录具体调整，保留证据完整性与可读性。模板结构检查不能代替成品渲染。
