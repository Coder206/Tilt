/*
 * jTiltEngine.js - Helper low-level functions for WebGL
 * version 0.1
 *
 * Copyright (c) 2011 Victor Porof
 *
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 *    1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 *
 *    2. Altered source versions must be plainly marked as such, and must not
 *    be misrepresented as being the original software.
 *
 *    3. This notice may not be removed or altered from any source
 *    distribution.
 */
if ("undefined" === typeof(Tilt)) {
  var Tilt = {};
}

var EXPORTED_SYMBOLS = ["Tilt.Engine"];

/**
 * Tilt engine constructor.
 *
 * @return {object} the created object
 */
Tilt.Engine = function() {

  /**
   * By convention, we make a private 'that' variable.
   */
  var that = this;

  /**
   * WebGL context to be used.
   */
  var gl = null;

  /**
   * The current shader used by the WebGL context. Used for caching.
   */
  var program = null;
  
  /**
   * Initializes a WebGL context, and runs fail or success callback functions.
   *
   * @param {object} canvas: the canvas to create the WebGL context with
   * @param {function} successCallback: to be called if initialization worked
   * @param {function} failCallback: to be called if initialization failed
   * @return {object} the created gl context if successful, null otherwise
   */
  this.initWebGL = function(canvas, failCallback, successCallback) {
    gl = create3DContext(canvas, { 
      antialias: true,
      antialiasHint: true });
    
    if (gl) {
      gl = gl;
      if ("function" === typeof(successCallback)) {
        successCallback();
      }
    }
    else {
      Tilt.Utils.Console.log(Tilt.Utils.StringBundle.get("initWebGL.error"));
      if ("function" === typeof(failCallback)) {
        failCallback();
      }
    }
    
    // helper function to create a 3D context in a cross browser way
    function create3DContext(canvas, opt_attribs) {
      var names = ["experimental-webgl", "webgl", "webkit-3d", "moz-webgl"];
      var context = null;
      for (var i = 0; i < names.length; ++i) {
        try {
          context = canvas.getContext(names[i], opt_attribs);
        } catch(e) { }

        if (context) {
          break;
        }
      }
      return context;
    }
    return gl;
  };
  
  /**
   * Initializes a shader program, using specified sources.
   * The ready callback function will have as a parameter the newly created
   * shader program, by compiling and linking the vertex and fragment shader.
   *
   * @param {string} vertShaderSrc: the vertex shader source
   * @param {string} fragShaderSrc: the fragment shader source
   * @param {function} readyCallback: the function called when loading is done
   */
  this.initProgram = function(vertShaderSrc, fragShaderSrc, readyCallback) {
    var vertShader = that.compileShader(vertShaderSrc, "x-shader/x-vertex");
    var fragShader = that.compileShader(fragShaderSrc, "x-shader/x-fragment");
    
    vertShader.src = vertShaderSrc;
    fragShader.src = fragShaderSrc;
    
    if ("function" === typeof(readyCallback)) {
      readyCallback(that.linkProgram(vertShader, fragShader));
    }
  };
  
  /**
   * Initializes a shader program, using sources located at a specific url.
   * If only two params are specified (the shader name and the readyCallback 
   * function), then ".fs" and ".vs" extensions will be automatically used).
   * The ready callback function will have as a parameter the newly created
   * shader program, by compiling and linking the vertex and fragment shader.
   *
   * @param {string} vertShaderURL: the vertex shader resource
   * @param {string} fragShaderURL: the fragment shader resource
   * @param {function} readyCallback: the function called when loading is done
   */
  this.initProgramAt = function(vertShaderURL, fragShaderURL, readyCallback) {
    if (arguments.length === 2) {
      readyCallback = fragShaderURL;
      fragShaderURL = vertShaderURL + ".fs";
      vertShaderURL = vertShaderURL + ".vs";
    }
    
    that.requests([vertShaderURL, fragShaderURL], function(http) {
      var vertShader = that.compileShader(http[0].responseText,
                                          "x-shader/x-vertex");

      var fragShader = that.compileShader(http[1].responseText,
                                          "x-shader/x-fragment");

      vertShader.src = http[0].responseText;
      fragShader.src = http[1].responseText;
      
      if ("function" === typeof(readyCallback)) {
        readyCallback(that.linkProgram(vertShader, fragShader));
      }
    });
  };
  
  /**
   * Compiles a shader source of pecific type, either vertex or fragment.
   *
   * @param {string} shaderSource: the source code for the shader
   * @param {string} shaderType: the shader type ('x-vertex' or 'x-fragment')
   * @return {object} the compiled shader
   */
  this.compileShader = function(shaderSource, shaderType) {
    var shader;

    if (!shaderSource) {
      shaderSource = "undefined";
      Tilt.Utils.Console.error(Tilt.Utils.StringBundle.get(
        "compileShader.source.error"));

      return null;
    }

    if ("x-shader/x-vertex" === shaderType) {
      shader = gl.createShader(gl.VERTEX_SHADER);
    }
    else if ("x-shader/x-fragment" === shaderType) {
      shader = gl.createShader(gl.FRAGMENT_SHADER);
    }
    else {
      Tilt.Utils.Console.error(Tilt.Utils.StringBundle.format(
        "compileShader.type.error"), [shaderSource]);
        
      return null;
    }

    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var status = gl.getShaderInfoLog(shader);

      Tilt.Utils.Console.error(Tilt.Utils.StringBundle.format(
        "compileShader.compile.error"), [status]);

      return null;
    }
    return shader;
  };

  /**
   * Links two compiled vertex or fragment shaders together to form a program.
   *
   * @param {object} vertShader: the compiled vertex shader
   * @param {object} fragShader: the compiled fragment shader
   * @return {object} the newly created and linked shader program
   */
  this.linkProgram = function(vertShader, fragShader) {
    var program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var status = gl.getProgramInfoLog(shader);
      
      Tilt.Utils.Console.error(Tilt.Utils.StringBundle.format(
        "linkProgram.error", [status, vertShader.src, fragShader.src]));
    }
    
    return program;
  };
  
  /**
   * Uses the shader program as current for the gl context.
   *
   * @param {object} program: the shader program to be used by the engine
   * @param {array} attributes: array of attributes to enable for this shader
   */
  this.useProgram = function(program_, attributes) {
    if (program !== program_) {
      gl.useProgram(program = program_);
      
      for (var i = 0, len = attributes.length; i < len; i++) {
        gl.enableVertexAttribArray(attributes[i]);
      }
    }
  };

  /**
   * Gets a shader attribute location from a program.
   *
   * @param {object} program: the shader program to obtain the attribute from
   * @param {string} attribute: the attribute name
   * @return {number} the attribute location from the program
   */
  this.shaderAttribute = function(program, attribute) {
    var value = gl.getAttribLocation(program, attribute);
    value.cache = [];
    
    return value;
  };

  /**
   * Gets a shader uniform location from a program.
   *
   * @param {object} program: the shader program to obtain the uniform from
   * @param {string} uniform: the uniform name
   * @return {object} the uniform object from the program
   */
  this.shaderUniform = function(program, uniform) {
    var value = gl.getUniformLocation(program, uniform);
    value.cache = [];
    
    return value;
  };

  /**
   * Gets a generic shader variable (attribute or uniform) from a program.
   * If an attribute is found, the attribute location will be returned.
   * Otherwise, the uniform will be searched and returned if found.
   *
   * @param {object} program: the shader program to obtain the uniform from
   * @param {string} variable: the attribute or uniform name
   * @return {number} or {object} the attribute or uniform from the program
   */
  this.shaderIO = function(program, variable) {
    var location = that.shaderAttribute(program, variable);
    if (location < 0) {
      location = that.shaderUniform(program, variable);
    }
    return location;
  };
  /**
   * Binds a vertex buffer as an array buffer for a specific shader attribute
   *
   * @param {number} attribute: the attribute obtained from the shader
   * @param {object} buffer: the buffer to bind
   */
  this.bindVertexBuffer = function(attribute, buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(attribute, buffer.itemSize, gl.FLOAT, false, 0, 0);    
  };
  
  /**
   * Binds a uniform matrix.
   *
   * @param {object} uniform: the uniform to bind the variable to
   * @param {object} variable: the variable to be binded
   */
  this.bindUniformMatrix = function(uniform, variable) {
    gl.uniformMatrix4fv(uniform, false, variable);
  };
  
  /**
   * Binds a uniform vector of 4 elements.
   *
   * @param {object} uniform: the uniform to bind the variable to
   * @param {object} variable: the variable to be binded
   */
  this.bindUniformVec4 = function(uniform, variable) {
    gl.uniform4fv(uniform, variable);
  };
  
  /**
   * Binds a uniform texture to a sampler.
   *
   * @param {object} sampler: the sampler to bind the texture to
   * @param {object} texture: the texture to be binded
   */
  this.bindTexture = function(sampler, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(sampler, 0);
  };
  
  /**
   * Binds a framebuffer to the current WebGL context.
   * 
   * @param {object} framebuffer: the framebuffer to bind
   */
  this.bindFramebuffer = function(framebuffer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  };
  
  /**
   * Initializes buffer data to be used for drawing, using an array of floats.
   * The 'numItems' can be specified to use only a portion of the array.
   *
   * @param {array} elementsArray: an array of floats
   * @param {number} itemSize: how many items create a block
   * @param {number} numItems: optional, how many items to use from the array
   * @return {object} the initialized buffer
   */
  this.initBuffer = function(elementsArray, itemSize, numItems) {
    if ("undefined" === typeof(numItems)) {
      numItems = elementsArray.length / itemSize;
    }
    
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(elementsArray),
                  gl.STATIC_DRAW);
    
    buffer.array = elementsArray;
    buffer.itemSize = itemSize;
    buffer.numItems = numItems;
    
    return buffer;
  };
  
  /**
   * Initializez a buffer of vertex indices, using an array of unsigned ints.
   * The item size will automatically default to 1, and the numItems will be
   * equal to the number of items in the array.
   *
   * @param {array} elementsArray: an array of unsigned integers
   * @param {number} numItems: how many items to use from the array
   * @return {object} the initialized index buffer
   */
  this.initIndexBuffer = function(elementsArray, numItems) {
    if ("undefined" === typeof(numItems)) {
      numItems = elementsArray.length;
    }
    
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(elementsArray),
                  gl.STATIC_DRAW);
                  
    buffer.array = elementsArray;
    buffer.itemSize = 1;
    buffer.numItems = numItems;

    return buffer;
  };
  
  /**
   * Initializes a framebuffer, with an attached texture and depth buffer.
   * The returned object contains the framebuffer, texture, depth and stencil
   * objects.
   * 
   * @param {number} width: the width of the framebuffer
   * @param {number} height: the height of the framebuffer
   */
  this.initOffscreenBuffer = function(width, height) {
    var framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    framebuffer.width = width;
    framebuffer.height = height;
    
    // TODO: add custom texture format
    var texture = gl.createTexture();
    texture.framebuffer = framebuffer;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                  framebuffer.width, framebuffer.height, 0,
                  gl.RGBA, gl.UNSIGNED_BYTE, null);
                  
    that.setTextureParams("linear", "linear", false, "clamp", "clamp");
    
    // TODO: add custom depth format (16, 24, 32)
    var depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 
                           framebuffer.width, framebuffer.height);
                           
    // TODO: add support for stencil buffer
    var stencil = null;

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, 
                            gl.TEXTURE_2D, texture, 0);
                            
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, 
                               gl.RENDERBUFFER, depth);
                               
  	if (!gl.checkFramebufferStatus(gl.FRAMEBUFFER)) {
        var status = gl.checkFramebufferStatus(GL_FRAMEBUFFER);

        Tilt.Utils.Console.error(Tilt.Utils.StringBundle.format(
          "initOffscreenBuffer.framebuffer.error"), [status]);
  	}
  	
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    return {
      framebuffer: framebuffer,
      texture: texture,
      depth: depth,
      stencil: stencil
    };
  };
  
  /**
   * Initializes a texture from a source, calls a callback function when
   * ready. The source may be an url or a pre-existing image or canvas. If the
   * source is an already loaded image, the texture is immediately created.
   *
   * @param {object} or {string} textureSource: the texture source
   * @param {function} readyCallback: function called when loading is finished
   * @param {string} fillColor: optional, color to fill the transparent bits
   * @param {string} strokeColor: optional, color to draw an outline
   * @param {number} strokeWeight: optional, the width of the outline
   * @param {string} minFilter: either 'nearest' or 'linear'
   * @param {string} magFilter: either 'nearest' or 'linear'
   * @param {boolean} mipmap: true if should generate mipmap
   * @param {string} wrapS: either 'repeat' or null
   * @param {string} wrapT: either 'repeat' or null
   */
  this.initTexture = function(textureSource, readyCallback,
                              fillColor, strokeColor, strokeWeight,
                              minFilter, magFilter, mipmap,
                              wrapS, wrapT) {
                                
    var texture = gl.createTexture();
    
    if ("object" === typeof(textureSource)) {
      texture.image = textureSource;
      bindTextureImage();
    }
    else if ("string" === typeof(textureSource)) {
      texture.image = new Image();
      texture.image.src = textureSource;
      texture.image.onload = function() {
        bindTextureImage();
      };
    }
    
    // Used internally for binding an image to a texture object
    function bindTextureImage() {
      Tilt.Utils.Image.resizeToPowerOfTwo(texture.image, function(image) {
        texture.image = image;
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
                      texture.image);

        that.setTextureParams(minFilter, magFilter, mipmap, wrapS, wrapT);
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        if ("function" === typeof(readyCallback)) {
          readyCallback(texture);
        }
      }, fillColor, strokeColor, strokeWeight, true);
    }
  };
  
  /**
   * Sets texture parameters for the current texture binding.
   * Optionally, you can also (re)set the current texture binding manually.
   *
   * @param {string} minFilter: either 'nearest' or 'linear'
   * @param {string} magFilter: either 'nearest' or 'linear'
   * @param {object} mipmap: either 'mipmap' or null
   * @param {string} wrapS: either 'repeat' or null
   * @param {string} wrapT: either 'repeat' or null
   * @param {object} texture: optional texture to replace the current binding
   */
  this.setTextureParams = function(minFilter, magFilter, mipmap,
                                   wrapS, wrapT, texture) {
    if (texture) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
    }
        
    if ("nearest" === minFilter) {
      gl.texParameteri(gl.TEXTURE_2D,
                       gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    }
    else if ("linear" === minFilter && mipmap) {
      gl.texParameteri(gl.TEXTURE_2D,
                       gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    else {
      gl.texParameteri(gl.TEXTURE_2D,
                       gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    if ("nearest" === magFilter) {
      gl.texParameteri(gl.TEXTURE_2D,
                       gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    else if ("linear" === magFilter && mipmap) {
      gl.texParameteri(gl.TEXTURE_2D,
                       gl.TEXTURE_MAG_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    else {
      gl.texParameteri(gl.TEXTURE_2D,
                       gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }

    if ("repeat" === wrapS) {
      gl.texParameteri(gl.TEXTURE_2D,
                       gl.TEXTURE_WRAP_S, gl.REPEAT);
    }
    else {
      gl.texParameteri(gl.TEXTURE_2D,
                       gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    }

    if ("repeat" === wrapT) {
      gl.texParameteri(gl.TEXTURE_2D,
                       gl.TEXTURE_WRAP_T, gl.REPEAT);
    }
    else {
      gl.texParameteri(gl.TEXTURE_2D,
                       gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    if (mipmap) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  };

  /**
   * Set if the textures should be rotated around the X axis (that is, they
   * will be used upside down).
   *
   * @param {boolean} flipY: true if the textures should be flipped
   */
  this.setTextureFlipY = function(flipY) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
  }

  /**
   * Draws binded vertex buffers using the specified parameters.
   *
   * @param {number} or {string} drawMode: gl enum, like gl.TRIANGLES, or
   * 'triangles', 'triangle-strip, 'triangle-fan, 'points', 'lines' etc.
   * @param {number} first: the starting index in the enabled arrays
   * @param {number} count: the number of indices to be rendered
   */
  this.drawVertices = function(drawMode, first, count) {
    gl.drawArrays(that.getDrawModeEnum(drawMode), first, count);
  };
  
  /**
   * Draws binded vertex buffers using the specified parameters.
   * This function uses an index buffer.
   *
   * @param {number} or {string} drawMode: gl enum, like gl.TRIANGLES, or
   * 'triangles', 'triangle-strip, 'triangle-fan, 'points', 'lines' etc.
   * @param {object} indicesBuffer: indices for the passed vertices buffer; if 
   * the indices buffer is specified, the first and count values are ignored
   */
  this.drawIndexedVertices = function(drawMode, indicesBuffer) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
    gl.drawElements(that.getDrawModeEnum(drawMode),                      
                    indicesBuffer.numItems, gl.UNSIGNED_SHORT, 0);
  };
  
  /**
   * Converts from a string describing the draw mode to the corresponding 
   * value as a gl enum. If drawMode is undefined, it is defaulted to 
   * gl.TRIANGLE_STRIP. If it is already a number, that number is returned.
   *
   * @param {number} or {string} drawMode: gl enum, like gl.TRIANGLES, or
   * 'triangles', 'triangle-strip, 'triangle-fan, 'points', 'lines' etc.
   * @return {number} the corresponding value
   */
  this.getDrawModeEnum = function(drawMode) {
    var mode;
    
    if ("string" === typeof drawMode) {
      if ("triangles" === drawMode) {
        mode = gl.TRIANGLES;
      }
      else if ("triangle-strip" === drawMode) {
        mode = gl.TRIANGLE_STRIP;
      }
      else if ("triangle-fan" === drawMode) {
        mode = gl.TRIANGLE_FAN;
      }
      else if ("points" === drawMode) {
        mode = gl.POINTS;
      }
      else if ("points" === drawMode) {
        mode = gl.POINTS;
      }
      else if ("lines" === drawMode) {
        mode = gl.LINES;
      }
      else if ("line-strip" === drawMode) {
        mode = gl.LINE_STRIP;
      }
      else if ("line-loop" === drawMode) {
        mode = gl.LINE_LOOP;
      }
    }
    else if ("undefined" === typeof(drawMode)) {
      mode = gl.TRIANGLE_STRIP;
    }
    else {
      return drawMode;
    }
    
    return mode;
  };
  
  /**
   * Sets up the WebGL context viewport.
   * This defines the width and height of the gl drawing canvas context (but
   * not the size of the actual canvas element).
   *
   * @param {number} width: the width of the viewport area
   * @param {number} height: the height of the viewport area
   */
  this.viewport = function(width, height) {
    gl.viewport(0, 0, width, height);
  };

  /**
   * Clears the WebGL context to a specific color.
   * The color components are represented in the 0..1 range.
   *
   * @param {number} r: the red component of the clear color
   * @param {number} g: the green component of the clear color
   * @param {number} b: the blue component of the clear color
   * @param {number} a: the alpha component of the clear color
   */
  this.clear = function(r, g, b, a) {
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  };
  
  /**
   * Sets blending, either 'alpha' or 'add'; anything else disables blending.
   *
   * @param {string} mode: blending, either 'alpha', 'add' or undefined
   */
  this.blendMode = function(mode) {
    if ("alpha" === mode) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    else if ("add" === mode || "additive" === mode) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    }
    else {
      gl.disable(gl.BLEND);
    }
  };
  
  /**
   * Sets depth testing; disabling it is useful when handling transparency.
   *
   * @param {boolean} mode: true if depth testing should be enabled
   */
  this.depthTest = function(mode) {
    if (mode) {
      gl.enable(gl.DEPTH_TEST);
    }
    else {
      gl.disable(gl.DEPTH_TEST);
    }
  };
  
  /**
   * Handles a generic get request, performed on a specified url. When done,
   * it fires the ready callback function if it exists, & passes the http
   * request object and also an optional auxiliary parameter if available.
   * Used internally for getting shader sources from a specific resource.
   *
   * @param {string} url: the url to perform the GET to
   * @param {function} readyCallback: function to be called when request ready
   * @param {object} auxParam: optional parameter passed to readyCallback
   */
  this.request = function(url, readyCallback, auxParam) {
    var http = new XMLHttpRequest();

    http.open("GET", url, true);
    http.send(null);
    http.onreadystatechange = function() {
      if (http.readyState === 4) {
        if ("function" === typeof(readyCallback)) {
          readyCallback(http, auxParam);
        }
      }
    };
  };

  /**
   * Handles multiple get requests from specified urls. When all requests are
   * completed, it fires the ready callback function if it exists, & passes 
   * the http request object and an optional auxiliary parameter if available.
   * Used internally for getting shader sources from a specific resource.
   *
   * @param {array} urls: an array of urls to perform the GET to
   * @param {function} readyCallback: function called when all requests ready
   * @param {object} auxParam: optional parameter passed to readyCallback
   */
  this.requests = function(urls, readyCallback, auxParam) {
    var http = [];
    var finished = 0;

    function requestReady() {
      finished++;
      if (finished === urls.length) {
        if ("function" === typeof(readyCallback)) {
          readyCallback(http, auxParam);
        }
      }
    }
    
    for (var i = 0, size = urls.length; i < size; i++) {
      that.request(urls[i], function(request, index) {
        http[index] = request;
        requestReady();
      }, i);
    }
  };
  
  /**
   * Destroys this object.
   */
  this.destroy = function() {
    gl = null;
    program = null;
    
    that = null;
  };
}

/**
 * Provides requestAnimationFrame in a cross browser way.
 */
window.requestAnimFrame = (function() {
  return window.requestAnimFrame ||
         window.webkitRequestAnimationFrame ||
         window.mozRequestAnimationFrame ||
         window.oRequestAnimationFrame ||
         window.msRequestAnimationFrame ||
         function(callback, Element) {
           window.setTimeout(callback, 1000 / 60);
         };
})();