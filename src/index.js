(function() {  // beginning of IIFE

/*  These are expected in the environment:
import React from 'react';
import PropTypes from 'prop-types';
import Force from 'd3-force';
import './styles.css';
*/


/**
 * Diversus Flower
 * ---------------
 *
 * This is an implementation of the graph visualization touring experience depicted here:
 *    https://vimeo.com/251879145
 *
 * Concepts:
 *    petal -- a circle (even theRoot) positioned in a radiating flower-like arrangement
 *    relPos -- is a number between 0 and 1 representing a position around the circle
 *    frond -- one of the 'bins' around the circle with a sequence of ever-smaller petals
 *    root -- the central petal
 *    focused -- the petal (default theRoot) which is currently enlarged and roughly centered
 *
 * Dependencies
 *    React -- Petal, DiversusFlower
 *    MainLoop -- assists with timing of animation
 *
 * Animation Classes
 *    AnimationTransformers -- the root of a tree of processors to update and draw animation operations
 */
rce = React.createElement;

function fix(stringOrNumber, places) {
  places = (places != null) ? places : 2;
  let num = (typeof stringOrNumber == 'number') ? stringOrNumber : Number.parseFloat(stringOrNumber)
  return Number.parseFloat(num.toFixed(places));
}
function petalRelPosToFrondLoc(relPos, numberOfFronds) {
  let idx = getBinIdx(relPos, numberOfFronds);
  return [idx, getBinMid(idx, numberOfFronds)];
}
function getBinIdx(relPos, numberOfFronds) {
  return ( numberOfFronds * (Math.floor((relPos * numberOfFronds))/numberOfFronds));
}
function getBinMid(idx, numberOfFronds) {
  return ((1 + idx)/numberOfFronds) - (1/(2*numberOfFronds));
}
function getAngle(relPos) {
  return (2 * Math.PI) * relPos - Math.PI/2;
}
function getContactPointOfCircleAtAngle(x, y, r, a) {
  return {x: x + r * Math.cos(a),
          y: y + r * Math.sin(a)};
}
function petalRelPosToFrondAngle(relPos, numberOfFronds) {
  let [idx, frondRelPos] = petalRelPosToFrondLoc(relPos, numberOfFronds);
  return getAngle(frondRelPos);
}
function getRandomColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
function getRandomId(prefix) {
  let max = 10000000000;
  prefix = prefix || 'id';
  return prefix + Math.floor(Math.random() * Math.floor(max));
}
function distance(x, y) {
  return Math.sqrt(x*x + y*y);
}
function calcRadiusOfPackedCircles(centralRadius, numPacked) {
  /*
    r = (R * sin(theta/2) /(1 - sin(theta/2))
  */
  let theta = (Math.PI*2)/numPacked,
      st2 = Math.sin(theta/2),
      R = centralRadius,
      r = ((R * st2) / (1 - st2));
  return r;
}
function samePoint(p1, p2) {
  return (p1.cx == p2.cx && p1.cy == p2.cy);
}
let deadCenter = {cx: 0, cy: 0};

class Reticle extends React.Component {
  renderLines() {
    var x,y,
        rays = this.props.rays,
        rayLength = this.props.rayLength,
        lines = [],
        i = 0,
        twoPI = Math.PI * 2,
        inc = twoPI/rays;
    while (i < twoPI) {
      x = Math.cos(i) * rayLength;
      y = Math.sin(i) * rayLength;

      lines.push(rce('line',{x2:x, y2:y, key:'ray'+i}))
      i = i + inc;
    }
    lines.push(rce('line',{x1:-100, y1:-100, x2:100, y2:100, key:'tlbr'}));
    lines.push(rce('line',{x1:100, y1:-100, x2:-100, y2:100, key:'trbl'}));
    return lines;
  }
  render() {
    return rce('g',
               {stroke:this.props.color, x1:this.props.cx, y1:this.props.cy,
                className: 'flower_reticle', strokeWidth:1},
               this.renderLines());
  }
}

Reticle.propTypes = {
  color: PropTypes.string.isRequired,
  cx: PropTypes.number.isRequired,
  cy: PropTypes.number.isRequired,
  rays: PropTypes.number.isRequired,
  rayLength: PropTypes.number.isRequired
}

Reticle.defaultProps = {
  cx: 0,
  cy: 0,
  color: 'lightgrey',
  rays: 24,
  rayLength: 250
}

class Petal extends React.Component {
  constructor(props) {
    super(props);
    var flower = this.getFlower();
    if (!flower) {
      throw new Error('no flower for ',this.props.relPos)
    }
    flower.registerPetal(this);
    // state:
    //   petalRadius: 12 // the radius (in pixels) of the petal
    //   angle: 0 // the angle of the center of this petal to its parent's center
    //   cx: 0.0  // the x coordinate of the center of this petal
    //   cy: 0.0  // the y coordinate of the center of this petal
  }
  log(...theArgs) {
    this.getFlower().log.call(theArgs, console);
  }
  warn(...theArgs) {
    this.getFlower().warn.call(theArgs, console);
  }
  componentWillUnmount() {
    this.log("componentWillUnmount()");
    this.getFlower().unregisterPetal(this);
  }
  getFlower() {
    return this.props.flower;
  }
  getKey() {
    return this.props.myKey;
  }
  isRoot() {
    // TODO make 'root-ness' a more semantic factor.  What happens when petals become root?
    //return !this.props.relPos;
    return !!this.state.isRoot; // force a boolean response
  }
  isFocused() {
    let flower = this.getFlower();
    return flower.getFocusedPetal() === this;
  }
  getScaleFactorNatural() {
    return this.state.naturalR / this.state.r ;
    //return this.getFlower().getFocusedRadius(); / this.state.r;
  }
  getScaleFactorFocused() {
    // by what factor should this be scaled to become the focused petal?
    // It is currently this.state.radius
    return 3 * this.getFlower().getFocusedRadius() / this.state.r;
  }
  getBiggerSibling() {
    let frond = this.getFrond();
    if (this.state.orderIdx > 1 ) {
      var retval = this.getFlower().getPetalByKey(frond.petals[this.state.orderIdx - 2].myKey);
      if (retval.state.orderIdx != this.state.orderIdx - 1) {
        debugger
      }
      return retval;
    }
  }
  getSmallerSibling() {
    let frond = this.getFrond();
    if (this.state.orderIdx < frond.petals.length) {
      var retval = this.getFlower().getPetalByKey(frond.petals[this.state.orderIdx].myKey);
      if (retval.state.orderIdx != this.state.orderIdx + 1) {
        debugger
      }
      return retval;
    }
  }
  onClick(evt) {
    evt.stopPropagation()
    evt.preventDefault()
    this.callExternalClickHandlers(evt);
    if (this.isFocused()) {
      this.log("this node is already the focus, ignoring click");
      // TODO deal with click vs double click
      // This is already the focused petal so there is no need for a transformation, so bail.
      return;
    }
    this.log('calling focusOnPetal() from onClick()' + (this.isRoot() ? ' for root' : ''));
    this.props.flower.focusOnPetal(this, evt.target);
  }
  callExternalClickHandlers(evt) {
    if (this.isRoot()) {
      this.props.flower.callOnRootClick(evt, this);
    } else {
      this.props.flower.callOnPetalClick(evt, this);
    }
  }
  getCenter(factor) {
    factor = (factor) && factor || 1;
    return {cx: this.state.cx * factor, cy: this.state.cy * factor};
  }
  /**
   * If the petal is being animated return its instantaneous center.  Note that this.state.cx and .cy are only statically true.
   *
   * There is a need for an instantaneousCenter whose updating by AnimationTransformers does not affect this.state because
   * React .render() is too asynchronous to be reliable for animations.
   */
  getInstantaneousXYR() {
    if (this.instantaneousXYR) {
      return Object.assign({}, this.instantaneousXYR);
    } else {
      return {cx: this.state.cx, cy: this.state.cy, r: this.state.r};
    }
  }
  getContactPointAtAngle(angle) {
    let cntr = this.getInstantaneousXYR();
    return getContactPointOfCircleAtAngle(cntr.cx, cntr.cy, cntr.r, angle);
  }
  getTheGoods() {
    let flower = this.getFlower();
    // FIXME Is there a better way to get the frondIdx?  Put it on the Petal.props?
    let frondIdx = getBinIdx(this.props.relPos, flower.props.numberOfFronds);
    let frond = flower.state.fronds[frondIdx];
    return {
      frondIdx: frondIdx,
      frond: frond,
      args: frond.petals[this.props.orderIdx]
    }
  }
  getFrond() {
    return this.props.flower.state.fronds[this.state.idxOfFrond];
  }
  componentWillMount() {
    // https://developmentarc.gitbooks.io/react-indepth/content/life_cycle/birth/premounting_with_componentwillmount.html
    let flower = this.getFlower();
    let orderIdx = this.props.orderIdx || 0;
    let centralRadius = flower.state.centralRadius;  // the radius of the central circle
    let adjusted = {} ;
    let petalRadius = flower.state.radii[orderIdx];
    adjusted.r = petalRadius;
    adjusted.naturalR = adjusted.r;
    if (this.props.relPos) {
      let angle = getAngle(this.props.relPos);
      let distFromFlowerCenter = flower.state.dists[orderIdx];
      adjusted.cx = (Math.cos(angle) * (distFromFlowerCenter));
      adjusted.cy = (Math.sin(angle) * (distFromFlowerCenter));
    } else {
      adjusted.cx = 0;
      adjusted.cy = 0;
    }
    let [idxOfFrond, relPosOfFrond] = petalRelPosToFrondLoc(this.props.relPos, flower.props.numberOfFronds);
    adjusted.naturalCenter = {cx: adjusted.cx, cy: adjusted.cy};
    adjusted.idxOfFrond = idxOfFrond;
    adjusted.orderIdx = orderIdx  // TODO rename to idxInFrond
    adjusted.isRoot = !!this.props.isRoot;
    adjusted.fill = this.props.fill;
    this.setState(adjusted);
  }
  componentDidMount() {
    //var flower = this.getFlower();
    //if (this.state.isRoot) {
    //flower.
  }
  render() {
    let {orderIdx} = this.props;
    let flower = this.getFlower();
    const petalOpacity = flower.props.petalOpacity;
    let {cx, cy, centralRadius, fill, myKey, r} = this.state;
    const petalRadius = flower.state.radii[orderIdx];
    r = (r === undefined) ? petalRadius : r;
    let circleArgs = {cx:cx, cy:cy,
                      r:r,
                      id:myKey,
                      stroke:"black", opacity:petalOpacity, fill:fill};
    this.log('Petal.render()',r,cx,cy);
    if (this.props.title) {
      circleArgs.title = this.props.title;
    }
    circleArgs.onClick = this.onClick.bind(this);
    return rce('circle', circleArgs);

  }
}

Petal.propTypes = {
  fill: PropTypes.string.isRequired,
  initialPriority: PropTypes.number.isRequired,
  initialRadius: PropTypes.number,
  //  key: PropTypes.string.isRequired,
  orderIdx: PropTypes.number,
  relPos: PropTypes.number
};

Petal.defaultProps = {
  fill: 'orange',
  initialPriority: 1.0
  //, initialRadius: 20
};

class Heir extends React.Component {
  // <SomeHeirSubclass whosYourDaddy={this.whoDad.bind(this) />
  constructor(props) {
    super(props);
    if (props.whosYourDaddy) {
      this.daddy = props.whosYourDaddy(this)
    }
  }
}

/**
 * Controller for one aspect of a set of simultaneous animated transformations.
 */
class AnimationTransformer {
  constructor(flower, kwargs, ...ignore) {
    this.flower = flower;
    this.kwargs = kwargs;
    this.durationSec = this.kwargs.duration || this.flower.props.durationOfAnimation;
    this.flowerElem = ReactDOM.findDOMNode(flower);
  }
  update(deltaMsec) {
    console.error(this.constructor.name, "needs update() implemented");
    return true;
  }
  /*
   * Return attrs used to directly alter elem attrs without involving React.setState and React.render
   */
  draw(interProp) {
    console.error(this.constructor.name, "needs draw() implemented");
    return true;
  }
  toString() {
    return this.constructor.name;
  }
  setState(stateChanges) {
    this.targetComponent.setState(stateChanges);
  }
  /**
   * Perform a final draw operation with no interpolation so it terminates precisely.
   */
  finalize() {
    let final = this.getFinalState();
    this.setState(final);
    return final;
  }
  /**
   * Perform a simple rendering of attributes into a DOM element.
   */
  triggerRender(attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      this.targetElem.setAttribute(k,v);
    }
    this.renderCount = (this.renderCount) ? this.renderCount + 1 : 1;
  }
}
/**
 * Methods common to AnimationTransformers which affect the SVG as a whole.
 */
class FlowerTransformer extends AnimationTransformer {
  constructor(flower, kwargs, ...ignore) {
    super(flower, kwargs);
    this.targetComponent = this.flower;
    this.targetElem = this.flowerElem;
  }
  render(attrs) {
    super.render(attrs, this.flowerElem);
  }
}
/**
 * Transform the flower from its current scale to a target scale.
 */
class FlowerResize extends FlowerTransformer {
  constructor(flower, kwargs) {
    super(flower, kwargs);
    this.finalScale = this.kwargs.finalScale;  // comparison with initialScale establishes the range
    this.scale = this.kwargs.scale; // 'current' scale to be interpolated with lastScale
    this.initialScale = this.scale;  // the starting scale to be compared with finalScale
    this.lastScale = this.scale; // the last amount drawn
    this.scaleTravel = this.finalScale - this.initialScale;
    this.scaleTravelPerMsec = this.scaleTravel / this.durationSec / 1000;
  }
  update(deltaMsec) {
    this.lastScale = this.scale;
    this.scale += this.scaleTravelPerMsec * deltaMsec;
  }
  draw(interProp){
    let scale = this.lastScale + (this.scale - this.lastScale) * interProp;
    let attrs = {scaleX: scale, scaleY: scale};
    this.triggerRender(attrs);
    this.transform = "scale (" + attrs.scaleX + " " + attrs.scaleY + ")";
    return attrs;
  }
  getFinalState() {
    return {scaleX: this.finalScale, scaleY: this.finalScale};
  }
}
/**
 * Transform the center of the flower from its current position to a target position.
 */
class FlowerMove extends FlowerTransformer {
  constructor(flower, kwargs) {
    super(flower, kwargs);
    let flSt = this.flower.state;
    this.center = {cx: flSt.translateX, cy: flSt.translateY};
    this.initialCenter = Object.assign({}, this.center);  // compared with finalCent
    this.lastCenter = Object.assign({}, this.center); // the last value drawn
    this.finalCenter = Object.assign({}, this.kwargs); // the last value drawn
    this.travel = {dx: this.finalCenter.cx - this.initialCenter.cx,
                   dy: this.finalCenter.cy - this.initialCenter.cy};
    this.travelPerMsec = {vx: this.travel.dx / this.durationSec / 1000,
                          vy: this.travel.dy / this.durationSec / 1000};
  }
  update(deltaMsec) {
    this.lastCenter = Object.assign({}, this.center);
    this.center = {cx: this.center.cx + this.travelPerMsec.vx * deltaMsec,
                   cy: this.center.cy + this.travelPerMsec.vy * deltaMsec};
  }
  draw(interProp) {
    let attrs;
    attrs = {translateX: this.lastCenter.cx + (this.center.cx - this.lastCenter.cx) * interProp,
             translateY: this.lastCenter.cy + (this.center.cy - this.lastCenter.cy) * interProp};
    this.transform = "translate("+ attrs.translateX + " " + attrs.translateY + ")";
    this.triggerRender(attrs);
    return attrs;
  }
  getFinalState() {
    return Object.assign({}, this.finalCenter);
  }
}

/**
 * Handle shrinking or growing a petal depending on the kwargs.scaleFactor
 */
class PetalTransformer extends AnimationTransformer {
  constructor(flower, kwargs, petal, ...ignore) {
    super(flower, kwargs);
    this.petal = petal;
    let {r, cx, cy} = this.petal.state;
    this.initialRadius = r;
    this.radius = this.initialRadius;
    this.finalRadius = this.initialRadius * kwargs.scaleFactor;
    this.lastRadius  = this.initialRadius;
    this.radiusTravel = this.finalRadius - this.initialRadius;
    this.radiusTravelPerMsec = this.radiusTravel / this.durationSec / 1000;
    this.contactPetal = this.getContactPetal();

    let natCent = petal.state.naturalCenter;
    this.initialCenter = {cx: cx, cy: cy};
    this.center = Object.assign({}, this.initialCenter);

    let angle = this.petal.getFrond().angle;
    let finalDistanceFromFlowerCenter = distance(natCent.cx, natCent.cy) + this.radiusTravel;
    this.warn(this.toString(),'.finalCenter is BS');
    if (kwargs.finalCenter) {
      this.finalCenter = Object.assign({}, kwargs.finalCenter);
    } else {
      this.finalCenter = {
        cx: (Math.cos(angle) * finalDistanceFromFlowerCenter),
        cy: (Math.sin(angle) * finalDistanceFromFlowerCenter)};
    }
    this.lastCenter = Object.assign({}, this.initialCenter);
    this.centerTravel = {dx: this.finalCenter.cx - this.initialCenter.cx,
                         dy: this.finalCenter.cy - this.initialCenter.cy};
    this.centerTravelPerMsec = {vx: this.centerTravel.dx / this.durationSec / 1000,
                                vy: this.centerTravel.dy / this.durationSec / 1000};
    this.log(this);
    this.petalElem = ReactDOM.findDOMNode(petal);
    this.targetComponent = this.petal;
    this.targetElem = this.petalElem;
  }
  log(...theArgs) {
    if (!this.flower.squelch) {
      this.flower.log(theArgs);
    }
  }
  warn(...theArgs) {
    if (!this.flower.squelch) {
      this.flower.warn(theArgs);
    }
  }
  update(deltaMsec) {
    this.lastRadius = this.radius;
    this.radius += this.radiusTravelPerMsec * deltaMsec;
    this.center.cx += this.centerTravelPerMsec.vx * deltaMsec;
    this.center.cy += this.centerTravelPerMsec.vy * deltaMsec;
  }
  getContactPetal() {
    let idx = this.petal.props.orderIdx;
    if (idx == 1) {
      return this.flower.getRootPetal();
    } else {
      return this.petal.getBiggerSibling();
    }
  }
  getContactPoint() {
    return this.contactPetal.getContactPointAtAngle(this.petal.getFrond().angle);
  }
  draw(interProp) {
    let radius = this.lastRadius + (this.radius - this.lastRadius) * interProp;
    let contact = this.getContactPoint();
    let cntr = getContactPointOfCircleAtAngle(contact.x, contact.y, radius, this.petal.getFrond().angle);
    let delta = {
      r: radius,
      cx: cntr.x,
      cy: cntr.y}
    this.petal.instantaneousXYR = Object.assign({}, delta);
    this.triggerRender(delta);
    return delta;
  }
  render(attrs) {
    super.render(attrs, this.petalElem);
  }
  getFinalState() {
    return {r: this.finalRadius, cx: this.finalCenter.cx, cy: this.finalCenter.cy};
  }
  finalize() {
    let retval = super.finalize();
    this.flower.warn('possibly too early deletion of instantaneousXYR');
    delete this.petal.instantaneousXYR; // we are about to trigger setState so no need for the instantaneousXYR anymore
    // REVIEW possible race condition when a whole frond is being shifted about
    return retval;
  }
}
/**
 * Slides petals around which need to move but not resize because of changes to bigger siblings.
*/
class PetalSlide extends PetalTransformer {
  constructor(flower, kwargs, slidePetal) {
    super(flower, {scaleFactor: 1}, slidePetal)
  }
}
/**
 * Shrinks a Petal.
 */
class PetalShrink extends PetalTransformer {
  constructor(flower, kwargs, shrinkPetal) {
    // TODO get scaleFactor from outside   
    super(flower, {scaleFactor: shrinkPetal.getScaleFactorNatural(),
                   finalCenter: shrinkPetal.state.naturalCenter}, shrinkPetal);
  }
}
/**
 * Grows a Petal.
 */
class PetalGrow extends PetalTransformer {
  constructor(flower, kwargs, growPetal) {
    // TODO get scaleFactor from outside   
    super(flower, {scaleFactor: growPetal.getScaleFactorFocused()}, growPetal);
  }
}


class DiversusFlower extends Heir {
  constructor(props) {
    super(props);
    this.state = {
      centralRadius: 50,
      centralPetal: null,
      fronds: [],
      showThumbnails: this.props.showThumbnails
    };
    this.log = this.props.log;
    this.warn = this.props.warn;
    this.squelch = this.props.squelch;
    this.petalCount = 0;
    this.petalByKey = {};
    this.initAnimation();
    this.patterns = {};
  }
  log(...theArgs) {
    console.log("squelch", this.squelch);
    if (!this.squelch) {
      this.state.log.call(console, theArgs);
    }
  }
  warn(...theArgs) {
    if (!this.squelch) {
      this.state.warn.call(console, theArgs);
    }
  }
  toggleSquelch() {
    this.squelch = !this.squelch;
  }
  getPetalRadius(petal) {
    return petal.petalRadius;
  }
  whoDad(aFrond) { // Fronds call this to know their Flower
    // Register Frond (aFrond) on their DiversusFlower (this) here, if needed
    return this;
  }
  toggleRandomStream() {
    this.log('toggleRandomStream()');
    if (this.randomStreamTimer) {
      this.log("TOGGLE randomStream off")
      this.stopRandomStream();
    } else {
      this.log("TOGGLE randomStream on")
      this.startRandomStream();
    }
  }
  startRandomStream(interval) {
    interval = interval || this.props.randomStreamInterval;
    this.log('startRandomStream');
    let dis = this;
    if (!this.getRootKey()) {  // if no root petal then add one
      this.setRootPetal({fillColor:'red'})
    }
    this.randomStreamTimer = setInterval( function(){dis.addRandomPetal()}, interval)
    //this.addRandomPetal(); // run one now!
  }
  stopRandomStream(){
    if (this.randomStreamTimer) {
      this.log('stopRandomStream');
      clearInterval(this.randomStreamTimer);
      delete this.randomStreamTimer;
    } else {
      this.log('no randomStreamTimer found');
    }
  }
  addRandomPetal() {
    this.randomPetalCount = this.randomPetalCount || 0;
    this.randomPetalCount++;
    let key = getRandomId('p');  // unique!
    let args = {
      relPos: Math.random(),  // not unique
      key: key,
      myKey: key,
      sortKey: Math.random(), // not unique
      url: getRandomId("http://example.org/"),
      thumbUrl: this.props.defaultThumbUrl,
      fillColor: getRandomColor()
    };
    args.title = args.url;
    //this.log("args",args);
    this.addPetal(args);
    if (this.randomPetalCount > this.props.maxRandomPetalCount) {
      this.stopRandomStream();
    }
  }
  startRandomClicking() {
    interval = interval || this.props.demoClickingAfterMsec;
    let dis = this;
    this.randomClickingTimer = setInterval( function(){dis.clickRandomPetal()}, interval);
  }
  clickRandomPetal() {
    // FIXME to be implemented                                                 
  }
  calcFrondRadius() {
    return calcRadiusOfPackedCircles(this.state.centralRadius,
                                     this.props.numberOfFronds);
  }
  getOrCreateFrondForPetalRelPos(petalRelPos) {
    let idx = getBinIdx(petalRelPos, this.props.numberOfFronds);
    let frondRelPos = getBinMid(idx, this.props.numberOfFronds);
    let frond = this.state.fronds[idx];
    if (!frond) {
      frond = {
        key: idx,
        relPos: frondRelPos,
        angle: getAngle(frondRelPos),
        frondColor: getRandomColor(),
        petals: [],
        radius: this.state.frondRadius
      };
    }
    return frond ; //this.state.fronds[idx] || {key: idx, relPos: frondRelPos, petals: []};
  }
  addPatternForPetal(petalArgs) {
    this.patterns[petalArgs.myKey] = petalArgs.thumbUrl;
  }
  registerPatternToPetal(args) {
    if (this.state.showThumbnails && args.thumbUrl) {
      this.addPatternForPetal(args);
      this.putImageInPetal(args);
    }
  }
  putImageInPetal(args) {
    /*
     *  Placing an image in a SVG circle.
     *
     *  How to make the pattern
     *    https://stackoverflow.com/a/22886596/1234699
     *  Using the pattern
     *    https://stackoverflow.com/a/40390881/1234699
     *
     */
    if (args.thumbUrl) {
      args.fill = `url(#${args.myKey}_pattern)`;
    }
  }
  addPetal(args) {
    let idx = getBinIdx(args.relPos, this.props.numberOfFronds);
    let frondRelPos = getBinMid(idx, this.props.numberOfFronds);
    let aFrond = this.getOrCreateFrondForPetalRelPos(args.relPos);
    if (this.props.fixedColorFronds) {
      args.fillColor = aFrond.frondColor;
    }
    if (!args.myKey) {
      args.myKey = args.key;
    }
    this.registerPatternToPetal(args);
    aFrond.petals.push(args);
    this.state.fronds[idx] = aFrond;
    this.setState({fronds: this.state.fronds});
    this.petalCount++;
  }
  renderPatterns() {
    var retval = [];
    var count = 0;
    for (var myKey in this.patterns) {
      var thumbUrl = this.patterns[myKey];
      count++;
      retval.push(
        rce('pattern', {
          id: myKey+"_pattern", // reference pattern as: fill="url(#MYKEY_pattern)" when myKey == "MYKEY"
          height: "100%",
          width: "100%",
          patternContentUnits: "objectBoundingBox",
          viewBox: "0 0 1 1",
          preserveAspectRatio: "xMidYMid slice",
        },[
          rce('image', {
            height:"1",
            width:"1",
            preserveAspectRatio: "xMidYMid slice",
            href: thumbUrl
          })]
           )
      );
    }
    if (count) {
      return rce('defs',{key: 'theDefs'},retval);
    }
    return retval;
  }
  renderFronds() {
    let retval = [];
    for (let frondIdx = 0; frondIdx < this.state.fronds.length; frondIdx++) {
      let aFrond = this.state.fronds[frondIdx];
      if (!aFrond) {
        continue;
      }
      for (let petalIdx = 0; petalIdx < aFrond.petals.length; petalIdx++) {
        let {key, myKey, relPos, fill, fillColor} = aFrond.petals[petalIdx];
        if (relPos > 1 || relPos < 0) {
          var msg = `Petal has illegal relPos: (${relPos}) and myKey: (${myKey})`;
          console.warn(msg);
        }
        if (typeof key == 'undefined') throw new Error('no key');
        retval.push(
          rce(Petal,
              {relPos: aFrond.relPos, key: key, myKey: myKey,
               orderIdx: petalIdx+1, fill: fill || fillColor,
               flower: this}));

      }
    }
    return retval;
  }
  renderRootPetal() {
    var retval = [];
    if (this.state.rootArgs) {
      var props = {flower: this};
      for (var [k, v] of Object.entries(this.state.rootArgs)) {
        props[k] = v;
      }
      retval.push(rce(Petal, props));
    }
    return retval;
  }
  // https://nvbn.github.io/2017/03/14/react-generators/
  calcFrondRadius(centralRadius) {  // receiving centralRadius as param is an ugly hack
    return calcRadiusOfPackedCircles(centralRadius || this.state.centralRadius,
                                     this.props.numberOfFronds);
  }
  focusOnPetal(clickedPetal, clickedCircle) {
    this.initAnimationState(clickedPetal, this.getFocusedPetal());
    this.startAnimation();
    // REVIEW When should the clickedPetal become the focusedPetal?
    //   Either immediately (as implemented here) or after the animation is done.
    //   Immediately is perhaps best because then more clicks can happen on petals
    //   while the animation is happening and then those can make sense too.
    this.setFocusedPetal(clickedPetal);
  }
  /**
   * Initializes the list of transformations which govern the evolving state of the animation.
   *
   * The following notation is used below:
   *   * (F)ocused  -- the previously focused petal might be in a frond or it might be the root
   *   * (C)licked  -- the petal which was clicked to trigger this animation
   *   * (R)oot     -- the root petal
   *
   *  So the following situations can occur.
   *
   *        |      F==R       |      F!=R         Was the Focused petal the Root or not?
   *   -----+-----------------+-----------------
   *   C==F | C==F so NOOP    | C==F so NOOP      If C==F no animation needed.
   *   -----+-----------------+-----------------
   *   C!=R | shrink:R,grow:C |                   Root is Focus and petal clicked? Shrink the Root.
   *        |                 | shrink:F,grow:C   PetalA is Focus and PetalB clicked? Root ignored.
   *        |                 |                   (Actually, if B is further out than A, Root shrinks.
   *   -----+-----------------+-----------------
   *   C==R | C==F so NOOP    | shrink:F,grow:R   Petal is Focus and Root clicked? Grow the Root
   *   -----+-----------------+-----------------
   *
   *  Notice that the Clicked node will always grow and the Focused will always shrink.
   *  Sometimes the Root is either Clicked or the old Focus.  Sometimes it is neither.
   */
  initAnimationState(growMe, shrinkMe) {
    // TODO
    var growMeOnSameFrond, shrinkMeOnSameFrond;
    var tranx = this.animationState.tranx;
    if (growMe.isRoot()) { // C==R,F!=R  (we know F!=R because if F==R then C==F which aborts above)
      // The root is growing, so in lieu of growing the root Petal, grow the whole graph.
      tranx.push(new FlowerResize(this, {scale: this.state.scaleX, finalScale:1}));
      tranx.push(new FlowerMove(this, Object.assign({}, deadCenter)));
      // so shrinkMe can NOT be the root therefore
      //tranx.push(new PetalShrink(this, {}, shrinkMe));
      this.addAnimTransFor(shrinkMe, PetalShrink);
    } else { // C!=R
      var factor = .8;
      if (shrinkMe.isRoot()) { // C!=R,F==R -- shrink the root and grow the clicked petal
        // TODO in truth the further out the petal, the smaller the flower
        tranx.push(new FlowerResize(this, {scale: this.state.scaleX, finalScale:.5}));
        tranx.push(new FlowerMove(this, growMe.getCenter(factor)));
        this.addAnimTransFor(growMe, PetalGrow);
        //tranx.push(new PetalGrow(this, {governChildren: true}, growMe));
      } else { // C!=R,F!=R -- shrink the Focused and grow the Clicked
        tranx.push(new FlowerMove(this, growMe.getCenter(-1 * factor)));
        if (shrinkMe.getTheGoods().frond.idx == growMe.getTheGoods().frond.idx) {
          this.log('same frond');
          growMeOnSameFrond = growMe;
          shrinkMeOnSameFrond = shrinkMe;
        }
        this.addAnimTransFor(shrinkMe, PetalShrink, growMeOnSameFrond);
        this.addAnimTransFor(growMe, PetalGrow, shrinkMeOnSameFrond);
      }
    }
  }
  addAnimTransFor(mainPetal, PetalGrowOrShrink, otherPetalOnFrond) {
    var scaleAdjacents = false;
    var slideLittleSibs = true;
    var lilSib, bigSib;
    // We add AnimationTransformers to tranx from the inside toward the outside of the flower
    // FIXME there is some sort of problem when main and otherPetalOnFrond
    var tranx = this.animationState.tranx;
    if (bigSib = mainPetal.getBiggerSibling()) {
      if (scaleAdjacents && otherPetalOnFrond != bigSib) {
        tranx.push(new PetalGrowOrShrink(this, {}, bigSib));
      }
    }
    tranx.push(new PetalGrowOrShrink(this, {}, mainPetal));
    if (lilSib = mainPetal.getSmallerSibling()) {
      if (scaleAdjacents && otherPetalOnFrond != lilSib) {
        tranx.push(new PetalGrowOrShrink(this, {}, lilSib));
      } else {
        if (slideLittleSibs) {
          tranx.push(new PetalSlide(this, {}, lilSib));
        }
      }
    }
    if (slideLittleSibs && lilSib) {
      var littlerSib = lilSib;
      while (littlerSib = littlerSib.getSmallerSibling()) {
        tranx.push(new PetalSlide(this, {}, littlerSib))
      }
    }
    return;
    if (bigSib) {
      alert(`mainPetal.orderIdx: ${mainPetal.state.orderIdx} has bigSib.borderIdx: ${bigSib.state.orderIdx}`)
    }
    if (lilSib) {
      alert(`mainPetal.orderIdx: ${mainPetal.state.orderIdx} has lilSib.borderIdx: ${lilSib.state.orderIdx}`)
    }
  }

  /* BEGINING OF THE ANIMATION

    The animation of transitions is implemented with the help of this animation main loop:
      https://github.com/IceCreamYou/MainLoop.js

    The flower does not need the loop to be running all the time, just during transitions
    from one configuration to another.

      initAnimation() -- called once to set up MainLoop to control the animation
      startAnimation() -- this starts the mainloop running
      stopAnimation() -- yup, stops it
   */
  //
  initAnimation() {
    if (MainLoop) {
      this.initializeAnimationState();
      MainLoop.
        setUpdate(this.updateAnimationTransformers.bind(this)).
        setDraw(this.drawAnimationTransformers.bind(this)).
        setBegin(this.beginOfLoop.bind(this)).
        setEnd(this.endOfLoop.bind(this));
    } else {
      this.log('MainLoop unavailable');
    }
  }
  initializeAnimationState() {
      this.animationState = {
        tranx: [],  // the transformations in precedence order (an Array not a Set so order can be changed)
        rmTranx1: new Set() // completed transitions are queued here for removal at endOfLoop()
      };
  }
  /*
    Calculate initial and the final values of things being animated for inbetweening by update.
   */
  startAnimation() {
    if (MainLoop) {
      /*
       * There are three possible situations
       *    1) the flower is in the default position (and a petal has been clicked)
       *       * the petal needs to grow from small to large
       *    2) a petal is already being peeked at (and the root petal has been clicked)
       *       * the petal needs to shrink from large to small
       *    3) a petal is already being peeked at (and a 2nd petal has been clicked)
       *       * the first petal needs to shrink from large to small
       *       * the second petal needs to grow from small to large
       */
      this.animationState.startTime = Date.now();
      this.animationState.durationMsec = this.props.durationOfAnimation * 1000;
      this.log('MainLoop.start()')
      MainLoop.start();
    }
  }
  stopAnimation() {
    this.log('stopAnimation()');
    if (MainLoop) {
      this.purgeTranx();
      MainLoop.stop();
    }
  }
  purgeTranx(){
    this.log('purgeTranx()', this.animationState.tranx.size)
    this.animationState.tranx.forEach((animTran) => {
      this.animationState.rmTranx1.add(animTran);
    });
    this.finalizeTranx();
  }
  /*
   * Remove any AnimationTransformations which have completed during this loop.
   * Also, perform a React.setState to trigger a React.render during the death throes if the animTranx
   */
  finalizeTranx() {
    let tranx = this.animationState.tranx;
    let rmTranx1 = this.animationState.rmTranx1;
    this.log('finalizeTranx()',rmTranx1.size)
    // remove AnimationTransformers which are done by working back from the end of tranx
    if (rmTranx1.size) {
      rmTranx1.forEach((rmTran) => {
        let finalized =  rmTran.finalize();
        this.log(rmTran.toString() + '.finalize()', finalized);
        for (var idx = tranx.length - 1 ; idx > -1; idx--) {
          var item = tranx[idx];
          if (item === rmTran) {
            if (item !== tranx.splice(idx,1)[0]) {
              throw new Error(`${item} isnt ${rmTran} `);
            }
          }
        }
        //tranx.delete(rmTran);
        rmTranx1.delete(rmTran);
        this.log(`rm ${rmTran} because it is done or unimplemented`);
      });
    }
  }
  updateAnimationTransformers(deltaSec) {
    //this.log(`updateAnimationTransformers(${deltaSec})`);
    let elapsed = Date.now() - this.animationState.startTime;
    let animationBudget = this.animationState.durationMsec;
    let tranx = this.animationState.tranx;
    let rmTranx1 = this.animationState.rmTranx1;

    //this.log(`${elapsed} msec > ${animationBudget} msec   numAnimTran: ${tranx.size}`);
    if (elapsed > animationBudget || tranx.size == 0) {
      // The animation duration has been exceeded, so stop.
      this.stopAnimation();
    }
    // service each AnimationTransformer, calling its update() and recording those which are done
    tranx.forEach((animTran) => {
      if (animTran.update(deltaSec)) {
        rmTranx1.add(animTran); // just stash a reference in rmTranx1 for removal in endOfLoop()
      }
    })
  }
  /*
     To play nicely with React, drawAnimation() is where the calls to setState should happen
     since they trigger the actual rendering.
  */
  drawAnimationTransformers(interProp) {
    //this.log(`drawAnimation(${interProp})`)
    let tranx = this.animationState.tranx;
    // service each AnimationTransformer, calling its update() and recording those which are done
    let transforms = ["scale(.2 .2)" , "translate(30 30)"];
    transforms = [];
    let svg;
    tranx.forEach(function(animTran){
      var delta = animTran.draw(interProp);
      if (animTran.transform) {
        svg = animTran.flowerElem;
        transforms.push(animTran.transform);
      }
      this.log('drawing', this.constructor.name, animTran.toString(), interProp, delta);
    }, this);
    if (svg) {
      let transformation = transforms.join(' ');
      svg.setAttribute('transform', transformation);
    }
  }
  /*
   * beginOfLoop() always runs exactly once per frame.
   */
  beginOfLoop() {
    //console.group('beginOfLoop');
  }
  /*
    endOfLoop() always runs exactly once per frame.
   */
  endOfLoop(fps, panic) {
    //this.log('endOfLoop()');
    this.finalizeTranx();
    this.log(fps,"FPS");
    if (panic) {
      var discardedTime = Math.round(MainLoop.resetFrameDelta());
      console.warn("MainLoop panicked, probably because the browser tab was put in the background",
                   `Discarding ${discardedTime}ms`);

    }
    //console.groupEnd();
  }
  /* END OF THE ANIMATION */

  calcRadii(centralRadius) {
    let maxFrondLength = 50;
    let radii = [centralRadius];
    let packNum = this.props.numberOfFronds;
    for (let i = 1; i < maxFrondLength; i++) {
      radii[i] = calcRadiusOfPackedCircles(radii[i-1], packNum);
      packNum = this.props.packingOfPetals;
    }
    return radii;
  }
  calcDists(radii) {
    // idx=0 represents the rootPetal which is 0 from the center of the Reticle
    let dists = [],
        dist = 0,
        radius = 0;
    for (let idx = 0; idx < radii.length ; idx++) {
      dists[idx] = dist;
      dist = dists[idx] + radii[idx] + radii[idx+1];
    }
    return dists;
  }
  getPetalCount() {
    return this.petalCount;
  }
  update_currentTime_and_relPos(currentTime, relPos) {
    /*
     * currentTime is the currentTime of the video being played
     * relPos is (currentTime / totalDuration) and is therefore a float from 0 to 1
     *
     * These relate to the currently playing video, ie the currently focused video.
     * Namely, either the root or a petal.
     */
  }
  componentWillMount() {
    // https://developmentarc.gitbooks.io/react-indepth/content/life_cycle/birth/premounting_with_componentwillmount.html
    /*
      Prepare the initial state of the flower, here doing whatever calcs
      should preceed render() and follow constructor()
    */
    let centralRadius = this.props.proportionOfRoot * this.props.flowerMinDimension;
    this.log("setting centralRadius", centralRadius);
    this.setState({centralRadius: centralRadius});
    let radii = this.calcRadii(centralRadius);
    let dists = this.calcDists(radii);
    this.setState({radii: radii,
                   dists: dists,
                   scaleX: 1,
                   scaleY: 1,
                   translateX: 0,
                   translateY: 0,
                   frondRadius: this.calcFrondRadius(centralRadius)}); // HACK sending centralRadius
    this.log('calling shiftCenter() from componentWillMount()');
  }
  componentDidMount() {
    if (this.props.demoMode) {
      this.startRandomStream()
    }
    if (this.props.demoModeAfterNoDataSec > 0) {
      this.log('preparing demoModeAfterNoDataSec', this.props.demoModeAfterNoDataSec);
      setTimeout(() => {
        var pCount = this.getPetalCount();
        if (!pCount) {
          this.log('no data, so demo mode, petalCount:',pCount);
          this.startRandomStream();
        } else {
          this.log('data, so no demo mode, petalCount:',pCount);
        }
      }, this.props.demoModeAfterNoDataSec*1000)
    }
  }
  setRootClickHandler(handler) {
    this.rootClickHandler = handler;
  }
  callOnRootClick(evt, petal) {
    if (this.rootClickHandler) {
      this.rootClickHandler.call(evt, petal);
    }
  }
  setPetalClickHandler(handler) {
    this.petalClickHandler = handler;
  }
  callOnPetalClick(evt, petal) {
    if (this.petalClickHandler) {
      this.petalClickHandler.call(evt, petal);
    }
    this.log('calling peekAtPetal() from callOnPetalClick()');
    //this.peekAtPetal(petal);
  }
  getFocusedRadius() {
    return this.props.proportionOfFocused  * this.props.flowerMinDimension / 3;
  }
  registerPetal(petal) {
    this.petalByKey[petal.getKey()] = petal;
  }
  unregisterPetal(petal) {
    delete this.petalByKey[petal.getKey()];
  }
  getPetalByKey(key) {
    return this.petalByKey[key];
  }
  getRootKey() {
    if (!this.state.rootArgs) {
      return;
    }
    return this.state.rootArgs.key;
  }
  getRootPetal() {
    return this.petalByKey[this.getRootKey()];
  }
  getFocusedPetal() {
    return this.getPetalByKey(this.getFocusedPetalKey());
  }
  getFocusedPetalKey() {
    return this.focusedPetalKey;
  }
  setFocusedPetalKey(key) {
    this.focusedPetalKey = key;
  }
  unfocusOldFocusedPetal() {
    if (this.focusedPetalKey) {
      var oldFocus = this.getFocusedPetal();
      delete oldFocus.isTheFocus;
      delete this.focusedPetalKey;
    }
  }
  setFocusedPetal(petal) {
    this.unfocusOldFocusedPetal();
    this.setFocusedPetalKey(petal.getKey());
    petal.isTheFocus = true;
    //console.info(`setFocusedPetal(${petal.getKey()})`+(petal.isRoot() ? ' ROOT' : ''));
  }
  setRootPetal(args) {
    let key = getRandomId('p'); // unique!
    let rootArgs = {
      relPos: null, // normally a number, null signifies the root petal, not unique
      orderIdx: 0,  // zero for the central node?
      key: key,
      sortKey: Math.random(), // not unique
      url: getRandomId("http://example.org/"),
      thumbUrl: args.thumbUrl || this.props.defaultThumbUrl,
      fillColor: 'yellow',
      isRoot: true
    };
    for (let [k, v] of Object.entries(args)) {
      rootArgs[k] = v;
    }
    if (!rootArgs.myKey) { // redundant because children can not access their own key (wtf)
      rootArgs.myKey = rootArgs.key;
    }
    this.registerPatternToPetal(rootArgs);
    this.setState({'rootArgs': rootArgs});
    this.setFocusedPetalKey(rootArgs.key);
  }
  // https://codeburst.io/4-four-ways-to-style-react-components-ac6f323da822
  // https://www.sarasoueidan.com/blog/svg-coordinate-systems/
  //               {this.renderRingOfPetals()}
  //             {this.renderPetals()}
  render() {
    //  transform="translate(250,250)"
    const {title} = this.props;
    window.zeFlower = this;
    var svgElem = rce(
      'svg',
      {height:'100%', width:'100%',
       className: this.props.svgClassName,
       //transform: " translate(-100 -100) scale(.5 .5)",
       viewBox:"-100 -100 200 200"},  // FIXME why is this not "-100 -100 100 100" ???
      [ rce('g',
            {width:"200", height:"200"
	     //, transform: `scale(${this.state.scaleX} ${this.state.scaleY}) ` +
             //             `translate(${this.state.translateX} ${this.state.translateY})`
	    },
            [
              rce('rect',{width: 400, height:400, fill: this.props.bgFill, transform: "translate(-200 -200)"}),
              rce(Reticle,{rayLength:this.props.reticleRayLength, rays:this.props.reticleRays}),
              this.renderPatterns(),
              this.renderRootPetal(),
              this.renderFronds()
            ]
           )
      ]
    );
    return svgElem;
  }
}

DiversusFlower.propTypes = {
  demoMode: PropTypes.bool,
  demoClickingAfterMsec: PropTypes.number,
  numberOfFronds: PropTypes.number.isRequired,
  packingOfPetals: PropTypes.number,
  petalOpacity: PropTypes.number,
  proportionOfRoot: PropTypes.number.isRequired,
  randomStreamInterval: PropTypes.number, // how many msec between addRandomPetal
  reticleRays: PropTypes.number,
  reticleRayLength: PropTypes.number,
  svgClassName: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired
};
DiversusFlower.defaultProps = {
  bgFill:  "none",
  showThumbnails: false,
  defaultThumbUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Bakunyinportre.jpg",
  durationOfAnimation: .8,     // 1 seconds
  demoMode: false,
  demoModeAfterNoDataSec: -1,  // meaning NEVER
  demoClickingAfterMsec: -1,  // meaning NEVER
  fixedColorFronds: false,
  flowerMinDimension: 100, // distance from center to closest top or side of SVG in pixels
  maxRandomPetalCount: 50,
  numberOfFronds: 11,
  packingOfPetals: 9,
  petalOpacity: 1,
  proportionOfRoot: .4,
  proportionOfFocused: .53333,
  randomStreamInterval: 1,
  reticleRays: 80,
  reticleRayLength: 90,
  svgClassName: 'diversus-flower',
  title: "Hello",
  log: function(){}, //console.log,
  warn: function(){}, // console.warn,
  squelch: true
};

  this.DiversusFlower = DiversusFlower;
  this.putDiversusFlowerInElemOrId = function(elemOrId, props) {
    var elem = (typeof elemOrId == 'string') ? document.querySelector('#'+elemOrId) : elemOrId;
    return ReactDOM.render(React.createElement(DiversusFlower, props), elem);
  }

/*
From Martin:
* BG Colour/Opacity of Flower-Canvas
* Colour/Opacity of circular grid strokes (I call the circular grid “gauge”)
* Border-width (stroke)
* Start-Size of the root 0-1
    * Non-active Size of the root (when another Petal has been activated)
* Size of the active Petal (the one chosen and clicked/activated by the user)
* Size of the directly adjacent neighbour Petals to the active Petal (a question of clickability)
* Duration of construction-animation (when the flower gets construction in the beginning. eg. when the user double-clicked a Petal in order to make it a new root, then flower has to get assembled newly)
* In case there are springs (animations), tensions or fractions (in case you use physics) in the magnifier-animation it would be cool to have their properties available
*/
})();
