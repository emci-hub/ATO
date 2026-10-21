import json,os,re,sys
import numpy as np
from PIL import Image,ImageDraw
L=json.load(open('assets/art/legacy-play-sheets.json'))
def sheet(s):
    for b in('assets/play/','assets/'):
        if os.path.exists(b+s): return Image.open(b+s).convert('RGBA')
MS={'idle':120,'walk':100,'dash':50,'attack':65,'skill':70,'hurt':140,'faint':110,'death':70}
def ms_for(clip):
    for k,v in MS.items():
        if k in clip.lower(): return v
    return 100
def render(key,d,outdir,tag):
    v=L[key];sh=sheet(v['sheet']);ox,oy=v.get('offsetX',0),v.get('offsetY',0)
    W,H=v.get('sourceW'),v.get('sourceH')
    rs=[r for f,r in v['frames'].items() if (f.split('/')[0] if '/' in f else 'x')==d]
    if not W: W=max(r['w'] for r in rs)+4;H=max(r['h'] for r in rs)+4;ox=oy=2
    frames=[]
    bots=[]
    for r in rs:
        c=Image.new('RGBA',(W,H),(38,38,46,255))
        fr=sh.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h']))
        a=np.array(fr)[...,3];ys=np.where(a.any(1))[0]
        bots.append(oy+ys.max() if len(ys) else None)
        c.alpha_composite(fr,(ox,oy));frames.append(c)
    ref=[b for b in bots if b is not None]; base=int(np.median(ref)) if ref else H-1
    out=[]
    for c,b in zip(frames,bots):
        dr=ImageDraw.Draw(c); dr.line([(0,base),(W,base)],fill=(255,0,90,255))   # median baseline
        if b is not None: dr.line([(0,b),(6,b)],fill=(0,255,120,255))             # this frame's foot row
        out.append(c)
    dur=ms_for(key.split('/')[-1])
    for scale in(1,3):
        sc=[f.resize((W*scale,H*scale),Image.NEAREST).convert('P',palette=Image.ADAPTIVE) for f in out]
        sc[0].save(f"{outdir}/{tag}_{scale}x.gif",save_all=True,append_images=sc[1:],duration=dur,loop=0,disposal=1)
    # contact sheet @2x
    cs=Image.new('RGBA',(W*2*len(out),H*2),(0,0,0,255))
    for i,f in enumerate(out): cs.paste(f.resize((W*2,H*2),Image.NEAREST),(i*W*2,0))
    cs.convert('RGB').save(f"{outdir}/{tag}_sheet.png")
    return dict(frames=len(out),dur=dur,W=W,H=H)
if __name__=='__main__':
    outdir=sys.argv[1]; os.makedirs(outdir,exist_ok=True)
    jobs=[("sheets/streetwear/boss/oni/Run","east"),("sheets/cast/heroes/elowen/Forest_Idle","east"),("sheets/streetwear/heroes/archangel/Walk","east"),
      ("sheets/streetwear/heroes/elowen/Walk","east"),("sheets/streetwear/heroes/velkhar/Idle","east"),("sheets/streetwear/heroes/corvus/Idle","east"),
      ("sheets/streetwear/boss/oni/Idle","east"),("sheets/cast/heroes/frost-lich/Hover_Idle","east"),("sheets/streetwear/auras/thunder/behind","x"),("sheets/streetwear/heroes/frost-lich/Idle","east")]
    for i,(k,d) in enumerate(jobs,1):
        tag=f"{i:02d}_"+k.replace('sheets/','').replace('/','_')+f"_{d}"
        print(tag,render(k,d,outdir,tag))
