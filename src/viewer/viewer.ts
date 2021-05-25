/**
 * @file Viewer
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */

import { Signal } from 'signals'
import {
  PerspectiveCamera, OrthographicCamera, StereoCamera,
  Vector2, Box3, Vector3, Matrix4, Color,
  WebGLRenderer, WebGLRenderTarget,
  NearestFilter, LinearFilter, AdditiveBlending,
  RGBAFormat, FloatType, /*HalfFloatType, */UnsignedByteType,
  ShaderMaterial,
  PlaneGeometry, Geometry,
  Scene, Mesh, Group, Object3D, Uniform,
  Fog, SpotLight, AmbientLight,
  BufferGeometry, BufferAttribute,
  LineSegments,
  LinearEncoding, sRGBEncoding, TextureEncoding
} from 'three'
import '../shader/BasicLine.vert'
import '../shader/BasicLine.frag'
import '../shader/Quad.vert'
import '../shader/Quad.frag'

import {
  Debug, Log, WebglErrorMessage, Browser,
  setExtensionFragDepth, SupportsReadPixelsFloat, setSupportsReadPixelsFloat
} from '../globals'
import { degToRad } from '../math/math-utils'
import Stats from './stats'
import { getShader } from '../shader/shader-utils'
import { setColorSpace } from '../color/colormaker'
import { JitterVectors } from './viewer-constants'
import {
  makeImage, ImageParameters,
  sortProjectedPosition, updateMaterialUniforms, updateCameraUniforms
} from './viewer-utils'
import { testTextureSupport } from './gl-utils'

import Buffer from '../buffer/buffer'

const pixelBufferFloat = new Float32Array(4 * 25)
const pixelBufferUint = new Uint8Array(4 * 25)

// When picking, we read a 25 pixel (5x5) array (readRenderTargetPixels)
// We read the pixels in the order below to find what was picked.
// This starts at the center and tries successively further points.
// (Many points will be at equal distance to the center, their order
// is arbitrary).
const pixelOrder = [12,7,13,17,11,6,8,18,16,2,14,22,10,1,3,9,19,23,21,15,5,0,4,24,20]


const tmpMatrix = new Matrix4()

function onBeforeRender (this: Object3D, renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera|OrthographicCamera, geometry: Geometry, material: ShaderMaterial/*, group */) {
  const u = material.uniforms
  const updateList = []

  if (u.objectId) {
    u.objectId.value = SupportsReadPixelsFloat ? this.id : this.id / 255
    updateList.push('objectId')
  }

  if (u.modelViewMatrixInverse || u.modelViewMatrixInverseTranspose ||
      u.modelViewProjectionMatrix || u.modelViewProjectionMatrixInverse
  ) {
    this.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, this.matrixWorld)
  }

  if (u.modelViewMatrixInverse) {
    u.modelViewMatrixInverse.value.getInverse(this.modelViewMatrix)
    updateList.push('modelViewMatrixInverse')
  }

  if (u.modelViewMatrixInverseTranspose) {
    if (u.modelViewMatrixInverse) {
      u.modelViewMatrixInverseTranspose.value.copy(
        u.modelViewMatrixInverse.value
      ).transpose()
    } else {
      u.modelViewMatrixInverseTranspose.value
        .getInverse(this.modelViewMatrix)
        .transpose()
    }
    updateList.push('modelViewMatrixInverseTranspose')
  }

  if (u.modelViewProjectionMatrix) {
    u.modelViewProjectionMatrix.value.multiplyMatrices(
      camera.projectionMatrix, this.modelViewMatrix
    )
    updateList.push('modelViewProjectionMatrix')
  }

  if (u.modelViewProjectionMatrixInverse) {
    if (u.modelViewProjectionMatrix) {
      tmpMatrix.copy(
        u.modelViewProjectionMatrix.value
      )
      u.modelViewProjectionMatrixInverse.value.getInverse(
        tmpMatrix
      )
    } else {
      tmpMatrix.multiplyMatrices(
        camera.projectionMatrix, this.modelViewMatrix
      )
      u.modelViewProjectionMatrixInverse.value.getInverse(
        tmpMatrix
      )
    }
    updateList.push('modelViewProjectionMatrixInverse')
  }

  if (updateList.length) {
    const materialProperties = renderer.properties.get(material)

    if (materialProperties.program) {
      const gl = renderer.getContext()
      const p = materialProperties.program
      gl.useProgram(p.program)
      const pu = p.getUniforms()

      updateList.forEach(function (name) {
        pu.setValue(gl, name, u[ name ].value)
      })
    }
  }
}

export type CameraType = 'perspective'|'orthographic'|'stereo'
export type ColorWorkflow = 'linear' | 'sRGB'

export interface ViewerSignals {
  ticked: Signal,
  rendered: Signal
}

export interface ViewerParameters {
  fogColor: Color
  fogNear: number
  fogFar: number

  backgroundColor: Color

  cameraType: CameraType
  cameraFov: number
  cameraEyeSep: number
  cameraZ: number

  clipNear: number
  clipFar: number
  clipDist: number
  clipMode: string               // "scene" or "camera"
  clipScale: string              // "relative" or "absolute"

  lightColor: Color
  lightIntensity: number
  ambientColor: Color
  ambientIntensity: number

  sampleLevel: number

  rendererEncoding: TextureEncoding // default is three.LinearEncoding; three.sRGBEncoding gives more correct results
}

export interface BufferInstance {
  matrix: Matrix4
}

/**
 * Viewer class
 * @class
 * @param {String|Element} [idOrElement] - dom id or element
 */
export default class Viewer {
  signals: ViewerSignals

  container: HTMLElement
  wrapper: HTMLElement

  private rendering: boolean
  private renderPending: boolean
  private lastRenderedPicking: boolean
  private isStill: boolean
  private frameRequest: number

  sampleLevel: number
  private cDist: number
  private bRadius: number

  private parameters: ViewerParameters
  stats: Stats

  perspectiveCamera: PerspectiveCamera
  private orthographicCamera: OrthographicCamera
  private stereoCamera: StereoCamera
  camera: PerspectiveCamera|OrthographicCamera

  width: number
  height: number

  scene: Scene
  private spotLight: SpotLight
  private ambientLight: AmbientLight
  rotationGroup: Group
  translationGroup: Group
  private modelGroup: Group
  private pickingGroup: Group
  private backgroundGroup: Group
  private helperGroup: Group

  renderer: WebGLRenderer
  private supportsHalfFloat: boolean

  private pickingTarget: WebGLRenderTarget
  private sampleTarget: WebGLRenderTarget
  private holdTarget: WebGLRenderTarget

  private compositeUniforms: {
    tForeground: Uniform
    scale: Uniform
  }
  private compositeMaterial: ShaderMaterial
  private compositeCamera: OrthographicCamera
  private compositeScene: Scene

  private boundingBoxMesh: LineSegments
  boundingBox = new Box3()
  private boundingBoxSize = new Vector3()
  private boundingBoxLength = 0

  private info = {
    memory: {
      programs: 0,
      geometries: 0,
      textures: 0
    },
    render: {
      calls: 0,
      vertices: 0,
      faces: 0,
      points: 0
    }
  }

  private distVector = new Vector3()

  constructor (idOrElement: string|HTMLElement) {
    this.signals = {
      ticked: new Signal(),
      rendered: new Signal()
    }

    if (typeof idOrElement === 'string') {
      const elm = document.getElementById(idOrElement)
      if (elm === null) {
        this.container = document.createElement('div')
      }else {
        this.container = elm
      }
    } else if (idOrElement instanceof HTMLElement) {
      this.container = idOrElement
    } else {
      this.container = document.createElement('div')
    }

    if (this.container === document.body) {
      this.width = window.innerWidth || 1
      this.height = window.innerHeight || 1
    } else {
      const box = this.container.getBoundingClientRect()
      this.width = box.width || 1
      this.height = box.height || 1
      this.container.style.overflow = 'hidden'
    }

    this.wrapper = document.createElement('div')
    this.wrapper.style.position = 'relative'
    this.container.appendChild(this.wrapper)

    this._initParams()
    this._initStats()
    this._initCamera()
    this._initScene()

    if (this._initRenderer() === false) {
      Log.error('Viewer: could not initialize renderer')
      return
    }

    this._initHelper()

    // fog & background
    this.setBackground()
    this.setFog()

    this.animate = this.animate.bind(this)
  }

  private _initParams () {
    this.parameters = {
      fogColor: new Color(0x000000),
      fogNear: 50,
      fogFar: 100,

      backgroundColor: new Color(0x000000),

      cameraType: 'perspective',
      cameraFov: 40,
      cameraEyeSep: 0.3,
      cameraZ: -80, // FIXME initial value should be automatically determined

      clipNear: 0,
      clipFar: 100,
      clipDist: 10,
      clipMode: 'scene',
      clipScale: 'relative',

      lightColor: new Color(0xdddddd),
      lightIntensity: 1.0,
      ambientColor: new Color(0xdddddd),
      ambientIntensity: 0.2,

      sampleLevel: 0,

      // output encoding: use sRGB for a linear internal workflow, linear for traditional sRGB workflow.
      rendererEncoding: LinearEncoding,
    }
  }

  private _initCamera () {
    const lookAt = new Vector3(0, 0, 0)
    const {width, height} = this

    this.perspectiveCamera = new PerspectiveCamera(
      this.parameters.cameraFov, width / height
    )
    this.perspectiveCamera.position.z = this.parameters.cameraZ
    this.perspectiveCamera.lookAt(lookAt)

    this.orthographicCamera = new OrthographicCamera(
      width / -2, width / 2, height / 2, height / -2
    )
    this.orthographicCamera.position.z = this.parameters.cameraZ
    this.orthographicCamera.lookAt(lookAt)

    this.stereoCamera = new StereoCamera()
    this.stereoCamera.aspect = 0.5
    this.stereoCamera.eyeSep = this.parameters.cameraEyeSep

    const cameraType = this.parameters.cameraType
    if (cameraType === 'orthographic') {
      this.camera = this.orthographicCamera
    } else if(cameraType === 'perspective' || cameraType === 'stereo') {
      this.camera = this.perspectiveCamera
    } else {
      throw new Error(`Unknown cameraType '${cameraType}'`)
    }
    this.camera.updateProjectionMatrix()
  }

  private _initStats () {
    this.stats = new Stats()
  }

  private _initScene () {
    if (!this.scene) {
      this.scene = new Scene()
      this.scene.name = 'scene'
    }

    this.rotationGroup = new Group()
    this.rotationGroup.name = 'rotationGroup'
    this.scene.add(this.rotationGroup)

    this.translationGroup = new Group()
    this.translationGroup.name = 'translationGroup'
    this.rotationGroup.add(this.translationGroup)

    this.modelGroup = new Group()
    this.modelGroup.name = 'modelGroup'
    this.translationGroup.add(this.modelGroup)

    this.pickingGroup = new Group()
    this.pickingGroup.name = 'pickingGroup'
    this.translationGroup.add(this.pickingGroup)

    this.backgroundGroup = new Group()
    this.backgroundGroup.name = 'backgroundGroup'
    this.translationGroup.add(this.backgroundGroup)

    this.helperGroup = new Group()
    this.helperGroup.name = 'helperGroup'
    this.translationGroup.add(this.helperGroup)

    // fog

    this.scene.fog = new Fog(this.parameters.fogColor.getHex())

    // light

    this.spotLight = new SpotLight(
      this.parameters.lightColor.getHex(), this.parameters.lightIntensity
    )
    this.scene.add(this.spotLight)

    this.ambientLight = new AmbientLight(
      this.parameters.ambientColor.getHex(), this.parameters.ambientIntensity
    )
    this.scene.add(this.ambientLight)
  }

  private _initRenderer () {
    const dpr = window.devicePixelRatio
    const {width, height} = this

    try {
      this.renderer = new WebGLRenderer({
        preserveDrawingBuffer: true,
        alpha: true,
        antialias: true
      })
    } catch (e) {
      this.wrapper.innerHTML = WebglErrorMessage
      return false
    }
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(width, height)
    this.renderer.autoClear = false
    this.renderer.sortObjects = true
    this.renderer.outputEncoding = this.parameters.rendererEncoding

    const gl = this.renderer.getContext()
    // console.log(gl.getContextAttributes().antialias)
    // console.log(gl.getParameter(gl.SAMPLES))

    // For WebGL1, extensions must be explicitly enabled.
    // The following are builtin to WebGL2 (and don't appear as
    // extensions)
    // EXT_frag_depth, OES_element_index_uint, OES_texture_float
    // OES_texture_half_float

    // The WEBGL_color_buffer_float extension is replaced by
    // EXT_color_buffer_float

    // If not webgl2 context, explicitly check for these
    if (!this.renderer.capabilities.isWebGL2) {
      setExtensionFragDepth(this.renderer.extensions.get('EXT_frag_depth'))
      this.renderer.extensions.get('OES_element_index_uint')

      setSupportsReadPixelsFloat(
        (this.renderer.extensions.get('OES_texture_float') &&
          this.renderer.extensions.get('WEBGL_color_buffer_float')) ||
        (this.renderer.extensions.get('OES_texture_float') &&
          testTextureSupport(gl.FLOAT))
      )
      // picking texture

      this.renderer.extensions.get('OES_texture_float')

      this.supportsHalfFloat = (
        this.renderer.extensions.get('OES_texture_half_float') &&
        testTextureSupport(0x8D61)
      )

    } else {
      setExtensionFragDepth(true)
      setSupportsReadPixelsFloat(
        this.renderer.extensions.get('EXT_color_buffer_float')
      )
      this.supportsHalfFloat = true
    }

    this.wrapper.appendChild(this.renderer.domElement)

    const dprWidth = width * dpr
    const dprHeight = height * dpr


    if (Debug) {
      console.log(JSON.stringify({
        'Browser': Browser,
        'OES_texture_float': !!this.renderer.extensions.get('OES_texture_float'),
        'OES_texture_half_float': !!this.renderer.extensions.get('OES_texture_half_float'),
        'WEBGL_color_buffer_float': !!this.renderer.extensions.get('WEBGL_color_buffer_float'),
        'testTextureSupport Float': testTextureSupport(gl.FLOAT),
        'testTextureSupport HalfFloat': testTextureSupport(0x8D61),
        'this.supportsHalfFloat': this.supportsHalfFloat,
        'SupportsReadPixelsFloat': SupportsReadPixelsFloat
      }, null, 2))
    }

    this.pickingTarget = new WebGLRenderTarget(
      dprWidth, dprHeight,
      {
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        stencilBuffer: false,
        format: RGBAFormat,
        type: SupportsReadPixelsFloat ? FloatType : UnsignedByteType
      }
    )
    this.pickingTarget.texture.generateMipmaps = false
    this.pickingTarget.texture.encoding = this.parameters.rendererEncoding

    // workaround to reset the gl state after using testTextureSupport
    // fixes some bug where nothing is rendered to the canvas
    // when animations are started on page load
    this.renderer.setRenderTarget(this.pickingTarget)
    this.renderer.clear()
    this.renderer.setRenderTarget(null!)

    // ssaa textures

    this.sampleTarget = new WebGLRenderTarget(
      dprWidth, dprHeight,
      {
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        format: RGBAFormat
      }
    )
    this.sampleTarget.texture.encoding = this.parameters.rendererEncoding

    this.holdTarget = new WebGLRenderTarget(
      dprWidth, dprHeight,
      {
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        format: RGBAFormat,
        type: UnsignedByteType
        // using HalfFloatType or FloatType does not work on some Chrome 61 installations
        // type: this.supportsHalfFloat ? HalfFloatType : (
        //   SupportsReadPixelsFloat ? FloatType : UnsignedByteType
        // )
      }
    )
    this.holdTarget.texture.encoding = this.parameters.rendererEncoding

    this.compositeUniforms = {
      'tForeground': new Uniform(this.sampleTarget.texture),
      'scale': new Uniform(1.0)
    }

    this.compositeMaterial = new ShaderMaterial({
      uniforms: this.compositeUniforms,
      vertexShader: getShader('Quad.vert'),
      fragmentShader: getShader('Quad.frag'),
      premultipliedAlpha: true,
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false
    })

    this.compositeCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.compositeScene = new Scene()
    this.compositeScene.name = 'compositeScene'
    this.compositeScene.add(new Mesh(
      new PlaneGeometry(2, 2), this.compositeMaterial
    ))
  }

  private _initHelper () {
    const indices = new Uint16Array([
      0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6,
      6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7
    ])
    const positions = new Float32Array(8 * 3)

    const bbGeometry = new BufferGeometry()
    bbGeometry.setIndex(new BufferAttribute(indices, 1))
    bbGeometry.setAttribute('position', new BufferAttribute(positions, 3))
    const bbMaterial = new ShaderMaterial({
      uniforms: { 'uColor': { value: new Color('skyblue') } },
      vertexShader: getShader('BasicLine.vert'),
      fragmentShader: getShader('BasicLine.frag')
    })

    this.boundingBoxMesh = new LineSegments(bbGeometry, bbMaterial)
    this.helperGroup.add(this.boundingBoxMesh)
  }

  updateHelper () {
    const position = ((this.boundingBoxMesh.geometry as BufferGeometry).attributes as any).position  // TODO
    const array = position.array
    const {min, max} = this.boundingBox

    array[ 0 ] = max.x; array[ 1 ] = max.y; array[ 2 ] = max.z
    array[ 3 ] = min.x; array[ 4 ] = max.y; array[ 5 ] = max.z
    array[ 6 ] = min.x; array[ 7 ] = min.y; array[ 8 ] = max.z
    array[ 9 ] = max.x; array[ 10 ] = min.y; array[ 11 ] = max.z
    array[ 12 ] = max.x; array[ 13 ] = max.y; array[ 14 ] = min.z
    array[ 15 ] = min.x; array[ 16 ] = max.y; array[ 17 ] = min.z
    array[ 18 ] = min.x; array[ 19 ] = min.y; array[ 20 ] = min.z
    array[ 21 ] = max.x; array[ 22 ] = min.y; array[ 23 ] = min.z

    position.needsUpdate = true

    if (!this.boundingBox.isEmpty()) {
      this.boundingBoxMesh.geometry.computeBoundingSphere()
    }
  }

  /** Distance from origin (lookAt point) */
  get cameraDistance(): number {
    return Math.abs(this.camera.position.z)
  }

  /** Set distance from origin (lookAt point); along the -z axis */
  set cameraDistance(d: number) {
    this.camera.position.z = -d
  }

  add (buffer: Buffer, instanceList?: BufferInstance[]) {
    // Log.time( "Viewer.add" );

    if (instanceList) {
      instanceList.forEach(instance => this.addBuffer(buffer, instance))
    } else {
      this.addBuffer(buffer)
    }

    buffer.group.name = 'meshGroup'
    buffer.wireframeGroup.name = 'wireframeGroup'
    if (buffer.parameters.background) {
      this.backgroundGroup.add(buffer.group)
      this.backgroundGroup.add(buffer.wireframeGroup)
    } else {
      this.modelGroup.add(buffer.group)
      this.modelGroup.add(buffer.wireframeGroup)
    }

    if (buffer.pickable) {
      this.pickingGroup.add(buffer.pickingGroup)
    }

    if (Debug) this.updateHelper()

    // Log.timeEnd( "Viewer.add" );
  }

  addBuffer (buffer: Buffer, instance?: BufferInstance) {
    // Log.time( "Viewer.addBuffer" );

    function setUserData (object: Object3D) {
      if (object instanceof Group) {
        object.children.forEach(setUserData)
      } else {
        object.userData.buffer = buffer
        object.userData.instance = instance
        object.onBeforeRender = onBeforeRender
      }
    }

    const mesh = buffer.getMesh()
    if (instance) {
      mesh.applyMatrix4(instance.matrix)
    }
    setUserData(mesh)
    buffer.group.add(mesh)

    const wireframeMesh = buffer.getWireframeMesh()
    if (instance) {
      // wireframeMesh.applyMatrix( instance.matrix );
      wireframeMesh.matrix.copy(mesh.matrix)
      wireframeMesh.position.copy(mesh.position)
      wireframeMesh.quaternion.copy(mesh.quaternion)
      wireframeMesh.scale.copy(mesh.scale)
    }
    setUserData(wireframeMesh)
    buffer.wireframeGroup.add(wireframeMesh)

    if (buffer.pickable) {
      const pickingMesh = buffer.getPickingMesh()
      if (instance) {
        // pickingMesh.applyMatrix( instance.matrix );
        pickingMesh.matrix.copy(mesh.matrix)
        pickingMesh.position.copy(mesh.position)
        pickingMesh.quaternion.copy(mesh.quaternion)
        pickingMesh.scale.copy(mesh.scale)
      }
      setUserData(pickingMesh)
      buffer.pickingGroup.add(pickingMesh)
    }

    if (instance) {
      this._updateBoundingBox(buffer.geometry, buffer.matrix, instance.matrix)
    } else {
      this._updateBoundingBox(buffer.geometry, buffer.matrix)
    }

    // Log.timeEnd( "Viewer.addBuffer" );
  }

  remove (buffer: Buffer) {
    this.translationGroup.children.forEach(function (group) {
      group.remove(buffer.group)
      group.remove(buffer.wireframeGroup)
    })

    if (buffer.pickable) {
      this.pickingGroup.remove(buffer.pickingGroup)
    }

    this.updateBoundingBox()
    if (Debug) this.updateHelper()

    // this.requestRender();
  }

  private _updateBoundingBox (geometry?: BufferGeometry, matrix?: Matrix4, instanceMatrix?: Matrix4) {
    const boundingBox = this.boundingBox

    function updateGeometry (geometry: BufferGeometry, matrix?: Matrix4, instanceMatrix?: Matrix4) {
      if (geometry.boundingBox == null) {
        geometry.computeBoundingBox()
      }

      const geoBoundingBox = (geometry.boundingBox as Box3).clone()

      if (matrix) {
        geoBoundingBox.applyMatrix4(matrix)
      }
      if (instanceMatrix) {
        geoBoundingBox.applyMatrix4(instanceMatrix)
      }

      if (geoBoundingBox.min.equals(geoBoundingBox.max)) {
        // mainly to give a single impostor geometry some volume
        // as it is only expanded in the shader on the GPU
        geoBoundingBox.expandByScalar(5)
      }

      boundingBox.union(geoBoundingBox)
    }

    function updateNode (node: Mesh) {
      if (node.geometry !== undefined) {
        let matrix, instanceMatrix
        if (node.userData.buffer) {
          matrix = node.userData.buffer.matrix
        }
        if (node.userData.instance) {
          instanceMatrix = node.userData.instance.matrix
        }
        updateGeometry(node.geometry as BufferGeometry, matrix, instanceMatrix)  // TODO
      }
    }

    if (geometry) {
      updateGeometry(geometry, matrix, instanceMatrix)
    } else {
      boundingBox.makeEmpty()
      this.modelGroup.traverse(updateNode)
      this.backgroundGroup.traverse(updateNode)
    }

    boundingBox.getSize(this.boundingBoxSize)
    this.boundingBoxLength = this.boundingBoxSize.length()
  }

  updateBoundingBox () {
    this._updateBoundingBox()
    if (Debug) this.updateHelper()
  }

  getPickingPixels () {
    const {width, height} = this

    const n = width * height * 4
    const imgBuffer = SupportsReadPixelsFloat ? new Float32Array(n) : new Uint8Array(n)

    this.render(true)
    this.renderer.readRenderTargetPixels(
      this.pickingTarget, 0, 0, width, height, imgBuffer
    )

    return imgBuffer
  }

  getImage (picking: boolean) {
    return new Promise(resolve => {
      if (picking) {
        const {width, height} = this
        const n = width * height * 4
        let imgBuffer = this.getPickingPixels()

        if (SupportsReadPixelsFloat) {
          const imgBuffer2 = new Uint8Array(n)
          for (let i = 0; i < n; ++i) {
            imgBuffer2[ i ] = Math.round(imgBuffer[ i ] * 255)
          }
          imgBuffer = imgBuffer2
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!  // TODO
        const imgData = ctx.getImageData(0, 0, width, height)
        imgData.data.set(imgBuffer as any)  // TODO
        ctx.putImageData(imgData, 0, 0)
        canvas.toBlob(resolve as any, 'image/png')  // TODO
      } else {
        this.renderer.domElement.toBlob(resolve as any, 'image/png')  // TODO
      }
    })
  }

  makeImage (params: Partial<ImageParameters> = {}) {
    return makeImage(this, params)
  }

  setLight (color: Color|number|string, intensity: number, ambientColor: Color|number|string, ambientIntensity: number) {
    const p = this.parameters

    if (color !== undefined) p.lightColor.set(color as string)  // TODO
    if (intensity !== undefined) p.lightIntensity = intensity
    if (ambientColor !== undefined) p.ambientColor.set(ambientColor as string)  // TODO
    if (ambientIntensity !== undefined) p.ambientIntensity = ambientIntensity

    this.requestRender()
  }

  setFog (color?: Color|number|string, near?: number, far?: number) {
    const p = this.parameters

    if (color !== undefined) p.fogColor.set(color as string)  // TODO
    if (near !== undefined) p.fogNear = near
    if (far !== undefined) p.fogFar = far

    this.requestRender()
  }

  setBackground (color?: Color|number|string) {
    const p = this.parameters

    if (color) p.backgroundColor.set(color as string)  // TODO

    this.setFog(p.backgroundColor)
    this.renderer.setClearColor(p.backgroundColor, 0)
    this.renderer.domElement.style.backgroundColor = p.backgroundColor.getStyle()

    this.requestRender()
  }

  setSampling (level: number) {
    if (level !== undefined) {
      this.parameters.sampleLevel = level
      this.sampleLevel = level
    }

    this.requestRender()
  }

  /**
   * Set the output color encoding, i.e. how the renderer translates
   * colorspaces as it renders to the screen.

   * The default is LinearEncoding, because the internals of NGL are
   * already sRGB so no translation is needed to show sRGB colors.
   * Set to sRGBEncoding to create a linear workflow, and also call
   * `setColorEncoding(LinearEncoding)` to linearize colors on input.
   * @see setColorEncoding
   */
  private setOutputEncoding (encoding: TextureEncoding) {
    this.parameters.rendererEncoding = encoding
    this.renderer.outputEncoding = encoding
    this.pickingTarget.texture.encoding = encoding
    this.sampleTarget.texture.encoding = encoding
    this.holdTarget.texture.encoding = encoding
  }

  /**
   * Set the internal color workflow, linear or sRGB.
   * sRGB, the default, is more "vibrant" at the cost of accuracy.
   * Linear gives more accurate results, especially for transparent objects.
   * In all cases, the output is always sRGB; this just affects how colors are computed internally.
   * Call this just after creating the viewer, before loading any models.
   */
  setColorWorkflow (encoding: ColorWorkflow) {
    if (encoding != 'linear' && encoding != 'sRGB')
      throw new Error(`setColorWorkflow: invalid color workflow ${encoding}`)
    setColorSpace(encoding == 'linear' ? 'linear' : 'sRGB')
    this.setOutputEncoding(encoding == 'linear' ? sRGBEncoding : LinearEncoding)
    // Note: this doesn't rebuild models, so existing geometry will have
    // the old color encoding.
    this.requestRender()
  }

  setCamera (type: CameraType, fov?: number, eyeSep?: number) {
    const p = this.parameters

    if (type) p.cameraType = type
    if (fov) p.cameraFov = fov
    if (eyeSep) p.cameraEyeSep = eyeSep

    if (p.cameraType === 'orthographic') {
      if (this.camera !== this.orthographicCamera) {
        this.camera = this.orthographicCamera
        this.camera.position.copy(this.perspectiveCamera.position)
        this.camera.up.copy(this.perspectiveCamera.up)
        this.updateZoom()
      }
    } else if (p.cameraType === 'perspective' || p.cameraType === 'stereo') {
      if (this.camera !== this.perspectiveCamera) {
        this.camera = this.perspectiveCamera
        this.camera.position.copy(this.orthographicCamera.position)
        this.camera.up.copy(this.orthographicCamera.up)
      }
    } else {
      throw new Error(`Unknown cameraType '${p.cameraType}'`)
    }

    this.perspectiveCamera.fov = p.cameraFov
    this.stereoCamera.eyeSep = p.cameraEyeSep
    this.camera.updateProjectionMatrix()

    this.requestRender()
  }

  setClip (near: number, far: number, dist: number, clipMode?: string, clipScale?: string) {
    const p = this.parameters

    if (near !== undefined) p.clipNear = near
    if (far !== undefined) p.clipFar = far
    if (dist !== undefined) p.clipDist = dist
    if (clipMode !== undefined) p.clipMode = clipMode
    if (clipScale !== undefined) p.clipScale = clipScale

    this.requestRender()
  }

  setSize (width: number, height: number) {
    this.width = width || 1
    this.height = height || 1

    this.perspectiveCamera.aspect = this.width / this.height
    this.orthographicCamera.left = -this.width / 2
    this.orthographicCamera.right = this.width / 2
    this.orthographicCamera.top = this.height / 2
    this.orthographicCamera.bottom = -this.height / 2
    this.camera.updateProjectionMatrix()

    const dpr = window.devicePixelRatio

    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(width, height)

    const dprWidth = this.width * dpr
    const dprHeight = this.height * dpr

    this.pickingTarget.setSize(dprWidth, dprHeight)
    this.sampleTarget.setSize(dprWidth, dprHeight)
    this.holdTarget.setSize(dprWidth, dprHeight)

    this.requestRender()
  }

  handleResize () {
    if (this.container === document.body) {
      this.setSize(window.innerWidth, window.innerHeight)
    } else {
      const box = this.container.getBoundingClientRect()
      this.setSize(box.width, box.height)
    }
  }

  updateInfo (reset?: boolean) {
    const { memory, render } = this.info

    if (reset) {
      memory.programs = 0
      memory.geometries = 0
      memory.textures = 0

      render.calls = 0
      render.vertices = 0
      render.points = 0
    } else {
      const rInfo = this.renderer.info
      const rMemory = rInfo.memory
      const rRender = rInfo.render

      memory.geometries = rMemory.geometries
      memory.textures = rMemory.textures

      render.calls += rRender.calls
      render.faces += rRender.triangles
      render.points += rRender.points
    }
  }

  animate () {
    this.signals.ticked.dispatch(this.stats)
    const delta = window.performance.now() - this.stats.startTime

    if (delta > 500 && !this.isStill && this.sampleLevel < 3 && this.sampleLevel !== -1) {
      const currentSampleLevel = this.sampleLevel
      this.sampleLevel = 3
      this.renderPending = true
      this.render()
      this.isStill = true
      this.sampleLevel = currentSampleLevel
      if (Debug) Log.log('rendered still frame')
    }

    this.frameRequest = window.requestAnimationFrame(this.animate)
  }

  pick (x: number, y: number) {
    if (this.parameters.cameraType === 'stereo') {
      // TODO picking broken for stereo camera
      return {
        'pid': 0,
        'instance': undefined,
        'picker': undefined
      }
    }

    x *= window.devicePixelRatio
    y *= window.devicePixelRatio

    x = Math.max(x - 2, 0)
    y = Math.max(y - 2, 0)

    let pid = 0, instance, picker
    const pixelBuffer = SupportsReadPixelsFloat ? pixelBufferFloat : pixelBufferUint

    this.render(true)
    this.renderer.readRenderTargetPixels(
      this.pickingTarget, x, y, 5, 5, pixelBuffer
    )

    for (let i = 0; i < pixelOrder.length; i++) {

      const offset = pixelOrder[i] * 4

      const oid = Math.round(pixelBuffer[ offset + 3 ])
      const object = this.pickingGroup.getObjectById(oid)
      if (object) {
        instance = object.userData.instance
        picker = object.userData.buffer.picking
      } else {
        continue
      }

      if (SupportsReadPixelsFloat) {
        pid =
          ((Math.round(pixelBuffer[offset] * 255) << 16) & 0xFF0000) |
          ((Math.round(pixelBuffer[offset + 1] * 255) << 8) & 0x00FF00) |
          ((Math.round(pixelBuffer[offset + 2] * 255)) & 0x0000FF)
      } else {
        pid =
          (pixelBuffer[offset] << 16) |
          (pixelBuffer[offset + 1] << 8) |
          (pixelBuffer[offset + 2])
      }
    }
    // if( Debug ){
    //   const rgba = Array.apply( [], pixelBuffer );
    //   Log.log( pixelBuffer );
    //   Log.log(
    //     "picked color",
    //     rgba.map( c => { return c.toPrecision( 2 ) } )
    //   );
    //   Log.log( "picked pid", pid );
    //   Log.log( "picked oid", oid );
    //   Log.log( "picked object", object );
    //   Log.log( "picked instance", instance );
    //   Log.log( "picked position", x, y );
    //   Log.log( "devicePixelRatio", window.devicePixelRatio );
    // }

    return { pid, instance, picker }
  }

  requestRender () {
    if (this.renderPending) {
      // Log.info("there is still a 'render' call pending")
      return
    }

    // start gathering stats anew after inactivity
    if (window.performance.now() - this.stats.startTime > 22) {
      this.stats.begin()
      this.isStill = false
    }

    this.renderPending = true

    window.requestAnimationFrame(() => {
      this.render()
      this.stats.update()
    })
  }

  updateZoom () {
    const fov = degToRad(this.perspectiveCamera.fov)
    const height = 2 * Math.tan(fov / 2) * this.cameraDistance
    this.orthographicCamera.zoom = this.height / height
  }

  /**
   * Convert an absolute clip value to a relative one using bRadius.
   *
   * 0.0 -> 50.0
   * bRadius -> 0.0
   */
  absoluteToRelative (d: number) :number {
    return 50 * (1 - d / this.bRadius)
  }

  /**
   * Convert a relative clip value to an absolute one using bRadius
   *
   * 0.0 -> bRadius
   * 50.0 -> 0.0
   */
  relativeToAbsolute (d: number) : number {
    return this.bRadius * (1 - d / 50)
  }

  /**
   * Intepret clipMode, clipScale and set the camera and fog clipping.
   * Also ensures bRadius and cDist are valid
   */
  private __updateClipping () {
    const p = this.parameters

    // bRadius must always be updated for material-based clipping
    // and for focus calculations
    this.bRadius = Math.max(10, this.boundingBoxLength * 0.5)

    // FL: Removed below, but leaving commented as I don't understand intention
    // this.bRadius += this.boundingBox.getCenter(this.distVector).length()

    if (!isFinite(this.bRadius)) {
      this.bRadius = 50
    }

    this.camera.getWorldPosition(this.distVector)
    this.cDist = this.distVector.length()
    if (!this.cDist) {
      // recover from a broken (NaN) camera position
      this.cameraDistance = Math.abs(p.cameraZ)
      this.cDist = Math.abs(p.cameraZ)
    }

    // fog
    const fog = this.scene.fog as Fog
    fog.color.set(p.fogColor)

    if (p.clipMode === 'camera') {
      // Always interpret clipScale as absolute for clipMode camera

      this.camera.near = p.clipNear
      this.camera.far = p.clipFar
      fog.near = p.fogNear
      fog.far = p.fogFar

    } else {
      // scene mode

      if (p.clipScale === 'absolute') {
        // absolute scene mode; offset clip planes from scene center
        // (note: positive values move near plane towards camera and rear plane away)

        this.camera.near = this.cDist - p.clipNear
        this.camera.far = this.cDist + p.clipFar
        fog.near = this.cDist - p.fogNear
        fog.far = this.cDist + p.fogFar

      } else {
        // relative scene mode (default): convert pecentages to Angstroms

        const nearFactor = (50 - p.clipNear) / 50
        const farFactor = -(50 - p.clipFar) / 50
        this.camera.near = this.cDist - (this.bRadius * nearFactor)
        this.camera.far = this.cDist + (this.bRadius * farFactor)

        const fogNearFactor = (50 - p.fogNear) / 50
        const fogFarFactor = -(50 - p.fogFar) / 50
        fog.near = this.cDist - (this.bRadius * fogNearFactor)
        fog.far = this.cDist + (this.bRadius * fogFarFactor)
      }
    }

    if (p.clipMode !== 'camera') {

      if (this.camera.type === 'PerspectiveCamera') {

        this.camera.near = Math.max(0.1, p.clipDist, this.camera.near)
        this.camera.far = Math.max(1, this.camera.far)
        fog.near = Math.max(0.1, fog.near)
        fog.far = Math.max(1, fog.far)
      } else if (this.camera.type === 'OrthographicCamera') {

        if (p.clipDist > 0) {
          this.camera.near = Math.max(p.clipDist, this.camera.near)
        }
      }
    }
  }

  private __updateCamera () {
    const camera = this.camera
    camera.updateMatrix()
    camera.updateMatrixWorld(true)
    camera.updateProjectionMatrix()

    updateMaterialUniforms(this.scene, camera, this.renderer, this.cDist, this.bRadius)
    sortProjectedPosition(this.scene, camera)
  }

  private __setVisibility (model: boolean, picking: boolean, background: boolean, helper: boolean) {
    this.modelGroup.visible = model
    this.pickingGroup.visible = picking
    this.backgroundGroup.visible = background
    this.helperGroup.visible = helper
  }

  private __updateLights () {
    this.spotLight.color.set(this.parameters.lightColor)
    this.spotLight.intensity = this.parameters.lightIntensity

    this.distVector.copy(this.camera.position).setLength(this.boundingBoxLength * 100)
    this.spotLight.position.copy(this.camera.position).add(this.distVector)

    this.ambientLight.color.set(this.parameters.ambientColor)
    this.ambientLight.intensity = this.parameters.ambientIntensity
  }

  private __renderPickingGroup (camera: PerspectiveCamera|OrthographicCamera) {
    this.renderer.setRenderTarget(this.pickingTarget || null)
    this.renderer.clear()
    this.__setVisibility(false, true, false, false)
    this.renderer.render(this.scene, camera)
    //  back to standard render target
    this.renderer.setRenderTarget(null)
    this.updateInfo()

    // if (Debug) {
    //   this.__setVisibility(false, true, false, true);

    //   this.renderer.clear();
    //   this.renderer.render(this.scene, camera);
    // }
  }

  private __renderModelGroup (camera: PerspectiveCamera|OrthographicCamera, renderTarget?: WebGLRenderTarget) {
    this.renderer.setRenderTarget(renderTarget || null)
    this.renderer.clear()
    this.__setVisibility(false, false, true, false)
    this.renderer.render(this.scene, camera)
    this.renderer.clear(false, true, true)
    this.updateInfo()

    this.__setVisibility(true, false, false, Debug)
    this.renderer.render(this.scene, camera)
    this.renderer.setRenderTarget(null) // set back to default canvas
    this.updateInfo()
  }

  private __renderSuperSample (camera: PerspectiveCamera|OrthographicCamera, renderTarget?: WebGLRenderTarget) {
    // based on the Supersample Anti-Aliasing Render Pass
    // contributed to three.js by bhouston / http://clara.io/
    //
    // This manual approach to SSAA re-renders the scene ones for
    // each sample with camera jitter and accumulates the results.
    // References: https://en.wikipedia.org/wiki/Supersampling
    const offsetList = JitterVectors[ Math.max(0, Math.min(this.sampleLevel, 5)) ]

    const baseSampleWeight = 1.0 / offsetList.length
    const roundingRange = 1 / 32

    this.compositeUniforms.tForeground.value = this.sampleTarget.texture

    let width = this.sampleTarget.width
    const height = this.sampleTarget.height
    if (this.parameters.cameraType === 'stereo') {
      width /= 2
    }

    // render the scene multiple times, each slightly jitter offset
    // from the last and accumulate the results.
    for (let i = 0; i < offsetList.length; ++i) {
      const offset = offsetList[ i ]
      camera.setViewOffset(
        width, height, offset[ 0 ], offset[ 1 ], width, height
      )
      camera.updateProjectionMatrix()
      updateCameraUniforms(this.scene, camera)

      let sampleWeight = baseSampleWeight
      // the theory is that equal weights for each sample lead to an
      // accumulation of rounding errors.
      // The following equation varies the sampleWeight per sample
      // so that it is uniformly distributed across a range of values
      // whose rounding errors cancel each other out.
      const uniformCenteredDistribution = -0.5 + (i + 0.5) / offsetList.length
      sampleWeight += roundingRange * uniformCenteredDistribution
      this.compositeUniforms.scale.value = sampleWeight

      this.__renderModelGroup(camera, this.sampleTarget)
      this.renderer.setRenderTarget(this.holdTarget)
      if (i === 0)  {
        this.renderer.clear()
      }

      this.renderer.render(this.compositeScene, this.compositeCamera)
    }

    this.compositeUniforms.scale.value = 1.0
    this.compositeUniforms.tForeground.value = this.holdTarget.texture

    camera.clearViewOffset()
    this.renderer.setRenderTarget(renderTarget || null)
    this.renderer.clear()
    this.renderer.render(this.compositeScene, this.compositeCamera)
  }

  private __renderStereo (picking = false, _renderTarget?: WebGLRenderTarget) {
    const stereoCamera = this.stereoCamera
    stereoCamera.update(this.perspectiveCamera);

    const renderer = this.renderer
    let size = new Vector2()
    renderer.getSize(size)

    renderer.setScissorTest(true)

    renderer.setScissor(0, 0, size.width / 2, size.height)
    renderer.setViewport(0, 0, size.width / 2, size.height)
    updateCameraUniforms(this.scene, stereoCamera.cameraL)
    this.__render(picking, stereoCamera.cameraL)

    renderer.setScissor(size.width / 2, 0, size.width / 2, size.height)
    renderer.setViewport(size.width / 2, 0, size.width / 2, size.height)
    updateCameraUniforms(this.scene, stereoCamera.cameraR)
    this.__render(picking, stereoCamera.cameraR)

    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, size.width, size.height)
  }

  private __render(picking = false, camera: PerspectiveCamera|OrthographicCamera, renderTarget?: WebGLRenderTarget) {
    if (picking) {
      if (!this.lastRenderedPicking) this.__renderPickingGroup(camera)
    } else if (this.sampleLevel > 0 && this.parameters.cameraType !== 'stereo') {
      // TODO super sample broken for stereo camera
      this.__renderSuperSample(camera, renderTarget)
    } else {
      this.__renderModelGroup(camera, renderTarget)
    }
  }

  render (picking = false, renderTarget?: WebGLRenderTarget) {
    if (this.rendering) {
      Log.warn("'tried to call 'render' from within 'render'")
      return
    }

    // Log.time('Viewer.render')

    this.rendering = true

    try {
      this.__updateClipping()
      this.__updateCamera()
      this.__updateLights()
      this.updateInfo(true)

      // render
      if (this.parameters.cameraType === 'stereo') {
        this.__renderStereo(picking, renderTarget)
      } else {
        this.__render(picking, this.camera, renderTarget)
      }
      this.lastRenderedPicking = picking
    } finally {
      this.rendering = false
      this.renderPending = false
    }
    this.signals.rendered.dispatch()

    // Log.timeEnd('Viewer.render')
    // Log.log(this.info.memory, this.info.render)
  }

  clear () {
    Log.log('scene cleared')
    this.scene.remove(this.rotationGroup)
    this._initScene()
    this.renderer.clear()
  }

  dispose () {
    this.renderer.dispose()
    window.cancelAnimationFrame(this.frameRequest)
  }
}
