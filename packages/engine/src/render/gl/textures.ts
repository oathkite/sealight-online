import { synthesisShader, type PatternDef } from "../patterns";
import { createProgram } from "./resources";
import { QUAD_VS } from "./shaders";

export type PatternTextures = {
  /** 色の明るさ、隙間の暗さ、ざらつき、凹凸（RGBA） */
  readonly detail: WebGLTexture;
  /** 凹凸から作った法線の xy（RG） */
  readonly normals: WebGLTexture;
  readonly size: number;
};

const arrayTexture = (gl: WebGL2RenderingContext, format: number, size: number, layers: number): WebGLTexture => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.floor(Math.log2(size)) + 1, format, size, size, layers);
  return texture;
};

const finish = (gl: WebGL2RenderingContext, texture: WebGLTexture): void => {
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
  const anisotropy = gl.getExtension("EXT_texture_filter_anisotropic");
  if (anisotropy) gl.texParameterf(gl.TEXTURE_2D_ARRAY, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number));
};

/**
 * 模様を GPU で描いて、配列テクスチャの層にする（0 番は模様なし）。
 * 起動時に一度だけ描き、ミップマップを作る。size は画質の段階で決める
 */
export const createPatternTextures = (gl: WebGL2RenderingContext, patterns: readonly PatternDef[], size: number): PatternTextures => {
  const layers = patterns.length + 1;
  const detail = arrayTexture(gl, gl.RGBA8, size, layers);
  const normals = arrayTexture(gl, gl.RG8, size, layers);
  const program = createProgram(gl, QUAD_VS, synthesisShader(patterns));
  const framebuffer = gl.createFramebuffer();
  const empty = gl.createVertexArray();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  gl.viewport(0, 0, size, size);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.useProgram(program.handle);
  gl.bindVertexArray(empty);
  for (let layer = 0; layer < layers; layer += 1) {
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, detail, 0, layer);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, normals, 0, layer);
    gl.uniform1i(program.uniform("uPattern"), layer);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(framebuffer);
  gl.deleteVertexArray(empty);
  gl.deleteProgram(program.handle);
  finish(gl, detail);
  finish(gl, normals);
  return { detail, normals, size };
};
