// The hero sky: a small WebGL fragment shader painting slow, warm clouds.
// Falls back to the canvas's CSS gradient if WebGL is unavailable. Pauses when
// off-screen and renders a single still frame for reduced-motion visitors.

const FRAG = `
precision mediump float;
uniform vec2 r; uniform float t; uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  float asp=r.x/r.y;
  vec2 p=vec2(uv.x*max(asp,.75),uv.y);
  vec3 top=vec3(.62,.71,.80), mid=vec3(.80,.84,.88), warm=vec3(.95,.84,.77), bot=vec3(.969,.953,.933);
  vec3 col=mix(bot,warm,smoothstep(0.,.38,uv.y));
  col=mix(col,mid,smoothstep(.38,.68,uv.y));
  col=mix(col,top,smoothstep(.68,1.05,uv.y));
  vec2 sp=vec2(.74*max(asp,.75),.36);
  col+=vec3(.98,.58,.40)*.20*exp(-length(p-sp)*2.6);
  vec2 q=p*1.45+vec2(t*.010,0.)+m*.025;
  float c=fbm(q+fbm(q*.55+vec2(t*.004,0.)));
  float band=smoothstep(.12,.5,uv.y)*smoothstep(1.1,.6,uv.y);
  float cl=smoothstep(.46,.84,c)*(.45+.55*band);
  vec3 lit=vec3(1.,.985,.965), shade=vec3(.90,.85,.86);
  vec3 cc=mix(lit,shade,smoothstep(.62,1.,c)*.7);
  cc=mix(cc,vec3(1.,.9,.84),.25*exp(-length(p-sp)*1.8));
  col=mix(col,cc,cl*.92);
  float c2=fbm(p*3.+vec2(t*.022,t*.003)+m*.05);
  col=mix(col,vec3(1.),smoothstep(.56,.92,c2)*.30*band);
  gl_FragColor=vec4(col,1.);
}`;
const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

export function initSky(canvas, { reduced }) {
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  if (!gl) return;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VERT);
  const fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, 'r');
  const uT = gl.getUniformLocation(prog, 't');
  const uM = gl.getUniformLocation(prog, 'm');

  // Render at reduced resolution: clouds are soft, so this is invisible and cheap.
  const scale = Math.min(window.devicePixelRatio || 1, 2) * (innerWidth < 768 ? 0.5 : 0.6);
  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  };
  new ResizeObserver(() => { resize(); if (reduced) draw(40); }).observe(canvas);

  const mouse = [0, 0], target = [0, 0];
  if (!reduced && matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => { target[0] = e.clientX / innerWidth - 0.5; target[1] = e.clientY / innerHeight - 0.5; }, { passive: true });
  }
  const t0 = performance.now() - 40000;
  function draw(t) {
    mouse[0] += (target[0] - mouse[0]) * 0.03;
    mouse[1] += (target[1] - mouse[1]) * 0.03;
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, t);
    gl.uniform2f(uM, mouse[0], -mouse[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  resize();
  canvas.classList.add('live');
  if (reduced) { draw(40); return; }

  let raf = 0, inView = true;
  const running = () => inView && !document.hidden;
  const loop = (now) => { draw((now - t0) / 1000); raf = running() ? requestAnimationFrame(loop) : 0; };
  const wake = () => { if (running() && !raf) raf = requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; wake(); }).observe(canvas);
  document.addEventListener('visibilitychange', wake);
  raf = requestAnimationFrame(loop);
}
