"""Scénic-e: interactie, presets, zeven openers en deelbare URL op desktop en mobiel."""
import sys, json
from harness import session
fails=[]
checks=0
def check(ok,text):
 global checks
 checks+=1
 if not ok:fails.append(text)
 print(('ok ' if ok else 'FOUT ')+text)
with session() as s:
 pg=s.page(1280,800)
 check(pg.evaluate('__model.ALL.length')>250,'onderdelenboom opgebouwd')
 check(pg.evaluate('__model.checkPresets().length')==0,'alle presetankers bestaan')
 presets=pg.evaluate('__model.presetList()')
 check(len(presets)==21,'21 presets beschikbaar')
 for p in presets:
  if p['tour']:continue
  pg.evaluate('(id)=>{__model.preset(id);__model.finishAll();}',p['id'])
  check(pg.evaluate('__model.state().preset')==p['id'],'preset '+p['id'])
  check(pg.evaluate('()=>__model.ALL.every(n=>[...n.obj.position.toArray(),...n.obj.quaternion.toArray()].every(Number.isFinite))'),'eindige geometrie '+p['id'])
 pg.evaluate("__model.preset('assembled');__model.finishAll();__model.setOpenMode(true)")
 for op in pg.evaluate('__model.openers()'):
  pg.evaluate('(n)=>{__model.setOpen(n,1,true);__model.finishAll();}',op['name'])
  check(pg.evaluate('(n)=>__model.openers().find(o=>o.name===n).open',op['name'])==1,'open '+op['name'])
  pg.evaluate('(n)=>{__model.setOpen(n,0,true);__model.finishAll();}',op['name'])
  check(pg.evaluate('(n)=>__model.openers().find(o=>o.name===n).open',op['name'])==0,'sluit '+op['name'])
 check(len(pg.evaluate('__model.openers()'))==7,'zeven openers; geen schuivend Solarbay-dak')
 pg.evaluate("__model.preset('battery');__model.finishAll()")
 check('preset=battery' in pg.url,'accupreset maakt deelbare URL')
 pg.evaluate("__model.preset('assembled');__model.finishAll();__model.select(__model.byName('Tractieaccu'));__model.finishAll()")
 check(pg.evaluate('__model.sel().name')=='Tractieaccu','selectie van tractieaccu')
 check(pg.evaluate("__model.pnOf('Tractieaccu').unit")=='basis:tractieaccu','accu heeft expliciete status zonder geverifieerd nummer')
 pg.close()
 ph=s.page(390,844,scale=2,touch=True,query='?preset=battery')
 check(not ph.evaluate('document.documentElement.scrollWidth>innerWidth'),'mobiel geen horizontale scroll')
 check(ph.evaluate('__model.state().preset')=='battery','gedeelde preset hersteld op mobiel')
 ph.evaluate("__model.preset('openAll');__model.finishAll()")
 check(all(o['open']==1 for o in ph.evaluate('__model.openers()')),'mobiel alles open')
 check(ph.evaluate("document.querySelector('#stage').getBoundingClientRect().width")>0,'mobiel canvas zichtbaar')
 ph.close()
 s.report()
 fails.extend(s.errors())
print(f'{checks} controles, {len(fails)} fouten')
for f in fails:print('FOUT',f)
sys.exit(1 if fails else 0)
