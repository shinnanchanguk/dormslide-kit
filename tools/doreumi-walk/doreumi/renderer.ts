import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DOREUMI_BASE, DOREUMI_DANCES, DOREUMI_EXPRESSIONS, type DoreumiExpression } from "./assets";

/**
 * 슬라이드 속 3D 도름이 한 마리를 그리는 WebGL 렌더러.
 *
 * DoRms 의 motion-runtime 에서 슬라이드에 필요한 것만 옮겼다(옷·소품·계절·눈사람 없음).
 * 모델은 meshopt 압축을 푼 GLB 라 WASM 디코더 없이 읽힌다(운영 CSP 에 wasm-unsafe-eval 이 없다).
 * 캔버스는 캐릭터 크기만 하고, 캐릭터의 위치는 바깥에서 CSS 로 옮긴다. 여기서는 발을 (0,0) 에
 * 두고 그리며, 캔버스가 무대 가장자리에서 멈춰 설 때 생기는 어긋남만 카메라를 밀어 메운다.
 */


/** 서 있는 모습 기준 캔버스 크기(월드 단위). 발 아래 여유와 춤출 때 옆으로 흔드는 폭까지 담는다. */
const BOX = { left: 1.85, right: 1.85, top: 3.15, bottom: 0.22 };
const MOTION_MAX_BYTES = 1_000_000;
const NO_BLINK = new Set<string>(["laugh", "cheering", "love"]);
const LOOPS = new Set(["Idle", "Walk", "Run", "Dragged", "Falling"]);

export type DoreumiMetrics = {
  /** 서 있을 때 발끝부터 머리 위 꼬리까지 높이(월드 단위) */
  height: number;
  /** 서 있을 때 몸통 좌우 폭의 절반(월드 단위) */
  halfWidth: number;
  box: typeof BOX;
};

export type DoreumiRenderer = {
  metrics: DoreumiMetrics;
  /** 동작 길이(초). 아직 안 불러온 춤은 없다. */
  duration: (action: string) => number;
  hasAction: (action: string) => boolean;
  play: (action: string, options?: { restart?: boolean; timeScale?: number }) => void;
  setExpression: (expression: DoreumiExpression) => void;
  /** 왼쪽 -1, 정면 0, 오른쪽 1 */
  setFacing: (facing: -1 | 0 | 1) => void;
  /** 캔버스 CSS 크기(무대 px)·무대 배율·기기 배율 */
  resize: (cssWidth: number, cssHeight: number, stageScale: number) => void;
  /** 캔버스가 무대 안에 머물도록 밀린 만큼(무대 px) 카메라를 반대로 민다 */
  setViewShift: (dx: number, dy: number, pixelsPerUnit: number) => void;
  render: (dt: number) => void;
  dispose: () => void;
};

type Uniforms = {
  faceSkin: { value: THREE.Texture };
  faceInk: { value: THREE.Texture };
  faceNext: { value: THREE.Texture };
  faceBlend: { value: number };
  faceBounds: { value: THREE.Vector4 };
};

function disposeObject(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

function visibleBounds(root: THREE.Object3D) {
  const bounds = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.SkinnedMesh) {
      object.skeleton.update();
      object.computeBoundingBox();
      bounds.union(object.boundingBox!.clone().applyMatrix4(object.matrixWorld));
    } else {
      object.geometry.computeBoundingBox();
      bounds.union(object.geometry.boundingBox!.clone().applyMatrix4(object.matrixWorld));
    }
  });
  return bounds;
}

/** 아주 작은 UV 섬을 쓰는 원본 아틀라스라, 덮인 삼각형 안에서만 보간하게 한다(DoRms motion-material). */
function applyAtlasSampling(shader: { vertexShader: string; fragmentShader: string }) {
  for (const [field, chunk] of [
    ["vertexShader", "uv_pars_vertex"],
    ["fragmentShader", "uv_pars_fragment"],
  ] as const) {
    const declaration = THREE.ShaderChunk[chunk];
    const include = `#include <${chunk}>`;
    if (!shader[field].includes(include) || !declaration.includes("varying vec2 vMapUv;")) {
      throw new Error("Doreumi atlas shader declaration changed");
    }
    shader[field] = shader[field].replace(include, declaration.replace("varying vec2 vMapUv;", "centroid varying vec2 vMapUv;"));
  }
}

/** 승인된 얼굴 전사: 얼굴 칸 안에서 맨살을 깔고 표정 잉크를 겹친다(DoRms motion-runtime 과 같은 식). */
function applyFace(material: THREE.MeshStandardMaterial, uniforms: Uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    applyAtlasSampling(shader);
    shader.vertexShader = "varying vec3 vFacePosition;\nvarying vec3 vFaceRest;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <morphtarget_vertex>",
      "#include <morphtarget_vertex>\nvFacePosition = transformed;\nvFaceRest = position;",
    );
    shader.fragmentShader =
      "varying vec3 vFacePosition;\nvarying vec3 vFaceRest;\nuniform sampler2D faceSkin;\nuniform sampler2D faceInk;\nuniform sampler2D faceNext;\nuniform float faceBlend;\nuniform vec4 faceBounds;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
        vec2 fp = vec2((vFacePosition.x-faceBounds.x)/(faceBounds.z-faceBounds.x), (faceBounds.w-vFacePosition.y)/(faceBounds.w-faceBounds.y));
        vec2 restFp = vec2((vFaceRest.x-faceBounds.x)/(faceBounds.z-faceBounds.x), (faceBounds.w-vFaceRest.y)/(faceBounds.w-faceBounds.y));
        float faceGate = step(.22,vFacePosition.z)*step(0.,fp.x)*step(fp.x,1.)*step(0.,fp.y)*step(fp.y,1.);
        vec4 cleanSkin = texture2D(faceSkin,restFp);
        vec4 fromInk = texture2D(faceInk,fp), toInk = texture2D(faceNext,fp);
        float inkAlpha = mix(fromInk.a,toInk.a,faceBlend);
        vec3 inkPremultiplied = mix(fromInk.rgb*fromInk.a,toInk.rgb*toInk.a,faceBlend);
        diffuseColor.rgb = mix(diffuseColor.rgb,cleanSkin.rgb,cleanSkin.a*faceGate);
        diffuseColor.rgb = diffuseColor.rgb*(1.-inkAlpha*faceGate) + inkPremultiplied*faceGate;
      `,
    );
  };
  material.customProgramCacheKey = () => "dormslide-doreumi-face-v1";
}

export async function createDoreumiRenderer(canvas: HTMLCanvasElement, signal: AbortSignal): Promise<DoreumiRenderer> {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.setClearColor(0, 0);

  let disposed = false;
  const textures = new Map<string, THREE.Texture>();
  let model: THREE.Group | undefined;
  const aborted = () => disposed || signal.aborted;
  const abortError = () => new DOMException("Disposed", "AbortError");

  try {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 30);
    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);
    // DoRms 캐릭터 제작 화면과 같은 조명. 무거운 그림자 지도는 쓰지 않는다.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb4c3d7, 2.2));
    for (const [color, intensity, x, y, z] of [
      [0xfffbf5, 3.1, -3.2, 5.8, 4.6],
      [0xcfe2ff, 1.35, 4, 3, 1.5],
      [0x8faeff, 1.05, -3, 3.5, -4],
    ]) {
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(x, y, z);
      scene.add(light);
    }

    const loader = new GLTFLoader();
    loader.register((parser) => {
      // GLB 안의 그림은 blob 주소로 풀린다. ImageBitmapLoader 는 그 주소를 fetch 해서 CSP(connect-src)에
      // 막히므로, img-src 로 읽는 TextureLoader 로 바꿔 끼운다.
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
      return { name: "DORMSLIDE_IMAGE_ELEMENT_TEXTURES" };
    });
    const textureLoader = new THREE.TextureLoader();
    const textureRequests = new Map<string, Promise<THREE.Texture>>();
    const loadTexture = (id: string) => {
      const cached = textures.get(id);
      if (cached) return Promise.resolve(cached);
      const pending = textureRequests.get(id);
      if (pending) return pending;
      const request = textureLoader
        .loadAsync(id === "skin" ? `${DOREUMI_BASE}/face-skin.webp` : `${DOREUMI_BASE}/expressions/${id}.webp`)
        .then((map) => {
          if (aborted()) {
            map.dispose();
            throw abortError();
          }
          map.flipY = false;
          map.colorSpace = THREE.SRGBColorSpace;
          map.minFilter = THREE.LinearFilter;
          map.magFilter = THREE.LinearFilter;
          map.generateMipmaps = false;
          textures.set(id, map);
          return map;
        })
        .finally(() => textureRequests.delete(id));
      textureRequests.set(id, request);
      return request;
    };

    const response = await fetch(`${DOREUMI_BASE}/doreumi.glb`, { signal });
    if (!response.ok) throw new Error(`Doreumi model ${response.status}`);
    const [gltf, skin, neutral] = await Promise.all([
      response.arrayBuffer().then((buffer) => loader.parseAsync(buffer, `${DOREUMI_BASE}/`)),
      loadTexture("skin"),
      loadTexture("neutral"),
    ]);
    if (aborted()) {
      disposeObject(gltf.scene);
      throw abortError();
    }
    model = gltf.scene;

    let meshCount = 0;
    let textureMissing = false;
    const uniforms: Uniforms = {
      faceSkin: { value: skin },
      faceInk: { value: neutral },
      faceNext: { value: neutral },
      faceBlend: { value: 1 },
      faceBounds: { value: new THREE.Vector4(-0.4, -0.12, 0.4, 0.64) },
    };
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      meshCount++;
      // 승인된 무표정 얼굴 표면(모프 1개)은 늘 켜 둔다.
      if (object.morphTargetInfluences?.length) object.morphTargetInfluences[0] = 1;
      object.frustumCulled = false;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        if (!material.map || !(material.map.image?.width > 0)) {
          textureMissing = true;
          continue;
        }
        material.map.generateMipmaps = false;
        material.map.minFilter = THREE.LinearFilter;
        material.map.needsUpdate = true;
        material.roughness = 0.9;
        material.metalness = 0;
        applyFace(material, uniforms);
      }
    });
    // 그림을 못 읽은 채 하얀 도름이를 내보내지 않는다. 바깥에서 정지 그림으로 바꾼다.
    if (!meshCount || textureMissing) throw new Error("Doreumi model texture unavailable");

    const holder = new THREE.Group();
    holder.add(model);
    scene.add(holder);

    const mixer = new THREE.AnimationMixer(model);
    const clips = new Map<string, THREE.AnimationClip>(gltf.animations.map((clip) => [clip.name, clip]));
    let current: THREE.AnimationAction | null = null;
    const play = (name: string, options: { restart?: boolean; timeScale?: number } = {}) => {
      const clip = clips.get(name);
      if (!clip) return;
      const next = mixer.clipAction(clip);
      const timeScale = options.timeScale ?? 1;
      if (next === current && !options.restart) {
        next.setEffectiveTimeScale(timeScale);
        return;
      }
      const loop = LOOPS.has(name);
      if (next === current) {
        next.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).play();
        return;
      }
      next.stopFading().reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1);
      next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      next.clampWhenFinished = true;
      next.play();
      if (current) {
        current.stopFading();
        const fade = name === "Dragged" || name === "Falling" ? 0.14 : name === "Landing" ? 0.12 : 0.3;
        next.crossFadeFrom(current, fade, false);
      }
      current = next;
    };
    play("Idle");
    mixer.update(0);

    model.updateMatrixWorld(true);
    const standing = visibleBounds(model);
    holder.position.y = -standing.min.y;
    const metrics: DoreumiMetrics = {
      height: standing.max.y - standing.min.y,
      halfWidth: Math.max(Math.abs(standing.min.x), Math.abs(standing.max.x)),
      box: BOX,
    };

    // 춤 동작은 따로 받아 둔다. 실패해도 나머지 행동은 그대로 한다.
    const loadMotion = async (id: string) => {
      const file = `${DOREUMI_BASE}/motions/${id.replace(":", "-")}.json`;
      const res = await fetch(file, { signal });
      if (!res.ok) throw new Error(`Doreumi motion ${res.status}`);
      const text = await res.text();
      if (text.length > MOTION_MAX_BYTES) throw new Error("Doreumi motion too large");
      if (aborted()) return;
      const clip = THREE.AnimationClip.parse(JSON.parse(text));
      clip.name = id;
      if (!clip.validate() || !Number.isFinite(clip.duration) || clip.duration <= 0 || clip.duration > 60) throw new Error("Invalid motion");
      clips.set(id, clip);
    };
    for (const id of DOREUMI_DANCES) void loadMotion(id).catch(() => undefined);
    for (const id of DOREUMI_EXPRESSIONS) if (id !== "neutral") void loadTexture(id).catch(() => undefined);
    void loadTexture("blink_closed").catch(() => undefined);

    let expression: DoreumiExpression = "neutral";
    let elapsed = 0;
    let blinkUntil = 0;
    let nextBlink = 2.6;
    let targetYaw = 0;
    let lastRenderedExpression: THREE.Texture = neutral;
    const show = (map: THREE.Texture) => {
      if (map === lastRenderedExpression) return;
      uniforms.faceInk.value = uniforms.faceNext.value;
      uniforms.faceNext.value = map;
      uniforms.faceBlend.value = 0;
      lastRenderedExpression = map;
    };

    let cssWidth = 1;
    let cssHeight = 1;
    let shift = { dx: 0, dy: 0, ppu: 60 };
    const applyCamera = () => {
      const { dx, dy, ppu } = shift;
      // 발(0,0)은 캔버스 안 (left+dx, top+dy) 자리에 그려진다.
      camera.left = -(BOX.left * ppu + dx) / ppu;
      camera.right = (cssWidth - BOX.left * ppu - dx) / ppu;
      camera.top = (BOX.top * ppu + dy) / ppu;
      camera.bottom = -(cssHeight - BOX.top * ppu - dy) / ppu;
      camera.updateProjectionMatrix();
    };

    const api: DoreumiRenderer = {
      metrics,
      duration: (action) => clips.get(action)?.duration ?? 0,
      hasAction: (action) => clips.has(action),
      play,
      setExpression(value) {
        expression = value;
        blinkUntil = 0;
        const map = textures.get(value);
        if (map) show(map);
      },
      setFacing(facing) {
        // 옆으로 돌 때도 얼굴이 보이게 60도 정도만 돈다.
        targetYaw = facing * 1.05;
      },
      resize(width, height, stageScale) {
        cssWidth = Math.max(1, width);
        cssHeight = Math.max(1, height);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderer.setPixelRatio(dpr);
        renderer.setSize(Math.max(1, Math.round(cssWidth * stageScale)), Math.max(1, Math.round(cssHeight * stageScale)), false);
        applyCamera();
      },
      setViewShift(dx, dy, ppu) {
        if (dx === shift.dx && dy === shift.dy && ppu === shift.ppu) return;
        shift = { dx, dy, ppu };
        applyCamera();
      },
      render(dt) {
        if (disposed) return;
        const step = Math.min(Math.max(dt, 0), 0.1);
        elapsed += step;
        mixer.update(step);
        // 눈 깜빡임과 표정 바꿈
        const blink = textures.get("blink_closed");
        const wanted = textures.get(expression) ?? neutral;
        if (blinkUntil && elapsed >= blinkUntil) blinkUntil = 0;
        if (!blinkUntil && elapsed >= nextBlink && blink && !NO_BLINK.has(expression)) {
          blinkUntil = elapsed + 0.14;
          nextBlink = elapsed + 3 + Math.random() * 3.2;
        }
        show(blinkUntil && blink ? blink : wanted);
        uniforms.faceBlend.value = Math.min(1, uniforms.faceBlend.value + step / 0.12);
        const yawDifference = Math.atan2(Math.sin(targetYaw - holder.rotation.y), Math.cos(targetYaw - holder.rotation.y));
        holder.rotation.y += yawDifference * (1 - Math.exp(-step / 0.12));
        renderer.render(scene, camera);
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        mixer.stopAllAction();
        mixer.uncacheRoot(model!);
        disposeObject(scene);
        textures.forEach((texture) => texture.dispose());
        textures.clear();
        renderer.dispose();
        // 슬라이드를 넘길 때마다 새 문맥이 생기므로 바로 돌려준다(브라우저의 WebGL 문맥 수 제한).
        renderer.forceContextLoss();
      },
    };
    return api;
  } catch (error) {
    disposed = true;
    if (model) disposeObject(model);
    textures.forEach((texture) => texture.dispose());
    textures.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
}
