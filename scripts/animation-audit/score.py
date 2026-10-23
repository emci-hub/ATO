import json,re,sys
r=json.load(open(sys.argv[1]))
out=[]
for x in r:
    p=x['key'].split('/'); skin,grp,clip=p[1],p[2],p[-1]
    if grp not in('heroes','creeps','towers','boss','auras','fx'): continue
    pen=[];s=5.0
    loop=x['loop']
    if x['empty'] and grp not in('fx','auras'): s-=2;pen.append(f"{x['empty']} empty frame(s)")
    if x['sizes']>1: s-=1;pen.append('frame-size mismatch')
    if x['dups']: s-=1;pen.append(f"{x['dups']} duplicate frame(s)")
    if loop:
        if re.search('idle',clip,re.I) and x['botRange']>1: s-=1 if x['botRange']<=3 else 2;pen.append(f"foot drift {x['botRange']}px")
        if re.search('idle',clip,re.I) and x['footCx']>2.5: s-=1;pen.append(f"feet slide {x['footCx']:.1f}px")
        if x['seam']>2.2*x['adjMean']+0.03: s-=1;pen.append(f"loop-seam pop ({x['seam']:.2f} vs avg {x['adjMean']:.2f})")
    else:
        if x['adjMax']>0.45: s-=1;pen.append(f"big frame jump ({x['adjMax']:.2f})")
        if re.search('hurt|faint|death',clip,re.I) and x['botRange']>8: s-=1;pen.append(f"baseline moves {x['botRange']}px")
    if x['n']<=4 and grp in('heroes','creeps','towers','boss'): s-=1;pen.append(f"only {x['n']} frames")
    if grp in('heroes','creeps','towers','boss') and skin=='streetwear': s-=0.5;pen.append('flat timing')
    sev='broken' if s<=2 else 'ugly' if s<=3.5 else 'ok'
    out.append(dict(x,score=max(1,round(s*2)/2),sev=sev,pen=pen))
json.dump(out,open(sys.argv[2],'w'))
import collections
print(collections.Counter((o['key'].split('/')[1],o['sev']) for o in out))
for o in sorted(out,key=lambda o:o['score'])[:25]: print(o['score'],o['key'],o['dir'],o['pen'])
