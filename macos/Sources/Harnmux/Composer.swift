import SwiftUI

struct HarnmuxComposer: View {
    @ObservedObject var model: HarnmuxModel
    let close: () -> Void
    @State private var mode = "conversation"
    @State private var profile = ""
    @State private var workers: Set<String> = []
    @State private var instructions = ""
    @State private var context = ""
    @State private var repo = ""
    @FocusState private var taskFocused: Bool
    private var retrying: Bool { model.pendingSubmission != nil }
    private var valid: Bool {
        !profile.isEmpty && !instructions.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        instructions.count <= 64000 && context.count <= 32000 && (mode != "code" || repo.hasPrefix("/"))
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(retrying ? "确认上一次提交" : "发起协作").font(.headline)
                Spacer()
                Button("返回") { close() }.disabled(model.busy)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if retrying {
                        Label("已保留提交内容。刷新或重试会查询同一任务。", systemImage: "arrow.clockwise")
                            .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                        if case .string(let saved) = model.pendingSubmission?["instructions"] {
                            Text(saved).lineLimit(6).textSelection(.enabled)
                        }
                    } else {
                        Picker("任务类型", selection: $mode) {
                            Text("聊天与研究").tag("conversation")
                            Text("代码任务").tag("code")
                        }.pickerStyle(.segmented)
                        VStack(alignment: .leading, spacing: 6) {
                            Text("希望完成什么").font(.subheadline.weight(.medium))
                            TextField("例如：请 Codex 与 DSH 比较两个方案，再给出建议", text: $instructions, axis: .vertical)
                                .lineLimit(3...7).textFieldStyle(.roundedBorder).focused($taskFocused)
                                .accessibilityLabel("任务目标")
                        }
                        Picker("负责人", selection: $profile) {
                            if profile.isEmpty { Text("选择 harness").tag("") }
                            ForEach(model.profiles.keys.sorted(), id: \.self) { name in
                                Text("\(name) · \(model.profiles[name]?.label ?? "")").tag(name)
                            }
                        }
                        if model.profiles.isEmpty { Text("服务尚未提供可用配置，请刷新。").font(.caption).foregroundStyle(.secondary) }
                        DisclosureGroup("可协作成员 · \(workers.count)") {
                            VStack(alignment: .leading, spacing: 8) {
                                ForEach(model.profiles.keys.sorted(), id: \.self) { name in
                                    Toggle(isOn: Binding(get: { workers.contains(name) }, set: { included in
                                        if included { workers.insert(name) } else { workers.remove(name) }
                                    })) { Text("\(name) · \(model.profiles[name]?.harness ?? "")") }
                                }
                                Text("负责人按需要委派；无需每次都组建团队。").font(.caption).foregroundStyle(.secondary)
                            }.padding(.top, 6)
                        }
                        DisclosureGroup("补充共享背景") {
                            TextField("提供希望成员共同了解的信息", text: $context, axis: .vertical)
                                .lineLimit(3...6).textFieldStyle(.roundedBorder).accessibilityLabel("共享背景")
                        }
                        if mode == "code" {
                            TextField("Git 仓库绝对路径", text: $repo).textFieldStyle(.roundedBorder)
                                .accessibilityLabel("Git 仓库路径")
                            Text("从 HEAD 创建独立 worktree。入口脏文件不会自动传入。").font(.caption).foregroundStyle(.secondary)
                        } else {
                            Text("无需仓库。成员各自保留工作目录，回答回到负责人汇总。").font(.caption).foregroundStyle(.secondary)
                        }
                        if instructions.count > 64000 || context.count > 32000 {
                            Text("任务上限 64,000 字符，共享背景上限 32,000 字符。").font(.caption).foregroundStyle(.red)
                        }
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }.frame(maxHeight: 370)
            HStack {
                Text("原生权限仍由你决定").font(.caption).foregroundStyle(.secondary)
                Spacer()
                if model.busy { ProgressView().controlSize(.small) }
                Button(retrying ? "重试同一次提交" : "开始协作") {
                    Task {
                        await model.submit(mode: mode, profile: profile, workers: workers, instructions: instructions, context: context, repo: repo)
                        if model.pendingSubmission == nil && model.operationError == nil { close() }
                    }
                }.buttonStyle(.borderedProminent)
                    .disabled(model.busy || model.connectionError != nil || (!retrying && !valid))
            }
        }
        .onAppear {
            if profile.isEmpty { profile = model.profiles.keys.sorted().first ?? "" }
            taskFocused = !retrying
        }
    }
}
