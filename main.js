
(function () {
    'use strict';

    // -- Init Canvas
    var canvas = document.createElement('canvas');
    canvas.width = Math.min(window.innerWidth, window.innerHeight);
    canvas.height = canvas.width;
    // canvas.width=window.innerWidth;
    // canvas.height=window.innerHeight;
    document.body.appendChild(canvas);
    // -- Init WebGL Context
    var gl = canvas.getContext('webgl2', { antialias: true });
    var isWebGL2 = !!gl;
    if (!isWebGL2) {
        alert('Your browser does not support WebGL 2.');
        return;
    }

    canvas.addEventListener("webglcontextlost", function (event) {
        event.preventDefault();
    }, false);

    // -- Declare variables for the particle system

    var NUM_PARTICLES = 10000;
    var ACCELERATION = -1.0;

    var appStartTime = Date.now();
    var currentSourceIdx = 0;

    var program = initProgram();

    // Get uniform locations for the draw program
    var drawTimeLocation = gl.getUniformLocation(program, 'u_time');
    // var drawAccelerationLocation = gl.getUniformLocation(program, 'u_acceleration');
    //var drawColorLocation = gl.getUniformLocation(program, 'u_color');

    // -- Initialize particle data

    var particlePositions = [];
    var particleVRO = [];
    var particleColor = [];
    var particleIDs = [];
    var particleOmega = [];
    var particleRadius = [];

    var POSITION_LOCATION = 0;
    var VRO_LOCATION = 1;
    var SL_LOCATION = 2;
    var COLOR_LOCATION = 3;
    var ID_LOCATION = 4;

    var NUM_LOCATIONS = 5;

    var cnt = 0;
    var rad = 0.3, mxrad = 0, gap = 0.005;
    for (var p = 0; p < NUM_PARTICLES; ++p) {
        var trackNow = cnt;
        particleVRO[cnt * 3] = 0.6 * Math.random();
        particlePositions[cnt * 2] = 0.0;
        particlePositions[cnt * 2 + 1] = 0.0;
        particleVRO[cnt * 3 + 1] = rad;
        particleVRO[cnt * 3 + 2] = Math.random() * 360.0;

        // particleColor[cnt * 4] =1-rad;
        // particleColor[cnt * 4 + 1] = 1;
        // particleColor[cnt * 4 + 2] = 1;
        // particleColor[cnt * 4] = 1 - rad * 0.6 + Math.random() * 0.2;
        // particleColor[cnt * 4 + 1] = 1 - rad*0.4 + Math.random() * 0.2;
        // particleColor[cnt * 4 + 2] = 1 - rad * 0.4 + Math.random() * 0.4;
        // particleColor[cnt * 4 + 3] = 0;
        particleColor[cnt * 4] = 0 + Math.random() * 0.4;
        particleColor[cnt * 4 + 1] = (1 - rad) * 0.8 + Math.random() * 0.2;
        particleColor[cnt * 4 + 2] = 1 - Math.random() * 0.2;
        particleColor[cnt * 4 + 3] = 0;

        var thisAlpha = (Math.random()) * 0.3 + 0.7;
        var trackLen = 50 * rad + 80 + Math.random() * 100;
        // if(trackLen<200)continue;
        var idNow = p/NUM_PARTICLES,vNow=Math.random()*0.01+(1-rad)*0.01+0.005;
        particleIDs[cnt * 2] = idNow;
        particleIDs[cnt * 2 + 1] = 1;
        // rad/=2;
        mxrad = Math.max(rad, mxrad);
        cnt++;
        for (var i = 0; i < trackLen; i++) {
            particlePositions[cnt * 2] = 0.0;
            particlePositions[cnt * 2 + 1] = 0.0;
            particleVRO[cnt * 3] = vNow;
            particleVRO[cnt * 3 + 1] = particleVRO[trackNow * 3 + 1];
            particleVRO[cnt * 3 + 2] = particleVRO[(cnt - 1) * 3 + 2] + gap;//*Math.pow(1-(particleVRO[cnt * 3 + 1]),0.6) ;
            particleIDs[cnt * 2] = idNow;
            particleIDs[cnt * 2 + 1] = (i) / trackLen;
            // particleIDs[cnt * 2 + 1] = (trackLen - i) / trackLen;

            particleColor[cnt * 4] = particleColor[trackNow * 4];
            particleColor[cnt * 4 + 1] = particleColor[trackNow * 4 + 1];
            particleColor[cnt * 4 + 2] = particleColor[trackNow * 4 + 2];
            particleColor[cnt * 4 + 3] = thisAlpha ;//* (trackLen - i - 1) / trackLen;
            cnt++;
        }
        //var times=Math.random()*10+1;
        rad = (Math.random())*0.9+0.1;
        // for(var i=0;i<times;++i){
        //     rad *= Math.random();
        //     rad+=Math.random();
        //     if(rad>1)rad-=1;
        // }
    }
    // console.log(cnt + " " + tcnt + " " + mxrad);
    particlePositions = new Float32Array(particlePositions);
    particleVRO = new Float32Array(particleVRO);
    particleIDs = new Float32Array(particleIDs);
    particleOmega = new Float32Array(particleOmega);
    particleRadius = new Float32Array(particleRadius);
    particleColor = new Float32Array(particleColor);
    var particleSL=  new Float32Array(cnt * 2);
    // -- Init Vertex Arrays and Buffers
    var particleVAOs = [gl.createVertexArray(), gl.createVertexArray()];

    // Transform feedback objects track output buffer state
    var particleTransformFeedbacks = [gl.createTransformFeedback(), gl.createTransformFeedback()];

    var particleVBOs = new Array(particleVAOs.length);

    for (var i = 0; i < particleVAOs.length; ++i) {
        particleVBOs[i] = new Array(NUM_LOCATIONS);

        // Set up input
        gl.bindVertexArray(particleVAOs[i]);

        particleVBOs[i][POSITION_LOCATION] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, particleVBOs[i][POSITION_LOCATION]);
        gl.bufferData(gl.ARRAY_BUFFER, particlePositions, gl.STREAM_COPY);
        gl.vertexAttribPointer(POSITION_LOCATION, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(POSITION_LOCATION);

        particleVBOs[i][VRO_LOCATION] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, particleVBOs[i][VRO_LOCATION]);
        gl.bufferData(gl.ARRAY_BUFFER, particleVRO, gl.STREAM_COPY);
        gl.vertexAttribPointer(VRO_LOCATION, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(VRO_LOCATION);

        particleVBOs[i][SL_LOCATION] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, particleVBOs[i][SL_LOCATION]);
        gl.bufferData(gl.ARRAY_BUFFER,particleSL, gl.STREAM_COPY);
        gl.vertexAttribPointer(SL_LOCATION, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(SL_LOCATION);

        particleVBOs[i][COLOR_LOCATION] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, particleVBOs[i][COLOR_LOCATION]);
        gl.bufferData(gl.ARRAY_BUFFER, particleColor, gl.STREAM_COPY);
        gl.vertexAttribPointer(COLOR_LOCATION, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(COLOR_LOCATION);

        particleVBOs[i][ID_LOCATION] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, particleVBOs[i][ID_LOCATION]);
        gl.bufferData(gl.ARRAY_BUFFER, particleIDs, gl.STATIC_READ);
        gl.vertexAttribPointer(ID_LOCATION, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(ID_LOCATION);

        // Set up output
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, particleTransformFeedbacks[i]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, particleVBOs[i][POSITION_LOCATION]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, particleVBOs[i][VRO_LOCATION]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, particleVBOs[i][SL_LOCATION]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 3, particleVBOs[i][COLOR_LOCATION]);

    }

    function initProgram() {

        // Setup program for transform feedback
        function createShader(gl, source, type) {
            var shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            return shader;
        }

        var vshader = createShader(gl, getShaderSource('vs-draw'), gl.VERTEX_SHADER);
        var fshader = createShader(gl, getShaderSource('fs-draw'), gl.FRAGMENT_SHADER);

        var program = gl.createProgram();
        gl.attachShader(program, vshader);
        gl.attachShader(program, fshader);
        console.log(gl.MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS);
        var varyings = ['v_position', 'v_VRO', 'v_SL', 'v_color'];
        gl.transformFeedbackVaryings(program, varyings, gl.SEPARATE_ATTRIBS);
        gl.linkProgram(program);

        // check
        var log = gl.getProgramInfoLog(program);
        if (log) {
            console.log(log);
        }

        log = gl.getShaderInfoLog(vshader);
        if (log) {
            console.log(log);
        }

        log = gl.getShaderInfoLog(fshader);
        if (log) {
            console.log(log);
        }

        gl.deleteShader(vshader);
        gl.deleteShader(fshader);

        return program;
    }
    gl.useProgram(program);
    //gl.uniform4f(drawColorLocation, 0.0, 0.3, 1.0, 1.0);
    // gl.uniform2f(drawAccelerationLocation, 0.0, ACCELERATION);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    function render() {

        var time = Date.now() - appStartTime;
        if(time>5000)appStartTime=Date.now();
        
        var destinationIdx = (currentSourceIdx + 1) % 2;

        // Set the viewport
        gl.viewport(0, 0, canvas.width, canvas.height - 10);

        // Clear color buffer
        // gl.bindBuffer(gl.ARRAY_BUFFER,particleVBOs[currentSourceIdx][COLOR_LOCATION]);
        // gl.vertexAttribPointer(loc,4,gl.FLOAT,false,4*Float32Array.length,0);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Toggle source and destination VBO
        var sourceVAO = particleVAOs[currentSourceIdx];
        var destinationTransformFeedback = particleTransformFeedbacks[destinationIdx];

        gl.bindVertexArray(sourceVAO);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, destinationTransformFeedback);

        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, particleVBOs[destinationIdx][POSITION_LOCATION]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, particleVBOs[destinationIdx][VRO_LOCATION]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, particleVBOs[destinationIdx][SL_LOCATION]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 3, particleVBOs[destinationIdx][COLOR_LOCATION]);

        // Set uniforms
        gl.uniform1f(drawTimeLocation, time);
        console.log(time);

        // Draw particles using transform feedback
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, NUM_PARTICLES);
        gl.endTransformFeedback();

        // Ping pong the buffers
        currentSourceIdx = (currentSourceIdx + 1) % 2;

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

})();