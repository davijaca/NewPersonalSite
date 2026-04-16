#version 300 es

precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_dpr;
uniform vec2 u_mouse;
uniform vec2 u_mouseSpring;
uniform float u_time;
uniform float u_mergeRate;
uniform float u_shapeWidth;
uniform float u_shapeHeight;
uniform float u_shapeRadius;
uniform float u_shapeRoundness;
uniform float u_shadowExpand;
uniform float u_shadowFactor;
uniform vec2 u_shadowPosition;
uniform int u_bgType;
uniform sampler2D u_bgTexture;
uniform float u_bgTextureRatio;
uniform int u_bgTextureReady;
uniform int u_showShape1;
uniform float u_refViewportWidth;
uniform float u_refViewportHeight;

float chessboard(vec2 uv, float size, int mode) {
  float yBars = step(size * 2.0, mod(uv.y * 2.0, size * 4.0));
  float xBars = step(size * 2.0, mod(uv.x * 2.0, size * 4.0));

  if (mode == 0) {
    return yBars;
  } else if (mode == 1) {
    return xBars;
  } else {
    return abs(yBars - xBars);
  }
}

float halfColor(vec2 uv) {
  if (uv.y > 0.5) {
    return 1.0;
  } else {
    return 0.0;
  }
}

float sdDShape(vec2 p, float r) {
  float circle = length(p) - r;
  float halfPlane = -p.x;
  return max(circle, halfPlane);
}

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdIsoscelesTriangle(vec2 p, vec2 q) {
  p.x = abs(p.x);
  vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
  vec2 b = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
  float s = -sign(q.y);
  vec2 d = min(vec2(dot(a, a), s * (p.x * q.y - p.y * q.x)),
               vec2(dot(b, b), s * (p.y - q.y)));
  return -sqrt(d.x) * sign(d.y);
}

float superellipseCornerSDF(vec2 p, float r, float n) {
  p = abs(p);
  float v = pow(pow(p.x, n) + pow(p.y, n), 1.0 / n);
  return v - r;
}

float roundedRectSDF(vec2 p, vec2 center, float width, float height, float cornerRadius, float n) {
  // Move into centered coordinate space
  p -= center;

  float cr = cornerRadius * u_dpr;

  // Distance to rectangle edge
  vec2 d = abs(p) - vec2(width * u_dpr, height * u_dpr) * 0.5;

  // Use separate handling for edges and corners
  float dist;

  if (d.x > -cr && d.y > -cr) {
    // Corner region
    vec2 cornerCenter = sign(p) * (vec2(width * u_dpr, height * u_dpr) * 0.5 - vec2(cr));
    vec2 cornerP = p - cornerCenter;
    dist = superellipseCornerSDF(cornerP, cr, n);
  } else {
    // Interior and edge region
    dist = min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }

  return dist;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdgMin(float a, float b) {
  return a < b
    ? a
    : b;
}

float mainSDF(vec2 p1, vec2 p2, vec2 p) {
  float refAspect = u_refViewportWidth / u_refViewportHeight;
  float layoutScale = (u_resolution.y / u_dpr) / u_refViewportHeight;
  float virtualWidth = refAspect * u_resolution.y;
  vec2 pAdjusted = p + vec2((virtualWidth - u_resolution.x) * 0.5, 0.0);
  vec2 p1n = p1 + pAdjusted / u_resolution.y;
  vec2 p2n = p2 + p / u_resolution.y;
  float d1 = u_showShape1 == 1 ? sdDShape(p1n, 100.0 * layoutScale * u_dpr / u_resolution.y) : 1.0; // D letter (base shape)
  float d3 =
    u_showShape1 == 1
      ? sdIsoscelesTriangle(
          vec2(
            p1n.x - 170.0 * layoutScale * u_dpr / u_resolution.y,
            -(p1n.y - 100.0 * layoutScale * u_dpr / u_resolution.y)
          ),
          vec2(70.0, 200.0) * (layoutScale * u_dpr / u_resolution.y)
        )
      : 1.0; // A letter (triangle)
  float d4 =
    u_showShape1 == 1
      ? sdIsoscelesTriangle(
          vec2(
            p1n.x - 300.0 * layoutScale * u_dpr / u_resolution.y,
            p1n.y + 102.0 * layoutScale * u_dpr / u_resolution.y
          ),
          vec2(70.0, 200.0) * (layoutScale * u_dpr / u_resolution.y)
        )
      : 1.0; // V letter (triangle)
  float d5 =
    u_showShape1 == 1
      ? sdBox(
          vec2(
            p1n.x - 430.0 * layoutScale * u_dpr / u_resolution.y,
            p1n.y - 0.0 * u_dpr / u_resolution.y
          ),
          vec2(20.0, 100.0) * (layoutScale * u_dpr / u_resolution.y)
        )
      : 1.0; // I letter (vertical box)
  // float d2 = sdSuperellipse(p2, 200.0 / u_resolution.y, 4.0).x;
  float d2Radius = min(u_shapeWidth, u_shapeHeight) * 0.125 / u_resolution.y;
  float d2 = sdCircle(p2n, d2Radius);

  return smin(smin(smin(smin(d1, d3, u_mergeRate), d4, u_mergeRate), d5, u_mergeRate), d2, u_mergeRate);
}

// Input: original UV, canvas aspect ratio, texture aspect ratio
// Output: transformed UV for direct texture sampling
vec2 getCoverUV(vec2 uv, float canvasAspect, float textureAspect) {
  if (canvasAspect > textureAspect) {
    // Canvas is wider: scale texture vertically
    float scale = textureAspect / canvasAspect;
    uv.y = uv.y * scale + 0.5 - 0.5 * scale;
  } else {
    // Canvas is taller: scale texture horizontally
    float scale = canvasAspect / textureAspect;
    uv.x = uv.x * scale + 0.5 - 0.5 * scale;
  }
  return uv;
}

void main() {
  vec2 u_resolution1x = u_resolution.xy / u_dpr;
  float refAspect = u_refViewportWidth / u_refViewportHeight;
  float layoutScale = u_resolution1x.y / u_refViewportHeight;
  float virtualWidth = refAspect * u_resolution.y;
  // float chessboardBg = chessboard(gl_FragCoord.xy, 14.0);
  vec3 bgColor = vec3(1.0);

  if (u_bgType <= 0) {
    // chessboard
    bgColor = vec3(1.0 - chessboard(gl_FragCoord.xy / u_dpr, 20.0, 2) / 4.0);
  } else if (u_bgType <= 1) {
    if (v_uv.x < 0.5 && v_uv.y > 0.5) {
      bgColor = vec3(chessboard(gl_FragCoord.xy / u_dpr, 10.0, 0));
    } else if (v_uv.x > 0.5 && v_uv.y < 0.5) {
      bgColor = vec3(chessboard(gl_FragCoord.xy / u_dpr, 10.0, 1));
    } else if (v_uv.x < 0.5 && v_uv.y < 0.5) {
      bgColor = vec3(0.0);
    }
  } else if (u_bgType <= 2) {
    bgColor = vec3(halfColor(gl_FragCoord.xy / u_resolution) * 0.6 + 0.3);
  } else if (u_bgType <= 13) {
    if (u_bgTextureReady != 1) {
      // chessboard
      bgColor = vec3(1.0 - chessboard(gl_FragCoord.xy / u_dpr, 20.0, 2) / 4.0);
    } else {
      vec2 uv = getCoverUV(v_uv, u_resolution.x / u_resolution.y, u_bgTextureRatio);

      // No out-of-bounds check needed; CLAMP_TO_EDGE handles it
      bgColor = texture(u_bgTexture, uv).rgb;
    }
  }

  // float chessboardBg = 1.0 - chessboard(gl_FragCoord.xy / u_dpr, 10.0) / 4.0;
  // float halfColorBg = halfColor(gl_FragCoord.xy / u_resolution);

  // draw shadow
  // center of shape 1 (group anchor for D/A/V/I shadow)
  vec2 p1 =
    (vec2(630.0 * layoutScale * u_dpr, 0.0) -
      vec2(virtualWidth * 0.5, u_resolution.y * 0.5) +
      vec2(u_shadowPosition.x * u_dpr, u_shadowPosition.y * u_dpr)) /
    u_resolution.y;
  // center of shape 2
  vec2 p2 =
    (vec2(0, -35.0) - u_mouseSpring + vec2(u_shadowPosition.x * u_dpr, u_shadowPosition.y * u_dpr)) /
    u_resolution.y;
  // merged shape
  float merged = mainSDF(p1, p2, gl_FragCoord.xy);

  float shadow = exp(-1.0 / u_shadowExpand * abs(merged) * u_resolution1x.y) * 0.6 * u_shadowFactor;

  fragColor = vec4(bgColor - vec3(shadow), 1.0);
}

