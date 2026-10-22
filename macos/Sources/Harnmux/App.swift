import SwiftUI
import AppKit

@main
struct HarnmuxApp: App {
    @StateObject private var model = HarnmuxModel()
    var body: some Scene {
        MenuBarExtra {
            StatusPanel(model: model)
        } label: {
            Label {
                if !model.statusText.isEmpty { Text(model.statusText) }
            } icon: {
                Image(systemName: model.connectionError != nil ? "wifi.slash" : model.pending > 0 ? "hand.raised" : "point.3.connected.trianglepath.dotted")
            }
            .accessibilityLabel("Harnmux，\(model.statusText.isEmpty ? "无活动任务" : model.statusText)")
        }
        .menuBarExtraStyle(.window)
    }
}

struct StatusPanel: View {
    @ObservedObject var model: HarnmuxModel
    @State private var continuation = ""
    @State private var showEvents = false
    @State private var reviewNote = ""
    @State private var composing = false

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
            if composing {
                HarnmuxComposer(model: model) { composing = false }
            } else if let id = model.selected {
                HStack {
                    Button { model.selected = nil; model.detail = nil } label: { Label("任务列表", systemImage: "chevron.left") }
                    Spacer()
                    if model.busy { ProgressView().controlSize(.small) }
                }
                if let detail = model.detail, detail.task.id == id {
                    ScrollView { detailView(detail).frame(maxWidth: .infinity, alignment: .leading) }
                } else { ProgressView("读取任务…").frame(maxWidth: .infinity, minHeight: 100) }
            } else {
                Button { composing = true } label: { Label(model.pendingSubmission == nil ? "发起协作" : "确认待定提交", systemImage: model.pendingSubmission == nil ? "plus" : "arrow.clockwise") }
                    .buttonStyle(.borderedProminent).disabled(model.connectionError != nil || model.busy)
                taskList
            }
            Divider()
            HStack {
                Text(model.connectionError == nil ? "关闭面板不停止任务" : "上次数据，尚未实时更新")
                    .font(.caption).foregroundStyle(.secondary)
                Spacer()
                Menu {
                    Button("打开 Harnmux 配置目录") { model.reveal(model.home.path) }
                    Button("退出界面（任务继续）") { NSApplication.shared.terminate(nil) }
                } label: { Image(systemName: "gearshape") }
                .menuStyle(.borderlessButton).fixedSize()
                .accessibilityLabel("设置与退出")
            }
        }
        .padding(16)
        .frame(width: 420)
        .frame(maxHeight: 620)
        .onChange(of: model.selected) { _, value in if value != nil { composing = false }; continuation = ""; showEvents = false; reviewNote = "" }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Harnmux", systemImage: "point.3.connected.trianglepath.dotted").font(.headline)
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
                    Text("在当前 harness 使用 Skill，或在这里开始聊天、研究与代码任务。")
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
    private func row(_ task: HarnmuxTask) -> some View {
        Button { Task { await model.select(task.id) } } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: symbol(task)).foregroundStyle(color(task)).frame(width: 20)
                VStack(alignment: .leading, spacing: 5) {
                    Text(task.title).font(.body.weight(.medium)).lineLimit(2).multilineTextAlignment(.leading)
                    Text("\(task.role == "leader" ? "负责人" : "成员") · \(task.harness) · \(task.actualModel ?? task.requestedModel ?? "原生默认模型")")
                        .font(.caption).foregroundStyle(.secondary).lineLimit(2)
                    Text(task.stateLabel).font(.caption).foregroundStyle(color(task))
                    if let next = task.nextAction { Text(next).font(.caption).foregroundStyle(.secondary).lineLimit(2) }
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
            Text("入口 \(d.task.entry) · \(d.task.role == "leader" ? "负责人" : "成员") \(d.task.harness)")
                .font(.subheadline).foregroundStyle(.secondary)
            Text(d.task.stateLabel).foregroundStyle(color(d.task))
            Label(d.task.isConversation ? "聊天与研究" : "代码任务", systemImage: d.task.isConversation ? "bubble.left.and.bubble.right" : "chevron.left.forwardslash.chevron.right")
                .font(.caption).foregroundStyle(.secondary)
            if let next = d.task.nextAction { Text(next).font(.subheadline.weight(.medium)) }
            if let duty = d.task.duty { Text("职责：\(duty)").font(.caption).foregroundStyle(.secondary) }
            if let context = d.task.context, !context.isEmpty {
                DisclosureGroup("共享背景") { Text(context).font(.caption).textSelection(.enabled) }
            }
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
                    Text(d.task.isConversation ? "回答与协作结果" : "模型执行报告").font(.headline)
                    Text("由原生 harness 返回；内容与结论供你审阅。").font(.caption).foregroundStyle(.secondary)
                    Text(result).textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
                    if d.task.resultTruncated == true { Label("回答已截断，请检查原生会话", systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.orange) }
                    Button("复制报告") { model.copy(result) }
                }
            }
            if let criteria = d.task.acceptanceCriteria, !criteria.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("验收标准").font(.headline)
                    ForEach(Array(criteria.enumerated()), id: \.offset) { item in
                        Text("\(item.offset + 1). \(item.element)").textSelection(.enabled)
                    }
                }
            }
            if let digest = d.task.deliveryDigest {
                VStack(alignment: .leading, spacing: 8) {
                    Label("第 \(d.task.turn) 回合 · 固定交付快照", systemImage: "doc.text.magnifyingglass").font(.headline)
                    Text(digest).font(.system(.caption, design: .monospaced)).foregroundStyle(.secondary).textSelection(.enabled)
                    Text(d.task.isConversation ? "确认针对此版本回答；继续会话会生成新版本。" : "验收仅针对此快照；后续工作区修改需重新交付。不会自动合入。").font(.caption).foregroundStyle(.secondary)
                    if let review = d.task.leaderReview { receipt("Leader 意见", review) }
                    if let review = d.task.acceptance { receipt("你的决定", review) }
                    Button("复制完整交付与审查记录") { Task { await model.copyPacket(d.task) } }
                        .disabled(model.busy || model.connectionError != nil)
                    TextField("填写验收或修改意见", text: $reviewNote, axis: .vertical).lineLimit(2...5)
                    ViewThatFits(in: .horizontal) {
                        HStack { reviewButtons(d, digest) }
                        VStack(alignment: .leading) { reviewButtons(d, digest) }
                    }
                }.padding(12).background(.quaternary.opacity(0.4), in: RoundedRectangle(cornerRadius: 9))
            } else if !d.task.active {
                Text(d.finalizing == true ? "正在整理交付快照…" : "此回合尚无交付快照，无法验收。请查看执行事件。")
                    .font(.caption).foregroundStyle(.secondary)
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
            if let path = d.task.worktree ?? d.task.directory {
                Text(path).font(.system(.caption, design: .monospaced)).foregroundStyle(.secondary).textSelection(.enabled)
                Button("在 Finder 查看工作目录") { model.reveal(path) }
            }
            if let reports = d.reports, !reports.isEmpty {
                DisclosureGroup("成员回报 · \(reports.count)") {
                    ForEach(reports) { report in
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(report.label) · 成员第 \(report.childTurn) 回合").font(.caption)
                            if let reason = report.reason { Text(reason).font(.caption).foregroundStyle(.secondary).textSelection(.enabled) }
                        }.padding(.vertical, 4)
                    }
                }
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
            if d.task.active || d.children.contains(where: \.active) {
                Button(d.task.state == "cancelling" ? "取消待确认" : "取消任务", role: .destructive) {
                    Task { await model.perform("/v1/tasks/\(d.task.id)/cancel") }
                }.disabled(model.busy || model.connectionError != nil || d.task.state == "cancelling")
            } else if d.task.nativeSessionId != nil {
                TextField("追加要求", text: $continuation, axis: .vertical).lineLimit(2...6)
                Button("继续原生会话") {
                    let text = continuation
                    Task { await model.perform("/v1/tasks/\(d.task.id)/continue", body: ["instructions": .string(text)]); if model.operationError == nil { continuation = "" } }
                }.disabled(continuation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.busy || model.connectionError != nil || d.finalizing == true)
            }
            if d.task.unread {
                Button("标记结果已读") { Task { await model.perform("/v1/tasks/\(d.task.id)/ack") } }
                    .disabled(model.busy || model.connectionError != nil)
            }
        }
    }
    private func receipt(_ title: String, _ review: ReviewReceipt) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(title)：\(review.label)").font(.subheadline.weight(.medium))
            Text(review.note).font(.caption).textSelection(.enabled)
        }
    }
    private func reviewButtons(_ d: TaskDetail, _ digest: String) -> some View {
        ForEach(["accept", "request_changes"], id: \.self) { decision in
            Button(decision == "accept" ? "验收此快照" : "要求修改") {
                let note = reviewNote
                Task {
                    await model.perform("/v1/tasks/\(d.task.id)/review", body: [
                        "turn": .number(Double(d.task.turn)), "digest": .string(digest),
                        "decision": .string(decision), "note": .string(note)
                    ])
                    if model.operationError == nil { reviewNote = "" }
                }
            }.disabled(model.busy || model.connectionError != nil || d.task.active || d.finalizing == true ||
                       reviewNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                       (decision == "accept" && (!d.task.canAccept || d.children.contains { $0.state != "completed" || $0.deliveryDigest == nil })))
        }
    }
    private func decisionButtons(_ approval: HarnmuxApproval) -> some View {
        ForEach(approval.options) { option in
            Button(option.label) {
                Task { await model.perform("/v1/approvals/\(approval.id)", body: ["optionId": .string(option.id)]) }
            }.disabled(model.busy || model.connectionError != nil)
                .accessibilityLabel("\(option.label)，任务 \(model.detail?.task.title ?? approval.taskId)")
        }
    }
    private func symbol(_ t: HarnmuxTask) -> String {
        switch t.state {
        case "waiting_approval": "hand.raised"
        case "completed": "checkmark.circle"
        case "failed", "interrupted": "exclamationmark.circle"
        case "cancelled": "xmark.circle"
        default: "circle.dotted"
        }
    }
    private func color(_ t: HarnmuxTask) -> Color {
        switch t.state {
        case "waiting_approval", "interrupted": .orange
        case "failed": .red
        case "completed": .green
        default: .secondary
        }
    }
}
