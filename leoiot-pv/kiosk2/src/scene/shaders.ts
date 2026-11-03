// Shader des Films. Licht „Morgenglut“ (design D8): Himmel, Nebel und Berge rechnen mit derselben Sonne.
import { COLS } from '../core/yearData';
import { HEIGHT, PAD, ROW, WIDTH } from '../core/world';

const f = (v: number) => v.toFixed(4);

export const heightFn = (rows: number) => `
  uniform sampler2D uH; uniform float uDay,uFast;
  float L(float r,float u){ return texture(uH,vec2((u*${f(COLS - 1)}+.5)/${f(COLS)},(r+${f(PAD)}+.5)/${f(rows)})).r; }
  float G(float r,float u){ float k=clamp((uDay-r-u*(1.-uFast)-uFast*1.6)/(.05+uFast*1.6)+1.,0.,1.); return k*k*(3.-2.*k); }`;

const palette = `
  const vec3 TOP=vec3(.035,.055,.1);
  const vec3 MID=vec3(.07,.14,.2);
  const vec3 HOR=vec3(.72,.5,.38);
  const vec3 GLOW=vec3(1.,.55,.25);
  const vec3 SUNC=vec3(.95,.55,.3);
  const vec3 AMB=vec3(.14,.22,.3);
  const vec3 FOGLO=vec3(.06,.12,.17);
  const vec3 FOGHI=vec3(.3,.3,.33);
  const vec3 ALBLO=vec3(.045,.065,.125);
  const vec3 ALBHI=vec3(.46,.34,.38);
  const vec3 NIGHT=vec3(.05,.08,.13);`;

// Himmel, Nebelmeer unter dem Horizont und Tonwerte, gemeinsam für Hintergrund und Berge
const air = `
  uniform sampler2D uFog; uniform vec2 uPhase; uniform vec3 uCam,uL; uniform float uDusk;
  vec3 skyAt(vec3 ray){
    float y=max(ray.y,0.);
    vec3 col=mix(HOR,MID,smoothstep(0.,.2,y));
    col=mix(col,TOP,smoothstep(.12,.62,y));
    float s=max(dot(ray,uL),0.);
    col+=GLOW*(pow(s,26.)*.42+pow(s,5.)*.2*(1.-y))*(1.-uDusk);
    if(ray.y>.012){
      vec2 p=ray.xz/(ray.y+.09)*.17+uPhase*.012;
      float cl=texture(uFog,p).r*.7+texture(uFog,p*2.7).r*.36;
      float wisp=smoothstep(.5,.76,cl)*smoothstep(.015,.13,y)*(1.-smoothstep(.34,.72,y));
      col=mix(col,mix(MID*1.12,GLOW*.95+HOR*.2,pow(s,2.5)),wisp*.62*(1.-uDusk*.7));
    }
    return mix(col,mix(NIGHT,vec3(.012,.02,.04),smoothstep(0.,.5,y)),uDusk);
  }
  vec3 fogAt(vec3 ray){
    float t=(uCam.y-1.1)/max(-ray.y,.012);
    vec2 p=uCam.xz+ray.xz*t;
    vec2 q=p*.016+uPhase*.03;
    float a=texture(uFog,q).r;
    float b=texture(uFog,q*3.3+a*.4-uPhase*.04).r;
    float far=smoothstep(35.,120.,t);
    float n=mix(a*.68+b*.42,a*.5+.27,far);
    float slope=texture(uFog,q+uL.xz*.025).r-a;
    float lit=clamp(.5+slope*7.*(1.-far),0.,1.);
    float s=pow(max(dot(ray,uL),0.),5.);
    vec3 col=mix(FOGLO,FOGHI,smoothstep(.3,.82,n)*(.55+.8*lit));
    col+=GLOW*s*.45*smoothstep(.3,.8,n)*(1.-uDusk);
    return mix(col,NIGHT*(.7+.6*n),uDusk);
  }
  vec3 groundAt(vec3 ray){ return mix(skyAt(normalize(vec3(ray.x,0.,ray.z))),fogAt(ray),smoothstep(0.,.17,-ray.y)); }
  vec3 tone(vec3 c){ return 1.-exp(-c*1.5); }`;

export const skyVertex = `out vec2 vP; uniform float uAspect; void main(){ vP=position.xy*vec2(uAspect,1.); gl_Position=vec4(position.xy,.9999,1.); }`;

export const skyFragment = `precision highp float; in vec2 vP; out vec4 c;
  uniform vec3 uFwd,uRight,uUp; uniform float uTan; ${palette} ${air}
  float rnd(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main(){
    vec3 ray=normalize(uFwd+(uRight*vP.x+uUp*vP.y)*uTan);
    vec3 col=ray.y>0.?skyAt(ray):groundAt(ray);
    if(uDusk>.01){ float s=step(.9985,rnd(floor(vP*340.))); col+=vec3(.78,.86,1.)*s*uDusk*smoothstep(.04,.3,ray.y); }
    c=vec4(tone(col)+(rnd(gl_FragCoord.xy)-.5)*.018,1.);
  }`;

export const mountainVertex = (rows: number) => `in float aRow,aU; out vec3 vW,vN; out float vRow,vLvl,vLag; ${heightFn(rows)}
  float H(float r,float u){
    float wave=uDay-u*(1.-uFast)-uFast*1.6;
    float skirt=r>wave?L(wave,u)*exp(-(r-wave)*.85)*smoothstep(-.1,.05,wave):0.;
    return max(L(r,u)*G(r,u),skirt)*${f(HEIGHT)};
  }
  void main(){
    float du=1./${f(COLS - 1)};
    vec3 p=position; p.y=H(aRow,aU);
    float hx=(H(aRow,aU+du)-H(aRow,aU-du))/(2.*du)/-${f(WIDTH)};
    float hz=(H(aRow+1.,aU)-H(aRow-1.,aU))/2./-${f(ROW)};
    vN=normalize(vec3(-hx,1.,-hz));
    vW=p; vRow=aRow; vLvl=L(aRow,aU); vLag=uDay-aRow-aU;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }`;

export const mountainFragment = (rows: number) => `precision highp float; in vec3 vW,vN; in float vRow,vLvl,vLag; out vec4 c;
  uniform vec3 uPen,uLit; uniform float uPenA,uShadows,uBest,uBestOn,uMile,uMileOn; ${heightFn(rows)} ${palette} ${air}
  float shadow(vec3 w){
    if(uShadows<.5) return 1.;
    float sh=1.,s=.35;
    for(int i=0;i<7;i++){
      vec3 p=w+uLit*s;
      float r=-p.z/${f(ROW)}, u=.5-p.x/${f(WIDTH)};
      if(u<0.||u>1.) break;
      float h=L(r,u)*G(r,u)*${f(HEIGHT)};
      sh=min(sh,1.-smoothstep(-.02,.5,h-p.y));
      s*=1.7;
      if(p.y>${f(HEIGHT)}) break;
    }
    return sh;
  }
  void main(){
    float y=vW.y;
    if(y<.015) discard;
    vec3 n=normalize(vN), ray=normalize(vW-uCam), v=-ray;
    float hl=smoothstep(.04,.75,vLvl);
    vec3 albedo=mix(ALBLO,ALBHI,hl);
    float sh=shadow(vW+n*.04);
    float d=max(dot(n,uLit),0.)*sh;
    vec3 sunLight=SUNC*(1.-uDusk*.92);
    vec3 col=albedo*(AMB*(.55+.45*n.y)+sunLight*d*1.35);
    float through=pow(max(dot(ray,uLit),0.),6.);
    col+=sunLight*pow(1.-max(dot(n,v),0.),4.)*through*.8*sh;
    col+=GLOW*exp(-max(vLag,0.)*3.)*.06*hl;
    float best=exp(-pow((vRow-uBest)*1.25,2.)), mile=exp(-pow((vRow-uMile)*1.25,2.));
    float spot=max(best*uBestOn,mile*uMileOn);
    col*=1.-.55*max(uBestOn,uMileOn)*(1.-spot);
    col+=GLOW*spot*(.05+.22*hl);
    float pd=length(vW-uPen);
    col+=GLOW*exp(-pd*pd*.8)*.22*uPenA;
    col=mix(col,mix(HOR,NIGHT,uDusk),smoothstep(20.,120.,length(vW-uCam))*.85);
    float e=.9+1.3*texture(uFog,vW.xz*.05+uPhase*.02).r;
    col=mix(groundAt(ray),col,smoothstep(0.,e,y));
    c=vec4(tone(col),1.);
  }`;
