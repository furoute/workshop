# Everything 搜索语法（完整表）

> 官方搜索语法文档的 Markdown 版。共 11 个分类、148 条定义。
> 日常高频项在 `SKILL.md` 的「语法速查」里；这里是可以全文检索的完整字典。

## 目录

- [操作符](#操作符)（5 条）
- [通配符](#通配符)（2 条）
- [宏](#宏)（13 条）
- [修饰符](#修饰符)（25 条）
- [函数](#函数)（57 条）
- [函数语法](#函数语法)（8 条）
- [大小语法](#大小语法)（1 条）
- [大小常数](#大小常数)（8 条）
- [日期语法](#日期语法)（5 条）
- [日期常数](#日期常数)（10 条）
- [属性常数](#属性常数)（14 条）

---

## 快速上手

```text
报告 2026                 空格 = AND
报告|方案                 | = OR
报告 !草稿                ! = NOT
<中标|成交> ext:pdf       < > = 分组
"最终版 报告"             引号 = 词组
报告*.docx                * = 0+ 字符
报告?.docx                ? = 1 个字符
ext:pdf;docx              按扩展名（分号分隔）
path:项目                 匹配路径+文件名
dm:2026-10  dm:>2024      按修改日期
size:>20mb  size:large    按大小
regex:.*报告\.pdf$       启用正则
```

---

## 操作符

| 写法 | 说明 |
|---|---|
| `space` | 与 (AND) |
| `\|` | 或 (OR) |
| `!` | 非 (NOT) |
| `< >` | 分组 |
| `" "` | 搜索引号内的词组. |

## 通配符

| 写法 | 说明 |
|---|---|
| `*` | 匹配 0 个或多个字符. |
| `?` | 匹配 1 个字符. |

## 宏

| 写法 | 说明 |
|---|---|
| `quot:` | 双引号 (") |
| `apos:` | 单引号 (') |
| `amp:` | 与号 (&) |
| `lt:` | 小于 (<) |
| `gt:` | 大于 (>) |
| `#<n>:` | 十进制 Unicode 字符 <n>. |
| `#x<n>:` | 十六进制 Unicode 字符 <n>. |
| `audio:` | 搜索音频文件. |
| `zip:` | 搜索压缩文件. |
| `doc:` | 搜索文档文件. |
| `exe:` | 搜索可执行文件. |
| `pic:` | 搜索图片文件. |
| `video:` | 搜索视频文件. |

## 修饰符

| 写法 | 说明 |
|---|---|
| `ascii:` | 启用快速 ASCII 大小写对比. |
| `case:` | 区分大小写. |
| `diacritics:` | 匹配变音标记. |
| `file:` | 仅匹配文件. |
| `folder:` | 仅匹配文件夹. |
| `noascii:` | 禁用快速 ASCII 大小写对比. |
| `nocase:` | 不区分大小写. |
| `nodiacritics:` | 不匹配变音标记. |
| `nofileonly:` | 仅不允许文件. |
| `nofolderonly:` | 仅不允许文件夹. |
| `nopath:` | 不匹配路径. |
| `noregex:` | 禁用正则表达式. |
| `nowfn:` | 不匹配完整文件名. |
| `nowholefilename:` | 不匹配完整文件名. |
| `nowholeword:` | 仅禁用全字匹配. |
| `nowildcards:` | 禁用通配符. |
| `noww:` | 仅禁用全字匹配. |
| `path:` | 匹配路径和文件名. |
| `regex:` | 启用正则表达式. |
| `utf8:` | 禁用快速 ASCII 大小写对比. |
| `wfn:` | 匹配完整文件名. |
| `wholefilename:` | 匹配完整文件名. |
| `wholeword:` | 仅匹配全字符. |
| `wildcards:` | 启用通配符. |
| `ww:` | 仅全字匹配. |

## 函数

| 写法 | 说明 |
|---|---|
| `album:<text>` | 搜索媒体专辑元数据. |
| `ansicontent:<text>` | 搜索 ANSI 格式文本内容. |
| `artist:<text>` | 搜索媒体艺术家元数据. |
| `attrib:<attributes>` | 搜索指定的文件属性的文件和文件夹. |
| `attribdupe:` | 搜索含有相同属性的文件和文件夹. |
| `attributes:<attributes>` | 搜索指定的文件属性的文件和文件夹. |
| `bitdepth:<bitdepth>` | 搜索指定像素密度的图片. |
| `child:<filename>` | 搜索包含匹配文件名文件的文件夹. |
| `childcount:<count>` | 搜索包含有指定数目子文件夹或文件的文件夹. |
| `childfilecount:<count>` | 搜索包含有指定数目文件的文件夹. |
| `childfoldercount:<n>` | 搜索包含有指定数目子文件的文件夹. |
| `comment:<text>` | 搜索媒体注释元数据. |
| `content:<text>` | 搜索文本内容. |
| `count:<max>` | 指定搜索结果最大值. |
| `dateaccessed:<date>` | 搜索指定访问时间的文件和文件夹. |
| `datecreated:<date>` | 搜索指定创建日期的文件和文件夹. |
| `datemodified:<date>` | 搜索指定修改日期的文件和文件夹. |
| `daterun:<date>` | 搜索指定打开时间的文件和文件夹. |
| `da:<date>` | 搜索指定访问时间的文件和文件夹. |
| `dadupe:` | 搜索含有相同访问时间的文件和文件夹. |
| `dc:<date>` | 搜索指定创建日期的文件和文件夹. |
| `dcdupe:` | 搜索含有相同创建时间的文件和文件夹. |
| `dimensions:<w>X<h>` | 搜索指定长宽的图片. |
| `dm:<date>` | 搜索指定修改日期的文件和文件夹. |
| `dmdupe:` | 搜索含有相同修改时间的文件和文件夹. |
| `dr:<date>` | 搜索指定打开时间的文件和文件夹. |
| `dupe:` | 搜索重复的文件名. |
| `empty:` | 搜索空文件夹. |
| `endwith:<text>` | 搜索以指定文本结尾的文件 (包含扩展名). |
| `ext:<ext1;ext2;...>` | 搜索和列表中指定的扩展名匹配的文件 (扩展名以分号分隔). |
| `filelist:<fn1\|fn2\|...>` | 搜索文件名列表中的文件. |
| `filelistfilename:<name>` | 搜索文件名列表中的文件和文件夹. |
| `frn:<frn>` | 搜索指定文件索引号的文件和文件夹. |
| `fsi:<index>` | 搜索指定盘符索引中文件或文件夹 (索引 0 表示 C 盘, 以此类推). |
| `genre:<text>` | 搜索媒体流派元数据. |
| `height:<height>` | 搜索指定像素高度的图片. |
| `infolder:<path>` | 搜索指定路径下的文件和文件夹 (不包含子文件夹). |
| `len:<length>` | 搜索和指定的文件名长度相匹配的文件和文件夹. |
| `namepartdupe:` | 搜索含有相同名称部分的文件和文件夹. |
| `orientation:<type>` | 搜索指定方向的图片 (水平或竖直). |
| `parent:<path>` | 搜索指定路径下的文件和文件夹 (不包含子文件夹). |
| `parents:<count>` | 搜索有指定数目父文件夹的文件和文件夹. |
| `rc:<date>` | 搜索指定最近修改日期的文件和文件夹. |
| `recentchange:<date>` | 搜索指定最近修改日期的文件和文件夹. |
| `root:` | 搜索没有父文件夹的文件和文件夹. |
| `runcount:<count>` | 搜索指定打开次数的文件和文件夹. |
| `shell:<name>` | 搜索已知的 Shell 文件夹名称, 包括子目录和文件. |
| `size:<size>` | 搜索指定大小的文件 (以字节为单位). |
| `sizedupe:` | 搜索大小重复的文件. |
| `startwith:<text>` | 搜索指定文本开头的文件. |
| `title:<text>` | 搜索媒体标题元数据. |
| `track:<number>` | 搜索指定音轨号的媒体文件. |
| `type:<type>` | 搜索指定的文件类型的文件和文件夹. |
| `utf16content:<text>` | 搜索 UTF-16 格式文本内容. |
| `utf16becontent:<text>` | 搜索 UTF-16 BE 格式文本内容. |
| `utf8content:<text>` | 搜索 UTF-8 格式文本内容. |
| `width:<width>` | 搜索指定像素宽度的图片. |

## 函数语法

| 写法 | 说明 |
|---|---|
| `function:value` | 等于某设定值. |
| `function:<=value` | 小于等于某设定值. |
| `function:<value` | 小于某设定值. |
| `function:=value` | 等于某设定值. |
| `function:>value` | 大于某设定值. |
| `function:>=value` | 大于等于某设定值. |
| `function:start..end` | 在起始值和终止值的范围内. |
| `function:start-end` | 在起始值和终止值的范围内. |

## 大小语法

| 写法 | 说明 |
|---|---|
| `size[kb\|mb\|gb]` |  |

## 大小常数

| 写法 | 说明 |
|---|---|
| `empty` |  |
| `tiny` | 0 KB < 大小 <= 10 KB |
| `small` | 10 KB < 大小 <= 100 KB |
| `medium` | 100 KB < 大小 <= 1 MB |
| `large` | 1 MB < 大小 <= 16 MB |
| `huge` | 16 MB < 大小 <= 128 MB |
| `gigantic` | 大小 > 128 MB |
| `unknown` |  |

## 日期语法

| 写法 | 说明 |
|---|---|
| `year` |  |
| `month/year 或者 year/month 取决于本地设置` |  |
| `day/month/year, month/day/year 或者 year/month/day 取决于本地设置` |  |
| `YYYY[-MM[-DD[Thh[:mm[:ss[.sss]]]]]]` |  |
| `YYYYMM[DD[Thh[mm[ss[.sss]]]]]` |  |

## 日期常数

| 写法 | 说明 |
|---|---|
| `today` |  |
| `yesterday` |  |
| `tomorrow` |  |
| `<last\|past\|prev\|current\|this\|coming\|next><year\|month\|week>` |  |
| `<last\|past\|prev\|coming\|next><x><years\|months\|weeks\|days\|hours\|minutes\|mins\|seconds\|secs>` |  |
| `january\|february\|march\|april\|may\|june\|july\|august\|september\|october\|november\|december` |  |
| `jan\|feb\|mar\|apr\|may\|jun\|jul\|aug\|sep\|oct\|nov\|dec` |  |
| `sunday\|monday\|tuesday\|wednesday\|thursday\|friday\|saturday` |  |
| `sun\|mon\|tue\|wed\|thu\|fri\|sat` |  |
| `unknown` |  |

## 属性常数

| 写法 | 说明 |
|---|---|
| `A` | 存档 |
| `C` | 压缩 |
| `D` | 目录 |
| `E` | 加密 |
| `H` | 隐藏 |
| `I` | 未索引的内容 |
| `L` | 重解析点 |
| `N` | 一般 |
| `O` | 离线 |
| `P` | 稀疏文件 |
| `R` | 只读 |
| `S` | 系统 |
| `T` | 临时 |
| `V` | 设备 |

---

## 三条实战组合（实测通过）

```bash
# 2024 年后改过、大于 20MB 的 PDF 方案
"<目录>\" regex:.*方案.*\.pdf$ size:>20mb dm:>2024

# 所有中标/成交通知类文档
<中标|成交> ext:doc;docx;pdf;xlsx

# 某年区间 + 主题
dm:2025-01-01..2025-12-31 ext:docx regex:.*立项.*
```

## 常见坑

| 坑 | 现象 | 解法 |
|---|---|---|
| `regex:` 作用于完整路径 | 加路径限定后 0 命中 | 必须写 `regex:.*xxx` |
| 正则里写 `< >` | 查询报错 | `< >` 是分组符，正则内用 `( )` |
| 字符集写 `[.\-年]` | 0 命中 | 改用 `.?` 或显式列举 |
| `dm:thisweek` | 0 命中 | 用 `dm:7days` / `dm:today` |
| `.` 未转义 | 误命中 `2022年` | 写 `2022\.` |
