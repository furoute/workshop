# 名单公布追踪工作流

## 每日推送时判断"今日新公布"的方法

没有单一数据源标注每队公布时间，需要交叉验证：

### 步骤
1. **ESPN Squad Tracker（基础）**
   - `web_extract https://www.espn.com/soccer/story/_/id/48757621/...`
   - 各队有 status 字段："Final squad"、"Preliminary"、"To be announced" 等
   - 各队有具体日期标注（如 "Final squad announced May 18"）

2. **BBC Sport Tracker（验证+补充）**
   - `web_extract https://www.bbc.com/sport/football/articles/cvgz43lgn15o`
   - 有个简洁的表格，每队一条 headline
   - 更新及时

3. **The Athletic Live Blog（最实时）**
   - `web_extract https://www.nytimes.com/athletic/live-blogs/...`
   - 有当天的新闻流，适合捕捉当天具体事件

4. **FIFA Official Page（官方确认）**
   - `web_extract https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/all-world-cup-squad-announcements`
   - 列出头条文章，含每队公布时间锚点

5. **Sky Sports 或 SI.com（核实细节）**
   - 确认名单日期、关键球员信息

### 判断"今天新公布"的技巧
- ESPN 文章有更新日期但无精确时间，需要结合 The Athletic/FIFA 的文章发布时间来判断
- 如果 ESPN 状态是"Final squad announced May XX"且 XX=今天，则今天新公布
- 对于提及当天公布但无具体日期标注的队，搜 `"squad" + "May 23" + "2026"` 确认
- 注意区分 "preliminary squad"（初选名单，不展开汇报）和 "final squad"（最终26人，作为名单公布报道）

## 先查 ESPN → BBC/TA 验证 → 搜 `web_search` 确认日期 → 输出
