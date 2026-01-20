import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";

import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.2/index.js";
import ScrollTrigger from "https://cdn.jsdelivr.net/npm/gsap@3.12.2/ScrollTrigger.js";

gsap.registerPlugin(ScrollTrigger);

window.addEventListener("DOMContentLoaded", () => {
  // ---------- DOM refs
  const canvas = document.getElementById("webgl-canvas");
  const fallback = document.getElementById("webgl-fallback");

  const skipIntro = document.getElementById("skip-intro");
  const skipToContent = document.getElementById("skip-to-content");
  const diveFill = document.getElementById("dive-progress");
  const diveLabel = document.getElementById("dive-label");

  const heroTitle = document.getElementById("hero-title");
  const scrollIndicator = document.getElementById("scroll-indicator");
  const colorGrade = document.getElementById("color-grade");
  const bubbleLayer = document.getElementById("bubble-layer");

  const emailBtn = document.getElementById("email-cta");
  const copyEmailBtn = document.getElementById("copy-email");

  // section bubbles + footer fish layers (DOM overlays)
  const sectionBubbles = document.getElementById("section-bubbles");
  const fishLayer = document.getElementById("fish-layer");

  // Whale layer (DOM overlay)
  const whaleLayer = document.getElementById("whale-layer");

  if (!canvas) return failWebGL("Canvas not found");

  // ---------- Whale visibility (after hero)
  // NOTE: Whale must be OUTSIDE #hero in HTML (recommended)
  if (whaleLayer) {
    // Default off
    whaleLayer.style.opacity = "0";

    ScrollTrigger.create({
      trigger: "#section-1",
      start: "top 90%",
      end: "bottom top",
      onEnter: () => (whaleLayer.style.opacity = "1"),
      onEnterBack: () => (whaleLayer.style.opacity = "1"),
      onLeaveBack: () => (whaleLayer.style.opacity = "0")
    });

    // Optional: fade whale out near footer so it doesn't distract the CTA
    ScrollTrigger.create({
      trigger: "footer",
      start: "top 75%",
      end: "bottom bottom",
      onEnter: () => (whaleLayer.style.opacity = "0"),
      onLeaveBack: () => (whaleLayer.style.opacity = "1")
    });
  }

  // ---------- remember skip preference
  const SKIP_KEY = "ocean.skipIntro.v1";
  const userPrefersSkip = localStorage.getItem(SKIP_KEY) === "1";

  function markSkipped() {
    try {
      localStorage.setItem(SKIP_KEY, "1");
    } catch {
      // ignore
    }
  }

  // ---------- Reduced motion
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionToggle = document.getElementById("motion-toggle");
  const motion = { reduced: prefersReduced.matches };

  function applyMotionUI() {
    motionToggle?.setAttribute("aria-pressed", String(motion.reduced));
    if (motionToggle) motionToggle.textContent = motion.reduced ? "Motion: reduced" : "Reduce motion";
    document.documentElement.dataset.motion = motion.reduced ? "reduced" : "full";
  }

  motionToggle?.addEventListener("click", () => {
    motion.reduced = !motion.reduced;
    applyMotionUI();
    ScrollTrigger.refresh();
  });

  prefersReduced.addEventListener?.("change", (e) => {
    motion.reduced = e.matches;
    applyMotionUI();
    ScrollTrigger.refresh();
  });

  applyMotionUI();

  // ---------- mobile/perf profile
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 820;
  const isMobileish = isCoarse || isSmall;
  const DPR_CAP = isMobileish ? 1.25 : 1.75;
  const WATER_RT = isMobileish ? 512 : 1024;

  // ---------- Three.js init (with graceful failure)
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    return failWebGL("WebGL not available", e);
  }

  const scene = new THREE.Scene();
  const clock = new THREE.Clock();

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 6000);
  camera.position.set(0, 6, 35);

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88; // night

  // ---------- Night lighting (moonlight)
  scene.add(new THREE.AmbientLight(0x22324f, 0.28));

  const moonLight = new THREE.DirectionalLight(0xdde9ff, 0.55);
  moonLight.position.set(70, 95, -140);
  scene.add(moonLight);

  // Visible moon disk + glow
  const moonGroup = new THREE.Group();
  const moonDisk = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 0.75 })
  );
  const moonGlow = new THREE.Mesh(
    new THREE.SphereGeometry(18, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x7aaeff, transparent: true, opacity: 0.1 })
  );
  moonGroup.add(moonGlow, moonDisk);
  moonGroup.position.copy(moonLight.position.clone().multiplyScalar(12));
  scene.add(moonGroup);

  // ---------- Realistic night sky dome (shader)
  const nightSky = new THREE.Mesh(
    new THREE.SphereGeometry(2800, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x01020a) },
        bottomColor: { value: new THREE.Color(0x040816) },
        exponent: { value: 0.7 }
      },
      vertexShader: `
        precision highp float;
        varying vec3 vWorldPosition;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPosition = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float exponent;
        varying vec3 vWorldPosition;

        void main() {
          float h = normalize(vWorldPosition).y;
          float t = pow(max(h * 0.5 + 0.5, 0.0), exponent);
          vec3 col = mix(bottomColor, topColor, t);

          float horizon = smoothstep(-0.15, 0.25, h);
          col += vec3(0.02, 0.04, 0.08) * (1.0 - horizon) * 0.45;

          gl_FragColor = vec4(col, 1.0);
        }
      `
    })
  );
  scene.add(nightSky);

  // ---------- Stars + Milky Way
  function addStars({ count, radius }) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const cool = new THREE.Color(0x9cc8ff);
    const neutral = new THREE.Color(0xffffff);
    const warm = new THREE.Color(0xffe3b0);

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);

      const r = radius * (0.92 + 0.08 * Math.random());

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const pick = Math.random();
      const c = pick < 0.12 ? warm : pick < 0.42 ? cool : neutral;

      const b = 0.85 + 0.65 * Math.random();
      colors[i * 3 + 0] = c.r * b;
      colors[i * 3 + 1] = c.g * b;
      colors[i * 3 + 2] = c.b * b;

      const s = Math.random();
      sizes[i] = s < 0.92 ? 1.0 : s < 0.985 ? 1.8 : 2.6;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geom.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uBaseSize: { value: isMobileish ? 1.6 : 2.2 }
      },
      vertexShader: `
        precision highp float;
        attribute float aSize;
        varying vec3 vColor;
        uniform float uBaseSize;

        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;

          float dist = -mv.z;
          gl_PointSize = uBaseSize * aSize * (300.0 / dist);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vColor;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(p, p);
          float alpha = smoothstep(1.0, 0.0, r2);
          alpha *= 0.95;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      vertexColors: true
    });

    const points = new THREE.Points(geom, mat);
    points.frustumCulled = false;
    scene.add(points);
    return points;
  }

  function addMilkyWayBand({ count, radius }) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const bandColor = new THREE.Color(0x9fb4ff);

    for (let i = 0; i < count; i++) {
      const t = Math.random() * Math.PI * 2;
      const bandWidth = THREE.MathUtils.lerp(0.05, 0.18, Math.random());
      const y = (Math.random() - 0.5) * bandWidth;

      const x = Math.cos(t);
      const z = Math.sin(t);

      const tilt = 0.55;
      const yy = y * Math.cos(tilt) + z * Math.sin(tilt);
      const zz = -y * Math.sin(tilt) + z * Math.cos(tilt);

      const r = radius * (0.9 + 0.1 * Math.random());
      positions[i * 3 + 0] = x * r;
      positions[i * 3 + 1] = yy * r;
      positions[i * 3 + 2] = zz * r;

      const b = THREE.MathUtils.lerp(0.06, 0.18, Math.random());
      colors[i * 3 + 0] = bandColor.r * b;
      colors[i * 3 + 1] = bandColor.g * b;
      colors[i * 3 + 2] = bandColor.b * b;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: isMobileish ? 1.0 : 1.2,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geom, mat);
    points.frustumCulled = false;
    scene.add(points);
    return points;
  }

  addStars({ count: isMobileish ? 1400 : 4800, radius: 2400 });
  addMilkyWayBand({ count: isMobileish ? 700 : 2200, radius: 2350 });

  // ---------- Clouds (night) — layered billboard sprites
  const cloudTexture = new THREE.TextureLoader().load("assets/cloud.png");
  const cloudGroup = new THREE.Group();
  scene.add(cloudGroup);

  const cloudCount = isMobileish ? 14 : 26;
  const cloudRadius = 1600;
  const cloudMinY = 120;
  const cloudMaxY = 520;

  const clouds = [];
  for (let i = 0; i < cloudCount; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: THREE.MathUtils.lerp(0.08, 0.22, Math.random()),
      depthWrite: false
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(520, 300), mat);

    const a = Math.random() * Math.PI * 2;
    const r = cloudRadius * THREE.MathUtils.lerp(0.55, 1.0, Math.random());
    plane.position.set(
      Math.cos(a) * r,
      THREE.MathUtils.lerp(cloudMinY, cloudMaxY, Math.random()),
      Math.sin(a) * r
    );

    plane.rotation.z = Math.random() * Math.PI * 2;

    const s = THREE.MathUtils.lerp(0.6, 1.55, Math.random());
    plane.scale.setScalar(s);

    cloudGroup.add(plane);

    clouds.push({
      mesh: plane,
      drift: new THREE.Vector2(
        THREE.MathUtils.lerp(-0.35, -0.05, Math.random()),
        THREE.MathUtils.lerp(0.02, 0.22, Math.random())
      ),
      rot: THREE.MathUtils.lerp(-0.06, 0.06, Math.random())
    });
  }

  // ---------- Fog (night)
  scene.fog = new THREE.FogExp2(0x02040b, 0.0011);

  // ---------- Better reflections via environment capture
  const envRT = new THREE.WebGLCubeRenderTarget(isMobileish ? 128 : 256, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    encoding: THREE.sRGBEncoding
  });
  const cubeCam = new THREE.CubeCamera(1, 5000, envRT);
  scene.add(cubeCam);
  scene.environment = envRT.texture;

  // ---------- Water
  const waterGeometry = new THREE.PlaneGeometry(6500, 6500);
  const waterNormals = new THREE.TextureLoader().load("assets/waternormals.jpg", (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  });

  const SURFACE = new THREE.Color(0x041b2a);
  const DEEP = new THREE.Color(0x01060b);

  const water = new Water(waterGeometry, {
    textureWidth: WATER_RT,
    textureHeight: WATER_RT,
    waterNormals,
    sunDirection: moonLight.position.clone().normalize(),
    sunColor: 0xffffff,
    waterColor: SURFACE.getHex(),
    distortionScale: isMobileish ? 0.75 : 0.95,
    fog: true
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  scene.add(water);

  water.material.uniforms.size.value = isMobileish ? 1.25 : 1.05;

  const horizonMist = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 9000),
    new THREE.MeshBasicMaterial({ color: 0x02040b, transparent: true, opacity: 0.08 })
  );
  horizonMist.rotation.x = -Math.PI / 2;
  horizonMist.position.y = 0.05;
  scene.add(horizonMist);

  // ---------- Mouse
  const mouse = { x: 0, y: 0 };
  window.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // ---------- Perf pause deeper in page
  let renderEnabled = true;
  let envCaptured = false;

  function setWaterColorLerp(t) {
    const col = SURFACE.clone().lerp(DEEP, t);
    water.material.uniforms.waterColor.value.copy(col);
  }

  let smoothedProgress = 0;

  function updateByProgress(progress) {
    const travel = motion.reduced ? 0.45 : 1.0;
    const p = progress * travel;

    camera.position.z = 35 - p * 62;
    camera.position.y = Math.max(6 - p * 18, -10);
    camera.position.x = motion.reduced ? 0 : mouse.x * 1.0;
    camera.lookAt(0, 0, -p * 45);

    scene.fog.density = 0.0011 + p * 0.0033;
    renderer.toneMappingExposure = 0.88 - p * 0.08;

    const p01 = Math.min(1, Math.max(0, p));
    setWaterColorLerp(Math.min(1, Math.max(0, (p01 - 0.18) / 0.82)));

    const baseDist = motion.reduced ? 0.55 : isMobileish ? 0.75 : 0.95;
    water.material.uniforms.distortionScale.value = baseDist + p01 * 0.18;

    const baseSize = isMobileish ? 1.25 : 1.05;
    water.material.uniforms.size.value = baseSize + p01 * 0.12;

    moonGroup.visible = p < 0.94;
    moonGlow.material.opacity = 0.1 * (1 - p * 0.55);
    moonDisk.material.opacity = 0.75 * (1 - p * 0.7);

    cloudGroup.visible = p < 0.9;
  }

  // ---------- DOM bubbles (sections after hero)
  function ensureSectionBubbles() {
    if (!sectionBubbles) return null;
    if (sectionBubbles.childElementCount > 0) return sectionBubbles;

    const n = isMobileish ? 18 : 34;
    for (let i = 0; i < n; i++) {
      const b = document.createElement("div");
      b.className = "sbubble";
      b.style.left = `${Math.random() * 100}%`;
      b.style.animationDelay = `${Math.random() * 6}s`;
      b.style.animationDuration = `${6 + Math.random() * 10}s`;
      b.style.setProperty("--s", `${0.55 + Math.random() * 1.9}`);
      b.style.opacity = `${0.18 + Math.random() * 0.38}`;
      sectionBubbles.appendChild(b);
    }
    return sectionBubbles;
  }

  // ---------- DOM fish shadows (footer)
  function ensureFishShadows() {
    if (!fishLayer) return null;
    if (fishLayer.childElementCount > 0) return fishLayer;

    const n = isMobileish ? 6 : 10;
    for (let i = 0; i < n; i++) {
      const f = document.createElement("div");
      f.className = "fish";
      f.style.top = `${10 + Math.random() * 80}%`;
      f.style.animationDelay = `${Math.random() * 8}s`;
      f.style.animationDuration = `${10 + Math.random() * 14}s`;
      f.style.setProperty("--scale", `${0.6 + Math.random() * 1.4}`);
      f.style.setProperty("--blur", `${2 + Math.random() * 6}px`);
      fishLayer.appendChild(f);
    }
    return fishLayer;
  }

  ScrollTrigger.create({
    trigger: "#section-1",
    start: "top 85%",
    end: "bottom top",
    onEnter: () => ensureSectionBubbles() && (sectionBubbles.style.opacity = "1"),
    onEnterBack: () => ensureSectionBubbles() && (sectionBubbles.style.opacity = "1"),
    onLeave: () => sectionBubbles && (sectionBubbles.style.opacity = "0"),
    onLeaveBack: () => sectionBubbles && (sectionBubbles.style.opacity = "0")
  });

  ScrollTrigger.create({
    trigger: "#section-1",
    start: "top 80%",
    end: "bottom bottom",
    onEnter: () => ensureFishShadows() && (fishLayer.style.opacity = "1"),
    onEnterBack: () => ensureFishShadows() && (fishLayer.style.opacity = "1"),
    onLeave: () => fishLayer && (fishLayer.style.opacity = "0"),
    onLeaveBack: () => fishLayer && (fishLayer.style.opacity = "0")
  });

  // Highlights the active nav item while scrolling
  (() => {
    const links = Array.from(document.querySelectorAll(".midnav__link"));
    if (!links.length) return;

    const map = new Map(links.map((a) => [a.getAttribute("href"), a]));

    ["#hero", "#section-1", "#section-2", "#section-3"].forEach((id) => {
      const el = document.querySelector(id);
      if (!el) return;

      ScrollTrigger.create({
        trigger: el,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (self) => {
          if (!self.isActive) return;
          links.forEach((l) => l.classList.remove("is-active"));
          map.get(id)?.classList.add("is-active");
        }
      });
    });
  })();

  function tick() {
    if (renderEnabled) {
      const t = clock.getElapsedTime();

      water.material.uniforms.time.value = t * (motion.reduced ? 0.22 : 0.3);

      // clouds: billboard + drift
      const driftSpeed = motion.reduced ? 0.02 : 0.05;
      for (const c of clouds) {
        c.mesh.lookAt(camera.position);
        c.mesh.rotation.z += c.rot * 0.002;

        c.mesh.position.x += c.drift.x * driftSpeed;
        c.mesh.position.z += c.drift.y * driftSpeed;

        const len = Math.sqrt(c.mesh.position.x * c.mesh.position.x + c.mesh.position.z * c.mesh.position.z);
        if (len > cloudRadius * 1.15) {
          const a = Math.random() * Math.PI * 2;
          const r = cloudRadius * THREE.MathUtils.lerp(0.55, 1.0, Math.random());
          c.mesh.position.x = Math.cos(a) * r;
          c.mesh.position.z = Math.sin(a) * r;
        }
      }

      // capture environment once
      if (!envCaptured) {
        water.visible = false;
        horizonMist.visible = false;
        cubeCam.update(renderer, scene);
        water.visible = true;
        horizonMist.visible = true;
        envCaptured = true;
      }

      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  }
  tick();

  // Resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));
  });

  // ---------- Scroll choreography
  const root = document.documentElement;

  ScrollTrigger.create({
    trigger: "#hero",
    start: "top top",
    end: "+=110%",
    scrub: true,
    onUpdate: (self) => {
      const target = self.progress;
      smoothedProgress += (target - smoothedProgress) * (motion.reduced ? 0.35 : 0.18);
      updateByProgress(smoothedProgress);

      const pct = Math.round(self.progress * 100);
      if (diveFill) diveFill.style.height = `${pct}%`;
      if (diveLabel) diveLabel.textContent = `Dive ${pct}%`;

      const grade = gsap.utils.clamp(0, 1, (self.progress - 0.28) / 0.55);
      if (colorGrade) colorGrade.style.opacity = String(grade);
      if (bubbleLayer) bubbleLayer.style.opacity = String(grade * 0.65);

      root.style.setProperty("--uw-blur", `${grade * 4}px`);
      root.style.setProperty("--uw-tint", String(grade));
      root.style.setProperty("--uw-shift", `${grade * 0.9}px`);
    }
  });

  ScrollTrigger.create({
    trigger: "#hero",
    start: "top top",
    end: "+=110%",
    snap: motion.reduced ? false : { snapTo: [0, 1], duration: { min: 0.12, max: 0.28 }, delay: 0.05 }
  });

  // ---------- UPDATED HERO TITLE: hold + sink
  if (heroTitle) {
    const HERO_TITLE_HOLD = 0.78;

    gsap
      .timeline({
        scrollTrigger: {
          trigger: "#hero",
          start: "top top",
          end: "+=110%",
          scrub: true
        }
      })
      .fromTo(
        heroTitle,
        { opacity: 0, y: 140, scale: 0.985, filter: "blur(10px)" },
        { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.18, ease: "none" }
      )
      .to(heroTitle, {
        opacity: 1,
        y: 10,
        scale: 1,
        filter: "blur(0px)",
        duration: HERO_TITLE_HOLD,
        ease: "none"
      })
      .to(heroTitle, {
        opacity: 0,
        y: 240,
        scale: 0.985,
        filter: "blur(10px)",
        duration: 1 - HERO_TITLE_HOLD,
        ease: "none"
      });
  }

  if (scrollIndicator) {
    gsap.to(scrollIndicator, {
      opacity: 0,
      scrollTrigger: { trigger: "#hero", start: "top top", end: "+=18%", scrub: true }
    });
  }

  document.querySelectorAll(".content-section").forEach((section) => {
    const content = section.querySelector(".content");
    const bg = section.querySelector(".parallax-bg");

    if (content) {
      gsap.to(content, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: section, start: "top 72%", end: "top 30%", toggleActions: "play none none reverse" }
      });
    }

    if (bg) {
      gsap.to(bg, {
        y: motion.reduced ? "0%" : "-18%",
        ease: "none",
        scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true }
      });
    }
  });

  ScrollTrigger.create({
    trigger: "#section-2",
    start: "top 20%",
    end: "bottom bottom",
    onEnter: () => (renderEnabled = false),
    onLeaveBack: () => (renderEnabled = true)
  });

  function jumpToContent() {
    markSkipped();
    document.getElementById("section-1")?.scrollIntoView({ behavior: "smooth" });
  }

  skipIntro?.addEventListener("click", (e) => {
    e.preventDefault();
    jumpToContent();
  });

  skipToContent?.addEventListener("click", (e) => {
    e.preventDefault();
    jumpToContent();
  });

  if (userPrefersSkip) {
    requestAnimationFrame(() => {
      document.getElementById("section-1")?.scrollIntoView({ behavior: "auto" });
      window.scrollBy(0, 1);
      ScrollTrigger.refresh();
    });
  }

  document.querySelectorAll("[data-cta]").forEach((el) => {
    el.addEventListener("pointerdown", () => el.classList.add("is-pressed"));
    el.addEventListener("pointerup", () => el.classList.remove("is-pressed"));
    el.addEventListener("pointercancel", () => el.classList.remove("is-pressed"));
  });

  copyEmailBtn?.addEventListener("click", async () => {
    const email = (emailBtn?.getAttribute("href") || "").replace("mailto:", "") || "hello@example.com";
    try {
      await navigator.clipboard.writeText(email);
      copyEmailBtn.textContent = "Copied";
      setTimeout(() => (copyEmailBtn.textContent = "Copy email"), 1200);
    } catch {
      copyEmailBtn.textContent = email;
      setTimeout(() => (copyEmailBtn.textContent = "Copy email"), 2000);
    }
  });

  // -----------------------------
  // Neon circle cursor + ripple
  // -----------------------------
  (() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (coarse || reduce) return;

    const dot = document.getElementById("neon-dot");
    const ring = document.getElementById("neon-ring");
    const ripples = document.getElementById("neon-ripples");
    if (!dot || !ring || !ripples) return;

    document.body.classList.add("neon-cursor-on");

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const pos = { x: target.x, y: target.y };

    const DOT_FOLLOW = 0.55;
    const RING_FOLLOW = 0.22;

    let lastRipple = 0;

    function spawnRipple(x, y) {
      const r = document.createElement("div");
      r.className = "neon-ripple";
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      ripples.appendChild(r);
      r.addEventListener("animationend", () => r.remove());
    }

    window.addEventListener("mousemove", (e) => {
      target.x = e.clientX;
      target.y = e.clientY;

      const now = performance.now();
      if (now - lastRipple > 260) {
        spawnRipple(target.x, target.y);
        lastRipple = now;
      }
    });

    window.addEventListener("mousedown", () => spawnRipple(target.x, target.y));

    function raf() {
      pos.x += (target.x - pos.x) * DOT_FOLLOW;
      pos.y += (target.y - pos.y) * DOT_FOLLOW;

      dot.style.left = `${pos.x}px`;
      dot.style.top = `${pos.y}px`;

      const rx = parseFloat(ring.dataset.x || `${pos.x}`);
      const ry = parseFloat(ring.dataset.y || `${pos.y}`);
      const nrx = rx + (target.x - rx) * RING_FOLLOW;
      const nry = ry + (target.y - ry) * RING_FOLLOW;

      ring.dataset.x = `${nrx}`;
      ring.dataset.y = `${nry}`;
      ring.style.left = `${nrx}px`;
      ring.style.top = `${nry}px`;

      requestAnimationFrame(raf);
    }

    raf();
  })();

  console.log("Scene ready ✅");

  function failWebGL(message, err) {
    console.error(message, err || "");
    document.body.classList.add("webgl-failed");
    canvas?.remove();
    fallback && (fallback.style.opacity = "1");
  }
});