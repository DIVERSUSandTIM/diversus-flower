(function() {  // beginning of IIFE

/*  These are expected in the environment:
import React from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import Force from 'd3-force';
import './styles.css';
*/


/**
 * Diversus Flower
 * ---------------
 *
 * This is an implementation of the graph visualization touring experience depicted here:
 *    https://vimeo.com/251879145
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
  componentWillUnmount() {
    console.log("componentWillUnmount()");
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
  onClick(evt) {
    //evt.stopPropagation()
    //evt.preventDefault()
    this.callExternalClickHandlers(evt);
    if (this.state.isTheFocus) {
      // TODO deal with click vs double click
      // This is already the focused petal so there is no need for a transformation, so bail.
      return;
    }
    console.log('calling peekAtPetal() from onClick()' + (this.isRoot() ? ' for root' : ''));
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
  makePeekSized() {
    if (this.isRoot()) {
      console.log("this is the rootPetal, so skipping makePeekSized()");
      return;
    }
    var flower = this.getFlower();
    let {frondIdx, frond, args} = this.getTheGoods();
    this.setState({targetRadius: flower.props.peekedRadius,
                   naturalRadius: this.state.petalRadius,
                   naturalCx: this.state.cx,
                   naturalCy: this.state.cy});
    flower.startAnimation();
    //console.log('makePeekSized() args:',args);
    //document.selectQuery()
  }
  componentWillMount() {
    // https://developmentarc.gitbooks.io/react-indepth/content/life_cycle/birth/premounting_with_componentwillmount.html
    let flower = this.getFlower();
    let orderIdx = this.props.orderIdx || 0;
    let centralRadius = flower.state.centralRadius;  // the radius of the central circle
    let delta = {} ;
    let petalRadius = flower.state.radii[orderIdx];
    delta.petalRadius = petalRadius;
    if (this.props.relPos) {
      let angle = getAngle(this.props.relPos);
      let distFromFlowerCenter = flower.state.dists[orderIdx];
      delta.cx = (Math.cos(angle) * (distFromFlowerCenter));
      delta.cy = (Math.sin(angle) * (distFromFlowerCenter));
    } else {
      delta.cx = 0;
      delta.cy = 0;
    }
    delta.isRoot = !!this.props.isRoot;
    this.setState(delta);
    flower.nodes.push(delta);  // probably do not need DiversusFlower.petalsByKey and .nodes
    //console.log("num nodes:",flower.nodes.length, delta)
    //console.log("<Petal> state:", this.state, deltaState);
  }
  componentDidMount() {
    //var flower = this.getFlower();
    //if (this.state.isRoot) {
    //flower.
  }
  render() {
    let {fill, orderIdx} = this.props;
    let flower = this.getFlower();
    //console.log(this.props);
    const petalOpacity = flower.props.petalOpacity;
    const {cx, cy, centralRadius, key} = this.state;
    const petalRadius = flower.state.radii[orderIdx];
    //console.log("Petal.render()", cx, cy, centralRadius, petalRadius);
    //let label = this.props.relPos.toString().substring(0,4);
    let label = "d:" + Math.round(flower.state.dists[orderIdx]) + ";r:"+Math.round(petalRadius);
    label = "" //+ key;
    let circleArgs = {cx:cx, cy:cy,
                      r:petalRadius,
                      stroke:"black", opacity:petalOpacity, fill:fill};
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
  }
  update(deltaMsec) {
    console.error(this.constructor.name, "needs update() implemented");
    return true;
  }
  draw(interProp) {
    console.error(this.constructor.name, "needs draw() implemented");
    return true;
  }
  toString() {
    return this.constructor.name;
  }
}
/**
 * Methods common to AnimationTransformers which affect the SVG as a whole.
 */
class FlowerTransformer extends AnimationTransformer {
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
    let delta = {scaleX: scale, scaleY: scale};
    this.flower.setState(delta);
    return delta;
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
    let delta = {translateX: this.lastCenter.cx + (this.center.cx - this.lastCenter.cx) * interProp,
                 translateY: this.lastCenter.cx + (this.center.cx - this.lastCenter.cy) * interProp};
    this.flower.setState(delta);
    return delta;
  }
}

/**
 * Handle shrinking or growing a petal depending on the kwargs.scaleFactor
 */
class PetalTransformer extends AnimationTransformer {
  constructor(flower, kwargs, petal, ...ignore) {
    super(flower, kwargs);
    this.petal = petal;
    let {petalRadius, cx, cy} = this.petal.state;
                                                                        
    // REVIEW is all this stuff well grounded???                        
    this.initialRadius = petalRadius;
    this.initialCX = cx;
    this.initialCY = cy;
    this.finalRadius = this.initialRadius * kwargs.scaleFactor;
    this.lastRadius = this.initialRadius;
    this.radiusTravel = this.finalRadius - this.initialRadius;
    this.radiusTravelPerMsec = this.radiusTravel / this.durationSec / 1000;
                                                                        
  }
  update(deltaMsec) {
    this.lastRadius = this.radius;
    this.radius += this.radiusTravelPerMsec * deltaMsec;
  }
  draw(interProp) {
    let radius = this.lastRadius + (this.radius - this.lastRadius) * interProp;
    let delta = {r: radius};
    this.petal.setState(delta);
    return delta;
  }
}
/**
 * Shrinks a Petal.
 */
class PetalShrink extends PetalTransformer {
  constructor(flower, kwargs, shrinkPetal) {
    super(flower, {scaleFactor: .5}, shrinkPetal); // TODO get scaleFactor from outside   
  }
}
/**
 * Grows a Petal.
 */
class PetalGrow extends PetalTransformer {
  constructor(flower, kwargs, growPetal) {
    super(flower, {scaleFactor: 2}, growPetal); // TODO get scaleFactor from outside   
  }
}


class DiversusFlower extends Heir {
  constructor(props) {
    super(props);
    this.state = {
      centralRadius: 50,
      centralPetal: null,
      fronds: [],
      petals: []
    };
    this.nodes = [];
    this.petalByKey = {};
    //this.prepareSimulation();
    this.initAnimation();
  }
  prepareSimulation() {
    let flower = this;
    let ticked = function() {
      var u = d3.select('svg')
          .selectAll('circle')
          .data(flower.nodes);
      u.enter(() => {alert('enter')}) // this method is called when a node enters the simulation
//        .append('circle')
        .attr('r', 5)
        .merge(u)
        .attr('cx', function(d) {
          return d.cx
        })
        .attr('cy', function(d) {
          return d.cy
        })
      u.exit().remove()
    }

    this.sim = d3.forceSimulation(flower.nodes)
      //.force('collide', d3.forceCollide().radius(this.getPetalRadius.bind(this)).iterations(3))
      .force('collide', d3.forceCollide().radius(function(){alert('boo')}))
      .velocityDecay(0.2)
      .force("x", d3.forceX().strength(0.002))
      .force("y", d3.forceY().strength(0.002))
      .force('center', d3.forceCenter(0, 0))
      .on('tick', ticked)
  }

  getPetalRadius(petal) {
    return petal.petalRadius;
    return this.nodes[petalIdx].petalRadius;
  }
  whoDad(aFrond) { // Fronds call this to know their Flower
    // Register Frond (aFrond) on their DiversusFlower (this) here, if needed
    return this;
  }
  toggleRandomStream() {
    console.log('toggleRandomStream()');
    if (this.randomStreamTimer) {
      console.log("TOGGLE randomStream off")
      this.stopRandomStream();
    } else {
      console.log("TOGGLE randomStream on")
      this.startRandomStream();
    }
  }
  startRandomStream(interval) {
    interval = interval || this.props.randomStreamInterval;
    console.log('startRandomStream');
    let dis = this;
    this.randomStreamTimer = setInterval( function(){dis.addRandomPetal()}, interval)
    this.addRandomPetal(); // run one now!
  }
  stopRandomStream(){
    if (this.randomStreamTimer) {
      console.log('stopRandomStream');
      clearInterval(this.randomStreamTimer);
      delete this.randomStreamTimer;
    } else {
      console.log('no randomStreamTimer found');
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
      fillColor: getRandomColor()
    };
    args.title = args.url;
    //console.log("args",args);
    this.addPetal(args);
    if (this.randomPetalCount > this.props.maxRandomPetalCount) {
      this.stopRandomStream();
    }
  }
  calcFrondRadius() {
    return calcRadiusOfPackedCircles(this.state.centralRadius,
                                     this.props.numberOfFronds);
  }
  getOrCreateFrond(relPos) {
    let idx = getBinIdx(relPos, this.props.numberOfFronds);
    let frondRelPos = getBinMid(idx, this.props.numberOfFronds);
    return this.state.fronds[idx] || {key: idx, relPos: frondRelPos, petals: []};
  }
  addPetal(args) {
    let idx = getBinIdx(args.relPos, this.props.numberOfFronds);
    let frondRelPos = getBinMid(idx, this.props.numberOfFronds);
    let aFrond = this.state.fronds[idx] || {
      key: idx,
      relPos: frondRelPos,
      frondColor: getRandomColor(),
      petals: [],
      radius: this.state.frondRadius
    };
    if (this.props.fixedColorFronds) {
      args.fillColor = aFrond.frondColor;
    }
    if (!args.myKey) {
      args.key = args.myKey;
    }
    aFrond.petals.push(args);
    this.state.fronds[idx] = aFrond;
    this.setState({fronds: this.state.fronds});
  }
  renderFronds() {
    let retval = [];
    for (let frondIdx = 0; frondIdx < this.state.fronds.length; frondIdx++) {
      let aFrond = this.state.fronds[frondIdx];
      if (!aFrond) {
        continue;
      }
      for (let petalIdx = 0; petalIdx < aFrond.petals.length; petalIdx++) {
        let {key, myKey, relPos, fillColor} = aFrond.petals[petalIdx];
        if (typeof key == 'undefined') throw new Error('no key');
        retval.push(
          rce(Petal,
              {relPos: aFrond.relPos, key: key, myKey: myKey,
               orderIdx: petalIdx+1, fill: fillColor,
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
  getFocusedPetal() {
    return this.state.focusedPetal;
  }
  focusOnPetal(clickedPetal, clickedCircle) {
    /*
    var petalCenter = clickedPetal.getCenter();
    console.log("petalCenter:", petalCenter);
    let newCenter = {cx: fix(petalCenter.cx), cy: fix(petalCenter.cy)};

    var animArgs = {};
    if (clickedPetal.isRoot()) { // if the clicked node is the root
      var priorFocusedPetal = this.getFocusedPetal();
      animArgs.shrinkPetals = [priorFocusedPetal];  // an array for generality
      animArgs.growPetals = []
    }
    */
    this.initAnimationState(clickedPetal, this.getFocusedPetal());
    this.startAnimation();
    // REVIEW When should the clickedPetal become the focusedPetal?
    //   Either immediately (as implemented here) or after the animation is done.
    //   Immediately is perhaps best because then more clicks can happen on nodes
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
    var tranx = this.animationState.tranx;
    if (growMe.isRoot()) { // C==R,F!=R  (we know F!=R because if F==R then C==F which aborts above)
      // The root is growing, so in lieu of growing the root Petal, grow the whole graph.
      tranx.add(new FlowerResize(this, {scale: this.state.scaleX, finalScale:1}));
      tranx.add(new FlowerMove(this, Object.assign({}, deadCenter)));
      // so shrinkMe can NOT be the root therefore
      tranx.add(new PetalShrink(this, {}, shrinkMe));
    } else { // C!=R
      var factor = .8;
      if (shrinkMe.isRoot()) { // C!=R,F==R -- shrink the root and grow the clicked petal
        // TODO in truth the further out the petal, the smaller the flower
        tranx.add(new FlowerResize(this, {scale: this.state.scaleX, finalScale:.5}));
        tranx.add(new FlowerMove(this, growMe.getCenter(factor)));
        tranx.add(new PetalGrow(this, {}, growMe));
      } else { // C!=R,F!=R -- shrink the Focused and grow the Clicked
        tranx.add(new PetalShrink(this, {}, shrinkMe));
        tranx.add(new PetalGrow(this, {}, growMe));
        tranx.add(new FlowerMove(this, growMe.getCenter(factor)));
      }
    }
    console.log("initAnimationState");
    console.log(tranx);
    /*
    this.animationState = {changingPetals: []};
    if (petal === this.state.currentPetal) {
      this.animationState.changingPetals.push({petal: petal,
                                               shrinking: true,
                                               initialRadius: petal.radius});
    } else {
      this.animationState.changingPetals.push({petal: petal, growing: true});
    }
    */
  }
  shiftCenter(newCenter) {
    window.shiftCenter = (window.shiftCenter || 0) + 1; // REMOVE used for debugging
    let firstTime = (! this.state.center);
    let oldCenter = this.state.center || deadCenter;
    console.log("newCenter",newCenter);
    let newScale = samePoint(newCenter, deadCenter) ? "1 1" : this.props.onPeekScaleTo;
    console.log("newScale", newScale);
    let oldScale = (this.state.newScale) ? this.state.newScale : '1 1';
    let scale = newScale.split(' ');
    console.log("scale", scale);
    console.log("newCenter", newCenter);
    let deltaState = {
      translateX: newCenter.cx,
      translateY: newCenter.cy,
      scaleX: scale[0],
      scaleY: scale[1],
      center: newCenter,
      oldCenter: oldCenter,
      newScale: newScale,
      oldScale: oldScale};
    this.setState(deltaState);
    console.log("shiftCenter", JSON.stringify(deltaState));
    if (! firstTime) { // shiftCenter() gets called at flower init to initialize 'center'
      this.startAnimation();
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
      console.log('MainLoop unavailable');
    }
  }
  initializeAnimationState() {
      this.animationState = {
        tranx: new Set(),  // the transitions, in application precedence order
        rmTranx1: new Set() // completed transitions are queued here for removal at endOfLoop()
      };
  }
  /*
    Calculate initial and the final values of things being animated for inbetweening by update.
   */
  startAnimation() {
    if (MainLoop) {
      /*
      let newCenter = this.state.center || deadCenter;
      let oldCenter = this.state.oldCenter || deadCenter;
      if (JSON.stringify(newCenter) == JSON.stringify(oldCenter)) {
        console.log("startAnimation() is bailing because finalCenter(",
                    newCenter, ") equals initialCenter (" + oldCenter + ")");
        return ([]);
      }
      let newCenterStr = (-1 * fix(newCenter.cx)) + ' ' + (-1 * fix(newCenter.cy));
      let oldCenterStr = fix(oldCenter.cx) + ' ' + fix(oldCenter.cy);
      console.log("renderCenterer()",oldCenterStr,"==>",newCenterStr);
      let newScale = this.state.newScale ; //|| this.props.onPeekScaleTo;
      let oldScale = this.state.oldScale || "1 1";
      if (samePoint(newCenter,deadCenter)) {
        console.log("renderCenterer() changing newScale from",newScale,"to '1 1'")
        newScale = "1 1";
      }
      Object.assign(this.animationState, {
        startTime: Date.now(),
        initialCenter: oldCenter,
        finalCenter: newCenter,
        initialScale: oldScale,
        finalScale: newScale
      });
      */
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
      console.log('MainLoop.start()')
      MainLoop.start();
    }
  }
  stopAnimation() {
    console.log('stopAnimation()');
    if (MainLoop) {
      this.initializeAnimationState();
      MainLoop.stop();
    }
  }
  /*
    Here in updateModel() is where the in-betweening should happen for:
      1) SVG scale
      2) SVG translate
      3) petal-CIRCLE radius
      4) petel-CIRCLE center
    We do not call setState() from here though because that would trigger the drawing
    which is the responsibility of updateModel().

    Here, though we must attend to the fraction of the
  */
  updateAnimationTransformers(deltaSec) {
    //console.log(`updateAnimationTransformers(${deltaSec})`);
    let elapsed = Date.now() - this.animationState.startTime;
    let animationBudget = this.animationState.durationMsec;
    let tranx = this.animationState.tranx;
    let rmTranx1 = this.animationState.rmTranx1;

    //console.log(`${elapsed} msec > ${animationBudget} msec   numAnimTran: ${tranx.size}`);
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
    //console.log(`drawAnimation(${interProp})`)
    let tranx = this.animationState.tranx;
    // service each AnimationTransformer, calling its update() and recording those which are done
    tranx.forEach(function(animTran){
      var delta = animTran.draw(interProp);
      //console.log('drawing', animTran.toString(), interProp, delta);
    }, this)
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
    // REVIEW should should we do a final setState here to ensure proper resting scale and position?
    //console.log('endOfLoop()');
    let tranx = this.animationState.tranx;
    let rmTranx1 = this.animationState.rmTranx1;
    // remove AnimationTransformers which are done by working back from the end of tranx
    if (rmTranx1.size) {
      rmTranx1.forEach((rmTran) => {
        tranx.delete(rmTran);
        console.info(`rm ${rmTran} because it is done or unimplemented`);
      });
    }
    console.log(fps,"FPS");
    if (panic) {
      var discardedTime = Math.round(MainLoop.resetFrameDelta());
      console.warn("MainLoop panicked, probably because the browser tab was put in tthe background",
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
  componentWillMount() {
    // https://developmentarc.gitbooks.io/react-indepth/content/life_cycle/birth/premounting_with_componentwillmount.html
    /*
      Prepare the initial state of the flower, here doing whatever calcs
      should preceed render() and follow constructor()
    */
    let centralRadius = this.props.proportionOfCenter * this.props.flowerMinDimension;
    console.log("setting centralRadius", centralRadius);
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
    console.log('calling shiftCenter() from componentWillMount()');
    //this.shiftCenter(deadCenter);
  }
  componentDidMount() {
    if (this.props.demoMode) {
      this.startRandomStream()
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
    console.log('calling peekAtPetal() from callOnPetalClick()');
    //this.peekAtPetal(petal);
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
    return this.state.rootArgs.key;
  }
  getRootPetal() {
    return this.petalByKey(the.getRootKey());
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
  setFocusedPetal(petal) {
    this.setFocusedPetalKey(petal.getKey());
    console.info(`setFocusedPetal(${petal.getKey()})`+(petal.isRoot() ? ' ROOT' : ''));
  }
  setRootPetal(args) {
    let key = getRandomId('p'); // unique!
    let rootArgs = {
      relPos: null, // normally a number, null signifies the root petal
      orderIdx: 0,            // zero for the central node?
      key: key,
      myKey: key, // redundant because children can not access their own key (wtf)
      sortKey: Math.random(), // not unique
      url: getRandomId("http://example.org/"),
      fill: 'yellow',
      isRoot: true
    };
    for (let [k, v] of Object.entries(args)) {
      rootArgs[k] = v;
    }
    this.setState({'rootArgs': rootArgs})
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
       transform: `scale(${this.state.scaleX} ${this.state.scaleY}) ` +
                  `translate(${this.state.translateX} ${this.state.translateY})`,
       viewBox:"-100 -100 200 200",  // FIXME why is this not "-100 -100 100 100" ???
       "className": this.props.svgClassName},
      [
        rce(Reticle,{rayLength:this.props.reticleRayLength, rays:this.props.reticleRays}),
        this.renderRootPetal(),
        this.renderFronds()
      ]
    );
    return svgElem;
  }
}

DiversusFlower.propTypes = {
  demoMode: PropTypes.bool,
  numberOfFronds: PropTypes.number.isRequired,
  packingOfPetals: PropTypes.number,
  petalOpacity: PropTypes.number,
  proportionOfCenter: PropTypes.number.isRequired,
  randomStreamInterval: PropTypes.number, // how many msec between addRandomPetal
  reticleRays: PropTypes.number,
  reticleRayLength: PropTypes.number,
  svgClassName: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired
};

DiversusFlower.defaultProps = {
  velocityOfScale: .333,       // 1/3 ie full scale in three seconds
  velocityOfTranslation:  33, // full translation in 3 seconds
  durationOfAnimation: .8,     // 1 seconds
  onPeekTranslateDuration: "1.5s",
  onPeekScaleTo: ".5 .5",
  onPeekScaleDuration: ".5s",
  demoMode: false,
  fixedColorFronds: true,
  flowerMinDimension: 100, // distance from center to closest top or side of SVG in pixels
  maxRandomPetalCount: 50,
  numberOfFronds: 7,  // 11
  packingOfPetals: 8,
  petalOpacity: 0.80,
  proportionOfCenter: .10, // .30 times the flowerMinDimension this controls the radius of the root
  randomStreamInterval: 1,
  reticleRays: 80,
  reticleRayLength: 90,
  svgClassName: 'diversus-flower',
  title: "Hello"
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
