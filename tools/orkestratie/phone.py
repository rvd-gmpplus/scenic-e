"""Twee telefoonbeelden (390 x 844): start en modus Openen. Gebruik: phone.py UITMAP"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))  # tools/ van deze checkout
from harness import session
with session() as s:
    ph = s.page(390, 844, touch=True, scale=2)
    ph.wait_for_function('window.__model && window.__model.ready', timeout=180000)
    ph.wait_for_timeout(800); ph.screenshot(path=sys.argv[1] + '/telefoon-start.png')
    ph.evaluate('() => window.__model.setOpenMode(true)'); ph.wait_for_timeout(800)
    ph.screenshot(path=sys.argv[1] + '/telefoon-openen.png')
    print(ph.evaluate('() => [document.documentElement.scrollWidth, window.innerWidth]'))
    s.report()
