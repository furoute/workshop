# Everything 命令行选项（完整表）

> 官方命令行选项文档的 Markdown 版，共 129 条。
> 用法：`Everything.exe [filename] [options]`

## 最常用的 12 条

| 参数 | 作用 | 场景 |
|---|---|---|
| `-startup` | 后台运行 Everything | 开机自启 / 无窗口启动 |
| `-minimized` | 最小化窗口 | 配合 `-startup` |
| `-install-run-on-system-startup` | **添加到系统启动项** | 便携版也能设开机自启 |
| `-uninstall-run-on-system-startup` | 移除启动项 | 卸载 / 清理 |
| `-reindex` | 强制重建数据库 | 索引损坏、文件大量变动后 |
| `-update` | 更新数据库 | 手动触发扫描 |
| `-search text` / `-s text` | 命令行直接搜索 | 脚本调用 |
| `-sort name` | 指定排序 | 导出前排序 |
| `-select filename` | 聚焦并选中指定结果 | 让用户一眼看到文件 |
| `-toggle-window` | 隐藏 / 显示前台窗口 | 托盘交互 |
| `-config filename` | 指定 ini 文件 | 多套配置切换 |
| `-exit` / `-quit` | 退出程序 | 脚本清理 |

## 常用组合

```bat
:: 开机静默启动（配合启动文件夹快捷方式）
Everything.exe -startup -minimized

:: 便携版直接注册成开机启动项（不用装安装版）
Everything.exe -install-run-on-system-startup

:: 索引坏了，强制重建
Everything.exe -reindex

:: 直接搜并选中结果
Everything.exe -search "报错日志" -select "报错日志"

:: 用指定 ini 启动
Everything.exe -config "D:\path\custom.ini"
```

---

## 启动 / 退出（6 条）

| 参数 | 说明 |
|---|---|
| `-close` | 关闭当前搜索窗口. |
| `-exit` | 退出 Everything. |
| `-first-instance` | 仅当此为 Everything 第一个实例时运行. |
| `-quit` | 退出 Everything. |
| `-startup` | 后台运行 Everything. |
| `-toggle-window` | 隐藏或显示前台搜索窗口. |

## 窗口显示（10 条）

| 参数 | 说明 |
|---|---|
| `-fullscreen` | 全屏显示搜索窗口. |
| `-maximized` | 最大化搜索窗口. |
| `-minimized` | 最小化搜索窗口. |
| `-newwindow` | 新建搜索窗口. |
| `-nofullscreen` | 窗口化显示搜索窗口. |
| `-nomaximized` | 非最大化搜索窗口. |
| `-nominimized` | 非最小化搜索窗口. |
| `-nonewwindow` | 显示存在的搜索窗口. |
| `-noontop` | 禁用总在最前. |
| `-ontop` | 启用总在最前. |

## 搜索（12 条）

| 参数 | 说明 |
|---|---|
| `-case` | 启用大小写区分. |
| `-matchpath` | 启用完整路径匹配. |
| `-nocase` | 禁用大小写区分. |
| `-nomatchpath` | 禁用完整路径匹配. |
| `-noregex` | 禁用正则表达式. |
| `-nowholeword` | 禁用全字匹配. |
| `-noww` | 禁用全字匹配. |
| `-regex` | 使用正则表达式. |
| `-sort-ascending` | 升序排列. |
| `-sort-descending` | 降序排列. |
| `-wholeword` | 启用全字匹配. |
| `-ww` | 启用全字符匹配. |

## 索引 / 数据库（7 条）

| 参数 | 说明 |
|---|---|
| `-choose-volumes` | 禁用自动索引. |
| `-l` | 载入本地数据库. |
| `-local` | 载入本地数据库. |
| `-nodb` | 不保存或载入 Everything 数据库. |
| `-read-only` | 以只读模式载入数据库. |
| `-reindex` | 强制重建数据库. |
| `-update` | 更新数据库. |

## 安装 / 卸载（24 条）

| 参数 | 说明 |
|---|---|
| `-install-client-service` | 安装 Everything 客户服务. |
| `-install-desktop-shortcut` | 创建桌面快捷方式. |
| `-install-efu-association` | 关联 EFU 文件. |
| `-install-folder-context-menu` | 安装文件夹右键菜单. |
| `-install-quick-launch-shortcut` | 添加到快速启动栏. |
| `-install-run-on-system-startup` | 添加 Everything 到启动项. |
| `-install-service` | 安装并开启 Everything 服务. |
| `-install-start-menu-shortcuts` | 添加 Everything 到开始菜单. |
| `-install-url-protocol` | 安装 URL 协议. |
| `-start-client-service` | 开启 Everything 客户服务. |
| `-start-service` | 开启 Everything 服务. |
| `-stop-client-service` | 停止 Everything 客户服务. |
| `-stop-service` | 停止 Everything 服务. |
| `-svc` | 以服务形式运行 Everything. |
| `-uninstall-client-service` | 移除 Everything 客户服务. |
| `-uninstall-desktop-shortcut` | 移除桌面快捷方式. |
| `-uninstall-efu-association` | 移除 EFU 文件关联. |
| `-uninstall-folder-context-menu` | 移除文件夹右键菜单. |
| `-uninstall-quick-launch-shortcut` | 从快速启动栏移除. |
| `-uninstall-run-on-system-startup` | 移除 Everything 启动项. |
| `-uninstall-service` | 移除 Everything 服务. |
| `-uninstall-start-menu-shortcuts` | 从开始菜单中移除 Everything . |
| `-uninstall-url-protocol` | 卸载 URL 协议. |
| `-uninstall-user` | 移除用户文件. |

## 配置 / 调试（12 条）

| 参数 | 说明 |
|---|---|
| `-app-data` | 保存数据到应用程序数据. |
| `-choose-language` | 显示语言选择窗口. |
| `-console` | 显示调试控制台. |
| `-debug` | 显示调试控制台. |
| `-debug-log` | 记录调试信息到本地硬盘. |
| `-disable-run-as-admin` | 禁用以管理员身份运行. |
| `-disable-update-notification` | 禁用程序打开时更新通知. |
| `-enable-run-as-admin` | 启用以管理员身份运行. |
| `-enable-update-notification` | 启用程序打开时更新通知. |
| `-noapp-data` | 保存数据到应用程序路径. |
| `-noverbose` | 显示基本调制信息. |
| `-verbose` | 显示所有调试信息. |

## 其他（58 条）

| 参数 | 说明 |
|---|---|
| `-` | 显示帮助. |
| `-admin` | 以管理员身份运行 Everything. |
| `-admin-server-share-links` | 在 ETP 连接中使用 ServerC$ 的链接形式. |
| `-bookmark name` | 打开指定的书签. |
| `-config filename` | 指定 ini 文件的文件名. |
| `-connect userpass@hostport` | 连接 ETP 服务器. |
| `-copyto filename1 ...` | 显示使用指定文件名的多文件重命名工具. |
| `-create-file-list filename path` | 创建一个路径的文件列表. |
| `-create-file-list-exclude-files list` | 排除匹配筛选器的文件, 筛选器用分号分隔. |
| `-create-file-list-exclude-folders list` | 排除匹配筛选器的文件夹, 筛选器用分号分隔. |
| `-create-file-list-include-only-files list` | 仅包含匹配筛选器的文件, 筛选器用分号分隔. |
| `-create-usn-journal volume max-size-bytes allocation-delta-bytes` |  |
| `-db filename` | 指定数据库的文件名. |
| `-delete-usn-journal volume` | 删除 USN 日志. |
| `-details` | 以详情视图显示结果. |
| `-diacritics` | 启用变音符匹配. |
| `-drive-links` | 在 ETP 连接中使用 C 的链接形式. |
| `-edit filename` | 用文件列表编辑器打开文件列表. |
| `-filelist filename` | 打开指定的文件列表. |
| `-filename filename` | 搜索指定文件名的文件和文件夹. |
| `-filter name` | 选择指定的搜索筛选器. |
| `-focus-bottom-result` | 聚焦到底部结果. |
| `-focus-last-run-result` | 聚焦到上次运行结果. |
| `-focus-most-run-result` | 聚焦到最常运行结果. |
| `-focus-results` | 聚焦到结果列表. |
| `-focus-top-result` | 聚焦到顶部结果. |
| `-ftp-links` | 在 ETP 连接中使用 ftphostC 的链接形式. |
| `-h` | 显示帮助. |
| `-help` | 显示帮助. |
| `-home` | 打开搜索首页. |
| `-install location` | 安装 Everything 到指定路径. |
| `-install-config filename` | 安装指定 ini 文件. |
| `-install-service-pipe-name name` | 指定 Everything 服务管道名称. |
| `-install-service-security-descriptor` | 指定管道安全描述. |
| `-instance name` | 指定 Everything 的实例名. |
| `-language langID` | 指定语言代码以变更界面语言. |
| `-load-delay milliseconds` | 载入数据库之前, 指定以毫秒为单位的延迟. |
| `-moveto filename1 ...` | 显示使用指定文件名的多文件重命名工具. |
| `-name-part filename` | 搜索文件部分文件名. |
| `-nodiacritics` | 禁用变音符匹配. |
| `-p path` | 搜索指定的路径. |
| `-parent path` | 搜索指定文件夹中的文件和子文件夹. |
| `-parentpath path` | 搜索指定的父目录. |
| `-path path` | 搜索指定的路径. |
| `-rename filename1 ...` | 显示使用指定文件名的多文件重命名工具. |
| `-s text` | 搜索指定文本. |
| `-search text` | 搜索指定文本. |
| `-searchfilelist filename` | 在指定的文本搜索列表中的文件名. |
| `-select filename` | 聚焦且选定指定结果. |
| `-server-share-links` | 在 ETP 连接中使用 ServerC 的链接形式. |
| `-service-pipe-name name` | 链接到指定名称的安全管道. |
| `-sort name` | 以指定名称排列. |
| `-svc-pipe-name name` | 启用指定名称的管道服务器. |
| `-svc-security-descriptor sd` | 启用指定安全描述的管道服务器. |
| `-thumbnail-size size` | 指定图标大小. |
| `-thumbnails` | 以图标视图显示结果. |
| `-uninstall [path]` | 指定 Everything 路径来卸载. |
| `-url [es]search` | 搜索指定链接 ES URL. |

---

> 上表按用途分类，与官方文档的字母序不同；分类未覆盖的条目统一放在「其他」。
