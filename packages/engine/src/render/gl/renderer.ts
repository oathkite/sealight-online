import { frameCamera, type CameraFrame } from "../../camera/camera";
import { createMeshBuilder, type MeshData } from "../../geometry/meshBuilder";
import { supportEllipsoid } from "../../geometry/support";
import { paintTiles, type TileLayer } from "../../grid/grid";
import { identity, normalMatrix } from "../../math/mat4";
import { collectDrawables, type MeshId, type NodeDef } from "../../scene/scene";
import { readDevice } from "../../device";
import { detectTier, qualityFor, type Quality } from "../../quality";
import { FRAME_FLOATS, packFrame, sunView } from "../frame";
import { patternScales, type PatternDef } from "../patterns";
import type { ClothDraw, Foliage, FrameInput, ParticleSet, Water } from "../types";
import { createGpuCloth, deleteGpuCloth, updateGpuCloth, type GpuCloth } from "./cloth";
import { deleteFoliage, uploadFoliage, type GpuFoliage } from "./foliage";
import { createProgram, createShadowTarget, createTileTexture, deleteMesh, uploadMesh, uploadParticleMesh, type GpuMesh, type Program, type ShadowTarget } from "./resources";
import { CLOTH_FS, CLOTH_VS, FOLIAGE_FS, FOLIAGE_VS, MAIN_FS, MAIN_VS, PARTICLE_FS, PARTICLE_VS, SHADOW_FS, SHADOW_VS, SKY_FS, SKY_VS, withTriplanar } from "./shaders";
import { createPatternTextures, type PatternTextures } from "./textures";

/** quality を "auto" にすると、端末の性能から段階を選ぶ */
export type RendererOptions = { readonly quality: Quality | "auto"; readonly patterns: readonly PatternDef[] };
type ResolvedOptions = { readonly quality: Quality; readonly patterns: readonly PatternDef[] };
export type RenderStats = { readonly drawCalls: number };
export type Surface = { readonly width: number; readonly height: number; readonly pixelRatio: number };

type Model = { readonly root: NodeDef; readonly meshes: Readonly<Record<MeshId, MeshData>> };
/** 地面。道の地図、水面、草・道・砂の模様の番号 */
type Terrain = { readonly layer: TileLayer; readonly waters: readonly Water[]; readonly patterns: readonly [number, number, number] };

const EMPTY_TERRAIN: Terrain = { layer: paintTiles({ min: [0, 0], max: [0, 0] }, []), waters: [], patterns: [0, 0, 0] };

const particleSphere = (): MeshData => {
  const builder = createMeshBuilder();
  builder.hull(supportEllipsoid([1, 1, 1]), { color: [1, 1, 1], material: 0, detail: 1 });
  return builder.build();
};

/** GPU 側の資源。WebGL が失われたら捨てて、CPU 側に残した元データから作り直す */
type Gpu = {
  readonly main: Program;
  readonly shadow: Program;
  readonly sky: Program;
  readonly particle: Program;
  readonly foliageProgram: Program;
  readonly clothProgram: Program;
  readonly cloths: GpuCloth[];
  readonly frameBuffer: WebGLBuffer;
  readonly target: ShadowTarget;
  readonly empty: WebGLVertexArrayObject;
  readonly particles: GpuMesh & { readonly instances: WebGLBuffer };
  readonly textures: PatternTextures;
  readonly models: Map<string, Map<MeshId, GpuMesh>>;
  statics: GpuMesh | null;
  foliage: GpuFoliage | null;
  paths: WebGLTexture;
};

type Drawn = { readonly mesh: GpuMesh; readonly matrix: Float32Array; readonly normal: Float32Array };

const createGpu = (gl: WebGL2RenderingContext, options: ResolvedOptions): Gpu => {
  const main = createProgram(gl, MAIN_VS, withTriplanar(MAIN_FS, options.quality.triplanar));
  const shadow = createProgram(gl, SHADOW_VS, SHADOW_FS);
  const sky = createProgram(gl, SKY_VS, SKY_FS);
  const particle = createProgram(gl, PARTICLE_VS, PARTICLE_FS);
  const foliageProgram = createProgram(gl, FOLIAGE_VS, FOLIAGE_FS);
  const clothProgram = createProgram(gl, CLOTH_VS, CLOTH_FS);
  const frameBuffer = gl.createBuffer();
  gl.bindBuffer(gl.UNIFORM_BUFFER, frameBuffer);
  gl.bufferData(gl.UNIFORM_BUFFER, FRAME_FLOATS * 4, gl.DYNAMIC_DRAW);
  for (const program of [main, shadow, sky, particle, foliageProgram, clothProgram]) gl.uniformBlockBinding(program.handle, gl.getUniformBlockIndex(program.handle, "Frame"), 0);
  gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, frameBuffer);
  const textures = createPatternTextures(gl, options.patterns, options.quality.textureSize);
  // テクスチャの番号と、模様ごとの繰り返しの細かさは、作ったときに一度だけ渡す
  gl.useProgram(main.handle);
  gl.uniform1i(main.uniform("uShadow"), 0);
  gl.uniform1i(main.uniform("uPaths"), 1);
  gl.uniform1i(main.uniform("uDetail"), 2);
  gl.uniform1i(main.uniform("uNormals"), 3);
  gl.uniform1fv(main.uniform("uScales"), patternScales(options.patterns));
  gl.useProgram(foliageProgram.handle);
  gl.uniform1i(foliageProgram.uniform("uShadow"), 0);
  gl.useProgram(clothProgram.handle);
  gl.uniform1i(clothProgram.uniform("uShadow"), 0);
  gl.uniform1i(clothProgram.uniform("uDetail"), 2);
  return {
    main, shadow, sky, particle, foliageProgram, clothProgram, frameBuffer, textures,
    cloths: [],
    foliage: null,
    target: createShadowTarget(gl, options.quality.shadowSize),
    empty: gl.createVertexArray(),
    particles: uploadParticleMesh(gl, particleSphere()),
    statics: null,
    models: new Map(),
    paths: createTileTexture(gl, EMPTY_TERRAIN.layer),
  };
};

const IDENTITY = identity();
const IDENTITY_NORMAL = normalMatrix(0, [1, 1, 1]);

const draw = (gl: WebGL2RenderingContext, program: Program, mesh: GpuMesh, model: Float32Array, normal: Float32Array | null): void => {
  gl.uniformMatrix4fv(program.uniform("uModel"), false, model);
  if (normal) gl.uniformMatrix3fv(program.uniform("uNormal"), false, normal);
  gl.bindVertexArray(mesh.vao);
  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
};

/**
 * 描画の本体。影の地図 → 空 → 動かない物とモデル → 粒 の順に描く
 */
export const createRenderer = (canvas: HTMLCanvasElement, requested: RendererOptions) => {
  const context = canvas.getContext("webgl2", { antialias: true, powerPreference: "low-power" });
  if (!context) throw new Error("この端末では WebGL2 が使えません");
  const gl: WebGL2RenderingContext = context;
  const quality = requested.quality === "auto" ? qualityFor(detectTier(readDevice(gl))) : requested.quality;
  const options: ResolvedOptions = { quality, patterns: requested.patterns };
  let statics: MeshData | null = null;
  const models = new Map<string, Model>();
  let terrain = EMPTY_TERRAIN;
  let foliage: Foliage | null = null;
  let gpu: Gpu | null = null;

  // 布の器ごとに、最後に送った形。前のフレームと同じ形なら送り直さない（布を止めているとき）
  const uploaded: ClothDraw["mesh"][] = [];

  const rebuild = (): void => {
    uploaded.length = 0;
    gpu = createGpu(gl, options);
    const g = gpu;
    if (statics) g.statics = uploadMesh(gl, statics);
    models.forEach((m, name) => g.models.set(name, new Map(Object.entries(m.meshes).map(([id, data]) => [id, uploadMesh(gl, data)]))));
    gl.deleteTexture(g.paths);
    g.paths = createTileTexture(gl, terrain.layer);
    if (foliage) g.foliage = uploadFoliage(gl, foliage.data);
  };
  const onLost = (e: Event): void => { e.preventDefault(); gpu = null; };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", rebuild);
  rebuild();

  const setStatic = (data: MeshData): void => {
    statics = data;
    if (!gpu) return;
    if (gpu.statics) deleteMesh(gl, gpu.statics);
    gpu.statics = uploadMesh(gl, data);
  };

  const addModel = (name: string, root: NodeDef, meshes: Readonly<Record<MeshId, MeshData>>): void => {
    models.set(name, { root, meshes });
    if (!gpu) return;
    gpu.models.get(name)?.forEach((m) => deleteMesh(gl, m));
    gpu.models.set(name, new Map(Object.entries(meshes).map(([id, data]) => [id, uploadMesh(gl, data)])));
  };

  const setTerrain = (layer: TileLayer, waters: readonly Water[], patterns: readonly [number, number, number]): void => {
    terrain = { layer, waters, patterns };
    if (!gpu) return;
    gl.deleteTexture(gpu.paths);
    gpu.paths = createTileTexture(gl, layer);
  };

  /** 一面の草を置き換える */
  const setFoliage = (next: Foliage): void => {
    foliage = next;
    if (!gpu) return;
    if (gpu.foliage) deleteFoliage(gl, gpu.foliage);
    gpu.foliage = uploadFoliage(gl, next.data);
  };

  const foliagePass = (g: Gpu): number => {
    if (!g.foliage || !foliage || g.foliage.count === 0) return 0;
    gl.useProgram(g.foliageProgram.handle);
    gl.uniform3fv(g.foliageProgram.uniform("uGrass"), foliage.color);
    gl.bindVertexArray(g.foliage.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, g.foliage.bladeVertices, g.foliage.count);
    return 1;
  };

  /** 布を器に送り込む。器が足りなければ足す。描く添字の数を返す */
  const uploadCloths = (g: Gpu, cloths: readonly ClothDraw[]): number[] =>
    cloths.map((cloth, i) => {
      const slot = g.cloths[i] ?? createGpuCloth(gl);
      g.cloths[i] = slot;
      if (uploaded[i] !== cloth.mesh) updateGpuCloth(gl, slot, cloth.mesh);
      uploaded[i] = cloth.mesh;
      return cloth.mesh.indices.length;
    });

  const clothPass = (g: Gpu, cloths: readonly ClothDraw[], counts: readonly number[]): number => {
    if (cloths.length === 0) return 0;
    gl.useProgram(g.clothProgram.handle);
    cloths.forEach((cloth, i) => {
      gl.uniform3fv(g.clothProgram.uniform("uCloth"), cloth.color);
      gl.uniform1f(g.clothProgram.uniform("uClothPattern"), cloth.pattern);
      gl.bindVertexArray(g.cloths[i]?.vao ?? null);
      gl.drawElements(gl.TRIANGLES, counts[i] ?? 0, gl.UNSIGNED_INT, 0);
    });
    return cloths.length;
  };

  const shadowPass = (g: Gpu, target: ShadowTarget, lightVP: Float32Array, drawables: readonly Drawn[], clothCounts: readonly number[]): number => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, target.size, target.size);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2, 3);
    gl.useProgram(g.shadow.handle);
    gl.uniformMatrix4fv(g.shadow.uniform("uLightVPs"), false, lightVP);
    if (g.statics) draw(gl, g.shadow, g.statics, IDENTITY, null);
    drawables.forEach((d) => draw(gl, g.shadow, d.mesh, d.matrix, null));
    gl.uniformMatrix4fv(g.shadow.uniform("uModel"), false, IDENTITY);
    clothCounts.forEach((count, i) => {
      gl.bindVertexArray(g.cloths[i]?.vao ?? null);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
    });
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return drawables.length + 1;
  };

  const collectModels = (g: Gpu, frame: FrameInput): Drawn[] =>
    frame.models.flatMap((instance) => {
      const model = models.get(instance.model);
      const meshes = g.models.get(instance.model);
      if (!model || !meshes) return [];
      return collectDrawables(model.root, instance.pose, instance.placement).flatMap((d) => {
        const mesh = meshes.get(d.mesh);
        return mesh ? [{ mesh, matrix: d.matrix, normal: d.normal }] : [];
      });
    });

  const skyPass = (g: Gpu, frame: FrameInput): void => {
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(g.sky.handle);
    gl.uniform3fv(g.sky.uniform("uTop"), frame.environment.skyTop);
    gl.uniform2f(g.sky.uniform("uSkyParams"), frame.environment.stars, frame.environment.clouds);
    gl.bindVertexArray(g.empty);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const particlePass = (g: Gpu, sets: readonly ParticleSet[]): number => {
    const visible = sets.filter((s) => s.count > 0);
    if (visible.length === 0) return 0;
    gl.useProgram(g.particle.handle);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.bindVertexArray(g.particles.vao);
    for (const set of visible) {
      gl.blendFunc(gl.SRC_ALPHA, set.blend === "additive" ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(g.particle.uniform("uAdditive"), set.blend === "additive" ? 1 : 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.particles.instances);
      gl.bufferData(gl.ARRAY_BUFFER, set.data, gl.DYNAMIC_DRAW);
      gl.drawElementsInstanced(gl.TRIANGLES, g.particles.count, gl.UNSIGNED_INT, 0, set.count);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return visible.length;
  };

  const uploadFrame = (g: Gpu, frame: FrameInput, camera: CameraFrame, lightVP: Float32Array, size: readonly [number, number]): void => {
    const { layer } = terrain;
    const data = packFrame({
      environment: { ...frame.environment, fog: { near: frame.environment.fog.near + camera.distance, far: frame.environment.fog.far + camera.distance } },
      viewProjection: camera.viewProjection, lightViewProjection: lightVP,
      eye: camera.eye, time: frame.time, focus: [frame.camera.target[0], frame.camera.target[2]], forward: camera.forward,
      viewport: size, shadowSize: g.target.size, waters: terrain.waters,
      terrain: { min: layer.bounds.min, size: [layer.width, layer.height] }, terrainPatterns: terrain.patterns,
    });
    gl.bindBuffer(gl.UNIFORM_BUFFER, g.frameBuffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
  };

  // カメラの枠は、カメラの設定と画面の大きさが変わったときだけ計算し直す（毎フレームの二分探索を避ける）
  let cachedCamera: { readonly key: string; readonly rig: FrameInput["camera"]; readonly frame: CameraFrame } | null = null;
  const cameraFor = (frame: FrameInput, surface: Surface): CameraFrame => {
    const { visible } = frame;
    const key = `${surface.width}x${surface.height}:${visible.x},${visible.y},${visible.width},${visible.height}`;
    if (cachedCamera?.key === key && cachedCamera.rig === frame.camera) return cachedCamera.frame;
    const computed = frameCamera(frame.camera, surface, visible);
    cachedCamera = { key, rig: frame.camera, frame: computed };
    return computed;
  };

  const bindTextures = (g: Gpu): void => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g.target.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, g.paths);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, g.textures.detail);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, g.textures.normals);
  };

  const render = (frame: FrameInput, surface: Surface): RenderStats => {
    const g = gpu;
    if (!g || gl.isContextLost()) return { drawCalls: 0 };
    const width = Math.max(1, Math.round(surface.width * surface.pixelRatio));
    const height = Math.max(1, Math.round(surface.height * surface.pixelRatio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const camera = cameraFor(frame, surface);
    const lightVP = sunView(frame.environment.sunDirection, frame.camera.target, 10);
    const drawables = collectModels(g, frame);
    const clothCounts = uploadCloths(g, frame.cloths);
    // 影の地図でも風と時刻を使うので、フレーム共通の値を先に送る
    uploadFrame(g, frame, camera, lightVP, [width, height]);
    let calls = shadowPass(g, g.target, lightVP, drawables, clothCounts);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    skyPass(g, frame);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(g.main.handle);
    bindTextures(g);
    if (g.statics) draw(gl, g.main, g.statics, IDENTITY, IDENTITY_NORMAL);
    drawables.forEach((d) => draw(gl, g.main, d.mesh, d.matrix, d.normal));
    calls += 2 + drawables.length + foliagePass(g) + clothPass(g, frame.cloths, clothCounts) + particlePass(g, frame.particles);
    return { drawCalls: calls };
  };

  /** GPU の資源を手放す。コンテキストは捨てない（同じキャンバスでエンジンを作り直せるように） */
  const dispose = (): void => {
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", rebuild);
    const g = gpu;
    gpu = null;
    if (!g || gl.isContextLost()) return;
    [g.main, g.shadow, g.sky, g.particle, g.foliageProgram, g.clothProgram].forEach((p) => gl.deleteProgram(p.handle));
    g.cloths.forEach((c) => deleteGpuCloth(gl, c));
    if (g.foliage) deleteFoliage(gl, g.foliage);
    [g.statics, g.particles, ...[...g.models.values()].flatMap((m) => [...m.values()])].forEach((m) => { if (m) deleteMesh(gl, m); });
    [g.target.texture, g.paths, g.textures.detail, g.textures.normals].forEach((t) => gl.deleteTexture(t));
    gl.deleteFramebuffer(g.target.framebuffer);
    gl.deleteBuffer(g.frameBuffer);
    gl.deleteVertexArray(g.empty);
  };

  return { setStatic, addModel, setTerrain, setFoliage, render, dispose, quality };
};

export type Renderer = ReturnType<typeof createRenderer>;
