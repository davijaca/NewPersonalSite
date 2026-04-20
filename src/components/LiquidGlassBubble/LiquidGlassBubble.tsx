import clsx from 'clsx';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import styles from './LiquidGlassBubble.module.scss';
import { defaultGlassConfig, type GlassConfig } from './config';

type CssLength = number | string;

type LiquidGlassBubbleProps = {
  children?: ReactNode;
  className?: string;
  config?: Partial<GlassConfig>;
  draggable?: boolean;
  float?: boolean;
  parallaxContainerRef?: RefObject<HTMLElement | null>;
  parallaxStrength?: number;
  size?: number;
  startingPosition?: {
    x?: CssLength;
    y?: CssLength;
  };
  style?: CSSProperties;
};

const toCssLength = (value: CssLength | undefined) => {
  if (typeof value === 'number') {
    return `${value}px`;
  }

  return value ?? '0px';
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const buildDisplacementMarkup = (config: GlassConfig) => {
  const border = Math.min(config.width, config.height) * (config.border * 0.5);

  return `<svg class="displacement-image" viewBox="0 0 ${config.width} ${config.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="red" x1="100%" y1="0%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#000"/>
      <stop offset="100%" stop-color="red"/>
    </linearGradient>
    <linearGradient id="blue" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000"/>
      <stop offset="100%" stop-color="blue"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${config.width}" height="${config.height}" fill="black"></rect>
  <rect x="0" y="0" width="${config.width}" height="${config.height}" rx="${config.radius}" fill="url(#red)" />
  <rect x="0" y="0" width="${config.width}" height="${config.height}" rx="${config.radius}" fill="url(#blue)" style="mix-blend-mode: ${config.blend}" />
  <rect x="${border}" y="${border}" width="${config.width - border * 2}" height="${config.height - border * 2}" rx="${config.radius}" fill="hsl(0 0% ${config.lightness}% / ${config.alpha})" style="filter:blur(${config.blur}px)" />
</svg>`;
};

export function LiquidGlassBubble({
  children,
  className,
  config,
  draggable = true,
  float = true,
  parallaxContainerRef,
  parallaxStrength = -0.08,
  size = 1,
  startingPosition,
  style,
}: LiquidGlassBubbleProps) {
  const reactId = useId();
  const filterId = useMemo(
    () => `liquid-glass-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [reactId],
  );
  const glassConfig = useMemo(() => {
    const mergedConfig = { ...defaultGlassConfig, ...config };
    return {
      ...mergedConfig,
      width: mergedConfig.width * size,
      height: mergedConfig.height * size,
      radius: mergedConfig.radius * size,
    };
  }, [config, size]);
  const floatConfig = useMemo(
    () => ({
      xAmplitude: randomBetween(10, 28),
      yAmplitude: randomBetween(8, 24),
      xDuration: randomBetween(8, 14),
      yDuration: randomBetween(7, 13),
      xPhase: randomBetween(0, Math.PI * 2),
      yPhase: randomBetween(0, Math.PI * 2),
    }),
    [],
  );
  const [isReady, setIsReady] = useState(false);
  const effectRef = useRef<HTMLDivElement>(null);
  const displacementDebugRef = useRef<HTMLDivElement>(null);
  const glassFeImageRef = useRef<SVGFEImageElement>(null);
  const redChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const greenChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const blueChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const outputBlurRef = useRef<SVGFEGaussianBlurElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef<null | {
    pointerId: number;
    clientX: number;
    clientY: number;
    offsetX: number;
    offsetY: number;
  }>(null);

  useEffect(() => {
    const debug = displacementDebugRef.current;
    const feImage = glassFeImageRef.current;
    const redChannel = redChannelRef.current;
    const greenChannel = greenChannelRef.current;
    const blueChannel = blueChannelRef.current;
    const outputBlur = outputBlurRef.current;

    if (!debug || !feImage || !redChannel || !greenChannel || !blueChannel || !outputBlur) {
      return;
    }

    debug.innerHTML = buildDisplacementMarkup(glassConfig);
    const svgEl = debug.querySelector('.displacement-image');
    if (!svgEl) {
      return;
    }

    const serialized = new XMLSerializer().serializeToString(svgEl);
    const dataUri = `data:image/svg+xml,${encodeURIComponent(serialized)}`;
    feImage.setAttribute('href', dataUri);

    for (const channel of [redChannel, greenChannel, blueChannel]) {
      channel.setAttribute('xChannelSelector', glassConfig.x);
      channel.setAttribute('yChannelSelector', glassConfig.y);
    }

    redChannel.setAttribute('scale', `${glassConfig.scale + glassConfig.r}`);
    greenChannel.setAttribute('scale', `${glassConfig.scale + glassConfig.g}`);
    blueChannel.setAttribute('scale', `${glassConfig.scale + glassConfig.b}`);
    outputBlur.setAttribute('stdDeviation', `${glassConfig.displace}`);
    setIsReady(true);
  }, [glassConfig]);

  useEffect(() => {
    const effect = effectRef.current;
    if (!effect || !parallaxContainerRef) {
      return;
    }

    let parallaxFrame = 0;
    const updateBubbleParallax = () => {
      parallaxFrame = 0;
      const sectionRect = parallaxContainerRef.current?.getBoundingClientRect();
      if (!sectionRect) {
        return;
      }

      const viewportCenter = window.innerHeight * 0.5;
      const sectionCenter = sectionRect.top + sectionRect.height * 0.5;
      const distance = sectionCenter - viewportCenter;
      const parallaxY = distance * parallaxStrength;
      effect.style.setProperty('--bubble-parallax-y', `${parallaxY}px`);
    };

    const requestBubbleParallax = () => {
      if (parallaxFrame) {
        return;
      }

      parallaxFrame = requestAnimationFrame(updateBubbleParallax);
    };

    window.addEventListener('scroll', requestBubbleParallax, { passive: true });
    window.addEventListener('resize', requestBubbleParallax);
    updateBubbleParallax();

    return () => {
      cancelAnimationFrame(parallaxFrame);
      window.removeEventListener('scroll', requestBubbleParallax);
      window.removeEventListener('resize', requestBubbleParallax);
    };
  }, [parallaxContainerRef, parallaxStrength]);

  useEffect(() => {
    const effect = effectRef.current;
    if (!effect || !float) {
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) {
      return;
    }

    let floatFrame = 0;
    const startedAt = performance.now();

    const updateFloat = (now: number) => {
      const elapsed = (now - startedAt) / 1000;
      const x =
        Math.sin((elapsed / floatConfig.xDuration) * Math.PI * 2 + floatConfig.xPhase) *
        floatConfig.xAmplitude;
      const y =
        Math.cos((elapsed / floatConfig.yDuration) * Math.PI * 2 + floatConfig.yPhase) *
        floatConfig.yAmplitude;

      effect.style.setProperty('--bubble-float-x', `${x}px`);
      effect.style.setProperty('--bubble-float-y', `${y}px`);
      floatFrame = requestAnimationFrame(updateFloat);
    };

    floatFrame = requestAnimationFrame(updateFloat);

    return () => {
      cancelAnimationFrame(floatFrame);
    };
  }, [float, floatConfig]);

  useEffect(() => {
    const effect = effectRef.current;
    if (!effect || float) {
      return;
    }

    effect.style.setProperty('--bubble-float-x', '0px');
    effect.style.setProperty('--bubble-float-y', '0px');
  }, [float]);

  const cssVars = {
    '--width': glassConfig.width,
    '--height': glassConfig.height,
    '--radius': glassConfig.radius,
    '--frost': glassConfig.frost,
    '--saturation': glassConfig.saturation,
    '--filter-url': `url(#${filterId})`,
    '--bubble-x': toCssLength(startingPosition?.x),
    '--bubble-y': toCssLength(startingPosition?.y),
    '--bubble-drag-x': '0px',
    '--bubble-drag-y': '0px',
    '--bubble-float-x': '0px',
    '--bubble-float-y': '0px',
    ...style,
  } as CSSProperties;

  const updateDragOffset = useCallback((x: number, y: number) => {
    const effect = effectRef.current;
    if (!effect) {
      return;
    }

    dragOffsetRef.current = { x, y };
    effect.style.setProperty('--bubble-drag-x', `${x}px`);
    effect.style.setProperty('--bubble-drag-y', `${y}px`);
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggable) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: dragOffsetRef.current.x,
      offsetY: dragOffsetRef.current.y,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) {
      return;
    }

    updateDragOffset(
      dragStart.offsetX + event.clientX - dragStart.clientX,
      dragStart.offsetY + event.clientY - dragStart.clientY,
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) {
      return;
    }

    dragStartRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={effectRef}
      className={clsx(
        styles.effect,
        isReady && styles.effectReady,
        draggable && styles.effectDraggable,
        className,
      )}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={cssVars}
    >
      <div className={styles.navWrap} />
      {children ? <div className={styles.content}>{children}</div> : null}
      <svg className={styles.filter} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feImage
              ref={glassFeImageRef}
              x="0"
              y="0"
              width="100%"
              height="100%"
              result="map"
            />
            <feDisplacementMap
              ref={redChannelRef}
              in="SourceGraphic"
              in2="map"
              xChannelSelector="R"
              yChannelSelector="B"
              result="dispRed"
            />
            <feColorMatrix
              in="dispRed"
              type="matrix"
              values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="red"
            />
            <feDisplacementMap
              ref={greenChannelRef}
              in="SourceGraphic"
              in2="map"
              xChannelSelector="R"
              yChannelSelector="B"
              result="dispGreen"
            />
            <feColorMatrix
              in="dispGreen"
              type="matrix"
              values="0 0 0 0 0
                      0 1 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="green"
            />
            <feDisplacementMap
              ref={blueChannelRef}
              in="SourceGraphic"
              in2="map"
              xChannelSelector="R"
              yChannelSelector="B"
              result="dispBlue"
            />
            <feColorMatrix
              in="dispBlue"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 1 0 0
                      0 0 0 1 0"
              result="blue"
            />
            <feBlend in="red" in2="green" mode="screen" result="rg" />
            <feBlend in="rg" in2="blue" mode="screen" result="output" />
            <feGaussianBlur ref={outputBlurRef} in="output" stdDeviation="0.7" />
          </filter>
        </defs>
      </svg>
      <div ref={displacementDebugRef} className={styles.displacementDebug} />
    </div>
  );
}
