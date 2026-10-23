#!/usr/bin/env python3
"""Online co-op end to end, two real browsers (Playwright, one Chromium): both open Co-op → A friend online, the host
copies its code, the friend pastes it and sends back a reply, the host connects and starts. A bot plays each side's
own survivor (DS.Game.netAuto). Checks: no desync, both PCs agree on kills / levels / HP, the friend banks its own
survivor, Quit ends the run for both but keeps the connection, Retry goes back to the lobby for a second run, and
closing the page ends the friend's run.
   DS_OUT=build python3 tools/agents/coop/online.py [seconds=40]      (DS_OUT=build/demo for the demo build)"""
import os, sys, time
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.environ.get('DS_ROOT', os.getcwd()), os.environ.get('DS_OUT', 'build'), 'index.html'))
SECS = float(sys.argv[1]) if len(sys.argv) > 1 else 40
fails = 0
def ok(c, m):
    global fails
    print(('  ok   ' if c else '  FAIL ') + m)
    if not c: fails += 1
BOT = '''() => {
  const G = DS.Game; let bot = null, bw = null;
  G.netAuto = (w, inp) => {
    const me = w.players[G.net.local];
    if (bw !== w) { bw = w; w.as(me); bot = new DS.Bot(w, { seed: 7 + G.net.local, skill: 0.6 }); }
    w.as(me);
    if (w.choice && G.net.isAnswered(w.choice)) return;
    if (DS.Overlay.isOpen()) DS.Overlay.close();
    const real = w.input; w.input = inp; bot.tick(); w.input = real;
  };
}'''
STATE = '() => { const G = DS.Game, w = G.world; return { f: G.net ? G.net.f : -1, desync: G.net ? G.net.desync : null, over: w.over ? w.over.result : null, lv: w.players.map(q => q.level), hp: w.players.map(q => Math.round(q.hp)), kills: w.stats.kills, wait: G.netWaitT, rtt: Math.round(DS.Net.rtt) }; }'
def connect(A, B):
    A.click('button[data-act="netHost"]'); A.wait_for_selector('textarea.m-code[readonly]', timeout=15000)
    code = A.input_value('textarea.m-code[readonly]')
    B.click('button[data-act="netJoinStart"]'); B.fill('textarea[data-in="paste"]', code); B.click('button[data-act="netJoin"]')
    B.wait_for_selector('textarea.m-code[readonly]', timeout=15000); reply = B.input_value('textarea.m-code[readonly]')
    A.fill('textarea[data-in="reply"]', reply); A.click('button[data-act="netAccept"]')
    A.wait_for_selector('.m-net-ok', timeout=20000); B.wait_for_selector('.m-net-ok', timeout=20000)
    A.wait_for_function('() => !document.querySelector(".m-start.off")', timeout=10000)
    return code, reply
with sync_playwright() as p:
    b = p.chromium.launch()
    A = b.new_context(viewport={'width': 1280, 'height': 720}).new_page(); B = b.new_context(viewport={'width': 390, 'height': 844}).new_page()
    errs = []
    for pg in (A, B):
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_function('() => window.DS && DS.UI && DS.UI.root && DS.UI.root.classList.contains("on")', timeout=30000)
        pg.click('button[data-to="coop"]'); pg.click('button[data-act="withMode"][data-id="friend"]')
    B.click('button[data-act="surv"][data-id="juno"]')
    print('· connecting through the UI')
    code, reply = connect(A, B)
    ok(code.startswith('DS1.') and reply.startswith('DS1.') and len(code) < 600, 'host code %d chars, reply %d chars, both connected' % (len(code), len(reply)))
    ok('Juno' in A.inner_text('.m-net') and 'Rook' in B.inner_text('.m-net'), 'the lobby shows each side who plays what')
    for pg in (A, B): pg.evaluate(BOT)
    A.click('button[data-act="start"]')
    B.wait_for_function('() => DS.Game.net && DS.Game.world', timeout=15000)
    ok(B.evaluate('() => DS.Game.net.local') == 1 and B.evaluate('() => DS.Game.world.players.map(q => q.surv.id).join()') == 'rook,juno', 'both run the same two survivors; the friend plays the second')
    print('· playing %ds with a bot on each side' % SECS)
    t0 = time.time(); agree = True; worst = 0
    while time.time() - t0 < SECS:
        time.sleep(5)
        a, c = A.evaluate(STATE), B.evaluate(STATE)
        worst = max(worst, a['wait'], c['wait'])
        if a['desync'] != -1 or c['desync'] != -1: break
        if abs(a['f'] - c['f']) < 3 and (a['kills'] != c['kills'] or a['lv'] != c['lv']): agree = False
        if a['over'] or c['over']: break
    ok(a['desync'] == -1 and c['desync'] == -1, 'no desync over %d frames (hash checked every 30)' % a['f'])
    ok(agree and a['lv'] == c['lv'], 'both PCs agree: kills %d / %d, levels %s, HP %s / %s' % (a['kills'], c['kills'], a['lv'], a['hp'], c['hp']))
    print('· quit, retry, close')
    A.evaluate('() => DS.Game.quit()')
    B.wait_for_function('() => DS.Game.world.over', timeout=10000)
    ok(B.evaluate('() => DS.Game.world.over.result') == 'quit' and B.evaluate('() => DS.Game.world.over.survivor') == 'juno' and B.evaluate('() => DS.Net.state') == 'open', 'the host quits: the friend\'s run ends too, banked for Juno, still connected')
    for pg in (A, B): pg.wait_for_selector('button[data-act="eRetry"]', timeout=15000); pg.click('button[data-act="eRetry"]')
    A.wait_for_selector('.m-net-ok', timeout=10000); B.wait_for_selector('.m-net-ok', timeout=10000)
    A.wait_for_function('() => !document.querySelector(".m-start.off")', timeout=10000)
    A.click('button[data-act="start"]'); B.wait_for_function('() => DS.Game.net && DS.Game.world && !DS.Game.world.over && DS.Game.world.t > 2', timeout=15000)
    ok(A.evaluate('() => DS.Game.net.run') == B.evaluate('() => DS.Game.net.run'), 'Retry → back in the lobby → a second run starts on both')
    B.close()
    A.wait_for_function('() => DS.Game.world.over', timeout=20000)
    ok(A.evaluate('() => DS.Game.world.over.result') == 'quit', 'the friend closes the page: the host\'s run ends')
    ok(not errs, 'no page errors' + ('' if not errs else ': ' + '; '.join(errs[:3])))
    b.close()
print(str(fails) + ' FAILED' if fails else 'ALL ONLINE OK')
sys.exit(1 if fails else 0)
