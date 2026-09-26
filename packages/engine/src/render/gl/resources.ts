import { VERTEX_FLOATS, type MeshData } from "../../geometry/meshBuilder";
import type { TileLayer } from "../../grid/grid";
import { PARTICLE_FLOATS } from "../types";

export type Program = {
  readonly handle: WebGLProgram;
  readonly uniform: (name: string) => WebGLUniformLocation | null;
};

const compile = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("シェーダーを作れません");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  const log = gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);
  throw new Error(log ?? "シェーダーの組み立てに失敗しました");
};

/** シェーダーを組み立てる。失敗は作りの誤りなので例外にする（createEngine が受け止めて Result にする） */
export const createProgram = (gl: WebGL2RenderingContext, vertex: string, fragment: string): Program => {
  const handle = gl.createProgram();
  const shaders: WebGLShader[] = [];
  try {
    shaders.push(compile(gl, gl.VERTEX_SHADER, vertex), compile(gl, gl.FRAGMENT_SHADER, fragment));
    shaders.forEach((shader) => gl.attachShader(handle, shader));
    gl.linkProgram(handle);
    if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(handle) ?? "シェーダーのつなぎ込みに失敗しました");
  } catch (error) {
    gl.deleteProgram(handle);
    throw error;
  } finally {
    // つなぎ込んだ後はシェーダー単体は要らない
    shaders.forEach((shader) => { gl.detachShader(handle, shader); gl.deleteShader(shader); });
  }
  const cache = new Map<string, WebGLUniformLocation | null>();
  const uniform = (name: string): WebGLUniformLocation | null => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(handle, name));
    return cache.get(name) ?? null;
  };
  return { handle, uniform };
};

export type GpuMesh = {
  readonly vao: WebGLVertexArrayObject;
  readonly count: number;
  readonly buffers: readonly WebGLBuffer[];
};

const vertexAttributes = (gl: WebGL2RenderingContext): void => {
  const stride = VERTEX_FLOATS * 4;
  for (const [location, size, offset] of [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 1, 36]] as const) {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
  }
};

export const uploadMesh = (gl: WebGL2RenderingContext, data: MeshData): GpuMesh => {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vertices = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);
  vertexAttributes(gl);
  const indices = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: data.indices.length, buffers: [vertices, indices] };
};

/** 粒のための VAO。球の頂点に、粒ごとの位置・大きさ・色（毎フレーム書き換える）を重ねる */
export const uploadParticleMesh = (gl: WebGL2RenderingContext, sphere: MeshData): GpuMesh & { readonly instances: WebGLBuffer } => {
  const mesh = uploadMesh(gl, sphere);
  gl.bindVertexArray(mesh.vao);
  const instances = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instances);
  const stride = PARTICLE_FLOATS * 4;
  for (const [location, offset] of [[4, 0], [5, 16]] as const) {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 4, gl.FLOAT, false, stride, offset);
    gl.vertexAttribDivisor(location, 1);
  }
  gl.bindVertexArray(null);
  return { ...mesh, buffers: [...mesh.buffers, instances], instances };
};

export const deleteMesh = (gl: WebGL2RenderingContext, mesh: GpuMesh): void => {
  gl.deleteVertexArray(mesh.vao);
  mesh.buffers.forEach((b) => gl.deleteBuffer(b));
};

export type ShadowTarget = { readonly framebuffer: WebGLFramebuffer; readonly texture: WebGLTexture; readonly size: number };

/** 影の地図。深さだけを描き、比べて読む（2×2 の滑らかな判定をハードウェアに任せる） */
export const createShadowTarget = (gl: WebGL2RenderingContext, size: number): ShadowTarget => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
  const params: readonly (readonly [number, number])[] = [
    [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
    [gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE], [gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL],
  ];
  params.forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { framebuffer, texture, size };
};

/** マスごとの値の地図を、なめらかに読める小さなテクスチャにする。道の縁が丸くなる */
export const createTileTexture = (gl: WebGL2RenderingContext, layer: TileLayer): WebGLTexture => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, layer.width, layer.height, 0, gl.RED, gl.UNSIGNED_BYTE, layer.data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
};
