/* eslint-disable @typescript-eslint/no-explicit-any */
// Basic type definitions
type GL = WebGL2RenderingContext;

interface ShaderSource {
  vertex: string;
  fragment: string;
}

interface AttributeInfo {
  location: number;
  size: number;
  type: number;
}

interface UniformInfo {
  location: WebGLUniformLocation;
  type: number;
  value: any;
  isArray: false | {
    size: number;
  };
}

interface RenderPassConfig {
  name: string;
  shader: ShaderSource;
  inputs?: { [uniformName: string]: string };
  outputToScreen?: boolean;
}

// Shader program class
export class ShaderProgram {
  private gl: GL;
  private program: WebGLProgram;
  private uniforms: Map<string, UniformInfo> = new Map();
  private attributes: Map<string, AttributeInfo> = new Map();

  constructor(gl: GL, source: ShaderSource) {
    this.gl = gl;
    this.program = this.createProgram(source);
    this.detectAttributes();
    this.detectUniforms();
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}`);
    }

    return shader;
  }

  private createProgram(source: ShaderSource): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");

    const vertexShader = this.createShader(gl.VERTEX_SHADER, source.vertex);
    const fragmentShader = this.createShader(
      gl.FRAGMENT_SHADER,
      source.fragment
    );

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link error: ${info}`);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
  }

  private detectAttributes(): void {
    const gl = this.gl;
    const numAttributes = gl.getProgramParameter(
      this.program,
      gl.ACTIVE_ATTRIBUTES
    );

    for (let i = 0; i < numAttributes; i++) {
      const info = gl.getActiveAttrib(this.program, i);
      if (!info) continue;



      const location = gl.getAttribLocation(this.program, info.name);
      this.attributes.set(info.name, {
        location,
        size: info.size,
        type: info.type,
      });
    }
  }

  private detectUniforms(): void {
    const gl = this.gl;
    const numUniforms = gl.getProgramParameter(
      this.program,
      gl.ACTIVE_UNIFORMS
    );

    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(this.program, i);
      if (!info) continue;

      const location = gl.getUniformLocation(this.program, info.name);
      if (!location) continue;

      const originalName = info.name;
      const arrayRegex = /\[\d+\]$/;

      if (arrayRegex.test(originalName)) {
        const baseName = originalName.replace(arrayRegex, '');
        this.uniforms.set(baseName, {
          location,
          type: info.type,
          value: null,
          isArray: {
            size: info.size
          }
        })
      } else {
        this.uniforms.set(info.name, {
          location,
          type: info.type,
          value: null,
          isArray: false
        });
      }
    }
  }

  public use(): void {
    this.gl.useProgram(this.program);
  }

  public setUniform(name: string, value: any): void {
    const gl = this.gl;
    const uniformInfo = this.uniforms.get(name);
    if (!uniformInfo) return;

    const location = uniformInfo.location;

    if (uniformInfo.isArray && Array.isArray(value)) {
      switch (uniformInfo.type) {
        case gl.FLOAT:
          gl.uniform1fv(uniformInfo.location, value);
          break;
        case gl.FLOAT_VEC2:
          gl.uniform2fv(uniformInfo.location, value);
          break;
        case gl.FLOAT_VEC3:
          gl.uniform3fv(uniformInfo.location, value);
          break;
        case gl.FLOAT_VEC4:
          gl.uniform4fv(uniformInfo.location, value);
          break;
        // Add handlers for other uniform types as needed...
      }
    } else {
      switch (uniformInfo.type) {
        case gl.FLOAT:
          gl.uniform1f(location, value);
          break;
        case gl.FLOAT_VEC2:
          gl.uniform2fv(location, value);
          break;
        case gl.FLOAT_VEC3:
          gl.uniform3fv(location, value);
          break;
        case gl.FLOAT_VEC4:
          gl.uniform4fv(location, value);
          break;
        case gl.INT:
          gl.uniform1i(location, value);
          break;
        case gl.SAMPLER_2D:
          gl.uniform1i(location, value);
          break;
        case gl.FLOAT_MAT3:
          gl.uniformMatrix3fv(location, false, value);
          break;
        case gl.FLOAT_MAT4:
          gl.uniformMatrix4fv(location, false, value);
          break;
        // case gl.ARRAY
      }
    }
  }

  public getAttributeLocation(name: string): number {
    const attribute = this.attributes.get(name);
    return attribute ? attribute.location : -1;
  }

  public dispose(): void {
    const gl = this.gl;

    // Delete shader program
    if (this.program) {
      // Get attached shaders
      const shaders = gl.getAttachedShaders(this.program);

      // Delete each shader
      if (shaders) {
        shaders.forEach(shader => {
          gl.deleteShader(shader);
        });
      }

      // Delete program
      gl.deleteProgram(this.program);
    }

    // Clear caches
    this.uniforms.clear();
    this.attributes.clear();
  }
}

// Framebuffer class
export class FrameBuffer {
  private gl: GL;
  private fbo: WebGLFramebuffer;
  private texture: WebGLTexture;
  private depthTexture: WebGLTexture;
  private width: number;
  private height: number;

  constructor(gl: GL, width: number, height: number) {
    this.gl = gl;
    this.width = width;
    this.height = height;

    // Create FBO and attachments
    const { fbo, texture, depthTexture } = this.createFramebuffer();
    this.fbo = fbo;
    this.texture = texture;
    this.depthTexture = depthTexture;
  }

  private createFramebuffer() {
    const gl = this.gl;

    // Create and bind FBO
    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error("Failed to create framebuffer");
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    // Create color attachment
    const texture = gl.createTexture();
    if (!texture) throw new Error("Failed to create texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA16F,
      this.width,
      this.height,
      0,
      gl.RGBA,
      gl.FLOAT,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    // Create depth attachment
    const depthTexture = gl.createTexture();
    if (!depthTexture) throw new Error("Failed to create depth texture");
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.DEPTH_COMPONENT24,
      this.width,
      this.height,
      0,
      gl.DEPTH_COMPONENT,
      gl.UNSIGNED_INT,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D,
      depthTexture,
      0
    );

    // Check FBO status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer is incomplete: ${status}`);
    }

    // Unbind
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return { fbo, texture, depthTexture };
  }

  public bind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
  }

  public unbind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  public getTexture(): WebGLTexture {
    return this.texture;
  }

  public getDepthTexture(): WebGLTexture {
    return this.depthTexture;
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    // Recreate texture attachments
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA16F,
      width,
      height,
      0,
      this.gl.RGBA,
      this.gl.FLOAT,
      null
    );

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.depthTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.DEPTH_COMPONENT24,
      width,
      height,
      0,
      this.gl.DEPTH_COMPONENT,
      this.gl.UNSIGNED_INT,
      null
    );

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  public dispose(): void {
    const gl = this.gl;
    gl.deleteFramebuffer(this.fbo);
    gl.deleteTexture(this.texture);
    gl.deleteTexture(this.depthTexture);
  }
}

// Render pass class
export class RenderPass {
  private gl: GL;
  private program: ShaderProgram;
  private frameBuffer: FrameBuffer | null;
  private vao: WebGLVertexArrayObject;
  public config: RenderPassConfig;

  constructor(
    gl: GL,
    shaderSource: ShaderSource,
    outputToScreen: boolean = false
  ) {
    this.gl = gl;
    this.config = { name: "", shader: shaderSource };
    this.program = new ShaderProgram(gl, shaderSource);
    this.frameBuffer = !outputToScreen
      ? new FrameBuffer(gl, gl.canvas.width, gl.canvas.height)
      : null;
    this.vao = this.createVAO();
  }

  private createVAO(): WebGLVertexArrayObject {
    const gl = this.gl;

    // Create and bind VAO
    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create VAO");
    gl.bindVertexArray(vao);

    // Create and set up vertex buffer
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("Failed to create buffer");

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Configure vertex attributes
    const positionLoc = this.program.getAttributeLocation("a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Unbind
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return vao;
  }

  public setConfig(config: RenderPassConfig) {
    this.config = config;
  }

  public render(uniforms?: Record<string, any>): void {
    const gl = this.gl;

    // Bind FBO
    if (this.frameBuffer) {
      this.frameBuffer.bind();
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // Use shader program
    this.program.use();

    // Set uniforms
    if (uniforms) {
      let textureCount = 0;
      Object.entries(uniforms).forEach(([name, value]) => {
        if (value instanceof WebGLTexture) {
          gl.activeTexture(gl.TEXTURE0 + textureCount);
          gl.bindTexture(gl.TEXTURE_2D, value);
          this.program.setUniform(name, textureCount); // Bind as texture unit index
          textureCount += 1;
        } else {
          this.program.setUniform(name, value);
        }
      });
    }

    // Bind VAO and draw
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    // Unbind FBO
    if (this.frameBuffer) {
      this.frameBuffer.unbind();
    }
  }

  public getOutputTexture(): WebGLTexture | null {
    return this.frameBuffer ? this.frameBuffer.getTexture() : null;
  }

  public resize(width: number, height: number): void {
    if (this.frameBuffer) {
      this.frameBuffer.resize(width, height);
    }
  }

  public dispose(): void {
    if (this.frameBuffer) {
      this.frameBuffer.dispose();
    }
    this.program.dispose();

    // Get and delete vertex buffer
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    const buffer = gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.deleteBuffer(buffer);

    gl.deleteVertexArray(this.vao);
  }
}

// Multi-pass renderer class
export class MultiPassRenderer {
  private gl: GL;
  private passes: Map<string, RenderPass> = new Map();
  private passesArray: RenderPass[] = [];
  private globalUniforms: Record<string, any> = {};

  constructor(canvas: HTMLCanvasElement, configs: RenderPassConfig[]) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL 2 not supported");

    // Check floating-point texture extension
    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) throw new Error("EXT_color_buffer_float not supported");

    this.gl = gl;

    const passesArray: typeof this.passesArray = []
    for (const [index, cfg] of configs.entries()) {
      const pass = new RenderPass(gl, cfg.shader, cfg.outputToScreen);
      pass.setConfig(cfg);
      this.passes.set(cfg.name, pass);
      passesArray[index] = pass;
    }
    this.passesArray = passesArray;
  }

  public resize(width: number, height: number): void {
    this.passesArray.forEach((pass) => {
      pass.resize(width, height);
    });
  }

  /**
   * Set a global uniform applied to all render passes
   * @param name Uniform name
   * @param value Uniform value
   */
  public setUniform(name: string, value: any): void {
    this.globalUniforms[name] = value;
  }

  /**
   * Set global uniforms in batch
   * @param uniforms Uniform object
   */
  public setUniforms(uniforms: Record<string, any>): void {
    Object.assign(this.globalUniforms, uniforms);
  }

  /**
   * Clear a specific global uniform
   * @param name Uniform name
   */
  public clearUniform(name: string): void {
    delete this.globalUniforms[name];
  }

  /**
   * Clear all global uniforms
   */
  public clearAllUniforms(): void {
    this.globalUniforms = {};
  }

  public render(passUniforms?: Record<string, any>[] | Record<string, Record<string, any>>): void {
    // const gl = this.gl;

    this.passesArray.forEach((pass, index) => {
      // Merge global uniforms and pass-specific uniforms
      const uniforms: Record<string, any> = { ...this.globalUniforms };

      // Add pass-specific uniforms (if any)
      if (passUniforms) {
        if (Array.isArray(passUniforms)) {
          Object.assign(uniforms, passUniforms[index]);
        } else {
          Object.assign(uniforms, passUniforms[pass.config.name] ?? null);
        }
      }

      // Add input textures
      if (pass.config.inputs) {
        Object.entries(pass.config.inputs).forEach(([uniformName, fromPassName]) => {
          const fromPass = this.passes.get(fromPassName);
          uniforms[uniformName] = fromPass?.getOutputTexture();
        })
      }

      pass.render(uniforms);

      // Unbind textures after render
      // if (index > 0) {
      //   gl.bindTexture(gl.TEXTURE_2D, null);
      // }
    });
  }

  /**
     * Dispose all render resources
     */
  public dispose(): void {
    const gl = this.gl;

    // Dispose all render passes
    this.passes.forEach(pass => {
      pass.dispose();
    });
    this.passes.clear();
    this.clearAllUniforms();

    // Unbind any currently bound buffers
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}

// Load external texture
export function loadTextureFromURL(gl: WebGL2RenderingContext, url: string): Promise<{ texture: WebGLTexture, ratio: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = ""; // Optionally set to 'anonymous' if needed

    image.onload = () => {
      const texture = gl.createTexture();
      if (!texture) return reject("Failed to create texture");

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA,
        gl.RGBA, gl.UNSIGNED_BYTE, image
      );
      gl.generateMipmap(gl.TEXTURE_2D);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      resolve({ texture, ratio: image.naturalWidth / image.naturalHeight });
    };

    image.onerror = reject;
    image.src = url;
  });
}

export function createEmptyTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create texture");

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Leave image data empty; update each frame via texImage2D(video)

  return texture;
}

/**
 * Upload the current video frame to a GPU texture each frame.
 * @param gl WebGL2 context
 * @param texture WebGLTexture; must be created and configured beforehand
 * @param video HTMLVideoElement currently playing
 */
export function updateVideoTexture(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  video: HTMLVideoElement
) {
  if (video.readyState < video.HAVE_CURRENT_DATA) return;

  let ratio = video.videoWidth / video.videoHeight;
  if (isNaN(ratio)) {
    ratio = 1;
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // Optional: depends on whether your shader UVs are vertically flipped
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    video.videoWidth,
    video.videoHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    video
  );
  gl.generateMipmap(gl.TEXTURE_2D);

  return {
    ratio: ratio,
  }
}

