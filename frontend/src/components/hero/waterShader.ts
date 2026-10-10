// Water refraction pass. It samples two layers through the same distorted
// coordinates: the painted backdrop (sky, water, title) and the 3D scene,
// rendered off-screen.
//
// The look is a camera sitting just under a calm surface: the surface is a
// thin, slowly rolling band seen almost edge-on, bright along its crest and
// mirroring what is beneath it on its underside. Above it nothing bends;
// below it the image sways gently, most strongly near the surface.

export const waterVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const waterFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uBackdrop;
  uniform sampler2D uScene;
  uniform vec2 uResolution;
  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uWaterline;

  // The scene target holds linear, premultiplied colour; the backdrop is sRGB.
  vec3 linearToSRGB(vec3 c) {
    return mix(
      c * 12.92,
      1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
      step(0.0031308, c)
    );
  }

  // Slow, long swell along the surface, in CSS px (positive is up).
  float swell(float x, float t) {
    return 2.4 * sin(x * 0.0105 + t * 0.55)
         + 1.5 * sin(x * 0.0230 - t * 0.80 + 1.3)
         + 0.7 * sin(x * 0.0470 + t * 1.25 + 4.0);
  }

  // Thickness of the edge-on surface band, in CSS px.
  float bandThickness(float x, float t) {
    return 9.0 + 3.0 * sin(x * 0.017 - t * 0.6 + 2.0) + 1.5 * sin(x * 0.051 + t * 0.9);
  }

  // How much of the 3D scene crosses the surface around x (0..1).
  float objectAtSurface(vec2 uv, vec2 cssPx) {
    float sum = 0.0;
    for (int i = -3; i <= 3; i++) {
      vec2 offset = vec2(float(i) * 6.0 * cssPx.x, -3.0 * cssPx.y);
      sum += texture2D(uScene, uv + offset).a;
    }
    return sum / 7.0;
  }

  vec3 sampleLayers(vec2 uv, float below, float depth, out float sceneAlpha) {
    vec3 backdrop = texture2D(uBackdrop, uv).rgb;
    vec4 scene = texture2D(uScene, uv);
    vec3 sceneColor = scene.a > 0.0 ? linearToSRGB(scene.rgb / scene.a) : vec3(0.0);

    // Submerged geometry cools toward the colour of the water around it.
    vec3 waterTint = mix(vec3(0.36, 0.74, 0.86), vec3(0.03, 0.2, 0.34), depth);
    sceneColor = mix(sceneColor, waterTint, below * (0.15 + 0.5 * depth));

    sceneAlpha = scene.a;
    return mix(backdrop, sceneColor, scene.a);
  }

  void main() {
    vec2 css = uResolution / uPixelRatio;      // hero size in CSS px
    vec2 cssPx = 1.0 / css;                    // one CSS px in uv units
    float t = uTime;

    // Measured from the top of the hero, in uv and CSS px.
    float screenY = 1.0 - vUv.y;
    float x = vUv.x * css.x;

    // Where the surface is at this column. It lifts a little where the
    // island breaks through it, like a meniscus.
    float lift = objectAtSurface(vec2(vUv.x, 1.0 - uWaterline), cssPx);
    float height = swell(x, t) + lift * 3.5;
    float surfaceY = uWaterline - height * cssPx.y;
    float d = (screenY - surfaceY) * css.y;    // CSS px below the surface
    float band = bandThickness(x, t) + lift * 4.0;

    float depth = clamp((screenY - uWaterline) / max(0.001, 1.0 - uWaterline), 0.0, 1.0);
    float sampleY;
    float shiftX = 0.0;
    float below = step(0.0, d);

    if (d < 0.0) {
      // Above the surface: untouched, but never read the painted water.
      sampleY = min(screenY, uWaterline - cssPx.y);
    } else if (d < band) {
      // Underside of the surface: a squashed mirror of what lies beneath,
      // rolling sideways with the swell.
      float mirror = band + (band - d) * 1.6;
      sampleY = surfaceY + mirror * cssPx.y;
    } else {
      // Under water: content rides the swell and sways slowly. The sway is
      // strongest just under the surface and settles with depth.
      float settle = mix(1.0, 0.35, smoothstep(0.0, 260.0, d));
      float sway = sin(screenY * css.y * 0.030 - t * 0.9 + sin(x * 0.006 + t * 0.35) * 2.0);
      shiftX = sway * 2.6 * settle;
      sampleY = max(screenY + height * cssPx.y, uWaterline + cssPx.y)
              + sin(x * 0.012 + t * 0.7) * 1.4 * settle * cssPx.y;
    }

    float sampleX = (x + shiftX) / css.x;
    if (d >= 0.0 && d < band) {
      sampleX += sin(x * 0.035 + t * 1.1 + d * 0.4) * 3.0 * cssPx.x;
    }

    vec2 uv = clamp(vec2(sampleX, 1.0 - sampleY), 0.001, 0.999);
    float sceneAlpha;
    vec3 color = sampleLayers(uv, below, depth, sceneAlpha);

    if (d >= 0.0 && d < band) {
      // The underside reads as a pale, cool sheet with soft light lines.
      float across = d / band;
      color = mix(color * vec3(0.9, 0.96, 1.0), vec3(0.93, 0.98, 1.0), 0.18 * (1.0 - across));
      color += 0.08 * pow(1.0 - abs(sin(x * 0.045 - t * 0.7 + across * 3.0)), 6.0);
      // Thin dark seam where the band meets the water below.
      color *= 1.0 - 0.10 * exp(-pow((d - band) * 0.9, 2.0));
    }

    // Bright crest: light skimming along the top of the surface.
    float shimmer = 0.65 + 0.35 * sin(x * 0.021 - t * 0.9) * sin(x * 0.0073 + t * 0.4);
    float crest = exp(-pow(d * 0.6, 2.0));
    color = mix(color, vec3(1.0), crest * (0.55 + 0.25 * lift) * shimmer);

    // Light entering the water, fading over the first few dozen px.
    color += below * 0.05 * exp(-max(d, 0.0) / 40.0);

    gl_FragColor = vec4(color, 1.0);
  }
`;
