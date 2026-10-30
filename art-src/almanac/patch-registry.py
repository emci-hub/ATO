import json
S={
'icon.almanac-decor':{'wreath':96.2,'lantern':93.5,'diya':100,'crescent':96.0,'egg':96.0,'snowflake':96.0,'petal':100,'star':99.0,'firework':91.0,'pumpkin':98.3},
'icon.almanac-stickers':{'pick-100':94.5,'glow-30':99.8,'one-year-ago':100,'equinox':99.6,'full-moon':99.8,'friday-13th':99.6,'clock-change':92.1,'half-year':100,'first-snow':100,'payday-friday':96.0,'small-moment':99.0,'month01':98.3,'month02':100,'month03':98.4,'month04':97.3,'month05':90.4,'month06':96.5,'month07':92.0,'month08':97.4,'month09':95.5,'month10':98.4,'month11':99.9,'month12':95.8},
'icon.almanac-badges':{'new-year':93.8,'lunar-new-year':97.6,'valentines':96.8,'easter':95.4,'mothers-day':92.3,'fathers-day':99.3,'summer-solstice':100,'summer':94.8,'back-to-school':96.0,'thanksgiving-ca':99.4,'thanksgiving-us':96.0,'halloween':94.1,'diwali':98.0,'eid-al-fitr':98.2,'winter-solstice':94.6,'christmas':95.6,'year-end':96.3,'season-spring':92.0,'season-summer':93.2,'season-autumn':93.7,'season-winter':100},
'icon.almanac-emblems':{'new-year':100,'lunar-new-year':91.9,'valentines':100,'easter':99.1,'summer':100,'thanksgiving':97.9,'halloween':94.1,'diwali':100,'eid-al-fitr':98.9,'winter-solstice':94.2,'christmas':99.7,'mothers-day':99.8},
'icon.almanac-sprigs':{'new-year':98.8,'lunar-new-year':92.8,'valentines':96.1,'easter':96.6,'summer':99.5,'thanksgiving':97.7,'halloween':98.7,'diwali':100,'eid-al-fitr':91.2,'winter-solstice':94.3,'christmas':92.2,'mothers-day':100},
'ui.almanac-frames':{'plain':96.0,'event':96.0,'complete':96.0},
'fx.almanac-snow':{'snow-64':95.3},'fx.almanac-leaf':{'leaf-64':98.7},'fx.almanac-petal':{'petal-64':98.7},
'fx.almanac-candle':{'candle-64':100},'fx.almanac-firework':{'firework-64':97.5},'fx.almanac-lantern-glow':{'lantern-glow-64':96.0},
}
LOOP={'snow':(16,83),'leaf':(16,100),'petal':(16,100),'candle':(8,100),'firework':(16,71),'lantern-glow':(12,83)}
gens=1
p='assets/art/registry.json'
r=json.load(open(p))
n=0
for x in r['assets']:
    pre,_,name=x['id'].rpartition('.')
    if pre in S and name in S[pre]:
        sc=S[pre][name]
        x['status']='candidate'
        x['critiqueScore']=None
        x['palette']='streetwear-night+almanac-accent'
        x['source']='pixellab'
        x['genCount']=1
        kind=pre.split('.')[1].replace('almanac-','')
        x['tags']=sorted({'almanac',kind})
        x['notes']=x.get('notes','').split(' | wb:')[0]+f' | wb:{sc} | art-src/almanac/jobs.tsv'
        if pre.startswith('fx.'):
            x['camera']='flat-ui'; x['placement']='overlay'
            f,ms=LOOP[kind]
            x['clips']={'loop':{'dirs':[],'frames':f,'ms':ms,'loop':True}}
            x['tags']=sorted(set(x['tags'])|{'loop','sheet','64px-frames'})
        n+=1
json.dump(r,open(p,'w'),indent=2); open(p,'a').write('\n')
print('patched',n)
