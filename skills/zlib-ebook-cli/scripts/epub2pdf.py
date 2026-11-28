#!/usr/bin/env python3
"""
EPUB → PDF（深色/浅色），专为手机阅读排版。
用法：
  python3 epub2pdf.py book.epub                    # 浅色
  python3 epub2pdf.py book.epub --dark             # 深色（黑底白字）
  python3 epub2pdf.py book.epub --dark -o out.pdf  # 指定输出

依赖：pip install ebooklib pymupdf
"""
import argparse, base64, html, os, re, sys

def build_html(epub_path, dark=False):
    import ebooklib
    from ebooklib import epub as epubmod

    book = epubmod.read_epub(epub_path)
    items = list(book.get_items())
    docs = [i for i in items if i.get_type() == ebooklib.ITEM_DOCUMENT]
    by_id = {d.get_id(): d for d in docs}
    imgs = {i.get_name(): i for i in items if i.get_type() == ebooklib.ITEM_IMAGE}

    def img_b64(name):
        it = imgs.get(name)
        if not it:
            return None
        mime = "image/png" if name.lower().endswith(".png") else "image/jpeg"
        return f"data:{mime};base64," + base64.b64encode(it.get_content()).decode()

    color, bg = ("#d8d8d8", "#121212") if dark else ("#222", "#fdfcf8")
    parts = []
    for sid, _ in book.spine:
        d = by_id.get(sid)
        if not d:
            continue
        h = d.get_content().decode("utf-8", "replace")
        def repl(m):
            fn = m.group(2).split("/")[-1]
            cand = next((k for k in imgs if k.endswith(fn)), None)
            b = img_b64(cand) if cand else None
            return f'<img{m.group(1)}src="{b}"' if b else m.group(0)
        h = re.sub(r'<img([^>]*?)src="([^"]+)"', repl, h)
        h = re.sub(r"<link[^>]*>", "", h)
        parts.append(f'<div class="chapter">{h}</div>')

    return ("<!DOCTYPE html><html><head><meta charset='utf-8'><style>"
            f"body{{font-size:16px;line-height:1.9;color:{color};background:{bg};margin:0;padding:8px 14px}}"
            "h1,h2,h3{text-align:center;margin:1.2em 0 .8em}"
            f"p{{text-indent:2em;margin:.5em 0;color:{color}}}"
            "img{max-width:100%;height:auto;display:block;margin:12px auto}"
            ".chapter{margin-bottom:2em}</style></head><body>" + "".join(parts) + "</body></html>")

def render(html_str, out_path, dark=False, w=420, h=640):
    import fitz
    color, bg = ("#d8d8d8", "#121212") if dark else ("#222", "#fdfcf8")
    css = (f"*{{font-family:sans-serif}} html,body{{background-color:{bg};color:{color};"
           "font-size:13px;line-height:1.75}"
           f"h1,h2,h3{{color:{'#f2f2f2' if dark else '#111'}}}"
           f"p{{text-indent:2em;margin:4px 0;color:{color}}} img{{max-width:100%}}")
    story = fitz.Story(html=html_str, user_css=css)
    writer = fitz.DocumentWriter(out_path)
    while True:
        dev = writer.begin_page(fitz.Rect(0, 0, w, h))
        more, _ = story.place(fitz.Rect(0, 0, w, h))
        story.draw(dev)
        writer.end_page()
        if not more:
            break
    writer.close()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("epub")
    ap.add_argument("-o", "--out")
    ap.add_argument("--dark", action="store_true", help="黑底白字")
    ap.add_argument("--size", default="420x640", help="页面尺寸，默认 420x640（手机）")
    a = ap.parse_args()
    out = a.out or os.path.splitext(a.epub)[0] + ("-深色.pdf" if a.dark else ".pdf")
    w, h = map(int, a.size.lower().split("x"))
    print(f"读取 {a.epub}")
    html_str = build_html(a.epub, a.dark)
    print(f"渲染 {'深色' if a.dark else '浅色'}版 → {out}")
    render(html_str, out, a.dark, w, h)
    import fitz
    d = fitz.open(out)
    print(f"完成：{d.page_count} 页，{os.path.getsize(out)/1024/1024:.2f} MB")
    d.close()

if __name__ == "__main__":
    main()
