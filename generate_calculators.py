#!/usr/bin/env python3
import json, os, datetime, html

ROOT = os.path.dirname(os.path.abspath(__file__))
CALC_DIR = os.path.join(ROOT, "calculators")
DOMAIN = "https://calculatorchoice.com"

with open(os.path.join(ROOT, "calculators.json"), "r", encoding="utf-8") as f:
    CALCS = json.load(f)

# Ensure folder
os.makedirs(CALC_DIR, exist_ok=True)

# Write per-calculator pages
def page_html(calc):
    slug = calc["slug"]
    title = f'{calc["name"]} — CalculatorChoice'
    desc = calc["description"]
    canonical = calc["canonical"]
    formula = calc.get("formula","")
    faq = calc.get("faq",[])
    howto = calc.get("howto",[])
    fields = calc["ui"]["fields"]
    computeKey = calc["ui"]["computeKey"]

    # Build inputs
    def field_to_html(f):
        fid = html.escape(f["id"])
        label = html.escape(f["label"])
        kind = f["kind"]
        show_if = f.get("showIf")
        data_show = f'data-show="{html.escape(show_if)}"' if show_if else ""
        if kind == "number":
            return f'<label {data_show}><span>{label}</span><input type="number" id="{fid}" inputmode="decimal" step="any"></label>'
        if kind == "select":
            opts = "".join([f'<option value="{html.escape(o["value"])}">{html.escape(o["label"])}</option>' for o in f["options"]])
            return f'<label {data_show}><span>{label}</span><select id="{fid}">{opts}</select></label>'
        if kind == "radio":
            radios = "".join([f'<label class="opt"><input type="radio" name="{fid}" value="{html.escape(o["value"])}" {"checked" if o.get("checked") else ""}> {html.escape(o["label"])}</label>' for o in f["options"]])
            return f'<fieldset id="{fid}" {data_show}><legend>{label}</legend><div class="rad">{radios}</div></fieldset>'
        return ""

    inputs_html = "\n          ".join(field_to_html(f) for f in fields)

    # JSON-LD graph
    def faq_ld():
        if not faq: return ""
        return {
            "@type":"FAQPage",
            "mainEntity":[{"@type":"Question","name":q["q"],"acceptedAnswer":{"@type":"Answer","text":q["a"]}} for q in faq]
        }
    def howto_ld():
        if not howto: return ""
        return {"@type":"HowTo","name": f"How to use {calc['name']}", "step":[{"@type":"HowToStep","text":s} for s in howto]}
    ld_graph = {
      "@context":"https://schema.org",
      "@graph":[
        {"@type":"BreadcrumbList","itemListElement":[
          {"@type":"ListItem","position":1,"name":"Home","item":f"{DOMAIN}/"},
          {"@type":"ListItem","position":2,"name":calc["category"],"item":f"{DOMAIN}/#{calc['category'].lower()}"},
          {"@type":"ListItem","position":3,"name":calc["name"],"item":canonical}
        ]},
        {"@type":"WebApplication","name":calc["name"],"url":canonical,"applicationCategory":"EducationalApplication","operatingSystem":"Any","description":desc}
      ]
    }
    f = faq_ld()
    h = howto_ld()
    if f: ld_graph["@graph"].append(f)
    if h: ld_graph["@graph"].append(h)

    # Page HTML
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="keywords" content="{html.escape(calc['name'].lower())}, calculator, {html.escape(calc['category'].lower())}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0b0b0d">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<link rel="canonical" href="{html.escape(canonical)}">
<link rel="stylesheet" href="/style.css">
<meta property="og:title" content="{html.escape(calc['name'])}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{html.escape(canonical)}">
<meta property="og:image" content="{DOMAIN}/og-default.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(calc['name'])}">
<meta name="twitter:description" content="{html.escape(desc)}">
<script type="application/ld+json">{json.dumps(ld_graph, ensure_ascii=False)}</script>
</head>
<body>
<header class="header"><div class="wrap"><h1>{html.escape(calc['name'])}</h1><p class="muted">{html.escape(desc)}</p></div></header>
<main class="wrap">
  <section class="card">
    <p><strong>Formula:</strong> {html.escape(formula)}</p>
    <div class="grid" id="inputs">
      {inputs_html}
    </div>
    <div class="actions" style="margin-top:10px">
      <button id="calcBtn" type="button">Calculate</button>
      <button id="clearBtn" type="button">Clear</button>
    </div>
    <div id="result" class="result">Result: —</div>
    <p id="work" class="muted" aria-live="polite"></p>
  </section>

  <aside class="card">
    <h2>Related</h2>
    <p class="muted"><a href="{DOMAIN}/">Back to all calculators</a></p>
  </aside>
</main>
<footer class="footer"><div class="wrap"><p class="muted">© CalculatorChoice</p></div></footer>
<script type="module">
  import {{ calculators }} from "/calc-lib.js";
  const kind = "{computeKey}";
  const $ = (s)=>document.querySelector(s);
  const inputs = {{}};
  function syncShow(){{
    document.querySelectorAll("[data-show]").forEach(el=>{{
      const rule = el.getAttribute("data-show"); // e.g., mode=moles
      if(!rule) return;
      const [k,v] = rule.split("=");
      let val = "";
      const fieldset = document.getElementById(k);
      if(fieldset && fieldset.tagName==="FIELDSET"){{
        const checked = fieldset.querySelector("input[type=radio]:checked");
        val = checked?checked.value:"";
      }} else {{
        const sel = document.getElementById(k);
        if(sel) val = sel.value;
      }}
      el.style.display = (String(val)===String(v)) ? "block" : "none";
    }});
  }}
  function readValues(){{
    const data = {{}};
    document.querySelectorAll("#inputs input, #inputs select, #inputs fieldset").forEach(el=>{{
      if(el.tagName==="FIELDSET"){{
        const checked=el.querySelector("input[type=radio]:checked");
        data[el.id]=checked?checked.value:"";
      }} else {{
        data[el.id]=el.value;
      }}
    }});
    return data;
  }}
  function clearValues(){{
    document.querySelectorAll("#inputs input").forEach(el=> el.value = "");
    document.querySelectorAll("#inputs fieldset input[type=radio]").forEach((r,i)=> r.checked = r.hasAttribute("checked"));
    document.getElementById("result").textContent="Result: —";
    document.getElementById("work").textContent="";
    syncShow();
  }}
  document.getElementById("calcBtn").addEventListener("click", ()=>{
    const data = readValues();
    const calc = calculators[kind];
    if(!calc) return;
    const out = calc.compute(data);
    if(out.ok){{
      document.getElementById("result").textContent = "Result: " + out.value;
      document.getElementById("work").textContent = out.work || "";
    }} else {{
      document.getElementById("result").textContent = out.msg || "Check your inputs.";
      document.getElementById("work").textContent = "";
    }}
  });
  document.getElementById("clearBtn").addEventListener("click", clearValues);
  document.getElementById("inputs").addEventListener("change", syncShow);
  syncShow();
</script>
</body>
</html>
"""

# write pages
for c in CALCS:
    out_dir = os.path.join(CALC_DIR, c["slug"])
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(page_html(c))

# Generate sitemap.xml
now = datetime.datetime.utcnow().strftime("%Y-%m-%d")
urls = [f"{DOMAIN}/"] + [f"{DOMAIN}/calculators/{c['slug']}/" for c in CALCS]
smap = ['<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
prio = {"molarity-calculator":"0.9","dilution-calculator":"0.9","molality-calculator":"0.85","quadratic-calculator":"0.85","ohms-law":"0.8"}
for u in urls:
    slug = u.split("/calculators/")[-1].strip("/") if "/calculators/" in u else ""
    p = prio.get(slug,"0.8") if slug else "1.0"
    smap.append(f"  <url><loc>{u}</loc><lastmod>{now}</lastmod><priority>{p}</priority></url>")
smap.append("</urlset>")
with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as f:
    f.write("\n".join(smap))

print("Generated pages and sitemap.xml")
