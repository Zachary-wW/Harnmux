# 状态栏设计预览

`menu-bar-study.png` 由本目录 SwiftUI 源码离屏渲染，展示浅色/深色与任务层级。使用示例数据，按钮由排版元素示意，不响应点击，不连接 harness，也不表示真正存在待审批请求。

在 macOS、已配置 SwiftUI SDK 的 Swift 工具链中，从仓库根目录复现：

```sh
swiftc -parse-as-library design-system/harnmux/previews/RenderPreview.swift -o /tmp/harnmux-ui-preview
/tmp/harnmux-ui-preview "$PWD/design-system/harnmux/previews/menu-bar-study.png"
```

2026-10-21 验证：Swift 编译和 PNG 导出通过，已目视检查主要排版、中文、分隔线、明暗状态和内容边界。固定配色以 WCAG 相对亮度公式计算，正文/辅助/状态文字在其两种表面上的最低对比度：浅色 5.76:1、深色 6.22:1；蓝色主按钮白字 5.75:1。正式系统语义色、半透明材料、显示器和辅助设置仍需独立验证。

尚未验证：真实 MenuBarExtra 弹出、焦点、VoiceOver、键盘、缩放、动画、服务生命周期和协议/审批往返；这些是正式实现验收项，静态设计不替代它们。
