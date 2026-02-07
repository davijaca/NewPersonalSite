import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import styles from './App.module.scss';
import {
  createEmptyTexture,
  loadTextureFromURL,
  MultiPassRenderer,
  updateVideoTexture,
} from './utils/GLUtils';
import VertexShader from './shaders/vertex.glsl?raw';
import FragmentBgShader from './shaders/fragment-bg.glsl?raw';
import FragmentBgVblurShader from './shaders/fragment-bg-vblur.glsl?raw';
import FragmentBgHblurShader from './shaders/fragment-bg-hblur.glsl?raw';
import FragmentMainShader from './shaders/fragment-main.glsl?raw';
import { Controller } from '@react-spring/web';

// import { useResizeObserver } from './utils/useResizeOberver';
import clsx from 'clsx';
import { capitalize, computeGaussianKernelByRadius } from './utils';

import bgGrid from '@/assets/bg-grid.png';
import bgBars from '@/assets/bg-bars.png';
import bgHalf from '@/assets/bg-half.png';
import bgTimcook from '@/assets/bg-timcook.png';
import bgUI from '@/assets/bg-ui.svg';
import bgTahoeLightImg from '@/assets/bg-tahoe-light.webp';
import bgText from '@/assets/bg-text.jpg';
import bgBuildings from '@/assets/bg-buildings.png';
import bgVideoFish from '@/assets/bg-video-fish.mp4';
import bgVideo2 from '@/assets/bg-video-2.mp4';
import bgVideo3 from '@/assets/bg-video-3.mp4';

import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { useLevaControls } from './Controls';


function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasInfo, setCanvasInfo] = useState<{ width: number; height: number; dpr: number }>({
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
  });
  const [showControls, setShowControls] = useState(false);
  const { controls, langName, levaGlobal } = useLevaControls({
    hideLeva: !showControls,
    containerRender: {
      /* eslint-disable react-hooks/rules-of-hooks */
      bgType: ({ value, setValue }) => {
        const [customFileType, setCustomFileType] = useState<null | 'image' | 'video'>(null);
        const [customFile, setCustomFile] = useState<null | File>(null);
        const [customFileUrl, setCustomFileUrl] = useState<null | string>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);

        return (
          <div className={styles.bgSelect}>
            {[
              { v: 11, media: '', loadTexture: true, type: 'custom' as const },
              { v: 0, media: bgGrid, loadTexture: false },
              { v: 1, media: bgBars, loadTexture: false },
              { v: 2, media: bgHalf, loadTexture: false },
              { v: 3, media: bgTahoeLightImg, loadTexture: true },
              { v: 4, media: bgBuildings, loadTexture: true },
              { v: 5, media: bgText, loadTexture: true },
              { v: 6, media: bgTimcook, loadTexture: true },
              { v: 7, media: bgUI, loadTexture: true },
              { v: 8, media: bgVideoFish, loadTexture: true, type: 'video' as const },
              { v: 9, media: bgVideo2, loadTexture: true, type: 'video' as const },
              { v: 10, media: bgVideo3, loadTexture: true, type: 'video' as const },
            ].map(({ v, media, loadTexture, type }) => {
              const mediaType = type === 'custom' ? customFileType : (type ?? 'image');
              const mediaUrl = type === 'custom' ? customFileUrl : media;
              return (
                <div
                  className={clsx(
                    styles.bgSelectItem,
                    styles[`bgSelectItemType${capitalize(type ?? 'image')}`],
                    {
                      [styles.bgSelectItemActive]: value === v,
                    },
                  )}
                  // style={{ backgroundImage: !type ? `url(${media})` : '' }}
                  key={v}
                  onClick={() => {
                    if (type === 'custom') {
                      if (!mediaUrl) {
                        fileInputRef.current?.click();
                      } else if (value === v) {
                        fileInputRef.current?.click();
                      }
                    }
                    setValue(v);
                    if (loadTexture && mediaUrl) {
                      stateRef.current.bgTextureUrl = mediaUrl;
                      if (mediaType === 'video') {
                        stateRef.current.bgTextureType = 'video';
                      } else {
                        stateRef.current.bgTextureType = 'image';
                      }
                    } else {
                      stateRef.current.bgTextureUrl = null;
                      stateRef.current.bgTextureReady = false;
                    }
                  }}
                >
                  {mediaUrl &&
                    (mediaType === 'video' ? (
                      <video
                        playsInline
                        muted={true}
                        loop
                        className={styles.bgSelectItemVideo}
                        ref={(ref) => {
                          if (ref) {
                            stateRef.current.bgVideoEls.set(v, ref);
                          } else {
                            stateRef.current.bgVideoEls.delete(v);
                          }
                        }}
                      >
                        <source src={mediaUrl}></source>
                      </video>
                    ) : mediaType === 'image' ? (
                      <img src={mediaUrl} className={styles.bgSelectItemImg} />
                    ) : null)}
                  {type === 'custom' ? (
                    <>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        ref={fileInputRef}
                        multiple={false}
                        onChange={(e) => {
                          if (!e.target.files?.[0]) {
                            return;
                          }
                          setCustomFile(e.target.files[0]);
                          if (customFileUrl) {
                            URL.revokeObjectURL(customFileUrl);
                          }
                          const newUrl = URL.createObjectURL(e.target.files[0]);
                          setCustomFileUrl(newUrl);
                          const fileType = e.target.files[0].type.startsWith('image/')
                            ? 'image'
                            : 'video';
                          setCustomFileType(fileType);
                          setValue(v);
                          stateRef.current.bgTextureUrl = newUrl;
                          if (fileType === 'video') {
                            stateRef.current.bgTextureType = 'video';
                          } else {
                            stateRef.current.bgTextureType = 'image';
                          }
                        }}
                      ></input>
                      <FileUploadOutlinedIcon />
                    </>
                  ) : null}
                  <div
                    className={clsx(
                      styles.bgSelectItemOverlay,
                      styles[`bgSelectItemOverlay${capitalize(type ?? 'image')}`],
                    )}
                  >
                    {mediaType === 'video' && (
                      <PlayCircleOutlinedIcon
                        className={styles.bgSelectItemVideoIcon}
                        style={{
                          opacity: value !== v ? 1 : 0,
                        }}
                      />
                    )}
                    {type === 'custom' && (
                      <div className={styles.bgSelectItemCustomIcon}>
                        <FileUploadOutlinedIcon />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      },
      /* eslint-enable react-hooks/rules-of-hooks */
    },
  });

  const stateRef = useRef<{
    renderRaf: number | null;
    canvasInfo: typeof canvasInfo;
    glStates: {
      gl: WebGL2RenderingContext;
      programs: Record<string, WebGLProgram>;
      vao: WebGLVertexArrayObject;
    } | null;
    canvasPointerPos: { x: number; y: number };
    controls: typeof controls;
    blurWeights: number[];
    lastMouseSpringValue: { x: number; y: number };
    lastMouseSpringTime: null | number;
    mouseSpring: Controller<{ x: number; y: number }>;
    mouseSpringSpeed: { x: number; y: number };
    bgTextureUrl: string | null;
    bgTexture: WebGLTexture | null;
    bgTextureRatio: number;
    bgTextureType: 'image' | 'video' | null;
    bgTextureReady: boolean;
    bgVideoEls: Map<number, HTMLVideoElement>;
    langName: typeof langName;
  }>({
    renderRaf: null,
    glStates: null,
    canvasInfo,
    canvasPointerPos: {
      x: 0,
      y: 0,
    },
    controls,
    blurWeights: [],
    lastMouseSpringValue: {
      x: 0,
      y: 0,
    },
    lastMouseSpringTime: null,
    mouseSpring: new Controller({
      x: 0,
      y: 0,
      onChange: (c) => {
        if (!stateRef.current.lastMouseSpringTime) {
          stateRef.current.lastMouseSpringTime = Date.now();
          stateRef.current.lastMouseSpringValue = c.value;
          return;
        }

        const now = Date.now();
        const lastValue = stateRef.current.lastMouseSpringValue;
        const dt = now - stateRef.current.lastMouseSpringTime;
        const dx = {
          x: c.value.x - lastValue.x,
          y: c.value.y - lastValue.y,
        };
        const speed = {
          x: dx.x / dt,
          y: dx.y / dt,
        };

        if (Math.abs(speed.x) > 1e10 || Math.abs(speed.y) > 1e10) {
          speed.x = 0;
          speed.y = 0;
        }

        stateRef.current.mouseSpringSpeed = speed;

        stateRef.current.lastMouseSpringValue = c.value;
        stateRef.current.lastMouseSpringTime = now;
      },
    }),
    mouseSpringSpeed: {
      x: 0,
      y: 0,
    },
    bgTextureUrl: null,
    bgTexture: null,
    bgTextureRatio: 1,
    bgTextureType: null,
    bgTextureReady: false,
    bgVideoEls: new Map(),
    langName: langName,
  });
  stateRef.current.canvasInfo = canvasInfo;
  stateRef.current.controls = controls;
  stateRef.current.langName = langName;

  // useEffect(() => {
  //   setLangName(controls.language[0] as keyof typeof languages);
  // }, [controls.language]);

  // console.log(controls.language);

  useMemo(() => {
    stateRef.current.blurWeights = computeGaussianKernelByRadius(controls.blurRadius);
  }, [controls.blurRadius]);

  useLayoutEffect(() => {
    const onResize = () => {
      setCanvasInfo({
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
      });
    };
    window.addEventListener('resize', onResize);
    onResize();

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useLayoutEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    canvasRef.current.width = canvasInfo.width * canvasInfo.dpr;
    canvasRef.current.height = canvasInfo.height * canvasInfo.dpr;
  }, [canvasInfo]);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const canvasEl = canvasRef.current;
    const onPointerMove = (e: PointerEvent) => {
      const canvasInfo = stateRef.current.canvasInfo;
      if (!canvasInfo) {
        return;
      }
      const rect = canvasEl.getBoundingClientRect();
      stateRef.current.canvasPointerPos = {
        x: (e.clientX - rect.left) * canvasInfo.dpr,
        y:
          (stateRef.current.canvasInfo.height - (e.clientY - rect.top)) * canvasInfo.dpr,
      };
      stateRef.current.mouseSpring.start({
        ...stateRef.current.canvasPointerPos,
        immediate: true,
      });
    };
    document.addEventListener('pointermove', onPointerMove, true);

    const gl = canvasEl.getContext('webgl2');
    if (!gl) {
      return;
    }

    const renderer = new MultiPassRenderer(canvasEl, [
      {
        name: 'bgPass',
        shader: {
          vertex: VertexShader,
          fragment: FragmentBgShader,
        },
      },
      {
        name: 'vBlurPass',
        shader: {
          vertex: VertexShader,
          fragment: FragmentBgVblurShader,
        },
        inputs: {
          u_prevPassTexture: 'bgPass',
        },
      },
      {
        name: 'hBlurPass',
        shader: {
          vertex: VertexShader,
          fragment: FragmentBgHblurShader,
        },
        inputs: {
          u_prevPassTexture: 'vBlurPass',
        },
      },
      {
        name: 'mainPass',
        shader: {
          vertex: VertexShader,
          fragment: FragmentMainShader,
        },
        inputs: {
          u_blurredBg: 'hBlurPass',
          u_bg: 'bgPass',
        },
        outputToScreen: true,
      },
    ]);

    let raf: number | null = null;
    const lastState = {
      canvasInfo: null as typeof canvasInfo | null,
      controls: null as typeof controls | null,
      bgTextureType: null as typeof stateRef.current.bgTextureType,
      bgTextureUrl: null as typeof stateRef.current.bgTextureUrl,
    };
    const render = () => {
      raf = requestAnimationFrame(render);

      const canvasInfo = stateRef.current.canvasInfo;
      const textureUrl = stateRef.current.bgTextureUrl;
      if (
        !lastState.canvasInfo ||
        lastState.canvasInfo.width !== canvasInfo.width ||
        lastState.canvasInfo.height !== canvasInfo.height ||
        lastState.canvasInfo.dpr !== canvasInfo.dpr
      ) {
        gl.viewport(
          0,
          0,
          Math.round(canvasInfo.width * canvasInfo.dpr),
          Math.round(canvasInfo.height * canvasInfo.dpr),
        );
        renderer.resize(canvasInfo.width * canvasInfo.dpr, canvasInfo.height * canvasInfo.dpr);
        renderer.setUniform('u_resolution', [
          canvasInfo.width * canvasInfo.dpr,
          canvasInfo.height * canvasInfo.dpr,
        ]);
      }
      if (textureUrl !== lastState.bgTextureUrl) {
        if (lastState.bgTextureType === 'video') {
          if (lastState.controls?.bgType !== undefined) {
            stateRef.current.bgVideoEls.get(lastState.controls.bgType)?.pause();
          }
        }
        if (!textureUrl) {
          if (stateRef.current.bgTexture) {
            gl.deleteTexture(stateRef.current.bgTexture);
            stateRef.current.bgTexture = null;
            stateRef.current.bgTextureType = null;
          }
        } else {
          if (stateRef.current.bgTextureType === 'image') {
            const rafId = requestAnimationFrame(() => {
              stateRef.current.bgTextureReady = false;
            });
            loadTextureFromURL(gl, textureUrl).then(({ texture, ratio }) => {
              if (stateRef.current.bgTextureUrl === textureUrl) {
                cancelAnimationFrame(rafId);
                stateRef.current.bgTexture = texture;
                stateRef.current.bgTextureRatio = ratio;
                stateRef.current.bgTextureReady = true;
              }
            });
          } else if (stateRef.current.bgTextureType === 'video') {
            stateRef.current.bgTextureReady = false;
            stateRef.current.bgTexture = createEmptyTexture(gl);
            stateRef.current.bgVideoEls.get(stateRef.current.controls.bgType)?.play();
          }
        }
      }
      lastState.controls = stateRef.current.controls;
      lastState.bgTextureType = stateRef.current.bgTextureType;
      lastState.canvasInfo = canvasInfo;
      lastState.bgTextureUrl = stateRef.current.bgTextureUrl;

      if (stateRef.current.bgTextureType === 'video') {
        const videoEl = stateRef.current.bgVideoEls.get(stateRef.current.controls.bgType);
        if (stateRef.current.bgTexture && videoEl) {
          const info = updateVideoTexture(gl, stateRef.current.bgTexture, videoEl);

          if (info) {
            stateRef.current.bgTextureRatio = info.ratio;
            stateRef.current.bgTextureReady = true;
          }
        }
      }

      const controls = stateRef.current.controls;
      const mouseSpring = stateRef.current.mouseSpring.get();

      const shapeSizeSpring = {
        x:
          controls.shapeWidth +
          (Math.abs(stateRef.current.mouseSpringSpeed.x) *
            controls.shapeWidth *
            controls.springSizeFactor) /
          100,
        y:
          controls.shapeHeight +
          (Math.abs(stateRef.current.mouseSpringSpeed.y) *
            controls.shapeHeight *
            controls.springSizeFactor) /
          100,
      };

      renderer.setUniforms({
        u_resolution: [canvasInfo.width * canvasInfo.dpr, canvasInfo.height * canvasInfo.dpr],
        u_dpr: canvasInfo.dpr,
        u_blurWeights: stateRef.current.blurWeights,
        u_blurRadius: stateRef.current.controls.blurRadius,
        u_mouse: [stateRef.current.canvasPointerPos.x, stateRef.current.canvasPointerPos.y],
        u_mouseSpring: [mouseSpring.x, mouseSpring.y],
        u_shapeWidth: shapeSizeSpring.x,
        u_shapeHeight: shapeSizeSpring.y,
        u_shapeRadius:
          ((Math.min(shapeSizeSpring.x, shapeSizeSpring.y) / 2) * controls.shapeRadius) / 100,
        u_shapeRoundness: controls.shapeRoundness,
        u_mergeRate: controls.mergeRate,
        u_glareAngle: (controls.glareAngle * Math.PI) / 180,
        u_showShape1: controls.showShape1 ? 1 : 0,
      });

      renderer.render({
        bgPass: {
          u_bgType: controls.bgType,
          u_bgTexture: (stateRef.current.bgTextureUrl && stateRef.current.bgTexture) ?? undefined,
          u_bgTextureRatio:
            stateRef.current.bgTextureUrl && stateRef.current.bgTexture
              ? stateRef.current.bgTextureRatio
              : undefined,
          u_bgTextureReady: stateRef.current.bgTextureReady ? 1 : 0,
          u_shadowExpand: controls.shadowExpand,
          u_shadowFactor: controls.shadowFactor / 100,
          u_shadowPosition: [-controls.shadowPosition.x, -controls.shadowPosition.y],
        },
        mainPass: {
          u_tint: [
            controls.tint.r / 255,
            controls.tint.g / 255,
            controls.tint.b / 255,
            controls.tint.a,
          ],
          u_refThickness: controls.refThickness,
          u_refFactor: controls.refFactor,
          u_refDispersion: controls.refDispersion,
          u_refFresnelRange: controls.refFresnelRange,
          u_refFresnelHardness: controls.refFresnelHardness / 100,
          u_refFresnelFactor: controls.refFresnelFactor / 100,
          u_glareRange: controls.glareRange,
          u_glareHardness: controls.glareHardness / 100,
          u_glareConvergence: controls.glareConvergence / 100,
          u_glareOppositeFactor: controls.glareOppositeFactor / 100,
          u_glareFactor: controls.glareFactor / 100,
          u_blurEdge: controls.blurEdge ? 1 : 0,
          STEP: controls.step,
        },
      });
    };
    raf = requestAnimationFrame(render);

    return () => {
      document.removeEventListener('pointermove', onPointerMove, true);
      if (raf) {
        cancelAnimationFrame(raf);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <>
      {levaGlobal}
      <button
        type="button"
        className={styles.controlsToggleFloating}
        onClick={() => setShowControls((prev) => !prev)}
      >
        {showControls ? 'Hide controls' : 'Show controls'}
      </button>
      <section className={styles.hero}>
        <div className={clsx(styles.canvasContainer)}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            style={
              {
                ['--dpr']: canvasInfo.dpr,
              } as CSSProperties
            }
          />
        </div>
        <model-viewer
          class={styles.heroModel}
          src="/Final.glb"
          camera-controls
          autoplay
          auto-rotate
          animation-name="*"
          disable-zoom
          disable-pan
          shadow-intensity="0.6"
          exposure="1.1"
          environment-image="neutral"
        ></model-viewer>
      </section>
      <section className={styles.scrollSection}>
        <div className={styles.scrollSectionInner}>
          <h2>Davi Bentim</h2>
          <p>Web Developer / UI UX Designer</p>
          <ul className={styles.simpleList}>
            <li>Full Name: Davi Martins Bentim</li>
            <li>Phone: +1 (208) 750-8500</li>
            <li>Email: davi.bentim@gmail.com</li>
            <li>Github: github.com/davijaca</li>
          </ul>

          <h2>About</h2>
          <p>
            Davi Martins Bentim is a Brazilian full stack web developer and UI/UX designer currently
            living in the United States, with a passion for creating beautiful and functional
            websites.
          </p>
          <p>
            He completed the MIT xPro MERN Stack Development program in 2022 and is currently
            pursuing a Bachelors degree in Web Development at the University of Europe for Applied
            Sciences.
            He has been working as a freelance developer and designer and is employed at Smatched
            (Heidelberg, Germany) since August 2023.
          </p>

          <h2>Experience</h2>
          <div className={styles.timeline}>
            <div className={styles.timelineItem}>
              <h3>Lead Project Manager</h3>
              <p>Smatched - 2023 to present</p>
              <ul>
                <li>Led rebuilds of smatched.io and offerwallmonetization.com.</li>
                <li>Coordinated with SEO and design teams to align deliverables.</li>
                <li>Managed a team of up to five interns and ensured on-time delivery.</li>
                <li>Maintained quality standards and project requirements.</li>
              </ul>
            </div>
            <div className={styles.timelineItem}>
              <h3>Front End Web Developer</h3>
              <p>Smatched - 2023 to present</p>
              <ul>
                <li>Migrated Smatched from WordPress/Elementor to React.</li>
                <li>Managed GitHub and GitLab repositories and documentation.</li>
                <li>Performed code reviews and provided technical support.</li>
              </ul>
            </div>
            <div className={styles.timelineItem}>
              <h3>Freelance Full Stack Developer</h3>
              <p>Self-employed - 2020 to present</p>
              <ul>
                <li>
                  Built and maintained websites for small businesses in the Brazilian community in
                  the Salt Lake City area.
                </li>
              </ul>
            </div>
          </div>

          <h2>Education</h2>
          <ul className={styles.simpleList}>
            <li>
              University of Europe for Applied Sciences - Bachelors Degree (2023 to present),
              Game Design BA, second semester online
            </li>
            <li>
              Massachussetts Institute of Technology - MERN Stack Development (2021 to 2022),
              highest grades across projects including the capstone, 3.7 GPA
            </li>
            <li>EEEM Padre Reus - High School (2010)</li>
          </ul>

          <h2>Skills</h2>
          <div className={styles.skillGrid}>
            <div>HTML5 - 95%</div>
            <div>CSS3 - 95%</div>
            <div>React.js - 90%</div>
            <div>JavaScript - 90%</div>
            <div>MongoDB - 85%</div>
            <div>WordPress - 90%</div>
            <div>UI/UX - 90%</div>
            <div>Design - 90%</div>
            <div>Figma - 70%</div>
          </div>

          <h2>Hire Me</h2>
          <p>Open to new opportunities and freelance work.</p>
          <p>Contact us to discuss projects and collaborations.</p>

          <h2>Contact</h2>
          <div className={styles.contactGrid}>
            <div>
              <strong>Phone</strong>
              <div>+1 (208) 750-8500</div>
            </div>
            <div>
              <strong>Email</strong>
              <div>davi.bentim@gmail.com</div>
            </div>
            <div>
              <strong>GitHub</strong>
              <div>github.com/davijaca</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default App;
