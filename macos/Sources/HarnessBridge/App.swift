import SwiftUI
import AppKit

@main
struct HarnessBridgeApp: App {
    @StateObject private var model = BridgeModel()
    var body: some Scene {
        MenuBarExtra {
            StatusPanel(model: model)
        } label: {
            Label {
                if !model.statusText.isEmpty { Text(model.statusText) }
            } icon: {
                Image(systemName: model.connectionError != nil ? "wifi.slash" : model.pending > 0 ? "hand.raised" : "point.3.connected.trianglepath.dotted")
            }
            .accessibilityLabel("Harness Bridge，\(model.statusText.isEmpty ? "无活动任务" : model.statusText)")
        }
        .menuBarExtraStyle(.window)
    }
}

struct StatusPanel: View {
    @ObservedObject var model: BridgeModel
    @State private var continuation = ""
    @State private var showEvents = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            if let message = model.connectionError {
                Label(message, systemImage: "wifi.slash")
                    .font(.caption).foregroundStyle(.orange).fixedSize(horizontal: false, vertical: true)
            }
            if let error = model.operationError {
                Text(error).font(.caption).foregroundStyle(.red).textSelection(.enabled)
            }
            Divider()
            if let id = model.selected {
                HStack {
                    Button { model.selected = nil; model.detail = nil } label: { Label("任务列表", systemImage: "chevron.left") }
                    Spacer()
                    if model.busy { ProgressView().controlSize(.small) }
                }
                if let detail = model.detail, detail.task.id == id {
                    ScrollView { detailView(detail).frame(maxWidth: .infinity, alignment: .leading) }
                } else { ProgressView("读取任务…").frame(maxWidth: .infinity, minHeight: 100) }
            } else {
                taskList
            }
            Divider()
            HStack {
                Text(model.connectionError == nil ? "关闭面板不停止任务" : "上次数据，尚未实时更新")
                    .font(.caption).foregroundStyle(.secondary)
                Spacer()
                Menu {
                    Button("打开 Bridge 配置目录") { model.reveal(model.home.path) }
                    Button("退出界面（任务继续）") { NSApplication.shared.terminate(nil) }
                } label: { Image(systemName: "gearshape") }
                .menuStyle(.borderlessButton).fixedSize()
                .accessibilityLabel("设置与退出")
            }
        }
        .padding(16)
        .frame(width: 420)
        .frame(maxHeight: 620)
        .onChange(of: model.selected) { _, _ in continuation = ""; showEvents = false }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Harness Bridge", systemImage: "point.3.connected.trianglepath.dotted").font(.headline)
                Spacer()
                Button { Task { await model.refresh() } } label: { Image(systemName: "arrow.clockwise") }
                    .buttonStyle(.plain).accessibilityLabel("刷新任务")
            }
            HStack {
                Text("\(model.running) 运行中 · \(model.pending) 待处理").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Label(model.connectionError == nil && model.lastRefresh != nil ? "已连接" : "未连接", systemImage: model.connectionError == nil && model.lastRefresh != nil ? "checkmark.circle" : "exclamationmark.circle")
                    .font(.caption).foregroundStyle(model.connectionError == nil && model.lastRefresh != nil ? .green : .secondary)
            }
        }
    }

    private var taskList: some View {
        Group {
            if model.tasks.isEmpty {
                ContentUnavailableView {
                    Label("尚无协作任务", systemImage: "tray")
                } description: {
                    Text("在 Codex 或 DSH 中使用 Bridge Skill 发起任务。入口与 Leader 可以分别选择。")
                }.frame(minHeight: 190)
            } else {
                List {
                    let waiting = model.tasks.filter { $0.state == "waiting_approval" || $0.state == "interrupted" }
                    let active = model.tasks.filter { $0.active && $0.state != "waiting_approval" }
                    let finished = model.tasks.filter { !$0.active && $0.state != "interrupted" }
                    if !waiting.isEmpty { Section("需要处理") { ForEach(waiting) { row($0) } } }
                    if !active.isEmpty { Section("进行中") { ForEach(active) { row($0) } } }
                    if !finished.isEmpty { Section("最近交付") { ForEach(finished.prefix(20)) { row($0) } } }
                }.listStyle(.plain).frame(minHeight: 170, maxHeight: 420)
            }
        }
    }
    private func row(_ task: BridgeTask) -> some View {
        Button { Task { await model.select(task.id) } } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: symbol(task)).foregroundStyle(color(task)).frame(width: 20)
                VStack(alignment: .leading, spacing: 5) {
                    Text(task.title).font(.body.weight(.medium)).lineLimit(2).multilineTextAlignment(.leading)
                    Text("\(task.role == "leader" ? "负责人" : "执行者") · \(task.harness) · \(task.actualModel ?? task.requestedModel ?? "原生默认模型")")
                        .font(.caption).foregroundStyle(.secondary).lineLimit(2)
                    Text(task.stateLabel).font(.caption).foregroundStyle(color(task))
                }
                Spacer(minLength: 0)
                if task.unread { Image(systemName: "circle.fill").font(.system(size: 6)).foregroundStyle(.tint).accessibilityLabel("未读结果") }
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
            }.padding(.vertical, 7).contentShape(Rectangle())
        }.buttonStyle(.plain)
            .accessibilityLabel("\(task.title)，\(task.harness)，\(task.stateLabel)")
    }
    @ViewBuilder private func detailView(_ d: TaskDetail) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(d.task.title).font(.headline).textSelection(.enabled)
            Text("入口 \(d.task.entry) · \(d.task.role == "leader" ? "负责人" : "执行者") \(d.task.harness)")
                .font(.subheadline).foregroundStyle(.secondary)
            Text(d.task.stateLabel).foregroundStyle(color(d.task))
            Text("请求模型：\(d.task.requestedModel ?? "原生默认")\n实际模型：\(d.task.actualModel ?? "尚未报告")")
                .font(.caption).foregroundStyle(.secondary).textSelection(.enabled)
            if let nativeID = d.task.nativeSessionId {
                Text("原生会话：\(nativeID)").font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary).textSelection(.enabled)
            }
            ForEach(d.approvals.filter { $0.state == "pending" }) { approval in
                VStack(alignment: .leading, spacing: 10) {
                    Label("需要你的审批", systemImage: "hand.raised").font(.headline).foregroundStyle(.orange)
                    Text(approval.method).font(.caption).foregroundStyle(.secondary).textSelection(.enabled)
                    Text(approval.details.pretty).font(.system(.caption, design: .monospaced))
                        .textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
                    ViewThatFits(in: .horizontal) {
                        HStack { decisionButtons(approval) }
                        VStack(alignment: .leading) { decisionButtons(approval) }
                    }
                    Text("授权范围以按钮与原生请求为准；请求失效后不能批准。")
                        .font(.caption).foregroundStyle(.secondary)
                }.padding(12).background(.quaternary.opacity(0.45), in: RoundedRectangle(cornerRadius: 9))
            }
            if let error = d.task.error { Text(error).foregroundStyle(.red).textSelection(.enabled) }
            if let result = d.task.result, !result.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("执行报告").font(.headline)
                    Text(result).textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
                    Button("复制报告") { model.copy(result) }
                }
            }
            if let delivery = d.task.delivery {
                DisclosureGroup("文件差异") {
                    Text(delivery.status.isEmpty ? "无未提交修改；完整提交差异见下方。" : delivery.status)
                        .font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                    Text(delivery.diff.isEmpty ? "没有捕获到文件差异；完整内容以工作目录为准。" : delivery.diff)
                        .font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                    if delivery.truncated { Text("差异较长，展示已截断；请在 worktree 检查完整内容。").font(.caption).foregroundStyle(.secondary) }
                }
            }
            if let path = d.task.worktree {
                Text(path).font(.system(.caption, design: .monospaced)).foregroundStyle(.secondary).textSelection(.enabled)
                Button("在 Finder 查看工作目录") { model.reveal(path) }
            }
            if !d.children.isEmpty {
                Text("成员任务").font(.headline)
                ForEach(d.children) { row($0) }
            }
            DisclosureGroup("执行事件（最近 1000 条）", isExpanded: $showEvents) {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(d.events) { event in
                        Text("\(event.kind)\n\(event.data.pretty)")
                            .font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                    }
                }
            }
            if d.task.active {
                Button(d.task.state == "cancelling" ? "取消待确认" : "取消任务", role: .destructive) {
                    Task { await model.perform("/v1/tasks/\(d.task.id)/cancel") }
                }.disabled(model.busy || model.connectionError != nil || d.task.state == "cancelling")
            } else if d.task.nativeSessionId != nil {
                TextField("追加要求", text: $continuation, axis: .vertical).lineLimit(2...6)
                Button("继续原生会话") {
                    let text = continuation
                    Task { await model.perform("/v1/tasks/\(d.task.id)/continue", body: ["instructions": text]); if model.operationError == nil { continuation = "" } }
                }.disabled(continuation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.busy || model.connectionError != nil)
            }
            if d.task.unread {
                Button("标记结果已读") { Task { await model.perform("/v1/tasks/\(d.task.id)/ack") } }
                    .disabled(model.busy || model.connectionError != nil)
            }
        }
    }
    private func decisionButtons(_ approval: BridgeApproval) -> some View {
        ForEach(approval.options) { option in
            Button(option.label) {
                Task { await model.perform("/v1/approvals/\(approval.id)", body: ["optionId": option.id]) }
            }.disabled(model.busy || model.connectionError != nil)
                .accessibilityLabel("\(option.label)，任务 \(model.detail?.task.title ?? approval.taskId)")
        }
    }
    private func symbol(_ t: BridgeTask) -> String {
        switch t.state {
        case "waiting_approval": "hand.raised"
        case "completed": "checkmark.circle"
        case "failed", "interrupted": "exclamationmark.circle"
        case "cancelled": "xmark.circle"
        default: "circle.dotted"
        }
    }
    private func color(_ t: BridgeTask) -> Color {
        switch t.state {
        case "waiting_approval", "interrupted": .orange
        case "failed": .red
        case "completed": .green
        default: .secondary
        }
    }
}
