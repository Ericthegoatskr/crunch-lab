# 脆皮捏捏模擬器

在瀏覽器裡選擇杜拜巧克力、奶油塊、馬卡龍、荷包蛋或甜甜圈。雙顆模式可分別選款，開啟相機後兩隻手各控制一顆。先張手再握拳，握得越緊就壓得越扁。脆皮款會在第三下散開，回彈款可以反覆捏。也可以用畫面上的按鈕或空白鍵試玩，按音效按鈕聽不同材質的聲音。

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
