
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
let deadCenter = {cx: 0, cy: 0};

class Reticle {
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
      lines.push(`<line x2="${x}" y2="${y}" key="${'ray'+i}"/>`)
      i = i + inc;
    }
    lines.push((`<line x1="${-100}" y1="${-100}" x2="${100}" y2="${100}" key="tlbr"/>`));
    lines.push((`<line x1="100" y1="-100" x2="-100" y2="100" key="trbl"/>`));
    return lines;
  }
  render() {
    return (
      `<g stroke=${this.props.color} x1=${this.props.cx} y1=${this.props.cy} strokeWidth="1">
        ${this.renderLines()}
      </g>`
    )
  }
}
Reticle.defaultProps = {
  rays: 24,
  rayLength: 250,
  cx: 0,
  cy: 0,
  color: 'lightgrey'
}

class Petal {
  constructor(props) {
    if (!this.props.flower) {
      throw new Error('no flower for ',this.props.relPos)
    }
    // state:
    //   petalRadius: 12 // the radius (in pixels) of the petal
    //   angle: 0 // the angle of the center of this petal to its parent's center
    //   cx: 0.0  // the x coordinate of the center of this petal
    //   cy: 0.0  // the y coordinate of the center of this petal
  }
  onClick(evt) {
    //console.log(evt);
    //console.log(this.state.cx,this.state.cy);
    console.log("props", this.props);
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
    let {frondIdx, frond, args} = this.getTheGoods();
    console.log('makePeekSized() args:',args);
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
    console.log("num nodes:",flower.nodes.length, delta)
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
    //key = orderIdx + "";
    return (
        `<circle cx=${cx} cy=${cy} r=${petalRadius} stroke="black"
           opacity=${petalOpacity} fill=${fill}/>`
    )
    /*
           XonClick={this.onClick.bind(this)}
           XonContextMenu={this.onContextMenu.bind(this)}
    */

  }
}
/*
Petal.propTypes = {
  relPos: PropTypes.number,
  initialRadius: PropTypes.number,
//  key: PropTypes.string.isRequired,
  fill: PropTypes.string.isRequired,
  initialPriority: PropTypes.number.isRequired,
  orderIdx: PropTypes.number
};
*/
Petal.defaultProps = {
  fill: 'orange',
  initialPriority: 1.0
  //, initialRadius: 20
};
function overlay(target, source) {
  return Object(target,getOwnPropertyDescriptors(source));
}
function acquireCLASSIC(lst) {
  if (!lst.length) {
    throw new Error('acquire(lst) should have at least on object in lst');
  }
  var retval = lst.shift(); // take off first obj
  while (lst.length) {
    var dominates = lst.shift()
    retval = Object.getOwnPropertyDescriptors(retval, dominates);
  }
  return retval;
}
function acquire(...theArgs) {
  return theArgs.reduce((lower, dominates) => {
    return Object.getOwnPropertyDescriptors(lower || {}, dominates || {})
  });
}
class Heir  {
  // <SomeHeirSubclass whosYourDaddy={this.whoDad.bind(this) />
  constructor(props) {
    //this.props = overlay(overlay({}, DiversusFlower.defaultProps), props)
    this.props = acquire({}, DiversusFlower.defaultProps, props);
    //super(props);
    if (props && props.whosYourDaddy) {
      this.daddy = props.whosYourDaddy(this)
    }
  }
}

const divStyle = {
  'height': '500px',
  'width': '500px'
}

class DiversusFlower extends Heir {
  constructor(props) {
    super(props)

    this.state = {
      centralRadius: 50,
      fronds: [],
      petals: []
    };
    this.nodes = [];
    //this.prepareSimulation();
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
      //.force("x", d3.forceX().strength(0.002))
      //.force("y", d3.forceY().strength(0.002))
      .force('center', d3.forceCenter(0, 0))
      .velocityDecay(0.2)
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
        //console.log("<Petal>", key, relPos);
        if (typeof key == 'undefined') throw new Error('no key');
        retval.push((`<Petal relPos=${aFrond.relPos} key=${key}
                     orderIdx=${petalIdx+1}
                     fill=${fillColor} flower=${this}/>`));
      }
    }
    return retval;
  }
  renderRingOfPetals() {
    // https://en.wikipedia.org/wiki/Malfatti_circles
    // https://math.stackexchange.com/questions/1407779/arranging-circles-around-a-circle
    // http://www.packomania.com/
    let retval = []
    let max = this.props.numberOfFronds;
    for (let i = 0; i < max; i++) {
      retval.push((`<Petal relPos=${i/max} key=${i}
                       fill="purple" flower=${this}/>`));
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
    let newCenter = {cx: petalCenter.cx/2, cy: petalCenter.cy/2};
    this.shiftCenter(newCenter);
    petal.makePeekSized();
  }
  gotoPetal(petal) {
    console.log("%cBOLDLY GO", "color:red;");
    this.shiftCenter(petal.getCenter());
  }
  shiftCenter(newCenter) {
    let oldCenter = this.state.center || deadCenter;
    this.setState({center: newCenter});
    this.setState({oldCenter: oldCenter});
    console.log("shiftCenter()", newCenter);
  }
  renderCenterer() {
    let newCenter = this.state.center || deadCenter;
    let oldCenter = this.state.oldCenter;
    if (JSON.stringify(newCenter) == JSON.stringify(oldCenter)) {
      return ([]);
    }
    let newCenterStr = (-1 * newCenter.cx) + ' ' + (-1 * newCenter.cy);
    let oldCenterStr = oldCenter.cx + ' ' + oldCenter.cy;
    console.log("renderCenterer()");
    console.log('https://stackoverflow.com/a/22217506/1234699')
    return (
      `<animateTransform
         attributeName="transform"
         type="translate"
         from=${oldCenterStr}
         to=${newCenterStr}
         begin="0s"
         dur=".5s"
         fill="freeze"
         repeatCount="0"
        />`
    );
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
    this.setState({radii: radii});
    this.setState({dists: dists});
    this.setState({frondRadius: this.calcFrondRadius(centralRadius)}); // HACK sending centralRadius
    this.shiftCenter(deadCenter);
  }
  componentDidMount() {
    if (this.props.demoMode) {
      this.startRandomStream()
    } else {
      this.addRandomPetal();
    }
  }

  // https://codeburst.io/4-four-ways-to-style-react-components-ac6f323da822
  // https://www.sarasoueidan.com/blog/svg-coordinate-systems/
  //               {this.renderRingOfPetals()}
  //             {this.renderPetals()}
  render() {
    //  transform="translate(250,250)"
    const {title} = this.props;
    window.zeFlower = this;
    return (
      `<div  style={divStyle}>
        <svg height="100%" width="100%" viewBox="-100 -100 200 200" >
          {this.renderCenterer()}
          <title>{title}</title>
          <g>
            <Reticle rayLength=${this.props.reticleRayLength} rays=${this.props.reticleRays}/>
            <Petal orderIdx=${0} fill="yellow" flower=${this}/>
            ${this.renderFronds()}
          </g>
        </svg>
      </div>`
    );
  }
}

/*
DiversusFlower.propTypes = {
  title: PropTypes.string.isRequired,
  numberOfFronds: PropTypes.number.isRequired,
  packingOfPetals: PropTypes.number,
  proportionOfCenter: PropTypes.number.isRequired,
  reticleRays: PropTypes.number,
  reticleRayLength: PropTypes.number,
  petalOpacity: PropTypes.number,
  demoMode: PropTypes.bool,
  randomStreamInterval: PropTypes.number // how many msec between addRandomPetal
};
*/

DiversusFlower.defaultProps = {
  title: "Hello",
  numberOfFronds: 7,  // 11
  packingOfPetals: 8,
  proportionOfCenter: .10, // .30 times the flowerMinDimension this controls the radius of the root
  reticleRays: 80,
  reticleRayLength: 90,
  petalOpacity: 0.80,
  maxRandomPetalCount: 50,
  flowerMinDimension: 100, // distance from center to closest top or side of SVG in pixels
  demoMode: true,
  randomStreamInterval: 1,
  fixedColorFronds: true
};
(window.exports ? window.exports : this).DiversusFlower = DiversusFlower;

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
