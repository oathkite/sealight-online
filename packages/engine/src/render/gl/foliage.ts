import { FOLIAGE_FLOATS } from "../types";

export type GpuFoliage = {
  readonly vao: WebGLVertexArrayObject;
  readonly bladeVertices: number;
  readonly buffers: readonly WebGLBuffer[];
  readonly count: number;
};

/**
 * 草の葉 1 枚の形。x は幅の方向（-0.5〜0.5）、y は根元 0 から先 1、z は前へのしなり。
 * 3 段に細くなり、先は 1 点に尖る（三角形の帯）
 */
const bladeShape = (): Float32Array => {
  const points: number[] = [];
  const rows = 3;
  for (let i = 0; i < rows; i += 1) {
    const y = i / rows;
    const w = 0.5 * (1 - y) ** 0.8;
    const bend = y * y * 0.35;
    points.push(-w, y, bend, w, y, bend);
  }
  points.push(0, 1, 0.35);
  return new Float32Array(points);
};

const BLADE = bladeShape();

/** 草を GPU に送る。葉の形は共通で、草ごとの位置や高さはインスタンスの数として渡す */
export const uploadFoliage = (gl: WebGL2RenderingContext, data: Float32Array): GpuFoliage => {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const blade = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, blade);
  gl.bufferData(gl.ARRAY_BUFFER, BLADE, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
  const instances = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instances);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  for (const [location, offset] of [[4, 0], [5, 16]] as const) {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 4, gl.FLOAT, false, FOLIAGE_FLOATS * 4, offset);
    gl.vertexAttribDivisor(location, 1);
  }
  gl.bindVertexArray(null);
  return { vao, bladeVertices: BLADE.length / 3, buffers: [blade, instances], count: data.length / FOLIAGE_FLOATS };
};

export const deleteFoliage = (gl: WebGL2RenderingContext, foliage: GpuFoliage): void => {
  gl.deleteVertexArray(foliage.vao);
  foliage.buffers.forEach((b) => gl.deleteBuffer(b));
};
