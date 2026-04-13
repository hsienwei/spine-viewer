# spine-viewer 規格書

## 技術棧
- Vue 3 + TypeScript + Vite
- @esotericsoftware/spine-webgl

## UI 布局
- 左側：控制面板 + 參數顯示
- 右側：WebGL Canvas 預覽區

## MVP 功能
| 功能 | 描述 |
|------|------|
| 文件加載 | 拖拽上傳 + 按鈕選取 .json/.atlas/.png |
| 播放控制 | 播放/暫停/停止/時間軸拖曳 |
| 速度調整 | 0.1x ~ 3x |
| 動畫切換 | 從列表選擇動畫 |
| 參數顯示 | 動畫名稱、當前時間、總時長、DrawCall |
| Slot/Bone 控制 | 顯示控制入口 |

## 版本策略
- 4.x 主 + 3.x 回退