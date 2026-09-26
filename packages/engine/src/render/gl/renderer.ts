import { frameCamera, type CameraFrame } from "../../camera/camera";
import { createMeshBuilder, type MeshData } from "../../geometry/meshBuilder";
import { supportEllipsoid } from "../../geometry/support";
import { paintTiles, type TileLayer } from "../../grid/grid";
import { identity, normalMatrix } from "../../math/mat4";
import { collectDrawables, type MeshId, type NodeDef } from "../../scene/scene";
import { FRAME_FLOATS, packFrame, sunView } from "../frame";
import type { FrameInput, ParticleSet, Water } from "../types";
import { createProgram, createShadowTarget, createTileTexture, deleteMesh, uploadMesh, uploadParticleMesh, type GpuMesh, type Program, type ShadowTarget } from "./resources";
import { MAIN_FS, MAIN_VS, PARTICLE_FS, PARTICLE_VS, SHADOW_FS, SHADOW_VS, SKY_FS, SKY_VS } from "./shaders";

export type RendererOptions = { readonly shadowSize: number };
export type RenderStats = { readonly drawCalls: number };
export type Surface = { readonly width: number; readonly height: number; readonly pixelRatio: number };

type Model = { readonly root: NodeDef; readonly meshes: Readonly<Record<MeshId, MeshData>> };
type Terrain = { readonly layer: TileLayer; readonly waters: readonly Water[] };

const EMPTY_TERRAIN: Terrain = { layer: paintTiles({ min: [0, 0], max: [0, 0] }, []), waters: [] };

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
  readonly frameBuffer: WebGLBuffer;
  readonly target: ShadowTarget;
  readonly empty: WebGLVertexArrayObject;
  readonly particles: GpuMesh & { readonly instances: WebGLBuffer };
  readonly models: Map<string, Map<MeshId, GpuMesh>>;
  statics: GpuMesh | null;
  paths: WebGLTexture;
};

type Drawn = { readonly mesh: GpuMesh; readonly matrix: Float32Array; readonly normal: Float32Array };

const createGpu = (gl: WebGL2RenderingContext, options: RendererOptions): Gpu => {
  const main = createProgram(gl, MAIN_VS, MAIN_FS);
  const shadow = createProgram(gl, SHADOW_VS, SHADOW_FS);
  const sky = createProgram(gl, SKY_VS, SKY_FS);
  const particle = createProgram(gl, PARTICLE_VS, PARTICLE_FS);
  const frameBuffer = gl.createBuffer();
  gl.bindBuffer(gl.UNIFORM_BUFFER, frameBuffer);
  gl.bufferData(gl.UNIFORM_BUFFER, FRAME_FLOATS * 4, gl.DYNAMIC_DRAW);
  for (const program of [main, sky, particle]) gl.uniformBlockBinding(program.handle, gl.getUniformBlockIndex(program.handle, "Frame"), 0);
  gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, frameBuffer);
  return {
    main, shadow, sky, particle, frameBuffer,
    target: createShadowTarget(gl, options.shadowSize),
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
export const createRenderer = (canvas: HTMLCanvasElement, options: RendererOptions) => {
  const context = canvas.getContext("webgl2", { antialias: true, powerPreference: "low-power" });
  if (!context) throw new Error("この端末では WebGL2 が使えません");
  const gl: WebGL2RenderingContext = context;
  let statics: MeshData | null = null;
  const models = new Map<string, Model>();
  let terrain = EMPTY_TERRAIN;
  let gpu: Gpu | null = null;

  const rebuild = (): void => {
    gpu = createGpu(gl, options);
    const g = gpu;
    if (statics) g.statics = uploadMesh(gl, statics);
    models.forEach((m, name) => g.models.set(name, new Map(Object.entries(m.meshes).map(([id, data]) => [id, uploadMesh(gl, data)]))));
    gl.deleteTexture(g.paths);
    g.paths = createTileTexture(gl, terrain.layer);
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

  const setTerrain = (layer: TileLayer, waters: readonly Water[]): void => {
    terrain = { layer, waters };
    if (!gpu) return;
    gl.deleteTexture(gpu.paths);
    gpu.paths = createTileTexture(gl, layer);
  };

  const shadowPass = (g: Gpu, target: ShadowTarget, lightVP: Float32Array, drawables: readonly Drawn[]): number => {
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
      terrain: { min: layer.bounds.min, size: [layer.width, layer.height] },
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

  const render = (frame: FrameInput, surface: Surface): RenderStats => {
    const g = gpu;
    if (!g || gl.isContextLost()) return { drawCalls: 0 };
    const width = Math.max(1, Math.round(surface.width * surface.pixelRatio));
    const height = Math.max(1, Math.round(surface.height * surface.pixelRatio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const camera = cameraFor(frame, surface);
    const lightVP = sunView(frame.environment.sunDirection, frame.camera.target, 10);
    const drawables = collectModels(g, frame);
    let calls = shadowPass(g, g.target, lightVP, drawables);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    uploadFrame(g, frame, camera, lightVP, [width, height]);
    skyPass(g, frame);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(g.main.handle);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g.target.texture);
    gl.uniform1i(g.main.uniform("uShadow"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, g.paths);
    gl.uniform1i(g.main.uniform("uPaths"), 1);
    if (g.statics) draw(gl, g.main, g.statics, IDENTITY, IDENTITY_NORMAL);
    drawables.forEach((d) => draw(gl, g.main, d.mesh, d.matrix, d.normal));
    calls += 2 + drawables.length + particlePass(g, frame.particles);
    return { drawCalls: calls };
  };

  /** GPU の資源を手放す。コンテキストは捨てない（同じキャンバスでエンジンを作り直せるように） */
  const dispose = (): void => {
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", rebuild);
    const g = gpu;
    gpu = null;
    if (!g || gl.isContextLost()) return;
    [g.main, g.shadow, g.sky, g.particle].forEach((p) => gl.deleteProgram(p.handle));
    [g.statics, g.particles, ...[...g.models.values()].flatMap((m) => [...m.values()])].forEach((m) => { if (m) deleteMesh(gl, m); });
    [g.target.texture, g.paths].forEach((t) => gl.deleteTexture(t));
    gl.deleteFramebuffer(g.target.framebuffer);
    gl.deleteBuffer(g.frameBuffer);
    gl.deleteVertexArray(g.empty);
  };

  return { setStatic, addModel, setTerrain, render, dispose };
};

export type Renderer = ReturnType<typeof createRenderer>;
