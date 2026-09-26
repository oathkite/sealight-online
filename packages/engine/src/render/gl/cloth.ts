import type { ClothMeshData } from "../../physics/cloth";

export type GpuCloth = {
  readonly vao: WebGLVertexArrayObject;
  readonly buffers: readonly [WebGLBuffer, WebGLBuffer, WebGLBuffer, WebGLBuffer];
};

/** 布の器。位置・法線・uv・添字の 4 本のバッファを持ち、毎フレーム中身を差し替える */
export const createGpuCloth = (gl: WebGL2RenderingContext): GpuCloth => {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffers = [gl.createBuffer(), gl.createBuffer(), gl.createBuffer(), gl.createBuffer()] as const;
  ([[0, 3], [1, 3], [2, 2]] as const).forEach(([location, size], i) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[i] ?? null);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  });
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers[3]);
  gl.bindVertexArray(null);
  return { vao, buffers };
};

/** 布の形を送り込み、描く三角形の添字の数を返す */
export const updateGpuCloth = (gl: WebGL2RenderingContext, cloth: GpuCloth, mesh: ClothMeshData): number => {
  gl.bindVertexArray(cloth.vao);
  [mesh.positions, mesh.normals, mesh.uvs].forEach((data, i) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, cloth.buffers[i] ?? null);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  });
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.DYNAMIC_DRAW);
  return mesh.indices.length;
};

export const deleteGpuCloth = (gl: WebGL2RenderingContext, cloth: GpuCloth): void => {
  gl.deleteVertexArray(cloth.vao);
  cloth.buffers.forEach((b) => gl.deleteBuffer(b));
};
