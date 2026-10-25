import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

const values = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  const value = process.argv[i + 1];
  if (!key?.startsWith("--") || !value) throw new Error("参数必须使用 --name value 形式。");
  values.set(key, value);
}
const url = values.get("--url");
const output = values.get("--output");
const cover = values.get("--cover");
const probe = values.get("--probe") === "true";
const mode = values.get("--mode") || "stream";
const workers = Number(values.get("--workers") || 1);
if (!Number.isInteger(workers) || workers < 1 || workers > 4) throw new Error("--workers 必须为1至4的整数。");
if (!["stream", "frames"].includes(mode)) throw new Error("--mode 必须为 stream 或 frames。");
if (mode === "frames" && (!output || !values.get("--ffmpeg") || !values.get("--audio"))) throw new Error("逐帧导出需要 --output、--ffmpeg 和 --audio。");
if (!url || (!output && !cover && !probe)) throw new Error("需要 --url，以及 --output、--cover 或 --probe true。");
const require = createRequire(import.meta.url);
const packagePath = process.env.PLAYWRIGHT_PACKAGE || "playwright";
const { chromium } = require(packagePath);
const executablePath = process.env.EDGE_EXECUTABLE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"]
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => { if (response.status() >= 400 && !response.url().endsWith("favicon.ico")) errors.push(`HTTP ${response.status()} ${response.url()}`); });
try {
  await page.goto(url, { waitUntil: "networkidle" });
  const ready = await page.evaluate(() => window.filmReady);
  if (errors.length) throw new Error(errors.join("\n"));
  if (cover) {
    const coverTime = Number(values.get("--cover-time") || 0);
    if (!Number.isFinite(coverTime) || coverTime < 0 || coverTime > ready.duration) throw new Error("封面时间超出影片范围。");
    const encoded = await page.evaluate(seconds => { window.renderFrame(seconds); return document.getElementById("film").toDataURL("image/png").split(",")[1]; }, coverTime);
    await mkdir(path.dirname(path.resolve(cover)), { recursive: true });
    await writeFile(cover, Buffer.from(encoded, "base64"));
  }
  if (probe) {
    const result = await page.evaluate(() => {
      const total = window.filmDiagnostics().duration;
      for (let time = 0; time <= total; time += .25) window.renderFrame(time);
      return window.filmDiagnostics();
    });
    if (result.textIssues.length) throw new Error(JSON.stringify(result.textIssues));
    console.log(JSON.stringify({ ready, diagnostics: result, cover: cover || null }));
  }
  if (output && mode === "frames") {
    await mkdir(path.dirname(path.resolve(output)), { recursive: true });
    const end = Number(values.get("--end") || ready.duration);
    if (!Number.isFinite(end) || end <= 0 || end > ready.duration) throw new Error("--end 必须在影片时长范围内。");
    const fps = 30, frames = Math.ceil(end * fps);
    const renderPages = [page, ...await Promise.all(Array.from({ length: workers - 1 }, async () => {
      const worker = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      worker.on("pageerror", error => errors.push(error.message));
      worker.on("response", response => { if (response.status() >= 400 && !response.url().endsWith("favicon.ico")) errors.push(`HTTP ${response.status()} ${response.url()}`); });
      await worker.goto(url, { waitUntil: "networkidle" });
      const workerReady = await worker.evaluate(() => window.filmReady);
      if (workerReady.duration !== ready.duration) throw new Error("并行页面的时间线不同。");
      return worker;
    }))];
    if (errors.length) throw new Error(errors.join("\n"));
    const parallelFrames = await Promise.all(renderPages.map(worker => worker.evaluate(seconds => {
      window.renderFrame(seconds);
      return document.getElementById("film").toDataURL("image/png");
    }, ready.duration * .55)));
    if (parallelFrames.some(frame => frame !== parallelFrames[0])) throw new Error("并行页面对相同时间的画面生成结果不同。");
    console.log(JSON.stringify({ parallel_frame_match: true, workers }));
    const encoder = spawn(values.get("--ffmpeg"), ["-hide_banner", "-loglevel", "error", "-n", "-f", "image2pipe", "-framerate", String(fps), "-vcodec", "png", "-i", "pipe:0", "-i", values.get("--audio"), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", "-metadata", "comment=AI-generated narration and illustrations; fictional teaching example", ...(values.has("--end") ? ["-t", String(end)] : []), "-movflags", "+faststart", path.resolve(output)], { stdio: ["pipe", "ignore", "pipe"] });
    let encoderError, encoderLog = "";
    encoder.stderr.on("data", chunk => { encoderLog = (encoderLog + chunk).slice(-8000); });
    encoder.on("error", error => { encoderError = error; });
    encoder.stdin.on("error", error => { encoderError = error; });
    const encoded = once(encoder, "close");
    try {
      for (let first = 0; first < frames; first += workers) {
        if (encoderError) throw encoderError;
        if (encoder.exitCode !== null) throw new Error(`FFmpeg 提前终止：${encoderLog}`);
        const batch = await Promise.all(renderPages.slice(0, Math.min(workers, frames - first)).map(async (worker, offset) => worker.evaluate(seconds => {
          window.renderFrame(seconds);
          return document.getElementById("film").toDataURL("image/png").split(",")[1];
        }, (first + offset) / fps)));
        for (const [offset, png] of batch.entries()) {
          if (!encoder.stdin.write(Buffer.from(png, "base64"))) await once(encoder.stdin, "drain");
          const frame = first + offset;
          if (frame % 300 === 0) console.log(JSON.stringify({ frame, frames, seconds: frame / fps, workers }));
        }
      }
      encoder.stdin.end();
      const [code] = await encoded;
      if (encoderError || code !== 0) throw encoderError || new Error(`FFmpeg 编码失败：${encoderLog}`);
      const diagnostics = await Promise.all(renderPages.map(worker => worker.evaluate(() => window.filmDiagnostics())));
      const textIssues = diagnostics.flatMap(item => item.textIssues);
      if (errors.length || textIssues.length) throw new Error(JSON.stringify({ errors, textIssues }));
      console.log(JSON.stringify({ output: path.resolve(output), frames, fps, duration: frames / fps, audio: path.resolve(values.get("--audio")), mode, workers }));
    } finally {
      if (encoder.exitCode === null) encoder.kill();
    }
  }
  if (output && mode === "stream") {
    const result = await page.evaluate(() => window.recordFilm());
    if (errors.length) throw new Error(errors.join("\n"));
    await mkdir(path.dirname(path.resolve(output)), { recursive: true });
    const bytes = Buffer.from(result.base64, "base64");
    if (bytes.length !== result.bytes) throw new Error("录制媒体字节数与导出结果不同。");
    await writeFile(output, bytes);
    const { base64, ...metadata } = result;
    console.log(JSON.stringify({ output: path.resolve(output), ...metadata }));
  }
} finally {
  await browser.close();
}
