# 介绍影片动画源码

影片以原生Canvas 2D绘制，读取真实旁白和时间线。十四个镜头围绕多方调研视角、事实与解释分离、最小单元化和八项基石原则展开，成果在结尾简述。浅绢纸、柔光阴影、宋体标题与局部青绿构成统一画面，纸页展开、细线聚合、横向移焦与局部推拉承担讲解运动。

## 输入

1. `timeline.json`：1920×1080、30fps；包含分镜、成片绝对秒数和逐句字幕时间。八个`principle`分镜分别带有1至8的`principle`整数，依序完整出现。
2. `narration.wav`：随源码保留的真实旁白；也可用时间线的 `audioFile` 指定同目录文件。
3. 本机 Chromium 或 Edge，以及可用的 Playwright。脚本使用环境变量 `PLAYWRIGHT_PACKAGE` 和 `EDGE_EXECUTABLE` 接受本机路径。
4. `assets/pear.png`：收尾使用的透明梨图层，内置image_gen生成；加载完成后才允许预览和录制。
5. `../cover.png`：用户指定的共用封面，1920×1080。原图为`assets/cover-reference.png`，网页首屏与影片使用同一规范化派生图。
6. `assets/opening-stage.png`：内置image_gen生成的无字场景，参考用户图片的浅绢纸、柔光与大梨构图。订单、角色、解释和文字由代码绘制。生成提示词见[opening-stage-prompt.md](assets/opening-stage-prompt.md)。

时间线的`start`、`end`和每条字幕的时间以成片为基准，包含一秒封面：前0.5秒完整展示，后0.5秒渐隐进入正文。旁白结束后保留三秒入口画面。字幕是画面中唯一的中文字幕层。片长按真实旁白测量，段间停顿延续上一镜头。

主画布和纸纹画布使用一致的渲染设置，各帧重置绘图状态。场景运动只由传入时间决定，同一环境内可重复定位同一画面。长字幕按标点选择平衡的两行，文字和字幕时间来自原稿。

第1秒显示一笔订单P-014与供货者、采购者、合作社三个角色；价格、规格和分级成本在第一句结束前展开。相邻场景沿用同一订单与三方陈述，再进入事实核验、最小单元和八项原则。参考原图`assets/opening-reference.png`用于风格档案，正式画面使用无字场景与独立文字图层。

## 预览与导出

在项目根目录启动本地 HTTP 服务，打开 `media/brand-overview/source/film.html`。本机预览可以播放、暂停和定位时间。

先检查全部镜头的文字结构。第0秒为完整的用户封面，可直接导出：

```text
node media/brand-overview/source/render.mjs --url http://127.0.0.1:8000/media/brand-overview/source/film.html --probe true --cover cover.png --cover-time 0
```

正式MP4按固定时间逐帧绘制，直接复制已附影片的AAC旁白。修改旁白后，先从WAV生成包含一秒片头和三秒片尾的AAC文件，再将其作为`--audio`输入。需要本机FFmpeg，并将下面的`ffmpeg`替换为可执行文件路径：

```text
ffmpeg -n -i media/brand-overview/source/narration.wav -af "adelay=1000|1000,apad=pad_dur=3" -ar 48000 -ac 2 -c:a aac -b:a 192k narration-padded.m4a
```

```text
node media/brand-overview/source/render.mjs --url http://127.0.0.1:8000/media/brand-overview/source/film.html --mode frames --workers 4 --ffmpeg ffmpeg --audio media/brand-overview/intro.mp4 --output overview.mp4
```

每帧以`frame / 30`定位，PNG画面按帧编号送入FFmpeg，输出1920×1080、30fps、H.264/AAC MP4。`--workers`接受1至4个独立页面，批内并行绘制后按顺序编码。画面与字幕使用同一时间基准，音频直接复制输入AAC。正式导出不依赖浏览器的实时播放速度。输出文件需要使用新名称，避免覆盖输入文件。

需要检查片头时，可增加`--end 6`，导出从第0秒开始的前6秒；省略该参数时导出完整影片。

也可录制浏览器实时画面与旁白：

```text
node media/brand-overview/source/render.mjs --url http://127.0.0.1:8000/media/brand-overview/source/film.html --output overview.webm
```

实时录制通过 Canvas 的视频流与 AudioContext 的旁白音轨组成 WebM，录制时保持页面运行。封面直接由 Canvas 导出 PNG。

## 接口

1. `window.filmReady`：等待时间线和真实旁白加载，失败时抛出错误。
2. `window.renderFrame(seconds)`：确定性绘制指定秒数，返回镜头标识。
3. `window.filmDiagnostics()`：提供时长、字幕数量和文字结构检查结果。
4. `window.recordFilm()`：录制影片并返回媒体内容和时长，缺失真实旁白时停止。
5. `window.filmFrameInfo()`：提供当前镜头、局部时间、镜头运动与进度，以及实际绘制的可见文字及边界，用于核对讲解对象。

## 内容与画面关系

1. 同一订单连接供货者、采购者和合作社，三方说法均作为来源陈述保留。
2. 来源陈述、可核材料、当前解释和各方目标分别呈现，核验回到同一事件与同一口径。
3. 最小单元展开做什么、拿什么做、按什么顺序、分支怎样选择、完成样例、怎样检查、卡住怎么办七个字段。
4. 八项原则分别呈现完整名称与对应关系图：事实与理论、相同证据标准、证据迭代、消费者与主体、聚焦取舍、纵深追问、能力成长，以及按目标调用框架。
5. 访谈、分析、方案、总体规划、专题和汇报作为原则的应用简述。

动画案例为虚构教学材料，方法内容对应仓库公开技能。旁白由AI合成，影片默认没有背景音乐。
