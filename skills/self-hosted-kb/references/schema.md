# 表结构说明（Schema）

**说明**：库是脚本建的，结构落在代码里。本文是从实库 `sqlite_master` 直接导出的权威版本，
与代码一致。改代码时请同步改本文件。

---

## 一、两个库，各管一件事

| 库 | 作用 | 典型大小 | 规模 |
|---|---|---:|---|
| `kb.sqlite3` | 内容检索库：正文块 + FTS5 倒排 | 950 MB | 40 万块 / 7,903 文档 |
| `catalog.sqlite3` | 文件目录库：只存路径和元数据，不存正文 | 5-100 MB | 5 万条 |

**⇒ 分开的理由：**

```
内容检索要的是「块」
文件定位要的是「路径」
两类查询的粒度不同，混在一起会互相拖慢
```

---

## 二、kb.sqlite3（内容检索库）

### 2.1 表一览

| 表 | 行数 | 作用 |
|---|---:|---|
| `documents` | 7,903 | 一份文档一行 |
| `chunks` | 402,638 | 一个块一行（正文分块） |
| `chunks_fts` | 402,638 | FTS5 倒排索引（虚拟表） |
| `files_ruled` | 9,829 | 逐文件裁决记录 |
| `metadata` | — | 键值元数据 |

### 2.2 documents

```sql
CREATE TABLE documents (
    doc_id            TEXT PRIMARY KEY,
    source_relpath    TEXT NOT NULL,
    source_sha256     TEXT NOT NULL,
    parser            TEXT NOT NULL,
    text_chars        INTEGER NOT NULL,
    text_sha256       TEXT NOT NULL,
    status            TEXT NOT NULL,
    error             TEXT NOT NULL,
    text_path         TEXT NOT NULL
) WITHOUT ROWID
```

| 字段 | 说明 |
|---|---|
| `doc_id` | 文档唯一 ID（通常是路径的哈希） |
| `source_relpath` | 相对语料根的路径 |
| `source_sha256` | 原文件哈希，用于去重和变更检测 |
| `parser` | 用了哪个解析器（pdf/docx/pptx/xlsx/ocr） |
| `text_chars` | 抽出文本字符数 |
| `text_sha256` | 抽出文本的哈希，用于判断抽取结果是否变化 |
| `status` | 终态：`ok` / `ocr` / `error` / `unsupported` / `sensitive_skipped` |
| `error` | 出错原因（status=error 时有值） |
| `text_path` | 抽出文本落盘位置（相对路径） |

**⇒ status 是终态字段，每个文件必须有值，不许为空。**

```
这个设计是为了保证「覆盖率可核算」：
  总数 = ok + ocr + error + unsupported + sensitive_skipped
```

### 2.3 chunks

```sql
CREATE TABLE chunks (
    row_idx           INTEGER PRIMARY KEY,
    chunk_id          TEXT UNIQUE NOT NULL,
    doc_id            TEXT NOT NULL REFERENCES documents(doc_id),
    source_relpath    TEXT NOT NULL,
    chunk_index       INTEGER NOT NULL,
    char_start        INTEGER NOT NULL,
    char_end          INTEGER NOT NULL,
    char_count        INTEGER NOT NULL,
    text              TEXT NOT NULL,
    chunk_version     TEXT NOT NULL
)
```

| 字段 | 说明 |
|---|---|
| `row_idx` | 物理行号，**向量行序就是按这个对齐的** |
| `chunk_id` | 块唯一 ID（`doc_id` + 块序号派生） |
| `doc_id` | 外键指向 documents |
| `source_relpath` | 冗余存一份路径，省一次 JOIN |
| `chunk_index` | 该块在文档内的序号（从 0 开始） |
| `char_start` / `char_end` | 在原文中的字符区间，用于溯源高亮 |
| `char_count` | 块字符数（切块上限 400） |
| `text` | 块正文 |
| `chunk_version` | 切块策略版本，如 `chunk-400_50-v1` |

**⚠️ 最关键的一条：**

```
row_idx 必须与 vectors.f16.npy 的行序严格 1:1
⇒ 任何重排、重新插入都会让向量对错位
⇒ 所以 chunks 表只整体重建，不做逐行更新
```

### 2.4 chunks_fts（FTS5 虚拟表）

```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(
    text,
    source_relpath UNINDEXED,
    content='chunks',
    content_rowid='row_idx',
    tokenize='trigram'
)
```

**⇒ 三个要点：**

| 配置 | 含义 | 为什么这么选 |
|---|---|---|
| `content='chunks'` | 外部内容表模式 | 不重复存一份正文，省空间 |
| `content_rowid='row_idx'` | 关联到 chunks 主键 | 检索结果直接 JOIN 回 blocks |
| `tokenize='trigram'` | 三元组分词 | 中文不用分词器也能查，且能模糊匹配 |

**⇒ trigram 的代价与收益：**

```
好处：中文、英文、型号、编号一视同仁，
      不需要额外装分词器（如 jieba）
坏处：索引比按词分词大一些，短词（1-2 字）查不到
⇒ 所以查询词长度 < 3 时，要退回到 LIKE 或走文件通道
```

### 2.5 files_ruled

```sql
CREATE TABLE files_ruled (
    source_relpath    TEXT PRIMARY KEY,
    size_bytes        INTEGER NOT NULL,
    sha256            TEXT NOT NULL,
    extension         TEXT NOT NULL,
    decision          TEXT NOT NULL,
    reason             TEXT NOT NULL
) WITHOUT ROWID
```

**⇒ 这是「裁决台账」：每个文件为什么进、为什么不进，都有据可查。**

| decision | 含义 |
|---|---|
| `ok` | 解析成功，已切块 |
| `ocr` | 走 OCR 后成功 |
| `error` | 解析失败 |
| `unsupported` | 格式不支持（如 ISO、exe） |
| `sensitive_skipped` | 命中敏感规则，跳过 |

### 2.6 metadata

```sql
CREATE TABLE metadata (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL
)
```

**⇒ 存建库时的全局参数，用于复现：**

```
chunk_version    切块策略版本
model_name       向量模型名
model_revision   模型 revision
dimension        向量维度
built_at         建库时间
source_root      语料根（相对描述，不写真路径）
```

---

## 三、catalog.sqlite3（文件目录库）

### 3.1 表一览

| 表 | 行数 | 作用 |
|---|---:|---|
| `files` | 49,254 | 一个文件一行 |
| `files_fts` | 49,254 | FTS5 倒排（虚拟表） |
| `metadata` | — | 键值元数据 |

### 3.2 files

```sql
CREATE TABLE files (
    id                INTEGER PRIMARY KEY,
    source_root       TEXT NOT NULL,
    relpath           TEXT NOT NULL,
    filename          TEXT NOT NULL,
    filename_key      TEXT NOT NULL,
    relpath_key       TEXT NOT NULL,
    size_bytes        INTEGER NOT NULL,
    extension         TEXT NOT NULL,
    mtime_ns          INTEGER NOT NULL,
    mtime_utc         TEXT NOT NULL,
    absolute_path     TEXT NOT NULL,
    absolute_path_key TEXT NOT NULL UNIQUE,
    sha256            TEXT,
    tags              TEXT NOT NULL,
    UNIQUE (source_root, relpath)
)
```

| 字段 | 说明 |
|---|---|
| `source_root` | 扫描根（多个根可共存） |
| `relpath` | 相对路径 |
| `filename` | 文件名 |
| `filename_key` | **归一化文件名**：小写 + 去分隔符，用于模糊匹配 |
| `relpath_key` | 归一化路径 |
| `absolute_path` | 绝对路径（点开原件用） |
| `absolute_path_key` | 归一化绝对路径，**UNIQUE**，防重复登记 |
| `sha256` | 可为空（大文件或未计算时） |
| `tags` | 分类标签，如 `work` / `vendor` / `personal` |

**⇒ 为什么要有 `*_key` 归一化字段：**

```
原始写法千奇百怪：
  "VNX 5400 Procedures.docx"
  "VNX_5400_procedures.docx"
  "vnx5400-procedures.docx"

归一化后都是 vnx5400proceduresdocx
⇒ 一次 LIKE 就能全命中
⇒ 这是「型号查不到」问题的根本解法
```

**⚠️ 隐私目录的落地方式：**

```
build_catalog.py --privacy-dir-name <名称>
⇒ 命中的目录整棵子树不入库
⇒ 参数可重复传多個
```

### 3.3 files_fts

```sql
CREATE VIRTUAL TABLE files_fts USING fts5(
    filename,
    relpath,
    source_root,
    absolute_path,
    content='files',
    content_rowid='id',
    tokenize='trigram'
)
```

**⇒ 四列全进索引：文件名的权重最高，路径次之。**

### 3.4 索引

```sql
CREATE INDEX files_extension_idx   ON files(extension);
CREATE INDEX files_filename_key_idx ON files(filename_key);
CREATE INDEX files_relpath_key_idx ON files(relpath_key);
CREATE INDEX files_source_root_idx ON files(source_root);
CREATE INDEX files_tags_idx        ON files(tags);
```

**⇒ 这五个索引对应五类查询：按扩展名、按文件名、按路径、按根、按标签。**

---

## 四、向量文件（不在 SQLite 里）

```
vectors.f16.npy      N × 512，float16
vector_meta.json     指纹

⇒ 不放进 SQLite 的原因：
   SQLite 存 BLOB 会让查询变慢
   NumPy 一次性读进内存做矩阵乘法才快
   55 万 × 512 float16 ≈ 561 MB，32 GB 内存装得下
```

**⇒ 对齐规则：**

```
vectors.f16.npy 第 i 行  ←→  chunks.row_idx = i
⇒ 任何重排都必须同时重写两边
⇒ 验收脚本 verify.py 就是检查这个
```

---

## 五、和脚本的对应关系

| 脚本 | 建什么 |
|---|---|
| `build_full.py` | `documents` + `chunks` + `files_ruled` |
| `build_index.py` | `chunks_fts` + `metadata` + `vectors.f16.npy` |
| `build_others.py` | 同上（第二套库，结构一致） |
| `build_catalog.py` | `files` + `files_fts` + 五个索引 |
| `query.py` | 只读：查 `chunks_fts` / `files_fts` / 向量 |
| `verify.py` | 只读：校验行序、对齐、覆盖率 |

**⇒ 建库脚本负责写入，查询脚本永远只读。**

---

## 六、改结构时的纪律

```
① 加字段：可以，但必须给默认值，且老库要能自动补
② 改字段名：不行，直接破坏兼容；要么迁移要么重建
③ 加 FTS5 列：必须重建虚拟表
④ 改 tokenize：必须重建虚拟表（无法原地改）
⑤ 改切块策略：chunk_version 必须变，且向量全量重建
⑥ 改模型：向量全量重建，没有捷径
```

**⇒ 一句话：能重建的就不迁移，能不动结构就不动。**

---

*本文由 `sqlite_master` 实库导出，与代码一致。改代码请同步改本文件。*
