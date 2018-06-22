Physijs.scripts.worker = 'js/physijs_worker.js';
Physijs.scripts.ammo = 'ammo.js';

if ( ! Detector.webgl ) Detector.addGetWebGLMessage()

var init, render, renderer, render_stats, physics_stats, 
    scene;
//object globals
var light, dLight, ground, ground_geometry,
    ground_material, camera, controls, ball;

var projector, 
    mouse_position = { x: 0, y: 0 },
    selectedBall = null,
    ball_offset = new THREE.Vector3,
    intersect_plane;
    targetList = [];

var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

//keyboard, face color mesh

function initSky() {

    // Add Sky
    sky = new THREE.Sky();
    sky.scale.setScalar( 450000 );
    scene.add( sky );

    // Add Sun Helper
    sunSphere = new THREE.Mesh(
        new THREE.SphereBufferGeometry( 20000, 16, 8 ),
        new THREE.MeshBasicMaterial( { color: 0xffffff } )
    );
    sunSphere.position.y = - 700000;
    sunSphere.visible = false;
    scene.add( sunSphere );

    /// GUI

    var effectController  = {
        turbidity: 10,
        rayleigh: 2,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.8,
        luminance: 1,
        inclination: 0.49, // elevation / inclination
        azimuth: 0.25, // Facing front,
        sun: ! true
    };

    var distance = 400000;

    function guiChanged() {

        var uniforms = sky.material.uniforms;
        uniforms.turbidity.value = effectController.turbidity;
        uniforms.rayleigh.value = effectController.rayleigh;
        uniforms.luminance.value = effectController.luminance;
        uniforms.mieCoefficient.value = effectController.mieCoefficient;
        uniforms.mieDirectionalG.value = effectController.mieDirectionalG;

        var theta = Math.PI * ( effectController.inclination - 0.5 );
        var phi = 2 * Math.PI * ( effectController.azimuth - 0.5 );

        sunSphere.position.x = distance * Math.cos( phi );
        sunSphere.position.y = distance * Math.sin( phi ) * Math.sin( theta );
        sunSphere.position.z = distance * Math.sin( phi ) * Math.cos( theta );

        sunSphere.visible = effectController.sun;

        uniforms.sunPosition.value.copy( sunSphere.position );

        renderer.render( scene, camera );
        console.log(sky);
    }

    var gui = new dat.GUI();

    gui.add( effectController, "turbidity", 1.0, 20.0, 0.1 ).onChange( guiChanged );
    gui.add( effectController, "rayleigh", 0.0, 4, 0.001 ).onChange( guiChanged );
    gui.add( effectController, "mieCoefficient", 0.0, 0.1, 0.001 ).onChange( guiChanged );
    gui.add( effectController, "mieDirectionalG", 0.0, 1, 0.001 ).onChange( guiChanged );
    gui.add( effectController, "luminance", 0.0, 2 ).onChange( guiChanged );
    gui.add( effectController, "inclination", 0, 1, 0.0001 ).onChange( guiChanged );
    gui.add( effectController, "azimuth", 0, 1, 0.0001 ).onChange( guiChanged );
    gui.add( effectController, "sun" ).onChange( guiChanged );

    guiChanged();

}

init = function(){

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize( window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMapSoft = true;
    document.getElementById('viewport').appendChild(renderer.domElement);

    render_stats = new Stats();
    render_stats.domElement.style.position= 'absolute';
    render_stats.domElement.style.top = '0px';
    render_stats.domElement.style.zIndex = 100;
    document.getElementById( 'viewport' ).appendChild( render_stats.domElement );

    physics_stats = new Stats();
    physics_stats.domElement.style.position = 'absolute';
    physics_stats.domElement.style.top = '50px';
    physics_stats.domElement.style.zIndex = 100;
    document.getElementById('viewport').appendChild( physics_stats.domElement);

    scene = new Physijs.Scene({fixedTimeStep: 1/120});
    scene.setGravity(new THREE.Vector3(0,-30,0));
    scene.background = new THREE.Color( 0xcccccc );
    scene.addEventListener(
        'update',
        function(){
            scene.simulate(undefined,2);
            physics_stats.update();
        }
    );

    var axesHelper = new THREE.AxesHelper( 5 );
    scene.add( axesHelper );

    var SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight;
	var VIEW_ANGLE = 45, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 0.1, FAR = 20000;
    camera = new THREE.PerspectiveCamera(
        VIEW_ANGLE,
        ASPECT,
        NEAR,
        FAR
    );
    camera.position.set( -18, 2.2, 0 );
    camera.lookAt(0, 2.2, 0);


    //OrbitControl controls
    controls = new THREE.OrbitControls(camera);
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.25;

    controls.screenSpacePanning = false;

    controls.maxPolarAngle = Math.PI / 2;
    controls.update();

    //light = new THREE.HemisphereLight(  0xffffbb, 0x080820, 1 )
    dLight = new THREE.DirectionalLight( 0xFFFFFF );
    dLight.position.set( 20, 40, -15 );
    dLight.target.position.copy( scene.position );
    //scene.add( light );
    scene.add(dLight);

    // Materials
    var ground_texture = new THREE.TextureLoader().load('images/checkerboard.jpg' );
    ground_texture.wrapS = ground_texture.wrapT = THREE.RepeatWrapping; 
    ground_texture.repeat.set( 50, 50 );
    
    ground_material = Physijs.createMaterial(
        new THREE.MeshLambertMaterial({map:ground_texture}),
        1, // high friction
        .4 // low restitution
    );
    // ground_material.map.wrapS = ground_material.map.wrapT = THREE.RepeatWrapping;
    // ground_material.map.repeat.set( 2.5, 2.5 );
    
    
    // Ground
    NoiseGen = new SimplexNoise;
    
    ground_geometry = new THREE.PlaneGeometry( 248, 248, 1, 1 );
    // for ( var i = 0; i < ground_geometry.vertices.length; i++ ) {
    //     var vertex = ground_geometry.vertices[i];
    //     vertex.z = NoiseGen.noise( vertex.x / 10, vertex.y / 10 ) * 10;
    // }
    ground_geometry.computeFaceNormals();
    ground_geometry.computeVertexNormals();
    
    // If your plane is not square as far as face count then the HeightfieldMesh
    // takes two more arguments at the end: # of x faces and # of y faces that were passed to THREE.PlaneMaterial
    ground = new Physijs.BoxMesh(
        ground_geometry,
        ground_material,
        0 // mass
    );
    ground.rotation.x = Math.PI / -2;
    //ground.position = (0,0,0);
    ground.receiveShadow = true;
    scene.add( ground );

    intersect_plane = new THREE.Mesh(
        new THREE.PlaneGeometry( 150, 150 ),
        new THREE.MeshBasicMaterial({ opacity: 0, transparent: true })
    );
    intersect_plane.rotation.x = Math.PI / -2;
    scene.add( intersect_plane );


    document.addEventListener('resize', onWindowResize, false);
	projector = new THREE.Projector();

    initSky();
    createBall();
    //fitCameraToObject(camera, ball, 4, controls);
    var stop = new THREE.Vector3(0,0,0);
    
    initEventHandling();
    
    
    requestAnimationFrame( render );
    console.log(scene)
}
//camera focus
//from url:https://discourse.threejs.org/t/camera-zoom-to-fit-object/936/2 
const fitCameraToObject = function ( camera, object, offset, controls ) {

    offset = offset || 1.25;

    const boundingBox = new THREE.Box3();

    // get bounding box of object - this will be used to setup controls and camera
    boundingBox.setFromObject( object );

    const center = new THREE.Vector3( )
    boundingBox.getCenter(center);

    const size = new THREE.Vector3( );
    boundingBox.getSize(size);

    // get the max side of the bounding box (fits to width OR height as needed )
    const maxDim = Math.max( size.x, size.y, size.z );
    const fov = camera.fov * ( Math.PI / 180 );
    let cameraZ = Math.abs( maxDim / 4 * Math.tan( fov ) );
    console.log( cameraZ );

    cameraZ *= offset; // zoom out a little so that objects don't fill the screen

    camera.position.z = cameraZ;
    

    // const minZ = boundingBox.min.z;
    // const cameraToFarEdge = ( minZ < 0 ) ? -minZ + cameraZ : cameraZ - minZ;

    // camera.far = cameraToFarEdge * 3;
    camera.updateProjectionMatrix();
    camera.lookAt(center)

    if ( controls ) {

      // set camera to rotate around center of loaded object
      controls.target = center;

      // prevent camera from zooming out far enough to create far plane cutoff
      //controls.maxDistance = cameraToFarEdge * 2;

      controls.saveState();

    } else {

        camera.lookAt( center )

   }
}
function createBall() {
    var ball_texture = new THREE.TextureLoader().load('images/baseball_texture.jpg');
    var faceColorMaterial = new THREE.MeshBasicMaterial( 
        { color: 0xffffff, vertexColors: THREE.FaceColors } );
    var ball_material = new Physijs.createMaterial(
        faceColorMaterial,      //new THREE.MeshLambertMaterial({map:ball_texture})
        1, //friction
        1.7 //restitution
        
    );
                                                //.03750
    var ball_geometry = new THREE.SphereGeometry(.3750,18,18);
    ball_geometry.computeFaceNormals();
    ball_geometry.computeVertexNormals();
    for (var i = 0; i < ball_geometry.faces.length;i++){
        face = ball_geometry.faces[i];
        face.color.setRGB(0,0,0.8*Math.random() + 0.2);
    }

    ball = new Physijs.SphereMesh(
        ball_geometry,
        ball_material,
        0.14175
    );
    ball.receiveShadow = true;
    ball.__dirtyPosition = true;
    ball.position.y = 2.2;
    ball.addEventListener( 'collision', function( other_object, relative_velocity, relative_rotation, contact_normal ) {
        // `this` has collided with `other_object` with an impact speed of `relative_velocity` and a rotational force of `relative_rotation` and at normal `contact_normal`
    });
    // ball.velocity.x = -15;
    // ball.velocity.y = 5;
    scene.add(ball);
                                        //force values: (-3, 1.7,0), (-5,1,0)
    ball.applyCentralImpulse(new THREE.Vector3(-5,1,0));

    targetList.push(ball);                    
    
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

initEventHandling = (function() {
    var _vector = new THREE.Vector3,
        handleMouseDown, handleMouseMove, handleMouseUp;
    
    handleMouseDown = function( evt ) {
    

        var ray, intersections;
        
        _vector.set(
            ( evt.clientX / window.innerWidth ) * 2 - 1,
            -( evt.clientY / window.innerHeight ) * 2 + 1,
            1
        );
        projector.unprojectVector( _vector, camera );
        
        
        var ray = new THREE.Raycaster( camera.position, _vector.sub( camera.position ).normalize() );
        intersections = ray.intersectObjects( targetList );
        console.log(intersections)
        selectedBall = intersections[0].object;
        console.log(selectedBall);
        if( intersections.length > 0){
            intersections[0].face.color.setRGB(0.8*Math.random() + 0.2,0,0);
            console.log(intersections[0].face.vertexNormals);
            intersections[0].object.geometry.colorsNeedUpdate = true;
            console.log(intersections[0].face.normal)
            console.log(intersections[0].face.point);
            z = Math.random();
            selectedBall.applyImpulse(new THREE.Vector3(20,.9,0),
                                            intersections[0].face.normal);

        }

        
        // _vector.set( 0, 0, 0 );
        // selectedBall.setAngularFactor( _vector );
        // selectedBall.setAngularVelocity( _vector );
        // selectedBall.setLinearFactor( _vector );
        // selectedBall.setLinearVelocity( _vector );
        // mouse_position.copy( intersections.point );
        // ball_offset.subVectors( selectedBall.position, mouse_position );
        
        // intersect_plane.position.y = mouse_position.y;
    };
    
    handleMouseMove = function( evt ) {
        
    //     var ray, intersection,
    //         i, scalar;
        
    //     if ( selectedBall !== null ) {
            
    //         _vector.set(
    //             ( evt.clientX / window.innerWidth ) * 2 - 1,
    //             -( evt.clientY / window.innerHeight ) * 2 + 1,
    //             1
    //         );
    //         _vector.unproject( camera );
            
    //         ray = new THREE.Raycaster( camera.position, _vector.sub( camera.position ).normalize() );
    //         intersection = ray.intersectObject( intersect_plane );
    //         mouse_position.copy( intersection.point );
    //     }
        
     };
    
    handleMouseUp = function( evt ) {
        
        if ( selectedBall !== null ) {
            _vector.set( 1, 1, 1 );
            selectedBall.setAngularFactor( _vector );
            selectedBall.setLinearFactor( _vector );
            
            selectedBall = null;
        }
        
     };
    
    return function() {
        renderer.domElement.addEventListener( 'mousedown', handleMouseDown );
        renderer.domElement.addEventListener( 'mousemove', handleMouseMove );
        renderer.domElement.addEventListener( 'mouseup', handleMouseUp );
    };
})();

function render() {
    camera.lookAt(ball.position)
    //controls.update();
    renderer.render(scene, camera);
    render_stats.update();
    requestAnimationFrame(render);
    
    if(ball.position.x < -18){
        var z = Math.floor(Math.random() * 90)%100;
        //console.log(z)
        stop = new THREE.Vector3(0,0,0 )
        ball.setAngularVelocity(stop);
        ball.setLinearVelocity(stop);
        ball.mass = 0;
        //ball.applyCentralImpulse(new THREE.Vector3(1,.5,z));
    }
    if(ball.position.x > 25){
        stop = new THREE.Vector3(0,0,0 )
        ball.setAngularVelocity(stop);
        ball.setLinearVelocity(stop);
        ball.mass = 0;
        //controls.update();
    }
    

    
};


init();
render();
scene.simulate();
//window.onload = init;