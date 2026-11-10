# 脆皮捏捏模擬器

在瀏覽器裡用手勢捏碎一顆 3D 蠟球。打開相機後先張手，再握拳。握得越緊，內芯壓得越扁；鬆手時內芯回彈，已裂開的脆皮保持原有裂痕。每次握拳推進一段，前兩下殼片跟著內芯變形，第三下才剝落散開。也可以用「手動捏一次」或空白鍵試玩。

靈感來自 [Namusu 的 Blender 示範](https://www.youtube.com/watch?v=Tb3xt4yurXY)。這是獨立重製，外殼幾何、內芯形變與音效均由程式生成。

## 本機執行

需要 Node.js 22.12 以上。

```sh
npm ci
npm run dev
```

用終端機顯示的 localhost 網址開啟。相機功能需要 localhost 或 HTTPS；3D 畫面需要 WebGL 2。第一次開啟相機時，瀏覽器會向 Google 下載 MediaPipe 的手部模型。相機影像和手部關鍵點均留在瀏覽器內。

```sh
npm test
npm run build
```

GitHub Pages 的發布來源設為 GitHub Actions。推送至 `main` 時，工作流程會跑測試、產生靜態網站並發布。
