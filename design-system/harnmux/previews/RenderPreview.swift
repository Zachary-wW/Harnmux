// Static design study only. No harness connection or actionable approvals.
// swiftc -parse-as-library RenderPreview.swift -o /tmp/harnmux-ui-preview
// /tmp/harnmux-ui-preview <absolute-output.png>
import SwiftUI
import AppKit

struct Palette {
    let dark: Bool
    var surface: Color { dark ? Color(red: 0.12, green: 0.13, blue: 0.15) : .white }
    var inset: Color { dark ? Color(white: 0.17) : Color(white: 0.96) }
    var ink: Color { dark ? Color(white: 0.95) : Color(white: 0.10) }
    var muted: Color { dark ? Color(white: 0.70) : Color(white: 0.36) }
    var line: Color { dark ? Color(white: 0.25) : Color(white: 0.88) }
    var blue: Color { dark ? Color(red: 0.42, green: 0.69, blue: 1) : Color(red: 0.12, green: 0.36, blue: 0.75) }
    var amber: Color { dark ? Color(red: 0.99, green: 0.75, blue: 0.37) : Color(red: 0.52, green: 0.31, blue: 0.04) }
    var green: Color { dark ? Color(red: 0.49, green: 0.81, blue: 0.66) : Color(red: 0.10, green: 0.41, blue: 0.27) }
}

struct Panel: View {
    let p: Palette
    func label(_ title: String, icon: String, color: Color) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon).font(.system(size: 11, weight: .semibold))
            Text(title).font(.system(size: 12, weight: .medium))
        }.foregroundStyle(color)
    }
    func action(_ title: String, primary: Bool = false) -> some View {
        Text(title).font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 12).frame(height: 29)
            .foregroundStyle(primary ? Color.white : p.ink)
            .background(primary ? Color(red: 0.14, green: 0.38, blue: 0.80) : p.inset)
            .clipShape(RoundedRectangle(cornerRadius: 6))
    }
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "point.3.connected.trianglepath.dotted").font(.system(size: 17))
                    Text("Harnmux").font(.system(size: 16, weight: .semibold))
                }
                Spacer()
                Image(systemName: "gearshape").foregroundStyle(p.muted)
            }.padding(.bottom, 9)
            HStack {
                Text("1 运行中").font(.system(size: 12)).foregroundStyle(p.muted)
                Text("·").foregroundStyle(p.muted)
                Text("1 待处理").font(.system(size: 12, weight: .medium)).foregroundStyle(p.amber)
                Spacer()
                label("已连接", icon: "checkmark.circle", color: p.green)
            }.padding(.bottom, 17)
            Rectangle().fill(p.line).frame(height: 1)
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("需要你处理").font(.system(size: 12, weight: .semibold)).foregroundStyle(p.muted)
                    Spacer()
                    Text("1").font(.system(size: 11, weight: .medium)).foregroundStyle(p.muted)
                }
                VStack(alignment: .leading, spacing: 11) {
                    HStack {
                        label("等待审批", icon: "hand.raised", color: p.amber)
                        Spacer()
                        Text("刚刚").font(.system(size: 11)).foregroundStyle(p.muted)
                    }
                    Text("验证登录修复").font(.system(size: 14, weight: .semibold))
                    Text("执行者 · DSH  /  默认模型").font(.system(size: 12)).foregroundStyle(p.muted)
                    VStack(alignment: .leading, spacing: 5) {
                        Text("npm test").font(.system(size: 12, design: .monospaced))
                        Text("目录 · worker/login-fix").font(.system(size: 11)).foregroundStyle(p.muted)
                    }.padding(10).frame(maxWidth: .infinity, alignment: .leading)
                        .background(p.surface).clipShape(RoundedRectangle(cornerRadius: 6))
                    HStack(spacing: 8) {
                        Text("查看详情").font(.system(size: 12)).foregroundStyle(p.blue)
                        Spacer()
                        action("拒绝")
                        action("允许一次", primary: true)
                    }
                }.padding(13).background(p.inset).clipShape(RoundedRectangle(cornerRadius: 10))
            }.padding(.vertical, 16)
            VStack(alignment: .leading, spacing: 12) {
                Text("进行中").font(.system(size: 12, weight: .semibold)).foregroundStyle(p.muted)
                HStack(alignment: .top, spacing: 11) {
                    Image(systemName: "circle.dotted").font(.system(size: 18)).foregroundStyle(p.blue).frame(width: 22)
                    VStack(alignment: .leading, spacing: 5) {
                        Text("补充接口边界测试").font(.system(size: 13, weight: .medium))
                        Text("Codex · 默认模型").font(.system(size: 12)).foregroundStyle(p.muted)
                        Text("最近事件：正在检查测试用例").font(.system(size: 12)).foregroundStyle(p.muted)
                    }
                    Spacer()
                    Text("2:14").font(.system(size: 11, design: .monospaced)).foregroundStyle(p.muted)
                }
            }.padding(.bottom, 17)
            Rectangle().fill(p.line).frame(height: 1)
            VStack(alignment: .leading, spacing: 12) {
                Text("最近完成").font(.system(size: 12, weight: .semibold)).foregroundStyle(p.muted)
                HStack(alignment: .top, spacing: 11) {
                    Image(systemName: "checkmark.circle").font(.system(size: 18)).foregroundStyle(p.green).frame(width: 22)
                    VStack(alignment: .leading, spacing: 5) {
                        Text("整理错误处理逻辑").font(.system(size: 13, weight: .medium))
                        Text("执行已完成 · 待验收").font(.system(size: 12)).foregroundStyle(p.muted)
                    }
                    Spacer()
                    Text("查看交付").font(.system(size: 12)).foregroundStyle(p.blue)
                }
            }.padding(.vertical, 17)
            Rectangle().fill(p.line).frame(height: 1)
            HStack {
                Text("设计预览 · 示例数据").font(.system(size: 11)).foregroundStyle(p.muted)
                Spacer()
                Text("关闭面板不停止任务").font(.system(size: 11)).foregroundStyle(p.muted)
            }.padding(.top, 13)
        }.foregroundStyle(p.ink).padding(16).frame(width: 400)
            .background(p.surface).clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(p.line, lineWidth: 0.7))
            .compositingGroup()
            .shadow(color: .black.opacity(p.dark ? 0.22 : 0.10), radius: 15, y: 7)
    }
}

struct Study: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Harnmux").font(.system(size: 25, weight: .semibold)).foregroundStyle(Color(white: 0.12))
                Text("状态栏设计提案 / 原生 SwiftUI 排版 / 非运行中产品")
                    .font(.system(size: 13)).foregroundStyle(Color(white: 0.36))
            }
            HStack(alignment: .top, spacing: 32) {
                ForEach([false, true], id: \.self) { dark in
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 6) {
                            Image(systemName: dark ? "moon" : "sun.max")
                            Text(dark ? "深色模式" : "浅色模式")
                        }.font(.system(size: 12, weight: .medium)).foregroundStyle(Color(white: 0.36))
                        Panel(p: Palette(dark: dark)).environment(\.colorScheme, dark ? .dark : .light)
                    }
                }
            }
            Text("优先呈现待处理事项；执行与验收分开；没有原生进度就不显示百分比。")
                .font(.system(size: 12)).foregroundStyle(Color(white: 0.36))
        }.padding(36).background(Color(red: 0.94, green: 0.95, blue: 0.96))
    }
}

@main
@MainActor
struct RenderPreview {
    static func main() throws {
        let target = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "/tmp/harnmux-menu-bar.png"
        let renderer = ImageRenderer(content: Study())
        renderer.scale = 2
        guard let cg = renderer.cgImage else { fatalError("SwiftUI render failed") }
        let rep = NSBitmapImageRep(cgImage: cg)
        guard let data = rep.representation(using: .png, properties: [:]) else { fatalError("PNG encode failed") }
        try data.write(to: URL(fileURLWithPath: target))
        print(target)
    }
}
