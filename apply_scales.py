PATH = "index.html"

with open(PATH, "r", encoding="utf-8") as f:
    t = f.read()

# ---------- 1. Replace the CSS ----------
css_start_marker = ".terminal-win{background:var(--ink-mid)"
css_end_marker = "@keyframes blink{0%,100%{opacity:.8}50%{opacity:0}}"

css_start = t.find(css_start_marker)
css_end_pos = t.find(css_end_marker)
if css_start == -1 or css_end_pos == -1:
    raise SystemExit("Couldn't find the .terminal-win CSS block. Stopping before touching anything.")
css_end = css_end_pos + len(css_end_marker)

new_css = "\n".join([
    ".scale-visual{background:var(--ink-mid);border:1px solid var(--ink-border);border-radius:2px;position:sticky;top:6rem;padding:2rem 1.75rem 1.75rem;display:flex;flex-direction:column;gap:1.5rem;}",
    ".scale-visual-label{display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:0.6875rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);}",
    ".scale-visual-label-dot{width:6px;height:6px;border-radius:50%;background:var(--gold);box-shadow:0 0 8px var(--gold);animation:scalePulseDot 2s ease-in-out infinite;}",
    "@keyframes scalePulseDot{0%,100%{opacity:1}50%{opacity:.3}}",
    ".scale-svg{width:100%;height:auto;display:block;}",
    ".scale-post,.scale-chain{stroke:var(--gold-dim);stroke-width:2;fill:none;}",
    ".scale-bar{stroke:var(--gold);stroke-width:2.5;}",
    ".scale-base{fill:var(--ink-light);stroke:var(--gold-dim);stroke-width:1.5;}",
    ".scale-fulcrum{fill:var(--gold);}",
    ".scale-pan{stroke:var(--gold-dim);stroke-width:2;fill:none;}",
    ".scale-beam{transform-origin:160px 34px;animation:scaleTip 7s ease-in-out infinite;}",
    "@keyframes scaleTip{0%,8%{transform:rotate(0deg)}25%,42%{transform:rotate(-7deg)}50%{transform:rotate(0deg)}67%,84%{transform:rotate(7deg)}92%,100%{transform:rotate(0deg)}}",
    ".scale-doc{fill:var(--parchment);stroke:var(--gold-dim);stroke-width:1;opacity:0;}",
    ".doc-left{animation:scaleDrop 7s ease-in-out infinite;}",
    ".doc-right{animation:scaleDrop 7s ease-in-out infinite;animation-delay:3.5s;}",
    "@keyframes scaleDrop{0%{opacity:0;transform:translateY(-16px)}9%,46%{opacity:1;transform:translateY(0)}50%,100%{opacity:0;transform:translateY(0)}}",
    ".scale-visual-readout{display:flex;flex-direction:column;gap:0.65rem;border-top:1px solid var(--ink-border);padding-top:1.1rem;}",
    ".scale-readout-row{display:flex;align-items:center;justify-content:space-between;font-family:var(--font-mono);font-size:0.75rem;color:var(--muted);}",
    ".scale-readout-row.gold{color:var(--gold);}",
    ".scale-readout-num{color:var(--parchment);font-weight:500;}",
    ".scale-readout-row.gold .scale-readout-num{color:var(--gold-light);}",
]).replace("\n", "\\n")

t = t[:css_start] + new_css + t[css_end:]

# ---------- 2. Replace the HTML (depth-balanced, so it can't grab the wrong closing tag) ----------
start = t.find('<div class=\\"terminal-win\\">')
if start == -1:
    raise SystemExit("Couldn't find the terminal-win div. Stopping before touching anything.")

pos, depth, end = start, 0, None
while pos < len(t):
    open_idx = t.find("<div", pos)
    close_idx = t.find('<\\u002Fdiv>', pos)
    if close_idx == -1:
        break
    if open_idx != -1 and open_idx < close_idx:
        depth += 1
        pos = open_idx + 4
    else:
        depth -= 1
        pos = close_idx + len('<\\u002Fdiv>')
        if depth == 0:
            end = pos
            break

if end is None:
    raise SystemExit("Couldn't find the matching closing div. Stopping before touching anything.")

new_html = "\n".join([
    "<div class='scale-visual'>",
    "  <div class='scale-visual-label'>",
    "    <span class='scale-visual-label-dot'></span>",
    "    Weighing the record",
    "  </div>",
    "  <svg class='scale-svg' viewBox='0 0 320 260' xmlns='http://www.w3.org/2000/svg'>",
    "    <line x1='160' y1='34' x2='160' y2='214' class='scale-post'></line>",
    "    <path d='M118 214 L202 214 L214 236 L106 236 Z' class='scale-base'></path>",
    "    <circle cx='160' cy='34' r='5' class='scale-fulcrum'></circle>",
    "    <g class='scale-beam'>",
    "      <line x1='56' y1='34' x2='264' y2='34' class='scale-bar'></line>",
    "      <line x1='66' y1='34' x2='66' y2='92' class='scale-chain'></line>",
    "      <line x1='254' y1='34' x2='254' y2='92' class='scale-chain'></line>",
    "      <path d='M36 92 Q66 122 96 92' class='scale-pan'></path>",
    "      <path d='M224 92 Q254 122 284 92' class='scale-pan'></path>",
    "      <rect x='53' y='52' width='26' height='32' rx='2' class='scale-doc doc-left'></rect>",
    "      <rect x='241' y='52' width='26' height='32' rx='2' class='scale-doc doc-right'></rect>",
    "    </g>",
    "  </svg>",
    "  <div class='scale-visual-readout'>",
    "    <div class='scale-readout-row'><span>Weak points flagged</span><span class='scale-readout-num'>03</span></div>",
    "    <div class='scale-readout-row'><span>Coverage layers mapped</span><span class='scale-readout-num'>04</span></div>",
    "    <div class='scale-readout-row gold'><span>Recovery estimate</span><span class='scale-readout-num'>$18.7M</span></div>",
    "  </div>",
    "</div>",
]).replace("\n", "\\n")

t = t[:start] + new_html + t[end:]

with open(PATH, "w", encoding="utf-8") as f:
    f.write(t)

print("Done — replaced the CSS and the terminal-win div.")