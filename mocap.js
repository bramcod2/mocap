'use strict';

var canvas;
var gl;

var floor;
var sphere;
var axis;
var segment;

var lineProgram;
var sphereProgram;

var go = false;
var hipFr = false;

var currFrame;

var view = 'A';
var aspect = 1.0;

var mvMatrix, pMatrix, nMatrix;

// Stack stuff
var matrixStack = new Array();
function pushMatrix() {
    matrixStack.push(mat4(mvMatrix));
}
function popMatrix() {
    mvMatrix = matrixStack.pop();
}

var LineProgram = function() {
    this.program = initShaders(gl, 'line-vshader', 'line-fshader');
    gl.useProgram(this.program);

    this.vertexLoc = gl.getAttribLocation(this.program, 'vPosition');
    this.colorLoc = gl.getAttribLocation(this.program, 'vColor');

    this.mvMatrixLoc = gl.getUniformLocation(this.program, 'mvMatrix');
    this.pMatrixLoc = gl.getUniformLocation(this.program, 'pMatrix');
    this.nMatrixLoc = gl.getUniformLocation(this.program, 'nMatrix');
};

var SphereProgram = function() {
    this.program = initShaders(gl, 'sphere-vshader', 'sphere-fshader');
    gl.useProgram(this.program);

    this.vertexLoc = gl.getAttribLocation(this.program, 'vPosition');
    this.normalLoc = gl.getAttribLocation(this.program, 'vNormal');
    this.colorLoc = gl.getAttribLocation(this.program, 'vColor');

    this.mvMatrixLoc = gl.getUniformLocation(this.program, 'mvMatrix');
    this.pMatrixLoc = gl.getUniformLocation(this.program, 'pMatrix');
    this.nMatrixLoc = gl.getUniformLocation(this.program, 'nMatrix');
};

// Viewing
var aspect = 1.0;

// Data
var bvh;

var reader = new FileReader();
reader.onload = function(e) {
    var text = reader.result;
};

var theta = radians(45);
var radius = 5;
var at = vec3(0.0, 0.0, 0.0);
var hips = at;

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fovy = 40.0;
    const near = 0.01;
    const far = 100;
    var up = vec3(0.0, 1.0, 0.0);
    var eye = vec3(radius * Math.sin(theta),
                   radius * Math.sin(radians(10.0)),
                   radius * Math.cos(theta));
    if (view == 'X') {
        eye = vec3(5, 0, 0);
    } else if (view == 'Y') {
        eye = vec3(0, 10, 0);
        up = vec3(0.0, 0.0, -1.0);
    } else if (view == 'Z') {
        eye = vec3(0, 0, 5);
    }

    pMatrix = perspective(fovy, aspect, near, far);
    mvMatrix = lookAt(eye, at, up);

    renderFloor();
    pushMatrix();
    mvMatrix = mult(mvMatrix, scalem(0.05, 0.05, 0.05));

    bvh.channelOffset = 0;
    drawOffsets(bvh.roots[0]);


    popMatrix();
}

function animate() {

}

var stop = false;
var frameCount;
var fps, fpsInterval, startTime, now, then, elapsed;


function tick() {
        requestAnimationFrame(tick);
        if (go) {
            currFrame++;
            //currFrame++; // Makes it go faster...
            if (currFrame >= bvh.frames.length) {
                currFrame = 0;
                //console.log("reset");
            }
        }
        render();
}

function initFrameRate(fps) {
    frameCount = bvh.numFrames;
    fpsInterval = 50 * fps;//10 * fps;
    then = Date.now();
    startTime = then;
}

function drawOffsets(cur) {
    pushMatrix();
    //-------Line segments---
    var a = vec3(1, 0, 0);
    var b = vec3(cur.offsets[0], cur.offsets[1], cur.offsets[2]);

    var n = cross(a, b);
    var curTheta = Math.acos((dot(a, b)) / length(b));
    if (curTheta > 0) {
        pushMatrix();
        mvMatrix = mult(mvMatrix, rotate(degrees(curTheta), n));
        mvMatrix = mult(mvMatrix, scalem(length(b), length(b), length(b)));
        renderSegment();
        popMatrix();
    }
    //-----------------------

    mvMatrix = mult(mvMatrix,
        translate(cur.offsets[0], cur.offsets[1], cur.offsets[2]));

    var xpos, ypos, zpos;

    for (var j = 0; j < cur.channels.length; j++) //cur.channels.length 0, 3, 6
    {

        if (cur.channels[j] == 'Xposition') {
            xpos = bvh.frames[currFrame][cur.channelOffset + j];
            mvMatrix = mult(mvMatrix,
                translate(bvh.frames[currFrame][cur.channelOffset + j], 0, 0));
        }
        if (cur.channels[j] == 'Yposition') {
            ypos = bvh.frames[currFrame][cur.channelOffset + j];
            mvMatrix = mult(mvMatrix,
                translate(0, bvh.frames[currFrame][cur.channelOffset + j], 0));
        }
        if (cur.channels[j] == 'Zposition') {
            zpos = bvh.frames[currFrame][cur.channelOffset + j];
            mvMatrix = mult(mvMatrix,
                translate(0, 0, bvh.frames[currFrame][cur.channelOffset + j]));
        }
        if (cur.channels[j] == 'Xrotation') {
            mvMatrix = mult(mvMatrix,
                rotateX(bvh.frames[currFrame][cur.channelOffset + j]));
        }
        if (cur.channels[j] == 'Yrotation') {
            mvMatrix = mult(mvMatrix,
                rotateY(bvh.frames[currFrame][cur.channelOffset + j]));
        }
        if (cur.channels[j] == 'Zrotation') {
            mvMatrix = mult(mvMatrix,
                rotateZ(bvh.frames[currFrame][cur.channelOffset + j]));
        }
    }
    pushMatrix();
    mvMatrix = mult(mvMatrix, scalem(0.5, 0.5, 0.5));
    renderSphere();


    popMatrix();

    for (var i = 0; i < cur.children.length; i++) {
        drawOffsets(cur.children[i]);
    }
    popMatrix();
}

/**
 * Parses a BVH file and places the result in the bvh variable.
 */
function parse(input) {
  var antlr4 = require('antlr4/index');
  var BVHLexer = require('parser/BVHLexer');
  var BVHListener = require('parser/BVHListener');
  var BVHParser = require('parser/BVHParser');
  require('./BVH');

  var chars = new antlr4.InputStream(input);
  var lexer = new BVHLexer.BVHLexer(chars);
  var tokens = new antlr4.CommonTokenStream(lexer);
  var parser = new BVHParser.BVHParser(tokens);
  parser.buildParseTrees = true;
  var tree = parser.mocap();

  bvh = new BVH();
  antlr4.tree.ParseTreeWalker.DEFAULT.walk(bvh, tree);

    // TODO: add any initialization code upon loading a BVH file
  fps = bvh.frameTime;
}


function keyDown(e) {
  switch (e.keyCode) {
  case 37:
      // left
      theta -= 0.1;
      render();
    break;
  case 38:
      // up
      radius -= 0.1;
      render();
    break;
  case 39:
      // right
      theta += 0.1;
      render();
    break;
  case 40:
      // down
      radius += 0.1;
      render();
    break;
  case 32:
      // spacebar
      go = !go;
      tick();
    break;
      case 79:
          //o look at origin
          at = vec3(0, 0, 0);
          render();
          break;
      case 80:
          //p look at person's hips
          at = hips;
          hipFr = true;
          //render();
          tick();
          break;
  case "F".charCodeAt(0):
    // F or f
    break;
  default:
    // To see what the code for a certain key is, uncomment this line,
    // reload the page in the browser and press the key.
    //console.log("Unrecognized key press: " + e.keyCode);
    break;
  }
}

window.onload = function init() {
    document.onkeydown = keyDown;

    canvas = document.getElementById('gl-canvas');
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert('WebGL isn\'t available'); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = canvas.width / canvas.height;

    // Awesome green background.
    gl.clearColor(0.6, 0.7, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    //  Load shaders and initialize attribute buffers
    lineProgram = new LineProgram();
    sphereProgram = new SphereProgram();

    // Listen for a file to be loaded and parse
    var fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', function(e) {
        var file = fileInput.files[0];
        if (file && file.name) {
            if (file.name.match(/.*\.bvh/)) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    parse(reader.result);
                };
                reader.readAsText(file);
            } else {
                console.log('File not supported! ' + file.type);
            }
        }
        console.log('File uploaded');
    });

    // Parse a default file.
    // TODO: change this to testData1 when you're ready to start rendering
    // animation. These strings are defined in test1.bvh.js and test2.bvh.js.
    parse(testData1);

    currFrame = 0;

    axis = new Axis();
    floor = new Floor();
    segment = new LineSegment();
    sphere = new Sphere(1, 200, 200);//0.05

    initFrameRate(bvh.frameTime);

    render();
};



function renderAxis() {
    gl.useProgram(lineProgram.program);

    gl.enableVertexAttribArray(lineProgram.vertexLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, axis.vertexBuffer);
    gl.vertexAttribPointer(lineProgram.vertexLoc, 4, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(lineProgram.colorLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, axis.colorBuffer);
    gl.vertexAttribPointer(lineProgram.colorLoc, 4, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(lineProgram.mvMatrixLoc, false, flatten(mvMatrix));
    gl.uniformMatrix4fv(lineProgram.pMatrixLoc, false, flatten(pMatrix));

    gl.drawArrays(gl.LINES, 0, axis.numPoints);
}

function renderSegment() {
    gl.useProgram(lineProgram.program);

    gl.enableVertexAttribArray(lineProgram.vertexLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, segment.vertexBuffer);
    gl.vertexAttribPointer(lineProgram.vertexLoc, 4, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(lineProgram.colorLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, segment.colorBuffer);
    gl.vertexAttribPointer(lineProgram.colorLoc, 4, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(lineProgram.mvMatrixLoc, false, flatten(mvMatrix));
    gl.uniformMatrix4fv(lineProgram.pMatrixLoc, false, flatten(pMatrix));

    gl.drawArrays(gl.LINES, 0, segment.numPoints);
}

function renderFloor() {
    gl.useProgram(lineProgram.program);

    gl.enableVertexAttribArray(lineProgram.vertexLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, floor.vertexBuffer);
    gl.vertexAttribPointer(lineProgram.vertexLoc, 4, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(lineProgram.colorLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, floor.colorBuffer);
    gl.vertexAttribPointer(lineProgram.colorLoc, 4, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(lineProgram.mvMatrixLoc, false, flatten(mvMatrix));
    gl.uniformMatrix4fv(lineProgram.pMatrixLoc, false, flatten(pMatrix));

    gl.drawArrays(gl.LINES, 0, floor.numPoints);
}


function renderSphere() {
    gl.useProgram(sphereProgram.program);

    gl.enableVertexAttribArray(sphereProgram.vertexLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, sphere.vertexBuffer);
    gl.vertexAttribPointer(sphereProgram.vertexLoc, 4, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(sphereProgram.normalLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, sphere.normalBuffer);
    gl.vertexAttribPointer(sphereProgram.normalLoc, 4, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(sphereProgram.colorLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, sphere.colorBuffer);
    gl.vertexAttribPointer(sphereProgram.colorLoc, 4, gl.FLOAT, false, 0, 0);

    nMatrix = normalMatrix(mvMatrix, false);

    gl.uniformMatrix4fv(sphereProgram.mvMatrixLoc, false, flatten(mvMatrix));
    gl.uniformMatrix4fv(sphereProgram.pMatrixLoc, false, flatten(pMatrix));
    gl.uniformMatrix4fv(sphereProgram.nMatrixLoc, false, flatten(nMatrix));

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphere.indexBuffer);
    gl.drawElements(gl.TRIANGLES, sphere.numIndices, gl.UNSIGNED_SHORT, 0);
}


var LineSegment = function() {
    var pointsArray = [];
    var colorsArray = [];
    pointsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
    pointsArray.push(vec4(1.0, 0.0, 0.0, 1.0));
    colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));
    colorsArray.push(vec4(0.0, 0.0, 0.0, 1.0));

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

    this.colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colorsArray), gl.STATIC_DRAW);

    this.numPoints = pointsArray.length;

};
