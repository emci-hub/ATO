import json,os,re,sys,collections
import numpy as np
from PIL import Image
L=json.load(open('assets/art/legacy-play-sheets.json'))
M=json.load(open('assets/play/sheets/streetwear/meta.json'))
cache={}
def sheet(s):
    if s not in cache:
        for b in ('assets/play/','assets/'):
            if os.path.exists(b+s): cache[s]=np.array(Image.open(b+s).convert('RGBA')); break
    return cache[s]
LOOP=re.compile(r'idle|walk|run|hover|drift|flight|breath',re.I)
res=[]
for key,v in L.items():
    p=key.split('/')
    if len(p)<4: continue
    if p[-1]=='rotations' or len(v['frames'])<2 or p[2] in('ui-kit','board') and 'flame' not in key and 'pigeon' not in key and 'smoke' not in key and 'steam' not in key: continue
    sh=sheet(v['sheet']); 
    bydir=collections.OrderedDict()
    for f,r in v['frames'].items():
        d=f.split('/')[0] if '/' in f else 'x'
        bydir.setdefault(d,[]).append(r)
    ox,oy=v.get('offsetX',0),v.get('offsetY',0); sw,shh=v.get('sourceW'),v.get('sourceH')
    name='/'.join(p[1:])
    loop=bool(LOOP.search(p[-1])) and not re.search(r'death|faint',p[-1],re.I)
    for d,rs in bydir.items():
        fr=[sh[r['y']:r['y']+r['h'],r['x']:r['x']+r['w']] for r in rs]
        sizes={(r['w'],r['h']) for r in rs}
        a=[f[...,3] for f in fr]
        bb=[];
        for x in a:
            ys,xs=np.where(x>0)
            bb.append((xs.min(),ys.min(),xs.max(),ys.max()) if len(ys) else None)
        empty=sum(b is None for b in bb)
        bot=[b[3]+oy for b in bb if b]; cx=[(b[0]+b[2])/2+ox for b in bb if b]; top=[b[1]+oy for b in bb if b]
        fx=[]
        for x,b in zip(a,bb):
            if not b: continue
            lo=max(b[1],b[3]-int(0.15*(b[3]-b[1]+1)))
            ys2,xs2=np.where(x[lo:b[3]+1]>0); fx.append(xs2.mean()+ox)
        # clipping: opaque pixel touching rect edge
        edge=sum(1 for x in a if x[0,:].any() or x[-1,:].any() or x[:,0].any() or x[:,-1].any())
        # dup frames
        dup=[i for i in range(1,len(fr)) if fr[i].shape==fr[i-1].shape and np.array_equal(fr[i],fr[i-1])]
        def diff(i,j):
            x,y=fr[i],fr[j]
            if x.shape!=y.shape: return 999
            return float((np.abs(x[...,3].astype(int)-y[...,3].astype(int))>0).mean())
        adj=[diff(i,i+1) for i in range(len(fr)-1)]
        seam=diff(len(fr)-1,0)
        partial=float(np.mean([((x>0)&(x<255)).sum()/max(1,(x>0).sum()) for x in a]))
        cols=set()
        for f in fr:
            m=f[...,3]>0; cols|=set(map(tuple,f[m][:,:3].reshape(-1,3)))
        res.append(dict(key=key,dir=d,n=len(fr),sizes=len(sizes),empty=empty,
          botRange=(max(bot)-min(bot)) if bot else 0,cxRange=(max(cx)-min(cx)) if cx else 0,footCx=(max(fx)-min(fx)) if fx else 0,
          topRange=(max(top)-min(top)) if top else 0,edge=edge,dups=len(dup),
          seam=seam,adjMean=float(np.mean(adj)),adjMax=float(max(adj)),partial=partial,colors=len(cols),loop=loop,
          sheet=v['sheet'],ms=v.get('ms')))
json.dump(res,open(sys.argv[1],'w'),default=lambda o:o.item())
print(len(res))
