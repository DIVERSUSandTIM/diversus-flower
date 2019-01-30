(function() {  // beginning of IIFE

/*  These are expected in the environment:
import React from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import Force from 'd3-force';
import './styles.css';
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
               {stroke:this.props.color, x1:this.props.cx, y1:this.props.cy, strokeWidth:1},
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
    if (!this.props.flower) {
      throw new Error('no flower for ',this.props.relPos)
    }
    // state:
    //   petalRadius: 12 // the radius (in pixels) of the petal
    //   angle: 0 // the angle of the center of this petal to its parent's center
    //   cx: 0.0  // the x coordinate of the center of this petal
    //   cy: 0.0  // the y coordinate of the center of this petal
  }
  isRoot() {
    return !this.props.relPos; // force a boolean response
  }
  onClick(evt) {
    //console.log(evt);
    //console.log(this.state.cx,this.state.cy);
    console.log("props", this.props);
    if (this.isRoot()) {
      this.props.flower.callOnRootClick(evt, this);
    } else {
      this.props.flower.callOnPetalClick(evt, this);
    }
    console.log('calling peekAtPetal() from onClick()');
    this.props.flower.peekAtPetal(this);
  }
  onContextMenu(evt) {
    //console.log(evt);
    //console.log(this.state.cx,this.state.cy);
    evt.stopPropagation()
    evt.preventDefault()
    console.log("props", this.props);
    this.props.flower.gotoPetal(this);
  }
  getCenter() {
    //console.log("getCenter()",this.props);
    return {cx: this.state.cx, cy: this.state.cy};
  }
  getTheGoods() {
    let flower = this.props.flower;
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
    let {frondIdx, frond, args} = this.getTheGoods();
    this.setState({targetRadius: this.props.flower.props.peekedRadius,
                   naturalRadius: this.state.petalRadius,
                   naturalCx: this.state.cx,
                   naturalCy: this.state.cy});
    this.props.flower.startAnimation();
    //console.log('makePeekSized() args:',args);
    //document.selectQuery()
  }
  componentWillMount() {
    // https://developmentarc.gitbooks.io/react-indepth/content/life_cycle/birth/premounting_with_componentwillmount.html
    let flower = this.props.flower;
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
    this.setState(delta);
    flower.nodes.push(delta)
    //console.log("num nodes:",flower.nodes.length, delta)
    //console.log("<Petal> state:", this.state, deltaState);
  }
  render() {
    let {fill, orderIdx, flower} = this.props;
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
    circleArgs.onContextMenu = this.onContextMenu.bind(this)
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
    let args = {
      relPos: Math.random(),  // not unique
      key: getRandomId('p'),  // unique!
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
        let {key, relPos, fillColor} = aFrond.petals[petalIdx];
        if (typeof key == 'undefined') throw new Error('no key');
        retval.push(
          rce(Petal,
              {relPos: aFrond.relPos, key: key,
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
  XXXrenderRingOfPetals() {
    // https://en.wikipedia.org/wiki/Malfatti_circles
    // https://math.stackexchange.com/questions/1407779/arranging-circles-around-a-circle
    // http://www.packomania.com/
    let retval = [];
    let max = this.props.numberOfFronds;
    for (let i = 0; i < max; i++) {
      retval.push((`<Petal relPos={i/max} key={i}
                       fill="purple" flower={this}/>`));
    }
    return retval;
  }
  // https://nvbn.github.io/2017/03/14/react-generators/
  calcFrondRadius(centralRadius) {  // receiving centralRadius as param is an ugly hack
    return calcRadiusOfPackedCircles(centralRadius || this.state.centralRadius,
                                     this.props.numberOfFronds);
  }
  peekAtPetal(petal) {
    var petalCenter = petal.getCenter();
    console.log("petalCenter:", petalCenter);
    let newCenter = {cx: fix(petalCenter.cx), cy: fix(petalCenter.cy)};
    console.log('calling shiftCenter() from peekAtPetal()');
    this.shiftCenter(newCenter);
    petal.makePeekSized();
  }
  gotoPetal(petal) {
    console.log("%cBOLDLY GO", "color:red;");
    console.log('calling shiftCenter() from gotoPetal()');
    this.shiftCenter(petal.getCenter());
  }
  shiftCenter(newCenter) {
    window.shiftCenter = (window.shiftCenter || 0) + 1;
    let firstTime = (! this.state.center);
    let oldCenter = this.state.center || deadCenter;
    console.log("newCenter",newCenter);
    let newScale = samePoint(newCenter, deadCenter) ? "1 1" : this.props.onPeekScaleTo;
    console.log("newScale", newScale);
    let oldScale = (this.state.newScale) ? this.state.newScale : '1 1';
    let scale = newScale.split(' ');
    console.log("scale", scale);
    console.log("newCenter", newCenter);
    let newState = {
      translateX: newCenter.cx,
      translateY: newCenter.cy,
      scaleX: scale[0],
      scaleY: scale[1],
      center: newCenter,
      oldCenter: oldCenter,
      newScale: newScale,
      oldScale: oldScale};
    this.setState(newState);
    console.log("shiftCenter", JSON.stringify(newState));
    if (! firstTime) {
      //this.scheduleAnimationLEGACY();
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
      MainLoop.
        setUpdate(this.updateAnimation.bind(this)).
        setDraw(this.drawAnimation.bind(this)).
        setEnd(this.endAnimation.bind(this));
    } else {
      console.log('MainLoop unavailable');
    }
  }
  startAnimation() {
    if (MainLoop) {
      MainLoop.start();
    }
  }
  stopAnimation() {
    console.log('stopAnimation()');
    if (MainLoop) {
      MainLoop.stop();
    }
  }
  updateAnimation() {
    console.log('updateAnimation()');
    /*
      translate svg
      scale svg
      scale clickedPetal up
      scale previousPetal down
    */
    this.setState({});
    this.stopAnimation(); // nothing happening yet, so we can stop already
  }
  drawAnimation() {
    //this.
    console.log('drawAnimation()')
  }
  endAnimation() {
    console.log('endAnimation()')
  }
  /* END OF THE ANIMATION */

  scheduleAnimationLEGACY() {
    // wait 30msec so React has a chance to put the animateTransform elems into the svg
    setTimeout(() => this.triggerAnimation('animateTransform'), 30);
  }
  renderCenterer() {
    let newCenter = this.state.center || deadCenter;
    let oldCenter = this.state.oldCenter || deadCenter;
    if (JSON.stringify(newCenter) == JSON.stringify(oldCenter)) {
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
    /*
      We must trigger the animation for it to actually begin.
      It runs fine the first time it is triggered because the begin="0s" attribute
      tells it to run immediately.  The challenge is to get the animation to run
      on subsequent occasions.  One way to do this would be to remove the animateTransform
      element after it has done its work (when is that?) and then to insert a new one.

        https://stackoverflow.com/a/22217506/1234699
        https://developer.mozilla.org/en-US/docs/Web/API/SVGAnimationElement
    */
    // these animations are triggered by scheduleAnimation
    return [
      rce('animateTransform',
          {attributeName: "transform",
           key: "recenterFlower",
           type: "translate",
           from: oldCenterStr,
           to: newCenterStr,
           begin: "indefinite",
           dur: this.props.onPeekTranslateDuration,
           fill: "freeze",
           //additive: "sum",
           repeatCount: "0"}),
      rce('animateTransform',
          {attributeName: "transform",
           key: "resizeFlower",
           type: "scale",
           from: oldScale,
           to: newScale,
           begin: "indefinite",
           dur: this.props.onPeekScaleDuration,
           fill: "freeze",
           additive: "sum",
           repeatCount: "0"})
    ];
  }
  triggerAnimation(selector) {
    let anims = document.querySelectorAll(selector);
    //console.log("anims", anims);
    anims.forEach((anim) => {
      console.log('beginElement()',anim);
      anim.beginElement();
    });
    return;
    for (var i=0; i < anims.length; i++) {
      console.log('beginElement()',anims[i]);
      anims[i].beginElement();
    }
  }
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
    this.shiftCenter(deadCenter);
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
  XXXXpeekPetal(peekedPetal) {
    /*
      Purpose: Animate the growing of the peekedPetal and slide the whole svg
        to a center between the rootPetal and this peekedPetal
    */
    this.setState({'center': {cx: 100, cy:200}})
  }
  setRootPetal(args) {
    let rootArgs = {
      relPos: null, // normally a number, null signifies the root petal
      orderIdx: 0,            // zero for the central node?
      key: getRandomId('p'),  // unique!
      sortKey: Math.random(), // not unique
      url: getRandomId("http://example.org/"),
      fill: 'yellow'
      //flower: this
    };
    for (let [k, v] of Object.entries(args)) {
      rootArgs[k] = v;
    }
    this.setState({'rootArgs': rootArgs})
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
       transform: `scale(${this.state.scaleX} ${this.state.scaleY}) translate(${this.state.translateX} ${this.state.translateY})`,
       viewBox:"-100 -100 200 200",  // FIXME why is this not "-100 -100 100 100" ???
       "className": this.props.svgClassName},
      [
        rce(Reticle,{rayLength:this.props.reticleRayLength, rays:this.props.reticleRays}),
        this.renderRootPetal(),
        this.renderFronds(),
        //this.renderCenterer()
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
