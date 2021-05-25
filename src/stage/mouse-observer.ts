/**
 * @file Mouse Observer
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */

import { Vector2 } from 'three'
import { Signal } from 'signals'

import { LeftMouseButton, RightMouseButton } from '../constants'
import { defaults } from '../utils'
import Viewer from '../viewer/viewer'
import MouseControls from '../controls/mouse-controls'

/**
 * @example
 * mouseObserver.signals.scrolled.add( function( delta ){ ... } );
 *
 * @typedef {Object} MouseSignals
 * @property {Signal<Integer, Integer>} moved - on move: deltaX, deltaY
 * @property {Signal<Number>} scrolled - on scroll: delta
 * @property {Signal<Integer, Integer>} dragged - on drag: deltaX, deltaY
 * @property {Signal} dropped - on drop
 * @property {Signal} clicked - on click
 * @property {Signal} hovered - on hover
 */

function getTouchDistance (event: TouchEvent) {
  const dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX
  const dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY
  return Math.sqrt(dx * dx + dy * dy)
}

function getMouseButtons (event: MouseEvent) {
    if (typeof event === 'object') {
    if ('buttons' in event) {
      return event.buttons
    } else if ('which' in event as any) {
      const b = (event as any).which
      if (b === 2) {
        return 4
      } else if (b === 3) {
        return 2
      } else if (b > 0) {
        return 1 << (b - 1)
      }
    } else if ('button' in event as any) {
      const b = (event as any).button
      if (b === 1) {
        return 4
      } else if (b === 2) {
        return 2
      } else if (b >= 0) {
        return 1 << b
      }
    }
  }
  return 0
}

export interface MouseSignals {
  moved: Signal  // on move: deltaX, deltaY
  scrolled: Signal  // on scroll: delta
  dragged: Signal  // on drag: deltaX, deltaY
  dropped: Signal  // on drop
  clicked: Signal  // on click
  hovered: Signal  // on hover
  doubleClicked: Signal
}

export interface MouseParams {
  hoverTimeout?: number
  handleScroll?:boolean
  doubleClickSpeed?: number
}

/**
 * Mouse observer
 *
 * @example
 * // listen to mouse moving (and touch-moving) events
 * mouseObserver.moved.moved.add( function( deltaX, deltaY ){ ... } );
 *
 * @example
 * // listen to scrolling (and pinching) events
 * mouseObserver.signals.scrolled.add( function( delta ){ ... } );
 *
 * @example
 * // listen to dragging (and touch-dragging) events
 * mouseObserver.signals.dragged.add( function( deltaX, deltaY ){ ... } );
 *
 * @example
 * // listen to clicking (and tapping) events
 * mouseObserver.signals.clicked.add( function(){ ... } );
 *
 * @example
 * // listen to double clicking (and double tapping) events
 * mouseObserver.signals.doubleClicked.add( function(){ ... } );
 *
 * @example
 * // listen to hovering events
 * mouseObserver.signals.hovered.add( function(){ ... } );
 */
class MouseObserver {
  signals: MouseSignals = {
    moved: new Signal(),
    scrolled: new Signal(),
    dragged: new Signal(),
    dropped: new Signal(),
    clicked: new Signal(),
    hovered: new Signal(),
    doubleClicked: new Signal()
  }

  hoverTimeout: number
  handleScroll:boolean
  doubleClickSpeed: number

  viewer: Viewer
  mouse: MouseObserver
  controls: MouseControls

  position = new Vector2()  // Position on page
  prevPosition = new Vector2()  // Previous position on page
  down = new Vector2()  // Position on page when clicked
  canvasPosition = new Vector2()  // Position on dom element
  prevClickCP = new Vector2()

  moving = false  // Flag indicating if the mouse is moving
  hovering = true  // Flag indicating if the mouse is hovering
  scrolled = false  // Flag indicating if there was a scolling event since the last mouse move
  lastMoved = Infinity  // Timestamp of last mouse move
  which? = 0  // 0: No button; 1: Left button; 2: Middle button; 3: Right button
  buttons? = 0  // 0: No button; 1: Left button; 2: Right button; 4: Middle button
  pressed? = false  // Flag indicating if the mouse is pressed down
  altKey = false  // Flag indicating if the alt key is pressed
  ctrlKey = false  // Flag indicating if the ctrl key is pressed
  metaKey = false  // Flag indicating if the meta key is pressed
  shiftKey = false  // Flag indicating if the shift key is pressed

  doubleClickPending: boolean
  lastClicked: number
  overElement: boolean
  lastTouchDistance: number
  private frameRequest: number

  /**
   * @param  {Element} domElement - the dom element to observe mouse events in
   * @param  {Object} params - parameters object
   * @param  {Integer} params.hoverTimeout - timeout in ms until the {@link MouseSignals.hovered}
   *                                         signal is fired, set to -1 to ignore hovering
   * @param  {Boolean} params.handleScroll - whether or not to handle scroll events
   * @param  {Integer} params.doubleClickSpeed - max time in ms to trigger double click
   */
  constructor (readonly domElement: HTMLCanvasElement, params: MouseParams = {}) {
    this.domElement.style.touchAction = 'none'

    this.hoverTimeout = defaults(params.hoverTimeout, 50)
    this.handleScroll = defaults(params.handleScroll, true)
    this.doubleClickSpeed = defaults(params.doubleClickSpeed, 500)

    this._listen = this._listen.bind(this)
    this._onMousewheel = this._onMousewheel.bind(this)
    this._onMousemove = this._onMousemove.bind(this)
    this._onMousedown = this._onMousedown.bind(this)
    this._onMouseup = this._onMouseup.bind(this)
    this._onContextmenu = this._onContextmenu.bind(this)
    this._onTouchstart = this._onTouchstart.bind(this)
    this._onTouchend = this._onTouchend.bind(this)
    this._onTouchmove = this._onTouchmove.bind(this)

    this._listen()

    const opt = { passive: false } // treat as 'passive' so preventDefault can be called
    document.addEventListener('mousewheel', this._onMousewheel, opt)
    document.addEventListener('wheel', this._onMousewheel, opt)
    document.addEventListener('MozMousePixelScroll', this._onMousewheel, opt)
    document.addEventListener('mousemove', this._onMousemove, opt)
    document.addEventListener('mousedown', this._onMousedown, opt)
    document.addEventListener('mouseup', this._onMouseup, opt)
    document.addEventListener('contextmenu', this._onContextmenu, opt)
    document.addEventListener('touchstart', this._onTouchstart, opt)
    document.addEventListener('touchend', this._onTouchend, opt)
    document.addEventListener('touchmove', this._onTouchmove, opt)
  }

  get key () {
    let key = 0
    if (this.altKey) key += 1
    if (this.ctrlKey) key += 2
    if (this.metaKey) key += 4
    if (this.shiftKey) key += 8
    return key
  }

  setParameters (params: MouseParams = {}) {
    this.hoverTimeout = defaults(params.hoverTimeout, this.hoverTimeout)
  }

  /**
   * listen to mouse actions
   * @emits {MouseSignals.clicked} when clicked
   * @emits {MouseSignals.hovered} when hovered
   * @return {undefined}
   */
  _listen () {
    const now = window.performance.now()
    const cp = this.canvasPosition
    if (this.doubleClickPending && now - this.lastClicked > this.doubleClickSpeed) {
      this.doubleClickPending = false
    }
    if (now - this.lastMoved > this.hoverTimeout) {
      this.moving = false
    }
    if (this.scrolled || (!this.moving && !this.hovering)) {
      this.scrolled = false
      if (this.hoverTimeout !== -1 && this.overElement) {
        this.hovering = true
        this.signals.hovered.dispatch(cp.x, cp.y)
      }
    }
    this.frameRequest = window.requestAnimationFrame(this._listen)
  }

  /**
   * handle mouse scroll
   * @emits {MouseSignals.scrolled} when scrolled
   * @param  {Event} event - mouse event
   * @return {undefined}
   */
  _onMousewheel(event: WheelEvent & { wheelDelta?: number, wheelDeltaY?: number }) {
    if (event.target !== this.domElement || !this.handleScroll) {
      return
    }
    event.preventDefault()
    this._setKeys(event)

    let delta = 0
    if ('deltaY' in event && 'deltaMode' in event) {
      // all modern browsers, using WheelEvent; deltaY + down (toward user)
      if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL)
        // everything except Firefox: normally 100 per wheel click
        delta = -event.deltaY * (2.5 / 100.0)
      else if (event.deltaMode === WheelEvent.DOM_DELTA_LINE)
        // Firefox in line mode, normally 3 per wheel click
        delta = -event.deltaY * (2.5 / 3.0)
      else                      // page mode: 1 per wheel click
        delta = -event.deltaY * 2.5
    } else if ('deltaY' in event && !('detail' in event))  {
      // Old Firefox or IE 11: deltaY but no deltaMode; treat as pixels
      delta = -event.deltaY * (2.5 / 100.0)
    } else if (event.wheelDelta !== undefined) {
      delta = -event.wheelDelta * (2.5 / 100)
    } else if (event.wheelDeltaY !== undefined) {
      delta = -event.wheelDeltaY * (2.5 / 100)
    } else {
      // Old Firefox, MouseWheelEvent
      delta = -event.detail / 3
    }
    this.signals.scrolled.dispatch(delta)

    setTimeout(() => {
      this.scrolled = true
    }, this.hoverTimeout)
  }

  /**
   * handle mouse move
   * @emits {MouseSignals.moved} when moved
   * @emits {MouseSignals.dragged} when dragged
   * @param  {Event} event - mouse event
   * @return {undefined}
   */
  _onMousemove (event: MouseEvent) {
    if (event.target === this.domElement) {
      event.preventDefault()
      this.overElement = true
    } else {
      this.overElement = false
    }
    this._setKeys(event)
    this.moving = true
    this.hovering = false
    this.lastMoved = window.performance.now()
    this.prevPosition.copy(this.position)
    this.position.set(event.clientX, event.clientY)
    this._setCanvasPosition(event)
    const dx = this.prevPosition.x - this.position.x
    const dy = this.prevPosition.y - this.position.y
    this.signals.moved.dispatch(dx, dy)
    if (this.pressed) {
      this.signals.dragged.dispatch(dx, dy)
    }
  }

  _onMousedown (event: MouseEvent) {
    if (event.target !== this.domElement) {
      return
    }
    event.preventDefault()
    this._setKeys(event)
    this.moving = false
    this.hovering = false
    this.down.set(event.clientX, event.clientY)
    this.position.set(event.clientX, event.clientY)
    this.which = event.which
    this.buttons = getMouseButtons(event)
    this.pressed = true
    this._setCanvasPosition(event)
  }

  /**
   * handle mouse up
   * @emits {MouseSignals.doubleClicked} when double clicked
   * @emits {MouseSignals.dropped} when dropped
   * @param  {Event} event - mouse event
   * @return {undefined}
   */
  _onMouseup (event: MouseEvent) {
    if (event.target === this.domElement) {
      event.preventDefault()
    }
    this._setKeys(event)
    const cp = this.canvasPosition
    if (this._distance() < 4) {
      this.lastClicked = window.performance.now()
      if (this.doubleClickPending && this.prevClickCP.distanceTo(cp) < 4) {
        this.signals.doubleClicked.dispatch(cp.x, cp.y)
        this.doubleClickPending = false
      }
      this.signals.clicked.dispatch(cp.x, cp.y)
      this.doubleClickPending = true
      this.prevClickCP.copy(cp)
    }
    this.which = undefined
    this.buttons = undefined
    this.pressed = undefined
    // if (this._distance() > 3 || event.which === RightMouseButton) {
    //   this.signals.dropped.dispatch();
    // }
  }

  _onContextmenu (event: MouseEvent) {
    if (event.target === this.domElement) {
      event.preventDefault()
    }
  }

  _onTouchstart (event: TouchEvent) {
    if (event.target !== this.domElement) {
      return
    }
    event.preventDefault()
    this.pressed = true
    switch (event.touches.length) {
      case 1: {
        this.moving = false
        this.hovering = false
        this.down.set(
          event.touches[ 0 ].pageX,
          event.touches[ 0 ].pageY
        )
        this.position.set(
          event.touches[ 0 ].pageX,
          event.touches[ 0 ].pageY
        )
        this._setCanvasPosition(event.touches[ 0 ])
        break
      }

      case 2: {
        this.down.set(
          (event.touches[ 0 ].pageX + event.touches[ 1 ].pageX) / 2,
          (event.touches[ 0 ].pageY + event.touches[ 1 ].pageY) / 2
        )
        this.position.set(
          (event.touches[ 0 ].pageX + event.touches[ 1 ].pageX) / 2,
          (event.touches[ 0 ].pageY + event.touches[ 1 ].pageY) / 2
        )
        this.lastTouchDistance = getTouchDistance(event)
      }
    }
  }

  _onTouchend (event: TouchEvent) {
    if (event.target === this.domElement) {
      event.preventDefault()
    }
    this.which = undefined
    this.buttons = undefined
    this.pressed = undefined
  }

  _onTouchmove (event: TouchEvent) {
    if (event.target === this.domElement) {
      event.preventDefault()
      this.overElement = true
    } else {
      this.overElement = false
    }
    switch (event.touches.length) {
      case 1: {
        this._setKeys(event)
        this.which = LeftMouseButton
        this.buttons = 1
        this.moving = true
        this.hovering = false
        this.lastMoved = window.performance.now()
        this.prevPosition.copy(this.position)
        this.position.set(
          event.touches[ 0 ].pageX,
          event.touches[ 0 ].pageY
        )
        this._setCanvasPosition(event.touches[ 0 ])
        const dx = this.prevPosition.x - this.position.x
        const dy = this.prevPosition.y - this.position.y
        this.signals.moved.dispatch(dx, dy)
        if (this.pressed) {
          this.signals.dragged.dispatch(dx, dy)
        }
        break
      }

      case 2: {
        const touchDistance = getTouchDistance(event)
        const delta = touchDistance - this.lastTouchDistance
        this.lastTouchDistance = touchDistance
        this.prevPosition.copy(this.position)
        this.position.set(
          (event.touches[ 0 ].pageX + event.touches[ 1 ].pageX) / 2,
          (event.touches[ 0 ].pageY + event.touches[ 1 ].pageY) / 2
        )
        if (Math.abs(delta) > 2 && this.handleScroll &&
            this.position.distanceTo(this.prevPosition) < 2
        ) {
          this.which = 0
          this.buttons = 0
          this.signals.scrolled.dispatch(delta / 2)
        } else {
          this.which = RightMouseButton
          this.buttons = 2
          const dx = this.prevPosition.x - this.position.x
          const dy = this.prevPosition.y - this.position.y
          this.signals.moved.dispatch(dx, dy)
          if (this.pressed) {
            this.signals.dragged.dispatch(dx, dy)
          }
        }
      }
    }
  }

  _distance () {
    return this.position.distanceTo(this.down)
  }

  _setCanvasPosition (event: any) {  // TODO
    const box = this.domElement.getBoundingClientRect()
    let offsetX, offsetY
    if ('offsetX' in event && 'offsetY' in event) {
      offsetX = event.offsetX
      offsetY = event.offsetY
    } else {
      offsetX = event.clientX - box.left
      offsetY = event.clientY - box.top
    }
    this.canvasPosition.set(offsetX, box.height - offsetY)
  }

  _setKeys (event: MouseEvent|TouchEvent) {
    this.altKey = event.altKey
    this.ctrlKey = event.ctrlKey
    this.metaKey = event.metaKey
    this.shiftKey = event.shiftKey
  }

  dispose () {
    document.removeEventListener('mousewheel', this._onMousewheel)
    document.removeEventListener('wheel', this._onMousewheel)
    document.removeEventListener('MozMousePixelScroll', this._onMousewheel)
    document.removeEventListener('mousemove', this._onMousemove)
    document.removeEventListener('mousedown', this._onMousedown)
    document.removeEventListener('mouseup', this._onMouseup)
    document.removeEventListener('contextmenu', this._onContextmenu)
    document.removeEventListener('touchstart', this._onTouchstart)
    document.removeEventListener('touchend', this._onTouchend)
    document.removeEventListener('touchmove', this._onTouchmove)
    window.cancelAnimationFrame(this.frameRequest)
  }
}

export default MouseObserver
