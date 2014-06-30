
// attribute vec3 position;
// attribute vec3 normal;

varying vec3 vNormal;

#ifdef PICKING
    attribute vec3 pickingColor;
    varying vec3 vPickingColor;
#else
    attribute vec3 color;
    varying vec3 vColor;
#endif

void main()
{

	#ifdef PICKING
        vPickingColor = pickingColor;
    #else
        vColor = color;
    #endif

	vNormal = normalize( normalMatrix * normal );

	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

	if( gl_Position.z<=1.0 )
        gl_Position.z = -10.0;
    
}
