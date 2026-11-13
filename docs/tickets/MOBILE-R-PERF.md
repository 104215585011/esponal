# MOBILE-R-PERF — watch 视频界面卡顿排查与优化【工程票·Codex1】

**优先级**:P1(用户真机反馈"视频界面会有所卡顿")
**实现**:Codex1 · **验证**:真机前后对比 · 可与 MOBILE-R-000 设计并行(不动导航/壳)

## 任务
1. **先量化,后优化**:用 React Profiler / Performance 面板在 watch 页录制,找出真实热点,贴数据进 ticket 再动手。重点怀疑(逐一验证,不要凭感觉全改):
   - 字幕跟随:timeupdate/轮询导致 SubtitlePanel/TranscriptPanel **每 tick 全量重渲染**(高亮当前句不该重排整列表);
   - 长字幕列表无虚拟化,滚动掉帧;
   - `backdrop-blur` 等高成本样式在低端机的代价;
   - LookupCard/查词层挂载导致的级联渲染;
   - 字体(Noto Sans SC)加载抖动。
2. **优化**(按量化结果取舍):当前句高亮用局部状态/memo 隔离;列表虚拟化或窗口渲染;降档 blur;React.memo/useMemo 切断级联。
3. **验收**:优化前后 Profiler 数据对比写进 evidence;真机(中低端安卓优先)滚动/播放跟随不掉帧;`npm test` 全绿;不改变任何交互与视觉。

> 戒:别顺手重构无关代码;单 player 约束不动;桌面端不回退。
