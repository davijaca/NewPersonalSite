import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import styles from './App.module.scss';
import FragmentMainShader from './shaders/fragment-main.glsl?raw';
import { Controller } from '@react-spring/web';

// import { useResizeObserver } from './utils/useResizeOberver';
import clsx from 'clsx';
import { capitalize, computeGaussianKernelByRadius } from './utils';
import FragmentBgShader from './shaders/fragment-bg.glsl?raw';
import FragmentBgVblurShader from './shaders/fragment-bg-vblur.glsl?raw';
import FragmentBgHblurShader from './shaders/fragment-bg-hblur.glsl?raw';

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
import bgVideo4 from '@/assets/bg-video-4.mp4';
import bgMoon from '@/assets/bg-moon.mp4';
import bgStars from '@/assets/bg-stars.mp4';


import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { useLevaControls } from './Controls';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LiquidGlassBubble } from './components/LiquidGlassBubble';

const ScreenVertexShader = `
precision highp float;
in vec3 position;
out vec2 v_uv;
void main() {
  v_uv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position, 1.0);
}
`;

const contentBubbles = [
  { x: -265, y: 0, size: 1 },
  { x: 180, y: 160, size: 0.82 },
  { x: -40, y: 330, size: 1.18 },
  { x: 285, y: 520, size: 0.95 },
  { x: -320, y: 720, size: 1.42 },
  { x: 95, y: 910, size: 1.08 },
  { x: -170, y: 1120, size: 0.74 },
  { x: 250, y: 1340, size: 1.28 },
  { x: -285, y: 1580, size: 0.9 },
  { x: 20, y: 1840, size: 1.5 },
];

const getBubbleSidePosition = (index: number) =>
  index % 2 === 0 ? 'calc(-50vw + 96px)' : 'calc(50vw - 96px)';

function App() {
  const baseViewportWidthRef = useRef(window.innerWidth);
  const baseViewportHeightRef = useRef(window.innerHeight);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollSectionRef = useRef<HTMLElement>(null);
  const contentStackRef = useRef<HTMLDivElement>(null);
  const contentStackReleaseRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const hasFinishedInitialLoad = useRef(false);
  const [canvasInfo, setCanvasInfo] = useState<{ width: number; height: number; dpr: number }>({
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
  });
  const [showControls, setShowControls] = useState(false);
  const [areContentBubblesVisible, setAreContentBubblesVisible] = useState(true);
  const [areContentBubblesFrozen, setAreContentBubblesFrozen] = useState(false);
  const [areContentBubblesAtSides, setAreContentBubblesAtSides] = useState(false);
  const { controls, langName, levaGlobal } = useLevaControls({
    hideLeva: !showControls || isLoading,
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
              { v: 10, media: bgVideo4, loadTexture: true, type: 'video' as const },
              { v: 12, media: bgMoon, loadTexture: true, type: 'video' as const },
              { v: 13, media: bgStars, loadTexture: true, type: 'video' as const },
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
                      stateRef.current.bgTextureType = mediaType === 'video' ? 'video' : 'image';
                    } else {
                      stateRef.current.bgTextureUrl = null;
                      stateRef.current.bgTextureType = null;
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
                          stateRef.current.bgTextureType = fileType;
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
    canvasPointerPos: { x: number; y: number };
    controls: typeof controls;
    blurWeights: Float32Array;
    modelRoot: THREE.Object3D | null;
    model: THREE.Object3D | null;
    modelCenter: THREE.Vector3 | null;
    lastCameraSettings: {
      orbitTheta: number;
      orbitPhi: number;
      orbitRadius: number;
    };
    lastMouseSpringValue: { x: number; y: number };
    lastMouseSpringTime: null | number;
    mouseSpring: Controller<{ x: number; y: number }>;
    mouseSpringSpeed: { x: number; y: number };
    bgTextureUrl: string | null;
    bgTexture: THREE.Texture | null;
    bgTextureRatio: number;
    bgTextureType: 'image' | 'video' | null;
    bgTextureReady: boolean;
    bgVideoEls: Map<number, HTMLVideoElement>;
    langName: typeof langName;
    materialTweakTargets: Array<{
      material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
      baseMetalness: number;
      baseRoughness: number;
      baseEnvMapIntensity: number;
    }>;
  }>({
    renderRaf: null,
    canvasInfo,
    canvasPointerPos: {
      x: 0,
      y: 0,
    },
    controls,
    blurWeights: new Float32Array(201),
    modelRoot: null,
    model: null,
    modelCenter: null,
    lastCameraSettings: {
      orbitTheta: Number.NaN,
      orbitPhi: Number.NaN,
      orbitRadius: Number.NaN,
    },
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
    materialTweakTargets: [],
  });
  stateRef.current.canvasInfo = canvasInfo;
  stateRef.current.controls = controls;
  stateRef.current.langName = langName;

  // useEffect(() => {
  //   setLangName(controls.language[0] as keyof typeof languages);
  // }, [controls.language]);

  // console.log(controls.language);

  useMemo(() => {
    const weights = computeGaussianKernelByRadius(controls.blurRadius);
    const arr = new Float32Array(201);
    arr.set(weights);
    stateRef.current.blurWeights = arr;
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
    document.body.classList.toggle('app-loading', isLoading);
    return () => {
      document.body.classList.remove('app-loading');
    };
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    let stackFrame = 0;

    const updateStackRelease = () => {
      stackFrame = 0;
      const stack = contentStackRef.current;
      const release = contentStackReleaseRef.current;
      if (!stack || !release) {
        return;
      }

      const releaseRect = release.getBoundingClientRect();
      const start = window.innerHeight * 0.72;
      const end = window.innerHeight * 0.18;
      const progress = Math.min(1, Math.max(0, (start - releaseRect.top) / (start - end)));
      const translateY = -progress * window.innerHeight * 0.52;
      stack.style.setProperty('--stack-release-y', `${translateY}px`);
    };

    const requestStackRelease = () => {
      if (stackFrame) {
        return;
      }

      stackFrame = requestAnimationFrame(updateStackRelease);
    };

    window.addEventListener('scroll', requestStackRelease, { passive: true });
    window.addEventListener('resize', requestStackRelease);
    updateStackRelease();

    return () => {
      cancelAnimationFrame(stackFrame);
      window.removeEventListener('scroll', requestStackRelease);
      window.removeEventListener('resize', requestStackRelease);
    };
  }, [isLoading]);

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
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      context: gl,
      alpha: true,
      antialias: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(canvasInfo.dpr);
    renderer.setSize(canvasInfo.width, canvasInfo.height, false);

    const loadingManager = new THREE.LoadingManager();
    loadingManager.onStart = () => {
      if (!hasFinishedInitialLoad.current) {
        setIsLoading(true);
        setLoadingProgress(0);
      }
    };
    loadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
      if (!hasFinishedInitialLoad.current && itemsTotal > 0) {
        setLoadingProgress(Math.round((itemsLoaded / itemsTotal) * 100));
      }
    };
    loadingManager.onError = () => {
      if (!hasFinishedInitialLoad.current) {
        setLoadingProgress(100);
        setTimeout(() => {
          setIsLoading(false);
          hasFinishedInitialLoad.current = true;
        }, 300);
      }
    };
    loadingManager.onLoad = () => {
      if (!hasFinishedInitialLoad.current) {
        setLoadingProgress(100);
        setTimeout(() => {
          setIsLoading(false);
          hasFinishedInitialLoad.current = true;
        }, 300);
      }
    };

    const textureLoader = new THREE.TextureLoader(loadingManager);
    const dummyTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    dummyTexture.needsUpdate = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      canvasInfo.width / canvasInfo.height,
      1.5,
      120,
    );
    camera.position.set(0, 1.1, 3.2);
    scene.add(camera);

    const introTextCanvas = document.createElement('canvas');
    introTextCanvas.width = 1024;
    introTextCanvas.height = 256;
    const introTextCtx = introTextCanvas.getContext('2d');
    let introTextTexture: THREE.CanvasTexture | null = null;
    let introTextSprite: THREE.Sprite | null = null;

    if (introTextCtx) {
      const drawIntroText = () => {
        introTextCtx.clearRect(0, 0, introTextCanvas.width, introTextCanvas.height);
        introTextCtx.font = "700 150px 'Roboto', sans-serif";
        introTextCtx.textBaseline = 'middle';
        introTextCtx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        introTextCtx.shadowBlur = 0;
        introTextCtx.shadowOffsetX = 0;
        introTextCtx.shadowOffsetY = 6;

        // A subtle top rim keeps the text aligned with the scene lighting.
        introTextCtx.lineWidth = 1;
        introTextCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        introTextCtx.strokeText("Hi, I'm", 40, introTextCanvas.height * 0.5 - 1);

        introTextCtx.fillStyle = '#8c8c8c';
        introTextCtx.fillText("Hi, I'm", 40, introTextCanvas.height * 0.5);

        if (introTextTexture) {
          introTextTexture.needsUpdate = true;
        }
      };

      introTextTexture = new THREE.CanvasTexture(introTextCanvas);
      introTextTexture.colorSpace = THREE.SRGBColorSpace;
      introTextTexture.minFilter = THREE.LinearFilter;
      introTextTexture.magFilter = THREE.LinearFilter;
      drawIntroText();

      const introTextMaterial = new THREE.SpriteMaterial({
        map: introTextTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      introTextSprite = new THREE.Sprite(introTextMaterial);
      introTextSprite.renderOrder = 999;
      introTextSprite.position.set(-1.625, 0.3, -2.7);
      introTextSprite.scale.set(1.7, 0.45, 1);
      camera.add(introTextSprite);

      if ('fonts' in document && typeof document.fonts.load === 'function') {
        document.fonts.load("700 150px Roboto").then(drawIntroText).catch(() => undefined);
      }
    }

    const orbitControls = new OrbitControls(camera, canvasEl);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.enablePan = false;
    orbitControls.enableZoom = false;
    orbitControls.autoRotate = true;
    orbitControls.autoRotateSpeed = 0.6;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 0.6);
    scene.add(hemiLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0008;
    keyLight.shadow.normalBias = 0.015;
    keyLight.shadow.radius = 4;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-5, 3, 2);
    scene.add(fillLight);

    const cameraTarget = new THREE.Vector3(4, 10, 0);

    const registerMaterial = (material: THREE.Material) => {
      const mat = material as THREE.MeshStandardMaterial;
      if (typeof mat.metalness !== 'number' || typeof mat.roughness !== 'number') {
        return;
      }
      stateRef.current.materialTweakTargets.push({
        material: mat as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
        baseMetalness: mat.metalness,
        baseRoughness: mat.roughness,
        baseEnvMapIntensity: (mat as THREE.MeshStandardMaterial).envMapIntensity ?? 1,
      });
    };
    const registerMeshMaterials = (mesh: THREE.Mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach(registerMaterial);
    };

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSphere = new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }),
    );
    envScene.add(envSphere);
    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
    pmrem.dispose();
    envSphere.geometry.dispose();
    (envSphere.material as THREE.Material).dispose();

    const fallbackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x66ccff }),
    );
    fallbackMesh.position.set(0, 0.6, 0);
    fallbackMesh.castShadow = true;
    fallbackMesh.receiveShadow = true;
    registerMeshMaterials(fallbackMesh);
    scene.add(fallbackMesh);

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.12 }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    let mixer: THREE.AnimationMixer | null = null;
    const loader = new GLTFLoader(loadingManager);
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    loader.setDRACOLoader(dracoLoader);
    loader.load(
      '/Final.glb',
      (gltf) => {
        scene.remove(fallbackMesh);
        fallbackMesh.geometry.dispose();
        (fallbackMesh.material as THREE.Material).dispose();
        const model = gltf.scene;
        const modelRoot = new THREE.Group();
        modelRoot.add(model);
        scene.add(modelRoot);
        stateRef.current.modelRoot = modelRoot;
        stateRef.current.model = model;

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            registerMeshMaterials(mesh);
          }
        });

        // Center the model on its own bounds so movement/orbit is intuitive.
        const modelBox = new THREE.Box3().setFromObject(model);
        if (!modelBox.isEmpty()) {
          const modelCenter = modelBox.getCenter(new THREE.Vector3());
          model.position.sub(modelCenter);
          stateRef.current.modelCenter = modelCenter;
        }

        cameraTarget.set(0, 0, 0);
        camera.lookAt(cameraTarget);
        orbitControls.target.copy(cameraTarget);
        orbitControls.update();
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(gltf.scene);
          const idleClip =
            gltf.animations.find((clip) => /idle/i.test(clip.name)) ?? gltf.animations[0];
          if (idleClip) {
            mixer.clipAction(idleClip).play();
          }
        }

        // Debug: expose model and log the farthest nodes to locate misplaced assets.
        (window as unknown as { __glb?: unknown }).__glb = { model, scene };
        model.updateWorldMatrix(true, true);
        const bbox = new THREE.Box3().setFromObject(model);
        if (!bbox.isEmpty()) {
          const center = bbox.getCenter(new THREE.Vector3());
          const size = bbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          console.log('GLB bbox center/size:', center, size, 'maxDim', maxDim.toFixed(2));

          // Summarize top-level parts to spot a misplaced subtree.
          const childSummaries = model.children.map((child) => {
            const childBox = new THREE.Box3().setFromObject(child);
            const childCenter = childBox.getCenter(new THREE.Vector3());
            const childSize = childBox.getSize(new THREE.Vector3());
            const dist = childCenter.distanceTo(center);
            return {
              name: child.name || '(unnamed)',
              type: child.type,
              x: Number(childCenter.x.toFixed(2)),
              y: Number(childCenter.y.toFixed(2)),
              z: Number(childCenter.z.toFixed(2)),
              dist: Number(dist.toFixed(2)),
              size: Number(Math.max(childSize.x, childSize.y, childSize.z).toFixed(2)),
            };
          });
          childSummaries.sort((a, b) => b.dist - a.dist);
          console.table(childSummaries);
        } else {
          console.warn('GLB bbox is empty; cannot compute top-level parts.');
        }
      },
      undefined,
      (error) => {
        console.error('Failed to load /Final.glb', error);
      },
    );

    const bgTarget = new THREE.WebGLRenderTarget(
      canvasInfo.width * canvasInfo.dpr,
      canvasInfo.height * canvasInfo.dpr,
    );
    bgTarget.texture.colorSpace = THREE.SRGBColorSpace;

    const vBlurTarget = new THREE.WebGLRenderTarget(
      canvasInfo.width * canvasInfo.dpr,
      canvasInfo.height * canvasInfo.dpr,
    );
    vBlurTarget.texture.colorSpace = THREE.SRGBColorSpace;

    const hBlurTarget = new THREE.WebGLRenderTarget(
      canvasInfo.width * canvasInfo.dpr,
      canvasInfo.height * canvasInfo.dpr,
    );
    hBlurTarget.texture.colorSpace = THREE.SRGBColorSpace;

    const sceneTarget = new THREE.WebGLRenderTarget(
      canvasInfo.width * canvasInfo.dpr,
      canvasInfo.height * canvasInfo.dpr,
    );
    sceneTarget.samples = 4;
    sceneTarget.texture.colorSpace = THREE.SRGBColorSpace;

    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const bgMaterial = new THREE.RawShaderMaterial({
      vertexShader: ScreenVertexShader,
      fragmentShader: FragmentBgShader.replace(/^\uFEFF?\s*#version\s+300\s+es\s*/i, ''),
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_resolution: {
          value: new THREE.Vector2(
            canvasInfo.width * canvasInfo.dpr,
            canvasInfo.height * canvasInfo.dpr,
          ),
        },
        u_dpr: { value: canvasInfo.dpr },
        u_mouse: { value: new THREE.Vector2(0, 0) },
        u_mouseSpring: { value: new THREE.Vector2(0, 0) },
        u_time: { value: 0 },
        u_mergeRate: { value: 0 },
        u_shapeWidth: { value: 0 },
        u_shapeHeight: { value: 0 },
        u_shapeRadius: { value: 0 },
        u_shapeRoundness: { value: 0 },
        u_shadowExpand: { value: 0 },
        u_shadowFactor: { value: 0 },
        u_shadowPosition: { value: new THREE.Vector2(0, 0) },
        u_bgType: { value: 0 },
        u_bgTexture: { value: dummyTexture },
        u_bgTextureRatio: { value: 1 },
        u_bgTextureReady: { value: 0 },
        u_showShape1: { value: 1 },
        u_refViewportWidth: { value: baseViewportWidthRef.current },
        u_refViewportHeight: { value: baseViewportHeightRef.current },
      },
    });
    const bgScene = new THREE.Scene();
    bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMaterial));

    const vBlurMaterial = new THREE.RawShaderMaterial({
      vertexShader: ScreenVertexShader,
      fragmentShader: FragmentBgVblurShader.replace(/^\uFEFF?\s*#version\s+300\s+es\s*/i, ''),
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_prevPassTexture: { value: sceneTarget.texture },
        u_resolution: {
          value: new THREE.Vector2(
            canvasInfo.width * canvasInfo.dpr,
            canvasInfo.height * canvasInfo.dpr,
          ),
        },
        u_blurRadius: { value: 0 },
        u_blurWeights: { value: stateRef.current.blurWeights },
      },
    });
    const vBlurScene = new THREE.Scene();
    vBlurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), vBlurMaterial));

    const hBlurMaterial = new THREE.RawShaderMaterial({
      vertexShader: ScreenVertexShader,
      fragmentShader: FragmentBgHblurShader.replace(/^\uFEFF?\s*#version\s+300\s+es\s*/i, ''),
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_prevPassTexture: { value: vBlurTarget.texture },
        u_resolution: {
          value: new THREE.Vector2(
            canvasInfo.width * canvasInfo.dpr,
            canvasInfo.height * canvasInfo.dpr,
          ),
        },
        u_blurRadius: { value: 0 },
        u_blurWeights: { value: stateRef.current.blurWeights },
      },
    });
    const hBlurScene = new THREE.Scene();
    hBlurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), hBlurMaterial));

    scene.background = bgTarget.texture;

    const postMaterial = new THREE.RawShaderMaterial({
      vertexShader: ScreenVertexShader,
      fragmentShader: FragmentMainShader.replace(/^\uFEFF?\s*#version\s+300\s+es\s*/i, ''),
      transparent: true,
      glslVersion: THREE.GLSL3,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        u_resolution: {
          value: new THREE.Vector2(
            canvasInfo.width * canvasInfo.dpr,
            canvasInfo.height * canvasInfo.dpr,
          ),
        },
        u_dpr: { value: canvasInfo.dpr },
        u_bg: { value: sceneTarget.texture },
        u_blurredBg: { value: hBlurTarget.texture },
        u_mouse: { value: new THREE.Vector2(0, 0) },
        u_mouseSpring: { value: new THREE.Vector2(0, 0) },
        u_mergeRate: { value: 0 },
        u_shapeWidth: { value: 0 },
        u_shapeHeight: { value: 0 },
        u_shapeRadius: { value: 0 },
        u_shapeRoundness: { value: 0 },
        u_tint: { value: new THREE.Vector4(1, 1, 1, 1) },
        u_refThickness: { value: 0 },
        u_refFactor: { value: 0 },
        u_refDispersion: { value: 0 },
        u_refFresnelRange: { value: 0 },
        u_refFresnelFactor: { value: 0 },
        u_refFresnelHardness: { value: 0 },
        u_glareRange: { value: 0 },
        u_glareConvergence: { value: 0 },
        u_glareOppositeFactor: { value: 0 },
        u_glareFactor: { value: 0 },
        u_glareHardness: { value: 0 },
        u_glareAngle: { value: 0 },
        u_blurEdge: { value: 0 },
        u_showShape1: { value: 1 },
        u_refViewportWidth: { value: baseViewportWidthRef.current },
        u_refViewportHeight: { value: baseViewportHeightRef.current },
        STEP: { value: 9 },
      },
    });
    const postScene = new THREE.Scene();
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial));

    const clock = new THREE.Clock();
    let raf: number | null = null;
    const lastState = {
      canvasInfo: null as typeof canvasInfo | null,
      bgTextureUrl: null as typeof stateRef.current.bgTextureUrl,
      bgTextureType: null as typeof stateRef.current.bgTextureType,
    };
    const render = () => {
      raf = requestAnimationFrame(render);

      const canvasInfo = stateRef.current.canvasInfo;
      const viewOffsetPx = {
        x: (300 * canvasInfo.width) / baseViewportWidthRef.current,
        y: (-50 * canvasInfo.height) / baseViewportHeightRef.current,
      };
      if (
        !lastState.canvasInfo ||
        lastState.canvasInfo.width !== canvasInfo.width ||
        lastState.canvasInfo.height !== canvasInfo.height ||
        lastState.canvasInfo.dpr !== canvasInfo.dpr
      ) {
        renderer.setPixelRatio(canvasInfo.dpr);
        renderer.setSize(canvasInfo.width, canvasInfo.height, false);
        bgTarget.setSize(canvasInfo.width * canvasInfo.dpr, canvasInfo.height * canvasInfo.dpr);
        vBlurTarget.setSize(canvasInfo.width * canvasInfo.dpr, canvasInfo.height * canvasInfo.dpr);
        hBlurTarget.setSize(canvasInfo.width * canvasInfo.dpr, canvasInfo.height * canvasInfo.dpr);
        sceneTarget.setSize(canvasInfo.width * canvasInfo.dpr, canvasInfo.height * canvasInfo.dpr);
        camera.aspect = canvasInfo.width / canvasInfo.height;
        camera.updateProjectionMatrix();
        const fullW = canvasInfo.width * canvasInfo.dpr;
        const fullH = canvasInfo.height * canvasInfo.dpr;
        camera.setViewOffset(
          fullW,
          fullH,
          -viewOffsetPx.x * canvasInfo.dpr,
          -viewOffsetPx.y * canvasInfo.dpr,
          fullW,
          fullH,
        );
        postMaterial.uniforms.u_resolution.value.set(
          canvasInfo.width * canvasInfo.dpr,
          canvasInfo.height * canvasInfo.dpr,
        );
        postMaterial.uniforms.u_dpr.value = canvasInfo.dpr;
        bgMaterial.uniforms.u_resolution.value.set(
          canvasInfo.width * canvasInfo.dpr,
          canvasInfo.height * canvasInfo.dpr,
        );
        bgMaterial.uniforms.u_dpr.value = canvasInfo.dpr;
        vBlurMaterial.uniforms.u_resolution.value.set(
          canvasInfo.width * canvasInfo.dpr,
          canvasInfo.height * canvasInfo.dpr,
        );
        hBlurMaterial.uniforms.u_resolution.value.set(
          canvasInfo.width * canvasInfo.dpr,
          canvasInfo.height * canvasInfo.dpr,
        );
        lastState.canvasInfo = canvasInfo;
      }

      const textureUrl = stateRef.current.bgTextureUrl;
      if (textureUrl !== lastState.bgTextureUrl) {
        if (stateRef.current.bgTexture) {
          stateRef.current.bgTexture.dispose();
          stateRef.current.bgTexture = null;
        }
        stateRef.current.bgTextureReady = false;
        if (!textureUrl) {
          // no texture
        } else if (stateRef.current.bgTextureType === 'image') {
          textureLoader.load(
            textureUrl,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              stateRef.current.bgTexture = tex;
              const img = tex.image as HTMLImageElement | undefined;
              if (img && img.width && img.height) {
                stateRef.current.bgTextureRatio = img.width / img.height;
              }
              stateRef.current.bgTextureReady = true;
            },
            undefined,
            () => {
              stateRef.current.bgTextureReady = false;
            },
          );
        } else if (stateRef.current.bgTextureType === 'video') {
          const videoEl = stateRef.current.bgVideoEls.get(stateRef.current.controls.bgType);
          if (videoEl) {
            const tex = new THREE.VideoTexture(videoEl);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            stateRef.current.bgTexture = tex;
            const setRatio = () => {
              if (videoEl.videoWidth && videoEl.videoHeight) {
                stateRef.current.bgTextureRatio = videoEl.videoWidth / videoEl.videoHeight;
              }
              stateRef.current.bgTextureReady = true;
            };
            if (videoEl.readyState >= 1) {
              setRatio();
            } else {
              videoEl.addEventListener('loadedmetadata', setRatio, { once: true });
            }
            videoEl.play().catch(() => undefined);
          }
        }
      }
      lastState.bgTextureUrl = textureUrl;
      lastState.bgTextureType = stateRef.current.bgTextureType;

      const controls = stateRef.current.controls;
      const modelRoot = stateRef.current.modelRoot;
      if (modelRoot) {
        const last = stateRef.current.lastCameraSettings;
        const orbitChanged =
          controls.cameraOrbitTheta !== last.orbitTheta ||
          controls.cameraOrbitPhi !== last.orbitPhi ||
          controls.cameraOrbitRadius !== last.orbitRadius;

        if (orbitChanged) {
          const theta = THREE.MathUtils.degToRad(controls.cameraOrbitTheta);
          const phi = THREE.MathUtils.degToRad(controls.cameraOrbitPhi);
          const radius = Math.max(0.001, controls.cameraOrbitRadius);
          const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, theta));
          camera.position.copy(orbitControls.target).add(offset);
          camera.lookAt(orbitControls.target);
        }

        if (orbitChanged) {
          orbitControls.update();
          stateRef.current.lastCameraSettings = {
            orbitTheta: controls.cameraOrbitTheta,
            orbitPhi: controls.cameraOrbitPhi,
            orbitRadius: controls.cameraOrbitRadius,
          };
        }
      }

      if (mixer) {
        mixer.update(clock.getDelta());
      }
      orbitControls.update();
      renderer.toneMappingExposure = controls.toneMappingExposure;

      ambientLight.intensity = controls.ambientIntensity;
      hemiLight.intensity = controls.hemiIntensity;
      hemiLight.color.setRGB(
        controls.hemiSkyColor.r / 255,
        controls.hemiSkyColor.g / 255,
        controls.hemiSkyColor.b / 255,
      );
      hemiLight.groundColor.setRGB(
        controls.hemiGroundColor.r / 255,
        controls.hemiGroundColor.g / 255,
        controls.hemiGroundColor.b / 255,
      );
      keyLight.intensity = controls.keyIntensity;
      keyLight.color.setRGB(
        controls.keyColor.r / 255,
        controls.keyColor.g / 255,
        controls.keyColor.b / 255,
      );
      keyLight.position.set(controls.keyPosX, controls.keyPosY, controls.keyPosZ);
      fillLight.intensity = controls.fillIntensity;
      fillLight.color.setRGB(
        controls.fillColor.r / 255,
        controls.fillColor.g / 255,
        controls.fillColor.b / 255,
      );
      fillLight.position.set(controls.fillPosX, controls.fillPosY, controls.fillPosZ);

      const metalnessScale = controls.materialMetalnessScale;
      const roughnessBoost = controls.materialRoughnessBoost;
      const envScale = controls.envMapIntensityScale;
      for (const target of stateRef.current.materialTweakTargets) {
        target.material.metalness = THREE.MathUtils.clamp(
          target.baseMetalness * metalnessScale,
          0,
          1,
        );
        target.material.roughness = THREE.MathUtils.clamp(
          target.baseRoughness + roughnessBoost,
          0,
          1,
        );
        target.material.envMapIntensity = target.baseEnvMapIntensity * envScale;
      }
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

      const blurRadius = Math.max(0, Math.min(200, Math.round(controls.blurRadius)));

      bgMaterial.uniforms.u_time.value = clock.elapsedTime;
      bgMaterial.uniforms.u_mouse.value.set(
        stateRef.current.canvasPointerPos.x,
        stateRef.current.canvasPointerPos.y,
      );
      bgMaterial.uniforms.u_mouseSpring.value.set(mouseSpring.x, mouseSpring.y);
      bgMaterial.uniforms.u_mergeRate.value = controls.mergeRate;
      bgMaterial.uniforms.u_shapeWidth.value = shapeSizeSpring.x;
      bgMaterial.uniforms.u_shapeHeight.value = shapeSizeSpring.y;
      bgMaterial.uniforms.u_shapeRadius.value =
        ((Math.min(shapeSizeSpring.x, shapeSizeSpring.y) / 2) * controls.shapeRadius) / 100;
      bgMaterial.uniforms.u_shapeRoundness.value = controls.shapeRoundness;
      bgMaterial.uniforms.u_shadowExpand.value = controls.shadowExpand;
      bgMaterial.uniforms.u_shadowFactor.value = controls.shadowFactor / 100;
      bgMaterial.uniforms.u_shadowPosition.value.set(
        -controls.shadowPosition.x,
        -controls.shadowPosition.y,
      );
      bgMaterial.uniforms.u_bgType.value = controls.bgType;
      bgMaterial.uniforms.u_bgTexture.value = stateRef.current.bgTexture ?? dummyTexture;
      bgMaterial.uniforms.u_bgTextureRatio.value = stateRef.current.bgTextureRatio;
      bgMaterial.uniforms.u_bgTextureReady.value = stateRef.current.bgTextureReady ? 1 : 0;
      bgMaterial.uniforms.u_showShape1.value = controls.showShape1 ? 1 : 0;

      vBlurMaterial.uniforms.u_blurRadius.value = blurRadius;
      vBlurMaterial.uniforms.u_blurWeights.value = stateRef.current.blurWeights;
      hBlurMaterial.uniforms.u_blurRadius.value = blurRadius;
      hBlurMaterial.uniforms.u_blurWeights.value = stateRef.current.blurWeights;

      postMaterial.uniforms.u_mouse.value.set(
        stateRef.current.canvasPointerPos.x,
        stateRef.current.canvasPointerPos.y,
      );
      postMaterial.uniforms.u_mouseSpring.value.set(mouseSpring.x, mouseSpring.y);
      postMaterial.uniforms.u_shapeWidth.value = shapeSizeSpring.x;
      postMaterial.uniforms.u_shapeHeight.value = shapeSizeSpring.y;
      postMaterial.uniforms.u_shapeRadius.value =
        ((Math.min(shapeSizeSpring.x, shapeSizeSpring.y) / 2) * controls.shapeRadius) / 100;
      postMaterial.uniforms.u_shapeRoundness.value = controls.shapeRoundness;
      postMaterial.uniforms.u_mergeRate.value = controls.mergeRate;
      const glareAngleDegrees = controls.glareAngleAnimate
        ? controls.glareAngle + clock.elapsedTime * controls.glareAngleSpeed
        : controls.glareAngle;
      postMaterial.uniforms.u_glareAngle.value = (glareAngleDegrees * Math.PI) / 180;
      postMaterial.uniforms.u_showShape1.value = controls.showShape1 ? 1 : 0;
      postMaterial.uniforms.u_tint.value.set(
        controls.tint.r / 255,
        controls.tint.g / 255,
        controls.tint.b / 255,
        controls.tint.a,
      );
      postMaterial.uniforms.u_refThickness.value = controls.refThickness;
      postMaterial.uniforms.u_refFactor.value = controls.refFactor;
      postMaterial.uniforms.u_refDispersion.value = controls.refDispersion;
      postMaterial.uniforms.u_refFresnelRange.value = controls.refFresnelRange;
      postMaterial.uniforms.u_refFresnelHardness.value = controls.refFresnelHardness / 100;
      postMaterial.uniforms.u_refFresnelFactor.value = controls.refFresnelFactor / 100;
      postMaterial.uniforms.u_glareRange.value = controls.glareRange;
      postMaterial.uniforms.u_glareHardness.value = controls.glareHardness / 100;
      postMaterial.uniforms.u_glareConvergence.value = controls.glareConvergence / 100;
      postMaterial.uniforms.u_glareOppositeFactor.value = controls.glareOppositeFactor / 100;
      postMaterial.uniforms.u_glareFactor.value = controls.glareFactor / 100;
      postMaterial.uniforms.u_blurEdge.value = controls.blurEdge ? 1 : 0;
      postMaterial.uniforms.STEP.value = 9;

      renderer.setRenderTarget(bgTarget);
      renderer.clear();
      renderer.render(bgScene, postCamera);

      renderer.setRenderTarget(sceneTarget);
      renderer.clear();
      renderer.render(scene, camera);

      renderer.setRenderTarget(vBlurTarget);
      renderer.clear();
      renderer.render(vBlurScene, postCamera);

      renderer.setRenderTarget(hBlurTarget);
      renderer.clear();
      renderer.render(hBlurScene, postCamera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    };
    raf = requestAnimationFrame(render);

    return () => {
      document.removeEventListener('pointermove', onPointerMove, true);
      if (raf) {
        cancelAnimationFrame(raf);
      }
      shadowPlane.geometry.dispose();
      (shadowPlane.material as THREE.Material).dispose();
      bgTarget.dispose();
      vBlurTarget.dispose();
      hBlurTarget.dispose();
      sceneTarget.dispose();
      postMaterial.dispose();
      bgMaterial.dispose();
      vBlurMaterial.dispose();
      hBlurMaterial.dispose();
      dummyTexture.dispose();
      if (stateRef.current.bgTexture) {
        stateRef.current.bgTexture.dispose();
        stateRef.current.bgTexture = null;
      }
      if (introTextSprite) {
        camera.remove(introTextSprite);
        (introTextSprite.material as THREE.Material).dispose();
      }
      if (introTextTexture) {
        introTextTexture.dispose();
      }
      envMap.dispose();
      orbitControls.dispose();
      dracoLoader.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <>
      {!isLoading && levaGlobal}
      {!isLoading && (
        <button
          type="button"
          className={styles.controlsToggleFloating}
          onClick={() => setShowControls((prev) => !prev)}
        >
          {showControls ? 'Hide controls' : 'Show controls'}
        </button>
      )}
      <section className={styles.hero}>
        {(() => {
          const progressDone = loadingProgress >= 100;
          return (
        <div
          className={clsx(styles.loadingOverlay, !isLoading && styles.loadingOverlayHidden)}
          aria-hidden={!isLoading}
        >
          <div className={styles.loadingCard} role="status" aria-live="polite">
            <div className={styles.loadingTitle}>Loading assets</div>
            <div className={styles.loaderContainer}>
              <div className={styles.loaderBar}>
                <div
                  className={clsx(
                    styles.loaderProgress,
                    progressDone && styles.loaderProgressDone,
                  )}
                  style={{ width: `${loadingProgress}%` }}
                >
                  <div className={styles.loaderEnergy}>
                    <span className={styles.loaderCore} />
                    <span className={styles.loaderGlare} />
                    <div className={styles.loaderParticles}>
                      {Array.from({ length: 16 }).map((_, index) => (
                        <span
                          key={index}
                          className={styles.loaderParticle}
                          style={{
                            ['--delay' as const]: `${index * 0.08}s`,
                            ['--size' as const]: `${1 + (index % 3)}px`,
                            ['--offset' as const]: `${(index % 6) * 4 - 10}px`,
                            ['--offsetY' as const]: `${(index % 5) * 4 - 8}px`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.loadingPercent}>{loadingProgress}%</div>
            </div>
          </div>
        </div>
          );
        })()}
        <div className={clsx(styles.canvasContainer, isLoading && styles.canvasContainerHidden)}>
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
      </section>
      {!isLoading && (
        <>
          <main ref={scrollSectionRef} className={styles.scrollSection}>
            <section className={styles.stackingSection}>
              <section className={styles.placeholder}>
                <div className={styles.dockPlaceholder} />
                {areContentBubblesVisible &&
                  contentBubbles.map((bubble, index) => (
                    <LiquidGlassBubble
                      key={index}
                      float={!areContentBubblesFrozen}
                      size={bubble.size}
                      startingPosition={{
                        x: areContentBubblesAtSides ? getBubbleSidePosition(index) : bubble.x,
                        y: bubble.y,
                      }}
                    />
                  ))}
              </section>
              <div className={styles.bubbleControlDockSticky}>
                <LiquidGlassBubble
                  className={styles.bubbleControlDockGlass}
                  config={{
                    width: 430,
                    height: 118,
                    radius: 22,
                    border: 0.035,
                    blur: 9,
                    scale: -120,
                    frost: 0,
                    saturation: 1.05,
                  }}
                  draggable={false}
                  float={false}
                >
                  <div className={styles.bubbleControlDock}>
                    <div className={styles.bubbleControlHeader}>
                      <span>Bubble controls</span>
                      <strong>UI draft</strong>
                    </div>
                    <div className={styles.bubbleControlApps}>
                      <button
                        className={styles.bubbleControlApp}
                        type="button"
                        onClick={() => setAreContentBubblesVisible((value) => !value)}
                      >
                        <span
                          className={clsx(
                            styles.bubbleControlIcon,
                            styles.bubbleControlIconGrid,
                          )}
                        />
                        <span>{areContentBubblesVisible ? 'Hide' : 'Show'}</span>
                        <strong>{areContentBubblesVisible ? 'Visible' : 'Hidden'}</strong>
                      </button>
                      <button
                        className={styles.bubbleControlApp}
                        type="button"
                        onClick={() => setAreContentBubblesFrozen((value) => !value)}
                      >
                        <span
                          className={clsx(
                            styles.bubbleControlIcon,
                            styles.bubbleControlIconFloat,
                          )}
                        />
                        <span>{areContentBubblesFrozen ? 'Float' : 'Freeze'}</span>
                        <strong>{areContentBubblesFrozen ? 'Stopped' : 'Moving'}</strong>
                      </button>
                      <button
                        className={styles.bubbleControlApp}
                        type="button"
                        onClick={() => setAreContentBubblesAtSides((value) => !value)}
                      >
                        <span
                          className={clsx(
                            styles.bubbleControlIcon,
                            styles.bubbleControlIconSpread,
                          )}
                        />
                        <span>{areContentBubblesAtSides ? 'Center' : 'Sides'}</span>
                        <strong>{areContentBubblesAtSides ? 'Edges' : 'Mixed'}</strong>
                      </button>
                      {[
                        { label: 'Size', value: '150%', icon: 'scale' },
                        { label: 'Drag', value: 'On', icon: 'drag' },
                      ].map((item) => (
                        <button key={item.label} className={styles.bubbleControlApp} type="button">
                          <span
                            className={clsx(
                              styles.bubbleControlIcon,
                              styles[`bubbleControlIcon${capitalize(item.icon)}`],
                            )}
                          />
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                </LiquidGlassBubble>
              </div>

              <div ref={contentStackRef} className={styles.contentStack}>
              <section className={styles.contentPanel}>
                <p className={styles.sectionEyebrow}>Portfolio</p>
                <h2>Davi Bentim</h2>
                <p className={styles.lead}>Web Developer / UI UX Designer</p>
                <ul className={styles.metaList}>
                  <li>
                    <span>Full Name</span>
                    Davi Martins Bentim
                  </li>
                  <li>
                    <span>Phone</span>
                    +1 (208) 750-8500
                  </li>
                  <li>
                    <span>Email</span>
                    davi.bentim@gmail.com
                  </li>
                  <li>
                    <span>GitHub</span>
                    github.com/davijaca
                  </li>
                </ul>
              </section>

              <section className={styles.contentPanel}>
                <p className={styles.sectionEyebrow}>About</p>
                <h2>Full stack craft with a design eye</h2>
                <p>
                  Davi Martins Bentim is a Brazilian full stack web developer and UI/UX designer
                  currently living in the United States, with a passion for creating beautiful and
                  functional websites.
                </p>
                <p>
                  He completed the MIT xPro MERN Stack Development program in 2022 and is currently
                  pursuing a Bachelor's degree in Web Development at the University of Europe for
                  Applied Sciences. He has been working as a freelance developer and designer and is
                  employed at Smatched (Heidelberg, Germany) since August 2023.
                </p>
              </section>

              <section className={styles.contentPanel}>
                <p className={styles.sectionEyebrow}>Experience</p>
                <h2>Recent roles</h2>
                <div className={styles.timeline}>
                  <article className={styles.timelineItem}>
                    <h3>Lead Project Manager</h3>
                    <p>Smatched - 2023 to present</p>
                    <ul>
                      <li>Led rebuilds of smatched.io and offerwallmonetization.com.</li>
                      <li>Coordinated with SEO and design teams to align deliverables.</li>
                      <li>Managed a team of up to five interns and ensured on-time delivery.</li>
                      <li>Maintained quality standards and project requirements.</li>
                    </ul>
                  </article>
                  <article className={styles.timelineItem}>
                    <h3>Front End Web Developer</h3>
                    <p>Smatched - 2023 to present</p>
                    <ul>
                      <li>Migrated Smatched from WordPress/Elementor to React.</li>
                      <li>Managed GitHub and GitLab repositories and documentation.</li>
                      <li>Performed code reviews and provided technical support.</li>
                    </ul>
                  </article>
                  <article className={styles.timelineItem}>
                    <h3>Freelance Full Stack Developer</h3>
                    <p>Self-employed - 2020 to present</p>
                    <ul>
                      <li>
                        Built and maintained websites for small businesses in the Brazilian community
                        in the Salt Lake City area.
                      </li>
                    </ul>
                  </article>
                </div>
              </section>

              <section className={styles.contentPanel}>
                <p className={styles.sectionEyebrow}>Education</p>
                <h2>Training and credentials</h2>
                <ul className={styles.simpleList}>
                  <li>
                    University of Europe for Applied Sciences - Bachelor's Degree (2023 to present),
                    Game Design BA, second semester online
                  </li>
                  <li>
                    Massachusetts Institute of Technology - MERN Stack Development (2021 to 2022),
                    highest grades across projects including the capstone, 3.7 GPA
                  </li>
                  <li>EEEM Padre Reus - High School (2010)</li>
                </ul>
              </section>

              <section className={styles.contentPanel}>
                <p className={styles.sectionEyebrow}>Skills</p>
                <h2>Tools and strengths</h2>
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
              </section>

              <section className={styles.contentPanel}>
                <p className={styles.sectionEyebrow}>Hire Me</p>
                <h2>Open to new opportunities and freelance work</h2>
                <p>Contact me to discuss projects and collaborations.</p>
                <div className={styles.contactGrid}>
                  <div>
                    <strong>Phone</strong>
                    <span>+1 (208) 750-8500</span>
                  </div>
                  <div>
                    <strong>Email</strong>
                    <span>davi.bentim@gmail.com</span>
                  </div>
                  <div>
                    <strong>GitHub</strong>
                    <span>github.com/davijaca</span>
                  </div>
                </div>
              </section>

              <div
                ref={contentStackReleaseRef}
                className={styles.contentStackSentinel}
                aria-hidden="true"
              />

              </div>
            </section>

            <section className={styles.normalScrollSection}>
              <p className={styles.sectionEyebrow}>Next</p>
              <h2>Normal scrolling resumes here</h2>
              <p>
                This placeholder section is outside the stacked-card sequence. It can become the
                next portfolio area, a project gallery, or a contact section later.
              </p>
            </section>
          </main>
        </>
      )}
    </>
  );
}

export default App;
