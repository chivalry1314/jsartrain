# 雨滴荷叶 · 音乐可视化

一个沉浸式的音乐可视化网页应用。雨滴随音乐节奏落下，歌词化作雨柱坠入水面，支持真实雨声白噪音、风声与雷声，营造雨夜听歌的氛围。

🌧️ **[在线体验](https://chivalry1314.github.io/jsartrain/)**

---

## ✨ 功能特性

- **歌词雨可视化**：导入 LRC 歌词或在线选歌后，每句歌词会化作雨柱从屏幕中央落下，击中水面激起涟漪。
- **真实雨声合成**：使用 Web Audio API 实时合成粉噪声雨声、风声、雨滴落地声与随机雷声。
- **雨势调节**：支持「小雨 / 中雨 / 大雨」三档，同时影响视觉雨量和声音层次。
- **沉浸式模式**：一键隐藏所有 UI，只保留全屏歌词雨；歌曲结束自动退出。
- **在线选歌**：通过 Meting API 搜索网易云音乐，点击即可播放。
- **本地音乐支持**：可上传本地音频文件和 LRC 歌词文件。
- **独立音量控制**：音乐音量与雨声音量可分别调节，既可以让雨声成为主角，也可以仅作背景点缀。
- **进度条拖动**：底部进度条支持点击和拖动跳转。

---

## 🚀 技术栈

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 7](https://vitejs.dev/)
- [p5.js](https://p5js.org/) —— 可视化渲染
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [Web Audio API](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Audio_API) —— 音频分析与雨声合成
- [Meting API](https://github.com/metowolf/Meting-API) —— 在线音乐搜索

---

## 🛠️ 本地运行

```bash
# 克隆项目
git clone https://github.com/chivalry1314/jsartrain.git
cd jsartrain

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开浏览器访问控制台输出的地址（默认 http://localhost:3000）。

---

## 📦 构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录，可直接部署到任何静态托管服务。

---

## 🌐 自动部署

本项目已配置 GitHub Actions，向 `main` 分支推送代码后会自动构建并部署到 GitHub Pages。

---

## 📝 使用说明

1. **上传音乐**：点击底部「上传音乐」选择本地音频文件，或点击右上角「在线选歌」搜索网易云音乐。
2. **导入歌词**（可选）：点击「导入歌词」上传 `.lrc` 文件；在线选歌时会自动尝试获取歌词。
3. **调节雨势**：底部控制栏点击「小雨 / 中雨 / 大雨」切换雨量。
4. **调节音量**：分别拖动音乐音量滑块和雨声滑块。
5. **沉浸模式**：点击「沉浸」隐藏 UI，右下角小按钮可退出。

---

## ⚠️ 注意事项

- 在线音乐数据来自第三方 Meting API，仅供学习交流使用。
- 浏览器默认会阻止自动播放音频，首次播放需要用户点击交互。
- 建议使用现代浏览器（Chrome / Edge / Firefox / Safari）访问。

---

## 📄 许可证

MIT License
