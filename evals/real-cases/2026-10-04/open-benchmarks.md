# 可借鉴的开放评测：专家判断、技能增益与新人执行

核验日期：2026-10-04。以下为源码、官方数据卡和论文的只读核查，未实际运行这些工具或基准。

## 结论

有相似的评测组件，但本次检索没有找到一套已经同时覆盖「原始真实咨询项目—区域公共品牌专业判断—新人独立迁移」的现成体系。最有用的组合是：技能对照测试、专家判断标注、真实新人任务测试。三者的分数不能相互替代。

## 1. 技能对照与自动评测工具

- [Anthropic skill-creator 的评测结构](https://github.com/anthropics/skills/blob/main/skills/skill-creator/references/schemas.md)：支持有/无技能、逐项预期、重复运行、通过率、时间和 token 对比。[工作流](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)可作为迭代骨架。[run_eval.py](https://github.com/anthropics/skills/blob/main/skills/skill-creator/scripts/run_eval.py)专门测触发，不能把它误当专业效果测试。skill-creator 本身为 Apache-2.0
- [OpenAI Evals](https://github.com/openai/evals/blob/main/docs/build-eval.md)：用 JSONL 案例、YAML 配置和[评分模板](https://github.com/openai/evals/blob/main/docs/eval-templates.md)搭建定制测试；运行入口为 oaieval。它是通用框架，需要自己准备可信案例和专家评分标准
- [OpenAI plugin-eval](https://github.com/openai/plugins/blob/main/plugins/plugin-eval/README.md)：当前 README 提供结构分析、基准初始化、隔离的 Codex 执行和前后比较。适合检查技能工程质量和运行成本；其结构得分不能代表咨询判断能力
- [SkillsBench](https://github.com/benchflow-ai/skillsbench)：可借鉴任务包、参考解与确定性验证。例如[人口收入数据分析任务](https://github.com/benchflow-ai/skillsbench/blob/main/tasks/sales-pivot-analysis/task.md)及[验证器](https://github.com/benchflow-ai/skillsbench/blob/main/tasks/sales-pivot-analysis/verifier/test_outputs.py)检查工作簿和透视表。当前主分支使用 BenchFlow；仓库 Apache-2.0。它验证 agent 完成任务，不验证人是否学会

## 2. 专业工作数据与构造案例

- [GDPval 官方数据集](https://huggingface.co/datasets/openai/gdpval)：220 项职业任务、原始支持材料，当前还公开交付物和 rubrics。可借鉴「同一资料包与专家产物比较」。不能称为 PwC 原始客户档案；官方卡说明私人身份为虚构，并涉及第三方商标。核查页面未见明确数据许可标签，公开可读不等于可以随意再分发
- [APEX-Agents 1.1](https://huggingface.co/datasets/mercor/apex-agents-v1.1)：240 项任务，其中 80 项管理咨询任务；专家构造的仿真项目环境、金标准和二元评分。[参考 agent](https://github.com/Mercor-Intelligence/apex_loop_truncated_tools_agent)为 Apache-2.0，使用 Harbor 0.20.0 与 Docker。数据卡标 CC-BY-4.0，同时附评估专用、禁止训练/拟合和抓取等限制，下载需接受条件。不能当成无限制的技能训练库，也不能称为真实新人实验
- [DRA 数据卡](https://huggingface.co/datasets/deccan-ai/dra-bench)：当前卡列 42 个提示，含专家检查点、解题逻辑和验证条件；明确由公开信息及合成构造组成。论文版本的 70 题不能与这个发布包混称。同样有访问门槛及禁止训练/再分发等附加限制。适合借评分思想，不宜直接搬运内容

## 3. 两个相关仓库实际测了什么

- pm-skills 的 [test_consistency.py](https://github.com/phuryn/pm-skills/blob/main/tests/test_consistency.py) 和 [test_validator.py](https://github.com/phuryn/pm-skills/blob/main/tests/test_validator.py)确实存在，主要检查版本、目录、说明数量、引用和 frontmatter。它们不能证明咨询或产品判断优于无技能基线
- brand-strategy-analysis 的 [cases.md](https://github.com/qingmingyiyang/brand-strategy-analysis/blob/main/evals/cases.md)明确将场景标为合成、待运行；[manual-case.md](https://github.com/qingmingyiyang/brand-strategy-analysis/blob/main/evals/manual-case.md)区分真实新人执行与模型模拟。已有测试设计不等于已经通过效果验证

## 4. 更接近「把专家判断教给新人」的研究

- [Bridge](https://github.com/rosewang2008/bridge)：MIT 仓库，公开 700 段真实教学对话及专家标注，拆解错误识别、策略选择和行动目的；有[测试集](https://github.com/rosewang2008/bridge/blob/main/dataset/test.json)及[决策路径分析](https://github.com/rosewang2008/bridge/blob/main/scripts/generate_decision_paths.py)。可以借鉴专家判断的显式标注方法。领域是数学辅导，模型回答偏好也不是新人学习证据
- [Tutor CoPilot](https://github.com/rosewang2008/tutor-copilot)：Apache-2.0 演示代码及[论文](https://arxiv.org/abs/2410.03017)。研究使用真实教师/辅导者随机对照，观察教学行为与学生掌握情况；比纯 agent 打分更接近人类效果。公开仓库是 demo，不是完整实验复现包；有辅助时表现提高，也不自动证明撤掉辅助后保留了判断能力

## 对本次三轮的使用建议

1. 采用固定资料、独立上下文、明确失败条件与版本记录；有余力再增加无技能基线和重复运行
2. 将「专业判断是否可靠」「新人能否依说明做完」「撤掉辅助后能否迁移」分开记录
3. 每轮用新证据检查修改是否传播到结论、测算和执行安排；最终另留未参与改写的案例
4. 本次每条件一次的三轮顺序测试应称探索性案例迭代，不估计因果增益。未有真实新人参与，就不宣称完成新人学习验证

所有链接均为核验时公开页面，主分支可能继续变化。数据许可应逐项确认，不能将代码许可证套用到第三方案例材料上。
