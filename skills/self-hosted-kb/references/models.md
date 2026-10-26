# Embedding 模型说明

## 默认模型

```text
模型：BAAI/bge-small-zh-v1.5
维度：512
存储：float16
用途：中文语义检索
```

这个小模型约 100 MB，CPU 可以运行。512 维向量在约 55 万块规模下做
NumPy 暴力余弦检索，实测约 45 ms。中文语义检索效果在同量级小模型中
够用，适合先跑通全流程，再按语料规模和准确率要求升级。

模型可从 Hugging Face 拉取。查询脚本默认要求模型已在 HF 缓存中；
也可以把完整模型目录通过 `--model-dir` 传给 `scripts/query.py`。

## 向量指纹

`scripts/build_index.py` 和 `scripts/build_others.py` 会在输出目录写入
`vector_meta.json`。查询前必须核对以下字段：

```json
{
  "model_name": "BAAI/bge-small-zh-v1.5",
  "model_revision": "<fixed-commit-or-tag>",
  "dimension": 512,
  "dtype": "float16",
  "normalize_embeddings": true,
  "query_prefix": "为这个句子生成表示以用于检索相关文章："
}
```

`model_name`、`model_revision`、`dimension`、`normalize_embeddings` 和
`query_prefix` 共同决定向量能否互用。`scripts/query.py` 默认从索引的
`vector_meta.json` 读取 revision 和 query prefix，并校验模型名与维度。

## 换模型的代价

换模型等于向量全量重建，没有增量捷径。旧向量与新模型不在同一个向量
空间，不能混用。重建后必须重新生成 `vector_meta.json`，并让所有联合
检索库使用相同模型指纹。

## 其他可选模型

| 模型 | 维度 | 典型取舍 |
|---|---:|---|
| `BAAI/bge-small-zh-v1.5` | 512 | 默认；体积小，CPU 可跑，适合中等规模 |
| `BAAI/bge-base-zh-v1.5` | 768 | 通常更准，但更慢、存储更大 |
| `BAAI/bge-m3` | 1024 | 多语言、长文本能力更强，建议 2 GB 显存起 |

切换模型时先在小样本上验证召回率、延迟和显存，再执行全量重建。

## 按算力调整

| 算力 | `--batch-size` | 预期 |
|---|---:|---|
| GPU 8 GB 显存 | 32 | 全量向量化约 30-60 分钟 |
| GPU 6 GB 显存 | 16 | 约 2-3 小时 |
| GPU 4 GB 或更少 | 8 | 或改用 CPU |
| 无 GPU（纯 CPU） | 8 | 慢 4-6 倍，先用小样本验证 |
| 内存低于 16 GB | 8 | 抽取阶段分片运行，不要一次扫描全部语料 |

这些时间是经验值，实际速度取决于文件类型、文本量、磁盘、CPU 和显卡。
`1060`、`4060` 等显卡也需要按显存和实际温度留出余量。
