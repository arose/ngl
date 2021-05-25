/**
 * @file Stage
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */

import { Vector3, Box3 } from 'three'
import { Signal } from 'signals'

import {
  Debug, Log, Mobile, ComponentRegistry, ParserRegistry
} from '../globals'
import { defaults, createParams, updateParams } from '../utils'
import { degToRad, clamp, pclamp } from '../math/math-utils'
import Counter from '../utils/counter'
import Viewer from '../viewer/viewer'
import { ImageParameters } from '../viewer/viewer-utils'
import MouseObserver from './mouse-observer'

import TrackballControls from '../controls/trackball-controls'
import PickingControls from '../controls/picking-controls'
import ViewerControls from '../controls/viewer-controls'
import AnimationControls from '../controls/animation-controls'
import MouseControls, { MouseControlPreset } from '../controls/mouse-controls'
import KeyControls from '../controls/key-controls'

import PickingBehavior from './picking-behavior'
import MouseBehavior from './mouse-behavior'
import AnimationBehavior from './animation-behavior'
import KeyBehavior from './key-behavior'

import Component, { ComponentParameters } from '../component/component'
import RepresentationElement from '../component/representation-element'
import StructureComponent from '../component/structure-component'
import SurfaceComponent from '../component/surface-component'
import VolumeComponent from '../component/volume-component'
import ComponentCollection from '../component/component-collection'
import RepresentationCollection from '../component/representation-collection'
import { autoLoad, getFileInfo, LoaderParameters } from '../loader/loader-utils'
import AtomProxy from '../proxy/atom-proxy'
import Animation from '../animation/animation'
import Selection from '../selection/selection'

import Structure from '../structure/structure'
import Surface from '../surface/surface'
import Volume from '../surface/volume'
import Shape from '../geometry/shape'
import Script from '../script'

function matchName (name: string|RegExp, object: { name: string }) {
  if (name instanceof RegExp) {
    return object.name.match(name) !== null
  } else {
    return object.name === name
  }
}

const tmpZoomVector = new Vector3()

declare global {
  interface Document {
    mozFullScreen: boolean
    mozFullScreenEnabled: boolean
    mozFullScreenElement: Element
    mozCancelFullScreen(): void

    msFullscreenEnabled: boolean
    msFullscreenElement: Element
    msExitFullscreen(): void
  }

  interface Element {
    mozRequestFullScreen(): void
    msRequestFullscreen(): void
  }
}

/**
 * Stage parameter object.
 * @typedef {Object} StageParameters - stage parameters
 * @property {Color} backgroundColor - background color
 * @property {Integer} sampleLevel - sampling level for antialiasing, between -1 and 5;
 *                                   -1: no sampling, 0: only sampling when not moving
 * @property {Boolean} workerDefault - default value for useWorker parameter of representations
 * @property {Float} rotateSpeed - camera-controls rotation speed, between 0 and 10
 * @property {Float} zoomSpeed - camera-controls zoom speed, between 0 and 10
 * @property {Float} panSpeed - camera-controls pan speed, between 0 and 10
 * @property {Float} clipNear - position of camera near/front clipping plane
 *                                in percent of scene bounding box
 * @property {Float} clipFar - position of camera far/back clipping plane
 *                               in percent of scene bounding box
 * @property {Float} clipDist - camera clipping distance in Angstrom
 * @property {String} clipMode - how to interpret clipNear/Far and fogNear/Far values: "scene" for scene-relative, "camera" for camera-relative
 * @property {String} clipScale - "relative" or "absolute": interpret clipNear/Far and fogNear/Far as percentage of bounding box or absolute Angstroms (ignored when clipMode==camera)
 * @property {Float} fogNear - position of the start of the fog effect
 *                               in percent of scene bounding box
 * @property {Float} fogFar - position where the fog is in full effect
 *                              in percent of scene bounding box
 * @property {String} cameraType - type of camera, either 'persepective' or 'orthographic'
 * @property {Float} cameraFov - perspective camera field of view in degree, between 15 and 120
 * @property {Float} cameraEyeSep - stereo camera eye seperation
 * @property {Color} lightColor - point light color
 * @property {Float} lightIntensity - point light intensity
 * @property {Color} ambientColor - ambient light color
 * @property {Float} ambientIntensity - ambient light intensity
 * @property {Integer} hoverTimeout - timeout for hovering
 */

export interface StageSignals {
  parametersChanged: Signal
  fullscreenChanged: Signal
  componentAdded: Signal
  componentRemoved: Signal
  clicked: Signal
  hovered: Signal
}

export type RenderQualityType = 'auto'|'low'|'medium'|'high'

export const StageDefaultParameters = {
  impostor: true,
  quality: 'medium' as RenderQualityType,
  workerDefault: true,
  sampleLevel: 0,
  backgroundColor: 'black' as string|number,
  rotateSpeed: 2.0,
  zoomSpeed: 1.2,
  panSpeed: 1.0,
  clipNear: 0,
  clipFar: 100,
  clipDist: 10,
  clipMode: 'scene',
  clipScale: 'relative',
  fogNear: 50,
  fogFar: 100,
  cameraFov: 40,
  cameraEyeSep: 0.3,
  cameraType: 'perspective' as 'perspective'|'orthographic'|'stereo',
  lightColor: 0xdddddd as string|number,
  lightIntensity: 1.0,
  ambientColor: 0xdddddd as string|number,
  ambientIntensity: 0.2,
  hoverTimeout: 0,
  tooltip: true,
  mousePreset: 'default' as MouseControlPreset
}
export type StageParameters = typeof StageDefaultParameters

export interface StageLoadFileParams extends LoaderParameters {
  defaultRepresentation: boolean,
  assembly: string
}

/**
 * Stage class, central for creating molecular scenes with NGL.
 *
 * @example
 * var stage = new Stage( "elementId", { backgroundColor: "white" } );
 */
class Stage {
  signals: StageSignals = {
    parametersChanged: new Signal(),
    fullscreenChanged: new Signal(),
    componentAdded: new Signal(),
    componentRemoved: new Signal(),
    clicked: new Signal(),
    hovered: new Signal()
  }
  parameters: StageParameters

  /**
   * Counter that keeps track of various potentially long-running tasks,
   * including file loading and surface calculation.
   */
  tasks = new Counter()
  compList: Component[] = []
  defaultFileParams = {}
  logList: string[] = []

  transformComponent?: Component
  transformAtom?: AtomProxy

  viewer: Viewer
  tooltip: HTMLElement
  lastFullscreenElement: HTMLElement

  mouseObserver: MouseObserver
  viewerControls: ViewerControls
  trackballControls: TrackballControls
  pickingControls: PickingControls
  animationControls: AnimationControls
  mouseControls: MouseControls
  keyControls: KeyControls

  pickingBehavior: PickingBehavior
  mouseBehavior: MouseBehavior
  animationBehavior: AnimationBehavior
  keyBehavior: KeyBehavior

  spinAnimation: Animation
  rockAnimation: Animation

  constructor (idOrElement: string|HTMLElement, params: Partial<StageParameters> = {}) {
    this.viewer = new Viewer(idOrElement)
    if (!this.viewer.renderer) return

    this.tooltip = document.createElement('div')
    Object.assign(this.tooltip.style, {
      display: 'none',
      position: 'fixed',
      zIndex: '1000000',
      pointerEvents: 'none',
      backgroundColor: 'rgba( 0, 0, 0, 0.6 )',
      color: 'lightgrey',
      padding: '8px',
      fontFamily: 'sans-serif'
    })
    this.viewer.container.appendChild(this.tooltip)

    this.mouseObserver = new MouseObserver(this.viewer.renderer.domElement)
    this.viewerControls = new ViewerControls(this)
    this.trackballControls = new TrackballControls(this)
    this.pickingControls = new PickingControls(this)
    this.animationControls = new AnimationControls(this)
    this.mouseControls = new MouseControls(this)
    this.keyControls = new KeyControls(this)

    this.pickingBehavior = new PickingBehavior(this)
    this.mouseBehavior = new MouseBehavior(this)
    this.animationBehavior = new AnimationBehavior(this)
    this.keyBehavior = new KeyBehavior(this)

    this.spinAnimation = this.animationControls.spin([ 0, 1, 0 ], 0.005)
    this.spinAnimation.pause(true)
    this.rockAnimation = this.animationControls.rock([ 0, 1, 0 ], 0.005)
    this.rockAnimation.pause(true)

    // must come after the viewer has been instantiated
    this.parameters = createParams(params, StageDefaultParameters)
    this.setParameters(this.parameters)

    this.viewer.animate()
  }

  /**
   * Set stage parameters
   */
  setParameters (params: Partial<StageParameters> = {}) {
    updateParams(this.parameters, params)

    const p = params
    const tp = this.parameters

    const viewer = this.viewer
    const controls = this.trackballControls

    // apply parameters
    if (p.quality !== undefined) this.setQuality(tp.quality)
    if (p.impostor !== undefined) this.setImpostor(tp.impostor)
    if (p.rotateSpeed !== undefined) controls.rotateSpeed = tp.rotateSpeed
    if (p.zoomSpeed !== undefined) controls.zoomSpeed = tp.zoomSpeed
    if (p.panSpeed !== undefined) controls.panSpeed = tp.panSpeed
    if (p.mousePreset !== undefined) this.mouseControls.preset(tp.mousePreset)
    this.mouseObserver.setParameters({ hoverTimeout: tp.hoverTimeout })
    viewer.setClip(tp.clipNear, tp.clipFar, tp.clipDist, tp.clipMode, tp.clipScale)
    viewer.setFog(undefined, tp.fogNear, tp.fogFar)
    viewer.setCamera(tp.cameraType, tp.cameraFov, tp.cameraEyeSep)
    viewer.setSampling(tp.sampleLevel)
    viewer.setBackground(tp.backgroundColor)
    viewer.setLight(tp.lightColor, tp.lightIntensity, tp.ambientColor, tp.ambientIntensity)

    this.signals.parametersChanged.dispatch(this.getParameters())

    return this
  }

  log (msg: string) {
    console.log('STAGE LOG', msg)
    this.logList.push(msg)
  }

  /**
   * Get stage parameters
   */
  getParameters () {
    return Object.assign({}, this.parameters)
  }

  /**
   * Create default representations for the given component
   * @param  {StructureComponent|SurfaceComponent} object - component to create the representations for
   * @return {undefined}
   */
  defaultFileRepresentation (component: Component) {
    if (component instanceof StructureComponent) {
      component.setSelection('/0')

      let atomCount, residueCount, instanceCount
      const structure = component.structure

      if (structure.biomolDict.BU1) {
        const assembly = structure.biomolDict.BU1
        atomCount = assembly.getAtomCount(structure)
        residueCount = assembly.getResidueCount(structure)
        instanceCount = assembly.getInstanceCount()
        component.setDefaultAssembly('BU1')
      } else {
        atomCount = structure.getModelProxy(0).atomCount
        residueCount = structure.getModelProxy(0).residueCount
        instanceCount = 1
      }

      let sizeScore = atomCount

      if (Mobile) {
        sizeScore *= 4
      }

      const backboneOnly = structure.atomStore.count / structure.residueStore.count < 2
      if (backboneOnly) {
        sizeScore *= 10
      }

      let colorScheme = 'chainname'
      let colorScale = 'RdYlBu'
      let colorReverse = false
      if (structure.getChainnameCount(new Selection('polymer and /0')) === 1) {
        colorScheme = 'residueindex'
        colorScale = 'Spectral'
        colorReverse = true
      }

      if (Debug) console.log(sizeScore, atomCount, instanceCount, backboneOnly)

      if (residueCount / instanceCount < 4) {
        component.addRepresentation('ball+stick', {
          colorScheme: 'element',
          radiusScale: 2.0,
          aspectRatio: 1.5,
          bondScale: 0.3,
          bondSpacing: 0.75,
          quality: 'auto'
        })
      } else if ((instanceCount > 5 && sizeScore > 15000) || sizeScore > 700000) {
        let scaleFactor = (
          Math.min(
            2.0,
            Math.max(
              0.1,
              6000 / (sizeScore / instanceCount)
            )
          )
        )
        if (backboneOnly) scaleFactor = Math.min(scaleFactor, 0.5)

        component.addRepresentation('surface', {
          colorScheme, colorScale, colorReverse,
          sele: 'polymer',
          surfaceType: 'av',
          probeRadius: 1.4,
          scaleFactor: scaleFactor,
          useWorker: false
        })
      } else if (sizeScore > 250000) {
        component.addRepresentation('backbone', {
          colorScheme, colorScale, colorReverse,
          lineOnly: true
        })
      } else if (sizeScore > 100000) {
        component.addRepresentation('backbone', {
          colorScheme, colorScale, colorReverse,
          quality: 'low',
          disableImpostor: true,
          radiusScale: 2.0
        })
      } else if (sizeScore > 80000) {
        component.addRepresentation('backbone', {
          colorScheme, colorScale, colorReverse,
          radiusScale: 2.0
        })
      } else {
        component.addRepresentation('cartoon', {
          colorScheme, colorScale, colorReverse,
          radiusScale: 0.7,
          aspectRatio: 5,
          quality: 'auto'
        })
        if (sizeScore < 50000) {
          component.addRepresentation('base', {
            colorScheme, colorScale, colorReverse,
            quality: 'auto'
          })
        }
        component.addRepresentation('ball+stick', {
          sele: 'ligand',
          colorScheme: 'element',
          radiusScale: 2.0,
          aspectRatio: 1.5,
          bondScale: 0.3,
          bondSpacing: 0.75,
          quality: 'auto'
        })
      }

      // add frames as trajectory
      if (component.structure.frames.length) {
        component.addTrajectory()
      }
    } else if (component instanceof SurfaceComponent) {
      component.addRepresentation('surface')
    } else if (component instanceof VolumeComponent) {
      component.addRepresentation('surface')
    }

    this.tasks.onZeroOnce(this.autoView, this)
  }

  /**
   * Load a file onto the stage
   *
   * @example
   * // load from URL
   * stage.loadFile( "http://files.rcsb.org/download/5IOS.cif" );
   *
   * @example
   * // load binary data in CCP4 format via a Blob
   * var binaryBlob = new Blob( [ ccp4Data ], { type: 'application/octet-binary'} );
   * stage.loadFile( binaryBlob, { ext: "ccp4" } );
   *
   * @example
   * // load string data in PDB format via a Blob
   * var stringBlob = new Blob( [ pdbData ], { type: 'text/plain'} );
   * stage.loadFile( stringBlob, { ext: "pdb" } );
   *
   * @example
   * // load a File object
   * stage.loadFile( file );
   *
   * @example
   * // load from URL and add a 'ball+stick' representation with double/triple bonds
   * stage.loadFile( "http://files.rcsb.org/download/1crn.cif" ).then( function( comp ){
   *     comp.addRepresentation( "ball+stick", { multipleBond: true } );
   * } );
   *
   * @param  {String|File|Blob} path - either a URL or an object containing the file data
   * @param  {LoaderParameters} params - loading parameters
   * @param  {Boolean} params.asTrajectory - load multi-model structures as a trajectory
   * @return {Promise} A Promise object that resolves to a {@link StructureComponent},
   *                   a {@link SurfaceComponent} or a {@link ScriptComponent} object,
   *                   depending on the type of the loaded file.
   */
  loadFile (path: string|File|Blob, params: Partial<StageLoadFileParams> = {}) {
    const p = Object.assign({}, this.defaultFileParams, params)
    const name = getFileInfo(path).name

    this.tasks.increment()
    this.log(`loading file '${name}'`)

    const onLoadFn = (object: Structure|Surface|Volume) => {
      this.log(`loaded '${name}'`)

      const component = this.addComponentFromObject(object, p)
      if (p.defaultRepresentation) {
        this.defaultFileRepresentation(component as Component)
      }
      this.tasks.decrement()

      return component
    }

    const onErrorFn = (e: Error|string) => {
      this.tasks.decrement()
      const errorMsg = `error loading file: '${e}'`
      this.log(errorMsg)
      throw errorMsg  // throw so it can be catched
    }

    const ext = defaults(p.ext, getFileInfo(path).ext)
    let promise: Promise<any>

    if (ParserRegistry.isTrajectory(ext)) {
      promise = Promise.reject(
        new Error(`loadFile: ext '${ext}' is a trajectory and must be loaded into a structure component`)
      )
    } else {
      promise = autoLoad(path, p)
    }

    return promise.then(onLoadFn, onErrorFn)
  }

  loadScript (path: string|File|Blob) {
    const name = getFileInfo(path).name

    this.log(`loading script '${name}'`)

    return autoLoad(path).then(
      (script: Script) => {
        this.tasks.increment()
        this.log(`running script '${name}'`)
        script.run(this).then(() => {
          this.tasks.decrement()
          this.log(`finished script '${name}'`)
        })
        this.log(`called script '${name}'`)
      },
      (error: Error|string) => {
        this.tasks.decrement()
        const errorMsg = `errored script '${name}' "${error}"`
        this.log(errorMsg)
        throw errorMsg  // throw so it can be catched
      }
    )
  }

  /**
   * Add the given component to the stage
   * @param {Component} component - the component to add
   * @return {undefined}
   */
  addComponent (component: Component) {
    if (!component) {
      Log.warn('Stage.addComponent: no component given')
      return
    }

    this.compList.push(component)
    this.signals.componentAdded.dispatch(component)
  }

  /**
   * Create a component from the given object and add to the stage
   */
  addComponentFromObject (object: Structure|Surface|Volume|Shape, params: Partial<ComponentParameters> = {}): void|Component {
    const CompClass = ComponentRegistry.get(object.type)

    if (CompClass) {
      const component = new CompClass(this, object, params)
      this.addComponent(component)
      return component
    }

    Log.warn('no component for object type', object.type)
  }

  /**
   * Remove the given component
   * @param  {Component} component - the component to remove
   * @return {undefined}
   */
  removeComponent (component: Component) {
    const idx = this.compList.indexOf(component)
    if (idx !== -1) {
      this.compList.splice(idx, 1)
      component.dispose()
      this.signals.componentRemoved.dispatch(component)
    }
  }

  /**
   * Remove all components from the stage
   */
  removeAllComponents () {
    this.compList.slice().forEach(o => this.removeComponent(o))
  }

  /**
   * Handle any size-changes of the container element
   * @return {undefined}
   */
  handleResize () {
    this.viewer.handleResize()
  }

  /**
   * Set width and height
   * @param {String} width - CSS width value
   * @param {String} height - CSS height value
   * @return {undefined}
   */
  setSize (width: string, height: string) {
    const container = this.viewer.container

    if (container !== document.body) {
      if (width !== undefined) container.style.width = width
      if (height !== undefined) container.style.height = height
      this.handleResize()
    }
  }

  /**
   * Toggle fullscreen
   * @param  {Element} [element] - document element to put into fullscreen,
   *                               defaults to the viewer container
   * @return {undefined}
   */
  toggleFullscreen (element: HTMLElement) {
    if (!document.fullscreenEnabled && !document.mozFullScreenEnabled &&
        !(document as any).webkitFullscreenEnabled && !document.msFullscreenEnabled
    ) {
      Log.log('fullscreen mode (currently) not possible')
      return
    }

    const self = this
    element = element || this.viewer.container
    this.lastFullscreenElement = element

    //

    function getFullscreenElement () {
      return document.fullscreenElement || document.mozFullScreenElement ||
        (document as any).webkitFullscreenElement || document.msFullscreenElement
    }

    function resizeElement () {
      if (!getFullscreenElement() && self.lastFullscreenElement) {
        const element = self.lastFullscreenElement
        element.style.width = element.dataset.normalWidth || ''
        element.style.height = element.dataset.normalHeight || ''

        document.removeEventListener('fullscreenchange', resizeElement)
        document.removeEventListener('mozfullscreenchange', resizeElement)
        document.removeEventListener('webkitfullscreenchange', resizeElement)
        document.removeEventListener('MSFullscreenChange', resizeElement)

        self.handleResize()
        self.signals.fullscreenChanged.dispatch(false)
      }
    }

    //

    if (!getFullscreenElement()) {
      element.dataset.normalWidth = element.style.width || ''
      element.dataset.normalHeight = element.style.height || ''
      element.style.width = window.screen.width + 'px'
      element.style.height = window.screen.height + 'px'

      if (element.requestFullscreen) {
        element.requestFullscreen()
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen()
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen()
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen()
      }

      document.addEventListener('fullscreenchange', resizeElement)
      document.addEventListener('mozfullscreenchange', resizeElement)
      document.addEventListener('webkitfullscreenchange', resizeElement)
      document.addEventListener('MSFullscreenChange', resizeElement)

      this.handleResize()
      this.signals.fullscreenChanged.dispatch(true)

      // workaround for Safari
      setTimeout(function () { self.handleResize() }, 100)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen()
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen()
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen()
      }
    }
  }

  /**
   * Set spin
   * @param {Boolean} flag - if true start rocking and stop spinning
   * @return {undefined}
   */
  setSpin (flag: boolean) {
    if (flag) {
      this.spinAnimation.resume(true)
      this.rockAnimation.pause(true)
    } else {
      this.spinAnimation.pause(true)
    }
  }

  /**
   * Set rock
   * @param {Boolean} flag - if true start rocking and stop spinning
   * @return {undefined}
   */
  setRock (flag: boolean) {
    if (flag) {
      this.rockAnimation.resume(true)
      this.spinAnimation.pause(true)
    } else {
      this.rockAnimation.pause(true)
    }
  }

  /**
   * Toggle spin
   * @return {undefined}
   */
  toggleSpin () {
    this.setSpin(this.spinAnimation.paused)
  }

  /**
   * Toggle rock
   * @return {undefined}
   */
  toggleRock () {
    this.setRock(this.rockAnimation.paused)
  }

  /**
   * Get the current focus from the current clipNear value expressed
   * as 0 (full view) to 100 (completely clipped)
   * Negative values may be returned in some cases.
   *
   * In 'camera' clipMode focus isn't applicable, this method returns 0.0
   *
   * @return {number} focus
   */
  getFocus () : number {
    const p = this.parameters
    if (p.clipMode !== 'scene') return 0.0

    let clipNear = p.clipNear
    if (p.clipScale === 'absolute') {
      clipNear = this.viewer.absoluteToRelative(clipNear)
    }
    return clipNear * 2
  }


  /**
   * Set the focus, a value of 0 sets clipping planes to show full scene,
   * while a value of 100 will compltely clip the scene.
   *
   * @param {number} value focus
   */
  setFocus (value: number) {
    if (this.parameters.clipMode !== 'scene') return

    let clipNear
    let clipFar
    let fogNear
    let fogFar

    if (this.parameters.clipScale === 'relative') {
      clipNear = clamp(value / 2.0, 0.0, 49.9)
      clipFar = 100 - clipNear
      fogNear = 50
      fogFar = pclamp(2 * clipFar - 50)

    } else {
      clipNear = this.viewer.relativeToAbsolute(value / 2.0)
      clipFar = clipNear
      fogNear = 0
      fogFar = 2 * clipFar
    }

    this.setParameters({ clipNear, clipFar, fogNear, fogFar })
  }

  getZoomForBox (boundingBox: Box3) {
    const bbSize = boundingBox.getSize(tmpZoomVector)
    const maxSize = Math.max(bbSize.x, bbSize.y, bbSize.z)
    const minSize = Math.min(bbSize.x, bbSize.y, bbSize.z)
    let distance = maxSize + Math.sqrt(minSize)

    const fov = degToRad(this.viewer.perspectiveCamera.fov)
    const width = this.viewer.width
    const height = this.viewer.height
    const aspect = width / height
    const aspectFactor = (height < width ? 1 : aspect)

    distance = Math.abs(
      ((distance * 0.5) / aspectFactor) / Math.sin(fov / 2)
    )
    distance += this.parameters.clipDist
    return -distance
  }

  getBox () {
    return this.viewer.boundingBox
  }

  getZoom () {
    return this.getZoomForBox(this.getBox())
  }

  getCenter (optionalTarget?: Vector3) {
    return this.getBox().getCenter(optionalTarget || new Vector3())
  }

  /**
   * Add a zoom and a move animation with automatic targets
   * @param  {Integer} duration - animation time in milliseconds
   * @return {undefined}
   */
  autoView (duration?: number) {
    this.animationControls.zoomMove(
      this.getCenter(),
      this.getZoom(),
      defaults(duration, 0)
    )
  }

  /**
   * Make image from what is shown in a viewer canvas
   */
  makeImage (params: Partial<ImageParameters> = {}) {
    return new Promise<Blob>((resolve, reject) => {
      this.tasks.onZeroOnce(() => {
        this.tasks.increment()
        this.viewer.makeImage(params).then(blob => {
          this.tasks.decrement()
          resolve(blob)
        }).catch(e => {
          this.tasks.decrement()
          reject(e)
        })
      })
    })
  }

  setImpostor (value: boolean) {
    this.parameters.impostor = value

    const types = [
      'spacefill', 'ball+stick', 'licorice', 'hyperball',
      'backbone', 'rocket', 'helixorient', 'contact', 'distance',
      'dot'
    ]

    this.eachRepresentation(function (reprElem) {
      if (!types.includes(reprElem.getType())) return

      const p = reprElem.getParameters() as any  // TODO
      p.disableImpostor = !value
      reprElem.build(p)
    })
  }

  setQuality (value: RenderQualityType) {
    this.parameters.quality = value

    const types = [
      'tube', 'cartoon', 'ribbon', 'trace', 'rope'
    ]

    const impostorTypes = [
      'spacefill', 'ball+stick', 'licorice', 'hyperball',
      'backbone', 'rocket', 'helixorient', 'contact', 'distance',
      'dot'
    ]

    this.eachRepresentation(function (repr) {
      const p = repr.getParameters() as any  // TODO

      if (!types.includes(repr.getType())) {
        if (!impostorTypes.includes(repr.getType())) return

        if (!p.disableImpostor) {
          (repr.repr as any).quality = value  // TODO
          return
        }
      }

      p.quality = value
      repr.build(p)
    })
  }

  /**
   * Iterator over each component and executing the callback
   */
  eachComponent (callback: (comp: Component) => void, type?: string) {
    this.compList.slice().forEach(comp => {
      if (type === undefined || type === comp.type) callback(comp)
    })
  }

  /**
   * Iterator over each representation and executing the callback
   */
  eachRepresentation (callback: (reprElem: RepresentationElement, comp: Component) => void, type?: string) {
    this.eachComponent(comp => {
      comp.reprList.slice().forEach(reprElem => {
        if (type === undefined || type === reprElem.getType()) callback(reprElem, comp)
      })
    })
  }

  /**
   * Get collection of components by name
   */
  getComponentsByName (name: string|RegExp) {
    const compList: Component[] = []

    this.eachComponent(comp => {
      if (name === undefined || matchName(name, comp)) compList.push(comp)
    })

    return new ComponentCollection(compList)
  }

  /**
   * Get collection of components by object
   */
  getComponentsByObject (object: Structure|Surface|Volume|Shape) {
    const compList: Component[] = []

    this.eachComponent(comp => {
      if (comp.object === object) compList.push(comp)
    })

    return new ComponentCollection(compList)
  }

  /**
   * Get collection of representations by name
   */
  getRepresentationsByName (name: string|RegExp) {
    const reprList: RepresentationElement[] = []

    this.eachRepresentation((repr, comp) => {
      if (name === undefined || matchName(name, repr)) reprList.push(repr)
    })

    return new RepresentationCollection(reprList)
  }

  measureClear () {
    this.eachComponent((sc: StructureComponent) => sc.measureClear(), 'structure')
  }

  measureUpdate () {
    this.eachComponent((sc: StructureComponent) => sc.measureUpdate(), 'structure')
  }

  /**
   * Cleanup when disposing of a stage object
   */
  dispose () {
    this.tasks.dispose()
    this.viewer.dispose()
    this.mouseObserver.dispose()
  }
}

export default Stage
